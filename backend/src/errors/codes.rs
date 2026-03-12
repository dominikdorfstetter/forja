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
    /// Machine-readable error code (e.g. `"BLOG_NOT_FOUND"`)
    pub code: &'static str,
    /// Domain this code belongs to (e.g. `"blog"`)
    pub domain: &'static str,
    /// HTTP status code this error typically produces
    pub http_status: u16,
    /// Human-readable description of when this code is returned
    pub description: &'static str,
}

// ── Site ────────────────────────────────────────────────────────────────

pub const SITE_NOT_FOUND: &str = "SITE_NOT_FOUND";
pub const SITE_SLUG_TAKEN: &str = "SITE_SLUG_TAKEN";
pub const SITE_CREATE_REQUIRES_ADMIN: &str = "SITE_CREATE_REQUIRES_ADMIN";
pub const SITE_CREATE_INVALID_LOCALES: &str = "SITE_CREATE_INVALID_LOCALES";
pub const SITE_CREATE_SCOPED_KEY: &str = "SITE_CREATE_SCOPED_KEY";

// ── Blog ────────────────────────────────────────────────────────────────

pub const BLOG_NOT_FOUND: &str = "BLOG_NOT_FOUND";
pub const BLOG_SLUG_TAKEN: &str = "BLOG_SLUG_TAKEN";
pub const BLOG_LOCALIZATION_EXISTS: &str = "BLOG_LOCALIZATION_EXISTS";
pub const BLOG_SAMPLE_EXISTS: &str = "BLOG_SAMPLE_EXISTS";
pub const BLOG_NO_DEFAULT_LOCALE: &str = "BLOG_NO_DEFAULT_LOCALE";
pub const BLOG_BULK_STATUS_REQUIRED: &str = "BLOG_BULK_STATUS_REQUIRED";

// ── Page ────────────────────────────────────────────────────────────────

pub const PAGE_NOT_FOUND: &str = "PAGE_NOT_FOUND";
pub const PAGE_SLUG_TAKEN: &str = "PAGE_SLUG_TAKEN";
pub const PAGE_SECTION_NOT_FOUND: &str = "PAGE_SECTION_NOT_FOUND";
pub const PAGE_LOCALIZATION_EXISTS: &str = "PAGE_LOCALIZATION_EXISTS";
pub const PAGE_BULK_STATUS_REQUIRED: &str = "PAGE_BULK_STATUS_REQUIRED";

// ── Content (shared blog/page) ─────────────────────────────────────────

pub const CONTENT_NOT_FOUND: &str = "CONTENT_NOT_FOUND";
pub const CONTENT_LOCALIZATION_NOT_FOUND: &str = "CONTENT_LOCALIZATION_NOT_FOUND";
pub const CONTENT_INVALID_STATUS: &str = "CONTENT_INVALID_STATUS";
pub const CONTENT_PUBLISH_DATE_INVALID: &str = "CONTENT_PUBLISH_DATE_INVALID";
pub const CONTENT_UNKNOWN_ENTITY_TYPE: &str = "CONTENT_UNKNOWN_ENTITY_TYPE";
pub const CONTENT_NO_DEFAULT_ENVIRONMENT: &str = "CONTENT_NO_DEFAULT_ENVIRONMENT";
pub const CONTENT_SLUG_GENERATION_FAILED: &str = "CONTENT_SLUG_GENERATION_FAILED";
pub const CONTENT_ROUTE_GENERATION_FAILED: &str = "CONTENT_ROUTE_GENERATION_FAILED";
pub const CONTENT_REVIEW_INVALID_STATUS: &str = "CONTENT_REVIEW_INVALID_STATUS";

// ── Document ────────────────────────────────────────────────────────────

pub const DOCUMENT_NOT_FOUND: &str = "DOCUMENT_NOT_FOUND";
pub const DOCUMENT_FOLDER_NOT_FOUND: &str = "DOCUMENT_FOLDER_NOT_FOUND";
pub const DOCUMENT_LOCALIZATION_NOT_FOUND: &str = "DOCUMENT_LOCALIZATION_NOT_FOUND";

// ── Media ───────────────────────────────────────────────────────────────

pub const MEDIA_NOT_FOUND: &str = "MEDIA_NOT_FOUND";
pub const MEDIA_FOLDER_NOT_FOUND: &str = "MEDIA_FOLDER_NOT_FOUND";
pub const MEDIA_METADATA_NOT_FOUND: &str = "MEDIA_METADATA_NOT_FOUND";
pub const MEDIA_UPLOAD_TOO_LARGE: &str = "MEDIA_UPLOAD_TOO_LARGE";
pub const MEDIA_UPLOAD_INVALID_TYPE: &str = "MEDIA_UPLOAD_INVALID_TYPE";
pub const MEDIA_UPLOAD_EMPTY: &str = "MEDIA_UPLOAD_EMPTY";
pub const MEDIA_UPLOAD_NO_DATA: &str = "MEDIA_UPLOAD_NO_DATA";
pub const MEDIA_UPLOAD_READ_FAILED: &str = "MEDIA_UPLOAD_READ_FAILED";

// ── Auth ────────────────────────────────────────────────────────────────

pub const AUTH_MISSING_CREDENTIALS: &str = "AUTH_MISSING_CREDENTIALS";
pub const AUTH_TOKEN_INVALID: &str = "AUTH_TOKEN_INVALID";
pub const AUTH_INSUFFICIENT_ROLE: &str = "AUTH_INSUFFICIENT_ROLE";
pub const AUTH_SITE_ACCESS_DENIED: &str = "AUTH_SITE_ACCESS_DENIED";
pub const AUTH_API_KEY_INVALID: &str = "AUTH_API_KEY_INVALID";
pub const AUTH_API_KEY_SITE_DENIED: &str = "AUTH_API_KEY_SITE_DENIED";
pub const AUTH_ACCOUNT_SOLE_OWNER: &str = "AUTH_ACCOUNT_SOLE_OWNER";
pub const AUTH_CLERK_NOT_CONFIGURED: &str = "AUTH_CLERK_NOT_CONFIGURED";

// ── API Keys ────────────────────────────────────────────────────────────

pub const API_KEY_NOT_FOUND: &str = "API_KEY_NOT_FOUND";
pub const API_KEY_PERMISSION_EXCEEDED: &str = "API_KEY_PERMISSION_EXCEEDED";
pub const API_KEY_INVALID_STATUS: &str = "API_KEY_INVALID_STATUS";
pub const API_KEY_INVALID_PERMISSION: &str = "API_KEY_INVALID_PERMISSION";
pub const API_KEY_SITE_FILTER_REQUIRED: &str = "API_KEY_SITE_FILTER_REQUIRED";

// ── User ────────────────────────────────────────────────────────────────

pub const USER_NOT_FOUND: &str = "USER_NOT_FOUND";

// ── Taxonomy ────────────────────────────────────────────────────────────

pub const TAG_NOT_FOUND: &str = "TAG_NOT_FOUND";
pub const TAG_SLUG_TAKEN: &str = "TAG_SLUG_TAKEN";
pub const CATEGORY_NOT_FOUND: &str = "CATEGORY_NOT_FOUND";
pub const CATEGORY_SLUG_TAKEN: &str = "CATEGORY_SLUG_TAKEN";
pub const CATEGORY_ASSIGNMENT_NOT_FOUND: &str = "CATEGORY_ASSIGNMENT_NOT_FOUND";

// ── Locale ──────────────────────────────────────────────────────────────

pub const LOCALE_NOT_FOUND: &str = "LOCALE_NOT_FOUND";
pub const LOCALE_CODE_TAKEN: &str = "LOCALE_CODE_TAKEN";
pub const LOCALE_DELETE_IN_USE: &str = "LOCALE_DELETE_IN_USE";

// ── Site Locale ─────────────────────────────────────────────────────────

pub const SITE_LOCALE_LAST_LANGUAGE: &str = "SITE_LOCALE_LAST_LANGUAGE";

// ── Site Membership ─────────────────────────────────────────────────────

pub const MEMBER_ALREADY_EXISTS: &str = "MEMBER_ALREADY_EXISTS";
pub const MEMBER_ROLE_OWNER_REQUIRED: &str = "MEMBER_ROLE_OWNER_REQUIRED";
pub const MEMBER_CANNOT_REMOVE_OWNER: &str = "MEMBER_CANNOT_REMOVE_OWNER";
pub const MEMBER_REQUIRES_CLERK_AUTH: &str = "MEMBER_REQUIRES_CLERK_AUTH";

// ── Legal ───────────────────────────────────────────────────────────────

pub const LEGAL_DOC_NOT_FOUND: &str = "LEGAL_DOC_NOT_FOUND";
pub const LEGAL_GROUP_NOT_FOUND: &str = "LEGAL_GROUP_NOT_FOUND";
pub const LEGAL_ITEM_NOT_FOUND: &str = "LEGAL_ITEM_NOT_FOUND";

// ── CV ──────────────────────────────────────────────────────────────────

pub const SKILL_NOT_FOUND: &str = "SKILL_NOT_FOUND";
pub const CV_ENTRY_NOT_FOUND: &str = "CV_ENTRY_NOT_FOUND";

// ── Navigation ──────────────────────────────────────────────────────────

pub const NAV_ITEM_NOT_FOUND: &str = "NAV_ITEM_NOT_FOUND";
pub const NAV_MENU_NOT_FOUND: &str = "NAV_MENU_NOT_FOUND";

// ── Social ──────────────────────────────────────────────────────────────

pub const SOCIAL_LINK_NOT_FOUND: &str = "SOCIAL_LINK_NOT_FOUND";

// ── Redirect ────────────────────────────────────────────────────────────

pub const REDIRECT_NOT_FOUND: &str = "REDIRECT_NOT_FOUND";
pub const REDIRECT_SAME_PATH: &str = "REDIRECT_SAME_PATH";

// ── Webhook ─────────────────────────────────────────────────────────────

pub const WEBHOOK_NOT_FOUND: &str = "WEBHOOK_NOT_FOUND";
pub const WEBHOOK_TEST_FAILED: &str = "WEBHOOK_TEST_FAILED";

// ── Notification ────────────────────────────────────────────────────────

pub const NOTIFICATION_NOT_FOUND: &str = "NOTIFICATION_NOT_FOUND";
pub const NOTIFICATION_ACCESS_DENIED: &str = "NOTIFICATION_ACCESS_DENIED";
pub const NOTIFICATION_REQUIRES_CLERK: &str = "NOTIFICATION_REQUIRES_CLERK";

// ── Content Template ────────────────────────────────────────────────────

pub const TEMPLATE_NOT_FOUND: &str = "TEMPLATE_NOT_FOUND";

// ── Environment ─────────────────────────────────────────────────────────

pub const ENVIRONMENT_NOT_FOUND: &str = "ENVIRONMENT_NOT_FOUND";
pub const ENVIRONMENT_NO_DEFAULT: &str = "ENVIRONMENT_NO_DEFAULT";

// ── Analytics ───────────────────────────────────────────────────────────

pub const ANALYTICS_NOT_ENABLED: &str = "ANALYTICS_NOT_ENABLED";

// ── AI ──────────────────────────────────────────────────────────────────

pub const AI_NOT_CONFIGURED: &str = "AI_NOT_CONFIGURED";
pub const AI_PROVIDER_UNAVAILABLE: &str = "AI_PROVIDER_UNAVAILABLE";
pub const AI_RESPONSE_PARSE_FAILED: &str = "AI_RESPONSE_PARSE_FAILED";
pub const AI_TRANSLATE_INVALID: &str = "AI_TRANSLATE_INVALID";

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

// ── Catalog ─────────────────────────────────────────────────────────────

/// Complete catalog of all error codes with metadata.
/// Used by `GET /api/v1/error-codes` endpoint.
pub const ALL: &[ErrorCodeDef] = &[
    // Site
    ErrorCodeDef {
        code: SITE_NOT_FOUND,
        domain: "site",
        http_status: 404,
        description: "The requested site does not exist",
    },
    ErrorCodeDef {
        code: SITE_SLUG_TAKEN,
        domain: "site",
        http_status: 409,
        description: "A site with this slug already exists",
    },
    ErrorCodeDef {
        code: SITE_CREATE_REQUIRES_ADMIN,
        domain: "site",
        http_status: 403,
        description: "Admin API key required to create sites",
    },
    ErrorCodeDef {
        code: SITE_CREATE_INVALID_LOCALES,
        domain: "site",
        http_status: 400,
        description: "Exactly one locale must be marked as default when creating a site",
    },
    ErrorCodeDef {
        code: SITE_CREATE_SCOPED_KEY,
        domain: "site",
        http_status: 403,
        description: "Site-scoped API keys cannot create new sites",
    },
    // Blog
    ErrorCodeDef {
        code: BLOG_NOT_FOUND,
        domain: "blog",
        http_status: 404,
        description: "The requested blog post does not exist",
    },
    ErrorCodeDef {
        code: BLOG_SLUG_TAKEN,
        domain: "blog",
        http_status: 409,
        description: "A blog post with this slug already exists",
    },
    ErrorCodeDef {
        code: BLOG_LOCALIZATION_EXISTS,
        domain: "blog",
        http_status: 400,
        description: "A localization for this locale already exists on this blog",
    },
    ErrorCodeDef {
        code: BLOG_SAMPLE_EXISTS,
        domain: "blog",
        http_status: 400,
        description: "Sample content already exists for this site",
    },
    ErrorCodeDef {
        code: BLOG_NO_DEFAULT_LOCALE,
        domain: "blog",
        http_status: 400,
        description: "No default locale configured for this site",
    },
    ErrorCodeDef {
        code: BLOG_BULK_STATUS_REQUIRED,
        domain: "blog",
        http_status: 400,
        description: "The status field is required for UpdateStatus bulk action",
    },
    // Page
    ErrorCodeDef {
        code: PAGE_NOT_FOUND,
        domain: "page",
        http_status: 404,
        description: "The requested page does not exist",
    },
    ErrorCodeDef {
        code: PAGE_SLUG_TAKEN,
        domain: "page",
        http_status: 409,
        description: "A page with this slug already exists",
    },
    ErrorCodeDef {
        code: PAGE_SECTION_NOT_FOUND,
        domain: "page",
        http_status: 404,
        description: "The requested page section does not exist",
    },
    ErrorCodeDef {
        code: PAGE_LOCALIZATION_EXISTS,
        domain: "page",
        http_status: 400,
        description: "A localization for this locale already exists on this page",
    },
    ErrorCodeDef {
        code: PAGE_BULK_STATUS_REQUIRED,
        domain: "page",
        http_status: 400,
        description: "The status field is required for UpdateStatus bulk action",
    },
    // Content (shared)
    ErrorCodeDef {
        code: CONTENT_NOT_FOUND,
        domain: "content",
        http_status: 404,
        description: "The requested content item does not exist",
    },
    ErrorCodeDef {
        code: CONTENT_LOCALIZATION_NOT_FOUND,
        domain: "content",
        http_status: 404,
        description: "No localization found for the requested content and locale",
    },
    ErrorCodeDef {
        code: CONTENT_INVALID_STATUS,
        domain: "content",
        http_status: 400,
        description: "Invalid status transition for this content item",
    },
    ErrorCodeDef {
        code: CONTENT_PUBLISH_DATE_INVALID,
        domain: "content",
        http_status: 400,
        description: "publish_end must be after publish_start",
    },
    ErrorCodeDef {
        code: CONTENT_UNKNOWN_ENTITY_TYPE,
        domain: "content",
        http_status: 400,
        description: "Unknown content entity type",
    },
    ErrorCodeDef {
        code: CONTENT_NO_DEFAULT_ENVIRONMENT,
        domain: "content",
        http_status: 400,
        description: "No default environment configured",
    },
    ErrorCodeDef {
        code: CONTENT_SLUG_GENERATION_FAILED,
        domain: "content",
        http_status: 400,
        description: "Could not generate a unique slug - too many copies",
    },
    ErrorCodeDef {
        code: CONTENT_ROUTE_GENERATION_FAILED,
        domain: "content",
        http_status: 400,
        description: "Could not generate a unique route - too many copies",
    },
    ErrorCodeDef {
        code: CONTENT_REVIEW_INVALID_STATUS,
        domain: "content",
        http_status: 400,
        description: "Content must be in InReview status to perform a review action",
    },
    // Document
    ErrorCodeDef {
        code: DOCUMENT_NOT_FOUND,
        domain: "document",
        http_status: 404,
        description: "The requested document does not exist",
    },
    ErrorCodeDef {
        code: DOCUMENT_FOLDER_NOT_FOUND,
        domain: "document",
        http_status: 404,
        description: "The requested document folder does not exist",
    },
    ErrorCodeDef {
        code: DOCUMENT_LOCALIZATION_NOT_FOUND,
        domain: "document",
        http_status: 404,
        description: "No localization found for the requested document and locale",
    },
    // Media
    ErrorCodeDef {
        code: MEDIA_NOT_FOUND,
        domain: "media",
        http_status: 404,
        description: "The requested media file does not exist",
    },
    ErrorCodeDef {
        code: MEDIA_FOLDER_NOT_FOUND,
        domain: "media",
        http_status: 404,
        description: "The requested media folder does not exist",
    },
    ErrorCodeDef {
        code: MEDIA_METADATA_NOT_FOUND,
        domain: "media",
        http_status: 404,
        description: "The requested media metadata does not exist",
    },
    ErrorCodeDef {
        code: MEDIA_UPLOAD_TOO_LARGE,
        domain: "media",
        http_status: 400,
        description: "Uploaded file exceeds the maximum allowed size",
    },
    ErrorCodeDef {
        code: MEDIA_UPLOAD_INVALID_TYPE,
        domain: "media",
        http_status: 400,
        description: "The uploaded file type is not allowed",
    },
    ErrorCodeDef {
        code: MEDIA_UPLOAD_EMPTY,
        domain: "media",
        http_status: 400,
        description: "The uploaded file is empty or no file data was received",
    },
    ErrorCodeDef {
        code: MEDIA_UPLOAD_NO_DATA,
        domain: "media",
        http_status: 400,
        description: "No file data received in the upload request",
    },
    ErrorCodeDef {
        code: MEDIA_UPLOAD_READ_FAILED,
        domain: "media",
        http_status: 500,
        description: "Failed to read the uploaded file data",
    },
    // Auth
    ErrorCodeDef {
        code: AUTH_MISSING_CREDENTIALS,
        domain: "auth",
        http_status: 401,
        description: "No Authorization Bearer token or X-API-Key header provided",
    },
    ErrorCodeDef {
        code: AUTH_TOKEN_INVALID,
        domain: "auth",
        http_status: 401,
        description: "The provided authentication token is invalid or expired",
    },
    ErrorCodeDef {
        code: AUTH_INSUFFICIENT_ROLE,
        domain: "auth",
        http_status: 403,
        description: "Your role does not have sufficient permissions for this action",
    },
    ErrorCodeDef {
        code: AUTH_SITE_ACCESS_DENIED,
        domain: "auth",
        http_status: 403,
        description: "You do not have access to the requested site",
    },
    ErrorCodeDef {
        code: AUTH_API_KEY_INVALID,
        domain: "auth",
        http_status: 401,
        description: "The provided API key is invalid",
    },
    ErrorCodeDef {
        code: AUTH_API_KEY_SITE_DENIED,
        domain: "auth",
        http_status: 403,
        description: "The API key does not have access to the requested site",
    },
    ErrorCodeDef {
        code: AUTH_ACCOUNT_SOLE_OWNER,
        domain: "auth",
        http_status: 409,
        description: "Cannot delete account while being the sole owner of a site",
    },
    ErrorCodeDef {
        code: AUTH_CLERK_NOT_CONFIGURED,
        domain: "auth",
        http_status: 500,
        description: "Clerk authentication service is not configured",
    },
    // API Key
    ErrorCodeDef {
        code: API_KEY_NOT_FOUND,
        domain: "api_key",
        http_status: 404,
        description: "The requested API key does not exist",
    },
    ErrorCodeDef {
        code: API_KEY_PERMISSION_EXCEEDED,
        domain: "api_key",
        http_status: 403,
        description: "Your role cannot create API keys with the requested permission level",
    },
    ErrorCodeDef {
        code: API_KEY_INVALID_STATUS,
        domain: "api_key",
        http_status: 422,
        description: "Invalid API key status value",
    },
    ErrorCodeDef {
        code: API_KEY_INVALID_PERMISSION,
        domain: "api_key",
        http_status: 422,
        description: "Invalid API key permission value",
    },
    ErrorCodeDef {
        code: API_KEY_SITE_FILTER_REQUIRED,
        domain: "api_key",
        http_status: 403,
        description: "Site admins must specify a site_id filter when listing API keys",
    },
    // User
    ErrorCodeDef {
        code: USER_NOT_FOUND,
        domain: "user",
        http_status: 404,
        description: "The requested user does not exist",
    },
    // Taxonomy
    ErrorCodeDef {
        code: TAG_NOT_FOUND,
        domain: "taxonomy",
        http_status: 404,
        description: "The requested tag does not exist",
    },
    ErrorCodeDef {
        code: TAG_SLUG_TAKEN,
        domain: "taxonomy",
        http_status: 409,
        description: "A tag with this slug already exists",
    },
    ErrorCodeDef {
        code: CATEGORY_NOT_FOUND,
        domain: "taxonomy",
        http_status: 404,
        description: "The requested category does not exist",
    },
    ErrorCodeDef {
        code: CATEGORY_SLUG_TAKEN,
        domain: "taxonomy",
        http_status: 409,
        description: "A category with this slug already exists",
    },
    ErrorCodeDef {
        code: CATEGORY_ASSIGNMENT_NOT_FOUND,
        domain: "taxonomy",
        http_status: 404,
        description: "The category assignment does not exist",
    },
    // Locale
    ErrorCodeDef {
        code: LOCALE_NOT_FOUND,
        domain: "locale",
        http_status: 404,
        description: "The requested locale does not exist",
    },
    ErrorCodeDef {
        code: LOCALE_CODE_TAKEN,
        domain: "locale",
        http_status: 409,
        description: "A locale with this code already exists",
    },
    ErrorCodeDef {
        code: LOCALE_DELETE_IN_USE,
        domain: "locale",
        http_status: 409,
        description: "Cannot delete locale that is assigned to one or more sites",
    },
    // Site Locale
    ErrorCodeDef {
        code: SITE_LOCALE_LAST_LANGUAGE,
        domain: "site_locale",
        http_status: 409,
        description: "Cannot remove the last language from a site",
    },
    // Site Membership
    ErrorCodeDef {
        code: MEMBER_ALREADY_EXISTS,
        domain: "site_membership",
        http_status: 409,
        description: "The user is already a member of this site",
    },
    ErrorCodeDef {
        code: MEMBER_ROLE_OWNER_REQUIRED,
        domain: "site_membership",
        http_status: 403,
        description: "Only the site owner can assign Admin or Owner roles",
    },
    ErrorCodeDef {
        code: MEMBER_CANNOT_REMOVE_OWNER,
        domain: "site_membership",
        http_status: 403,
        description: "Cannot remove the site owner - transfer ownership first",
    },
    ErrorCodeDef {
        code: MEMBER_REQUIRES_CLERK_AUTH,
        domain: "site_membership",
        http_status: 400,
        description: "This operation requires Clerk JWT authentication",
    },
    // Legal
    ErrorCodeDef {
        code: LEGAL_DOC_NOT_FOUND,
        domain: "legal",
        http_status: 404,
        description: "The requested legal document does not exist",
    },
    ErrorCodeDef {
        code: LEGAL_GROUP_NOT_FOUND,
        domain: "legal",
        http_status: 404,
        description: "The requested legal group does not exist",
    },
    ErrorCodeDef {
        code: LEGAL_ITEM_NOT_FOUND,
        domain: "legal",
        http_status: 404,
        description: "The requested legal item does not exist",
    },
    // CV
    ErrorCodeDef {
        code: SKILL_NOT_FOUND,
        domain: "cv",
        http_status: 404,
        description: "The requested skill does not exist",
    },
    ErrorCodeDef {
        code: CV_ENTRY_NOT_FOUND,
        domain: "cv",
        http_status: 404,
        description: "The requested CV entry does not exist",
    },
    // Navigation
    ErrorCodeDef {
        code: NAV_ITEM_NOT_FOUND,
        domain: "navigation",
        http_status: 404,
        description: "The requested navigation item does not exist",
    },
    ErrorCodeDef {
        code: NAV_MENU_NOT_FOUND,
        domain: "navigation",
        http_status: 404,
        description: "The requested navigation menu does not exist",
    },
    // Social
    ErrorCodeDef {
        code: SOCIAL_LINK_NOT_FOUND,
        domain: "social",
        http_status: 404,
        description: "The requested social link does not exist",
    },
    // Redirect
    ErrorCodeDef {
        code: REDIRECT_NOT_FOUND,
        domain: "redirect",
        http_status: 404,
        description: "The requested redirect does not exist",
    },
    ErrorCodeDef {
        code: REDIRECT_SAME_PATH,
        domain: "redirect",
        http_status: 400,
        description: "Source and destination redirect paths must be different",
    },
    // Webhook
    ErrorCodeDef {
        code: WEBHOOK_NOT_FOUND,
        domain: "webhook",
        http_status: 404,
        description: "The requested webhook does not exist",
    },
    ErrorCodeDef {
        code: WEBHOOK_TEST_FAILED,
        domain: "webhook",
        http_status: 500,
        description: "The webhook test delivery failed",
    },
    // Notification
    ErrorCodeDef {
        code: NOTIFICATION_NOT_FOUND,
        domain: "notification",
        http_status: 404,
        description: "The requested notification does not exist",
    },
    ErrorCodeDef {
        code: NOTIFICATION_ACCESS_DENIED,
        domain: "notification",
        http_status: 403,
        description: "You can only access your own notifications",
    },
    ErrorCodeDef {
        code: NOTIFICATION_REQUIRES_CLERK,
        domain: "notification",
        http_status: 403,
        description: "Notification endpoints require Clerk JWT authentication",
    },
    // Content Template
    ErrorCodeDef {
        code: TEMPLATE_NOT_FOUND,
        domain: "content_template",
        http_status: 404,
        description: "The requested content template does not exist",
    },
    // Environment
    ErrorCodeDef {
        code: ENVIRONMENT_NOT_FOUND,
        domain: "environment",
        http_status: 404,
        description: "The requested environment does not exist",
    },
    ErrorCodeDef {
        code: ENVIRONMENT_NO_DEFAULT,
        domain: "environment",
        http_status: 404,
        description: "No default environment is configured",
    },
    // Analytics
    ErrorCodeDef {
        code: ANALYTICS_NOT_ENABLED,
        domain: "analytics",
        http_status: 403,
        description: "Analytics is not enabled for this site",
    },
    // AI
    ErrorCodeDef {
        code: AI_NOT_CONFIGURED,
        domain: "ai",
        http_status: 400,
        description: "AI is not configured for this site",
    },
    ErrorCodeDef {
        code: AI_PROVIDER_UNAVAILABLE,
        domain: "ai",
        http_status: 503,
        description: "The AI provider is unavailable or returned an error",
    },
    ErrorCodeDef {
        code: AI_RESPONSE_PARSE_FAILED,
        domain: "ai",
        http_status: 500,
        description: "Failed to parse the AI provider response",
    },
    ErrorCodeDef {
        code: AI_TRANSLATE_INVALID,
        domain: "ai",
        http_status: 400,
        description: "Invalid translation request content or missing fields",
    },
    // Clerk
    ErrorCodeDef {
        code: CLERK_NOT_CONFIGURED,
        domain: "clerk",
        http_status: 500,
        description: "Clerk service is not configured",
    },
    ErrorCodeDef {
        code: CLERK_USER_NOT_FOUND,
        domain: "clerk",
        http_status: 404,
        description: "The requested Clerk user does not exist",
    },
    ErrorCodeDef {
        code: CLERK_API_FAILED,
        domain: "clerk",
        http_status: 500,
        description: "Clerk API request failed",
    },
    ErrorCodeDef {
        code: CLERK_INVALID_IDENTIFIER,
        domain: "clerk",
        http_status: 400,
        description: "Invalid user identifier format",
    },
    ErrorCodeDef {
        code: CLERK_INVALID_ROLE,
        domain: "clerk",
        http_status: 422,
        description: "Invalid role value",
    },
    // Workflow
    ErrorCodeDef {
        code: WORKFLOW_REVIEW_REQUIRED,
        domain: "workflow",
        http_status: 403,
        description:
            "Editorial workflow requires content to be submitted for review before publishing",
    },
    ErrorCodeDef {
        code: WORKFLOW_INVALID_STATUS,
        domain: "workflow",
        http_status: 403,
        description: "Reviewers can only transition content that is InReview",
    },
    ErrorCodeDef {
        code: WORKFLOW_NO_PERMISSION,
        domain: "workflow",
        http_status: 403,
        description: "You do not have permission to change content status",
    },
    // Module
    ErrorCodeDef {
        code: MODULE_NOT_ENABLED,
        domain: "module",
        http_status: 403,
        description: "The requested module is not enabled for this site",
    },
    // Onboarding
    ErrorCodeDef {
        code: ONBOARDING_REQUIRES_CLERK,
        domain: "onboarding",
        http_status: 400,
        description: "Onboarding progress requires Clerk authentication",
    },
    // Validation (field-level)
    ErrorCodeDef {
        code: VALIDATION_REQUIRED_FIELD,
        domain: "validation",
        http_status: 422,
        description: "A required field is missing",
    },
    ErrorCodeDef {
        code: VALIDATION_INVALID_FORMAT,
        domain: "validation",
        http_status: 422,
        description: "A field has an invalid format",
    },
    ErrorCodeDef {
        code: VALIDATION_OUT_OF_RANGE,
        domain: "validation",
        http_status: 422,
        description: "A field value is outside the allowed range",
    },
    // System / fallback
    ErrorCodeDef {
        code: RATE_LIMIT_EXCEEDED,
        domain: "system",
        http_status: 429,
        description: "Too many requests - rate limit exceeded",
    },
    ErrorCodeDef {
        code: SERVICE_UNAVAILABLE,
        domain: "system",
        http_status: 503,
        description: "A required service is temporarily unavailable",
    },
    ErrorCodeDef {
        code: INTERNAL_ERROR,
        domain: "system",
        http_status: 500,
        description: "An unexpected internal error occurred",
    },
    ErrorCodeDef {
        code: DATABASE_ERROR,
        domain: "system",
        http_status: 500,
        description: "A database error occurred",
    },
    ErrorCodeDef {
        code: STORAGE_ERROR,
        domain: "system",
        http_status: 500,
        description: "A storage backend error occurred",
    },
    ErrorCodeDef {
        code: RESOURCE_NOT_FOUND,
        domain: "system",
        http_status: 404,
        description: "The requested resource was not found (generic)",
    },
    ErrorCodeDef {
        code: BAD_REQUEST,
        domain: "system",
        http_status: 400,
        description: "The request was malformed or invalid (generic)",
    },
    ErrorCodeDef {
        code: VALIDATION_ERROR,
        domain: "system",
        http_status: 422,
        description: "One or more fields failed validation (generic)",
    },
    ErrorCodeDef {
        code: UNAUTHORIZED,
        domain: "system",
        http_status: 401,
        description: "Authentication is required (generic)",
    },
    ErrorCodeDef {
        code: FORBIDDEN,
        domain: "system",
        http_status: 403,
        description: "You do not have permission for this action (generic)",
    },
    ErrorCodeDef {
        code: CONFLICT,
        domain: "system",
        http_status: 409,
        description: "The request conflicts with existing data (generic)",
    },
];
