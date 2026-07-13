// ---------------------------------------------------------------------------
// Forja API Client — delegates to @forjacms/client SDK
// ---------------------------------------------------------------------------

import {
  ForjaClient,
  ForjaNotFoundError,
  type BlogDetailResponse,
  type BlogListItem,
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

// ---- Site locale type (not in SDK yet) ------------------------------------

export interface SiteLocale {
  locale_id: string;
  code: string;
  name: string;
  native_name?: string;
  direction: 'ltr' | 'rtl';
  is_default: boolean;
  is_active: boolean;
}

// ---- Site (cached) --------------------------------------------------------

let _cachedSite: SiteResponse | null = null;
let _cachedLocales: SiteLocale[] | null = null;

/** Fetch site info (cached for the lifetime of the build/dev process). */
export async function fetchSite(): Promise<SiteResponse> {
  if (_cachedSite) return _cachedSite;
  _cachedSite = await client().site.get();
  return _cachedSite;
}

/** Fetch active site locales (cached). */
export async function fetchSiteLocales(): Promise<SiteLocale[]> {
  if (_cachedLocales) return _cachedLocales;
  const baseUrl = (import.meta.env.CMS_API_URL as string).replace(/\/+$/, '');
  const apiKey = import.meta.env.CMS_API_KEY as string;
  const siteId = import.meta.env.CMS_SITE_ID as string;
  const res = await fetch(`${baseUrl}/sites/${siteId}/locales`, {
    headers: { 'X-API-Key': apiKey },
  });
  if (!res.ok) throw new Error(`Failed to fetch locales: ${res.status}`);
  _cachedLocales = (await res.json() as SiteLocale[]).filter((l) => l.is_active);
  return _cachedLocales;
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

// Per-build cache: nav menus are part of the page chrome, so the same slugs
// (primary, footer) are requested on every page. Memoize by slug + locale so
// each menu is fetched once per build instead of once per page.
const _cachedNavMenus = new Map<string, NavMenuData>();

/**
 * Fetch a navigation menu (tree + localized display name) by its slug,
 * cached per slug + locale. Returns empty items if the menu does not exist
 * or the fetch fails — chrome renders without nav instead of crashing.
 */
export async function fetchNavMenu(
  menuSlug: string,
  locale?: string,
): Promise<NavMenuData> {
  const cacheKey = `${menuSlug}:${locale ?? ""}`;
  const cached = _cachedNavMenus.get(cacheKey);
  if (cached) return cached;

  let result: NavMenuData = { items: [] };
  try {
    const composed = await client().navigation.getMenuWithTree(
      menuSlug,
      locale ? { locale } : undefined,
    );
    if (composed) {
      result = {
        items: composed.items,
        localizedName: composed.menu.resolvedName ?? undefined,
      };
    }
  } catch {
    // Keep the empty result; cache it so we don't retry on every page.
  }
  _cachedNavMenus.set(cacheKey, result);
  return result;
}

/**
 * Fetch a navigation menu's tree by its slug (cached per slug).
 * Returns an empty array if the menu does not exist.
 */
export async function fetchNavTree(
  menuSlug: string,
): Promise<import("@forjacms/client").NavigationTree[]> {
  return (await fetchNavMenu(menuSlug)).items;
}

// ---- UI strings -------------------------------------------------------------

// Per-build cache: the chrome-string dictionary is needed on every page for
// the same handful of locales. Memoize by locale code — including failures,
// so a dead backend doesn't add a fetch per page (t() falls back to the
// template defaults).
const _cachedUiStrings = new Map<string, Record<string, string>>();

/**
 * Fetch the resolved UI-string map for a locale (cached per locale code).
 * Returns an empty map if the fetch fails or the site has no strings
 * configured — chrome then renders the template defaults.
 */
export async function fetchUiStrings(
  locale: string,
): Promise<Record<string, string>> {
  const cached = _cachedUiStrings.get(locale);
  if (cached) return cached;

  let result: Record<string, string> = {};
  try {
    result = await client().strings(locale);
  } catch {
    // Keep the empty result; cache it so we don't retry on every page.
  }
  _cachedUiStrings.set(locale, result);
  return result;
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
