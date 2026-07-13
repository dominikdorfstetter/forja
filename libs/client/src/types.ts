// ── Client configuration ─────────────────────────────────────

export interface ForjaClientConfig {
  baseUrl: string;
  apiKey: string;
  siteId: string;
  fetch?: typeof globalThis.fetch;
  /**
   * Public site domain. Sent as the `X-Site-Domain` header on every
   * request — required by the public Forms endpoints (#582/#584) which
   * resolve the site from the domain rather than a path parameter.
   * Optional: omit when only authenticated, site_id-scoped endpoints
   * are used.
   */
  siteDomain?: string;
}

// ── Pagination ───────────────────────────────────────────────

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

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface LocaleFilterParams extends PaginationParams {
  /** Filter to content with a localization in this locale (UUID). */
  localeId?: string;
}

export interface SearchablePaginationParams extends PaginationParams {
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

// ── Shared enums ─────────────────────────────────────────────

export type ContentStatus =
  | 'Draft'
  | 'InReview'
  | 'Scheduled'
  | 'Published'
  | 'Archived';

export type TranslationStatus =
  | 'Pending'
  | 'InProgress'
  | 'Review'
  | 'Approved'
  | 'Outdated';

export type PageType =
  | 'Static'
  | 'Landing'
  | 'Contact'
  | 'BlogIndex'
  | 'Custom';

export type SectionType =
  | 'Hero'
  | 'Features'
  | 'Cta'
  | 'Gallery'
  | 'Testimonials'
  | 'Pricing'
  | 'Faq'
  | 'Contact'
  | 'Custom'
  | 'Stats'
  | 'Team'
  | 'Timeline'
  | 'LogoCloud'
  | 'Newsletter'
  | 'Video'
  | 'Divider'
  | 'Text'
  | 'Portfolio'
  | 'TagCloud'
  | 'Projects'
  | 'Blog'
  | 'Legal';

export type CvEntryType =
  | 'Work'
  | 'Education'
  | 'Volunteer'
  | 'Certification'
  | 'Project';

export type SkillCategory =
  | 'Programming'
  | 'Framework'
  | 'Database'
  | 'Devops'
  | 'Language'
  | 'SoftSkill'
  | 'Tool'
  | 'Other';

export type LegalDocType =
  | 'CookieConsent'
  | 'PrivacyPolicy'
  | 'TermsOfService'
  | 'Imprint'
  | 'Disclaimer';

// ── Shared responses ─────────────────────────────────────────

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
  translation_status: TranslationStatus;
  created_at: string;
  updated_at: string;
}

// ── Blog types ───────────────────────────────────────────────

export interface BlogListItem {
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
  status: ContentStatus;
  publish_start: string | null;
  publish_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogResponse {
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
  status: ContentStatus;
  published_at: string | null;
  publish_start: string | null;
  publish_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogDocumentResponse {
  id: string;
  blog_id: string;
  document_id: string;
  display_order: number;
  url: string | null;
  document_type: string;
  file_name: string | null;
  has_file: boolean;
  localizations: DocumentLocalizationResponse[];
  created_at: string;
}

export interface DocumentLocalizationResponse {
  id: string;
  document_id: string;
  locale_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogDetailResponse extends BlogResponse {
  localizations: LocalizationResponse[];
  categories: CategoryResponse[];
  documents: BlogDocumentResponse[];
  og_image_url: string | null;
}

/**
 * Options for blog detail lookups (`get`, `getBySlug`). The list shape
 * does not yet carry `localizations[]` so the resolver only applies to
 * the detail endpoint — list canonicalization is tracked separately.
 */
export interface BlogDetailParams {
  /**
   * Optional locale code (e.g. `"en"`). When set, `localizations[]`
   * collapses to one resolved entry. See ADR 0002.
   */
  locale?: string;
}

// ── Page types ───────────────────────────────────────────────

export interface PageListItem {
  id: string;
  route: string;
  page_type: PageType;
  slug: string | null;
  is_in_navigation: boolean;
  status: ContentStatus;
  publish_start: string | null;
  publish_end: string | null;
  created_at: string;
}

export interface PageResponse {
  id: string;
  content_id: string;
  route: string;
  page_type: PageType;
  template: string | null;
  is_in_navigation: boolean;
  navigation_order: number | null;
  parent_page_id: string | null;
  slug: string | null;
  status: ContentStatus;
  published_at: string | null;
  publish_start: string | null;
  publish_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface PageDetailResponse extends PageResponse {
  localizations: LocalizationResponse[];
  og_image_url: string | null;
}

export interface PageSectionResponse {
  id: string;
  page_id: string;
  section_type: SectionType;
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

// ── Navigation types ─────────────────────────────────────────

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
  localizations: MenuLocalizationResponse[];
}

export interface MenuLocalizationResponse {
  id: string;
  locale_id: string;
  name: string;
}

export interface NavigationItemResponse {
  id: string;
  menu_id: string;
  parent_id: string | null;
  page_id: string | null;
  external_url: string | null;
  icon: string | null;
  display_order: number;
  open_in_new_tab: boolean;
  title: string | null;
}

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

export interface NavigationItemLocalizationResponse {
  id: string;
  navigation_item_id: string;
  locale_id: string;
  title: string;
}

// ── Taxonomy types ───────────────────────────────────────────

export interface TagResponse {
  id: string;
  slug: string;
  is_global: boolean;
  created_at: string;
}

export interface CategoryResponse {
  id: string;
  parent_id: string | null;
  slug: string;
  is_global: boolean;
  created_at: string;
}

export interface CategoryTree {
  id: string;
  slug: string;
  is_global: boolean;
  children: CategoryTree[];
}

export interface CategoryWithCountResponse {
  id: string;
  parent_id: string | null;
  slug: string;
  is_global: boolean;
  created_at: string;
  blog_count: number;
}

// ── Analytics types ──────────────────────────────────────────

export interface TopContentItem {
  path: string;
  total_views: number;
  unique_visitors: number;
}

export interface TrendDataPoint {
  date: string;
  total_views: number;
  unique_visitors: number;
}

export interface AnalyticsReportResponse {
  total_views: number;
  total_unique_visitors: number;
  top_content: TopContentItem[];
  trend: TrendDataPoint[];
}

export interface ReferrerItem {
  domain: string;
  views: number;
}

export interface AnalyticsPageDetailResponse {
  path: string;
  total_views: number;
  total_unique_visitors: number;
  trend: TrendDataPoint[];
  referrers: ReferrerItem[];
}

export interface TrackPageviewRequest {
  path: string;
  referrer?: string;
}

export interface TrackPageviewResponse {
  ok: boolean;
}

export interface AnalyticsReportParams {
  days?: number;
  topN?: number;
  startDate?: string;
  endDate?: string;
}

export interface AnalyticsPageParams {
  path: string;
  days?: number;
  startDate?: string;
  endDate?: string;
}

// ── CV types ─────────────────────────────────────────────────

export interface SkillLocalizationResponse {
  id: string;
  locale_id: string;
  name: string;
  description: string | null;
}

export interface SkillResponse {
  id: string;
  name: string;
  slug: string;
  category: SkillCategory | null;
  icon: string | null;
  proficiency_level: number | null;
  /**
   * Per-locale display names. Empty array when no localizations exist
   * (never null / missing). Clients pick the matching locale and fall
   * back per their own rules.
   */
  localizations: SkillLocalizationResponse[];
}

export interface CvEntryLocalizationResponse {
  id: string;
  locale_id: string;
  position: string;
  description: string | null;
  achievements: unknown | null;
}

export interface CvEntryResponse {
  id: string;
  company: string;
  company_url: string | null;
  company_logo_id: string | null;
  location: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  entry_type: CvEntryType;
  display_order: number;
  created_at: string;
  updated_at: string;
  /**
   * Per-locale position + description. Empty array when no localizations
   * exist (never null / missing).
   */
  localizations: CvEntryLocalizationResponse[];
  /**
   * Skill IDs linked to this CV entry. Empty array when no skills are
   * linked (never null / missing).
   */
  skill_ids: string[];
}

/** Pagination, search, and locale-resolver params for skill listings. */
export interface SkillListParams extends SearchablePaginationParams {
  /**
   * Optional locale code (e.g. `"en"`). When set, each skill's
   * `localizations` array collapses to one entry resolved by the server's
   * fallback chain. See ADR 0002.
   */
  locale?: string;
}

/** Options for skill detail lookups (`getSkill`, `getSkillBySlug`). */
export interface SkillDetailParams {
  /**
   * Optional locale code. When set, `localizations` collapses to one
   * resolved entry. See ADR 0002.
   */
  locale?: string;
}

export interface CvEntryParams extends SearchablePaginationParams {
  entryType?: CvEntryType;
  /**
   * Optional locale code (e.g. `"en"`, `"de-AT"`). When set, each entry's
   * `localizations` array collapses to one entry resolved by the server's
   * fallback chain. Omit to receive every localization.
   *
   * See ADR 0002 (`docs/adr/0002-locale-resolver.md`).
   */
  locale?: string;
}

/** Options for CV-entry detail lookups (`getEntry`). */
export interface CvEntryDetailParams {
  /**
   * Optional locale code. When set, `localizations` collapses to one
   * resolved entry. See ADR 0002.
   */
  locale?: string;
}

// ── Legal types ──────────────────────────────────────────────

export interface LegalDocumentResponse {
  id: string;
  cookie_name: string;
  document_type: LegalDocType;
  status: ContentStatus;
  slug: string | null;
  version: number;
  publish_start: string | null;
  publish_end: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Filters accepted by the legal-document list endpoint, on top of the
 * shared pagination/search/sort params. Keys are converted to snake_case
 * query parameters (`excludeStatus` → `exclude_status`).
 */
export interface LegalListParams extends SearchablePaginationParams {
  /** Only documents with this content status. */
  status?: ContentStatus;
  /** Exclude documents with this status (e.g. `'Archived'`). */
  excludeStatus?: ContentStatus;
  /**
   * Exclude documents of this type (e.g. `'CookieConsent'`, which has its
   * own dedicated endpoint and UI surface).
   */
  excludeDocumentType?: LegalDocType;
}

export interface LegalDocLocalizationResponse {
  id: string;
  locale_id: string;
  title: string;
  intro: string | null;
}

export interface LegalDocumentDetailResponse {
  id: string;
  cookie_name: string;
  document_type: LegalDocType;
  localizations: LegalDocLocalizationResponse[];
  created_at: string;
  updated_at: string;
}

/**
 * Options for legal-document detail lookups (`getBySlug`, `getDetail`).
 * The list shape (`LegalDocumentResponse`) does not yet carry
 * `localizations[]` — tracked separately.
 */
export interface LegalDetailParams {
  /**
   * Optional locale code (e.g. `"en"`). When set, `localizations[]`
   * (and `doc_localizations[]` on the full-detail endpoint) collapses
   * to one resolved entry. See ADR 0002.
   */
  locale?: string;
}

export interface LegalGroupResponse {
  id: string;
  cookie_name: string;
  display_order: number;
  is_required: boolean;
  default_enabled: boolean;
}

export interface LegalItemResponse {
  id: string;
  cookie_name: string;
  display_order: number;
  is_required: boolean;
}

export interface LegalGroupWithItems {
  id: string;
  cookie_name: string;
  display_order: number;
  is_required: boolean;
  default_enabled: boolean;
  items: LegalItemResponse[];
}

export interface LegalDocumentWithGroups {
  id: string;
  cookie_name: string;
  document_type: LegalDocType;
  groups: LegalGroupWithItems[];
}

// ── Code injection types ────────────────────────────────────

/** Custom HTML/JS snippets configured for injection into page templates. */
export interface CodeInjection {
  /** HTML/JS to inject into <head> */
  code_injection_head: string;
  /** HTML/JS to inject before </body> */
  code_injection_footer: string;
}

// ── Site context types ───────────────────────────────────────

/** Integration payload of the site context response. */
export interface SiteContextIntegration {
  /** HTML/JS to inject into <head>; empty string when unconfigured. */
  code_injection_head: string;
  /** HTML/JS to inject before </body>; empty string when unconfigured. */
  code_injection_footer: string;
}

/** Subset of `GET /sites/{siteId}/context` consumed by the SDK. */
export interface SiteContextResponse {
  integration: SiteContextIntegration;
}

// ── Site types ───────────────────────────────────────────────

export interface SiteResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  base_url: string | null;
  theme: Record<string, unknown> | null;
  default_locale_id: string | null;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Media types ──────────────────────────────────────────────

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

// ── Social types ─────────────────────────────────────────────

export interface SocialLinkResponse {
  id: string;
  title: string;
  url: string;
  icon: string;
  alt_text: string | null;
  display_order: number;
}

// ── UI string types ──────────────────────────────────────────

/**
 * Resolved UI strings for one locale: a flat `key → value` dictionary.
 *
 * Keys are dot-namespaced lowercase identifiers (e.g. `blog.min_read`,
 * `nav.aria.toggle_dark`). One value per key, resolved by the server's
 * fallback chain (requested locale → site default → first available);
 * keys without any localization are omitted.
 */
export type UiStringsResponse = Record<string, string>;

// ── Project types ────────────────────────────────────────────

/** Link type for project resources (repository, demo, docs, etc.). */
export type ProjectLinkType = 'repository' | 'demo' | 'documentation' | 'website' | 'other';

/** Localized content for a project. */
export interface ProjectLocalizationResponse {
  id: string;
  locale_id: string;
  title: string;
  short_description: string | null;
  description: string | null;
}

/** Project summary for list views. Always carries `localizations` — empty
 *  array when the project has none, never `null` or missing. */
export interface ProjectResponse {
  id: string;
  slug: string;
  display_order: number;
  is_featured: boolean;
  start_date: string | null;
  end_date: string | null;
  is_ongoing: boolean;
  status: ContentStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  /** Skill IDs linked to the project. Always present — empty array when none. */
  skill_ids: string[];
  localizations: ProjectLocalizationResponse[];
}

/** External link attached to a project. */
export interface ProjectLinkResponse {
  id: string;
  label: string;
  url: string;
  link_type: ProjectLinkType;
  icon: string | null;
  display_order: number;
}

/** Media attachment on a project (cover image, screenshots). */
export interface ProjectMediaResponse {
  media_id: string;
  display_order: number;
  is_cover: boolean;
}

/** Full project detail. Inherits `skill_ids` and `localizations` from
 *  {@link ProjectResponse}; adds links, media, and relation id sets. */
export interface ProjectDetailResponse extends ProjectResponse {
  links: ProjectLinkResponse[];
  media: ProjectMediaResponse[];
  cv_entry_ids: string[];
}

/** Pagination and filter params for project listings. */
export interface ProjectListParams extends PaginationParams {
  /** Sort field (e.g. `"display_order"`, `"start_date"`). */
  sortBy?: string;
  /** Sort direction. */
  sortDir?: 'asc' | 'desc';
  /** Filter to featured projects only. */
  isFeatured?: boolean;
  /**
   * Optional locale code (e.g. `"en"`, `"de-AT"`). When set, each project's
   * `localizations` array collapses to one entry resolved by the server's
   * fallback chain (requested → site default → first available). Omit to
   * receive every localization, which is the existing default.
   *
   * See ADR 0002 (`docs/adr/0002-locale-resolver.md`).
   */
  locale?: string;
}

/** Options for project detail lookups (`get`, `getBySlug`). */
export interface ProjectDetailParams {
  /**
   * Optional locale code. When set, `localizations` collapses to one entry
   * resolved by the server's fallback chain. See ADR 0002.
   */
  locale?: string;
}

// ── Redirect types ───────────────────────────────────────────

/**
 * The set of HTTP status codes a Forja redirect may use.
 *
 * Pinned by issue #743. The same domain is enforced server-side by the
 * `validate_redirect_status_code` DTO validator and the
 * `chk_redirect_status_code` DB CHECK constraint, so consumers may rely
 * on this value without runtime coercion.
 */
export type RedirectStatusCode = 301 | 302 | 307 | 308;

/** A URL redirect rule. */
export interface RedirectResponse {
  id: string;
  site_id: string;
  source_path: string;
  destination_path: string;
  status_code: RedirectStatusCode;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Result of a redirect path lookup.
 *
 * Returned with HTTP 200 by `GET /sites/{site_id}/redirects/lookup` on
 * match. No-match is signalled by **404** (RFC 7807 ProblemDetails) —
 * never a 200 with a null body, never a `{ redirects: [] }` list.
 */
export interface RedirectLookupResponse {
  destination_path: string;
  status_code: RedirectStatusCode;
}

// ── Locale types ─────────────────────────────────────────────

/** A locale configured for a site. */
export interface SiteLocaleResponse {
  /** Composite-key half #1 — which site this assignment belongs to. */
  site_id: string;
  /** Composite-key half #2 — which locale is attached. */
  locale_id: string;
  /** BCP-47 code, denormalised from `locales.code`. */
  code: string;
  /** English-language label, denormalised from `locales.name`. */
  name: string;
  /** Locale's own name, denormalised from `locales.native_name`. */
  native_name: string | null;
  direction: 'ltr' | 'rtl';
  /** Exactly one row per site has this set to `true`. */
  is_default: boolean;
  /** Configured-but-not-served when `false`. Consumers usually filter to `true`. */
  is_active: boolean;
  /**
   * Path segment selecting this locale. `null` for the default locale
   * (served at the site root without a prefix).
   */
  url_prefix: string | null;
  created_at: string;
}

// ── Media list types ─────────────────────────────────────────

/** Media item summary for list views (lighter than full MediaResponse). */
export interface MediaListItem {
  id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  public_url: string | null;
  width: number | null;
  height: number | null;
  is_global: boolean;
  folder_id: string | null;
  created_at: string;
}

/** Filter params for media listings. */
export interface MediaListParams extends SearchablePaginationParams {
  /** Filter by MIME category (e.g. `"image"`, `"video"`, `"document"`). */
  mimeCategory?: string;
  /** Filter to a specific folder. */
  folderId?: string;
}

// ── Legal extended types ─────────────────────────────────────

/** Full legal document detail including content localizations. */
export interface LegalDocumentFullDetailResponse {
  id: string;
  content_id: string;
  cookie_name: string;
  document_type: LegalDocType;
  status: ContentStatus;
  slug: string | null;
  version: number;
  parent_version_id: string | null;
  publish_start: string | null;
  publish_end: string | null;
  localizations: LocalizationResponse[];
  doc_localizations: LegalDocLocalizationResponse[];
  created_at: string;
  updated_at: string;
}

/** A version entry in a legal document's version history. */
export interface LegalVersionResponse {
  id: string;
  version: number;
  status: ContentStatus;
  created_at: string;
}
