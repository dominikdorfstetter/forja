//! Configuration module for the API
//!
//! Handles loading and parsing of configuration from environment variables
//! and configuration files.

mod audit;
mod database;
mod imprint;
pub mod preview;
mod security;
mod settings;
mod storage;

pub use audit::AuditConfig;
pub use database::DatabaseConfig;
pub use imprint::ImprintConfig;
pub use preview::PreviewConfig;
pub use security::{
    require_document_encryption_key_in_production, require_non_wildcard_cors_in_production,
    require_redis_when_fail_closed, validate_clerk_jwt_pinning, RateLimitFailMode, SecurityConfig,
};
pub use settings::Settings;
pub use storage::StorageConfig;
