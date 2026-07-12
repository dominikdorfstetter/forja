//! Axum port of `crate::handlers::error_codes`. Returns the static catalog
//! of `errors::codes::ALL` entries — no state, no auth. Mounted under
//! `/api/v1` (so the public path is `/api/v1/error-codes`).

use axum::response::Json;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

use crate::AppState;
use crate::dto::error_codes::{ErrorCodeCatalogResponse, ErrorCodeEntry};
use crate::errors::codes;

#[utoipa::path(
    get,
    path = "/error-codes",
    tag = "System",
    operation_id = "list_error_codes",
    description = "Returns the full catalog of domain-specific error codes with metadata. Use this to programmatically discover all possible error codes the API can return.",
    responses(
        (status = 200, description = "Full error code catalog with descriptions and metadata", body = ErrorCodeCatalogResponse)
    )
)]
async fn list_error_codes() -> Json<ErrorCodeCatalogResponse> {
    let entries: Vec<ErrorCodeEntry> = codes::ALL.iter().map(ErrorCodeEntry::from).collect();
    Json(ErrorCodeCatalogResponse {
        total: entries.len(),
        codes: entries,
    })
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(routes!(list_error_codes))
}
