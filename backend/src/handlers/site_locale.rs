//! Site locale management handlers
//!
//! Endpoints for managing per-site language/locale assignments.

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::Route;
use uuid::Uuid;
use validator::Validate;

use crate::dto::site_locale::{AddSiteLocaleRequest, SiteLocaleResponse, UpdateSiteLocaleRequest};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::{AuthenticatedKey, ReadKey};
use crate::models::site_locale::SiteLocale;
use crate::models::site_membership::SiteRole;
use crate::AppState;

/// List all locales assigned to a site
#[utoipa::path(
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
#[get("/sites/<site_id>/locales")]
pub async fn list_site_locales(
    state: &rocket::State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
) -> Result<Json<Vec<SiteLocaleResponse>>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;

    let locales = SiteLocale::find_all_for_site(&state.db, site_id).await?;
    let responses: Vec<SiteLocaleResponse> =
        locales.into_iter().map(SiteLocaleResponse::from).collect();

    Ok(Json(responses))
}

/// Add a locale to a site
#[utoipa::path(
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
#[post("/sites/<site_id>/locales", data = "<body>")]
pub async fn add_site_locale(
    state: &rocket::State<AppState>,
    site_id: Uuid,
    body: Json<AddSiteLocaleRequest>,
    auth: AuthenticatedKey,
) -> Result<(Status, Json<SiteLocaleResponse>), ApiError> {
    auth.authorize_site_action(&state.db, site_id, &SiteRole::Admin)
        .await?;

    let req = body.into_inner();
    req.validate().map_err(ApiError::from)?;

    let site_locale = SiteLocale::add(
        &state.db,
        site_id,
        req.locale_id,
        req.is_default,
        req.url_prefix.as_deref(),
    )
    .await?;

    // Fetch with details for the response
    let locales = SiteLocale::find_all_for_site(&state.db, site_id).await?;
    let response = locales
        .into_iter()
        .find(|l| l.locale_id == site_locale.locale_id)
        .map(SiteLocaleResponse::from)
        .ok_or_else(|| ApiError::Internal("Failed to fetch created site locale".into()))?;

    Ok((Status::Created, Json(response)))
}

/// Update a site locale assignment
#[utoipa::path(
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
#[put("/sites/<site_id>/locales/<locale_id>", data = "<body>")]
pub async fn update_site_locale(
    state: &rocket::State<AppState>,
    site_id: Uuid,
    locale_id: Uuid,
    body: Json<UpdateSiteLocaleRequest>,
    auth: AuthenticatedKey,
) -> Result<Json<SiteLocaleResponse>, ApiError> {
    auth.authorize_site_action(&state.db, site_id, &SiteRole::Admin)
        .await?;

    let req = body.into_inner();
    req.validate().map_err(ApiError::from)?;

    // Validate: cannot deactivate if it's the only active locale
    if req.is_active == Some(false) {
        let locales = SiteLocale::find_all_for_site(&state.db, site_id).await?;
        let active_count = locales.iter().filter(|l| l.is_active).count();
        let current = locales.iter().find(|l| l.locale_id == locale_id);
        if let Some(current) = current {
            if current.is_active && active_count <= 1 {
                return Err(ApiError::BadRequest(
                    "At least one active language is required".into(),
                ));
            }
        }
    }

    // Build url_prefix parameter: Some(Some("x")) to set, Some(None) to clear, None to skip
    let url_prefix_param = if req.url_prefix.is_some() {
        Some(req.url_prefix.as_deref())
    } else {
        None
    };

    SiteLocale::update(
        &state.db,
        site_id,
        locale_id,
        req.is_default,
        req.is_active,
        url_prefix_param,
    )
    .await?;

    // Fetch with details for the response
    let locales = SiteLocale::find_all_for_site(&state.db, site_id).await?;
    let response = locales
        .into_iter()
        .find(|l| l.locale_id == locale_id)
        .map(SiteLocaleResponse::from)
        .ok_or_else(|| ApiError::NotFound("Site locale not found".into()))?;

    Ok(Json(response))
}

/// Remove a locale from a site
#[utoipa::path(
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
#[delete("/sites/<site_id>/locales/<locale_id>")]
pub async fn remove_site_locale(
    state: &rocket::State<AppState>,
    site_id: Uuid,
    locale_id: Uuid,
    auth: AuthenticatedKey,
) -> Result<Status, ApiError> {
    auth.authorize_site_action(&state.db, site_id, &SiteRole::Admin)
        .await?;

    SiteLocale::remove(&state.db, site_id, locale_id).await?;
    Ok(Status::NoContent)
}

/// Set a locale as the default for a site
#[utoipa::path(
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
#[put("/sites/<site_id>/locales/<locale_id>/default")]
pub async fn set_site_default_locale(
    state: &rocket::State<AppState>,
    site_id: Uuid,
    locale_id: Uuid,
    auth: AuthenticatedKey,
) -> Result<Json<serde_json::Value>, ApiError> {
    auth.authorize_site_action(&state.db, site_id, &SiteRole::Admin)
        .await?;

    SiteLocale::set_default(&state.db, site_id, locale_id).await?;

    Ok(Json(serde_json::json!({ "status": "default_locale_set" })))
}

/// Collect site locale routes
pub fn routes() -> Vec<Route> {
    routes![
        list_site_locales,
        add_site_locale,
        update_site_locale,
        remove_site_locale,
        set_site_default_locale,
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 5, "Should have 5 site locale routes");
    }
}
