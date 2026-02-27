//! Application settings

use serde::Deserialize;

use super::{DatabaseConfig, SecurityConfig, StorageConfig};

/// Application settings
#[derive(Debug, Clone, Deserialize)]
pub struct Settings {
    /// Application environment (development, staging, production)
    #[serde(default = "default_environment")]
    pub environment: String,

    /// Server host
    #[serde(default = "default_host")]
    pub host: String,

    /// Server port
    #[serde(default = "default_port")]
    pub port: u16,

    /// Database configuration
    #[serde(default)]
    pub database: DatabaseConfig,

    /// Security configuration
    #[serde(default)]
    pub security: SecurityConfig,

    /// Storage configuration
    #[serde(default)]
    pub storage: StorageConfig,

    /// Log level
    #[serde(default = "default_log_level")]
    pub log_level: String,

    /// Enable request tracing
    #[serde(default = "default_true")]
    pub enable_tracing: bool,

    /// CORS allowed origins (comma-separated)
    #[serde(default)]
    pub cors_origins: Option<String>,
}

fn default_environment() -> String {
    "development".to_string()
}

fn default_host() -> String {
    "0.0.0.0".to_string()
}

fn default_port() -> u16 {
    8000
}

fn default_log_level() -> String {
    "info".to_string()
}

fn default_true() -> bool {
    true
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            environment: default_environment(),
            host: default_host(),
            port: default_port(),
            database: DatabaseConfig::default(),
            security: SecurityConfig::default(),
            storage: StorageConfig::default(),
            log_level: default_log_level(),
            enable_tracing: default_true(),
            cors_origins: None,
        }
    }
}

impl Settings {
    /// Load settings from environment variables
    pub fn load() -> Result<Self, config::ConfigError> {
        // Load .env file if it exists
        let _ = dotenvy::dotenv();

        let settings = config::Config::builder()
            // Start with defaults
            .set_default("environment", "development")?
            .set_default("host", "0.0.0.0")?
            .set_default("port", 8000)?
            .set_default("log_level", "info")?
            .set_default("enable_tracing", true)?
            // Database defaults
            .set_default("database.max_connections", 10)?
            .set_default("database.min_connections", 1)?
            .set_default("database.connect_timeout_seconds", 30)?
            .set_default("database.idle_timeout_seconds", 600)?
            // Storage defaults
            .set_default("storage.provider", "local")?
            .set_default("storage.local_upload_dir", "./uploads")?
            .set_default("storage.local_base_url", "/uploads")?
            // Security defaults
            .set_default("security.max_body_size", 10 * 1024 * 1024)?
            .set_default("security.max_json_size", 15 * 1024 * 1024)?
            .set_default("security.max_form_size", 10 * 1024 * 1024)?
            .set_default("security.max_file_size", 50 * 1024 * 1024)?
            .set_default("security.rate_limit_per_second", 10)?
            .set_default("security.rate_limit_per_minute", 100)?
            .set_default("security.rate_limit_burst", 20)?
            .set_default("security.max_json_depth", 10)?
            .set_default("security.max_array_items", 1000)?
            .set_default("security.request_timeout_seconds", 30)?
            .set_default("security.enable_cors", true)?
            .set_default("security.cors_allowed_origins", "*")?
            .set_default("security.redis_url", "redis://127.0.0.1:6379")?
            // Override with environment variables
            .add_source(
                config::Environment::default()
                    .prefix("APP")
                    .separator("__")
                    .try_parsing(true),
            )
            // DATABASE_URL is a common convention
            .set_override_option("database.url", std::env::var("DATABASE_URL").ok())?
            // REDIS_URL override
            .set_override_option("security.redis_url", std::env::var("REDIS_URL").ok())?
            // CLERK_SECRET_KEY override
            .set_override_option(
                "security.clerk_secret_key",
                std::env::var("CLERK_SECRET_KEY").ok(),
            )?
            // CLERK_PUBLISHABLE_KEY override
            .set_override_option(
                "security.clerk_publishable_key",
                std::env::var("CLERK_PUBLISHABLE_KEY").ok(),
            )?
            // SYSTEM_ADMIN_CLERK_IDS override
            .set_override_option(
                "security.system_admin_clerk_ids",
                std::env::var("SYSTEM_ADMIN_CLERK_IDS").ok(),
            )?
            // TLS_CERT_PATH override
            .set_override_option(
                "security.tls_cert_path",
                std::env::var("TLS_CERT_PATH").ok(),
            )?
            // TLS_KEY_PATH override
            .set_override_option("security.tls_key_path", std::env::var("TLS_KEY_PATH").ok())?
            // Storage overrides
            .set_override_option("storage.provider", std::env::var("STORAGE_PROVIDER").ok())?
            .set_override_option(
                "storage.local_upload_dir",
                std::env::var("STORAGE_LOCAL_UPLOAD_DIR").ok(),
            )?
            .set_override_option(
                "storage.local_base_url",
                std::env::var("STORAGE_LOCAL_BASE_URL").ok(),
            )?
            .set_override_option("storage.s3_bucket", std::env::var("STORAGE_S3_BUCKET").ok())?
            .set_override_option("storage.s3_region", std::env::var("STORAGE_S3_REGION").ok())?
            .set_override_option("storage.s3_prefix", std::env::var("STORAGE_S3_PREFIX").ok())?
            .set_override_option(
                "storage.s3_endpoint",
                std::env::var("STORAGE_S3_ENDPOINT").ok(),
            )?
            .build()?;

        settings.try_deserialize()
    }

    /// Check if running in development mode
    pub fn is_development(&self) -> bool {
        self.environment == "development"
    }

    /// Check if running in production mode
    pub fn is_production(&self) -> bool {
        self.environment == "production"
    }
}
