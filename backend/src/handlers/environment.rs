//! Environment handlers

use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;

use crate::dto::environment::EnvironmentResponse;
use crate::errors::{ApiError, ProblemDetails};
use crate::models::environment::Environment;
use crate::AppState;

/// Get all environments
#[utoipa::path(
    tag = "Environments",
    operation_id = "list_environments",
    description = "List all environments",
    responses(
        (status = 200, description = "List of environments", body = Vec<EnvironmentResponse>)
    ),
    security(("api_key" = []))
)]
#[get("/environments")]
pub async fn list_environments(
    state: &State<AppState>,
) -> Result<Json<Vec<EnvironmentResponse>>, ApiError> {
    let environments = Environment::find_all(&state.db).await?;
    let responses: Vec<EnvironmentResponse> = environments
        .into_iter()
        .map(EnvironmentResponse::from)
        .collect();
    Ok(Json(responses))
}

/// Get environment by ID
#[utoipa::path(
    tag = "Environments",
    operation_id = "get_environment",
    description = "Get an environment by ID",
    params(("id" = Uuid, Path, description = "Environment UUID")),
    responses(
        (status = 200, description = "Environment details", body = EnvironmentResponse),
        (status = 404, description = "Environment not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/environments/<id>")]
pub async fn get_environment(
    state: &State<AppState>,
    id: Uuid,
) -> Result<Json<EnvironmentResponse>, ApiError> {
    let environment = Environment::find_by_id(&state.db, id).await?;
    Ok(Json(EnvironmentResponse::from(environment)))
}

/// Get the default environment
#[utoipa::path(
    tag = "Environments",
    operation_id = "get_default_environment",
    description = "Get the default environment",
    responses(
        (status = 200, description = "Default environment", body = EnvironmentResponse),
        (status = 404, description = "No default environment found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/environments/default")]
pub async fn get_default_environment(
    state: &State<AppState>,
) -> Result<Json<EnvironmentResponse>, ApiError> {
    let environment = Environment::find_default(&state.db).await?;
    Ok(Json(EnvironmentResponse::from(environment)))
}

/// Collect environment routes
pub fn routes() -> Vec<Route> {
    routes![list_environments, get_environment, get_default_environment]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 3, "Should have 3 environment routes");
    }
}
