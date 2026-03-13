// ---------------------------------------------------------------------------
// Forja API Client — build-time data fetching for Astro
// ---------------------------------------------------------------------------

const API_URL = import.meta.env.CMS_API_URL as string;
const API_KEY = import.meta.env.CMS_API_KEY as string;
const SITE_ID = import.meta.env.CMS_SITE_ID as string;
const SITE_URL = (import.meta.env.SITE_URL as string) || "http://localhost:4321";

/** Public site URL (no trailing slash). */
export function getSiteUrl(): string {
  return SITE_URL.replace(/\/+$/, "");
}

// ---- Error types ----------------------------------------------------------

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
  /** Machine-readable code following `{DOMAIN}_{ACTION}_{REASON}` pattern. */
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

// ---- Generic helpers ------------------------------------------------------

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

/**
 * Parse a `Retry-After` header value into milliseconds.
 * Supports both delta-seconds (`120`) and HTTP-date formats.
 */
function parseRetryAfter(header: string | null): number {
  if (!header) return INITIAL_BACKOFF_MS;
  const seconds = Number(header);
  if (!Number.isNaN(seconds)) return seconds * 1000;
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return INITIAL_BACKOFF_MS;
}

/**
 * Core fetch wrapper with structured error parsing and 429 retry logic.
 *
 * On non-2xx responses the body is parsed as {@link ProblemDetails} and
 * thrown as a {@link ForjaApiError}. Rate-limited (429) responses are
 * retried with exponential backoff, honouring the `Retry-After` header.
 */
async function api<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      headers: { "X-API-Key": API_KEY },
    });

    if (res.ok) return res.json() as Promise<T>;

    // Rate limited — retry with backoff
    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryMs = parseRetryAfter(res.headers.get("Retry-After"));
      const backoff = Math.min(retryMs, INITIAL_BACKOFF_MS * 2 ** attempt);
      console.warn(
        `[CMS] 429 rate limited on ${url}, retrying in ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }

    // Parse structured error body
    let problem: ProblemDetails;
    try {
      problem = (await res.json()) as ProblemDetails;
    } catch {
      problem = {
        type: "about:blank",
        title: res.statusText,
        status: res.status,
        detail: `${res.status} ${res.statusText} — ${url}`,
        code: "UNKNOWN_ERROR",
      };
    }

    console.error(`[CMS] ${problem.code}: ${problem.detail || problem.title} — ${url}`);
    throw new ForjaApiError(problem);
  }

  // Unreachable in practice, but satisfies the type checker
  throw new Error(`[CMS] Exhausted retries for ${url}`);
}

// ---- Site -----------------------------------------------------------------

/** Site-level configuration returned by the CMS. */
export interface SiteInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  timezone: string;
  is_active: boolean;
}

let _cachedSite: SiteInfo | null = null;

/** Fetch site info (cached for the lifetime of the build/dev process). */
export async function fetchSite(): Promise<SiteInfo> {
  if (_cachedSite) return _cachedSite;
  _cachedSite = await api<SiteInfo>(`/sites/${SITE_ID}`);
  return _cachedSite;
}

// ---- Shared types ---------------------------------------------------------

/** Pagination metadata returned alongside paginated collections. */
export interface PaginationMeta {
  page: number;
  page_size: number;
  total_pages: number;
  total_items: number;
}

/** A paginated collection with data items and pagination metadata. */
export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

// ---- Blog -----------------------------------------------------------------

/** Summary representation of a blog post in list views. */
export interface BlogListItem {
  id: string;
  slug: string | null;
  author: string;
  published_date: string;
  reading_time_minutes: number | null;
  cover_image_id: string | null;
  header_image_id: string | null;
  is_featured: boolean;
  is_sample: boolean;
  status: string;
  publish_start: string | null;
  publish_end: string | null;
  created_at: string;
  updated_at: string;
}

/** A content localization (translation) for a blog post or page. */
export interface LocalizationResponse {
  id: string;
  content_id: string;
  locale_id: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  body: string | null;
  meta_title: string | null;
  meta_description: string | null;
  translation_status: string;
  created_at: string;
  updated_at: string;
}

/** A category assigned to a blog post. */
export interface CategoryResponse {
  id: string;
  parent_id: string | null;
  slug: string;
  is_global: boolean;
  created_at: string;
}

/** A document (media attachment) linked to a blog post. */
export interface BlogDocumentResponse {
  id: string;
  blog_id: string;
  media_id: string;
  display_order: number;
}

/** Full blog post detail including localizations, categories, and documents. */
export interface BlogDetailResponse {
  id: string;
  content_id: string;
  slug: string | null;
  author: string;
  published_date: string;
  reading_time_minutes: number | null;
  cover_image_id: string | null;
  header_image_id: string | null;
  is_featured: boolean;
  is_sample: boolean;
  allow_comments: boolean;
  status: string;
  published_at: string | null;
  publish_start: string | null;
  publish_end: string | null;
  created_at: string;
  updated_at: string;
  localizations: LocalizationResponse[];
  categories: CategoryResponse[];
  documents: BlogDocumentResponse[];
}

/**
 * Fetch a page of published blog posts.
 *
 * @param page - 1-indexed page number (default: 1)
 * @param pageSize - items per page, max 100 (default: 10)
 * @param sortBy - field to sort by (default: "published_at")
 * @param sortDir - sort direction, "asc" or "desc" (default: "desc")
 */
export async function fetchPublishedBlogs(
  page = 1,
  pageSize = 10,
  sortBy = "published_at",
  sortDir: "asc" | "desc" = "desc",
): Promise<Paginated<BlogListItem>> {
  return api(
    `/sites/${SITE_ID}/blogs/published?page=${page}&page_size=${pageSize}&sort_by=${sortBy}&sort_dir=${sortDir}`,
  );
}

/**
 * Fetch every published blog post across all pages.
 * Iterates through paginated results automatically.
 */
export async function fetchAllPublishedBlogs(): Promise<BlogListItem[]> {
  const first = await fetchPublishedBlogs(1, 100);
  const items = [...first.data];
  for (let p = 2; p <= first.meta.total_pages; p++) {
    const page = await fetchPublishedBlogs(p, 100);
    items.push(...page.data);
  }
  return items;
}

/**
 * Fetch featured blog posts.
 *
 * @param limit - maximum number of featured posts to return (default: 3)
 */
export async function fetchFeaturedBlogs(limit = 3): Promise<BlogListItem[]> {
  return api(`/sites/${SITE_ID}/blogs/featured?limit=${limit}`);
}

/**
 * Fetch blog posts similar to the given blog.
 *
 * @param blogId - the blog post ID to find similar content for
 * @param limit - maximum number of similar posts to return (default: 3)
 */
export async function fetchSimilarBlogs(blogId: string, limit = 3): Promise<BlogListItem[]> {
  return api(`/sites/${SITE_ID}/blogs/${blogId}/similar?limit=${limit}`);
}

/**
 * Fetch a blog post's full detail by its URL slug.
 * Resolves the slug to an ID first, then fetches the detail view.
 */
export async function fetchBlogBySlug(slug: string): Promise<BlogDetailResponse> {
  const brief = await api<{
    id: string;
    content_id: string;
    slug: string | null;
  }>(`/sites/${SITE_ID}/blogs/by-slug/${slug}`);
  return api(`/blogs/${brief.id}/detail`);
}

/** Fetch a single blog post's full detail by ID. */
export async function fetchBlogDetail(id: string): Promise<BlogDetailResponse> {
  return api(`/blogs/${id}/detail`);
}

/**
 * Fetch blog details for multiple IDs, batched to avoid rate limits.
 *
 * @param ids - array of blog post IDs
 * @param batchSize - how many to fetch in parallel per batch (default: 5)
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

// ---- Navigation -----------------------------------------------------------

/** A node in the navigation tree (recursive structure). */
export interface NavigationTree {
  id: string;
  parent_id: string | null;
  page_id: string | null;
  external_url: string | null;
  icon: string | null;
  display_order: number;
  open_in_new_tab: boolean;
  title: string | null;
  page_slug: string | null;
  children: NavigationTree[];
}

/** Metadata about a navigation menu. */
export interface NavigationMenuResponse {
  id: string;
  site_id: string;
  slug: string;
  description: string | null;
  max_depth: number;
  is_active: boolean;
  item_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch a navigation menu's tree by its slug.
 * Returns an empty array if the menu does not exist.
 */
export async function fetchNavTree(
  menuSlug: string,
): Promise<NavigationTree[]> {
  try {
    const menu = await api<NavigationMenuResponse>(
      `/sites/${SITE_ID}/menus/slug/${menuSlug}`,
    );
    const tree = await api<NavigationTree[]>(`/menus/${menu.id}/tree`);
    return tree;
  } catch {
    return [];
  }
}

// ---- Pages & Sections -----------------------------------------------------

/** Summary representation of a CMS page in list views. */
export interface PageListItem {
  id: string;
  route: string;
  page_type: string;
  slug: string | null;
  is_in_navigation: boolean;
  status: string;
  publish_start: string | null;
  publish_end: string | null;
  created_at: string;
}

/** Full page detail returned by the CMS. */
export interface PageResponse {
  id: string;
  content_id: string;
  route: string;
  page_type: string;
  template: string | null;
  is_in_navigation: boolean;
  navigation_order: number | null;
  parent_page_id: string | null;
  slug: string | null;
  status: string;
  published_at: string | null;
  publish_start: string | null;
  publish_end: string | null;
  created_at: string;
  updated_at: string;
}

/** A section within a page (hero, text, gallery, etc.). */
export interface PageSectionResponse {
  id: string;
  page_id: string;
  section_type: string;
  display_order: number;
  cover_image_id: string | null;
  call_to_action_route: string | null;
  settings: Record<string, unknown> | null;
}

/** Localized content for a page section. */
export interface SectionLocalizationResponse {
  id: string;
  page_section_id: string;
  locale_id: string;
  title: string | null;
  text: string | null;
  button_text: string | null;
}

/**
 * Fetch a paginated list of CMS pages.
 *
 * @param page - 1-indexed page number (default: 1)
 * @param pageSize - items per page, max 100 (default: 100)
 */
export async function fetchPages(
  page = 1,
  pageSize = 100,
): Promise<Paginated<PageListItem>> {
  return api(`/sites/${SITE_ID}/pages?page=${page}&page_size=${pageSize}`);
}

/**
 * Fetch a page by its route path.
 *
 * @param route - the page route (leading slashes are stripped automatically)
 */
export async function fetchPageByRoute(route: string): Promise<PageResponse> {
  const cleanRoute = route.replace(/^\/+/, "");
  return api(`/sites/${SITE_ID}/pages/by-route/${cleanRoute}`);
}

/** Fetch all sections for a page by its ID. */
export async function fetchPageSections(
  pageId: string,
): Promise<PageSectionResponse[]> {
  return api(`/pages/${pageId}/sections`);
}

/** Fetch all section localizations for a page by its ID. */
export async function fetchPageSectionLocalizations(
  pageId: string,
): Promise<SectionLocalizationResponse[]> {
  return api(`/pages/${pageId}/sections/localizations`);
}

// ---- Legal ----------------------------------------------------------------

/** Localized metadata for a legal document. */
export interface LegalDocLocalizationResponse {
  id: string;
  locale_id: string;
  title: string;
  intro: string | null;
}

/** Full legal document with all localizations. */
export interface LegalDocumentDetailResponse {
  id: string;
  cookie_name: string;
  document_type: string;
  localizations: LegalDocLocalizationResponse[];
  created_at: string;
  updated_at: string;
}

/**
 * Fetch a legal document by its URL slug.
 *
 * @param slug - the legal document slug (e.g. "privacy-policy", "terms")
 */
export async function fetchLegalDocBySlug(
  slug: string,
): Promise<LegalDocumentDetailResponse> {
  return api(`/sites/${SITE_ID}/legal/by-slug/${slug}`);
}

// ---- CV -------------------------------------------------------------------

/** A CV / resume entry (work experience, education, etc.). */
export interface CvEntryResponse {
  id: string;
  company: string;
  company_url: string | null;
  company_logo_id: string | null;
  location: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  entry_type: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all CV entries, optionally filtered by type.
 *
 * @param entryType - filter to a specific type (e.g. "work", "education")
 */
export async function fetchCvEntries(
  entryType?: string,
): Promise<CvEntryResponse[]> {
  const typeParam = entryType ? `&entry_type=${entryType}` : "";
  const first = await api<Paginated<CvEntryResponse>>(
    `/sites/${SITE_ID}/cv?page=1&page_size=100${typeParam}`,
  );
  return first.data;
}

// ---- Skills ---------------------------------------------------------------

/** A skill or technology with optional proficiency level. */
export interface SkillResponse {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  icon: string | null;
  proficiency_level: number | null;
}

/** Fetch all skills for the site. */
export async function fetchSkills(): Promise<SkillResponse[]> {
  const first = await api<Paginated<SkillResponse>>(
    `/sites/${SITE_ID}/skills?page=1&page_size=100`,
  );
  return first.data;
}

// ---- Media ----------------------------------------------------------------

/** A resized variant of a media asset. */
export interface MediaVariantResponse {
  id: string;
  variant_name: string;
  width: number;
  height: number;
  file_size: number;
  public_url: string | null;
}

/** A media asset (image, video, document) stored in the CMS. */
export interface MediaResponse {
  id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  storage_provider: string;
  public_url: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  is_global: boolean;
  created_at: string;
  updated_at: string;
  variants: MediaVariantResponse[];
}

/** Fetch a single media asset by ID. */
export async function fetchMedia(id: string): Promise<MediaResponse> {
  return api(`/media/${id}`);
}

/**
 * Fetch multiple media items in parallel batches.
 * Returns a Map keyed by media ID. Failed fetches are silently skipped.
 *
 * @param ids - media asset IDs to fetch
 * @param batchSize - how many to fetch in parallel per batch (default: 5)
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
      batch.map((id) =>
        fetchMedia(id).catch(() => null),
      ),
    );
    for (let j = 0; j < batch.length; j++) {
      if (items[j]) result.set(batch[j], items[j]!);
    }
  }
  return result;
}

// ---- Social Links -----------------------------------------------------------

/** A social media link displayed in the site footer/header. */
export interface SocialLinkResponse {
  id: string;
  title: string;
  url: string;
  icon: string;
  alt_text: string | null;
  display_order: number;
}

let _cachedSocialLinks: SocialLinkResponse[] | null = null;

/** Fetch social links for the site (cached in-process). */
export async function fetchSocialLinks(): Promise<SocialLinkResponse[]> {
  if (_cachedSocialLinks) return _cachedSocialLinks;
  try {
    _cachedSocialLinks = await api<SocialLinkResponse[]>(
      `/sites/${SITE_ID}/social`,
    );
  } catch {
    _cachedSocialLinks = [];
  }
  return _cachedSocialLinks;
}

// ---- Blog category filter ---------------------------------------------------

/**
 * Fetch published blog posts filtered by category.
 *
 * @param categorySlug - the category slug to filter by
 * @param page - 1-indexed page number (default: 1)
 * @param pageSize - items per page, max 100 (default: 12)
 * @param sortBy - field to sort by (default: "published_at")
 * @param sortDir - sort direction, "asc" or "desc" (default: "desc")
 */
export async function fetchPublishedBlogsByCategory(
  categorySlug: string,
  page = 1,
  pageSize = 12,
  sortBy = "published_at",
  sortDir: "asc" | "desc" = "desc",
): Promise<Paginated<BlogListItem>> {
  return api(
    `/sites/${SITE_ID}/blogs/published/category/${categorySlug}?page=${page}&page_size=${pageSize}&sort_by=${sortBy}&sort_dir=${sortDir}`,
  );
}
