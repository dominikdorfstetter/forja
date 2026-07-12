//! Axum port of `crate::handlers::locale`. Six endpoints under `/api/v1`:
//! list (with `?include_inactive`), get-by-id, get-by-code, plus
//! admin-gated create/update/delete. This is the first ported bundle
//! that exercises every full-CRUD pattern Phase 4 needs:
//!
//! - `Query<T>` for `?include_inactive=true`
//! - `Json<T>` request body with `validator::Validate` invocation
//! - `AdminKey` extractor on POST/PUT/DELETE
//! - Status-code coupled responses (`201 Created`, `204 NoContent`)
//! - Literal-segment path priority (`/locales/by-code/{code}` ahead of
//!   `/locales/{id}` so matchit resolves "by-code" as a literal)
//!
//! Every CRUD bundle ported after this one follows this exact shape.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::Json;
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::AppState;
use crate::dto::locale::{CreateLocaleRequest, LocaleResponse, UpdateLocaleRequest};
use crate::dto::validated::ValidatedJson;
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::{AdminKey, ReadKey};
use crate::models::locale::Locale;

/// Query parameter wrapper for `?include_inactive=true`. Defining the
/// shape as a struct lets `axum::extract::Query` deserialize it; the
/// `#[utoipa::path(params(...))]` annotation declares it for OpenAPI
/// independently — same pattern used Rocket-side.
#[derive(Debug, Deserialize)]
struct ListLocalesQuery {
    include_inactive: Option<bool>,
}

#[utoipa::path(
    get,
    path = "/locales",
    tag = "Locales",
    operation_id = "list_locales",
    description = "List all locales. Pass include_inactive=true to include inactive locales (admin use).",
    params(
        ("include_inactive" = Option<bool>, Query, description = "Include inactive locales in the response (default: false)")
    ),
    responses(
        (status = 200, description = "List of locales", body = Vec<LocaleResponse>),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_locales(
    State(state): State<AppState>,
    Query(params): Query<ListLocalesQuery>,
    _auth: ReadKey,
) -> Result<Json<Vec<LocaleResponse>>, ApiError> {
    let responses: Vec<LocaleResponse> = if params.include_inactive.unwrap_or(false) {
        Locale::find_all_with_usage(&state.db)
            .await?
            .into_iter()
            .map(LocaleResponse::from)
            .collect()
    } else {
        Locale::find_all(&state.db)
            .await?
            .into_iter()
            .map(LocaleResponse::from)
            .collect()
    };
    Ok(Json(responses))
}

#[utoipa::path(
    get,
    path = "/locales/{id}",
    tag = "Locales",
    operation_id = "get_locale",
    description = "Get a locale by ID",
    params(("id" = Uuid, Path, description = "The UUID of the locale")),
    responses(
        (status = 200, description = "Locale details", body = LocaleResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 404, description = "Locale not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_locale(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    _auth: ReadKey,
) -> Result<Json<LocaleResponse>, ApiError> {
    let locale = Locale::find_by_id(&state.db, id).await?;
    Ok(Json(LocaleResponse::from(locale)))
}

#[utoipa::path(
    get,
    path = "/locales/by-code/{code}",
    tag = "Locales",
    operation_id = "get_locale_by_code",
    description = "Get a locale by its language code",
    params(("code" = String, Path, description = "ISO 639-1 language code (e.g. en, de, fr)")),
    responses(
        (status = 200, description = "Locale details", body = LocaleResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 404, description = "Locale not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_locale_by_code(
    State(state): State<AppState>,
    Path(code): Path<String>,
    _auth: ReadKey,
) -> Result<Json<LocaleResponse>, ApiError> {
    let locale = Locale::find_by_code(&state.db, &code).await?;
    Ok(Json(LocaleResponse::from(locale)))
}

#[utoipa::path(
    post,
    path = "/locales",
    tag = "Locales",
    operation_id = "create_locale",
    description = "Create a new locale (admin only)",
    request_body(content = CreateLocaleRequest, description = "Locale creation data"),
    responses(
        (status = 201, description = "Locale created", body = LocaleResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 409, description = "Locale with this code already exists", body = ProblemDetails),
        (status = 422, description = "Validation error", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn create_locale(
    State(state): State<AppState>,
    _auth: AdminKey,
    ValidatedJson(body): ValidatedJson<CreateLocaleRequest>,
) -> Result<(StatusCode, Json<LocaleResponse>), ApiError> {
    let locale = Locale::create(&state.db, &body).await?;
    Ok((StatusCode::CREATED, Json(LocaleResponse::from(locale))))
}

#[utoipa::path(
    put,
    path = "/locales/{id}",
    tag = "Locales",
    operation_id = "update_locale",
    description = "Update a locale (admin only)",
    params(("id" = Uuid, Path, description = "Locale UUID")),
    request_body(content = UpdateLocaleRequest, description = "Locale update data"),
    responses(
        (status = 200, description = "Locale updated", body = LocaleResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Locale not found", body = ProblemDetails),
        (status = 422, description = "Validation error", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn update_locale(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    _auth: AdminKey,
    ValidatedJson(body): ValidatedJson<UpdateLocaleRequest>,
) -> Result<Json<LocaleResponse>, ApiError> {
    let locale = Locale::update(&state.db, id, &body).await?;
    Ok(Json(LocaleResponse::from(locale)))
}

#[utoipa::path(
    delete,
    path = "/locales/{id}",
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
async fn delete_locale(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    _auth: AdminKey,
) -> Result<StatusCode, ApiError> {
    Locale::delete(&state.db, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// `/locales/by-code/{code}` is registered before `/locales/{id}` for
/// the same reason as `environment::router()` — explicit ordering
/// documents the literal-over-parametric matchit precedence even though
/// the framework would resolve it correctly either way.
pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_locales, create_locale))
        .routes(routes!(get_locale_by_code))
        .routes(routes!(get_locale, update_locale, delete_locale))
}
