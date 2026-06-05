//! Axum port of `crate::handlers::site_locale`. Five endpoints for
//! managing per-site locale assignments. Mounted under `/api/v1`.
//!
//! First Phase 4 bundle to use `auth: Actor` directly (no
//! role-gate wrapper). The role check is handled entirely by
//! `PermissionService::require(&state.db, &auth, site_id, ...)`. Use this
//! shape when the handler authorizes by site permissions only — there's
//! no implicit "you must be at least X role" guard.

use crate::dto::site_locale::{AddSiteLocaleRequest, SiteLocaleResponse, UpdateSiteLocaleRequest};
use crate::dto::validated::ValidatedJson;
use crate::errors::codes;
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::actor::Actor;
use crate::guards::auth_guard::ReadKey;
use crate::models::site_locale::SiteLocale;
use crate::services::permission_service::{Permission, PermissionService};
use crate::AppState;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::Json;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

/// Site locales, cached (identical for every caller of the site).
/// Shared by the list handler and the cache-rebuild warmer.
pub(crate) async fn cached_site_locales(
    state: &AppState,
    site_id: Uuid,
) -> Result<Vec<SiteLocaleResponse>, ApiError> {
    crate::services::response_cache::cached(
        &state.redis,
        &crate::services::response_cache::key(site_id, "locales"),
        || async {
            let locales = SiteLocale::find_all_for_site(&state.db, site_id).await?;
            Ok(locales
                .into_iter()
                .map(SiteLocaleResponse::from)
                .collect::<Vec<SiteLocaleResponse>>())
        },
    )
    .await
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/locales",
    tag = "Site Locales",
    operation_id = "list_site_locales",
    description = "List all locales assigned to a site with locale details",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    security(("api_key" = []), ("bearer_auth" = [])),
    responses(
        (status = 200, description = "List of site locales", body = Vec<SiteLocaleResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    )
)]
async fn list_site_locales(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<Vec<SiteLocaleResponse>>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("site", "read"),
    )
    .await?;
    Ok(Json(cached_site_locales(&state, site_id).await?))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/locales",
    tag = "Site Locales",
    operation_id = "add_site_locale",
    description = "Add a locale to a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body = AddSiteLocaleRequest,
    security(("api_key" = []), ("bearer_auth" = [])),
    responses(
        (status = 201, description = "Locale added to site", body = SiteLocaleResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 409, description = "Locale already assigned", body = ProblemDetails)
    )
)]
async fn add_site_locale(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: Actor,
    ValidatedJson(body): ValidatedJson<AddSiteLocaleRequest>,
) -> Result<(StatusCode, Json<SiteLocaleResponse>), ApiError> {
    PermissionService::require(
        &state.db,
        &auth,
        site_id,
        &Permission::new("settings", "update"),
    )
    .await?;

    let body = body.into_inner();

    let site_locale = SiteLocale::add(
        &state.db,
        site_id,
        body.locale_id,
        body.is_default,
        body.url_prefix.as_deref(),
    )
    .await?;

    let locales = SiteLocale::find_all_for_site(&state.db, site_id).await?;
    let response = locales
        .into_iter()
        .find(|l| l.locale_id == site_locale.locale_id)
        .map(SiteLocaleResponse::from)
        .ok_or_else(|| {
            ApiError::internal("Failed to fetch created site locale")
                .with_code(codes::INTERNAL_ERROR)
        })?;

    Ok((StatusCode::CREATED, Json(response)))
}

#[utoipa::path(
    put,
    path = "/sites/{site_id}/locales/{locale_id}",
    tag = "Site Locales",
    operation_id = "update_site_locale",
    description = "Update a site locale assignment (active status, url prefix, default)",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("locale_id" = Uuid, Path, description = "Locale UUID")
    ),
    request_body = UpdateSiteLocaleRequest,
    security(("api_key" = []), ("bearer_auth" = [])),
    responses(
        (status = 200, description = "Site locale updated", body = SiteLocaleResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site locale not found", body = ProblemDetails)
    )
)]
async fn update_site_locale(
    State(state): State<AppState>,
    Path((site_id, locale_id)): Path<(Uuid, Uuid)>,
    auth: Actor,
    ValidatedJson(body): ValidatedJson<UpdateSiteLocaleRequest>,
) -> Result<Json<SiteLocaleResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth,
        site_id,
        &Permission::new("settings", "update"),
    )
    .await?;

    let body = body.into_inner();

    if body.is_active == Some(false) {
        let locales = SiteLocale::find_all_for_site(&state.db, site_id).await?;
        let active_count = locales.iter().filter(|l| l.is_active).count();
        let current = locales.iter().find(|l| l.locale_id == locale_id);
        if let Some(current) = current {
            if current.is_active && active_count <= 1 {
                return Err(
                    ApiError::bad_request("At least one active language is required")
                        .with_code(codes::BAD_REQUEST),
                );
            }
        }
    }

    let url_prefix_param = if body.url_prefix.is_some() {
        Some(body.url_prefix.as_deref())
    } else {
        None
    };

    SiteLocale::update(
        &state.db,
        site_id,
        locale_id,
        body.is_default,
        body.is_active,
        url_prefix_param,
    )
    .await?;

    let locales = SiteLocale::find_all_for_site(&state.db, site_id).await?;
    let response = locales
        .into_iter()
        .find(|l| l.locale_id == locale_id)
        .map(SiteLocaleResponse::from)
        .ok_or_else(|| {
            ApiError::not_found("Site locale not found").with_code(codes::RESOURCE_NOT_FOUND)
        })?;

    Ok(Json(response))
}

#[utoipa::path(
    delete,
    path = "/sites/{site_id}/locales/{locale_id}",
    tag = "Site Locales",
    operation_id = "remove_site_locale",
    description = "Remove a locale from a site. Cannot remove the default or last locale.",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("locale_id" = Uuid, Path, description = "Locale UUID")
    ),
    security(("api_key" = []), ("bearer_auth" = [])),
    responses(
        (status = 204, description = "Locale removed from site"),
        (status = 400, description = "Cannot remove default locale", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site locale not found", body = ProblemDetails),
        (status = 409, description = "Cannot remove last locale", body = ProblemDetails)
    )
)]
async fn remove_site_locale(
    State(state): State<AppState>,
    Path((site_id, locale_id)): Path<(Uuid, Uuid)>,
    auth: Actor,
) -> Result<StatusCode, ApiError> {
    PermissionService::require(
        &state.db,
        &auth,
        site_id,
        &Permission::new("settings", "update"),
    )
    .await?;

    SiteLocale::remove(&state.db, site_id, locale_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    put,
    path = "/sites/{site_id}/locales/{locale_id}/default",
    tag = "Site Locales",
    operation_id = "set_site_default_locale",
    description = "Set a locale as the default for a site",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("locale_id" = Uuid, Path, description = "Locale UUID")
    ),
    security(("api_key" = []), ("bearer_auth" = [])),
    responses(
        (status = 200, description = "Default locale set"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site locale not found", body = ProblemDetails)
    )
)]
async fn set_site_default_locale(
    State(state): State<AppState>,
    Path((site_id, locale_id)): Path<(Uuid, Uuid)>,
    auth: Actor,
) -> Result<Json<serde_json::Value>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth,
        site_id,
        &Permission::new("settings", "update"),
    )
    .await?;

    SiteLocale::set_default(&state.db, site_id, locale_id).await?;

    Ok(Json(serde_json::json!({ "status": "default_locale_set" })))
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_site_locales, add_site_locale))
        .routes(routes!(set_site_default_locale))
        .routes(routes!(update_site_locale, remove_site_locale))
}
