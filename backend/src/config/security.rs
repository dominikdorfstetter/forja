//! Security configuration for the API
//!
//! Defines limits for requests, rate limiting, and other security parameters.

use serde::Deserialize;

/// Controls behavior when Redis is unavailable for rate limiting.
///
/// - `Closed` (default): requests are rejected with 429 — prioritizes security.
///   A Redis outage does not silently bypass quotas, per-key burst limits, or
///   IP-based rate limits. Operators trade availability for correctness, which
///   is the safer default for a public internet deployment.
/// - `Open`: requests are allowed through — prioritizes availability. Use only
///   when you have an independent rate-limiting layer (edge CDN, reverse proxy)
///   and understand that an in-process Redis outage will temporarily unthrottle
///   every endpoint the guard would otherwise protect.
#[derive(Debug, Clone, Default, PartialEq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RateLimitFailMode {
    Open,
    #[default]
    Closed,
}

/// Decide whether the service should refuse to start based on Redis availability
/// and the configured fail mode.
///
/// Returns `Ok(())` if boot may proceed, `Err(message)` if the operator's current
/// configuration would create a silent security gap. The message is suitable for
/// `tracing::error!` and for an `expect(...)` panic.
///
/// The rule: in production, `Closed` fail mode requires a working Redis —
/// otherwise every rate limit is short-circuited (the auth guard's rate-limit
/// block only runs when `state.redis.is_some()`), which is exactly the silent
/// bypass the fail-closed setting is supposed to prevent. Non-production
/// environments (development, staging, demo) stay permissive so local work
/// without Redis remains possible.
pub fn require_redis_when_fail_closed(
    environment: &str,
    redis_available: bool,
    fail_mode: &RateLimitFailMode,
) -> Result<(), String> {
    if environment == "production" && *fail_mode == RateLimitFailMode::Closed && !redis_available {
        return Err(
            "Redis is unavailable but RATE_LIMIT_FAIL_MODE is 'closed' in production. \
             Refusing to start: rate limits would be silently bypassed. \
             Either fix REDIS_URL so Redis connects, or set RATE_LIMIT_FAIL_MODE=open \
             to accept fail-open behavior explicitly."
                .to_string(),
        );
    }
    Ok(())
}

/// Outcome of validating Clerk JWT claim pinning at startup.
///
/// - `Ok(warnings)`: boot may proceed. In non-production environments the vec
///   carries human-readable warnings for each missing pin so the operator can
///   fix their config; empty vec means everything is pinned.
/// - `Err(message)`: refuse to boot. Only returned in production when a pin
///   that should be active is missing.
pub fn validate_clerk_jwt_pinning(
    environment: &str,
    clerk_enabled: bool,
    expected_audience: &str,
    expected_issuer: &str,
) -> Result<Vec<String>, String> {
    if !clerk_enabled {
        return Ok(Vec::new());
    }

    let missing_audience = expected_audience.is_empty();
    let missing_issuer = expected_issuer.is_empty();

    if !missing_audience && !missing_issuer {
        return Ok(Vec::new());
    }

    if environment == "production" {
        let mut parts = Vec::new();
        if missing_audience {
            parts.push("CLERK_EXPECTED_AUDIENCE");
        }
        if missing_issuer {
            parts.push(
                "CLERK_EXPECTED_ISSUER (or a derivable CLERK_PUBLISHABLE_KEY / CLERK_FAPI_DOMAIN)",
            );
        }
        return Err(format!(
            "Clerk JWT validation is missing pin(s): {}. Refusing to start in production: \
             any token signed by keys in the configured JWKS would authenticate regardless \
             of the unpinned claim(s). Set the listed env var(s) so audience and issuer are \
             both validated.",
            parts.join(", ")
        ));
    }

    let mut warnings = Vec::new();
    if missing_audience {
        warnings.push(
            "CLERK_EXPECTED_AUDIENCE is not set — the `aud` claim on incoming Clerk JWTs \
             is not validated. Any token signed by keys in your JWKS will authenticate \
             regardless of which Clerk app or JWT template it was minted for."
                .to_string(),
        );
    }
    if missing_issuer {
        warnings.push(
            "CLERK_EXPECTED_ISSUER could not be set or auto-derived — the `iss` claim on \
             incoming Clerk JWTs is not validated. Tokens from any Clerk instance sharing \
             the configured JWKS URL would authenticate."
                .to_string(),
        );
    }
    Ok(warnings)
}

/// Decide whether the document HMAC signing key is safe at boot.
///
/// Returns `Ok(())` if boot may proceed, `Err(message)` if the deployment is
/// production and `document_encryption_key` is empty. The rule: production must
/// have an explicit signing key for document access tokens. An empty key once
/// fell back to a hardcoded constant compiled into the binary, which meant
/// anyone with read access to the source could forge valid access tokens for
/// every private document. The constant is gone (see
/// `axum_app::handlers::document::resolve_hmac_secret`), and this guard stops
/// a misconfigured prod from booting in that empty-key state.
///
/// Non-production environments stay permissive: a developer who hasn't set the
/// key gets a clear per-request error when they hit the endpoint, not a boot
/// failure that blocks unrelated local work.
pub fn require_document_encryption_key_in_production(
    environment: &str,
    document_encryption_key: &str,
) -> Result<(), String> {
    if environment == "production" && document_encryption_key.is_empty() {
        return Err(
            "DOCUMENT_ENCRYPTION_KEY is empty in production. Refusing to start: \
             private-document access tokens would be signed with an unconfigured \
             HMAC secret. Set DOCUMENT_ENCRYPTION_KEY to a base64-encoded 32-byte \
             key."
                .to_string(),
        );
    }
    Ok(())
}

/// Decide whether a production deployment's CORS configuration is safe.
///
/// Returns `Ok(())` if boot may proceed, `Err(message)` if the operator has
/// configured the wildcard origin `*` in production. A wildcard reflects any
/// origin as allowed, which defeats the purpose of CORS as a defense-in-depth
/// boundary for authenticated and admin routes. Operators who genuinely want
/// this behavior must stage it explicitly — not accept it as a default.
///
/// Non-production environments keep `*` allowed so local development and demo
/// deployments stay ergonomic. The parsed origin list (comma-split, trimmed,
/// non-empty filtered) is passed in so the guard has the same view the CORS
/// fairing has.
pub fn require_non_wildcard_cors_in_production(
    environment: &str,
    parsed_origins: &[String],
) -> Result<(), String> {
    let is_wildcard = parsed_origins.len() == 1 && parsed_origins[0] == "*";
    if environment == "production" && is_wildcard {
        return Err(
            "CORS_ALLOWED_ORIGINS is '*' in production. Refusing to start: the wildcard \
             reflects every origin as allowed and defeats CORS as a defense-in-depth \
             boundary. Replace '*' with the comma-separated list of origins your admin \
             SPA and site frontends actually use."
                .to_string(),
        );
    }
    Ok(())
}

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

    /// Expected `aud` (audience) claim for Clerk JWTs. Empty = audience not checked.
    /// When set, tokens whose `aud` does not match are rejected. Set this to your
    /// Clerk application / JWT-template audience to prevent cross-app token reuse.
    #[serde(default)]
    pub clerk_expected_audience: String,

    /// Expected `iss` (issuer) claim for Clerk JWTs. Empty = issuer not checked.
    /// When set, tokens with a different issuer are rejected. Typically the Clerk
    /// FAPI URL of this instance (e.g. `https://clerk.your-app.com`).
    #[serde(default)]
    pub clerk_expected_issuer: String,

    /// Path to TLS certificate chain (PEM format)
    #[serde(default)]
    pub tls_cert_path: String,

    /// Path to TLS private key (PEM format)
    #[serde(default)]
    pub tls_key_path: String,

    /// Base64-encoded 32-byte key for AES-256-GCM encryption of AI API keys
    #[serde(default)]
    pub ai_encryption_key: String,

    /// Base64-encoded 32-byte key for AES-256-GCM encryption of private document DEKs.
    /// When set, admins can recover encrypted documents without the password.
    #[serde(default)]
    pub document_encryption_key: String,

    /// Previous document encryption key for rotation. Documents encrypted with
    /// this key are lazily re-wrapped with the current key on next access.
    #[serde(default)]
    pub document_encryption_key_old: String,

    /// Rate limit fail mode: "open" allows requests when Redis is down (availability),
    /// "closed" rejects them (security). Default: "closed".
    #[serde(default)]
    pub rate_limit_fail_mode: RateLimitFailMode,

    /// Trust X-Forwarded-For and X-Real-IP headers for client IP extraction.
    /// Enable only when running behind a trusted reverse proxy.
    /// When false, the direct connection IP is used (loopback exempt from rate limiting).
    /// When true, the real client IP is extracted from forwarded headers.
    #[serde(default)]
    pub trust_proxy_headers: bool,

    /// HMAC secret for signing preview tokens. Must be shared with frontend
    /// templates that validate preview tokens for draft content access.
    /// If empty, preview token generation is disabled.
    #[serde(default)]
    pub preview_token_secret: String,

    // ── Anomaly detection ──────────────────────────────────────────────
    /// Enable anomaly detection for API keys (default: true)
    #[serde(default = "default_true")]
    pub anomaly_detection_enabled: bool,

    /// Hourly spike multiplier: block if current hour > N× 7-day hourly average
    #[serde(default = "default_anomaly_hourly_multiplier")]
    pub anomaly_hourly_multiplier: f32,

    /// Daily spike multiplier: block if current day > N× 7-day daily average
    #[serde(default = "default_anomaly_daily_multiplier")]
    pub anomaly_daily_multiplier: f32,

    /// Error rate threshold (0.0–1.0): block if error rate exceeds this
    #[serde(default = "default_anomaly_error_rate_threshold")]
    pub anomaly_error_rate_threshold: f32,

    /// Minimum requests before error rate detection kicks in
    #[serde(default = "default_anomaly_min_requests")]
    pub anomaly_min_requests: u32,

    // ── Auth brute-force rate limiting ────────────────────────────────
    /// Maximum failed auth attempts per IP within the auth rate-limit window.
    /// When exceeded, the IP receives 429 on all auth endpoints until the
    /// window rolls. Default: 5 failures.
    #[serde(default = "default_auth_rate_limit_max_failures")]
    pub auth_rate_limit_max_failures: u32,

    /// Auth rate-limit window in seconds. Failed attempts are counted per IP
    /// within this interval. Default: 900 (15 minutes).
    #[serde(default = "default_auth_rate_limit_window_seconds")]
    pub auth_rate_limit_window_seconds: u64,

    /// Second-tier max failures before a longer IP ban. When exceeded within
    /// the ban window, the IP is blocked for the ban-window duration.
    /// Set to 0 to disable the ban tier. Default: 20.
    #[serde(default = "default_auth_rate_limit_ban_max_failures")]
    pub auth_rate_limit_ban_max_failures: u32,

    /// Ban window in seconds. Default: 3600 (1 hour).
    #[serde(default = "default_auth_rate_limit_ban_window_seconds")]
    pub auth_rate_limit_ban_window_seconds: u64,
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

fn default_anomaly_hourly_multiplier() -> f32 {
    5.0
}

fn default_anomaly_daily_multiplier() -> f32 {
    3.0
}

fn default_anomaly_error_rate_threshold() -> f32 {
    0.5
}

fn default_anomaly_min_requests() -> u32 {
    20
}

fn default_auth_rate_limit_max_failures() -> u32 {
    5
}

fn default_auth_rate_limit_window_seconds() -> u64 {
    900
}

fn default_auth_rate_limit_ban_max_failures() -> u32 {
    20
}

fn default_auth_rate_limit_ban_window_seconds() -> u64 {
    3600
}

fn default_cors_origins() -> String {
    // Default to deny-all. A fresh install should not reflect every origin
    // out-of-the-box; operators must enumerate their allowed origins explicitly.
    // Set CORS_ALLOWED_ORIGINS="*" to opt in to the dev-only wildcard.
    String::new()
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
            clerk_expected_audience: String::new(),
            clerk_expected_issuer: String::new(),
            tls_cert_path: String::new(),
            tls_key_path: String::new(),
            ai_encryption_key: String::new(),
            document_encryption_key: String::new(),
            document_encryption_key_old: String::new(),
            rate_limit_fail_mode: RateLimitFailMode::default(),
            trust_proxy_headers: false,
            preview_token_secret: String::new(),
            anomaly_detection_enabled: default_true(),
            anomaly_hourly_multiplier: default_anomaly_hourly_multiplier(),
            anomaly_daily_multiplier: default_anomaly_daily_multiplier(),
            anomaly_error_rate_threshold: default_anomaly_error_rate_threshold(),
            anomaly_min_requests: default_anomaly_min_requests(),
            auth_rate_limit_max_failures: default_auth_rate_limit_max_failures(),
            auth_rate_limit_window_seconds: default_auth_rate_limit_window_seconds(),
            auth_rate_limit_ban_max_failures: default_auth_rate_limit_ban_max_failures(),
            auth_rate_limit_ban_window_seconds: default_auth_rate_limit_ban_window_seconds(),
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
        assert_eq!(config.rate_limit_fail_mode, RateLimitFailMode::Closed);
        assert!(!config.trust_proxy_headers);
        assert_eq!(config.auth_rate_limit_max_failures, 5);
        assert_eq!(config.auth_rate_limit_window_seconds, 900);
        assert_eq!(config.auth_rate_limit_ban_max_failures, 20);
        assert_eq!(config.auth_rate_limit_ban_window_seconds, 3600);
    }

    #[test]
    fn test_rate_limit_fail_mode_deserialize() {
        let open: RateLimitFailMode = serde_json::from_str("\"open\"").unwrap();
        assert_eq!(open, RateLimitFailMode::Open);

        let closed: RateLimitFailMode = serde_json::from_str("\"closed\"").unwrap();
        assert_eq!(closed, RateLimitFailMode::Closed);
    }

    #[test]
    fn test_rate_limit_fail_mode_default() {
        // Security-safe default: a Redis outage must not silently bypass
        // rate limiting. Operators who want fail-open must opt in explicitly
        // via RATE_LIMIT_FAIL_MODE=open.
        assert_eq!(RateLimitFailMode::default(), RateLimitFailMode::Closed);
    }

    // --- require_redis_when_fail_closed ---

    #[test]
    fn boot_guard_refuses_production_closed_without_redis() {
        let result =
            require_redis_when_fail_closed("production", false, &RateLimitFailMode::Closed);
        assert!(
            result.is_err(),
            "must refuse boot in prod with closed+no-redis"
        );
        let msg = result.unwrap_err();
        assert!(msg.contains("RATE_LIMIT_FAIL_MODE"));
    }

    #[test]
    fn boot_guard_allows_production_closed_with_redis() {
        let result = require_redis_when_fail_closed("production", true, &RateLimitFailMode::Closed);
        assert!(result.is_ok());
    }

    #[test]
    fn boot_guard_allows_production_open_without_redis() {
        // Operator explicitly opted into fail-open; we don't override that choice.
        let result = require_redis_when_fail_closed("production", false, &RateLimitFailMode::Open);
        assert!(result.is_ok());
    }

    #[test]
    fn boot_guard_allows_development_closed_without_redis() {
        // Local development without Redis must stay possible.
        let result =
            require_redis_when_fail_closed("development", false, &RateLimitFailMode::Closed);
        assert!(result.is_ok());
    }

    // --- require_non_wildcard_cors_in_production ---

    #[test]
    fn cors_guard_refuses_wildcard_in_production() {
        let origins = vec!["*".to_string()];
        let result = require_non_wildcard_cors_in_production("production", &origins);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("CORS_ALLOWED_ORIGINS"));
    }

    #[test]
    fn cors_guard_allows_wildcard_in_development() {
        let origins = vec!["*".to_string()];
        let result = require_non_wildcard_cors_in_production("development", &origins);
        assert!(result.is_ok());
    }

    #[test]
    fn cors_guard_allows_explicit_origins_in_production() {
        let origins = vec![
            "https://admin.example.com".to_string(),
            "https://site.example.com".to_string(),
        ];
        let result = require_non_wildcard_cors_in_production("production", &origins);
        assert!(result.is_ok());
    }

    #[test]
    fn cors_guard_allows_empty_in_production() {
        // Empty list = deny all cross-origin. That's safe by definition; the
        // deployment simply doesn't support cross-origin browser calls.
        let origins: Vec<String> = vec![];
        let result = require_non_wildcard_cors_in_production("production", &origins);
        assert!(result.is_ok());
    }

    #[test]
    fn cors_guard_does_not_treat_wildcard_mixed_with_real_origins_as_wildcard() {
        // A misconfigured ["*", "https://real.com"] is not pure wildcard. The
        // fairing's existing fast-path requires a single "*" entry. This guard
        // matches that exact shape — anything else passes through and will be
        // compared as literals, which is safe (real origins only match themselves).
        let origins = vec!["*".to_string(), "https://real.example.com".to_string()];
        let result = require_non_wildcard_cors_in_production("production", &origins);
        assert!(result.is_ok());
    }

    // --- require_document_encryption_key_in_production ---

    #[test]
    fn document_key_guard_refuses_production_when_empty() {
        // Tracer bullet for issue #686: prod with empty key once silently fell
        // back to a hardcoded HMAC constant. The guard must stop boot instead.
        let result = require_document_encryption_key_in_production("production", "");
        assert!(result.is_err(), "must refuse boot in prod with empty key");
        let msg = result.unwrap_err();
        assert!(msg.contains("DOCUMENT_ENCRYPTION_KEY"));
    }

    #[test]
    fn document_key_guard_allows_production_when_set() {
        let result =
            require_document_encryption_key_in_production("production", "base64-32-byte-key-here");
        assert!(result.is_ok());
    }

    #[test]
    fn document_key_guard_allows_development_when_empty() {
        // Local dev without the key must stay possible; handler-level errors
        // surface at request time when the endpoint is actually exercised.
        let result = require_document_encryption_key_in_production("development", "");
        assert!(result.is_ok());
    }

    // --- validate_clerk_jwt_pinning ---

    #[test]
    fn clerk_pinning_ok_when_clerk_disabled() {
        // No Clerk configured: aud/iss don't matter — nothing to warn about.
        let result = validate_clerk_jwt_pinning("production", false, "", "");
        assert_eq!(result.unwrap().len(), 0);
    }

    #[test]
    fn clerk_pinning_ok_when_both_pins_set() {
        let result = validate_clerk_jwt_pinning(
            "production",
            true,
            "forja-prod",
            "https://clerk.example.com",
        );
        assert_eq!(result.unwrap().len(), 0);
    }

    #[test]
    fn clerk_pinning_refuses_production_missing_audience() {
        let result =
            validate_clerk_jwt_pinning("production", true, "", "https://clerk.example.com");
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(msg.contains("CLERK_EXPECTED_AUDIENCE"));
    }

    #[test]
    fn clerk_pinning_refuses_production_missing_issuer() {
        let result = validate_clerk_jwt_pinning("production", true, "forja-prod", "");
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(msg.contains("CLERK_EXPECTED_ISSUER"));
    }

    #[test]
    fn clerk_pinning_refuses_production_missing_both() {
        let result = validate_clerk_jwt_pinning("production", true, "", "");
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(msg.contains("CLERK_EXPECTED_AUDIENCE"));
        assert!(msg.contains("CLERK_EXPECTED_ISSUER"));
    }

    #[test]
    fn clerk_pinning_warns_in_development_missing_audience() {
        let result =
            validate_clerk_jwt_pinning("development", true, "", "https://clerk.example.com");
        let warnings = result.expect("development must not refuse boot");
        assert_eq!(warnings.len(), 1);
        assert!(warnings[0].contains("CLERK_EXPECTED_AUDIENCE"));
    }

    #[test]
    fn clerk_pinning_warns_in_development_missing_both() {
        let result = validate_clerk_jwt_pinning("development", true, "", "");
        let warnings = result.expect("development must not refuse boot");
        assert_eq!(warnings.len(), 2);
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
