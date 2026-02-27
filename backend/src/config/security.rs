//! Security configuration for the API
//!
//! Defines limits for requests, rate limiting, and other security parameters.

use serde::Deserialize;

/// Security configuration
#[derive(Debug, Clone, Deserialize)]
pub struct SecurityConfig {
    /// Maximum request body size in bytes (default: 10MB)
    #[serde(default = "default_max_body_size")]
    pub max_body_size: usize,

    /// Maximum JSON request body size in bytes (default: 15MB)
    #[serde(default = "default_max_json_size")]
    pub max_json_size: usize,

    /// Maximum form data size in bytes (default: 10MB)
    #[serde(default = "default_max_form_size")]
    pub max_form_size: usize,

    /// Maximum file upload size in bytes (default: 50MB)
    #[serde(default = "default_max_file_size")]
    pub max_file_size: usize,

    /// Rate limiting: requests per second per IP
    #[serde(default = "default_rate_limit_per_second")]
    pub rate_limit_per_second: u32,

    /// Rate limiting: requests per minute per IP
    #[serde(default = "default_rate_limit_per_minute")]
    pub rate_limit_per_minute: u32,

    /// Rate limiting: burst size (max concurrent requests)
    #[serde(default = "default_rate_limit_burst")]
    pub rate_limit_burst: u32,

    /// Maximum JSON nesting depth
    #[serde(default = "default_max_json_depth")]
    pub max_json_depth: usize,

    /// Maximum number of items in arrays/lists
    #[serde(default = "default_max_array_items")]
    pub max_array_items: usize,

    /// Request timeout in seconds
    #[serde(default = "default_request_timeout")]
    pub request_timeout_seconds: u64,

    /// Enable CORS
    #[serde(default = "default_true")]
    pub enable_cors: bool,

    /// Allowed CORS origins (comma-separated, or * for all)
    #[serde(default = "default_cors_origins")]
    pub cors_allowed_origins: String,

    /// Redis URL for rate limiting
    #[serde(default = "default_redis_url")]
    pub redis_url: String,

    /// Clerk secret key for JWT validation (empty = Clerk auth disabled)
    #[serde(default)]
    pub clerk_secret_key: String,

    /// Clerk publishable key for frontend auth (served via /api/v1/config)
    #[serde(default)]
    pub clerk_publishable_key: String,

    /// Comma-separated Clerk user IDs to seed as system admins on startup
    #[serde(default)]
    pub system_admin_clerk_ids: String,

    /// Path to TLS certificate chain (PEM format)
    #[serde(default)]
    pub tls_cert_path: String,

    /// Path to TLS private key (PEM format)
    #[serde(default)]
    pub tls_key_path: String,
}

// 10 MB
fn default_max_body_size() -> usize {
    10 * 1024 * 1024
}

// 15 MB (supports base64-encoded file uploads up to 10MB)
fn default_max_json_size() -> usize {
    15 * 1024 * 1024
}

// 10 MB
fn default_max_form_size() -> usize {
    10 * 1024 * 1024
}

// 50 MB
fn default_max_file_size() -> usize {
    50 * 1024 * 1024
}

fn default_rate_limit_per_second() -> u32 {
    50
}

fn default_rate_limit_per_minute() -> u32 {
    500
}

fn default_rate_limit_burst() -> u32 {
    20
}

fn default_max_json_depth() -> usize {
    10
}

fn default_max_array_items() -> usize {
    1000
}

fn default_request_timeout() -> u64 {
    30
}

fn default_true() -> bool {
    true
}

fn default_cors_origins() -> String {
    "*".to_string()
}

fn default_redis_url() -> String {
    "redis://127.0.0.1:6379".to_string()
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            max_body_size: default_max_body_size(),
            max_json_size: default_max_json_size(),
            max_form_size: default_max_form_size(),
            max_file_size: default_max_file_size(),
            rate_limit_per_second: default_rate_limit_per_second(),
            rate_limit_per_minute: default_rate_limit_per_minute(),
            rate_limit_burst: default_rate_limit_burst(),
            max_json_depth: default_max_json_depth(),
            max_array_items: default_max_array_items(),
            request_timeout_seconds: default_request_timeout(),
            enable_cors: default_true(),
            cors_allowed_origins: default_cors_origins(),
            redis_url: default_redis_url(),
            clerk_secret_key: String::new(),
            clerk_publishable_key: String::new(),
            system_admin_clerk_ids: String::new(),
            tls_cert_path: String::new(),
            tls_key_path: String::new(),
        }
    }
}

impl SecurityConfig {
    /// Get request limits formatted for Rocket configuration
    pub fn rocket_limits(&self) -> Vec<(&'static str, usize)> {
        vec![
            ("bytes", self.max_body_size),
            ("data-form", self.max_form_size),
            ("file", self.max_file_size),
            ("json", self.max_json_size),
            ("msgpack", self.max_json_size),
            ("string", self.max_body_size),
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_security_config_defaults() {
        let config = SecurityConfig::default();
        assert_eq!(config.max_body_size, 10 * 1024 * 1024);
        assert_eq!(config.max_json_size, 15 * 1024 * 1024);
        assert_eq!(config.rate_limit_per_second, 50);
        assert_eq!(config.rate_limit_per_minute, 500);
    }

    #[test]
    fn test_rocket_limits() {
        let config = SecurityConfig::default();
        let limits = config.rocket_limits();
        assert!(!limits.is_empty());

        // Check JSON limit
        let json_limit = limits.iter().find(|(k, _)| *k == "json");
        assert!(json_limit.is_some());
        assert_eq!(json_limit.unwrap().1, 15 * 1024 * 1024);
    }
}
