//! Error code catalog DTOs

use serde::Serialize;
use utoipa::ToSchema;

use crate::errors::codes::ErrorCodeDef;

/// Response for GET /error-codes — the full error code catalog.
#[derive(Debug, Serialize, ToSchema)]
pub struct ErrorCodeCatalogResponse {
    /// Total number of registered error codes
    pub total: usize,
    /// All registered error codes with metadata
    pub codes: Vec<ErrorCodeEntry>,
}

/// A single entry in the error code catalog.
#[derive(Debug, Serialize, ToSchema)]
pub struct ErrorCodeEntry {
    /// Machine-readable error code
    #[schema(example = "BLOG_NOT_FOUND")]
    pub code: String,
    /// Domain this code belongs to
    #[schema(example = "blog")]
    pub domain: String,
    /// HTTP status code this error typically produces
    #[schema(example = 404)]
    pub http_status: u16,
    /// Human-readable description
    #[schema(example = "The requested blog post does not exist")]
    pub description: String,
}

impl From<&ErrorCodeDef> for ErrorCodeEntry {
    fn from(def: &ErrorCodeDef) -> Self {
        Self {
            code: def.code.to_string(),
            domain: def.domain.to_string(),
            http_status: def.http_status,
            description: def.description.to_string(),
        }
    }
}
