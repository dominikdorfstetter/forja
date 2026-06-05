//! Axum port of `crate::handlers::environment`. Three read-only endpoints
//! mounted under `/api/v1` (public paths: `/api/v1/environments`,
//! `/api/v1/environments/default`, `/api/v1/environments/{id}`).
//!
//! The list / get-by-id / get-default trio is the canonical "tiny CRUD"
//! shape and worth getting right once — every read-only resource bundle
//! ported in Phase 4 follows this pattern.

use axum::extract::{Path, State};
use axum::response::Json;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::dto::environment::EnvironmentResponse;
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::models::environment::Environment;
use crate::AppState;

#[utoipa::path(
    get,
    path = "/environments",
    tag = "Environments",
    operation_id = "list_environments",
    description = "List all environments",
    responses(
        (status = 200, description = "List of environments", body = Vec<EnvironmentResponse>),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_environments(
    State(state): State<AppState>,
    _auth: ReadKey,
) -> Result<Json<Vec<EnvironmentResponse>>, ApiError> {
    let environments = Environment::find_all(&state.db).await?;
    let responses: Vec<EnvironmentResponse> = environments
        .into_iter()
        .map(EnvironmentResponse::from)
        .collect();
    Ok(Json(responses))
}

#[utoipa::path(
    get,
    path = "/environments/{id}",
    tag = "Environments",
    operation_id = "get_environment",
    description = "Get an environment by ID",
    params(("id" = Uuid, Path, description = "The UUID of the environment")),
    responses(
        (status = 200, description = "Environment details", body = EnvironmentResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 404, description = "Environment not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_environment(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    _auth: ReadKey,
) -> Result<Json<EnvironmentResponse>, ApiError> {
    let environment = Environment::find_by_id(&state.db, id).await?;
    Ok(Json(EnvironmentResponse::from(environment)))
}

#[utoipa::path(
    get,
    path = "/environments/default",
    tag = "Environments",
    operation_id = "get_default_environment",
    description = "Get the default environment",
    responses(
        (status = 200, description = "Default environment", body = EnvironmentResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 404, description = "Default environment not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_default_environment(
    State(state): State<AppState>,
    _auth: ReadKey,
) -> Result<Json<EnvironmentResponse>, ApiError> {
    let environment = Environment::find_default(&state.db).await?;
    Ok(Json(EnvironmentResponse::from(environment)))
}

/// `/environments/default` is registered before `/environments/{id}` so
/// that Axum's matchit router resolves the literal segment first — same
/// precedence the Rocket build relied on. Order here is load-bearing:
/// flipping the two would still work because matchit prefers static
/// segments, but the explicit ordering documents the invariant.
pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_environments))
        .routes(routes!(get_default_environment))
        .routes(routes!(get_environment))
}
