// ---------------------------------------------------------------------------
// Forja API Client — delegates to @forjacms/client SDK
// ---------------------------------------------------------------------------

import {
  ForjaClient,
  ForjaNotFoundError,
  type BlogDetailResponse,
  type BlogListItem,
  type CodeInjection,
  type MediaResponse,
  type Paginated,
  type PublicCollectionEntry,
  type PublicCollectionSchema,
  type SiteResponse,
  type SocialLinkResponse,
} from "@forjacms/client";

const SITE_URL =
  (import.meta.env.SITE_URL as string) || "http://localhost:4321";

// Lazy-initialized — avoids crashing in preview-only deployments
// where CMS_API_KEY and CMS_SITE_ID are not set at build time.
let _client: ForjaClient | undefined;

function client(): ForjaClient {
  if (!_client) {
    _client = new ForjaClient({
      baseUrl: import.meta.env.CMS_API_URL as string,
      apiKey: import.meta.env.CMS_API_KEY as string,
      siteId: import.meta.env.CMS_SITE_ID as string,
      // Required for public Forms endpoints (#582/#584) — they resolve
      // the site via the X-Site-Domain header rather than path params.
      siteDomain: import.meta.env.CMS_SITE_DOMAIN as string | undefined,
    });
  }
  return _client;
}

export type {
  PublicFormDefinition,
  FormFieldDefinition,
  FormFieldType,
  FormSubmitResponse,
} from "@forjacms/client";

export async function fetchPublicForm(slug: string, locale?: string) {
  return client().forms.getForm(slug, locale ? { locale } : undefined);
}

/** Browser-side base URL used by the inline submit script to POST without
 *  pulling the full SDK into the page bundle. */
export function getApiBaseUrl(): string {
  return (import.meta.env.CMS_API_URL as string).replace(/\/+$/, "");
}

export function getSiteDomain(): string | undefined {
  return import.meta.env.CMS_SITE_DOMAIN as string | undefined;
}

// ---- Re-export SDK types used by pages / components -----------------------

export type { SiteResponse as SiteInfo } from "@forjacms/client";

export type {
  BlogListItem,
  BlogDetailResponse,
  BlogDocumentResponse,
  CategoryResponse,
  CvEntryResponse,
  DocumentLocalizationResponse,
  LegalDocLocalizationResponse,
  LegalDocumentDetailResponse,
  LocalizationResponse,
  MediaResponse,
  MediaVariantResponse,
  NavigationMenuResponse,
  NavigationTree,
  Paginated,
  PaginationMeta,
  PageListItem,
  PageResponse,
  PageDetailResponse,
  PageSectionResponse,
  SectionLocalizationResponse,
  SkillResponse,
  SocialLinkResponse,
} from "@forjacms/client";

// ---- Error types (used by preview-api.ts) ---------------------------------

/** A single field-level validation error returned by the API. */
export interface FieldError {
  field: string;
  message: string;
  code?: string;
}

/** RFC 7807 problem details returned by the Forja API on errors. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code: string;
  errors?: FieldError[];
}

/** Structured error thrown when an API request fails. */
export class ForjaApiError extends Error {
  constructor(public readonly problem: ProblemDetails) {
    super(problem.detail || problem.title);
    this.name = "ForjaApiError";
  }
}

// ---- Utilities ------------------------------------------------------------

/** Public site URL (no trailing slash). */
export function getSiteUrl(): string {
  return SITE_URL.replace(/\/+$/, "");
}

// ---- TTL cache for per-request chrome data ---------------------------------

// The SSR process lives across deploys of CMS content, so chrome caches must
// expire: successes get a modest TTL (matches the server-side response cache)
// so CMS edits show up, and failures are only held for a short retry-after so
// one transient backend error doesn't blank the chrome until redeploy.
const CHROME_CACHE_TTL_MS = 60_000;
const CHROME_CACHE_RETRY_AFTER_MS = 5_000;

interface ChromeCacheEntry<T> {
  value: T;
  expiresAt: number;
}

/** Fetch-through cache: serves fresh entries, refreshes expired ones, and
 * caches `fallback` briefly on failure — it never throws into the page. */
async function fetchWithTtlCache<T>(
  cache: Map<string, ChromeCacheEntry<T>>,
  key: string,
  fetcher: () => Promise<T>,
  fallback: T,
): Promise<T> {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.value;

  try {
    const value = await fetcher();
    cache.set(key, { value, expiresAt: Date.now() + CHROME_CACHE_TTL_MS });
    return value;
  } catch {
    cache.set(key, {
      value: fallback,
      expiresAt: Date.now() + CHROME_CACHE_RETRY_AFTER_MS,
    });
    return fallback;
  }
}

// ---- Site locale type (template-facing subset of SiteLocaleResponse) ------

export interface SiteLocale {
  locale_id: string;
  code: string;
  name: string;
  native_name?: string | null;
  direction: 'ltr' | 'rtl';
  is_default: boolean;
  is_active: boolean;
}

// ---- Site (cached) --------------------------------------------------------

let _cachedSite: SiteResponse | null = null;

/** Fetch site info (cached for the lifetime of the build/dev process). */
export async function fetchSite(): Promise<SiteResponse> {
  if (_cachedSite) return _cachedSite;
  _cachedSite = await client().site.get();
  return _cachedSite;
}

// Locales gate chrome on every request — memoize with the chrome TTL and fall
// back to an empty list, which callers treat as "no locale filtering".
const _cachedLocales = new Map<string, ChromeCacheEntry<SiteLocale[]>>();

/** Fetch active site locales (cached; empty list if the fetch fails). */
export async function fetchSiteLocales(): Promise<SiteLocale[]> {
  return fetchWithTtlCache(
    _cachedLocales,
    'locales',
    async () => (await client().site.listLocales()).filter((l) => l.is_active),
    [],
  );
}

/** Get the default locale code for the site. */
export async function getDefaultLocaleCode(): Promise<string> {
  const locales = await fetchSiteLocales();
  return locales.find((l) => l.is_default)?.code ?? locales[0]?.code ?? 'en';
}

// ---- Blogs ----------------------------------------------------------------

/** Fetch a page of published blog posts, optionally filtered by locale. */
export async function fetchPublishedBlogs(
  page = 1,
  pageSize = 10,
  localeId?: string,
): Promise<Paginated<BlogListItem>> {
  return client().blogs.listPublished({ page, pageSize, localeId });
}

/** Fetch every published blog post across all pages. */
export async function fetchAllPublishedBlogs(localeId?: string): Promise<BlogListItem[]> {
  const result = await client().blogs.listPublished({ page: 1, pageSize: 100, localeId });
  return result.fetchAll();
}

/** Fetch featured blog posts. */
export async function fetchFeaturedBlogs(
  limit = 3,
): Promise<BlogListItem[]> {
  return client().blogs.listFeatured({ limit });
}

/** Fetch blog posts similar to the given blog. */
export async function fetchSimilarBlogs(
  blogId: string,
  limit = 3,
): Promise<BlogListItem[]> {
  return client().blogs.listSimilar(blogId, { limit });
}

/** Fetch a blog post's full detail by its URL slug. */
export async function fetchBlogBySlug(
  slug: string,
): Promise<BlogDetailResponse> {
  const result = await client().blogs.getBySlug(slug);
  if (!result) throw new ForjaNotFoundError(`Blog "${slug}" not found`);
  return result;
}

/** Fetch a single blog post's full detail by ID. */
export async function fetchBlogDetail(
  id: string,
): Promise<BlogDetailResponse> {
  const result = await client().blogs.get(id);
  if (!result) throw new ForjaNotFoundError(`Blog "${id}" not found`);
  return result;
}

/**
 * Fetch blog details for multiple IDs, batched to avoid rate limits.
 */
export async function fetchBlogDetails(
  ids: string[],
  batchSize = 5,
): Promise<BlogDetailResponse[]> {
  const results: BlogDetailResponse[] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const details = await Promise.all(batch.map((id) => fetchBlogDetail(id)));
    results.push(...details);
  }
  return results;
}

/** Fetch published blog posts filtered by category, optionally by locale. */
export async function fetchPublishedBlogsByCategory(
  categorySlug: string,
  page = 1,
  pageSize = 12,
  localeId?: string,
): Promise<Paginated<BlogListItem>> {
  return client().blogs.listByCategory(categorySlug, { page, pageSize, localeId });
}

// ---- Navigation -----------------------------------------------------------

/** A menu's tree plus its CMS-configured display name for one locale. */
export interface NavMenuData {
  items: import("@forjacms/client").NavigationTree[];
  /** Menu name localized for the requested locale — unset when the CMS has
   * none configured, so chrome falls back to its own default heading. */
  localizedName?: string;
}

// Nav menus are part of the page chrome, so the same slugs (primary, footer)
// are requested on every render — memoize by slug + locale with a TTL.
const _cachedNavMenus = new Map<string, ChromeCacheEntry<NavMenuData>>();

/**
 * Fetch a navigation menu (tree + localized display name) by its slug,
 * cached per slug + locale for a short TTL. Returns empty items if the menu
 * does not exist or the fetch fails — chrome renders without nav instead of
 * crashing, and the next render after the retry window tries again.
 */
export async function fetchNavMenu(
  menuSlug: string,
  locale?: string,
): Promise<NavMenuData> {
  return fetchWithTtlCache(
    _cachedNavMenus,
    `${menuSlug}:${locale ?? ""}`,
    async () => {
      const composed = await client().navigation.getMenuWithTree(
        menuSlug,
        locale ? { locale } : undefined,
      );
      return composed
        ? {
            items: composed.items,
            localizedName: composed.menu.resolvedName ?? undefined,
          }
        : { items: [] };
    },
    { items: [] },
  );
}

/**
 * Fetch a navigation menu's tree by its slug (cached per slug + locale).
 * Returns an empty array if the menu does not exist.
 */
export async function fetchNavTree(
  menuSlug: string,
  locale?: string,
): Promise<import("@forjacms/client").NavigationTree[]> {
  return (await fetchNavMenu(menuSlug, locale)).items;
}

// ---- UI strings -------------------------------------------------------------

// The chrome-string dictionary is needed on every page for the same handful
// of locales — memoize by locale code with a TTL.
const _cachedUiStrings = new Map<string, ChromeCacheEntry<Record<string, string>>>();

/**
 * Fetch the resolved UI-string map for a locale (cached per locale code for
 * a short TTL). Returns an empty map if the fetch fails or the site has no
 * strings configured — chrome then renders the template defaults, and the
 * next render after the retry window tries again.
 */
export async function fetchUiStrings(
  locale: string,
): Promise<Record<string, string>> {
  return fetchWithTtlCache(_cachedUiStrings, locale, () => client().strings(locale), {});
}

// ---- Code injection ---------------------------------------------------------

// Operator-configured head/footer HTML is chrome too — same TTL treatment.
// Failures fall back to empty snippets, so the layout renders nothing instead
// of crashing and retries after the failure window.
const EMPTY_CODE_INJECTION: CodeInjection = {
  code_injection_head: "",
  code_injection_footer: "",
};

const _cachedCodeInjection = new Map<string, ChromeCacheEntry<CodeInjection>>();

/**
 * Fetch the site's code-injection snippets (cached for a short TTL).
 * Returns empty snippets when unconfigured or when the fetch fails.
 */
export async function fetchCodeInjection(): Promise<CodeInjection> {
  return fetchWithTtlCache(
    _cachedCodeInjection,
    "code-injection",
    () => client().site.getCodeInjection(),
    EMPTY_CODE_INJECTION,
  );
}

// ---- Pages & Sections -----------------------------------------------------

/** Fetch a paginated list of CMS pages. */
export async function fetchPages(
  page = 1,
  pageSize = 100,
): Promise<Paginated<import("@forjacms/client").PageListItem>> {
  return client().pages.list({ page, pageSize });
}

/** Fetch a page by its route path. */
export async function fetchPageByRoute(
  route: string,
): Promise<import("@forjacms/client").PageDetailResponse> {
  const result = await client().pages.getByRoute(route);
  if (!result) throw new ForjaNotFoundError(`Page "${route}" not found`);
  return result;
}

/** Fetch all sections for a page by its ID. */
export async function fetchPageSections(
  pageId: string,
): Promise<import("@forjacms/client").PageSectionResponse[]> {
  return client().pages.getSections(pageId);
}

/** Fetch all section localizations for a page by its ID. */
export async function fetchPageSectionLocalizations(
  pageId: string,
): Promise<import("@forjacms/client").SectionLocalizationResponse[]> {
  return client().pages.getPageSectionLocalizations(pageId);
}

// ---- Legal ----------------------------------------------------------------

// Per-build cache: legal docs (imprint, privacy) are linked from the footer
// and fetched repeatedly across pages. Memoize successful lookups by slug.
const _cachedLegalDocs = new Map<
  string,
  import("@forjacms/client").LegalDocumentDetailResponse
>();

/** Fetch a legal document by its URL slug (cached per slug). */
export async function fetchLegalDocBySlug(
  slug: string,
): Promise<import("@forjacms/client").LegalDocumentDetailResponse> {
  const cached = _cachedLegalDocs.get(slug);
  if (cached) return cached;

  const result = await client().legal.getBySlug(slug);
  if (!result) throw new ForjaNotFoundError(`Legal doc "${slug}" not found`);
  _cachedLegalDocs.set(slug, result);
  return result;
}

// ---- CV -------------------------------------------------------------------

/** Fetch all CV entries, optionally filtered by type. */
export async function fetchCvEntries(
  entryType?: string,
): Promise<import("@forjacms/client").CvEntryResponse[]> {
  const result = await client().cv.listEntries({
    entryType: entryType as import("@forjacms/client").CvEntryType | undefined,
    page: 1,
    pageSize: 100,
  });
  return result.data;
}

/** Fetch all skills for the site. */
export async function fetchSkills(): Promise<
  import("@forjacms/client").SkillResponse[]
> {
  const result = await client().cv.listSkills({ page: 1, pageSize: 100 });
  return result.data;
}

// ---- Media ----------------------------------------------------------------

/** Fetch a single media asset by ID. */
export async function fetchMedia(id: string): Promise<MediaResponse> {
  const result = await client().media.get(id);
  if (!result) throw new ForjaNotFoundError(`Media "${id}" not found`);
  return result;
}

/**
 * Fetch multiple media items in parallel batches.
 * Returns a Map keyed by media ID. Failed fetches are silently skipped.
 */
export async function fetchMediaBatch(
  ids: string[],
  batchSize = 5,
): Promise<Map<string, MediaResponse>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const result = new Map<string, MediaResponse>();
  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    const items = await Promise.all(
      batch.map((id) => client().media.get(id).catch(() => null)),
    );
    for (let j = 0; j < batch.length; j++) {
      if (items[j]) result.set(batch[j], items[j]!);
    }
  }
  return result;
}

// ---- Social Links ---------------------------------------------------------

let _cachedSocialLinks: SocialLinkResponse[] | null = null;

/** Fetch social links for the site (cached on success only). */
export async function fetchSocialLinks(): Promise<SocialLinkResponse[]> {
  if (_cachedSocialLinks !== null) return _cachedSocialLinks;
  try {
    _cachedSocialLinks = await client().social.list();
  } catch {
    // Don't cache failures — allow retry on next request
    return [];
  }
  return _cachedSocialLinks;
}

// ---- Custom types ("Collections", #801) -----------------------------------

/** Public field schema for a collection, or null if it isn't publicly readable. */
export async function fetchCollectionSchema(
  typeKey: string,
): Promise<PublicCollectionSchema | null> {
  return client().collections(typeKey).schema();
}

/** All published entries of a collection (follows pagination to the end). */
export async function fetchPublishedCollectionEntries(
  typeKey: string,
  locale?: string,
): Promise<PublicCollectionEntry[]> {
  const first = await client()
    .collections(typeKey)
    .published({ pageSize: 100, locale });
  return first.fetchAll ? await first.fetchAll() : first.data;
}

/** A single published collection entry by slug, or null. */
export async function fetchCollectionEntryBySlug(
  typeKey: string,
  slug: string,
  locale?: string,
): Promise<PublicCollectionEntry | null> {
  return client().collections(typeKey).bySlug(slug, locale ? { locale } : undefined);
}
