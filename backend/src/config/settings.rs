//! Application settings

use serde::Deserialize;

use super::{
    AuditConfig, DatabaseConfig, ImprintConfig, PreviewConfig, SecurityConfig, StorageConfig,
};

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

    /// Preview service configuration
    #[serde(default)]
    pub preview: PreviewConfig,

    /// Audit log configuration
    #[serde(default)]
    pub audit: AuditConfig,

    /// Log level
    #[serde(default = "default_log_level")]
    pub log_level: String,

    /// Enable request tracing
    #[serde(default = "default_true")]
    pub enable_tracing: bool,

    /// Demo mode — auto-seeds demo site and auto-joins new users
    #[serde(default)]
    pub demo_mode: bool,

    /// CORS allowed origins (comma-separated)
    #[serde(default)]
    pub cors_origins: Option<String>,

    /// Public URL where this Forja instance is reachable (e.g., "https://cms.example.com").
    #[serde(default = "default_public_url")]
    pub public_url: String,

    /// Deployment-operator imprint (Impressum) details, from `IMPRINT_*` env.
    #[serde(default)]
    pub imprint: ImprintConfig,
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

fn default_public_url() -> String {
    "http://localhost:8000".to_string()
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
            preview: PreviewConfig::default(),
            audit: AuditConfig::default(),
            log_level: default_log_level(),
            enable_tracing: default_true(),
            demo_mode: false,
            cors_origins: None,
            public_url: default_public_url(),
            imprint: ImprintConfig::default(),
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
            .set_default("database.max_connections", 20)?
            .set_default("database.min_connections", 2)?
            .set_default("database.connect_timeout_seconds", 5)?
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
            .set_default("security.rate_limit_per_second", 50)?
            .set_default("security.rate_limit_per_minute", 500)?
            .set_default("security.rate_limit_burst", 20)?
            .set_default("security.max_json_depth", 10)?
            .set_default("security.max_array_items", 1000)?
            .set_default("security.request_timeout_seconds", 30)?
            .set_default("security.enable_cors", true)?
            .set_default("security.cors_allowed_origins", "")?
            .set_default("security.redis_url", "redis://127.0.0.1:6379")?
            .set_default("security.rate_limit_fail_mode", "closed")?
            .set_default("security.trust_proxy_headers", false)?
            // Audit defaults
            .set_default("audit.retention_days", 365)?
            .set_default("public_url", "http://localhost:8000")?
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
            // CORS_ALLOWED_ORIGINS override — short-name parity with the other
            // security env vars (RATE_LIMIT_FAIL_MODE, TRUST_PROXY_HEADERS,
            // CLERK_EXPECTED_*, REDIS_URL). Without this, only the verbose
            // APP__SECURITY__CORS_ALLOWED_ORIGINS works and the startup
            // warning silently lies. Explicit override wins over the APP__
            // env source, matching the precedence of its siblings (issue #494).
            .set_override_option(
                "security.cors_allowed_origins",
                std::env::var("CORS_ALLOWED_ORIGINS").ok(),
            )?
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
            // CLERK_EXPECTED_AUDIENCE override (pins the `aud` claim on incoming JWTs)
            .set_override_option(
                "security.clerk_expected_audience",
                std::env::var("CLERK_EXPECTED_AUDIENCE").ok(),
            )?
            // CLERK_EXPECTED_ISSUER override (pins the `iss` claim on incoming JWTs)
            .set_override_option(
                "security.clerk_expected_issuer",
                std::env::var("CLERK_EXPECTED_ISSUER").ok(),
            )?
            // TLS_CERT_PATH override
            .set_override_option(
                "security.tls_cert_path",
                std::env::var("TLS_CERT_PATH").ok(),
            )?
            // TLS_KEY_PATH override
            .set_override_option("security.tls_key_path", std::env::var("TLS_KEY_PATH").ok())?
            // ENCRYPTION_KEY override (with AI_ENCRYPTION_KEY fallback)
            .set_override_option(
                "security.ai_encryption_key",
                std::env::var("ENCRYPTION_KEY")
                    .or_else(|_| std::env::var("AI_ENCRYPTION_KEY"))
                    .ok(),
            )?
            // DOCUMENT_ENCRYPTION_KEY override
            .set_override_option(
                "security.document_encryption_key",
                std::env::var("DOCUMENT_ENCRYPTION_KEY").ok(),
            )?
            // DOCUMENT_ENCRYPTION_KEY_OLD override (for key rotation)
            .set_override_option(
                "security.document_encryption_key_old",
                std::env::var("DOCUMENT_ENCRYPTION_KEY_OLD").ok(),
            )?
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
            // RATE_LIMIT_FAIL_MODE override ("open" or "closed")
            .set_override_option(
                "security.rate_limit_fail_mode",
                std::env::var("RATE_LIMIT_FAIL_MODE").ok(),
            )?
            // TRUST_PROXY_HEADERS override
            .set_override_option(
                "security.trust_proxy_headers",
                std::env::var("TRUST_PROXY_HEADERS").ok(),
            )?
            // PUBLIC_URL override
            .set_override_option("public_url", std::env::var("PUBLIC_URL").ok())?
            // DEMO_MODE override
            .set_override_option(
                "demo_mode",
                std::env::var("DEMO_MODE").ok().map(|v| v == "true"),
            )?
            // Imprint (Impressum) overrides — operator legal details, runtime
            // only. Required set: NAME + ADDRESS + EMAIL. Never committed.
            .set_override_option(
                "imprint.operator_name",
                std::env::var("IMPRINT_OPERATOR_NAME").ok(),
            )?
            .set_override_option("imprint.address", std::env::var("IMPRINT_ADDRESS").ok())?
            .set_override_option("imprint.email", std::env::var("IMPRINT_EMAIL").ok())?
            .set_override_option("imprint.phone", std::env::var("IMPRINT_PHONE").ok())?
            .set_override_option("imprint.vat", std::env::var("IMPRINT_VAT").ok())?
            .set_override_option("imprint.register", std::env::var("IMPRINT_REGISTER").ok())?
            .set_override_option(
                "imprint.responsible",
                std::env::var("IMPRINT_RESPONSIBLE").ok(),
            )?
            .build()?;

        settings.try_deserialize()
    }

    /// Extract the hostname from `public_url`.
    ///
    /// `"https://cms.example.com"` → `"cms.example.com"`
    /// `"http://localhost:8000"` → `"localhost:8000"`
    pub fn public_domain(&self) -> &str {
        self.public_url
            .strip_prefix("https://")
            .or_else(|| self.public_url.strip_prefix("http://"))
            .unwrap_or(&self.public_url)
            .trim_end_matches('/')
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_public_domain_https() {
        let s = Settings {
            public_url: "https://cms.example.com".to_string(),
            ..Default::default()
        };
        assert_eq!(s.public_domain(), "cms.example.com");
    }

    #[test]
    fn test_public_domain_http_with_port() {
        let s = Settings {
            public_url: "http://localhost:8000".to_string(),
            ..Default::default()
        };
        assert_eq!(s.public_domain(), "localhost:8000");
    }

    #[test]
    fn test_public_domain_trailing_slash() {
        let s = Settings {
            public_url: "https://cms.example.com/".to_string(),
            ..Default::default()
        };
        assert_eq!(s.public_domain(), "cms.example.com");
    }

    #[test]
    fn test_public_domain_bare() {
        let s = Settings {
            public_url: "cms.example.com".to_string(),
            ..Default::default()
        };
        assert_eq!(s.public_domain(), "cms.example.com");
    }

    // --- CORS_ALLOWED_ORIGINS env-var parity (issue #494) ---
    //
    // These tests mutate process-wide env and must run serially. The
    // matching cleanup blocks restore the env to its pre-test state so
    // they don't leak into other serial tests.

    /// Apply an env-var value, removing the variable when `None`.
    ///
    /// SAFETY (edition 2024 makes `set_var`/`remove_var` unsafe): only
    /// called from `#[serial]` tests via `with_cors_env`, so no other
    /// thread reads or writes the environment concurrently.
    fn apply_env(key: &str, value: Option<&str>) {
        match value {
            Some(v) => unsafe { std::env::set_var(key, v) },
            None => unsafe { std::env::remove_var(key) },
        }
    }

    /// Helper: snapshot the two CORS env vars, run a closure with a fresh
    /// environment, then restore. Avoids leaking state into sibling tests
    /// that may run later in the same serial slot.
    fn with_cors_env<F: FnOnce()>(short: Option<&str>, prefixed: Option<&str>, f: F) {
        let prev_short = std::env::var("CORS_ALLOWED_ORIGINS").ok();
        let prev_prefixed = std::env::var("APP__SECURITY__CORS_ALLOWED_ORIGINS").ok();

        apply_env("CORS_ALLOWED_ORIGINS", short);
        apply_env("APP__SECURITY__CORS_ALLOWED_ORIGINS", prefixed);

        f();

        apply_env("CORS_ALLOWED_ORIGINS", prev_short.as_deref());
        apply_env(
            "APP__SECURITY__CORS_ALLOWED_ORIGINS",
            prev_prefixed.as_deref(),
        );
    }

    #[test]
    #[serial_test::serial]
    fn test_cors_allowed_origins_short_name_override() {
        with_cors_env(
            Some("https://a.example.com,https://b.example.com"),
            None,
            || {
                let settings = Settings::load().expect("settings load");
                assert_eq!(
                    settings.security.cors_allowed_origins,
                    "https://a.example.com,https://b.example.com"
                );
            },
        );
    }

    #[test]
    #[serial_test::serial]
    fn test_cors_allowed_origins_prefixed_env_still_works() {
        with_cors_env(None, Some("https://prefixed.example.com"), || {
            let settings = Settings::load().expect("settings load");
            assert_eq!(
                settings.security.cors_allowed_origins,
                "https://prefixed.example.com"
            );
        });
    }

    #[test]
    #[serial_test::serial]
    fn test_cors_allowed_origins_short_name_wins_when_both_set() {
        with_cors_env(
            Some("https://short.example.com"),
            Some("https://prefixed.example.com"),
            || {
                let settings = Settings::load().expect("settings load");
                assert_eq!(
                    settings.security.cors_allowed_origins,
                    "https://short.example.com"
                );
            },
        );
    }
}
