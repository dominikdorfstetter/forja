// API Types for backend communication
// Enum casing matches backend Rust serialization (PascalCase)

export type ApiKeyPermission = 'Master' | 'Admin' | 'Write' | 'Read';
export type ApiKeyStatus = 'Active' | 'Blocked' | 'Expired' | 'Revoked';

// Auth info from GET /auth/me
export interface AuthInfo {
  permission: ApiKeyPermission;
  site_id?: string;
  auth_method: string;
  clerk_user_id?: string;
  memberships?: MembershipSummary[];
  is_system_admin?: boolean;
}

// Site-scoped roles
export type SiteRole = 'owner' | 'admin' | 'editor' | 'author' | 'reviewer' | 'viewer';

// Membership summary (from /auth/me)
export interface MembershipSummary {
  site_id: string;
  site_name: string;
  site_slug: string;
  role: SiteRole;
}
export type ContentStatus = 'Draft' | 'InReview' | 'Scheduled' | 'Published' | 'Archived';
export type EnvironmentType = 'Development' | 'Staging' | 'Production';
export type TextDirection = 'Ltr' | 'Rtl';
export type UserRole = 'Owner' | 'Admin' | 'Editor' | 'Author' | 'Viewer';

// RFC 7807 Problem Details (matches backend ProblemDetails struct)
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code: string;
  errors?: FieldError[];
}

export interface FieldError {
  field: string;
  message: string;
  code?: string;
}

// Webhooks
export interface Webhook {
  id: string;
  site_id: string;
  url: string;
  description?: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status_code?: number;
  response_body?: string;
  error_message?: string;
  attempt_number: number;
  delivered_at: string;
}

export interface CreateWebhookRequest {
  url: string;
  description?: string;
  events?: string[];
}

export interface UpdateWebhookRequest {
  url?: string;
  description?: string;
  events?: string[];
  is_active?: boolean;
}

// Redirects
export interface Redirect {
  id: string;
  site_id: string;
  source_path: string;
  destination_path: string;
  status_code: number;
  is_active: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateRedirectRequest {
  source_path: string;
  destination_path: string;
  status_code: number;
  is_active?: boolean;
  description?: string;
}

export interface UpdateRedirectRequest {
  source_path?: string;
  destination_path?: string;
  status_code?: number;
  is_active?: boolean;
  description?: string;
}

export interface RedirectLookupResponse {
  destination_path: string;
  status_code: number;
}

// Content Templates
export interface ContentTemplate {
  id: string;
  site_id: string;
  name: string;
  description?: string;
  icon: string;
  slug_prefix: string;
  is_featured: boolean;
  allow_comments: boolean;
  title: string;
  subtitle: string;
  excerpt: string;
  body: string;
  meta_title: string;
  meta_description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateContentTemplateRequest {
  name: string;
  description?: string;
  icon?: string;
  slug_prefix?: string;
  is_featured?: boolean;
  allow_comments?: boolean;
  title?: string;
  subtitle?: string;
  excerpt?: string;
  body?: string;
  meta_title?: string;
  meta_description?: string;
  is_active?: boolean;
}

export interface UpdateContentTemplateRequest {
  name?: string;
  description?: string;
  icon?: string;
  slug_prefix?: string;
  is_featured?: boolean;
  allow_comments?: boolean;
  title?: string;
  subtitle?: string;
  excerpt?: string;
  body?: string;
  meta_title?: string;
  meta_description?: string;
  is_active?: boolean;
}

// Health check response (matches backend HealthResponse struct)
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealth[];
  storage?: StorageHealth;
}

export interface ServiceHealth {
  name: string;
  status: 'up' | 'down' | 'disabled';
  latency_ms?: number;
  error?: string;
}

export interface StorageHealth {
  name: string;
  status: 'up' | 'down';
  latency_ms?: number;
  error?: string;
  provider: 'local' | 's3';
  total_bytes?: number;
  available_bytes?: number;
  used_percent?: number;
  bucket?: string;
}

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

// Site
export interface Site {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  favicon_url?: string;
  theme?: Record<string, unknown>;
  default_locale_id?: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSiteRequest {
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  favicon_url?: string;
  timezone?: string;
  locales?: SiteLocaleInput[];
}

// Site Locale
export interface SiteLocaleResponse {
  site_id: string;
  locale_id: string;
  is_default: boolean;
  is_active: boolean;
  url_prefix?: string;
  created_at: string;
  code: string;
  name: string;
  native_name?: string;
  direction: TextDirection;
}

export interface AddSiteLocaleRequest {
  locale_id: string;
  is_default: boolean;
  url_prefix?: string;
}

export interface UpdateSiteLocaleRequest {
  is_default?: boolean;
  is_active?: boolean;
  url_prefix?: string;
}

export interface SiteLocaleInput {
  locale_id: string;
  is_default: boolean;
  url_prefix?: string;
}

export interface UpdateSiteRequest {
  name?: string;
  slug?: string;
  description?: string;
  logo_url?: string;
  favicon_url?: string;
  timezone?: string;
  is_active?: boolean;
}

// API Key
export interface ApiKeyListItem {
  id: string;
  key_prefix: string;
  name: string;
  permission: ApiKeyPermission;
  site_id: string;
  user_id?: string;
  status: ApiKeyStatus;
  total_requests: number;
  last_used_at?: string;
  expires_at?: string;
  created_at: string;
}

export interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  description?: string;
  permission: ApiKeyPermission;
  site_id: string;
  user_id?: string;
  status: ApiKeyStatus;
  rate_limit_per_second?: number;
  rate_limit_per_minute?: number;
  rate_limit_per_hour?: number;
  rate_limit_per_day?: number;
  total_requests: number;
  last_used_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  blocked_at?: string;
  blocked_reason?: string;
}

export interface CreateApiKeyRequest {
  name: string;
  description?: string;
  permission: ApiKeyPermission;
  site_id: string;
  user_id?: string;
  rate_limit_per_second?: number;
  rate_limit_per_minute?: number;
  rate_limit_per_hour?: number;
  rate_limit_per_day?: number;
  expires_at?: string;
}

export interface CreateApiKeyResponse {
  id: string;
  key: string; // The full key, only shown once
  key_prefix: string;
  name: string;
  description?: string;
  permission: ApiKeyPermission;
  site_id: string;
  user_id?: string;
  status: ApiKeyStatus;
  rate_limit_per_second?: number;
  rate_limit_per_minute?: number;
  rate_limit_per_hour?: number;
  rate_limit_per_day?: number;
  expires_at?: string;
  created_at: string;
}

export interface ApiKeyUsageRecord {
  id: string;
  endpoint: string;
  method: string;
  status_code: number;
  response_time_ms: number;
  ip_address?: string;
  request_size?: number;
  response_size?: number;
  error_message?: string;
  created_at: string;
}

// Environment
export interface Environment {
  id: string;
  name: EnvironmentType;
  display_name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// Locale
export interface Locale {
  id: string;
  code: string;
  name: string;
  native_name?: string;
  direction: TextDirection;
  is_active: boolean;
  created_at: string;
}

export interface CreateLocaleRequest {
  code: string;
  name: string;
  native_name?: string;
  direction?: TextDirection;
  is_active?: boolean;
}

export interface UpdateLocaleRequest {
  name?: string;
  native_name?: string;
  direction?: TextDirection;
  is_active?: boolean;
}

// Translation Status
export type TranslationStatus = 'Pending' | 'InProgress' | 'Review' | 'Approved' | 'Outdated';

// Content Localization
export interface ContentLocalizationResponse {
  id: string;
  content_id: string;
  locale_id: string;
  title: string;
  subtitle?: string;
  excerpt?: string;
  body?: string;
  meta_title?: string;
  meta_description?: string;
  translation_status: TranslationStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateLocalizationRequest {
  locale_id: string;
  title: string;
  subtitle?: string;
  excerpt?: string;
  body?: string;
  meta_title?: string;
  meta_description?: string;
}

export interface UpdateLocalizationRequest {
  title?: string;
  subtitle?: string;
  excerpt?: string;
  body?: string;
  meta_title?: string;
  meta_description?: string;
  translation_status?: TranslationStatus;
}

// Blog
export interface BlogListItem {
  id: string;
  slug?: string;
  author: string;
  published_date: string;
  reading_time_minutes?: number;
  cover_image_id?: string;
  header_image_id?: string;
  is_featured: boolean;
  status: ContentStatus;
  publish_start?: string;
  publish_end?: string;
  created_at: string;
  updated_at: string;
}

// Media
export interface MediaListItem {
  id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  public_url?: string;
  width?: number;
  height?: number;
  is_global: boolean;
  folder_id?: string;
  created_at: string;
}

export interface MediaVariantResponse {
  id: string;
  variant_name: string;
  width: number;
  height: number;
  file_size: number;
  public_url?: string;
}

export interface MediaResponse {
  id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  storage_provider: string;
  public_url?: string;
  width?: number;
  height?: number;
  duration?: number;
  is_global: boolean;
  created_at: string;
  updated_at: string;
  variants: MediaVariantResponse[];
}

// Media Folders
export interface MediaFolder {
  id: string;
  site_id: string;
  parent_id?: string;
  name: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateMediaFolderRequest {
  name: string;
  parent_id?: string;
  display_order: number;
}

export interface UpdateMediaFolderRequest {
  name?: string;
  parent_id?: string;
  display_order?: number;
}

// Media Metadata
export interface MediaMetadataResponse {
  id: string;
  locale_id: string;
  alt_text?: string;
  caption?: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

export interface AddMediaMetadataRequest {
  locale_id: string;
  alt_text?: string;
  caption?: string;
  title?: string;
}

export interface UpdateMediaMetadataRequest {
  alt_text?: string;
  caption?: string;
  title?: string;
}

// Taxonomy
export interface Tag {
  id: string;
  slug: string;
  is_global: boolean;
  created_at: string;
}

export interface CreateTagRequest {
  slug: string;
  is_global: boolean;
  site_id?: string;
}

export interface UpdateTagRequest {
  slug?: string;
  is_global?: boolean;
}

export interface Category {
  id: string;
  parent_id?: string;
  slug: string;
  is_global: boolean;
  created_at: string;
}

export interface CreateCategoryRequest {
  parent_id?: string;
  slug: string;
  is_global: boolean;
  site_id?: string;
}

export interface UpdateCategoryRequest {
  parent_id?: string;
  slug?: string;
  is_global?: boolean;
}

export interface AssignCategoryRequest {
  category_id: string;
  is_primary?: boolean;
}

export interface CategoryWithCount extends Category {
  blog_count: number;
}

// Social Links
export interface SocialLink {
  id: string;
  title: string;
  url: string;
  icon: string;
  alt_text?: string;
  display_order: number;
}

export interface CreateSocialLinkRequest {
  title: string;
  url: string;
  icon: string;
  alt_text?: string;
  display_order: number;
  site_id: string;
}

export interface UpdateSocialLinkRequest {
  title?: string;
  url?: string;
  icon?: string;
  alt_text?: string;
  display_order?: number;
}

export interface ReorderItem {
  id: string;
  display_order: number;
}

export interface ReorderSocialLinksRequest {
  items: ReorderItem[];
}

// Navigation Menus
export interface NavigationMenu {
  id: string;
  site_id: string;
  slug: string;
  description?: string;
  max_depth: number;
  is_active: boolean;
  item_count: number;
  created_at: string;
  updated_at: string;
  localizations?: MenuLocalization[];
}

export interface MenuLocalization {
  id: string;
  locale_id: string;
  name: string;
}

export interface CreateNavigationMenuRequest {
  slug: string;
  description?: string;
  max_depth?: number;
  localizations?: MenuLocalizationInput[];
}

export interface UpdateNavigationMenuRequest {
  slug?: string;
  description?: string;
  max_depth?: number;
  is_active?: boolean;
  localizations?: MenuLocalizationInput[];
}

export interface MenuLocalizationInput {
  locale_id: string;
  name: string;
}

// Navigation Items
export interface NavigationItem {
  id: string;
  menu_id: string;
  parent_id?: string;
  page_id?: string;
  external_url?: string;
  icon?: string;
  display_order: number;
  open_in_new_tab: boolean;
  title?: string;
}

export interface CreateNavigationItemRequest {
  parent_id?: string;
  page_id?: string;
  external_url?: string;
  icon?: string;
  display_order: number;
  open_in_new_tab: boolean;
  site_id: string;
  menu_id: string;
  localizations?: NavigationItemLocalizationInput[];
}

export interface UpdateNavigationItemRequest {
  parent_id?: string;
  page_id?: string;
  external_url?: string;
  icon?: string;
  display_order?: number;
  open_in_new_tab?: boolean;
}

export interface NavigationItemLocalizationInput {
  locale_id: string;
  title: string;
}

export interface NavigationItemLocalizationResponse {
  id: string;
  navigation_item_id: string;
  locale_id: string;
  title: string;
}

export interface NavigationTreeNode {
  id: string;
  parent_id?: string;
  page_id?: string;
  external_url?: string;
  icon?: string;
  display_order: number;
  open_in_new_tab: boolean;
  title?: string;
  page_slug?: string;
  children: NavigationTreeNode[];
}

export interface ReorderTreeItem {
  id: string;
  parent_id?: string;
  display_order: number;
}

// Blog (full response)
export interface BlogResponse {
  id: string;
  content_id: string;
  slug?: string;
  author: string;
  published_date: string;
  reading_time_minutes?: number;
  cover_image_id?: string;
  header_image_id?: string;
  is_featured: boolean;
  allow_comments: boolean;
  status: ContentStatus;
  published_at?: string;
  publish_start?: string;
  publish_end?: string;
  created_at: string;
  updated_at: string;
}

export interface BlogDetailResponse extends BlogResponse {
  localizations: ContentLocalizationResponse[];
  categories: Category[];
  documents: BlogDocumentResponse[];
}

// Document Library
export interface DocumentFolder {
  id: string;
  site_id: string;
  parent_id?: string;
  name: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateDocumentFolderRequest {
  name: string;
  parent_id?: string;
  display_order: number;
}

export interface UpdateDocumentFolderRequest {
  name?: string;
  parent_id?: string;
  display_order?: number;
}

export interface DocumentLocalizationResponse {
  id: string;
  document_id: string;
  locale_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateDocumentLocalizationRequest {
  locale_id: string;
  name: string;
  description?: string;
}

export interface UpdateDocumentLocalizationRequest {
  name?: string;
  description?: string;
}

export interface DocumentListItem {
  id: string;
  site_id: string;
  folder_id?: string;
  url?: string;
  document_type: string;
  display_order: number;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  has_file: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentResponse extends DocumentListItem {
  localizations: DocumentLocalizationResponse[];
}

export interface CreateDocumentRequest {
  url?: string;
  file_data?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  document_type: string;
  folder_id?: string;
  display_order: number;
}

export interface UpdateDocumentRequest {
  url?: string;
  file_data?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  document_type?: string;
  folder_id?: string;
  display_order?: number;
}

export interface BlogDocumentResponse {
  id: string;
  blog_id: string;
  document_id: string;
  display_order: number;
  url?: string;
  document_type: string;
  file_name?: string;
  has_file: boolean;
  localizations: DocumentLocalizationResponse[];
  created_at: string;
}

export interface AssignBlogDocumentRequest {
  document_id: string;
  display_order?: number;
}

export interface CreateBlogRequest {
  slug: string;
  author: string;
  published_date: string;
  reading_time_minutes?: number;
  cover_image_id?: string;
  header_image_id?: string;
  is_featured: boolean;
  allow_comments: boolean;
  status: ContentStatus;
  publish_start?: string;
  publish_end?: string;
  site_ids: string[];
}

export interface UpdateBlogRequest {
  slug?: string;
  author?: string;
  published_date?: string;
  reading_time_minutes?: number;
  cover_image_id?: string;
  header_image_id?: string;
  is_featured?: boolean;
  allow_comments?: boolean;
  status?: ContentStatus;
  publish_start?: string | null;
  publish_end?: string | null;
}

// Media (upload/update)
export interface UploadMediaRequest {
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  storage_provider: string;
  storage_path: string;
  public_url?: string;
  width?: number;
  height?: number;
  duration?: number;
  is_global: boolean;
  folder_id?: string;
  site_ids: string[];
}

export interface UpdateMediaRequest {
  filename?: string;
  public_url?: string;
  is_global?: boolean;
  folder_id?: string;
}

// Pages
export type PageType = 'Static' | 'Landing' | 'Contact' | 'BlogIndex' | 'Custom';
export type SectionType = 'Hero' | 'Features' | 'Cta' | 'Gallery' | 'Testimonials' | 'Pricing' | 'Faq' | 'Contact' | 'Custom';

export interface PageListItem {
  id: string;
  route: string;
  page_type: PageType;
  slug?: string;
  is_in_navigation: boolean;
  status: ContentStatus;
  publish_start?: string;
  publish_end?: string;
  created_at: string;
}

export interface PageResponse {
  id: string;
  content_id: string;
  route: string;
  page_type: PageType;
  template?: string;
  is_in_navigation: boolean;
  navigation_order?: number;
  parent_page_id?: string;
  slug?: string;
  status: ContentStatus;
  published_at?: string;
  publish_start?: string;
  publish_end?: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePageRequest {
  route: string;
  slug: string;
  page_type: PageType;
  template?: string;
  is_in_navigation: boolean;
  navigation_order?: number;
  parent_page_id?: string;
  status: ContentStatus;
  publish_start?: string;
  publish_end?: string;
  site_ids: string[];
}

export interface UpdatePageRequest {
  route?: string;
  slug?: string;
  page_type?: PageType;
  template?: string;
  is_in_navigation?: boolean;
  navigation_order?: number;
  parent_page_id?: string;
  status?: ContentStatus;
  publish_start?: string | null;
  publish_end?: string | null;
}

export interface PageSectionResponse {
  id: string;
  page_id: string;
  section_type: SectionType;
  display_order: number;
  cover_image_id?: string;
  call_to_action_route?: string;
  settings?: Record<string, unknown>;
}

export interface SectionLocalizationResponse {
  id: string;
  page_section_id: string;
  locale_id: string;
  title?: string;
  text?: string;
  button_text?: string;
}

export interface UpsertSectionLocalizationRequest {
  locale_id: string;
  title?: string;
  text?: string;
  button_text?: string;
}

export interface CreatePageSectionRequest {
  section_type: SectionType;
  display_order: number;
  cover_image_id?: string;
  call_to_action_route?: string;
  settings?: Record<string, unknown>;
}

export interface UpdatePageSectionRequest {
  section_type?: SectionType;
  display_order?: number;
  cover_image_id?: string;
  call_to_action_route?: string;
  settings?: Record<string, unknown>;
}

// Legal
export type LegalDocType = 'CookieConsent' | 'PrivacyPolicy' | 'TermsOfService' | 'Imprint' | 'Disclaimer';

export interface LegalDocumentResponse {
  id: string;
  cookie_name: string;
  document_type: LegalDocType;
  created_at: string;
  updated_at: string;
}

export interface CreateLegalDocumentRequest {
  cookie_name: string;
  document_type: LegalDocType;
  status: ContentStatus;
  site_ids: string[];
}

export interface UpdateLegalDocumentRequest {
  cookie_name?: string;
  document_type?: LegalDocType;
  status?: ContentStatus;
}

export interface LegalGroupResponse {
  id: string;
  cookie_name: string;
  display_order: number;
  is_required: boolean;
  default_enabled: boolean;
}

export interface CreateLegalGroupRequest {
  cookie_name: string;
  display_order: number;
  is_required: boolean;
  default_enabled: boolean;
}

export interface UpdateLegalGroupRequest {
  cookie_name?: string;
  display_order?: number;
  is_required?: boolean;
  default_enabled?: boolean;
}

export interface LegalItemResponse {
  id: string;
  cookie_name: string;
  display_order: number;
  is_required: boolean;
}

export interface CreateLegalItemRequest {
  cookie_name: string;
  display_order: number;
  is_required: boolean;
}

export interface UpdateLegalItemRequest {
  cookie_name?: string;
  display_order?: number;
  is_required?: boolean;
}

// CV
export type SkillCategory = 'Programming' | 'Framework' | 'Database' | 'Devops' | 'Language' | 'SoftSkill' | 'Tool' | 'Other';
export type CvEntryType = 'Work' | 'Education' | 'Volunteer' | 'Certification' | 'Project';

export interface SkillResponse {
  id: string;
  name: string;
  slug: string;
  category?: SkillCategory;
  icon?: string;
  proficiency_level?: number;
}

export interface CreateSkillRequest {
  name: string;
  slug: string;
  category?: SkillCategory;
  icon?: string;
  proficiency_level?: number;
  is_global: boolean;
  site_ids: string[];
}

export interface UpdateSkillRequest {
  name?: string;
  slug?: string;
  category?: SkillCategory;
  icon?: string;
  proficiency_level?: number;
  is_global?: boolean;
}

export interface CvEntryResponse {
  id: string;
  company: string;
  company_url?: string;
  company_logo_id?: string;
  location: string;
  start_date: string;
  end_date?: string;
  is_current: boolean;
  entry_type: CvEntryType;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCvEntryRequest {
  company: string;
  company_url?: string;
  company_logo_id?: string;
  location: string;
  start_date: string;
  end_date?: string;
  is_current: boolean;
  entry_type: CvEntryType;
  display_order: number;
  status: ContentStatus;
  site_ids: string[];
}

export interface UpdateCvEntryRequest {
  company?: string;
  company_url?: string;
  company_logo_id?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  entry_type?: CvEntryType;
  display_order?: number;
  status?: ContentStatus;
}

// Preview Templates
export interface PreviewTemplate {
  name: string;
  url: string;
}

// Site Settings
export interface SiteSettingsResponse {
  max_document_file_size: number;
  max_media_file_size: number;
  analytics_enabled: boolean;
  maintenance_mode: boolean;
  contact_email: string;
  posts_per_page: number;
  editorial_workflow_enabled: boolean;
  preview_templates: PreviewTemplate[];
}

export interface UpdateSiteSettingsRequest {
  max_document_file_size?: number;
  max_media_file_size?: number;
  analytics_enabled?: boolean;
  maintenance_mode?: boolean;
  contact_email?: string;
  posts_per_page?: number;
  editorial_workflow_enabled?: boolean;
  preview_templates?: PreviewTemplate[];
}

// Clerk User Management
export interface ClerkUser {
  id: string;
  email?: string;
  name: string;
  image_url?: string;
  role: string;
  created_at: number;
  updated_at: number;
  last_sign_in_at?: number;
}

export interface ClerkUserListResponse {
  data: ClerkUser[];
  total_count: number;
}

// Site Membership Management
export interface SiteMembership {
  id: string;
  clerk_user_id: string;
  site_id: string;
  role: SiteRole;
  name?: string;
  email?: string;
  image_url?: string;
  invited_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AddSiteMemberRequest {
  clerk_user_id: string;
  role: SiteRole;
}

export interface UpdateMemberRoleRequest {
  role: SiteRole;
}

export interface TransferOwnershipRequest {
  new_owner_clerk_user_id: string;
}

// Audit Log
export type AuditAction = 'Create' | 'Read' | 'Update' | 'Delete' | 'Publish' | 'Unpublish' | 'Archive' | 'Restore' | 'Login' | 'Logout' | 'SubmitReview' | 'Approve' | 'RequestChanges';

// Editorial Workflow
export type ReviewAction = 'approve' | 'request_changes';

export interface ReviewActionRequest {
  action: ReviewAction;
  comment?: string;
}

export interface ReviewActionResponse {
  status: ContentStatus;
  message: string;
}

export interface AuditLogEntry {
  id: string;
  user_id?: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  ip_address?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface ChangeHistoryEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  field_name?: string;
  old_value?: unknown;
  new_value?: unknown;
  changed_by?: string;
  changed_at: string;
}

export interface RevertChangesResponse {
  entity_type: string;
  entity_id: string;
  fields_reverted: string[];
}

// Profile & Data Export
export interface ProfileResponse {
  id: string;
  email?: string;
  name?: string;
  image_url?: string;
  role: string;
  permission: ApiKeyPermission;
  site_id?: string;
  auth_method: string;
  created_at?: string;
  last_sign_in_at?: string;
  memberships?: MembershipSummary[];
  is_system_admin?: boolean;
}

export interface ExportApiKeyRecord {
  id: string;
  name: string;
  permission: ApiKeyPermission;
  site_id?: string;
  status: string;
  created_at: string;
}

export interface UserDataExportResponse {
  profile: ProfileResponse;
  audit_logs: Array<{
    id: string;
    user_id?: string;
    action: string;
    entity_type: string;
    entity_id: string;
    ip_address?: string;
    metadata?: Record<string, unknown>;
    created_at: string;
  }>;
  api_keys: ExportApiKeyRecord[];
  change_history: Array<{
    id: string;
    entity_type: string;
    entity_id: string;
    field_name?: string;
    old_value?: unknown;
    new_value?: unknown;
    changed_by?: string;
    changed_at: string;
  }>;
  exported_at: string;
}

// Notifications
export type NotificationType = 'content_submitted' | 'content_approved' | 'changes_requested';

export interface NotificationResponse {
  id: string;
  site_id: string;
  actor_clerk_id?: string;
  notification_type: NotificationType;
  entity_type: string;
  entity_id: string;
  title: string;
  message?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export interface UnreadCountResponse {
  unread_count: number;
}

export interface MarkAllReadResponse {
  updated: number;
}

// Bulk Actions
export type BulkAction = 'UpdateStatus' | 'Delete';

export interface BulkContentRequest {
  ids: string[];
  action: BulkAction;
  status?: ContentStatus;
}

export interface BulkItemResult {
  id: string;
  success: boolean;
  error?: string;
}

export interface BulkContentResponse {
  total: number;
  succeeded: number;
  failed: number;
  results: BulkItemResult[];
}
