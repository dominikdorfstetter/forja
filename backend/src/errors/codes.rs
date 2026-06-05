//! Centralized error code registry.
//!
//! Every domain-specific error code is defined here as a `&'static str` constant.
//! The `ALL` array provides metadata for the `GET /error-codes` catalog endpoint.
//!
//! Code pattern: `{DOMAIN}_{ACTION}_{REASON}` — a developer who knows the domain
//! and failure mode should be able to *guess* the code without checking the docs.

use serde::Serialize;
use utoipa::ToSchema;

/// Metadata for a single error code, used by the catalog endpoint.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ErrorCodeDef {
    /// Machine-readable error code (e.g. `"ENTITY_NOT_FOUND"`)
    pub code: &'static str,
    /// Domain this code belongs to (e.g. `"blog"`)
    pub domain: &'static str,
    /// HTTP status code this error typically produces
    pub http_status: u16,
    /// Human-readable description of when this code is returned
    pub description: &'static str,
}

// ── Entity (use with ApiError::with_entity_type("blog"|"page"|...)) ─────

pub const ENTITY_NOT_FOUND: &str = "ENTITY_NOT_FOUND";
pub const ENTITY_SLUG_TAKEN: &str = "ENTITY_SLUG_TAKEN";
pub const ENTITY_LOCALIZATION_EXISTS: &str = "ENTITY_LOCALIZATION_EXISTS";
pub const ENTITY_LOCALIZATION_NOT_FOUND: &str = "ENTITY_LOCALIZATION_NOT_FOUND";
pub const LOCALIZATION_COVERAGE_INCOMPLETE: &str = "LOCALIZATION_COVERAGE_INCOMPLETE";

// ── Site ────────────────────────────────────────────────────────────────

pub const SITE_CREATE_REQUIRES_ADMIN: &str = "SITE_CREATE_REQUIRES_ADMIN";
pub const SITE_CREATE_INVALID_LOCALES: &str = "SITE_CREATE_INVALID_LOCALES";
pub const SITE_CREATE_SCOPED_KEY: &str = "SITE_CREATE_SCOPED_KEY";
pub const SITE_RESTORE_EXPIRED: &str = "SITE_RESTORE_EXPIRED";
pub const SITE_EXPORT_FORBIDDEN: &str = "SITE_EXPORT_FORBIDDEN";
pub const SITE_EXPORT_JOB_NOT_FOUND: &str = "SITE_EXPORT_JOB_NOT_FOUND";
pub const SITE_EXPORT_ALREADY_RUNNING: &str = "SITE_EXPORT_ALREADY_RUNNING";
pub const SITE_EXPORT_FAILED: &str = "SITE_EXPORT_FAILED";
pub const PREVIEW_TOKEN_NOT_CONFIGURED: &str = "PREVIEW_TOKEN_NOT_CONFIGURED";

// ── Blog ────────────────────────────────────────────────────────────────

pub const BLOG_SAMPLE_EXISTS: &str = "BLOG_SAMPLE_EXISTS";
pub const BLOG_NO_DEFAULT_LOCALE: &str = "BLOG_NO_DEFAULT_LOCALE";
pub const BLOG_BULK_STATUS_REQUIRED: &str = "BLOG_BULK_STATUS_REQUIRED";

// ── Page ────────────────────────────────────────────────────────────────

pub const PAGE_BULK_STATUS_REQUIRED: &str = "PAGE_BULK_STATUS_REQUIRED";

// ── Content (shared blog/page) ─────────────────────────────────────────

pub const CONTENT_INVALID_STATUS: &str = "CONTENT_INVALID_STATUS";
pub const CONTENT_PUBLISH_DATE_INVALID: &str = "CONTENT_PUBLISH_DATE_INVALID";
pub const CONTENT_UNKNOWN_ENTITY_TYPE: &str = "CONTENT_UNKNOWN_ENTITY_TYPE";
pub const CONTENT_NO_DEFAULT_ENVIRONMENT: &str = "CONTENT_NO_DEFAULT_ENVIRONMENT";
pub const CONTENT_SLUG_GENERATION_FAILED: &str = "CONTENT_SLUG_GENERATION_FAILED";
pub const CONTENT_ROUTE_GENERATION_FAILED: &str = "CONTENT_ROUTE_GENERATION_FAILED";
pub const CONTENT_REVIEW_INVALID_STATUS: &str = "CONTENT_REVIEW_INVALID_STATUS";

// ── Trash ──────────────────────────────────────────────────────────────

pub const TRASH_ALREADY_RESTORED: &str = "TRASH_ALREADY_RESTORED";
pub const TRASH_NOT_DELETED: &str = "TRASH_NOT_DELETED";

// ── Document ────────────────────────────────────────────────────────────

pub const DOCUMENT_PASSWORD_REQUIRED: &str = "DOCUMENT_PASSWORD_REQUIRED";
pub const DOCUMENT_PASSWORD_INCORRECT: &str = "DOCUMENT_PASSWORD_INCORRECT";
pub const DOCUMENT_ACCESS_RATE_LIMITED: &str = "DOCUMENT_ACCESS_RATE_LIMITED";
pub const DOCUMENT_ENCRYPTION_FAILED: &str = "DOCUMENT_ENCRYPTION_FAILED";
pub const DOCUMENT_DECRYPTION_FAILED: &str = "DOCUMENT_DECRYPTION_FAILED";
pub const DOCUMENT_NOT_UPLOADABLE: &str = "DOCUMENT_NOT_UPLOADABLE";
pub const DOCUMENT_EXPIRED: &str = "DOCUMENT_EXPIRED";
pub const DOCUMENT_LOCKED: &str = "DOCUMENT_LOCKED";
pub const DOCUMENT_NOT_LOCKED: &str = "DOCUMENT_NOT_LOCKED";
pub const DOCUMENT_INVALID_TTL: &str = "DOCUMENT_INVALID_TTL";

// ── Media ───────────────────────────────────────────────────────────────

pub const MEDIA_UPLOAD_TOO_LARGE: &str = "MEDIA_UPLOAD_TOO_LARGE";
pub const MEDIA_UPLOAD_INVALID_TYPE: &str = "MEDIA_UPLOAD_INVALID_TYPE";
pub const MEDIA_UPLOAD_EMPTY: &str = "MEDIA_UPLOAD_EMPTY";
pub const MEDIA_UPLOAD_NO_DATA: &str = "MEDIA_UPLOAD_NO_DATA";
pub const MEDIA_UPLOAD_READ_FAILED: &str = "MEDIA_UPLOAD_READ_FAILED";
pub const MEDIA_TAG_INVALID: &str = "MEDIA_TAG_INVALID";
pub const MEDIA_TOO_MANY_TAGS: &str = "MEDIA_TOO_MANY_TAGS";

// ── Storage Quota ──────────────────────────────────────────────────────

pub const STORAGE_QUOTA_EXCEEDED: &str = "STORAGE_QUOTA_EXCEEDED";

// ── Auth ────────────────────────────────────────────────────────────────

pub const AUTH_MISSING_CREDENTIALS: &str = "AUTH_MISSING_CREDENTIALS";
pub const AUTH_TOKEN_INVALID: &str = "AUTH_TOKEN_INVALID";
pub const AUTH_TOKEN_AUDIENCE: &str = "AUTH_TOKEN_AUDIENCE";
pub const AUTH_TOKEN_ISSUER: &str = "AUTH_TOKEN_ISSUER";
pub const AUTH_INSUFFICIENT_ROLE: &str = "AUTH_INSUFFICIENT_ROLE";
pub const AUTH_SITE_ACCESS_DENIED: &str = "AUTH_SITE_ACCESS_DENIED";
pub const AUTH_API_KEY_INVALID: &str = "AUTH_API_KEY_INVALID";
pub const AUTH_API_KEY_SITE_DENIED: &str = "AUTH_API_KEY_SITE_DENIED";
pub const ACCOUNT_SUSPENDED: &str = "ACCOUNT_SUSPENDED";
pub const ACCOUNT_BANNED: &str = "ACCOUNT_BANNED";
pub const AUTH_ACCOUNT_SOLE_OWNER: &str = "AUTH_ACCOUNT_SOLE_OWNER";
pub const AUTH_CLERK_NOT_CONFIGURED: &str = "AUTH_CLERK_NOT_CONFIGURED";
pub const AUTH_RATE_LIMITED: &str = "AUTH_RATE_LIMITED";

// ── API Keys ────────────────────────────────────────────────────────────

pub const API_KEY_PERMISSION_EXCEEDED: &str = "API_KEY_PERMISSION_EXCEEDED";
pub const API_KEY_INVALID_STATUS: &str = "API_KEY_INVALID_STATUS";
pub const API_KEY_INVALID_PERMISSION: &str = "API_KEY_INVALID_PERMISSION";
pub const API_KEY_SITE_FILTER_REQUIRED: &str = "API_KEY_SITE_FILTER_REQUIRED";
pub const API_KEY_INVALID_PARAMS: &str = "API_KEY_INVALID_PARAMS";

// ── Quotas ─────────────────────────────────────────────────────────────

pub const QUOTA_HOURLY_EXCEEDED: &str = "QUOTA_HOURLY_EXCEEDED";
pub const QUOTA_DAILY_EXCEEDED: &str = "QUOTA_DAILY_EXCEEDED";
pub const QUOTA_MONTHLY_EXCEEDED: &str = "QUOTA_MONTHLY_EXCEEDED";
pub const RATE_LIMIT_BURST_EXCEEDED: &str = "RATE_LIMIT_BURST_EXCEEDED";

// ── Locale ──────────────────────────────────────────────────────────────

pub const LOCALE_CODE_TAKEN: &str = "LOCALE_CODE_TAKEN";
pub const LOCALE_DELETE_IN_USE: &str = "LOCALE_DELETE_IN_USE";

// ── Site Locale ─────────────────────────────────────────────────────────

pub const SITE_LOCALE_LAST_LANGUAGE: &str = "SITE_LOCALE_LAST_LANGUAGE";

// ── Site Membership ─────────────────────────────────────────────────────

pub const MEMBER_ALREADY_EXISTS: &str = "MEMBER_ALREADY_EXISTS";
pub const MEMBER_ROLE_OWNER_REQUIRED: &str = "MEMBER_ROLE_OWNER_REQUIRED";
pub const MEMBER_CANNOT_REMOVE_OWNER: &str = "MEMBER_CANNOT_REMOVE_OWNER";
pub const MEMBER_REQUIRES_CLERK_AUTH: &str = "MEMBER_REQUIRES_CLERK_AUTH";
pub const SITE_OWNER_CANNOT_LEAVE: &str = "SITE_OWNER_CANNOT_LEAVE";

// ── Legal ───────────────────────────────────────────────────────────────

pub const LEGAL_PUBLISH_MISSING_TITLE: &str = "LEGAL_PUBLISH_MISSING_TITLE";
pub const LEGAL_PUBLISH_MISSING_BODY: &str = "LEGAL_PUBLISH_MISSING_BODY";
pub const LEGAL_VERSION_SOURCE_DELETED: &str = "LEGAL_VERSION_SOURCE_DELETED";

// ── CV / Portfolio ──────────────────────────────────────────────────────

pub const CV_BULK_STATUS_REQUIRED: &str = "CV_BULK_STATUS_REQUIRED";

// ── Project ────────────────────────────────────────────────────────────

pub const PROJECT_BULK_STATUS_REQUIRED: &str = "PROJECT_BULK_STATUS_REQUIRED";

// ── Redirect ────────────────────────────────────────────────────────────

pub const REDIRECT_SAME_PATH: &str = "REDIRECT_SAME_PATH";

// ── Webhook ─────────────────────────────────────────────────────────────

pub const WEBHOOK_TEST_FAILED: &str = "WEBHOOK_TEST_FAILED";
pub const WEBHOOK_URL_SSRF: &str = "WEBHOOK_URL_SSRF";
pub const WEBHOOK_INVALID_DEBOUNCE: &str = "WEBHOOK_INVALID_DEBOUNCE";
pub const WEBHOOK_INVALID_STATS_WINDOW: &str = "WEBHOOK_INVALID_STATS_WINDOW";

// ── Notification ────────────────────────────────────────────────────────

pub const NOTIFICATION_ACCESS_DENIED: &str = "NOTIFICATION_ACCESS_DENIED";
pub const NOTIFICATION_REQUIRES_CLERK: &str = "NOTIFICATION_REQUIRES_CLERK";

// ── Environment ─────────────────────────────────────────────────────────

pub const ENVIRONMENT_NO_DEFAULT: &str = "ENVIRONMENT_NO_DEFAULT";

// ── Analytics ───────────────────────────────────────────────────────────

pub const ANALYTICS_NOT_ENABLED: &str = "ANALYTICS_NOT_ENABLED";

// ── AI ──────────────────────────────────────────────────────────────────

pub const AI_NOT_CONFIGURED: &str = "AI_NOT_CONFIGURED";
pub const AI_PROVIDER_UNAVAILABLE: &str = "AI_PROVIDER_UNAVAILABLE";
pub const AI_RESPONSE_PARSE_FAILED: &str = "AI_RESPONSE_PARSE_FAILED";
pub const AI_TRANSLATE_INVALID: &str = "AI_TRANSLATE_INVALID";
pub const AI_URL_SSRF: &str = "AI_URL_SSRF";
pub const AI_VISION_MISSING_IMAGE: &str = "AI_VISION_MISSING_IMAGE";
pub const AI_SECTION_CONTEXT_INSUFFICIENT: &str = "AI_SECTION_CONTEXT_INSUFFICIENT";
pub const AI_SECTION_TYPE_UNKNOWN: &str = "AI_SECTION_TYPE_UNKNOWN";
pub const AI_CONTEXT_INSUFFICIENT: &str = "AI_CONTEXT_INSUFFICIENT";

// ── Clerk ───────────────────────────────────────────────────────────────

pub const CLERK_NOT_CONFIGURED: &str = "CLERK_NOT_CONFIGURED";
pub const CLERK_USER_NOT_FOUND: &str = "CLERK_USER_NOT_FOUND";
pub const CLERK_API_FAILED: &str = "CLERK_API_FAILED";
pub const CLERK_INVALID_IDENTIFIER: &str = "CLERK_INVALID_IDENTIFIER";
pub const CLERK_INVALID_ROLE: &str = "CLERK_INVALID_ROLE";

// ── Workflow ────────────────────────────────────────────────────────────

pub const WORKFLOW_REVIEW_REQUIRED: &str = "WORKFLOW_REVIEW_REQUIRED";
pub const WORKFLOW_INVALID_STATUS: &str = "WORKFLOW_INVALID_STATUS";
pub const WORKFLOW_NO_PERMISSION: &str = "WORKFLOW_NO_PERMISSION";

// ── Module ──────────────────────────────────────────────────────────────

pub const MODULE_NOT_ENABLED: &str = "MODULE_NOT_ENABLED";

// ── Onboarding ──────────────────────────────────────────────────────────

pub const ONBOARDING_REQUIRES_CLERK: &str = "ONBOARDING_REQUIRES_CLERK";

// ── Forms ───────────────────────────────────────────────────────────────

pub const FORM_DUPLICATE_FIELD_LABELS: &str = "FORM_DUPLICATE_FIELD_LABELS";
pub const FORM_TEMPLATE_NAME_EXISTS: &str = "FORM_TEMPLATE_NAME_EXISTS";
pub const FORM_BOT_PROTECTION_MISSING: &str = "BOT_PROTECTION_MISSING";
pub const FORM_BOT_PROTECTION_INVALID: &str = "BOT_PROTECTION_INVALID";
pub const FORM_BOT_PROTECTION_NOT_CONFIGURED: &str = "BOT_PROTECTION_NOT_CONFIGURED";
pub const FORM_BOT_PROTECTION_PROVIDER_ERROR: &str = "BOT_PROTECTION_PROVIDER_ERROR";
pub const FORM_VALIDATION_FAILED: &str = "FORM_VALIDATION_FAILED";
pub const FORM_CONSENT_REQUIRED: &str = "FORM_CONSENT_REQUIRED";
pub const FORM_SUBMISSION_DELETED: &str = "SUBMISSION_DELETED";
pub const FORM_INVALID_REFERENCE_CODE: &str = "INVALID_REFERENCE_CODE";
pub const FORM_INVALID_STATUS_TRANSITION: &str = "INVALID_STATUS_TRANSITION";

// ── Validation (field-level) ────────────────────────────────────────────

pub const VALIDATION_REQUIRED_FIELD: &str = "VALIDATION_REQUIRED_FIELD";
pub const VALIDATION_INVALID_FORMAT: &str = "VALIDATION_INVALID_FORMAT";
pub const VALIDATION_OUT_OF_RANGE: &str = "VALIDATION_OUT_OF_RANGE";

// ── System / fallback ───────────────────────────────────────────────────

pub const RATE_LIMIT_EXCEEDED: &str = "RATE_LIMIT_EXCEEDED";
pub const SERVICE_UNAVAILABLE: &str = "SERVICE_UNAVAILABLE";
pub const INTERNAL_ERROR: &str = "INTERNAL_ERROR";
pub const DATABASE_ERROR: &str = "DATABASE_ERROR";
pub const STORAGE_ERROR: &str = "STORAGE_ERROR";

// Fallback codes (used when no .with_code() override is set)
pub const RESOURCE_NOT_FOUND: &str = "RESOURCE_NOT_FOUND";
pub const BAD_REQUEST: &str = "BAD_REQUEST";
pub const VALIDATION_ERROR: &str = "VALIDATION_ERROR";
pub const UNAUTHORIZED: &str = "UNAUTHORIZED";
pub const FORBIDDEN: &str = "FORBIDDEN";
pub const CONFLICT: &str = "CONFLICT";
pub const PAYLOAD_TOO_LARGE: &str = "PAYLOAD_TOO_LARGE";

// ── Custom types / Collections (#789 epic) ──────────────────────────────

// Schema-builder (#791)
pub const ERR_CUSTOM_TYPE_FORBIDDEN: &str = "ERR_CUSTOM_TYPE_FORBIDDEN";
pub const ERR_CUSTOM_TYPE_NOT_FOUND: &str = "ERR_CUSTOM_TYPE_NOT_FOUND";
pub const ERR_CUSTOM_TYPE_RESERVED_NAME: &str = "ERR_CUSTOM_TYPE_RESERVED_NAME";
pub const ERR_CUSTOM_TYPE_KEY_TAKEN: &str = "ERR_CUSTOM_TYPE_KEY_TAKEN";
pub const ERR_CUSTOM_TYPE_IN_USE: &str = "ERR_CUSTOM_TYPE_IN_USE";
pub const ERR_CUSTOM_TYPE_LIMIT: &str = "ERR_CUSTOM_TYPE_LIMIT";
pub const ERR_CUSTOM_FIELD_LIMIT: &str = "ERR_CUSTOM_FIELD_LIMIT";
pub const ERR_CUSTOM_FIELD_DUPLICATE_KEY: &str = "ERR_CUSTOM_FIELD_DUPLICATE_KEY";
pub const ERR_CUSTOM_FIELD_INVALID_TYPE: &str = "ERR_CUSTOM_FIELD_INVALID_TYPE";
pub const ERR_CUSTOM_FIELD_INVALID_PATTERN: &str = "ERR_CUSTOM_FIELD_INVALID_PATTERN";
pub const ERR_CUSTOM_FIELD_ENUM_OPTIONS_MISSING: &str = "ERR_CUSTOM_FIELD_ENUM_OPTIONS_MISSING";
pub const ERR_CUSTOM_FIELD_TITLE_REQUIRED: &str = "ERR_CUSTOM_FIELD_TITLE_REQUIRED";
pub const ERR_CUSTOM_FIELD_LEGAL_BASIS_MISSING: &str = "ERR_CUSTOM_FIELD_LEGAL_BASIS_MISSING";
pub const ERR_CUSTOM_FIELD_PII_PUBLIC: &str = "ERR_CUSTOM_FIELD_PII_PUBLIC";

// Runtime entry validator + storage (#792 / #793)
pub const ERR_CUSTOM_ENTRY_VALIDATION: &str = "ERR_CUSTOM_ENTRY_VALIDATION";
pub const ERR_CUSTOM_ENTRY_REQUIRED_FIELD: &str = "ERR_CUSTOM_ENTRY_REQUIRED_FIELD";
pub const ERR_CUSTOM_ENTRY_TOO_LARGE: &str = "ERR_CUSTOM_ENTRY_TOO_LARGE";
pub const ERR_CUSTOM_FIELD_UNIQUE_CONFLICT: &str = "ERR_CUSTOM_FIELD_UNIQUE_CONFLICT";

// Safe schema evolution (#800)
pub const ERR_CUSTOM_FIELD_REQUIRED_CONFLICT: &str = "ERR_CUSTOM_FIELD_REQUIRED_CONFLICT";
pub const ERR_CUSTOM_FIELD_RETYPE_INCOMPATIBLE: &str = "ERR_CUSTOM_FIELD_RETYPE_INCOMPATIBLE";

// ── Imprint ─────────────────────────────────────────────────────────────

/// The imprint is partially configured (some, but not all, required operator
/// fields are set). Emitted as a server-side `warn!` only — `GET /imprint`
/// still returns `200 {configured:false}`, so this is intentionally *not* in
/// the client-facing `ALL` catalog below.
pub const ERR_IMPRINT_INCOMPLETE: &str = "ERR_IMPRINT_INCOMPLETE";

// ── Catalog ─────────────────────────────────────────────────────────────

/// Complete catalog of all error codes with metadata.
/// Used by `GET /api/v1/error-codes` endpoint.
pub const ALL: &[ErrorCodeDef] = &[
    // Entity (general-purpose; entity_type carried in ProblemDetails.entity_type)
    ErrorCodeDef { code: ENTITY_NOT_FOUND, domain: "entity", http_status: 404, description: "The requested entity instance does not exist (entity_type identifies which domain)" },
    ErrorCodeDef { code: ENTITY_SLUG_TAKEN, domain: "entity", http_status: 409, description: "An entity with this slug already exists (entity_type identifies which domain)" },
    ErrorCodeDef { code: ENTITY_LOCALIZATION_EXISTS, domain: "entity", http_status: 400, description: "A localization for this locale already exists on the entity (entity_type identifies which domain)" },
    ErrorCodeDef { code: ENTITY_LOCALIZATION_NOT_FOUND, domain: "entity", http_status: 404, description: "No localization found for the requested entity and locale (entity_type identifies which domain)" },
    // Site
    ErrorCodeDef { code: SITE_CREATE_REQUIRES_ADMIN, domain: "site", http_status: 403, description: "Admin API key required to create sites" },
    ErrorCodeDef { code: SITE_CREATE_INVALID_LOCALES, domain: "site", http_status: 400, description: "Exactly one locale must be marked as default when creating a site" },
    ErrorCodeDef { code: SITE_CREATE_SCOPED_KEY, domain: "site", http_status: 403, description: "Site-scoped API keys cannot create new sites" },
    ErrorCodeDef { code: SITE_RESTORE_EXPIRED, domain: "site", http_status: 410, description: "The 30-day grace window for restoring a soft-deleted site has lapsed" },
    ErrorCodeDef { code: SITE_EXPORT_FORBIDDEN, domain: "site", http_status: 403, description: "Only the site owner, a site admin, or a system admin may export a site archive" },
    ErrorCodeDef { code: SITE_EXPORT_JOB_NOT_FOUND, domain: "site", http_status: 404, description: "The site export job does not exist for this site, or its artifact has expired and been purged" },
    ErrorCodeDef { code: SITE_EXPORT_ALREADY_RUNNING, domain: "site", http_status: 409, description: "An export job for this site is already queued or running; wait for it to finish before requesting another" },
    ErrorCodeDef { code: SITE_EXPORT_FAILED, domain: "site", http_status: 500, description: "The export worker failed to build or store the site archive" },
    // Blog
    ErrorCodeDef { code: BLOG_SAMPLE_EXISTS, domain: "blog", http_status: 400, description: "Sample content already exists for this site" },
    ErrorCodeDef { code: BLOG_NO_DEFAULT_LOCALE, domain: "blog", http_status: 400, description: "No default locale configured for this site" },
    ErrorCodeDef { code: BLOG_BULK_STATUS_REQUIRED, domain: "blog", http_status: 400, description: "The status field is required for UpdateStatus bulk action" },
    // Page
    ErrorCodeDef { code: PAGE_BULK_STATUS_REQUIRED, domain: "page", http_status: 400, description: "The status field is required for UpdateStatus bulk action" },
    // Content (shared)
    ErrorCodeDef { code: CONTENT_INVALID_STATUS, domain: "content", http_status: 400, description: "Invalid status transition for this content item" },
    ErrorCodeDef { code: CONTENT_PUBLISH_DATE_INVALID, domain: "content", http_status: 400, description: "publish_end must be after publish_start" },
    ErrorCodeDef { code: CONTENT_UNKNOWN_ENTITY_TYPE, domain: "content", http_status: 400, description: "Unknown content entity type" },
    ErrorCodeDef { code: CONTENT_NO_DEFAULT_ENVIRONMENT, domain: "content", http_status: 400, description: "No default environment configured" },
    ErrorCodeDef { code: CONTENT_SLUG_GENERATION_FAILED, domain: "content", http_status: 400, description: "Could not generate a unique slug - too many copies" },
    ErrorCodeDef { code: CONTENT_ROUTE_GENERATION_FAILED, domain: "content", http_status: 400, description: "Could not generate a unique route - too many copies" },
    ErrorCodeDef { code: CONTENT_REVIEW_INVALID_STATUS, domain: "content", http_status: 400, description: "Content must be in InReview status to perform a review action" },
    // Document
    ErrorCodeDef { code: DOCUMENT_PASSWORD_REQUIRED, domain: "document", http_status: 401, description: "This document is password-protected and requires a password to access" },
    ErrorCodeDef { code: DOCUMENT_PASSWORD_INCORRECT, domain: "document", http_status: 403, description: "The provided password is incorrect" },
    ErrorCodeDef { code: DOCUMENT_ACCESS_RATE_LIMITED, domain: "document", http_status: 429, description: "Too many failed password attempts — try again later" },
    ErrorCodeDef { code: DOCUMENT_ENCRYPTION_FAILED, domain: "document", http_status: 500, description: "Failed to encrypt the document" },
    ErrorCodeDef { code: DOCUMENT_DECRYPTION_FAILED, domain: "document", http_status: 500, description: "Failed to decrypt the document — wrong password or corrupted data" },
    ErrorCodeDef { code: DOCUMENT_NOT_UPLOADABLE, domain: "document", http_status: 400, description: "Only uploaded documents (not URL-based) can be password-protected" },
    ErrorCodeDef { code: DOCUMENT_EXPIRED, domain: "document", http_status: 410, description: "The private document's access window has expired and it is no longer downloadable" },
    ErrorCodeDef { code: DOCUMENT_LOCKED, domain: "document", http_status: 423, description: "The document is locked after 3 failed password attempts and must be unlocked by an admin" },
    ErrorCodeDef { code: DOCUMENT_NOT_LOCKED, domain: "document", http_status: 409, description: "Unlock requested on a document that is not currently locked" },
    ErrorCodeDef { code: DOCUMENT_INVALID_TTL, domain: "document", http_status: 400, description: "expires_at must be in the future and at most one year ahead" },
    // Media
    ErrorCodeDef { code: MEDIA_UPLOAD_TOO_LARGE, domain: "media", http_status: 400, description: "Uploaded file exceeds the maximum allowed size" },
    ErrorCodeDef { code: MEDIA_UPLOAD_INVALID_TYPE, domain: "media", http_status: 400, description: "The uploaded file type is not allowed" },
    ErrorCodeDef { code: MEDIA_UPLOAD_EMPTY, domain: "media", http_status: 400, description: "The uploaded file is empty or no file data was received" },
    ErrorCodeDef { code: MEDIA_UPLOAD_NO_DATA, domain: "media", http_status: 400, description: "No file data received in the upload request" },
    ErrorCodeDef { code: MEDIA_UPLOAD_READ_FAILED, domain: "media", http_status: 500, description: "Failed to read the uploaded file data" },
    ErrorCodeDef { code: MEDIA_TAG_INVALID, domain: "media", http_status: 400, description: "Invalid tag format" },
    ErrorCodeDef { code: MEDIA_TOO_MANY_TAGS, domain: "media", http_status: 400, description: "Too many tags on media file" },
    // Storage Quota
    ErrorCodeDef { code: STORAGE_QUOTA_EXCEEDED, domain: "storage", http_status: 413, description: "Upload would exceed the per-site storage quota" },
    // Trash
    ErrorCodeDef { code: TRASH_ALREADY_RESTORED, domain: "trash", http_status: 400, description: "The item is not in the trash (already restored or never deleted)" },
    ErrorCodeDef { code: TRASH_NOT_DELETED, domain: "trash", http_status: 400, description: "The item is not soft-deleted and cannot be permanently removed from trash" },
    // Auth
    ErrorCodeDef { code: AUTH_MISSING_CREDENTIALS, domain: "auth", http_status: 401, description: "No Authorization Bearer token or X-API-Key header provided" },
    ErrorCodeDef { code: AUTH_TOKEN_INVALID, domain: "auth", http_status: 401, description: "The provided authentication token is invalid or expired" },
    ErrorCodeDef { code: AUTH_TOKEN_AUDIENCE, domain: "auth", http_status: 401, description: "The JWT `aud` claim does not match the configured expected audience" },
    ErrorCodeDef { code: AUTH_TOKEN_ISSUER, domain: "auth", http_status: 401, description: "The JWT `iss` claim does not match the configured expected issuer" },
    ErrorCodeDef { code: AUTH_INSUFFICIENT_ROLE, domain: "auth", http_status: 403, description: "Your role does not have sufficient permissions for this action" },
    ErrorCodeDef { code: AUTH_SITE_ACCESS_DENIED, domain: "auth", http_status: 403, description: "You do not have access to the requested site" },
    ErrorCodeDef { code: AUTH_API_KEY_INVALID, domain: "auth", http_status: 401, description: "The provided API key is invalid" },
    ErrorCodeDef { code: AUTH_API_KEY_SITE_DENIED, domain: "auth", http_status: 403, description: "The API key does not have access to the requested site" },
    ErrorCodeDef { code: AUTH_ACCOUNT_SOLE_OWNER, domain: "auth", http_status: 409, description: "Cannot delete account while being the sole owner of a site" },
    ErrorCodeDef { code: AUTH_CLERK_NOT_CONFIGURED, domain: "auth", http_status: 500, description: "Clerk authentication service is not configured" },
    ErrorCodeDef { code: AUTH_RATE_LIMITED, domain: "auth", http_status: 429, description: "Too many failed authentication attempts — wait before retrying" },
    // API Key
    ErrorCodeDef { code: API_KEY_PERMISSION_EXCEEDED, domain: "api_key", http_status: 403, description: "Your role cannot create API keys with the requested permission level" },
    ErrorCodeDef { code: API_KEY_INVALID_STATUS, domain: "api_key", http_status: 422, description: "Invalid API key status value" },
    ErrorCodeDef { code: API_KEY_INVALID_PERMISSION, domain: "api_key", http_status: 422, description: "Invalid API key permission value" },
    ErrorCodeDef { code: API_KEY_SITE_FILTER_REQUIRED, domain: "api_key", http_status: 403, description: "Site admins must specify a site_id filter when listing API keys" },
    // Locale
    ErrorCodeDef { code: LOCALE_CODE_TAKEN, domain: "locale", http_status: 409, description: "A locale with this code already exists" },
    ErrorCodeDef { code: LOCALE_DELETE_IN_USE, domain: "locale", http_status: 409, description: "Cannot delete locale that is assigned to one or more sites" },
    // Site Locale
    ErrorCodeDef { code: SITE_LOCALE_LAST_LANGUAGE, domain: "site_locale", http_status: 409, description: "Cannot remove the last language from a site" },
    // Site Membership
    ErrorCodeDef { code: MEMBER_ALREADY_EXISTS, domain: "site_membership", http_status: 409, description: "The user is already a member of this site" },
    ErrorCodeDef { code: MEMBER_ROLE_OWNER_REQUIRED, domain: "site_membership", http_status: 403, description: "Only the site owner can assign Admin or Owner roles" },
    ErrorCodeDef { code: MEMBER_CANNOT_REMOVE_OWNER, domain: "site_membership", http_status: 403, description: "Cannot remove the site owner - transfer ownership first" },
    ErrorCodeDef { code: MEMBER_REQUIRES_CLERK_AUTH, domain: "site_membership", http_status: 400, description: "This operation requires Clerk JWT authentication" },
    ErrorCodeDef { code: SITE_OWNER_CANNOT_LEAVE, domain: "site_membership", http_status: 403, description: "Site owners must transfer ownership before leaving" },
    // Legal
    ErrorCodeDef { code: LEGAL_PUBLISH_MISSING_TITLE, domain: "legal", http_status: 400, description: "Legal document must have a title before publishing" },
    ErrorCodeDef { code: LEGAL_PUBLISH_MISSING_BODY, domain: "legal", http_status: 400, description: "Legal document must have content before publishing" },
    ErrorCodeDef { code: LEGAL_VERSION_SOURCE_DELETED, domain: "legal", http_status: 404, description: "Cannot create a version from a deleted document" },
    // CV
    ErrorCodeDef { code: CV_BULK_STATUS_REQUIRED, domain: "cv", http_status: 400, description: "The status field is required for UpdateStatus bulk action on CV entries" },
    // Project
    ErrorCodeDef { code: PROJECT_BULK_STATUS_REQUIRED, domain: "project", http_status: 400, description: "The status field is required for UpdateStatus bulk action on projects" },
    // Redirect
    ErrorCodeDef { code: REDIRECT_SAME_PATH, domain: "redirect", http_status: 400, description: "Source and destination redirect paths must be different" },
    // Webhook
    ErrorCodeDef { code: WEBHOOK_TEST_FAILED, domain: "webhook", http_status: 500, description: "The webhook test delivery failed" },
    ErrorCodeDef { code: WEBHOOK_URL_SSRF, domain: "webhook", http_status: 400, description: "The webhook URL targets a private or internal network address" },
    ErrorCodeDef { code: WEBHOOK_INVALID_DEBOUNCE, domain: "webhook", http_status: 422, description: "Debounce value must be between 0 and 300 seconds" },
    ErrorCodeDef { code: WEBHOOK_INVALID_STATS_WINDOW, domain: "webhook", http_status: 400, description: "Stats time window must be one of: 1h, 24h, 7d, 30d" },
    // Notification
    ErrorCodeDef { code: NOTIFICATION_ACCESS_DENIED, domain: "notification", http_status: 403, description: "You can only access your own notifications" },
    ErrorCodeDef { code: NOTIFICATION_REQUIRES_CLERK, domain: "notification", http_status: 403, description: "Notification endpoints require Clerk JWT authentication" },
    // Environment
    ErrorCodeDef { code: ENVIRONMENT_NO_DEFAULT, domain: "environment", http_status: 404, description: "No default environment is configured" },
    // Analytics
    ErrorCodeDef { code: ANALYTICS_NOT_ENABLED, domain: "analytics", http_status: 403, description: "Analytics is not enabled for this site" },
    // AI
    ErrorCodeDef { code: AI_NOT_CONFIGURED, domain: "ai", http_status: 400, description: "AI is not configured for this site" },
    ErrorCodeDef { code: AI_PROVIDER_UNAVAILABLE, domain: "ai", http_status: 503, description: "The AI provider is unavailable or returned an error" },
    ErrorCodeDef { code: AI_RESPONSE_PARSE_FAILED, domain: "ai", http_status: 500, description: "Failed to parse the AI provider response" },
    ErrorCodeDef { code: AI_TRANSLATE_INVALID, domain: "ai", http_status: 400, description: "Invalid translation request content or missing fields" },
    ErrorCodeDef { code: AI_URL_SSRF, domain: "ai", http_status: 400, description: "The AI base URL or vision image URL targets a private or internal network address" },
    ErrorCodeDef { code: AI_VISION_MISSING_IMAGE, domain: "ai", http_status: 400, description: "image_url is required for vision actions (auto_tag, alt_text)" },
    ErrorCodeDef { code: AI_SECTION_CONTEXT_INSUFFICIENT, domain: "ai", http_status: 400, description: "section_context with section_type is required for section_content action" },
    ErrorCodeDef { code: AI_SECTION_TYPE_UNKNOWN, domain: "ai", http_status: 400, description: "Unknown page-section type — must be one of the SectionType enum values" },
    ErrorCodeDef { code: AI_CONTEXT_INSUFFICIENT, domain: "ai", http_status: 400, description: "Content is too short for the AI to produce a useful suggestion (e.g. blog body shorter than the minimum word count for tag generation)" },
    // Clerk
    ErrorCodeDef { code: CLERK_NOT_CONFIGURED, domain: "clerk", http_status: 500, description: "Clerk service is not configured" },
    ErrorCodeDef { code: CLERK_USER_NOT_FOUND, domain: "clerk", http_status: 404, description: "The requested Clerk user does not exist" },
    ErrorCodeDef { code: CLERK_API_FAILED, domain: "clerk", http_status: 500, description: "Clerk API request failed" },
    ErrorCodeDef { code: CLERK_INVALID_IDENTIFIER, domain: "clerk", http_status: 400, description: "Invalid user identifier format" },
    ErrorCodeDef { code: CLERK_INVALID_ROLE, domain: "clerk", http_status: 422, description: "Invalid role value" },
    // Workflow
    ErrorCodeDef { code: WORKFLOW_REVIEW_REQUIRED, domain: "workflow", http_status: 403, description: "Editorial workflow requires content to be submitted for review before publishing" },
    ErrorCodeDef { code: WORKFLOW_INVALID_STATUS, domain: "workflow", http_status: 403, description: "Reviewers can only transition content that is InReview" },
    ErrorCodeDef { code: WORKFLOW_NO_PERMISSION, domain: "workflow", http_status: 403, description: "You do not have permission to change content status" },
    // Module
    ErrorCodeDef { code: MODULE_NOT_ENABLED, domain: "module", http_status: 403, description: "The requested module is not enabled for this site" },
    // Onboarding
    ErrorCodeDef { code: ONBOARDING_REQUIRES_CLERK, domain: "onboarding", http_status: 400, description: "Onboarding progress requires Clerk authentication" },
    // Forms
    ErrorCodeDef { code: FORM_DUPLICATE_FIELD_LABELS, domain: "forms", http_status: 400, description: "Form definition contains duplicate field labels" },
    ErrorCodeDef { code: FORM_TEMPLATE_NAME_EXISTS, domain: "forms", http_status: 409, description: "Another form template on this site already uses this name" },
    ErrorCodeDef { code: FORM_BOT_PROTECTION_MISSING, domain: "forms", http_status: 400, description: "Form requires a bot_protection_token but none was provided" },
    ErrorCodeDef { code: FORM_BOT_PROTECTION_INVALID, domain: "forms", http_status: 400, description: "Captcha provider reported the supplied token did not pass verification" },
    ErrorCodeDef { code: FORM_BOT_PROTECTION_NOT_CONFIGURED, domain: "forms", http_status: 503, description: "Form is Mandatory-protected but the site has no captcha verifier configured" },
    ErrorCodeDef { code: FORM_BOT_PROTECTION_PROVIDER_ERROR, domain: "forms", http_status: 503, description: "Captcha provider was unreachable or returned an unexpected response" },
    ErrorCodeDef { code: FORM_VALIDATION_FAILED, domain: "forms", http_status: 400, description: "One or more submission fields failed validation" },
    ErrorCodeDef { code: FORM_CONSENT_REQUIRED, domain: "forms", http_status: 400, description: "Form requires consent but consent_given was false" },
    ErrorCodeDef { code: FORM_SUBMISSION_DELETED, domain: "forms", http_status: 410, description: "Submission has been deleted (idempotent self-service signal)" },
    ErrorCodeDef { code: FORM_INVALID_REFERENCE_CODE, domain: "forms", http_status: 404, description: "Reference code does not match any submission" },
    ErrorCodeDef { code: FORM_INVALID_STATUS_TRANSITION, domain: "forms", http_status: 400, description: "Requested submission status transition is not allowed" },
    // Custom types / Collections (#789 epic)
    ErrorCodeDef { code: ERR_CUSTOM_TYPE_FORBIDDEN, domain: "custom_types", http_status: 403, description: "You do not have permission to manage custom types on this site" },
    ErrorCodeDef { code: ERR_CUSTOM_TYPE_NOT_FOUND, domain: "custom_types", http_status: 404, description: "No custom type with that key exists on this site" },
    ErrorCodeDef { code: ERR_CUSTOM_TYPE_RESERVED_NAME, domain: "custom_types", http_status: 422, description: "The type key collides with a built-in entity type" },
    ErrorCodeDef { code: ERR_CUSTOM_TYPE_KEY_TAKEN, domain: "custom_types", http_status: 409, description: "Another custom type on this site already uses this key" },
    ErrorCodeDef { code: ERR_CUSTOM_TYPE_IN_USE, domain: "custom_types", http_status: 409, description: "The custom type still has entries; delete them first or force" },
    ErrorCodeDef { code: ERR_CUSTOM_TYPE_LIMIT, domain: "custom_types", http_status: 422, description: "The site has reached the maximum number of custom types" },
    ErrorCodeDef { code: ERR_CUSTOM_FIELD_LIMIT, domain: "custom_types", http_status: 422, description: "The type has reached the maximum number of fields" },
    ErrorCodeDef { code: ERR_CUSTOM_FIELD_DUPLICATE_KEY, domain: "custom_types", http_status: 422, description: "Two fields in the type share the same key" },
    ErrorCodeDef { code: ERR_CUSTOM_FIELD_INVALID_TYPE, domain: "custom_types", http_status: 422, description: "Unknown field type" },
    ErrorCodeDef { code: ERR_CUSTOM_FIELD_INVALID_PATTERN, domain: "custom_types", http_status: 422, description: "A field pattern is not a valid regular expression" },
    ErrorCodeDef { code: ERR_CUSTOM_FIELD_ENUM_OPTIONS_MISSING, domain: "custom_types", http_status: 422, description: "An enum field must declare at least one option" },
    ErrorCodeDef { code: ERR_CUSTOM_FIELD_TITLE_REQUIRED, domain: "custom_types", http_status: 422, description: "A type must designate exactly one title field" },
    ErrorCodeDef { code: ERR_CUSTOM_FIELD_LEGAL_BASIS_MISSING, domain: "custom_types", http_status: 422, description: "A PII field must declare a legal basis" },
    ErrorCodeDef { code: ERR_CUSTOM_FIELD_PII_PUBLIC, domain: "custom_types", http_status: 422, description: "A publicly-readable type may not expose an unmarked PII field" },
    ErrorCodeDef { code: ERR_CUSTOM_ENTRY_VALIDATION, domain: "custom_types", http_status: 422, description: "Entry values failed schema validation" },
    ErrorCodeDef { code: ERR_CUSTOM_ENTRY_REQUIRED_FIELD, domain: "custom_types", http_status: 422, description: "A required entry field is missing" },
    ErrorCodeDef { code: ERR_CUSTOM_ENTRY_TOO_LARGE, domain: "custom_types", http_status: 413, description: "The entry payload exceeds the per-site size limit" },
    ErrorCodeDef { code: ERR_CUSTOM_FIELD_UNIQUE_CONFLICT, domain: "custom_types", http_status: 409, description: "Another entry already uses this unique field value" },
    ErrorCodeDef { code: ERR_CUSTOM_FIELD_REQUIRED_CONFLICT, domain: "custom_types", http_status: 422, description: "Cannot make a field required: existing entries lack a value" },
    ErrorCodeDef { code: ERR_CUSTOM_FIELD_RETYPE_INCOMPATIBLE, domain: "custom_types", http_status: 422, description: "Cannot retype a field: existing values are not coercible" },
    // Validation (field-level)
    ErrorCodeDef { code: VALIDATION_REQUIRED_FIELD, domain: "validation", http_status: 422, description: "A required field is missing" },
    ErrorCodeDef { code: VALIDATION_INVALID_FORMAT, domain: "validation", http_status: 422, description: "A field has an invalid format" },
    ErrorCodeDef { code: VALIDATION_OUT_OF_RANGE, domain: "validation", http_status: 422, description: "A field value is outside the allowed range" },
    // System / fallback
    ErrorCodeDef { code: RATE_LIMIT_EXCEEDED, domain: "system", http_status: 429, description: "Too many requests - rate limit exceeded" },
    ErrorCodeDef { code: SERVICE_UNAVAILABLE, domain: "system", http_status: 503, description: "A required service is temporarily unavailable" },
    ErrorCodeDef { code: INTERNAL_ERROR, domain: "system", http_status: 500, description: "An unexpected internal error occurred" },
    ErrorCodeDef { code: DATABASE_ERROR, domain: "system", http_status: 500, description: "A database error occurred" },
    ErrorCodeDef { code: STORAGE_ERROR, domain: "system", http_status: 500, description: "A storage backend error occurred" },
    ErrorCodeDef { code: RESOURCE_NOT_FOUND, domain: "system", http_status: 404, description: "The requested resource was not found (generic)" },
    ErrorCodeDef { code: BAD_REQUEST, domain: "system", http_status: 400, description: "The request was malformed or invalid (generic)" },
    ErrorCodeDef { code: VALIDATION_ERROR, domain: "system", http_status: 422, description: "One or more fields failed validation (generic)" },
    ErrorCodeDef { code: UNAUTHORIZED, domain: "system", http_status: 401, description: "Authentication is required (generic)" },
    ErrorCodeDef { code: FORBIDDEN, domain: "system", http_status: 403, description: "You do not have permission for this action (generic)" },
    ErrorCodeDef { code: CONFLICT, domain: "system", http_status: 409, description: "The request conflicts with existing data (generic)" },
    ErrorCodeDef { code: PAYLOAD_TOO_LARGE, domain: "system", http_status: 413, description: "The request payload exceeds the allowed limit (generic)" },
];

/// Helper: look up an error code definition by code string.
pub fn find_by_code(code: &str) -> Option<&'static ErrorCodeDef> {
    ALL.iter().find(|def| def.code == code)
}
