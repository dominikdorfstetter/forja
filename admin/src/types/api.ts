// API Types for backend communication
// Enum casing matches backend Rust serialization (PascalCase)

import type { components } from '@/generated/api-types';

export type ApiKeyPermission = components['schemas']['ApiKeyPermission'];
export type ApiKeyStatus = components['schemas']['ApiKeyStatus'];

// Guest token from GET /auth/guest (public endpoint)
export type GuestTokenResponse = components['schemas']['GuestTokenResponse'];

// Auth info from GET /auth/me
export type AuthInfo = components['schemas']['AuthInfoResponse'];

// Site-scoped roles
export type SiteRole = components['schemas']['SiteRole'];

// Membership summary (from /auth/me)
export type MembershipSummary = components['schemas']['MembershipSummary'];
export type ContentStatus = components['schemas']['ContentStatus'];
export type EnvironmentType = components['schemas']['EnvironmentType'];
export type TextDirection = components['schemas']['TextDirection'];
// UserRole removed — was never used

// RFC 7807 Problem Details (matches backend ProblemDetails struct)
export type ProblemDetails = components['schemas']['ProblemDetails'];

export type FieldError = components['schemas']['FieldError'];

// Webhooks
export type Webhook = components['schemas']['WebhookResponse'];

export type WebhookDelivery = components['schemas']['WebhookDeliveryResponse'];

export type CreateWebhookRequest = components['schemas']['CreateWebhookRequest'];

export type UpdateWebhookRequest = components['schemas']['UpdateWebhookRequest'];

export type WebhookEventStats = components['schemas']['WebhookEventStats'];

export type WebhookStatsResponse = components['schemas']['WebhookStatsResponse'];

// Redirects
export type Redirect = components['schemas']['RedirectResponse'];

export type CreateRedirectRequest = components['schemas']['CreateRedirectRequest'];

export type UpdateRedirectRequest = components['schemas']['UpdateRedirectRequest'];

// RedirectLookupResponse removed — was never used

// Content Templates
export type ContentTemplate = components['schemas']['ContentTemplateResponse'];

export type CreateContentTemplateRequest = components['schemas']['CreateContentTemplateRequest'];

export type UpdateContentTemplateRequest = components['schemas']['UpdateContentTemplateRequest'];

// Health check response (matches backend HealthResponse struct).
// `version` is optional: public `/health` strips it. `apiService.getHealth()`
// calls the admin-gated `/health/detailed` where it's always populated.
export type HealthResponse = components['schemas']['HealthResponse'];

export type PaginationMeta = components['schemas']['PaginationMeta'];

/** Standard query parameters shared by all paginated list endpoints. */
export interface ListQueryParams {
  page?: number;
  page_size?: number;
  search?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

// Site
export type Site = components['schemas']['SiteResponse'];

export type CreateSiteRequest = components['schemas']['CreateSiteRequest'];

// Site Locale
export type SiteLocaleResponse = components['schemas']['SiteLocaleResponse'];

export type AddSiteLocaleRequest = components['schemas']['AddSiteLocaleRequest'];

export type UpdateSiteLocaleRequest = components['schemas']['UpdateSiteLocaleRequest'];

export type SiteLocaleInput = components['schemas']['SiteLocaleInput'];

export type UpdateSiteRequest = components['schemas']['UpdateSiteRequest'];

// Site Context (progressive disclosure)
export type SiteContextFeatures = components['schemas']['SiteContextFeatures'];

export type SiteContextIntegration = components['schemas']['SiteContextIntegration'];

export type SiteContextResponse = components['schemas']['SiteContextResponse'];

// API Key
export type ApiKeyListItem = components['schemas']['ApiKeyListItem'];

export type ApiKey = components['schemas']['ApiKeyResponse'];

export type CreateApiKeyRequest = components['schemas']['CreateApiKeyRequest'];

export type UpdateApiKeyRequest = components['schemas']['UpdateApiKeyRequest'];

export type SiteCacheStats = components['schemas']['SiteCacheStats'];
export type GlobalCacheStats = components['schemas']['GlobalCacheStats'];
export type CacheMutationResponse = components['schemas']['CacheMutationResponse'];

export type CreateApiKeyResponse = components['schemas']['CreateApiKeyResponse'];

export type ApiKeyUsageRecord = components['schemas']['ApiKeyUsageResponse'];

export type QuotaWindow = components['schemas']['QuotaWindowResponse'];

export type DailyUsageSummary = components['schemas']['DailyUsageSummary'];

export type UsageSummaryResponse = components['schemas']['UsageSummaryResponse'];

// Environment
export type Environment = components['schemas']['EnvironmentResponse'];

// Locale
export type Locale = components['schemas']['LocaleResponse'];

export type CreateLocaleRequest = components['schemas']['CreateLocaleRequest'];

export type UpdateLocaleRequest = components['schemas']['UpdateLocaleRequest'];

// Translation Status
export type TranslationStatus = components['schemas']['TranslationStatus'];

// Content Localization
export type ContentLocalizationResponse = components['schemas']['LocalizationResponse'];

export type CreateLocalizationRequest = components['schemas']['CreateLocalizationRequest'];

export type UpdateLocalizationRequest = components['schemas']['UpdateLocalizationRequest'];

// Blog

/** Blog counts grouped by workflow status. Drives filter-pill badges. */
export type BlogStatusCounts = components['schemas']['BlogStatusCounts'];

// Sourced from the backend OpenAPI spec (issue #623 Slice 1 — tracer bullet).
// Keep this as a re-export, not a hand-typed mirror, so backend DTO changes
// surface as `tsc` errors instead of silent runtime drift. Regenerate via
// `npm run generate:openapi`.
export type BlogListItem = components['schemas']['BlogListItem'];

// Media

/** Media counts grouped by MIME category. Drives filter-pill badges. */
export type MediaCategoryCounts = components['schemas']['MediaCategoryCounts'];

export type MediaListItem = components['schemas']['MediaListItem'];

export type SiteTagItem = components['schemas']['SiteTagItem'];

export type SiteTagsResponse = components['schemas']['SiteTagsResponse'];

export type MediaTagsResponse = components['schemas']['MediaTagsResponse'];

export type MediaUsageReference = components['schemas']['MediaUsageResponse'];

export type MediaUsageResponse = components['schemas']['MediaUsageResponse'];

export type MediaResponse = components['schemas']['MediaResponse'];

// Media Folders
export type MediaFolder = components['schemas']['MediaFolderResponse'];

export type CreateMediaFolderRequest = components['schemas']['CreateMediaFolderRequest'];

export type UpdateMediaFolderRequest = components['schemas']['UpdateMediaFolderRequest'];

// Media Metadata
export type MediaMetadataResponse = components['schemas']['MediaMetadataResponse'];

export type AddMediaMetadataRequest = components['schemas']['AddMediaMetadataRequest'];

export type UpdateMediaMetadataRequest = components['schemas']['UpdateMediaMetadataRequest'];

// Taxonomy
export type Tag = components['schemas']['TagResponse'];

export type CreateTagRequest = components['schemas']['CreateTagRequest'];

export type UpdateTagRequest = components['schemas']['UpdateTagRequest'];

export type Category = components['schemas']['CategoryResponse'];

export type CreateCategoryRequest = components['schemas']['CreateCategoryRequest'];

export type UpdateCategoryRequest = components['schemas']['UpdateCategoryRequest'];

export type AssignCategoryRequest = components['schemas']['AssignCategoryRequest'];

export type AssignTagRequest = components['schemas']['AssignTagRequest'];

export type CategoryWithCount = components['schemas']['CategoryWithCountResponse'];

// Social Links
export type SocialLink = components['schemas']['SocialLinkResponse'];

export type CreateSocialLinkRequest = components['schemas']['CreateSocialLinkRequest'];

export type UpdateSocialLinkRequest = components['schemas']['UpdateSocialLinkRequest'];

export type ReorderItem = components['schemas']['ReorderItem'];

// ReorderSocialLinksRequest removed — was never used

// Navigation Menus
export type NavigationMenu = components['schemas']['NavigationMenuResponse'];

export type MenuLocalization = components['schemas']['MenuLocalizationResponse'];

export type CreateNavigationMenuRequest = components['schemas']['CreateNavigationMenuRequest'];

export type UpdateNavigationMenuRequest = components['schemas']['UpdateNavigationMenuRequest'];

export type MenuLocalizationInput = components['schemas']['MenuLocalizationInput'];

// Navigation Items
export type NavigationItem = components['schemas']['NavigationItemResponse'];

export type CreateNavigationItemRequest = components['schemas']['CreateNavigationItemRequest'];

export type UpdateNavigationItemRequest = components['schemas']['UpdateNavigationItemRequest'];

export type NavigationItemLocalizationInput = components['schemas']['NavigationItemLocalizationInput'];

export type NavigationItemLocalizationResponse = components['schemas']['NavigationItemLocalizationResponse'];

export type NavigationTreeNode = components['schemas']['NavigationTree'];

export type ReorderTreeItem = components['schemas']['ReorderNavigationTreeItem'];

// Blog (full response)
export type BlogResponse = components['schemas']['BlogResponse'];

export type BlogDetailResponse = components['schemas']['BlogDetailResponse'];

// Document Library
export type DocumentFolder = components['schemas']['DocumentFolderResponse'];

export type CreateDocumentFolderRequest = components['schemas']['CreateDocumentFolderRequest'];

export type UpdateDocumentFolderRequest = components['schemas']['UpdateDocumentFolderRequest'];

export type DocumentLocalizationResponse = components['schemas']['DocumentLocalizationResponse'];

export type CreateDocumentLocalizationRequest = components['schemas']['CreateDocumentLocalizationRequest'];

export type UpdateDocumentLocalizationRequest = components['schemas']['UpdateDocumentLocalizationRequest'];

export type DocumentListItem = components['schemas']['DocumentListItem'];

export type DocumentResponse = components['schemas']['DocumentResponse'];

export type CreateDocumentRequest = components['schemas']['CreateDocumentRequest'];

export type UpdateDocumentRequest = components['schemas']['UpdateDocumentRequest'];

export type SetDocumentPrivacyRequest = components['schemas']['SetDocumentPrivacyRequest'];

export type RemoveDocumentPrivacyRequest = components['schemas']['RemoveDocumentPrivacyRequest'];

export type VerifyDocumentAccessRequest = components['schemas']['VerifyDocumentAccessRequest'];

export type VerifyDocumentAccessResponse = components['schemas']['VerifyDocumentAccessResponse'];

export type BlogDocumentResponse = components['schemas']['BlogDocumentResponse'];

export type AssignBlogDocumentRequest = components['schemas']['AssignBlogDocumentRequest'];

export type CreateBlogRequest = components['schemas']['CreateBlogRequest'];

export type UpdateBlogRequest = components['schemas']['UpdateBlogRequest'];

// Media (upload/update)
export type UploadMediaRequest = components['schemas']['UploadMediaRequest'];

export type UpdateMediaRequest = components['schemas']['UpdateMediaRequest'];

// Pages
export type PageType = components['schemas']['PageType'];
export type SectionType = components['schemas']['SectionType'];

/** Page counts grouped by workflow status. Drives filter-pill badges. */
export type PageStatusCounts = components['schemas']['PageStatusCounts'];

export type PageListItem = components['schemas']['PageListItem'];

export type PageResponse = components['schemas']['PageResponse'];

export type CreatePageRequest = components['schemas']['CreatePageRequest'];

export type PageDetailResponse = components['schemas']['PageDetailResponse'];

export type UpdatePageRequest = components['schemas']['UpdatePageRequest'];

export type PageSectionResponse = components['schemas']['PageSectionResponse'];

export type SectionLocalizationResponse = components['schemas']['SectionLocalizationResponse'];

export type UpsertSectionLocalizationRequest = components['schemas']['UpsertSectionLocalizationRequest'];

export type CreatePageSectionRequest = components['schemas']['CreatePageSectionRequest'];

export type UpdatePageSectionRequest = components['schemas']['UpdatePageSectionRequest'];

// Legal
export type LegalDocType = components['schemas']['LegalDocType'];

export type LegalDocumentResponse = components['schemas']['LegalDocumentResponse'];

export type LegalDocLocalizationResponse = components['schemas']['LegalDocLocalizationResponse'];

export type LegalDocumentFullDetailResponse = components['schemas']['LegalDocumentFullDetailResponse'];

export type LegalVersionResponse = components['schemas']['LegalVersionResponse'];

export type CreateLegalDocumentRequest = components['schemas']['CreateLegalDocumentRequest'];

export type UpdateLegalDocumentRequest = components['schemas']['UpdateLegalDocumentRequest'];

export type LegalGroupResponse = components['schemas']['LegalGroupResponse'];

export type CreateLegalGroupRequest = components['schemas']['CreateLegalGroupRequest'];

export type UpdateLegalGroupRequest = components['schemas']['UpdateLegalGroupRequest'];

export type LegalItemResponse = components['schemas']['LegalItemResponse'];

export type CreateLegalItemRequest = components['schemas']['CreateLegalItemRequest'];

export type UpdateLegalItemRequest = components['schemas']['UpdateLegalItemRequest'];

// CV
export type SkillCategory = components['schemas']['SkillCategory'];
export type CvEntryType = components['schemas']['CvEntryType'];

export type SkillResponse = components['schemas']['SkillResponse'];

export type CreateSkillRequest = components['schemas']['CreateSkillRequest'];

export type UpdateSkillRequest = components['schemas']['UpdateSkillRequest'];

export type CvEntryResponse = components['schemas']['CvEntryResponse'];

export type CreateCvEntryRequest = components['schemas']['CreateCvEntryRequest'];

export type UpdateCvEntryRequest = components['schemas']['UpdateCvEntryRequest'];

// ── Projects ──────────────────────────────────────────────────────────────

export type ProjectLinkType = components['schemas']['ProjectLinkType'];

export type ProjectLinkResponse = components['schemas']['ProjectLinkResponse'];

export type ProjectMediaResponse = components['schemas']['ProjectMediaResponse'];

export type ProjectLocalizationResponse = components['schemas']['ProjectLocalizationResponse'];

export type ProjectResponse = components['schemas']['ProjectResponse'];

export type ProjectDetailResponse = components['schemas']['ProjectDetailResponse'];

export type CreateProjectLinkRequest = components['schemas']['CreateProjectLinkRequest'];

export type ProjectMediaRequest = components['schemas']['ProjectMediaRequest'];

export type CreateProjectRequest = components['schemas']['CreateProjectRequest'];

export type UpdateProjectRequest = components['schemas']['UpdateProjectRequest'];

// ── Project Localization Input ─────────────────────────────────────────

export type CreateProjectLocalizationRequest = components['schemas']['CreateProjectLocalizationRequest'];

// ── CV Entry Localization ─────────────────────────────────────────────

export type CvEntryLocalizationInput = components['schemas']['CvEntryLocalizationInput'];

export type CvEntryLocalizationResponse = components['schemas']['CvEntryLocalizationResponse'];

export type CvEntryDetailResponse = components['schemas']['CvEntryDetailResponse'];

// Preview Templates
export type PreviewTemplate = components['schemas']['PreviewTemplate'];

export type PreviewTokenResponse = components['schemas']['PreviewTokenResponse'];

// robots.txt
export type RobotsTxtDirective = components['schemas']['RobotsTxtDirective'];

export type RobotsTxtRule = components['schemas']['RobotsTxtRule'];

// Site Settings
export type SiteSettingsResponse = components['schemas']['SiteSettingsResponse'];

export type UpdateSiteSettingsRequest = components['schemas']['UpdateSiteSettingsRequest'];

// Storage Usage
export type StorageUsageResponse = components['schemas']['StorageUsageResponse'];

export type SiteStorageSummary = components['schemas']['SiteStorageSummary'];

export type SystemStorageOverviewResponse = components['schemas']['SystemStorageOverviewResponse'];

export type SiteOverviewEntry = components['schemas']['SiteOverviewEntry'];

export type SitesOverviewResponse = components['schemas']['SitesOverviewResponse'];

// Trash
export type TrashItem = components['schemas']['TrashItem'];

export type TrashListResponse = components['schemas']['TrashListResponse'];

export type TrashCountResponse = components['schemas']['TrashCountResponse'];

// Favicon
export type FaviconVariant = components['schemas']['FaviconVariant'];

export type FaviconResponse = components['schemas']['FaviconResponse'];

// User Preferences
export type UserPreferencesResponse = components['schemas']['UserPreferencesResponse'];

export type UpdateUserPreferencesRequest = components['schemas']['UpdateUserPreferencesRequest'];

// Onboarding Survey
export type UserType = 'solo' | 'team' | 'agency';
export type ContentIntent = 'blog' | 'portfolio' | 'marketing' | 'docs' | 'company';

export type OnboardingResponse = components['schemas']['OnboardingResponse'];

export type CompleteOnboardingRequest = components['schemas']['CompleteOnboardingRequest'];

// Clerk User Management
export type ClerkUser = components['schemas']['ClerkUserResponse'];

export type ClerkUserListResponse = components['schemas']['ClerkUserListResponse'];

// Site Membership Management
export type SiteMembership = components['schemas']['SiteMembershipResponse'];

export type AddSiteMemberRequest = components['schemas']['AddSiteMemberRequest'];

export type UpdateMemberRoleRequest = components['schemas']['UpdateMemberRoleRequest'];

export type TransferOwnershipRequest = components['schemas']['TransferOwnershipRequest'];

// Audit Log
export type AuditAction = components['schemas']['AuditAction'];

// Editorial Workflow
export type ReviewAction = components['schemas']['ReviewAction'];

export type ReviewActionRequest = components['schemas']['ReviewActionRequest'];

export type ReviewActionResponse = components['schemas']['ReviewActionResponse'];

export type AuditLogEntry = components['schemas']['AuditLogResponse'];

export type PaginatedAuditLogs = Paginated<AuditLogEntry>;

/** AI generation usage for a site. AI audit rows are hidden from the
 * regular activity feed to reduce noise; this counter exposes the
 * underlying volume as a stat for the site owner. */
export type AiUsageCount = components['schemas']['AiUsageCount'];

export type ChangeHistoryEntry = components['schemas']['ChangeHistoryResponse'];

export type RevertChangesResponse = components['schemas']['RevertChangesResponse'];

// Profile & Data Export
export type ProfileResponse = components['schemas']['ProfileResponse'];

export type UserDataExportResponse = components['schemas']['UserDataExportResponse'];
export type PiiInventoryResponse = components['schemas']['PiiInventoryResponse'];
export type PiiInventoryEntity = components['schemas']['PiiInventoryEntity'];
export type PiiInventoryField = components['schemas']['PiiInventoryField'];

// Notifications
export type NotificationType = 'content_submitted' | 'content_approved' | 'changes_requested' | (string & {});

export type NotificationResponse = components['schemas']['NotificationResponse'];

export type UnreadCountResponse = components['schemas']['UnreadCountResponse'];

export type MarkAllReadResponse = components['schemas']['MarkAllReadResponse'];

/** Read vs unread split for the notifications filter pills. */
export type NotificationStatusCounts = components['schemas']['NotificationStatusCounts'];

/** Shared response for single/bulk/delete-read notification operations. */
export type NotificationDeleteResponse = components['schemas']['NotificationDeleteResponse'];

// Bulk Actions
export type BulkAction = components['schemas']['BulkAction'];

export type BulkContentRequest = components['schemas']['BulkContentRequest'];

export type BulkContentResponse = components['schemas']['BulkContentResponse'];

// AI Content Assist
export type AiAction = components['schemas']['AiAction'];

export interface TaskConfig {
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export type AiGenerateRequest = components['schemas']['AiGenerateRequest'];

export type AiGenerateResponse = components['schemas']['AiGenerateResponse'];

export type SectionContext = components['schemas']['SectionContext'];

export type BlogTagContext = components['schemas']['BlogTagContext'];

export type CreateAiConfigRequest = components['schemas']['CreateAiConfigRequest'];

export type ListModelsRequest = components['schemas']['ListModelsRequest'];

export type ListModelsResponse = components['schemas']['ListModelsResponse'];

export type AiConfigResponse = components['schemas']['AiConfigResponse'];

export type AiUsageResponse = components['schemas']['AiUsageResponse'];
export type AiUsageLogResponse = components['schemas']['AiUsageLogResponse'];
export type AiUsageBucketResponse = components['schemas']['AiUsageBucketResponse'];
export type AiUsageGroupBy = components['schemas']['GroupBy'];

export type AiTestResponse = components['schemas']['AiTestResponse'];

// ── Analytics ──────────────────────────────────────────────────────

export type TopContentItem = components['schemas']['TopContentItem'];

export type TrendDataPoint = components['schemas']['TrendDataPoint'];

export type AnalyticsReportResponse = components['schemas']['AnalyticsReportResponse'];

export type AnalyticsMaintenanceResponse = components['schemas']['AnalyticsMaintenanceResponse'];

export type ReferrerItem = components['schemas']['ReferrerItem'];

export type AnalyticsPageDetailResponse = components['schemas']['AnalyticsPageDetailResponse'];

export interface AnalyticsReportParams {
  days?: number;
  topN?: number;
  startDate?: string;
  endDate?: string;
}

export interface AnalyticsPageDetailParams {
  path: string;
  days?: number;
  startDate?: string;
  endDate?: string;
}

// Help system state
export type HelpStateResponse = components['schemas']['HelpStateResponse'];

export type UpdateHelpStateRequest = components['schemas']['UpdateHelpStateRequest'];

// Onboarding Progress
export type OnboardingStepResponse = components['schemas']['OnboardingStepResponse'];

export type OnboardingProgressResponse = components['schemas']['OnboardingProgressResponse'];

export type CompleteStepRequest = components['schemas']['CompleteStepRequest'];

// ── Forms module (#579) ─────────────────────────────────────────────────

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'number'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'custom';

export type FormBotProtection = components['schemas']['FormBotProtection'];
export type FormStorageMode = components['schemas']['FormStorageMode'];

/** Free-form validation rule bag. Server validates structure at submit time. */
export interface FormFieldValidation {
  required?: boolean;
  min_length?: number;
  max_length?: number;
  pattern?: string;
  min?: number;
  max?: number;
  /** Future: phase-2 conditional logic (#592). */
  conditions?: unknown;
  [key: string]: unknown;
}

/** Select / radio / checkbox option. The renderer also tolerates plain strings. */
export interface FormFieldOption {
  key: string;
  label: string;
}

/** Per-locale override for a form's top-level text. */
export type FormLocalizationInput = components['schemas']['FormLocalizationInput'];

export type FormLocalizationResponse = components['schemas']['FormLocalizationResponse'];

/** Per-locale override for a single form field. `label` on the parent is
 *  the technical/JSONB key — these fields only affect what visitors see. */
export type FormFieldLocalizationInput = components['schemas']['FormFieldLocalizationInput'];

export type FormFieldLocalizationResponse = components['schemas']['FormFieldLocalizationResponse'];

/** Field as sent to the API (POST / PUT). */
export type FormFieldInput = components['schemas']['FormFieldInput'];

/** Field as returned by the API. */
export type FormFieldResponse = components['schemas']['FormFieldResponse'];

export interface FormListItem {
  id: string;
  site_id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  field_count: number;
  submission_count: number;
  created_at: string;
  updated_at: string;
}

export type FormDetailResponse = components['schemas']['FormDetailResponse'];

export type CreateFormRequest = components['schemas']['CreateFormRequest'];

export type UpdateFormRequest = components['schemas']['UpdateFormRequest'];

export type FormTemplateResponse = components['schemas']['FormTemplateResponse'];

export type CreateFormTemplateRequest = components['schemas']['CreateFormTemplateRequest'];

export type UpdateFormTemplateRequest = components['schemas']['UpdateFormTemplateRequest'];

// ── Submissions (#583, #589) ────────────────────────────────────────────

export type FormSubmissionStatus = components['schemas']['FormSubmissionStatus'];

export interface SubmissionListItem {
  id: string;
  reference_code: string;
  status: FormSubmissionStatus;
  data: Record<string, unknown>;
  created_at: string;
}

export type SubmissionStatusCounts = components['schemas']['SubmissionStatusCounts'];

export type SubmissionNoteResponse = components['schemas']['SubmissionNoteResponse'];

export type SubmissionStatusLogEntry = components['schemas']['SubmissionStatusLogEntry'];

export type SubmissionDetailResponse = components['schemas']['SubmissionDetailResponse'];

export type UpdateSubmissionStatusRequest = components['schemas']['UpdateSubmissionStatusRequest'];

export type CreateSubmissionNoteRequest = components['schemas']['CreateSubmissionNoteRequest'];

// ── Site bot-protection config (#608) ─────────────────────────────────

/**
 * Per-site captcha verifier config. Forja is headless: each site admin
 * pastes whichever provider's siteverify URL + secret they signed up with.
 * The plaintext secret is never returned from the API after write — only
 * the URL and a human-facing label come back.
 */
export type SiteBotProtectionResponse = components['schemas']['SiteBotProtectionResponse'];

export type UpsertSiteBotProtectionRequest = components['schemas']['UpsertSiteBotProtectionRequest'];

/** `altcha` (self-hosted, default) or `remote` (vendor verifier). */
export type BotProtectionMode = components['schemas']['BotProtectionMode'];

// ── Async site export (#716/#717 backend, #718 wiring) ────────────────

/**
 * One async site-archive export job. `status` is a free-form string on
 * the wire; {@link SiteExportStatus} narrows it to the lifecycle the UI
 * drives. `download_url` (an expiring signed link) and `expires_at` are
 * present only while `ready`; `error` only while `failed`.
 */
export type SiteExportJob = components['schemas']['SiteExportJobResponse'];

/** The four states an export job moves through. */
export type SiteExportStatus = 'queued' | 'running' | 'ready' | 'failed';


/** Public deployment-operator imprint (Impressum) — `GET /api/v1/imprint`. */
export type ImprintResponse = components['schemas']['ImprintResponse'];
