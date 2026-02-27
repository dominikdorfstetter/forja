//! Public configuration endpoint
//!
//! Serves runtime configuration to the admin dashboard (no auth required).

use rocket::serde::json::Json;
use rocket::{Route, State};

use crate::dto::config::ConfigResponse;
use crate::AppState;

/// Get public frontend configuration
#[utoipa::path(
    tag = "System",
    operation_id = "get_config",
    description = "Get public frontend configuration (no authentication required)",
    responses(
        (status = 200, description = "Public configuration", body = ConfigResponse)
    )
)]
#[get("/config")]
pub async fn get_config(state: &State<AppState>) -> Json<ConfigResponse> {
    Json(ConfigResponse {
        clerk_publishable_key: state.settings.security.clerk_publishable_key.clone(),
        app_name: "OpenYapper".to_string(),
    })
}

/// Collect config routes
pub fn routes() -> Vec<Route> {
    routes![get_config]
}
