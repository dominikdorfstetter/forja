//! Axum port of `crate::handlers::site`. Eight endpoints for the site
//! domain — list, get-by-id, get-by-slug, create, update, delete, plus
//! adaptive-UI context and short-lived preview tokens.

use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::{header, Response, StatusCode};
use axum::response::Json;
use chrono::Utc;
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::dto::site::{
    should_show_team_workflow_prompt, CreateSiteRequest, PreviewTokenResponse,
    ResetContentResponse, SiteContextFeatures, SiteContextIntegration, SiteContextModules,
    SiteContextResponse, SiteContextSuggestions, SiteExportJobResponse, SiteResponse,
    UpdateSiteRequest,
};
use crate::dto::validated::ValidatedJson;
use crate::errors::{codes, ApiError, ProblemDetails};
use crate::guards::actor::Actor;
use crate::guards::auth_guard::ReadKey;
use crate::models::audit::AuditAction;
use crate::models::locale::Locale;
use crate::models::site::Site;
use crate::models::site_export::{SiteExportJob, SiteExportStatus};
use crate::models::site_locale::SiteLocale;
use crate::models::site_membership::{SiteMembership, SiteRole};
use crate::models::site_settings::{
    SiteSetting, KEY_BACKGROUND_COLOR, KEY_CODE_INJECTION_FOOTER, KEY_CODE_INJECTION_HEAD,
    KEY_MODULE_AI_ENABLED, KEY_MODULE_BLOG_ENABLED, KEY_MODULE_COLLECTIONS_ENABLED,
    KEY_MODULE_DOCUMENTS_ENABLED, KEY_MODULE_FORMS_ENABLED, KEY_MODULE_LEGAL_ENABLED,
    KEY_MODULE_PAGES_ENABLED, KEY_MODULE_PORTFOLIO_ENABLED, KEY_SEO_DEFAULT_DESCRIPTION,
    KEY_SEO_TITLE_TEMPLATE, KEY_THEME_COLOR,
};
use crate::services::audited_mutation::AuditedEntity;
use crate::services::permission_service::{Permission, PermissionService};
use crate::AppState;

#[utoipa::path(
    get,
    path = "/sites",
    tag = "Sites",
    operation_id = "list_sites",
    description = "List all active sites (filtered by membership or API key scope)",
    responses(
        (status = 200, description = "List of sites", body = Vec<SiteResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn list_sites(
    State(state): State<AppState>,
    auth: ReadKey,
) -> Result<Json<Vec<SiteResponse>>, ApiError> {
    match &auth.0.kind {
        crate::guards::actor::ActorKind::Clerk { clerk_user_id } => {
            if SiteMembership::is_system_admin(&state.db, clerk_user_id).await? {
                let sites = Site::find_all(&state.db).await?;
                return Ok(Json(sites.into_iter().map(SiteResponse::from).collect()));
            }
            let memberships =
                SiteMembership::find_all_for_clerk_user(&state.db, clerk_user_id).await?;
            let site_ids: Vec<Uuid> = memberships.iter().map(|m| m.site_id).collect();
            let sites = Site::find_all(&state.db).await?;
            let responses: Vec<SiteResponse> = sites
                .into_iter()
                .filter(|s| site_ids.contains(&s.id))
                .map(SiteResponse::from)
                .collect();
            Ok(Json(responses))
        }
        crate::guards::actor::ActorKind::ApiKey { .. }
        | crate::guards::actor::ActorKind::Preview { .. } => {
            let sites = Site::find_all(&state.db).await?;
            let responses: Vec<SiteResponse> = sites
                .into_iter()
                .map(SiteResponse::from)
                .filter(|s| auth.0.has_site_access(s.id))
                .collect();
            Ok(Json(responses))
        }
    }
}

#[utoipa::path(
    get,
    path = "/sites/{id}",
    tag = "Sites",
    operation_id = "get_site",
    description = "Get a site by its ID",
    params(("id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Site details", body = SiteResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn get_site(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<SiteResponse>, ApiError> {
    PermissionService::require(&state.db, &auth.0, id, &Permission::new("site", "read")).await?;
    let site = Site::find_by_id(&state.db, id).await?;
    Ok(Json(SiteResponse::from(site)))
}

#[utoipa::path(
    get,
    path = "/sites/by-slug/{slug}",
    tag = "Sites",
    operation_id = "get_site_by_slug",
    description = "Get a site by its slug",
    params(("slug" = String, Path, description = "URL-friendly site identifier (lowercase, hyphens only)")),
    responses(
        (status = 200, description = "Site details", body = SiteResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn get_site_by_slug(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    auth: ReadKey,
) -> Result<Json<SiteResponse>, ApiError> {
    let site = Site::find_by_slug(&state.db, &slug).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        site.id,
        &Permission::new("site", "read"),
    )
    .await?;
    Ok(Json(SiteResponse::from(site)))
}

#[utoipa::path(
    post,
    path = "/sites",
    tag = "Sites",
    operation_id = "create_site",
    description = "Create a new site. Clerk users become the site owner automatically.",
    request_body(content = CreateSiteRequest, description = "Site creation data"),
    responses(
        (status = 201, description = "Site created", body = SiteResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn create_site(
    State(state): State<AppState>,
    auth: Actor,
    ValidatedJson(request): ValidatedJson<CreateSiteRequest>,
) -> Result<(StatusCode, Json<SiteResponse>), ApiError> {
    let request = request.into_inner();
    let locales = request.locales.clone();

    if let Some(ref locale_inputs) = locales {
        let default_count = locale_inputs.iter().filter(|l| l.is_default).count();
        if default_count != 1 {
            return Err(
                ApiError::bad_request("Exactly one locale must be marked as default")
                    .with_code(codes::SITE_CREATE_INVALID_LOCALES),
            );
        }
        for input in locale_inputs {
            Locale::find_by_id(&state.db, input.locale_id).await?;
        }
    }

    let bulk_insert_locales =
        |db: sqlx::PgPool, site_id: Uuid, inputs: Vec<crate::dto::site_locale::SiteLocaleInput>| async move {
            let tuples: Vec<(uuid::Uuid, bool, Option<String>)> = inputs
                .into_iter()
                .map(|l| (l.locale_id, l.is_default, l.url_prefix))
                .collect();
            SiteLocale::bulk_insert(&db, site_id, &tuples).await
        };

    match &auth.kind {
        crate::guards::actor::ActorKind::Clerk { clerk_user_id } => {
            let site = Site::create(&state.db, request, Some(clerk_user_id)).await?;
            SiteMembership::create(&state.db, clerk_user_id, site.id, &SiteRole::Owner, None)
                .await?;

            if let Some(locale_inputs) = locales {
                bulk_insert_locales(state.db.clone(), site.id, locale_inputs).await?;
            }

            AuditedEntity::audit_only("site")
                .mutate(AuditAction::Create, site.id)
                .site(site.id)
                .actor(auth.id)
                .execute(&state.db)
                .await;
            Ok((StatusCode::CREATED, Json(SiteResponse::from(site))))
        }
        crate::guards::actor::ActorKind::ApiKey { .. }
        | crate::guards::actor::ActorKind::Preview { .. } => {
            if !auth.is_admin() {
                return Err(
                    ApiError::forbidden("Admin API key required to create sites")
                        .with_code(codes::SITE_CREATE_REQUIRES_ADMIN),
                );
            }
            if auth.is_site_scoped() {
                return Err(
                    ApiError::forbidden("Site-scoped API keys cannot create new sites")
                        .with_code(codes::SITE_CREATE_SCOPED_KEY),
                );
            }
            let site = Site::create(&state.db, request, None).await?;

            if let Some(locale_inputs) = locales {
                bulk_insert_locales(state.db.clone(), site.id, locale_inputs).await?;
            }

            AuditedEntity::audit_only("site")
                .mutate(AuditAction::Create, site.id)
                .site(site.id)
                .actor(auth.id)
                .execute(&state.db)
                .await;
            Ok((StatusCode::CREATED, Json(SiteResponse::from(site))))
        }
    }
}

#[utoipa::path(
    put,
    path = "/sites/{id}",
    tag = "Sites",
    operation_id = "update_site",
    description = "Update an existing site",
    params(("id" = Uuid, Path, description = "Site UUID")),
    request_body(content = UpdateSiteRequest, description = "Site update data"),
    responses(
        (status = 200, description = "Site updated", body = SiteResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn update_site(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: Actor,
    ValidatedJson(request): ValidatedJson<UpdateSiteRequest>,
) -> Result<Json<SiteResponse>, ApiError> {
    PermissionService::require(&state.db, &auth, id, &Permission::new("site", "update")).await?;
    let existing = Site::find_by_id(&state.db, id).await?;
    let old = serde_json::to_value(&existing).ok();
    let site = Site::update(&state.db, id, request.into_inner()).await?;
    let change_diff = match (old, serde_json::to_value(&site)) {
        (Some(old), Ok(new)) => Some((old, new)),
        _ => None,
    };
    AuditedEntity::audit_only("site")
        .mutate(AuditAction::Update, id)
        .site(id)
        .actor(auth.id)
        .maybe_diff(change_diff)
        .execute(&state.db)
        .await;
    Ok(Json(SiteResponse::from(site)))
}

#[utoipa::path(
    delete,
    path = "/sites/{id}",
    tag = "Sites",
    operation_id = "delete_site",
    description = "Soft delete a site",
    params(("id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 204, description = "Site deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn delete_site(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: Actor,
) -> Result<StatusCode, ApiError> {
    PermissionService::require(&state.db, &auth, id, &Permission::new("site", "delete")).await?;
    Site::soft_delete(&state.db, id).await?;
    AuditedEntity::audit_only("site")
        .mutate(AuditAction::Delete, id)
        .site(id)
        .actor(auth.id)
        .execute(&state.db)
        .await;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/context",
    tag = "Sites",
    operation_id = "get_site_context",
    description = "Returns site context for adaptive UI — member count, current user role, feature flags, and suggestions",
    params(("site_id" = Uuid, Path, description = "The UUID of the site")),
    responses(
        (status = 200, description = "Site context", body = SiteContextResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn get_site_context(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<SiteContextResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("site", "read"),
    )
    .await?;

    let member_count = SiteMembership::count_for_site(&state.db, site_id).await?;

    let role = auth
        .0
        .effective_site_role(&state.db, site_id)
        .await?
        .unwrap_or(SiteRole::Viewer);
    let current_user_role = format!("{:?}", role).to_lowercase();

    let settings = SiteSetting::get_effective_settings(&state.db, site_id).await?;

    let editorial_workflow = settings
        .get("editorial_workflow_enabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let scheduling = settings
        .get("scheduling_enabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
    let versioning = settings
        .get("versioning_enabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
    let analytics = settings
        .get("analytics_enabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let prompt_dismissed = settings
        .get("team_features_prompt_dismissed")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let module_blog = settings
        .get(KEY_MODULE_BLOG_ENABLED)
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
    let module_pages = settings
        .get(KEY_MODULE_PAGES_ENABLED)
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
    let module_portfolio = settings
        .get(KEY_MODULE_PORTFOLIO_ENABLED)
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let module_legal = settings
        .get(KEY_MODULE_LEGAL_ENABLED)
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let module_documents = settings
        .get(KEY_MODULE_DOCUMENTS_ENABLED)
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let module_ai = settings
        .get(KEY_MODULE_AI_ENABLED)
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let module_forms = settings
        .get(KEY_MODULE_FORMS_ENABLED)
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let module_collections = settings
        .get(KEY_MODULE_COLLECTIONS_ENABLED)
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let code_injection_head = settings
        .get(KEY_CODE_INJECTION_HEAD)
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let code_injection_footer = settings
        .get(KEY_CODE_INJECTION_FOOTER)
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let seo_title_template = settings
        .get(KEY_SEO_TITLE_TEMPLATE)
        .and_then(|v| v.as_str())
        .unwrap_or("{{title}} | {{site_name}}")
        .to_string();
    let seo_default_description = settings
        .get(KEY_SEO_DEFAULT_DESCRIPTION)
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let theme_color = settings
        .get(KEY_THEME_COLOR)
        .and_then(|v| v.as_str())
        .unwrap_or("#ffffff")
        .to_string();
    let background_color = settings
        .get(KEY_BACKGROUND_COLOR)
        .and_then(|v| v.as_str())
        .unwrap_or("#ffffff")
        .to_string();

    Ok(Json(SiteContextResponse {
        member_count,
        current_user_role,
        features: SiteContextFeatures {
            editorial_workflow,
            scheduling,
            versioning,
            analytics,
        },
        suggestions: SiteContextSuggestions {
            show_team_workflow_prompt: should_show_team_workflow_prompt(
                member_count,
                editorial_workflow,
                prompt_dismissed,
            ),
        },
        modules: SiteContextModules {
            blog: module_blog,
            pages: module_pages,
            portfolio: module_portfolio,
            legal: module_legal,
            documents: module_documents,
            ai: module_ai,
            forms: module_forms,
            collections: module_collections,
        },
        integration: SiteContextIntegration {
            code_injection_head,
            code_injection_footer,
            seo_title_template,
            seo_default_description,
            theme_color,
            background_color,
        },
    }))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/preview-token",
    tag = "Sites",
    operation_id = "get_preview_token",
    description = "Generate a short-lived JWT (5 min) for previewing draft content in frontend templates",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Preview token generated", body = PreviewTokenResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions", body = ProblemDetails),
        (status = 501, description = "Preview tokens not configured", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_preview_token(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<PreviewTokenResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("site", "read"),
    )
    .await?;

    let secret = &state.settings.security.preview_token_secret;
    if secret.is_empty() {
        return Err(ApiError::bad_request(
            "Preview tokens are not configured. Set APP__SECURITY__PREVIEW_TOKEN_SECRET.",
        )
        .with_code(codes::PREVIEW_TOKEN_NOT_CONFIGURED));
    }

    let (token, expires_at) = crate::services::preview_token::generate(site_id, secret)?;

    Ok(Json(PreviewTokenResponse { token, expires_at }))
}

#[utoipa::path(
    get,
    path = "/sites/deleted",
    tag = "Sites",
    operation_id = "list_deleted_sites",
    description = "List soft-deleted sites still within the 30-day restore grace window",
    responses(
        (status = 200, description = "Soft-deleted sites within the grace window", body = Vec<SiteResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn list_deleted_sites(
    State(state): State<AppState>,
    auth: ReadKey,
) -> Result<Json<Vec<SiteResponse>>, ApiError> {
    let deleted = Site::find_deleted_within_grace(&state.db).await?;
    match &auth.0.kind {
        crate::guards::actor::ActorKind::Clerk { clerk_user_id } => {
            if SiteMembership::is_system_admin(&state.db, clerk_user_id).await? {
                return Ok(Json(deleted.into_iter().map(SiteResponse::from).collect()));
            }
            let memberships =
                SiteMembership::find_all_for_clerk_user(&state.db, clerk_user_id).await?;
            let site_ids: Vec<Uuid> = memberships.iter().map(|m| m.site_id).collect();
            let responses: Vec<SiteResponse> = deleted
                .into_iter()
                .filter(|s| site_ids.contains(&s.id))
                .map(SiteResponse::from)
                .collect();
            Ok(Json(responses))
        }
        crate::guards::actor::ActorKind::ApiKey { .. }
        | crate::guards::actor::ActorKind::Preview { .. } => {
            let responses: Vec<SiteResponse> = deleted
                .into_iter()
                .filter(|s| auth.0.has_site_access(s.id))
                .map(SiteResponse::from)
                .collect();
            Ok(Json(responses))
        }
    }
}

#[utoipa::path(
    post,
    path = "/sites/{id}/restore",
    tag = "Sites",
    operation_id = "restore_site",
    description = "Restore a soft-deleted site within the 30-day grace window. Owner/system-admin only.",
    params(("id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Site restored", body = SiteResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Soft-deleted site not found", body = ProblemDetails),
        (status = 410, description = "Restore grace window has lapsed", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn restore_site(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: Actor,
) -> Result<Json<SiteResponse>, ApiError> {
    // Restore reuses the Owner-only `site:delete` permission (epic #708).
    PermissionService::require(&state.db, &auth, id, &Permission::new("site", "delete")).await?;
    let site = Site::restore(&state.db, id).await?;
    AuditedEntity::audit_only("site")
        .mutate(AuditAction::Restore, id)
        .site(id)
        .actor(auth.id)
        .execute(&state.db)
        .await;
    Ok(Json(SiteResponse::from(site)))
}

#[utoipa::path(
    post,
    path = "/sites/{id}/reset-content",
    tag = "Sites",
    operation_id = "reset_site_content",
    description = "Bulk soft-delete all site-scoped content and site-owned media into the 30-day \
                   trash (recoverable until the shared TrashCleanupWorker purges it). The site \
                   row, its settings, and its memberships are kept. Owner/system-admin only.",
    params(("id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Content reset; per-category trash counts", body = ResetContentResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn reset_site_content(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: Actor,
) -> Result<Json<ResetContentResponse>, ApiError> {
    // Reuses the Owner-only `site:delete` permission (epic #708) — the
    // same gate as delete/restore; system admins resolve to Owner perms.
    PermissionService::require(&state.db, &auth, id, &Permission::new("site", "delete")).await?;
    // 404 for unknown or already-soft-deleted sites (find_by_id filters
    // is_deleted = FALSE) before any content is touched.
    Site::find_by_id(&state.db, id).await?;

    let counts = crate::services::site_content_reset::reset_site_content(&state.db, id).await?;

    AuditedEntity::audit_only("site")
        .mutate(AuditAction::Delete, id)
        .site(id)
        .actor(auth.id)
        .metadata(serde_json::json!({
            "reason": "content_reset",
            "counts": serde_json::to_value(&counts).unwrap_or(serde_json::Value::Null),
        }))
        .execute(&state.db)
        .await;

    Ok(Json(counts))
}

/// Roles that may export a site archive. Per epic #708's access-control
/// matrix this is wider than delete/reset (Owner-only): a site Admin may
/// also export. System admins and Master API keys resolve to `Owner` via
/// [`Actor::effective_site_role`], so they pass too.
fn can_export(role: SiteRole) -> bool {
    matches!(role, SiteRole::Owner | SiteRole::Admin)
}

/// Resolve the actor's effective role for `site_id`, then enforce the
/// export gate — `403 SITE_EXPORT_FORBIDDEN` for anyone below Admin.
async fn require_export_role(
    state: &AppState,
    auth: &Actor,
    site_id: Uuid,
) -> Result<(), ApiError> {
    let role = auth
        .effective_site_role(&state.db, site_id)
        .await?
        .unwrap_or(SiteRole::Viewer);
    if !can_export(role) {
        return Err(ApiError::forbidden(
            "Only the site owner, a site admin, or a system admin may export this site",
        )
        .with_code(codes::SITE_EXPORT_FORBIDDEN));
    }
    Ok(())
}

/// Relative signed download link for a `ready`, non-expired job. `None`
/// for any other state — the artifact only exists once the worker has
/// stored it and stamped a token + expiry.
fn export_download_url(site_id: Uuid, job: &SiteExportJob) -> Option<String> {
    if job.status != SiteExportStatus::Ready {
        return None;
    }
    let token = job.download_token.as_deref()?;
    let fresh = job.expires_at.map(|e| e > Utc::now()).unwrap_or(false);
    fresh.then(|| {
        format!(
            "/api/v1/sites/{}/export/{}/download?token={}",
            site_id, job.id, token
        )
    })
}

#[utoipa::path(
    post,
    path = "/sites/{id}/export",
    tag = "Sites",
    operation_id = "create_site_export",
    description = "Enqueue an asynchronous site-archive export (ZIP of a JSON \
                   archive plus media bytes). Returns 202 with the job id; poll \
                   `GET /sites/{id}/export/{jobId}` for status and the expiring \
                   signed download link. Owner/site-admin/system-admin only; one \
                   active job per site.",
    params(("id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 202, description = "Export enqueued", body = SiteExportJobResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails),
        (status = 409, description = "An export is already queued or running", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn create_site_export(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: Actor,
) -> Result<(StatusCode, Json<SiteExportJobResponse>), ApiError> {
    require_export_role(&state, &auth, id).await?;
    // 404 for unknown or already-soft-deleted sites (find_by_id filters
    // is_deleted = FALSE) before any job is created.
    Site::find_by_id(&state.db, id).await?;

    // Single active job per site — reject rather than stack duplicates.
    if SiteExportJob::find_active_for_site(&state.db, id)
        .await?
        .is_some()
    {
        return Err(
            ApiError::conflict("An export for this site is already queued or running")
                .with_code(codes::SITE_EXPORT_ALREADY_RUNNING),
        );
    }

    let job = SiteExportJob::enqueue(&state.db, id, Some(auth.id)).await?;

    AuditedEntity::audit_only("site")
        .mutate(AuditAction::Export, id)
        .site(id)
        .actor(auth.id)
        .metadata(serde_json::json!({
            "reason": "site_export_requested",
            "job_id": job.id,
        }))
        .execute(&state.db)
        .await;

    Ok((
        StatusCode::ACCEPTED,
        Json(SiteExportJobResponse::from_job(&job, None)),
    ))
}

#[utoipa::path(
    get,
    path = "/sites/{id}/export/{job_id}",
    tag = "Sites",
    operation_id = "get_site_export",
    description = "Status of an export job. While `ready` (and not yet expired) \
                   the response carries an expiring signed download URL. An \
                   unknown job id — or one belonging to another site — is a 404. \
                   Owner/site-admin/system-admin only.",
    params(
        ("id" = Uuid, Path, description = "Site UUID"),
        ("job_id" = Uuid, Path, description = "Export job UUID")
    ),
    responses(
        (status = 200, description = "Export job status", body = SiteExportJobResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Export job not found", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn get_site_export(
    State(state): State<AppState>,
    Path((id, job_id)): Path<(Uuid, Uuid)>,
    auth: Actor,
) -> Result<Json<SiteExportJobResponse>, ApiError> {
    require_export_role(&state, &auth, id).await?;
    let job = SiteExportJob::find_for_site(&state.db, id, job_id).await?;
    let download_url = export_download_url(id, &job);
    Ok(Json(SiteExportJobResponse::from_job(&job, download_url)))
}

#[derive(Debug, Deserialize)]
struct ExportDownloadQuery {
    /// Opaque bearer minted by the worker; the signed link carries it.
    token: String,
}

#[utoipa::path(
    get,
    path = "/sites/{id}/export/{job_id}/download",
    tag = "Sites",
    operation_id = "download_site_export",
    description = "Stream the built export ZIP. Authorized by both the \
                   caller's export role and the unguessable per-job token; \
                   an unknown/mismatched token, a not-yet-ready job, or an \
                   expired (purged) artifact are all an indistinguishable \
                   404 so the artifact's existence is never confirmed.",
    params(
        ("id" = Uuid, Path, description = "Site UUID"),
        ("job_id" = Uuid, Path, description = "Export job UUID"),
        ("token" = String, Query, description = "Per-job download token")
    ),
    responses(
        (status = 200, description = "Export ZIP", content_type = "application/zip"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "No downloadable artifact", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn download_site_export(
    State(state): State<AppState>,
    Path((id, job_id)): Path<(Uuid, Uuid)>,
    Query(q): Query<ExportDownloadQuery>,
    auth: Actor,
) -> Result<Response<Body>, ApiError> {
    require_export_role(&state, &auth, id).await?;
    let job = SiteExportJob::find_for_site(&state.db, id, job_id).await?;

    // Every "can't serve it" reason collapses to the same 404 — a wrong
    // token must not be distinguishable from a missing job, and an
    // expired artifact is, for the caller, simply gone (the retention
    // sweep purges it; the catalog description says as much).
    let not_found = || {
        ApiError::not_found("No downloadable export artifact")
            .with_code(codes::SITE_EXPORT_JOB_NOT_FOUND)
    };

    if job.status != SiteExportStatus::Ready {
        return Err(not_found());
    }
    if job.download_token.as_deref() != Some(q.token.as_str()) {
        return Err(not_found());
    }
    if !job.expires_at.map(|e| e > Utc::now()).unwrap_or(false) {
        return Err(not_found());
    }
    let path = job.storage_path.as_deref().ok_or_else(not_found)?;

    let (data, _ct) = state.storage.fetch(path).await?;
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/zip")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"site-export-{job_id}.zip\""),
        )
        .header(header::CACHE_CONTROL, "no-store")
        .body(Body::from(data))
        .map_err(|e| {
            ApiError::internal(format!("response build failed: {e}"))
                .with_code(codes::INTERNAL_ERROR)
        })
}

/// Routes register `/sites/by-slug/{slug}`, `/sites/deleted`,
/// `/sites/{site_id}/context`, and `/sites/{site_id}/preview-token`
/// ahead of `/sites/{id}` so that matchit prefers literal segments
/// over the param.
pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_sites, create_site))
        .routes(routes!(get_site_by_slug))
        .routes(routes!(list_deleted_sites))
        .routes(routes!(get_site_context))
        .routes(routes!(get_preview_token))
        .routes(routes!(restore_site))
        .routes(routes!(reset_site_content))
        .routes(routes!(create_site_export, get_site_export))
        .routes(routes!(download_site_export))
        .routes(routes!(get_site, update_site, delete_site))
}
