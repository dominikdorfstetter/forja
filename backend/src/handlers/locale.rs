//! Locale handlers

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;
use validator::Validate;

use crate::dto::locale::{CreateLocaleRequest, LocaleResponse, UpdateLocaleRequest};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::AdminKey;
use crate::models::locale::Locale;
use crate::AppState;

/// Get all locales
#[utoipa::path(
    tag = "Locales",
    operation_id = "list_locales",
    description = "List all locales. Pass include_inactive=true to include inactive locales (admin use).",
    params(
        ("include_inactive" = Option<bool>, Query, description = "Include inactive locales (default: false)")
    ),
    responses(
        (status = 200, description = "List of locales", body = Vec<LocaleResponse>)
    ),
    security(("api_key" = []))
)]
#[get("/locales?<include_inactive>")]
pub async fn list_locales(
    state: &State<AppState>,
    include_inactive: Option<bool>,
) -> Result<Json<Vec<LocaleResponse>>, ApiError> {
    let locales = if include_inactive.unwrap_or(false) {
        Locale::find_all_including_inactive(&state.db).await?
    } else {
        Locale::find_all(&state.db).await?
    };
    let responses: Vec<LocaleResponse> = locales.into_iter().map(LocaleResponse::from).collect();
    Ok(Json(responses))
}

/// Get locale by ID
#[utoipa::path(
    tag = "Locales",
    operation_id = "get_locale",
    description = "Get a locale by ID",
    params(("id" = Uuid, Path, description = "Locale UUID")),
    responses(
        (status = 200, description = "Locale details", body = LocaleResponse),
        (status = 404, description = "Locale not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/locales/<id>")]
pub async fn get_locale(
    state: &State<AppState>,
    id: Uuid,
) -> Result<Json<LocaleResponse>, ApiError> {
    let locale = Locale::find_by_id(&state.db, id).await?;
    Ok(Json(LocaleResponse::from(locale)))
}

/// Get locale by code
#[utoipa::path(
    tag = "Locales",
    operation_id = "get_locale_by_code",
    description = "Get a locale by its language code",
    params(("code" = String, Path, description = "Locale code (e.g., 'en', 'de')")),
    responses(
        (status = 200, description = "Locale details", body = LocaleResponse),
        (status = 404, description = "Locale not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/locales/by-code/<code>")]
pub async fn get_locale_by_code(
    state: &State<AppState>,
    code: &str,
) -> Result<Json<LocaleResponse>, ApiError> {
    let locale = Locale::find_by_code(&state.db, code).await?;
    Ok(Json(LocaleResponse::from(locale)))
}

/// Create a new locale
#[utoipa::path(
    tag = "Locales",
    operation_id = "create_locale",
    description = "Create a new locale (admin only)",
    request_body(content = CreateLocaleRequest, description = "Locale creation data"),
    responses(
        (status = 201, description = "Locale created", body = LocaleResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 409, description = "Locale with this code already exists", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/locales", data = "<body>")]
pub async fn create_locale(
    state: &State<AppState>,
    body: Json<CreateLocaleRequest>,
    _auth: AdminKey,
) -> Result<(Status, Json<LocaleResponse>), ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let locale = Locale::create(&state.db, &req).await?;
    Ok((Status::Created, Json(LocaleResponse::from(locale))))
}

/// Update a locale
#[utoipa::path(
    tag = "Locales",
    operation_id = "update_locale",
    description = "Update a locale (admin only)",
    params(("id" = Uuid, Path, description = "Locale UUID")),
    request_body(content = UpdateLocaleRequest, description = "Locale update data"),
    responses(
        (status = 200, description = "Locale updated", body = LocaleResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Locale not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[put("/locales/<id>", data = "<body>")]
pub async fn update_locale(
    state: &State<AppState>,
    id: Uuid,
    body: Json<UpdateLocaleRequest>,
    _auth: AdminKey,
) -> Result<Json<LocaleResponse>, ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let locale = Locale::update(&state.db, id, &req).await?;
    Ok(Json(LocaleResponse::from(locale)))
}

/// Delete a locale
#[utoipa::path(
    tag = "Locales",
    operation_id = "delete_locale",
    description = "Delete a locale (admin only). Fails if the locale is assigned to any site.",
    params(("id" = Uuid, Path, description = "Locale UUID")),
    responses(
        (status = 204, description = "Locale deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Locale not found", body = ProblemDetails),
        (status = 409, description = "Locale is assigned to sites", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/locales/<id>")]
pub async fn delete_locale(
    state: &State<AppState>,
    id: Uuid,
    _auth: AdminKey,
) -> Result<Status, ApiError> {
    Locale::delete(&state.db, id).await?;
    Ok(Status::NoContent)
}

/// Collect locale routes
pub fn routes() -> Vec<Route> {
    routes![
        list_locales,
        get_locale,
        get_locale_by_code,
        create_locale,
        update_locale,
        delete_locale
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 6, "Should have 6 locale routes");
    }
}
