//! Site management handlers

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;
use validator::Validate;

use crate::dto::site::{
    should_show_team_workflow_prompt, CreateSiteRequest, SiteContextFeatures, SiteContextModules,
    SiteContextResponse, SiteContextSuggestions, SiteResponse, UpdateSiteRequest,
};
use crate::errors::{codes, ApiError, ProblemDetails};
use crate::guards::auth_guard::{AuthSource, AuthenticatedKey, ReadKey};
use crate::models::audit::AuditAction;
use crate::models::locale::Locale;
use crate::models::site::Site;
use crate::models::site_locale::SiteLocale;
use crate::models::site_membership::{SiteMembership, SiteRole};
use crate::models::site_settings::{
    SiteSetting, KEY_MODULE_AI_ENABLED, KEY_MODULE_BLOG_ENABLED, KEY_MODULE_CV_ENABLED,
    KEY_MODULE_DOCUMENTS_ENABLED, KEY_MODULE_FEDERATION_ENABLED, KEY_MODULE_LEGAL_ENABLED,
    KEY_MODULE_PAGES_ENABLED,
};
use crate::services::audit_service;
use crate::AppState;

/// Get all sites
#[utoipa::path(
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
#[get("/sites")]
pub async fn list_sites(
    state: &State<AppState>,
    auth: ReadKey,
) -> Result<Json<Vec<SiteResponse>>, ApiError> {
    match &auth.0.auth_source {
        AuthSource::ClerkJwt { clerk_user_id } => {
            // System admins see all sites
            if SiteMembership::is_system_admin(&state.db, clerk_user_id).await? {
                let sites = Site::find_all(&state.db).await?;
                return Ok(Json(sites.into_iter().map(SiteResponse::from).collect()));
            }
            // Regular Clerk users only see sites they have memberships for
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
        AuthSource::ApiKey => {
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

/// Get a single site by ID
#[utoipa::path(
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
#[get("/sites/<id>")]
pub async fn get_site(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Json<SiteResponse>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, id, &SiteRole::Viewer)
        .await?;
    let site = Site::find_by_id(&state.db, id).await?;
    Ok(Json(SiteResponse::from(site)))
}

/// Get a site by slug
#[utoipa::path(
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
#[get("/sites/by-slug/<slug>", rank = 1)]
pub async fn get_site_by_slug(
    state: &State<AppState>,
    slug: &str,
    auth: ReadKey,
) -> Result<Json<SiteResponse>, ApiError> {
    let site = Site::find_by_slug(&state.db, slug).await?;
    auth.0
        .authorize_site_action(&state.db, site.id, &SiteRole::Viewer)
        .await?;
    Ok(Json(SiteResponse::from(site)))
}

/// Create a new site
#[utoipa::path(
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
#[post("/sites", data = "<body>")]
pub async fn create_site(
    state: &State<AppState>,
    body: Json<CreateSiteRequest>,
    auth: AuthenticatedKey,
) -> Result<(Status, Json<SiteResponse>), ApiError> {
    let request = body.into_inner();
    request.validate().map_err(ApiError::from)?;

    // Extract locales before passing request to create
    let locales = request.locales.clone();

    // Validate locales if provided
    if let Some(ref locale_inputs) = locales {
        let default_count = locale_inputs.iter().filter(|l| l.is_default).count();
        if default_count != 1 {
            return Err(
                ApiError::bad_request("Exactly one locale must be marked as default")
                    .with_code(codes::SITE_CREATE_INVALID_LOCALES),
            );
        }
        // Verify all locale IDs exist
        for input in locale_inputs {
            Locale::find_by_id(&state.db, input.locale_id).await?;
        }
    }

    match &auth.auth_source {
        AuthSource::ClerkJwt { clerk_user_id } => {
            // Any Clerk user can create a site and becomes its owner
            let site = Site::create(&state.db, request, Some(clerk_user_id)).await?;
            // Auto-create owner membership
            SiteMembership::create(&state.db, clerk_user_id, site.id, &SiteRole::Owner, None)
                .await?;

            // Bulk insert locales if provided
            if let Some(locale_inputs) = locales {
                let locale_tuples: Vec<(uuid::Uuid, bool, Option<String>)> = locale_inputs
                    .into_iter()
                    .map(|l| (l.locale_id, l.is_default, l.url_prefix))
                    .collect();
                SiteLocale::bulk_insert(&state.db, site.id, &locale_tuples).await?;
            }

            audit_service::log_action(
                &state.db,
                Some(site.id),
                Some(auth.id),
                AuditAction::Create,
                "site",
                site.id,
                None,
            )
            .await;
            Ok((Status::Created, Json(SiteResponse::from(site))))
        }
        AuthSource::ApiKey => {
            // API keys require Admin+ and cannot be site-scoped
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

            // Bulk insert locales if provided
            if let Some(locale_inputs) = locales {
                let locale_tuples: Vec<(uuid::Uuid, bool, Option<String>)> = locale_inputs
                    .into_iter()
                    .map(|l| (l.locale_id, l.is_default, l.url_prefix))
                    .collect();
                SiteLocale::bulk_insert(&state.db, site.id, &locale_tuples).await?;
            }

            audit_service::log_action(
                &state.db,
                Some(site.id),
                Some(auth.id),
                AuditAction::Create,
                "site",
                site.id,
                None,
            )
            .await;
            Ok((Status::Created, Json(SiteResponse::from(site))))
        }
    }
}

/// Update a site
#[utoipa::path(
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
#[put("/sites/<id>", data = "<body>")]
pub async fn update_site(
    state: &State<AppState>,
    id: Uuid,
    body: Json<UpdateSiteRequest>,
    auth: AuthenticatedKey,
) -> Result<Json<SiteResponse>, ApiError> {
    auth.authorize_site_action(&state.db, id, &SiteRole::Admin)
        .await?;
    let existing = Site::find_by_id(&state.db, id).await?;
    let old = serde_json::to_value(&existing).ok();
    let request = body.into_inner();
    request.validate().map_err(ApiError::from)?;
    let site = Site::update(&state.db, id, request).await?;
    audit_service::log_action(
        &state.db,
        Some(id),
        Some(auth.id),
        AuditAction::Update,
        "site",
        id,
        None,
    )
    .await;
    if let (Some(old), Ok(new)) = (old, serde_json::to_value(&site)) {
        audit_service::log_changes(&state.db, Some(id), "site", id, Some(auth.id), &old, &new)
            .await;
    }
    Ok(Json(SiteResponse::from(site)))
}

/// Soft delete a site
#[utoipa::path(
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
#[delete("/sites/<id>")]
pub async fn delete_site(
    state: &State<AppState>,
    id: Uuid,
    auth: AuthenticatedKey,
) -> Result<Status, ApiError> {
    auth.authorize_site_action(&state.db, id, &SiteRole::Owner)
        .await?;
    Site::soft_delete(&state.db, id).await?;
    audit_service::log_action(
        &state.db,
        Some(id),
        Some(auth.id),
        AuditAction::Delete,
        "site",
        id,
        None,
    )
    .await;
    Ok(Status::NoContent)
}

/// Get site context for progressive disclosure
#[utoipa::path(
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
#[get("/sites/<site_id>/context")]
pub async fn get_site_context(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
) -> Result<Json<SiteContextResponse>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
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
    let module_cv = settings
        .get(KEY_MODULE_CV_ENABLED)
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
    let module_federation = settings
        .get(KEY_MODULE_FEDERATION_ENABLED)
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

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
            cv: module_cv,
            legal: module_legal,
            documents: module_documents,
            ai: module_ai,
            federation: module_federation,
        },
    }))
}

/// Collect site routes
pub fn routes() -> Vec<Route> {
    routes![
        list_sites,
        get_site_by_slug, // More specific routes first
        get_site_context,
        get_site,
        create_site,
        update_site,
        delete_site
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 7, "Should have 7 site routes");
    }
}
