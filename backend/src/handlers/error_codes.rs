//! Error code catalog endpoint

use rocket::serde::json::Json;
use rocket::Route;

use crate::dto::error_codes::{ErrorCodeCatalogResponse, ErrorCodeEntry};
use crate::errors::codes;

/// List all registered error codes
#[utoipa::path(
    tag = "System",
    operation_id = "list_error_codes",
    description = "Returns the full catalog of domain-specific error codes with metadata. Use this to programmatically discover all possible error codes the API can return.",
    responses(
        (status = 200, description = "Full error code catalog with descriptions and metadata", body = ErrorCodeCatalogResponse)
    )
)]
#[get("/error-codes")]
pub fn list_error_codes() -> Json<ErrorCodeCatalogResponse> {
    let entries: Vec<ErrorCodeEntry> = codes::ALL.iter().map(ErrorCodeEntry::from).collect();
    Json(ErrorCodeCatalogResponse {
        total: entries.len(),
        codes: entries,
    })
}

pub fn routes() -> Vec<Route> {
    routes![list_error_codes]
}
