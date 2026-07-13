//! Axum HTTP server scaffold (migration target — see feat/migrate-to-axum branch).
//!
//! This module is being grown handler-by-handler as the codebase moves off
//! Rocket 0.5.1. The entry-point router lives here; resource handlers
//! live under `handlers/` (one submodule per Rocket bundle being ported).
//!
//! ## OpenAPI
//!
//! The router is built around `utoipa_axum::OpenApiRouter`, which both serves
//! routes and accumulates each handler's `#[utoipa::path(...)]` annotation
//! into a single `OpenApi` document. The collected document is exposed at
//! `/api-docs/consumer/openapi.json` and rendered by Swagger UI at `/api-docs/consumer/`. This
//! is parallel to (not a replacement of) the Rocket `openapi.rs` document
//! served from port 8000 — both run during the migration. At cutover the
//! Rocket spec is deleted and this becomes canonical.

use axum::Router;
use axum::extract::Request;
use axum::http::HeaderName;
use axum::middleware::Next;
use axum::response::Response;

/// Mount prefix for the versioned JSON API. Single source of truth — anything
/// that needs to reason about the live request path (router nesting, CORS
/// path categorisation) must reference this constant rather than hard-code
/// the literal, so a future re-mount cannot silently desync them.
pub const API_MOUNT_PREFIX: &str = "/api/v1";
use tower_http::request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer};
use tracing::Instrument;
use tracing::field::Empty;
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;
use utoipa_swagger_ui::SwaggerUi;

use crate::AppState;
use crate::dto::ai::{
    AiConfigResponse, AiGenerateRequest, AiGenerateResponse, AiTestResponse, CreateAiConfigRequest,
    ListModelsRequest, ListModelsResponse,
};
use crate::dto::ai_usage::{AiUsageBucketResponse, AiUsageLogResponse, AiUsageResponse};
use crate::dto::analytics::{
    AnalyticsMaintenanceResponse, AnalyticsPageDetailResponse, AnalyticsReportResponse,
    ReferrerItem, TopContentItem, TrackPageviewRequest, TrackPageviewResponse, TrendDataPoint,
};
use crate::dto::api_key::{
    ApiKeyListItem, ApiKeyResponse, ApiKeyUsageResponse, BlockApiKeyRequest, CreateApiKeyRequest,
    CreateApiKeyResponse, DailyUsageSummary, PaginatedApiKeys, QuotaWindowResponse,
    UpdateApiKeyRequest, UsageSummaryHistory, UsageSummaryQuota, UsageSummaryResponse,
    UsageSummaryTotals,
};
use crate::dto::audit::{
    AiUsageCount, AuditLogResponse, ChangeHistoryResponse, PaginatedAuditLogs,
    RevertChangesRequest, RevertChangesResponse,
};
use crate::dto::auth::{
    AuthInfoResponse, AuthoredContentSummary, ExportApiKeyRecord, GuestTokenResponse,
    ProfileResponse, UserDataExportResponse,
};
use crate::dto::blog::{
    BlogDetailResponse, BlogListItem, BlogResponse, BlogStatusCounts, CreateBlogRequest,
    PaginatedBlogs, UpdateBlogRequest,
};
use crate::dto::bulk::{BulkContentRequest, BulkContentResponse, BulkItemResult};
use crate::dto::clerk::{
    BanUserRequest, ClerkUserListResponse, ClerkUserResponse, ModerationActionResponse,
    SuspendUserRequest, UpdateClerkUserRoleRequest,
};
use crate::dto::config::ConfigResponse;
use crate::dto::content::{
    CreateLocalizationRequest, LocalizationResponse, UpdateLocalizationRequest,
};
use crate::dto::content_template::{
    ContentTemplateResponse, CreateContentTemplateRequest, PaginatedContentTemplates,
    UpdateContentTemplateRequest,
};
use crate::dto::cv::{
    CreateCvEntryRequest, CreateSkillRequest, CvEntryDetailResponse, CvEntryLocalizationInput,
    CvEntryLocalizationResponse, CvEntryResponse, PaginatedCvEntries, PaginatedSkills,
    ReorderCvEntriesRequest, SkillResponse, UpdateCvEntryRequest, UpdateSkillRequest,
};
use crate::dto::document::{
    AssignBlogDocumentRequest, CreateDocumentFolderRequest, CreateDocumentLocalizationRequest,
    CreateDocumentRequest, DocumentFolderResponse, DocumentListItem, DocumentLocalizationResponse,
    DocumentResponse, PaginatedDocuments, RemoveDocumentPrivacyRequest, SetDocumentPrivacyRequest,
    UpdateDocumentFolderRequest, UpdateDocumentLocalizationRequest, UpdateDocumentRequest,
    VerifyDocumentAccessRequest, VerifyDocumentAccessResponse,
};
use crate::dto::environment::EnvironmentResponse;
use crate::dto::error_codes::{ErrorCodeCatalogResponse, ErrorCodeEntry};
use crate::dto::favicon::{FaviconResponse, FaviconVariant};
use crate::dto::health::{HealthResponse, ServiceHealth, StorageHealth};
use crate::dto::help_state::{HelpStateResponse, UpdateHelpStateRequest};
use crate::dto::imprint::ImprintResponse;
use crate::dto::legal::{
    CreateLegalDocumentRequest, CreateLegalGroupRequest, CreateLegalItemRequest,
    LegalDocLocalizationResponse, LegalDocumentDetailResponse, LegalDocumentFullDetailResponse,
    LegalDocumentResponse, LegalDocumentWithGroups, LegalGroupResponse, LegalGroupWithItems,
    LegalItemResponse, LegalVersionResponse, PaginatedLegalDocuments, UpdateLegalDocumentRequest,
    UpdateLegalGroupRequest, UpdateLegalItemRequest,
};
use crate::dto::locale::{CreateLocaleRequest, LocaleResponse, UpdateLocaleRequest};
use crate::dto::media::{
    AddMediaMetadataRequest, MediaCategoryCounts, MediaListItem, MediaMetadataResponse,
    MediaResponse, MediaUsageResponse, MediaVariantResponse, PaginatedMedia,
    UpdateMediaMetadataRequest, UpdateMediaRequest, UploadMediaRequest,
};
use crate::dto::media_folder::{
    CreateMediaFolderRequest, MediaFolderResponse, UpdateMediaFolderRequest,
};
use crate::dto::media_tag::{
    MediaTagsResponse, SiteTagItem, SiteTagsResponse, UpdateMediaTagsRequest,
};
use crate::dto::navigation::{
    CreateNavigationItemRequest, NavigationItemLocalizationInput,
    NavigationItemLocalizationResponse, NavigationItemResponse, NavigationTree,
    ReorderNavigationItem, ReorderNavigationItemsRequest, ReorderNavigationTreeItem,
    ReorderNavigationTreeRequest, UpdateNavigationItemRequest,
};
use crate::dto::navigation_menu::{
    CreateNavigationMenuRequest, MenuLocalizationInput, MenuLocalizationResponse,
    NavigationMenuResponse, UpdateNavigationMenuRequest,
};
use crate::dto::notification::{
    BulkDeleteNotificationsRequest, MarkAllReadResponse, NotificationDeleteResponse,
    NotificationResponse, NotificationStatusCounts, PaginatedNotifications, UnreadCountResponse,
};
use crate::dto::onboarding::{CompleteOnboardingRequest, OnboardingResponse};
use crate::dto::onboarding_progress::{
    CompleteStepRequest, OnboardingProgressResponse, OnboardingStepResponse,
};
use crate::dto::page::{
    CreatePageRequest, CreatePageSectionRequest, PageDetailResponse, PageListItem, PageResponse,
    PageSectionResponse, PageStatusCounts, PaginatedPages, ReorderPageSectionsRequest,
    SectionLocalizationResponse, UpdatePageRequest, UpdatePageSectionRequest,
    UpsertSectionLocalizationRequest,
};
use crate::dto::project::{
    CreateProjectLinkRequest, CreateProjectLocalizationRequest, CreateProjectRequest,
    PaginatedProjects, ProjectDetailResponse, ProjectLinkResponse, ProjectLocalizationResponse,
    ProjectMediaRequest, ProjectMediaResponse, ProjectResponse, ReorderProjectsRequest,
    UpdateProjectRequest,
};
use crate::dto::redirect::{
    CreateRedirectRequest, PaginatedRedirects, RedirectLookupResponse, RedirectResponse,
    UpdateRedirectRequest,
};
use crate::dto::review::{ReviewActionRequest, ReviewActionResponse};
use crate::dto::site::{
    CreateSiteRequest, PreviewTokenResponse, ResetContentResponse, SiteContextFeatures,
    SiteContextIntegration, SiteContextModules, SiteContextResponse, SiteContextSuggestions,
    SiteExportJobResponse, SiteResponse, UpdateSiteRequest,
};
use crate::dto::site_locale::{AddSiteLocaleRequest, SiteLocaleResponse, UpdateSiteLocaleRequest};
use crate::dto::site_membership::{
    AddSiteMemberRequest, MembershipSummary, SiteMembershipResponse, TransferOwnershipRequest,
    UpdateMemberRoleRequest,
};
use crate::dto::site_settings::{
    PreviewTemplate, PublicSiteSettingsResponse, SiteOverviewEntry, SiteSettingsResponse,
    SiteStorageSummary, SitesOverviewResponse, StorageUsageResponse, SystemStorageOverviewResponse,
    UpdateSiteSettingsRequest,
};
use crate::dto::social::{
    CreateSocialLinkRequest, ReorderItem, ReorderSocialLinksRequest, SocialLinkResponse,
    UpdateSocialLinkRequest,
};
use crate::dto::taxonomy::{
    AssignCategoryRequest, AssignTagRequest, CategoryResponse, CategoryWithCountResponse,
    CreateCategoryRequest, CreateTagRequest, PaginatedCategories, PaginatedTags, TagResponse,
    UpdateCategoryRequest, UpdateTagRequest,
};
use crate::dto::trash::{TrashCountResponse, TrashItem, TrashListResponse};
use crate::dto::ui_strings::{
    CreateUiStringRequest, UiStringLocalizationInput, UiStringLocalizationResponse,
    UiStringResponse, UpdateUiStringRequest,
};
use crate::dto::user_preferences::{UpdateUserPreferencesRequest, UserPreferencesResponse};
use crate::dto::webhook::{
    CreateWebhookRequest, PaginatedWebhookDeliveries, PaginatedWebhooks, UpdateWebhookRequest,
    WebhookDeliveryResponse, WebhookEventStats, WebhookResponse, WebhookStatsResponse,
};
use crate::errors::ProblemDetails;
use crate::models::ai_usage::GroupBy as AiUsageGroupBy;
use crate::models::locale::TextDirection;
use crate::utils::pagination::PaginationMeta;

pub mod authorized_content;
pub mod extractors;
pub mod handlers;
pub mod middleware;
pub mod openapi_split;
pub mod workers;

/// Bare-bones top-level OpenAPI document. Per-route metadata is grafted on
/// by each handler bundle's `OpenApiRouter`; this struct supplies the
/// title, version, server URL, top-level tag list, and the schema
/// component table (every type referenced by `body = ...` in a
/// `#[utoipa::path]` must appear here, or utoipa drops it from the spec).
#[derive(OpenApi)]
#[openapi(
    info(
        title = "Forja Admin API",
        version = env!("CARGO_PKG_VERSION"),
        description = "Full administrative API surface for the Forja CMS — site management, content, media, RBAC, webhooks, and operational endpoints. Requires a Master/Admin/Write API key or a Clerk JWT. For the public read-only subset used by frontend templates, see the Consumer API doc.\n\nNaming conventions: all JSON response fields and query parameters use snake_case. Enum values use PascalCase. The only exception is the RFC 7807 Problem Details `type` field.",
        license(name = "AGPL-3.0-or-later", url = "https://www.gnu.org/licenses/agpl-3.0.html"),
        contact(name = "Forja Team", url = "https://github.com/dominikdorfstetter/forja")
    ),
    servers(
        (url = "/", description = "Forja API server")
    ),
    tags(
        (name = "System", description = "Health, configuration, and error code catalog"),
        (name = "Environments", description = "Site environment management"),
        (name = "Files", description = "Public file proxy for stored media"),
        (name = "Sites", description = "Site-scoped public assets and onboarding progress"),
        (name = "Locales", description = "Locale catalog (language codes and direction)"),
        (name = "Media", description = "Media folders (CRUD)"),
        (name = "Media Tags", description = "Per-file tags and per-site tag autocomplete"),
        (name = "Site Locales", description = "Per-site locale assignments"),
        (name = "Social Links", description = "Per-site social link CRUD and reorder"),
        (name = "Redirects", description = "Per-site URL redirects"),
        (name = "Notifications", description = "Per-user-per-site notifications inbox"),
        (name = "Audit", description = "Audit log + change-history reads and revert"),
        (name = "Analytics", description = "Privacy-first pageview tracking and reporting"),
        (name = "Content Templates", description = "Reusable content scaffolding"),
        (name = "Webhooks", description = "Outbound webhook config + delivery log + retries"),
        (name = "Navigation", description = "Navigation menus and items, with localizations"),
        (name = "Taxonomy", description = "Tags, categories, and content assignments"),
        (name = "Clerk Users", description = "Clerk user management and moderation actions"),
        (name = "Site Settings", description = "Per-site settings + system storage views"),
        (name = "Site Members", description = "Per-site membership CRUD and ownership transfer"),
        (name = "CV", description = "Skills and CV entries (work, education, certifications)"),
        (name = "Projects", description = "Portfolio project CRUD with public listing"),
        (name = "AI", description = "AI provider configuration and content generation"),
        (name = "Trash", description = "Soft-deleted content management (list, restore, permanent delete)"),
        (name = "API Keys", description = "API key management, quota tracking, and usage history"),
        (name = "Legal", description = "Legal documents, consent groups + items, versions, localizations"),
        (name = "Pages", description = "Page CRUD, sections, section localizations, content localizations"),
        (name = "Blogs", description = "Blog CRUD, public listing (paginated/featured/by-category/similar), RSS, review, bulk, samples"),
        (name = "Auth", description = "Self-service profile, preferences, onboarding, help state, GDPR export, demo guest token, account deletion"),
        (name = "Documents", description = "Document folders + CRUD, encryption with per-document password, password-prompt HTML page, localizations, blog attachments")
    ),
    components(
        schemas(
            HealthResponse,
            ServiceHealth,
            StorageHealth,
            ProblemDetails,
            ConfigResponse,
            ImprintResponse,
            EnvironmentResponse,
            ErrorCodeCatalogResponse,
            ErrorCodeEntry,
            CreateLocaleRequest,
            UpdateLocaleRequest,
            LocaleResponse,
            TextDirection,
            CreateMediaFolderRequest,
            UpdateMediaFolderRequest,
            MediaFolderResponse,
            UpdateMediaTagsRequest,
            MediaTagsResponse,
            SiteTagsResponse,
            SiteTagItem,
            CompleteStepRequest,
            OnboardingProgressResponse,
            OnboardingStepResponse,
            CreateSocialLinkRequest,
            UpdateSocialLinkRequest,
            ReorderSocialLinksRequest,
            ReorderItem,
            SocialLinkResponse,
            AddSiteLocaleRequest,
            UpdateSiteLocaleRequest,
            SiteLocaleResponse,
            CreateRedirectRequest,
            UpdateRedirectRequest,
            RedirectResponse,
            RedirectLookupResponse,
            PaginatedRedirects,
            PaginationMeta,
            BulkDeleteNotificationsRequest,
            MarkAllReadResponse,
            NotificationDeleteResponse,
            NotificationResponse,
            NotificationStatusCounts,
            PaginatedNotifications,
            UnreadCountResponse,
            AiUsageCount,
            AuditLogResponse,
            ChangeHistoryResponse,
            PaginatedAuditLogs,
            RevertChangesRequest,
            RevertChangesResponse,
            AnalyticsMaintenanceResponse,
            AnalyticsPageDetailResponse,
            AnalyticsReportResponse,
            ReferrerItem,
            TopContentItem,
            TrackPageviewRequest,
            TrackPageviewResponse,
            TrendDataPoint,
            ContentTemplateResponse,
            CreateContentTemplateRequest,
            PaginatedContentTemplates,
            UpdateContentTemplateRequest,
            CreateWebhookRequest,
            UpdateWebhookRequest,
            WebhookResponse,
            WebhookDeliveryResponse,
            WebhookStatsResponse,
            WebhookEventStats,
            PaginatedWebhooks,
            PaginatedWebhookDeliveries,
            CreateNavigationItemRequest,
            UpdateNavigationItemRequest,
            NavigationItemResponse,
            NavigationTree,
            NavigationItemLocalizationInput,
            NavigationItemLocalizationResponse,
            ReorderNavigationItem,
            ReorderNavigationItemsRequest,
            ReorderNavigationTreeItem,
            ReorderNavigationTreeRequest,
            CreateNavigationMenuRequest,
            UpdateNavigationMenuRequest,
            NavigationMenuResponse,
            MenuLocalizationInput,
            MenuLocalizationResponse,
            CreateTagRequest,
            UpdateTagRequest,
            TagResponse,
            CreateCategoryRequest,
            UpdateCategoryRequest,
            CategoryResponse,
            CategoryWithCountResponse,
            AssignCategoryRequest,
            AssignTagRequest,
            PaginatedTags,
            PaginatedCategories,
            BanUserRequest,
            ClerkUserListResponse,
            ClerkUserResponse,
            ModerationActionResponse,
            SuspendUserRequest,
            UpdateClerkUserRoleRequest,
            CreateSiteRequest,
            UpdateSiteRequest,
            SiteResponse,
            PreviewTokenResponse,
            ResetContentResponse,
            SiteExportJobResponse,
            SiteContextResponse,
            SiteContextFeatures,
            SiteContextSuggestions,
            SiteContextModules,
            SiteContextIntegration,
            SiteSettingsResponse,
            PublicSiteSettingsResponse,
            UpdateSiteSettingsRequest,
            StorageUsageResponse,
            SystemStorageOverviewResponse,
            SiteStorageSummary,
            SitesOverviewResponse,
            SiteOverviewEntry,
            PreviewTemplate,
            SiteMembershipResponse,
            AddSiteMemberRequest,
            UpdateMemberRoleRequest,
            TransferOwnershipRequest,
            MembershipSummary,
            CreateSkillRequest,
            UpdateSkillRequest,
            SkillResponse,
            PaginatedSkills,
            CreateCvEntryRequest,
            UpdateCvEntryRequest,
            CvEntryResponse,
            CvEntryDetailResponse,
            CvEntryLocalizationInput,
            CvEntryLocalizationResponse,
            PaginatedCvEntries,
            ReorderCvEntriesRequest,
            CreateProjectRequest,
            UpdateProjectRequest,
            ProjectResponse,
            ProjectDetailResponse,
            ProjectLinkResponse,
            ProjectMediaResponse,
            ProjectLocalizationResponse,
            CreateProjectLinkRequest,
            ProjectMediaRequest,
            CreateProjectLocalizationRequest,
            PaginatedProjects,
            ReorderProjectsRequest,
            ReviewActionRequest,
            ReviewActionResponse,
            BulkContentRequest,
            BulkContentResponse,
            BulkItemResult,
            AiConfigResponse,
            CreateAiConfigRequest,
            AiGenerateRequest,
            AiGenerateResponse,
            AiTestResponse,
            ListModelsRequest,
            ListModelsResponse,
            AiUsageResponse,
            AiUsageBucketResponse,
            AiUsageLogResponse,
            AiUsageGroupBy,
            TrashListResponse,
            TrashCountResponse,
            TrashItem,
            CreateApiKeyRequest,
            CreateApiKeyResponse,
            UpdateApiKeyRequest,
            BlockApiKeyRequest,
            ApiKeyResponse,
            ApiKeyListItem,
            ApiKeyUsageResponse,
            PaginatedApiKeys,
            UsageSummaryResponse,
            UsageSummaryQuota,
            UsageSummaryHistory,
            UsageSummaryTotals,
            DailyUsageSummary,
            QuotaWindowResponse,
            CreateLegalDocumentRequest,
            UpdateLegalDocumentRequest,
            CreateLegalGroupRequest,
            UpdateLegalGroupRequest,
            CreateLegalItemRequest,
            UpdateLegalItemRequest,
            LegalDocumentResponse,
            LegalGroupResponse,
            LegalItemResponse,
            LegalDocumentWithGroups,
            LegalGroupWithItems,
            LegalDocLocalizationResponse,
            LegalDocumentDetailResponse,
            LegalDocumentFullDetailResponse,
            LegalVersionResponse,
            PaginatedLegalDocuments,
            CreateLocalizationRequest,
            UpdateLocalizationRequest,
            LocalizationResponse,
            CreatePageRequest,
            UpdatePageRequest,
            CreatePageSectionRequest,
            UpdatePageSectionRequest,
            PageListItem,
            PageResponse,
            PageSectionResponse,
            SectionLocalizationResponse,
            UpsertSectionLocalizationRequest,
            ReorderPageSectionsRequest,
            PageDetailResponse,
            PageStatusCounts,
            PaginatedPages,
            CreateBlogRequest,
            UpdateBlogRequest,
            BlogListItem,
            BlogResponse,
            BlogDetailResponse,
            BlogStatusCounts,
            PaginatedBlogs,
            AuthInfoResponse,
            ProfileResponse,
            ExportApiKeyRecord,
            GuestTokenResponse,
            AuthoredContentSummary,
            UserDataExportResponse,
            UserPreferencesResponse,
            UpdateUserPreferencesRequest,
            CreateUiStringRequest,
            UpdateUiStringRequest,
            UiStringLocalizationInput,
            UiStringLocalizationResponse,
            UiStringResponse,
            OnboardingResponse,
            CompleteOnboardingRequest,
            HelpStateResponse,
            UpdateHelpStateRequest,
            CreateDocumentFolderRequest,
            UpdateDocumentFolderRequest,
            DocumentFolderResponse,
            CreateDocumentRequest,
            UpdateDocumentRequest,
            DocumentResponse,
            DocumentListItem,
            CreateDocumentLocalizationRequest,
            UpdateDocumentLocalizationRequest,
            DocumentLocalizationResponse,
            AssignBlogDocumentRequest,
            SetDocumentPrivacyRequest,
            RemoveDocumentPrivacyRequest,
            VerifyDocumentAccessRequest,
            VerifyDocumentAccessResponse,
            PaginatedDocuments,
            FaviconResponse,
            FaviconVariant,
            UploadMediaRequest,
            UpdateMediaRequest,
            AddMediaMetadataRequest,
            UpdateMediaMetadataRequest,
            MediaMetadataResponse,
            MediaListItem,
            MediaVariantResponse,
            MediaResponse,
            MediaCategoryCounts,
            MediaUsageResponse,
            PaginatedMedia
        )
    )
)]
pub struct AxumApiDoc;

/// Assemble the full OpenAPI document — the same one mounted at
/// `/api-docs/openapi.json` — without spinning up a server or `AppState`.
///
/// Used by the `dump-openapi` bin target (issue #623 Slice 1) so admin
/// codegen can read the spec offline. Mirrors the merge tree in
/// `build_router`; if a new handler bundle is added there, add it here too.
pub fn build_full_openapi() -> utoipa::openapi::OpenApi {
    let (_router, api) = OpenApiRouter::<AppState>::with_openapi(AxumApiDoc::openapi())
        .merge(handlers::system::router())
        .merge(handlers::files::router())
        .nest(API_MOUNT_PREFIX, handlers::api_v1_router())
        .split_for_parts();
    api
}

/// Build the root Axum router with all migrated routes mounted plus the
/// `/api-docs/...` Swagger UI surface and the `/api-docs/openapi.json` spec.
///
/// As Phase 4 ports handler bundles, each one returns its own
/// `OpenApiRouter` that gets `.merge(...)`-ed in here. The final
/// `split_for_parts` collapses the whole tree into a single OpenApi doc
/// plus a state-typed `Router` ready for `axum::serve`.
pub fn build_router(state: AppState) -> Router {
    let (router, api) = OpenApiRouter::with_openapi(AxumApiDoc::openapi())
        .merge(handlers::system::router())
        .merge(handlers::files::router())
        .nest(API_MOUNT_PREFIX, handlers::api_v1_router())
        .split_for_parts();

    // Plain (non-OpenAPI) routes — HTML surfaces (dashboard SPA, gated admin
    // Swagger UI) that don't appear in the JSON OpenAPI document. Merged
    // post-`split_for_parts` so utoipa never sees them.
    // The admin Swagger UI serves the **full post-split_for_parts spec**
    // — this is the auto-collected document that contains every path
    // discovered from `routes!()` macros. The bare `AxumApiDoc::openapi()`
    // is just the derive output (schemas + tags, no paths), so the
    // admin handler can't reach for that. Clone here so we can hand one
    // copy to the consumer filter (consuming) and stash another on a
    // request Extension for the gated admin endpoint.
    let admin_api = std::sync::Arc::new(api.clone());
    let consumer_api = openapi_split::build_consumer_openapi(api);
    router
        .nest("/dashboard", handlers::dashboard::router())
        .merge(handlers::docs::router())
        .merge(
            SwaggerUi::new("/api-docs/consumer")
                .url("/api-docs/consumer/openapi.json", consumer_api),
        )
        .layer(axum::Extension(admin_api))
        .fallback(middleware::not_found::handler)
        .layer(axum::middleware::from_fn(
            middleware::security_headers::layer,
        ))
        .layer(axum::middleware::from_fn(
            middleware::rate_limit_headers::layer,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            middleware::public_rate_limit::layer,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            middleware::auth_rate_limit::layer,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            middleware::cors::layer,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            middleware::usage_tracking::layer,
        ))
        // Observability trio — outermost. Order matters: SetRequestIdLayer is
        // listed last so axum applies it outermost, guaranteeing every other
        // layer (rate-limit, cors, handlers) runs inside a span that already
        // carries the request_id.
        .layer(axum::middleware::from_fn(http_request_layer))
        .layer(PropagateRequestIdLayer::x_request_id())
        .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
        .with_state(state)
}

/// Request threshold above which the access log fires at WARN instead of INFO.
const SLOW_REQUEST_MS: u64 = 1_000;

/// Owns the `http_request` span lifecycle for every incoming request. Wraps the
/// downstream handler chain in the span, records `status` and `latency_ms` on
/// the way back, and emits one access-log line per request (skipping healthy
/// `/health` probes to avoid drowning the log in noise). Slow requests
/// (`latency_ms > SLOW_REQUEST_MS`) emit at WARN so they show up in any
/// "errors and warnings" filter without needing a dedicated query.
async fn http_request_layer(req: Request, next: Next) -> Response {
    let request_id = req
        .headers()
        .get(HeaderName::from_static("x-request-id"))
        .and_then(|v| v.to_str().ok())
        .unwrap_or("-")
        .to_string();
    let method = req.method().clone();
    let path = req.uri().path().to_string();

    let span = tracing::info_span!(
        "http_request",
        request_id = %request_id,
        method = %method,
        path = %path,
        status = Empty,
        latency_ms = Empty,
    );

    let start = std::time::Instant::now();
    let response = next.run(req).instrument(span.clone()).await;
    let elapsed_ms = start.elapsed().as_millis() as u64;
    let status = response.status().as_u16();
    span.record("status", status);
    span.record("latency_ms", elapsed_ms);

    let is_healthy_probe =
        matches!(path.as_str(), "/health" | "/api/v1/health") && (200..300).contains(&status);

    if !is_healthy_probe {
        let _enter = span.enter();
        if elapsed_ms > SLOW_REQUEST_MS {
            tracing::warn!(slow = true, "request completed");
        } else {
            tracing::info!("request completed");
        }
    }

    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    /// Build the OpenAPI document the same way `build_router` does, but
    /// without binding state — sufficient for asserting on `paths` /
    /// `components` shape.
    fn build_openapi_doc() -> serde_json::Value {
        let (_router, api) = OpenApiRouter::<AppState>::with_openapi(AxumApiDoc::openapi())
            .merge(handlers::system::router())
            .merge(handlers::files::router())
            .nest(API_MOUNT_PREFIX, handlers::api_v1_router())
            .split_for_parts();
        serde_json::to_value(&api).expect("openapi serializes")
    }

    #[tokio::test]
    async fn openapi_lists_root_paths() {
        let doc = build_openapi_doc();
        for path in ["/", "/health", "/health/detailed", "/files/{*path}"] {
            assert!(
                doc["paths"][path].is_object(),
                "expected {path} entry in openapi.json, got: {doc}"
            );
        }
    }

    /// Verifies `nest("/api/v1", ...)` propagates the prefix into both
    /// the route table AND the OpenAPI doc — that's the entire reason
    /// `utoipa-axum` exists vs. plain axum, so it's worth asserting once.
    #[tokio::test]
    async fn openapi_lists_api_v1_paths_with_prefix() {
        let doc = build_openapi_doc();
        for path in [
            "/api/v1/error-codes",
            "/api/v1/config",
            "/api/v1/environments",
            "/api/v1/environments/default",
            "/api/v1/environments/{id}",
            "/api/v1/sites/{slug}/robots.txt",
            "/api/v1/sites/{slug}/sitemap.xml",
            "/api/v1/locales",
            "/api/v1/locales/by-code/{code}",
            "/api/v1/locales/{id}",
            "/api/v1/sites/{site_id}/media-folders",
            "/api/v1/media-folders/{id}",
            "/api/v1/media/{id}/tags",
            "/api/v1/sites/{site_id}/media-tags",
            "/api/v1/sites/{site_id}/onboarding-progress",
            "/api/v1/sites/{site_id}/social",
            "/api/v1/sites/{site_id}/social/reorder",
            "/api/v1/social/{id}",
            "/api/v1/sites/{site_id}/locales",
            "/api/v1/sites/{site_id}/locales/{locale_id}",
            "/api/v1/sites/{site_id}/locales/{locale_id}/default",
            "/api/v1/sites/{site_id}/redirects",
            "/api/v1/sites/{site_id}/redirects/lookup",
            "/api/v1/redirects/{id}",
            "/api/v1/sites/{site_id}/notifications",
            "/api/v1/sites/{site_id}/notifications/unread-count",
            "/api/v1/sites/{site_id}/notifications/status-counts",
            "/api/v1/sites/{site_id}/notifications/read-all",
            "/api/v1/sites/{site_id}/notifications/read",
            "/api/v1/sites/{site_id}/notifications/bulk-delete",
            "/api/v1/notifications/{id}",
            "/api/v1/notifications/{id}/read",
            "/api/v1/sites/{site_id}/audit",
            "/api/v1/sites/{site_id}/audit/ai-usage",
            "/api/v1/audit/entity/{entity_type}/{entity_id}",
            "/api/v1/audit/history/{entity_type}/{entity_id}",
            "/api/v1/audit/history/revert",
            "/api/v1/audit/user/{clerk_user_id}",
            "/api/v1/sites/{site_id}/analytics/pageview",
            "/api/v1/sites/{site_id}/analytics/report",
            "/api/v1/sites/{site_id}/analytics/aggregate",
            "/api/v1/sites/{site_id}/analytics/report/page",
            "/api/v1/sites/{site_id}/content-templates",
            "/api/v1/content-templates/{id}",
            "/api/v1/sites/{site_id}/webhooks",
            "/api/v1/webhooks/{id}",
            "/api/v1/webhooks/{id}/test",
            "/api/v1/webhooks/{id}/deliveries",
            "/api/v1/webhooks/{id}/stats",
            "/api/v1/webhooks/deliveries/{id}/retry",
            "/api/v1/sites/{site_id}/menus",
            "/api/v1/sites/{site_id}/menus/slug/{slug}",
            "/api/v1/menus/{id}",
            "/api/v1/menus/{menu_id}/tree",
            "/api/v1/menus/{menu_id}/items",
            "/api/v1/menus/{menu_id}/items/reorder",
            "/api/v1/sites/{site_id}/navigation",
            "/api/v1/sites/{site_id}/navigation/reorder",
            "/api/v1/navigation/{id}",
            "/api/v1/navigation/{parent_id}/children",
            "/api/v1/navigation/{id}/localizations",
            "/api/v1/sites/{site_id}/tags",
            "/api/v1/tags",
            "/api/v1/tags/{id}",
            "/api/v1/tags/by-slug/{slug}",
            "/api/v1/sites/{site_id}/categories",
            "/api/v1/sites/{site_id}/categories/blog-counts",
            "/api/v1/categories",
            "/api/v1/categories/{id}",
            "/api/v1/categories/{parent_id}/children",
            "/api/v1/content/{content_id}/tags",
            "/api/v1/content/{content_id}/categories",
            "/api/v1/content/{content_id}/categories/{category_id}",
            "/api/v1/clerk/users",
            "/api/v1/clerk/users/{id}",
            "/api/v1/clerk/users/{id}/role",
            "/api/v1/admin/users/{clerk_user_id}",
            "/api/v1/admin/users/{clerk_user_id}/suspend",
            "/api/v1/admin/users/{clerk_user_id}/ban",
            "/api/v1/admin/users/{clerk_user_id}/unsuspend",
            "/api/v1/sites",
            "/api/v1/sites/{id}",
            "/api/v1/sites/by-slug/{slug}",
            "/api/v1/sites/{site_id}/context",
            "/api/v1/sites/{site_id}/preview-token",
            "/api/v1/sites/{site_id}/settings",
            "/api/v1/sites/{site_id}/storage",
            "/api/v1/admin/storage",
            "/api/v1/admin/sites/overview",
            "/api/v1/sites/{site_id}/members",
            "/api/v1/sites/{site_id}/members/{member_id}",
            "/api/v1/sites/{site_id}/members/{member_id}/role",
            "/api/v1/sites/{site_id}/transfer-ownership",
            "/api/v1/sites/{site_id}/leave",
            "/api/v1/my/memberships",
            "/api/v1/sites/{site_id}/skills",
            "/api/v1/sites/{site_id}/skills/bulk",
            "/api/v1/skills",
            "/api/v1/skills/{id}",
            "/api/v1/skills/by-slug/{slug}",
            "/api/v1/sites/{site_id}/cv",
            "/api/v1/sites/{site_id}/cv/bulk",
            "/api/v1/sites/{site_id}/cv/reorder",
            "/api/v1/cv",
            "/api/v1/cv/{id}",
            "/api/v1/cv/{id}/review",
            "/api/v1/sites/{site_id}/projects",
            "/api/v1/sites/{site_id}/projects/public",
            "/api/v1/sites/{site_id}/projects/bulk",
            "/api/v1/sites/{site_id}/projects/reorder",
            "/api/v1/sites/{site_id}/projects/by-slug/{slug}",
            "/api/v1/projects",
            "/api/v1/projects/{id}",
            "/api/v1/projects/{id}/review",
            "/api/v1/sites/{site_id}/ai/config",
            "/api/v1/sites/{site_id}/ai/test",
            "/api/v1/sites/{site_id}/ai/generate",
            "/api/v1/sites/{site_id}/ai/models",
            "/api/v1/sites/{site_id}/trash",
            "/api/v1/sites/{site_id}/trash/count",
            "/api/v1/trash/{id}",
            "/api/v1/trash/{id}/restore",
            "/api/v1/api-keys",
            "/api/v1/api-keys/{id}",
            "/api/v1/api-keys/{id}/block",
            "/api/v1/api-keys/{id}/unblock",
            "/api/v1/api-keys/{id}/revoke",
            "/api/v1/api-keys/{id}/usage",
            "/api/v1/api-keys/{id}/usage/summary",
            "/api/v1/sites/{site_id}/legal",
            "/api/v1/sites/{site_id}/legal/cookie-consent",
            "/api/v1/sites/{site_id}/legal/by-slug/{slug}",
            "/api/v1/legal/{id}",
            "/api/v1/legal/{id}/clone",
            "/api/v1/legal/{id}/detail",
            "/api/v1/legal/{id}/versions",
            "/api/v1/legal/{id}/new-version",
            "/api/v1/legal/{id}/localizations",
            "/api/v1/legal/{document_id}/groups",
            "/api/v1/legal/groups/{id}",
            "/api/v1/legal/groups/{group_id}/items",
            "/api/v1/legal/items/{id}",
            "/api/v1/legal/localizations/{loc_id}",
            "/api/v1/sites/{site_id}/pages",
            "/api/v1/sites/{site_id}/pages/by-route/{route}",
            "/api/v1/sites/{site_id}/pages/bulk",
            "/api/v1/sites/{site_id}/pages/status-counts",
            "/api/v1/pages",
            "/api/v1/pages/{id}",
            "/api/v1/pages/{id}/clone",
            "/api/v1/pages/{id}/detail",
            "/api/v1/pages/{id}/review",
            "/api/v1/pages/{id}/sections",
            "/api/v1/pages/{id}/sections/reorder",
            "/api/v1/pages/{id}/sections/localizations",
            "/api/v1/pages/{id}/localizations",
            "/api/v1/pages/sections/{id}",
            "/api/v1/pages/sections/{id}/localizations",
            "/api/v1/pages/sections/localizations/{id}",
            "/api/v1/pages/localizations/{id}",
            "/api/v1/sites/{site_id}/blogs",
            "/api/v1/sites/{site_id}/blogs/published",
            "/api/v1/sites/{site_id}/blogs/published/category/{category_slug}",
            "/api/v1/sites/{site_id}/blogs/featured",
            "/api/v1/sites/{site_id}/blogs/{id}/similar",
            "/api/v1/sites/{site_id}/blogs/by-slug/{slug}",
            "/api/v1/sites/{site_id}/blogs/bulk",
            "/api/v1/sites/{site_id}/blogs/seed",
            "/api/v1/sites/{site_id}/blogs/samples",
            "/api/v1/sites/{site_id}/blogs/status-counts",
            "/api/v1/sites/{site_id}/feed.rss",
            "/api/v1/blogs",
            "/api/v1/blogs/{id}",
            "/api/v1/blogs/{id}/clone",
            "/api/v1/blogs/{id}/review",
            "/api/v1/blogs/{id}/detail",
            "/api/v1/blogs/{id}/localizations",
            "/api/v1/blogs/localizations/{id}",
            "/api/v1/auth/me",
            "/api/v1/auth/profile",
            "/api/v1/auth/preferences",
            "/api/v1/auth/onboarding",
            "/api/v1/auth/help-state",
            "/api/v1/auth/help-state/reset",
            "/api/v1/auth/export",
            "/api/v1/auth/account",
            "/api/v1/auth/guest",
            "/api/v1/sites/{site_id}/document-folders",
            "/api/v1/document-folders/{id}",
            "/api/v1/sites/{site_id}/documents",
            "/api/v1/documents/{id}",
            "/api/v1/documents/{id}/download",
            "/api/v1/documents/{id}/verify-access",
            "/api/v1/documents/{id}/privacy",
            "/api/v1/documents/{id}/localizations",
            "/api/v1/documents/localizations/{id}",
            "/api/v1/blogs/{blog_id}/documents",
            "/api/v1/blogs/{blog_id}/documents/{doc_id}",
            "/api/v1/sites/{site_id}/favicon",
            "/api/v1/sites/{site_id}/favicon/download",
            "/api/v1/sites/{slug}/site.webmanifest",
            "/api/v1/sites/{slug}/browserconfig.xml",
            "/api/v1/sites/{site_id}/media",
            "/api/v1/sites/{site_id}/media/category-counts",
            "/api/v1/media",
            "/api/v1/media/upload",
            "/api/v1/media/{id}",
            "/api/v1/media/{id}/usage",
            "/api/v1/media/{id}/metadata",
            "/api/v1/media/metadata/{metadata_id}",
        ] {
            assert!(
                doc["paths"][path].is_object(),
                "expected {path} entry in openapi.json, got: {doc}"
            );
        }
    }

    #[tokio::test]
    async fn openapi_tags_health_under_system() {
        let doc = build_openapi_doc();
        let tags = &doc["paths"]["/health"]["get"]["tags"];
        assert!(
            tags.as_array()
                .is_some_and(|arr| arr.iter().any(|t| t == "System")),
            "expected /health GET to be tagged System, got tags: {tags}"
        );
    }

    #[tokio::test]
    async fn openapi_tags_environment_under_environments() {
        let doc = build_openapi_doc();
        let tags = &doc["paths"]["/api/v1/environments"]["get"]["tags"];
        assert!(
            tags.as_array()
                .is_some_and(|arr| arr.iter().any(|t| t == "Environments")),
            "expected /api/v1/environments GET to be tagged Environments, got tags: {tags}"
        );
    }

    #[tokio::test]
    async fn openapi_registers_all_phase4_schemas() {
        let doc = build_openapi_doc();
        for schema in [
            "HealthResponse",
            "ServiceHealth",
            "StorageHealth",
            "ConfigResponse",
            "EnvironmentResponse",
            "ErrorCodeCatalogResponse",
            "ErrorCodeEntry",
            "CreateLocaleRequest",
            "UpdateLocaleRequest",
            "LocaleResponse",
            "TextDirection",
            "CreateMediaFolderRequest",
            "UpdateMediaFolderRequest",
            "MediaFolderResponse",
            "UpdateMediaTagsRequest",
            "MediaTagsResponse",
            "SiteTagsResponse",
            "SiteTagItem",
            "CompleteStepRequest",
            "OnboardingProgressResponse",
            "OnboardingStepResponse",
            "CreateSocialLinkRequest",
            "UpdateSocialLinkRequest",
            "ReorderSocialLinksRequest",
            "SocialLinkResponse",
            "AddSiteLocaleRequest",
            "UpdateSiteLocaleRequest",
            "SiteLocaleResponse",
            "CreateRedirectRequest",
            "UpdateRedirectRequest",
            "RedirectResponse",
            "RedirectLookupResponse",
            "PaginationMeta",
            // `Paginated<T>` collapses to a single schema named "Paginated"
            // in the spec — utoipa generic aliases don't produce
            // per-instantiation entries. Asserting once is sufficient.
            "Paginated",
            "NotificationResponse",
            "AuditLogResponse",
            "RevertChangesRequest",
            "RevertChangesResponse",
            "AnalyticsReportResponse",
            "TrackPageviewRequest",
            "ContentTemplateResponse",
        ] {
            assert!(
                doc["components"]["schemas"][schema].is_object(),
                "expected {schema} in components.schemas, got: {doc}"
            );
        }
    }

    /// Sanity check that the swagger spec is reachable through an HTTP
    /// roundtrip — catches misconfigured `SwaggerUi::url(...)` paths.
    #[tokio::test]
    async fn openapi_json_endpoint_responds_200() {
        let (router, api) =
            OpenApiRouter::<()>::with_openapi(AxumApiDoc::openapi()).split_for_parts();
        let router: Router = router.merge(
            SwaggerUi::new("/api-docs/consumer").url("/api-docs/consumer/openapi.json", api),
        );

        let response = router
            .oneshot(
                Request::builder()
                    .uri("/api-docs/consumer/openapi.json")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    // ── Observability trio: SetRequestId + Propagate + http_request_layer ───
    //
    // These tests exercise the same layer stack `build_router` installs,
    // but against a minimal stateless router so they don't need AppState.

    fn observability_app() -> Router {
        async fn ok() -> StatusCode {
            StatusCode::OK
        }
        Router::new()
            .route("/test", axum::routing::get(ok))
            .layer(axum::middleware::from_fn(http_request_layer))
            .layer(PropagateRequestIdLayer::x_request_id())
            .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
    }

    #[tokio::test]
    async fn generates_uuid_when_request_lacks_request_id() {
        let resp = observability_app()
            .oneshot(Request::builder().uri("/test").body(Body::empty()).unwrap())
            .await
            .unwrap();

        let id = resp
            .headers()
            .get("x-request-id")
            .expect("response should carry x-request-id")
            .to_str()
            .unwrap();
        // MakeRequestUuid emits a hyphenated UUIDv4 — 36 chars.
        assert_eq!(id.len(), 36, "expected UUID, got: {id}");
        assert_eq!(id.matches('-').count(), 4);
    }

    #[tokio::test]
    async fn echoes_inbound_request_id_unchanged() {
        let resp = observability_app()
            .oneshot(
                Request::builder()
                    .uri("/test")
                    .header("x-request-id", "client-supplied-id")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(
            resp.headers()
                .get("x-request-id")
                .unwrap()
                .to_str()
                .unwrap(),
            "client-supplied-id"
        );
    }
}
