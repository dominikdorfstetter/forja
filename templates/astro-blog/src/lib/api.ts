// ---------------------------------------------------------------------------
// OpenYapper API Client — build-time data fetching for Astro SSG
// ---------------------------------------------------------------------------

const API_URL = import.meta.env.CMS_API_URL as string;
const API_KEY = import.meta.env.CMS_API_KEY as string;
const SITE_ID = import.meta.env.CMS_SITE_ID as string;

// ---- Generic helpers ------------------------------------------------------

async function api<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;
  const res = await fetch(url, {
    headers: { "X-API-Key": API_KEY },
  });
  if (!res.ok) {
    const msg = `API ${res.status}: ${res.statusText} — ${url}`;
    console.error(`[CMS] ${msg}`);
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ---- Site -----------------------------------------------------------------

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

export interface PaginationMeta {
  page: number;
  page_size: number;
  total_pages: number;
  total_items: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

// ---- Blog -----------------------------------------------------------------

export interface BlogListItem {
  id: string;
  slug: string | null;
  author: string;
  published_date: string;
  reading_time_minutes: number | null;
  cover_image_id: string | null;
  header_image_id: string | null;
  is_featured: boolean;
  status: string;
  publish_start: string | null;
  publish_end: string | null;
  created_at: string;
  updated_at: string;
}

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

export interface CategoryResponse {
  id: string;
  parent_id: string | null;
  slug: string;
  is_global: boolean;
  created_at: string;
}

export interface BlogDocumentResponse {
  id: string;
  blog_id: string;
  media_id: string;
  display_order: number;
}

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

export async function fetchPublishedBlogs(
  page = 1,
  perPage = 10,
): Promise<Paginated<BlogListItem>> {
  return api(`/sites/${SITE_ID}/blogs/published?page=${page}&per_page=${perPage}`);
}

export async function fetchAllPublishedBlogs(): Promise<BlogListItem[]> {
  const first = await fetchPublishedBlogs(1, 100);
  const items = [...first.data];
  for (let p = 2; p <= first.meta.total_pages; p++) {
    const page = await fetchPublishedBlogs(p, 100);
    items.push(...page.data);
  }
  return items;
}

export async function fetchFeaturedBlogs(limit = 3): Promise<BlogListItem[]> {
  return api(`/sites/${SITE_ID}/blogs/featured?limit=${limit}`);
}

export async function fetchBlogBySlug(slug: string): Promise<BlogDetailResponse> {
  const brief = await api<{
    id: string;
    content_id: string;
    slug: string | null;
  }>(`/sites/${SITE_ID}/blogs/by-slug/${slug}`);
  return api(`/blogs/${brief.id}/detail`);
}

export async function fetchBlogDetail(id: string): Promise<BlogDetailResponse> {
  return api(`/blogs/${id}/detail`);
}

/** Fetch blog details for multiple IDs, batched to avoid rate limits. */
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

export interface PageSectionResponse {
  id: string;
  page_id: string;
  section_type: string;
  display_order: number;
  cover_image_id: string | null;
  call_to_action_route: string | null;
  settings: Record<string, unknown> | null;
}

export interface SectionLocalizationResponse {
  id: string;
  page_section_id: string;
  locale_id: string;
  title: string | null;
  text: string | null;
  button_text: string | null;
}

export async function fetchPages(
  page = 1,
  perPage = 100,
): Promise<Paginated<PageListItem>> {
  return api(`/sites/${SITE_ID}/pages?page=${page}&per_page=${perPage}`);
}

export async function fetchPageByRoute(route: string): Promise<PageResponse> {
  // Strip leading slash — the API path segment already provides one
  const cleanRoute = route.replace(/^\/+/, "");
  return api(`/sites/${SITE_ID}/pages/by-route/${cleanRoute}`);
}

export async function fetchPageSections(
  pageId: string,
): Promise<PageSectionResponse[]> {
  return api(`/pages/${pageId}/sections`);
}

export async function fetchPageSectionLocalizations(
  pageId: string,
): Promise<SectionLocalizationResponse[]> {
  return api(`/pages/${pageId}/sections/localizations`);
}

// ---- Legal ----------------------------------------------------------------

export interface LegalDocLocalizationResponse {
  id: string;
  locale_id: string;
  title: string;
  intro: string | null;
}

export interface LegalDocumentDetailResponse {
  id: string;
  cookie_name: string;
  document_type: string;
  localizations: LegalDocLocalizationResponse[];
  created_at: string;
  updated_at: string;
}

export async function fetchLegalDocBySlug(
  slug: string,
): Promise<LegalDocumentDetailResponse> {
  return api(`/sites/${SITE_ID}/legal/by-slug/${slug}`);
}

// ---- CV -------------------------------------------------------------------

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

export async function fetchCvEntries(
  entryType?: string,
): Promise<CvEntryResponse[]> {
  const typeParam = entryType ? `&entry_type=${entryType}` : "";
  const first = await api<Paginated<CvEntryResponse>>(
    `/sites/${SITE_ID}/cv?page=1&per_page=100${typeParam}`,
  );
  return first.data;
}

// ---- Skills ---------------------------------------------------------------

export interface SkillResponse {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  icon: string | null;
  proficiency_level: number | null;
}

export async function fetchSkills(): Promise<SkillResponse[]> {
  const first = await api<Paginated<SkillResponse>>(
    `/sites/${SITE_ID}/skills?page=1&per_page=100`,
  );
  return first.data;
}

// ---- Media ----------------------------------------------------------------

export interface MediaVariantResponse {
  id: string;
  variant_name: string;
  width: number;
  height: number;
  file_size: number;
  public_url: string | null;
}

export interface MediaResponse {
  id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  public_url: string | null;
  width: number | null;
  height: number | null;
  variants: MediaVariantResponse[];
}

export async function fetchMedia(id: string): Promise<MediaResponse> {
  return api(`/media/${id}`);
}
