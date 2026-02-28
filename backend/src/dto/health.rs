//! Health check DTOs

use serde::Serialize;

/// Overall health status of the API and its dependencies
#[derive(Serialize, utoipa::ToSchema)]
#[schema(description = "Overall health status of the API and its dependencies")]
pub struct HealthResponse {
    /// Overall status: "healthy", "degraded", or "unhealthy"
    #[schema(example = "healthy")]
    pub status: String,
    /// API version from Cargo.toml
    #[schema(example = "1.0.1")]
    pub version: String,
    /// Individual service health checks
    pub services: Vec<ServiceHealth>,
    /// Storage backend health (if available)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub storage: Option<StorageHealth>,
}

/// Health status of the storage backend
#[derive(Serialize, utoipa::ToSchema)]
#[schema(description = "Health status of the storage backend")]
pub struct StorageHealth {
    /// Service name, e.g. "storage (local)" or "storage (s3)"
    #[schema(example = "storage (local)")]
    pub name: String,
    /// Service status: "up" or "down"
    #[schema(example = "up")]
    pub status: String,
    /// Response latency in milliseconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<u64>,
    /// Error message if the service is down
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// Storage provider: "local" or "s3"
    #[schema(example = "local")]
    pub provider: String,
    /// Total bytes on disk (local only)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_bytes: Option<u64>,
    /// Available bytes on disk (local only)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub available_bytes: Option<u64>,
    /// Percentage of disk used (local only)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub used_percent: Option<f64>,
    /// S3 bucket name (S3 only)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bucket: Option<String>,
}

/// Health status of an individual service dependency
#[derive(Serialize, utoipa::ToSchema)]
#[schema(description = "Health status of an individual service dependency")]
pub struct ServiceHealth {
    /// Service name
    #[schema(example = "database")]
    pub name: String,
    /// Service status: "up", "down", or "disabled"
    #[schema(example = "up")]
    pub status: String,
    /// Response latency in milliseconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<u64>,
    /// Error message if the service is down
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
