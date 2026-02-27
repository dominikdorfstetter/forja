//! Response utilities

use serde::Serialize;

/// Standard API response wrapper
#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub data: T,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<serde_json::Value>,
}

impl<T> ApiResponse<T> {
    pub fn new(data: T) -> Self {
        Self { data, meta: None }
    }

    pub fn with_meta(data: T, meta: serde_json::Value) -> Self {
        Self {
            data,
            meta: Some(meta),
        }
    }
}

/// Empty response for DELETE operations
#[derive(Debug, Serialize)]
pub struct EmptyResponse {
    pub success: bool,
}

impl Default for EmptyResponse {
    fn default() -> Self {
        Self { success: true }
    }
}
