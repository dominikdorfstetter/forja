//! Site settings handlers

use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;
use validator::Validate;

use crate::dto::site_settings::{SiteSettingsResponse, UpdateSiteSettingsRequest};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::models::site::Site;
use crate::models::site_membership::SiteRole;
use crate::models::site_settings::SiteSetting;
use crate::AppState;

/// Get effective settings for a site (defaults merged with DB values)
#[utoipa::path(
    tag = "Site Settings",
    operation_id = "get_site_settings",
    description = "Get effective settings for a site (defaults merged with DB values)",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Site settings", body = SiteSettingsResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/settings")]
pub async fn get_site_settings(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
) -> Result<Json<SiteSettingsResponse>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Admin)
        .await?;
    // Verify site exists
    Site::find_by_id(&state.db, site_id).await?;

    let map = SiteSetting::get_effective_settings(&state.db, site_id).await?;
    Ok(Json(SiteSettingsResponse::from_map(&map)))
}

/// Update site settings (upserts provided fields, returns full settings)
#[utoipa::path(
    tag = "Site Settings",
    operation_id = "update_site_settings",
    description = "Update site settings (upserts provided fields, returns full settings)",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = UpdateSiteSettingsRequest, description = "Settings to update"),
    responses(
        (status = 200, description = "Updated site settings", body = SiteSettingsResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[put("/sites/<site_id>/settings", data = "<body>")]
pub async fn update_site_settings(
    state: &State<AppState>,
    site_id: Uuid,
    body: Json<UpdateSiteSettingsRequest>,
    auth: ReadKey,
) -> Result<Json<SiteSettingsResponse>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Admin)
        .await?;
    // Verify site exists
    Site::find_by_id(&state.db, site_id).await?;

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    // Upsert each provided field
    for (key, value, is_sensitive) in req.to_settings_vec() {
        SiteSetting::upsert(&state.db, site_id, key, value, is_sensitive).await?;
    }

    // Return full effective settings
    let map = SiteSetting::get_effective_settings(&state.db, site_id).await?;
    Ok(Json(SiteSettingsResponse::from_map(&map)))
}

/// Collect site settings routes
pub fn routes() -> Vec<Route> {
    routes![get_site_settings, update_site_settings]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 2, "Should have 2 site settings routes");
    }
}
