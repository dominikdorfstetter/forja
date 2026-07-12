//! Axum port of `crate::handlers::config`. Public, no-auth endpoint that
//! the admin SPA hits at boot to discover the Clerk publishable key,
//! demo-mode flag, and app branding. Mounted under `/api/v1` (public
//! path: `/api/v1/config`).

use axum::extract::State;
use axum::response::Json;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

use crate::AppState;
use crate::dto::config::ConfigResponse;

#[utoipa::path(
    get,
    path = "/config",
    tag = "System",
    operation_id = "get_config",
    description = "Get public frontend configuration (no authentication required)",
    responses(
        (status = 200, description = "Public configuration", body = ConfigResponse)
    )
)]
async fn get_config(State(state): State<AppState>) -> Json<ConfigResponse> {
    Json(ConfigResponse {
        clerk_publishable_key: state.settings.security.clerk_publishable_key.clone(),
        app_name: "Forja".to_string(),
        demo_mode: state.settings.demo_mode,
    })
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(routes!(get_config))
}
