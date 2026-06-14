//! Auth-key types shared across the binary. The Axum extractors in
//! `axum_app::extractors` produce these types after running each
//! authentication strategy; downstream handler code matches on
//! `AuthSource` and consumes the wrapper key types
//! (`ReadKey`, `WriteKey`, `AdminKey`, `MasterKey`) for permission gating.

use uuid::Uuid;

use sqlx::PgPool;

use crate::errors::codes;
use crate::errors::ApiError;
use crate::models::api_key::ApiKeyPermission;
use crate::models::site_membership::{SiteMembership, SiteRole};
use crate::services::url_validation;

/// Header name for API key
pub const API_KEY_HEADER: &str = "X-API-Key";
pub const PREVIEW_TOKEN_HEADER: &str = "X-Preview-Token";

/// Check whether an IP string represents a loopback address (exempt from IP rate limiting).
///
/// Only applies to the resolved client IP — when `trust_proxy_headers` is enabled,
/// the real client IP is extracted from forwarded headers, so this check won't
/// match for proxied production traffic.
pub(crate) fn is_loopback(ip: &str) -> bool {
    ip == "127.0.0.1" || ip == "::1" || ip == "localhost"
}

/// Resolve the best client IP from forwarded headers + direct connection IP.
///
/// When `trust_proxy_headers` is true, prefers `X-Forwarded-For` (first entry),
/// then `X-Real-IP`, then falls back to `direct_ip`.
///
/// **Security**: only enable `trust_proxy_headers` when running behind a trusted
/// reverse proxy. An untrusted client can forge these headers to bypass rate limiting.
pub(crate) fn resolve_client_ip(
    xff_header: Option<&str>,
    real_ip_header: Option<&str>,
    direct_ip: &str,
    trust_proxy_headers: bool,
) -> String {
    if trust_proxy_headers {
        // X-Forwarded-For: client, proxy1, proxy2 — leftmost is the original client
        if let Some(xff) = xff_header {
            let first_ip = xff.split(',').next().unwrap_or("").trim();
            if !first_ip.is_empty() {
                return first_ip.to_string();
            }
        }
        // X-Real-IP: single IP set by the proxy
        if let Some(real_ip) = real_ip_header {
            let trimmed = real_ip.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }
    direct_ip.to_string()
}

/// Namespace UUID for generating deterministic Clerk user UUIDs
pub const CLERK_UUID_NAMESPACE: Uuid = Uuid::from_bytes([
    0x6b, 0xa7, 0xb8, 0x10, 0x9d, 0xad, 0x11, 0xd1, 0x80, 0xb4, 0x00, 0xc0, 0x4f, 0xd4, 0x30, 0xc8,
]);

/// Tracks the source of authentication.
///
/// Preview tokens are a first-class variant rather than an `ApiKey` flagged by
/// a sentinel id: holding `AuthSource::PreviewToken { site_id }` is itself the
/// proof that the preview strategy resolved the request, and the scoped site is
/// carried on the variant.
#[derive(Debug, Clone)]
pub enum AuthSource {
    ApiKey,
    ClerkJwt { clerk_user_id: String },
    PreviewToken { site_id: Uuid },
}

/// Authenticated API key guard
#[derive(Debug, Clone)]
pub struct AuthenticatedKey {
    pub id: Uuid,
    pub permission: ApiKeyPermission,
    pub site_id: Option<Uuid>,
    pub auth_source: AuthSource,
}

impl AuthenticatedKey {
    /// Check if this key can manage API keys
    pub fn can_manage_keys(&self) -> bool {
        self.permission.can_manage_keys()
    }

    /// Check if this key can write content
    pub fn can_write(&self) -> bool {
        self.permission.can_write()
    }

    /// Check if this key has admin access
    pub fn is_admin(&self) -> bool {
        self.permission.is_admin()
    }

    /// Get a stable user identifier for ownership checks.
    ///
    /// Returns the Clerk user ID for JWT auth, or `None` for API keys
    /// (API keys are not "users" and don't own content).
    pub fn user_identifier(&self) -> Option<&str> {
        match &self.auth_source {
            AuthSource::ClerkJwt { clerk_user_id } => Some(clerk_user_id),
            AuthSource::ApiKey | AuthSource::PreviewToken { .. } => None,
        }
    }

    /// Check if this key has access to a specific site
    pub fn has_site_access(&self, site_id: Uuid) -> bool {
        match self.site_id {
            None => true, // No site restriction = access to all sites
            Some(key_site_id) => key_site_id == site_id,
        }
    }

    /// Returns Err(Forbidden) if this key doesn't have access to the given site
    pub fn ensure_site_access(&self, site_id: Uuid) -> Result<(), ApiError> {
        if self.has_site_access(site_id) {
            Ok(())
        } else {
            Err(
                ApiError::forbidden("API key does not have access to this site")
                    .with_code(codes::AUTH_API_KEY_SITE_DENIED),
            )
        }
    }

    /// Returns true if this key is scoped to a specific site
    pub fn is_site_scoped(&self) -> bool {
        self.site_id.is_some()
    }

    /// Get the Clerk user ID if authenticated via Clerk JWT
    pub fn clerk_user_id(&self) -> Option<&str> {
        match &self.auth_source {
            AuthSource::ClerkJwt { clerk_user_id } => Some(clerk_user_id),
            AuthSource::ApiKey | AuthSource::PreviewToken { .. } => None,
        }
    }

    /// Resolve the effective site role for this auth context.
    /// - Clerk users: look up site_memberships (system admins get Owner)
    /// - API keys: map ApiKeyPermission to equivalent SiteRole
    pub async fn effective_site_role(
        &self,
        pool: &PgPool,
        site_id: Uuid,
    ) -> Result<Option<SiteRole>, ApiError> {
        match &self.auth_source {
            AuthSource::ClerkJwt { clerk_user_id } => {
                // System admins have implicit Owner on all sites
                if SiteMembership::is_system_admin(pool, clerk_user_id).await? {
                    return Ok(Some(SiteRole::Owner));
                }
                // Look up membership
                let membership =
                    SiteMembership::find_by_clerk_user_and_site(pool, clerk_user_id, site_id)
                        .await?;
                Ok(membership.map(|m| m.role))
            }
            AuthSource::ApiKey => {
                // Check site access first
                if !self.has_site_access(site_id) {
                    return Ok(None);
                }
                // Map API key permission to SiteRole
                let role = match self.permission {
                    ApiKeyPermission::Master => SiteRole::Owner,
                    ApiKeyPermission::Admin => SiteRole::Admin,
                    ApiKeyPermission::Write => SiteRole::Editor,
                    ApiKeyPermission::Read => SiteRole::Viewer,
                };
                Ok(Some(role))
            }
            AuthSource::PreviewToken { site_id: scoped } => {
                // Preview tokens are read-only Viewers on their scoped site only.
                if *scoped == site_id {
                    Ok(Some(SiteRole::Viewer))
                } else {
                    Ok(None)
                }
            }
        }
    }

    /// Require at least the given site role, returning Forbidden if insufficient.
    pub async fn require_site_role(
        &self,
        pool: &PgPool,
        site_id: Uuid,
        min_role: &SiteRole,
    ) -> Result<SiteRole, ApiError> {
        let role = self
            .effective_site_role(pool, site_id)
            .await?
            .ok_or_else(|| {
                ApiError::forbidden("You do not have access to this site")
                    .with_code(codes::AUTH_SITE_ACCESS_DENIED)
            })?;

        if role.has_at_least(min_role) {
            Ok(role)
        } else {
            Err(
                ApiError::forbidden(format!("Requires at least {} role on this site", min_role))
                    .with_code(codes::AUTH_INSUFFICIENT_ROLE),
            )
        }
    }

    /// Check if this user is a system admin
    pub async fn is_system_admin(&self, pool: &PgPool) -> Result<bool, ApiError> {
        match &self.auth_source {
            AuthSource::ClerkJwt { clerk_user_id } => {
                SiteMembership::is_system_admin(pool, clerk_user_id).await
            }
            AuthSource::ApiKey => Ok(self.permission == ApiKeyPermission::Master),
            AuthSource::PreviewToken { .. } => Ok(false),
        }
    }

    /// Unified site action authorization.
    /// Returns Ok(()) if the user has at least the required role.
    pub async fn authorize_site_action(
        &self,
        pool: &PgPool,
        site_id: Uuid,
        min_role: &SiteRole,
    ) -> Result<(), ApiError> {
        self.require_site_role(pool, site_id, min_role).await?;
        Ok(())
    }
}

/// JWT claims we expect from Clerk
#[derive(Debug, serde::Deserialize)]
struct ClerkJwtClaims {
    /// Clerk user ID (e.g. "user_2abc...")
    sub: String,
}

/// Check if a Clerk user is suspended or banned.
///
/// - Active: Ok(())
/// - Suspended (not expired): Err(403 ACCOUNT_SUSPENDED)
/// - Suspended (expired): auto-unsuspend → Ok(())
/// - Banned: Err(403 ACCOUNT_BANNED)
pub(crate) async fn check_moderation_status(
    pool: &sqlx::PgPool,
    clerk_user_id: &str,
) -> Result<(), ApiError> {
    use crate::models::user_moderation::{UserModeration, UserModerationStatus};

    // Only check if a moderation record exists (most users won't have one)
    let record = sqlx::query_as::<_, UserModeration>(
        "SELECT * FROM user_moderation WHERE clerk_user_id = $1",
    )
    .bind(clerk_user_id)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    let Some(record) = record else {
        return Ok(()); // No record = active
    };

    match record.status {
        UserModerationStatus::Active => Ok(()),
        UserModerationStatus::Suspended => {
            // Check if suspension has expired
            if let Some(expires_at) = record.suspension_expires_at {
                if expires_at <= chrono::Utc::now() {
                    // Auto-unsuspend
                    let _ = UserModeration::unsuspend(pool, clerk_user_id, "system").await;
                    return Ok(());
                }
                Err(ApiError::forbidden(format!(
                    "Your account is suspended until {}. Reason: {}",
                    expires_at.to_rfc3339(),
                    record.status_reason.as_deref().unwrap_or("Not specified")
                ))
                .with_code(codes::ACCOUNT_SUSPENDED))
            } else {
                // Indefinite suspension
                Err(ApiError::forbidden(format!(
                    "Your account is suspended. Reason: {}",
                    record.status_reason.as_deref().unwrap_or("Not specified")
                ))
                .with_code(codes::ACCOUNT_SUSPENDED))
            }
        }
        UserModerationStatus::Banned => Err(ApiError::forbidden(format!(
            "Your account has been permanently banned. Reason: {}",
            record.status_reason.as_deref().unwrap_or("Not specified")
        ))
        .with_code(codes::ACCOUNT_BANNED)),
    }
}

// --- Clerk JWKS caching ---

/// Build the JWT validation configuration for Clerk tokens.
///
/// - Always RS256 (Clerk's signing algorithm) with default expiry / not-before checks.
/// - When `expected_audience` is `Some(non-empty)`, enables `aud` validation and pins the value.
/// - When `expected_issuer` is `Some(non-empty)`, pins the expected `iss` claim.
/// - Empty strings are treated as "not configured" — this matches the env-var
///   convention where an unset variable deserializes into `""` via `#[serde(default)]`.
///
/// When neither is configured, behavior matches the pre-hardening default: any
/// Clerk-signed token with a matching JWKS `kid` is accepted. That preserves
/// backward compatibility for deployments that haven't set the new env vars.
fn build_validation(
    expected_audience: Option<&str>,
    expected_issuer: Option<&str>,
) -> jsonwebtoken::Validation {
    let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::RS256);

    match expected_audience.filter(|s| !s.is_empty()) {
        Some(aud) => validation.set_audience(&[aud]),
        None => {
            // Preserve legacy behavior: don't reject tokens just because they
            // carry an `aud` claim the operator hasn't configured expectations for.
            validation.validate_aud = false;
        }
    }

    if let Some(iss) = expected_issuer.filter(|s| !s.is_empty()) {
        validation.set_issuer(&[iss]);
    }

    validation
}

/// Cached JWKS state managed by Rocket
pub struct ClerkJwksState {
    jwks_url: String,
    expected_audience: String,
    expected_issuer: String,
    cache: tokio::sync::RwLock<Option<CachedJwks>>,
}

struct CachedJwks {
    keys: jsonwebtoken::jwk::JwkSet,
    fetched_at: std::time::Instant,
}

impl ClerkJwksState {
    pub fn new(clerk_secret_key: &str) -> Self {
        let _ = clerk_secret_key; // Used for API calls in service layer
        Self {
            // The JWKS URL will be resolved from the JWT issuer on first use.
            jwks_url: String::new(),
            expected_audience: String::new(),
            expected_issuer: String::new(),
            cache: tokio::sync::RwLock::new(None),
        }
    }

    pub fn with_jwks_url(jwks_url: String) -> Self {
        Self {
            jwks_url,
            expected_audience: String::new(),
            expected_issuer: String::new(),
            cache: tokio::sync::RwLock::new(None),
        }
    }

    /// Configure the expected `aud` claim. Empty strings are treated as unset.
    pub fn with_expected_audience(mut self, audience: String) -> Self {
        self.expected_audience = audience;
        self
    }

    /// Configure the expected `iss` claim. Empty strings are treated as unset.
    pub fn with_expected_issuer(mut self, issuer: String) -> Self {
        self.expected_issuer = issuer;
        self
    }

    /// Validate a JWT token and return the Clerk user ID (sub claim).
    /// Used by both Bearer token auth and session cookie auth.
    pub async fn validate_token(&self, token: &str) -> Option<String> {
        // Pattern: every `.ok()?` short-circuit emits a warn! before returning
        // None, so the silent-failure footgun that hid the 2026-05-12 Clerk
        // JWT incident can't recur. The outer extractor still maps None to
        // AUTH_TOKEN_INVALID; these warn lines are the operator-facing
        // diagnostic surface.
        let keys = self
            .get_keys()
            .await
            .inspect_err(|e| tracing::warn!(error = %e, "jwks fetch failed"))
            .ok()?;
        let header = jsonwebtoken::decode_header(token)
            .inspect_err(|e| tracing::warn!(error = %e, "jwt header decode failed"))
            .ok()?;
        let kid = header.kid.or_else(|| {
            tracing::warn!("jwt header missing kid");
            None
        })?;
        let jwk = keys
            .keys
            .iter()
            .find(|k| k.common.key_id.as_deref() == Some(&kid))
            .or_else(|| {
                let known: Vec<&str> = keys
                    .keys
                    .iter()
                    .filter_map(|k| k.common.key_id.as_deref())
                    .collect();
                tracing::warn!(token_kid = %kid, jwks_kids = ?known, "jwt kid not in jwks");
                None
            })?;
        let decoding_key = jsonwebtoken::DecodingKey::from_jwk(jwk)
            .inspect_err(|e| tracing::warn!(error = %e, "jwt decoding-key build failed"))
            .ok()?;
        let validation = build_validation(
            Some(self.expected_audience.as_str()),
            Some(self.expected_issuer.as_str()),
        );
        jsonwebtoken::decode::<ClerkJwtClaims>(token, &decoding_key, &validation)
            .inspect_err(|err| {
                use jsonwebtoken::errors::ErrorKind;
                let code = match err.kind() {
                    ErrorKind::InvalidAudience => codes::AUTH_TOKEN_AUDIENCE,
                    ErrorKind::InvalidIssuer => codes::AUTH_TOKEN_ISSUER,
                    _ => codes::AUTH_TOKEN_INVALID,
                };
                tracing::warn!(error_code = code, kind = ?err.kind(), "jwt decode rejected");
            })
            .ok()
            .map(|token_data| token_data.claims.sub)
    }

    pub async fn get_keys(&self) -> Result<jsonwebtoken::jwk::JwkSet, ApiError> {
        // Check cache (15 minute TTL)
        {
            let cache = self.cache.read().await;
            if let Some(ref cached) = *cache {
                if cached.fetched_at.elapsed() < std::time::Duration::from_secs(900) {
                    return Ok(cached.keys.clone());
                }
            }
        }

        // If no URL configured yet, can't fetch
        if self.jwks_url.is_empty() {
            return Err(ApiError::internal("Clerk JWKS URL not configured"));
        }

        // Fetch fresh JWKS with SSRF protection — validate and pin DNS
        // so an operator misconfiguration or DNS rebinding can't exfiltrate
        // internal service data.
        let (resolve_host, resolve_addr) = url_validation::validate_and_resolve_url(&self.jwks_url)
            .await
            .map_err(|e| e.with_code(codes::AI_URL_SSRF))?;

        let mut client_builder =
            reqwest::Client::builder().timeout(std::time::Duration::from_secs(30));
        client_builder = client_builder.resolve(&resolve_host, resolve_addr);
        let client = client_builder.build().unwrap_or_default();

        let resp = client
            .get(&self.jwks_url)
            .send()
            .await
            .map_err(|e| ApiError::internal(format!("Failed to fetch Clerk JWKS: {}", e)))?;

        let jwks: jsonwebtoken::jwk::JwkSet = resp
            .json()
            .await
            .map_err(|e| ApiError::internal(format!("Failed to parse Clerk JWKS: {}", e)))?;

        // Update cache
        {
            let mut cache = self.cache.write().await;
            *cache = Some(CachedJwks {
                keys: jwks.clone(),
                fetched_at: std::time::Instant::now(),
            });
        }

        Ok(jwks)
    }
}

// ── Role-gated extractor ─────────────────────────────────────────────────
//
// The four role guards (`MasterKey`/`AdminKey`/`WriteKey`/`ReadKey`) were
// distinct newtypes with the same shape and near-identical resolution logic
// (resolve the `Actor`, then `predicate || is_system_admin`). They collapse
// into one generic `RoleGated<G>` parameterised by a `RoleGate`, with the
// role-named aliases kept as the ergonomic handler-facing surface.

use crate::guards::actor::Actor;
use std::marker::PhantomData;

/// A permission gate over an [`Actor`]: the predicate that decides whether the
/// actor satisfies the gate on its own, plus the denial message when it does
/// not. The system-admin override is applied uniformly by [`RoleGated`].
pub trait RoleGate {
    /// Does this actor satisfy the gate by its own permission tier, before any
    /// system-admin override?
    fn permits(actor: &Actor) -> bool;

    /// Whether a system admin is allowed through even when [`permits`] is
    /// false. `Read` accepts everyone so the override is moot there; the write
    /// tiers all honour it. Defaults to `true`.
    ///
    /// [`permits`]: RoleGate::permits
    fn allow_system_admin_override() -> bool {
        true
    }

    /// Message returned (with [`codes::AUTH_INSUFFICIENT_ROLE`]) when the gate
    /// rejects the actor.
    fn denied_message() -> &'static str;
}

/// Requires `Master` API-key permission OR system admin.
#[derive(Debug, Clone, Copy)]
pub struct MasterGate;
/// Requires `Admin`+ API-key permission OR system admin.
#[derive(Debug, Clone, Copy)]
pub struct AdminGate;
/// Requires `Write`+ API-key permission OR system admin.
#[derive(Debug, Clone, Copy)]
pub struct WriteGate;
/// Accepts any valid [`Actor`] (Clerk JWT, API key, or preview token).
#[derive(Debug, Clone, Copy)]
pub struct ReadGate;

impl RoleGate for MasterGate {
    fn permits(actor: &Actor) -> bool {
        actor.can_manage_keys()
    }
    fn denied_message() -> &'static str {
        "Master API key or system admin required"
    }
}

impl RoleGate for AdminGate {
    fn permits(actor: &Actor) -> bool {
        actor.is_admin()
    }
    fn denied_message() -> &'static str {
        "Admin permission or system admin required"
    }
}

impl RoleGate for WriteGate {
    fn permits(actor: &Actor) -> bool {
        actor.can_write()
    }
    fn denied_message() -> &'static str {
        "Write permission required"
    }
}

impl RoleGate for ReadGate {
    fn permits(_actor: &Actor) -> bool {
        // Any authenticated actor passes; no system-admin lookup needed.
        true
    }
    fn allow_system_admin_override() -> bool {
        false
    }
    fn denied_message() -> &'static str {
        "Authentication required"
    }
}

/// One role-gated extractor over a resolved [`Actor`]. The wrapped actor is at
/// `.0`; `G` selects the gate. The `FromRequestParts` impl (the single place
/// that resolves the actor and applies `predicate || is_system_admin`) lives
/// in `axum_app::extractors`.
#[derive(Debug, Clone)]
pub struct RoleGated<G: RoleGate>(pub Actor, pub PhantomData<G>);

/// Master key guard — requires master API-key permission or system admin.
pub type MasterKey = RoleGated<MasterGate>;
/// Admin key guard — requires admin/master API-key permission or system admin.
pub type AdminKey = RoleGated<AdminGate>;
/// Write key guard — requires write/admin/master API-key permission or system admin.
pub type WriteKey = RoleGated<WriteGate>;
/// Read key guard — any valid Actor (Clerk JWT, API key, or preview token).
pub type ReadKey = RoleGated<ReadGate>;

#[cfg(test)]
mod tests {
    use super::*;

    // --- build_validation: Clerk JWT audience + issuer configuration ---

    #[test]
    fn build_validation_uses_rs256() {
        let v = build_validation(None, None);
        assert!(v.algorithms.contains(&jsonwebtoken::Algorithm::RS256));
    }

    #[test]
    fn build_validation_without_expectations_skips_aud_and_iss() {
        // Backward-compatible default: no audience or issuer configured.
        // This preserves current behavior for deployments that haven't set
        // CLERK_EXPECTED_AUDIENCE / CLERK_EXPECTED_ISSUER.
        let v = build_validation(None, None);
        assert!(
            !v.validate_aud,
            "aud should not be validated when not configured"
        );
        assert!(v.iss.is_none(), "iss should not be set when not configured");
    }

    #[test]
    fn build_validation_with_audience_sets_aud_validation() {
        let v = build_validation(Some("forja-prod"), None);
        assert!(v.validate_aud);
        let aud = v.aud.as_ref().expect("aud should be Some");
        assert!(aud.contains("forja-prod"));
    }

    #[test]
    fn build_validation_with_issuer_sets_iss_validation() {
        let v = build_validation(None, Some("https://clerk.forja.example"));
        let iss = v.iss.as_ref().expect("iss should be Some");
        assert!(iss.contains("https://clerk.forja.example"));
    }

    #[test]
    fn build_validation_empty_strings_treated_as_none() {
        // Empty config strings (the default for unset env vars) must not
        // produce an expected value of "" — that would reject every token.
        let v = build_validation(Some(""), Some(""));
        assert!(
            !v.validate_aud,
            "empty audience must not enable aud validation"
        );
        assert!(v.iss.is_none(), "empty issuer must not set iss expectation");
    }

    #[test]
    fn build_validation_with_both_values_sets_both() {
        let v = build_validation(Some("aud-x"), Some("iss-y"));
        assert!(v.validate_aud);
        assert!(v.aud.as_ref().unwrap().contains("aud-x"));
        assert!(v.iss.as_ref().unwrap().contains("iss-y"));
    }

    // Regression: Clerk session JWTs carry custom header parameters that are
    // not always strings (an integer timestamp here). jsonwebtoken 9 ignores
    // unknown header fields, but 10 deserialises them into a flattened
    // `extras: HashMap<String, String>` and rejects any non-string value
    // ("invalid type: integer, expected a string"). That made `decode_header`
    // fail for *every* real Clerk token, 401-ing every authenticated request
    // and locking everyone out of the dashboard in production (2.0.1). This
    // pins the lenient behaviour `validate_token` depends on, so a future
    // jsonwebtoken bump can't silently regress login again.
    #[test]
    fn decode_header_tolerates_non_string_extra_header_fields() {
        use base64::engine::general_purpose::URL_SAFE_NO_PAD;
        use base64::Engine as _;

        let header = r#"{"alg":"RS256","typ":"JWT","kid":"ins_2abc","custom_ts":1781422363}"#;
        let payload = r#"{"sub":"user_123"}"#;
        let token = format!(
            "{}.{}.{}",
            URL_SAFE_NO_PAD.encode(header),
            URL_SAFE_NO_PAD.encode(payload),
            URL_SAFE_NO_PAD.encode(b"signature"),
        );

        let decoded = jsonwebtoken::decode_header(&token)
            .expect("decode_header must tolerate non-string custom header fields (Clerk tokens)");
        assert_eq!(decoded.kid.as_deref(), Some("ins_2abc"));
        assert_eq!(decoded.alg, jsonwebtoken::Algorithm::RS256);
    }

    #[test]
    fn test_authenticated_key_can_manage_keys() {
        let key = AuthenticatedKey {
            id: Uuid::new_v4(),
            permission: ApiKeyPermission::Master,
            site_id: None,
            auth_source: AuthSource::ApiKey,
        };
        assert!(key.can_manage_keys());

        let key = AuthenticatedKey {
            id: Uuid::new_v4(),
            permission: ApiKeyPermission::Admin,
            site_id: None,
            auth_source: AuthSource::ApiKey,
        };
        assert!(!key.can_manage_keys());
    }

    #[test]
    fn test_authenticated_key_can_write() {
        let key = AuthenticatedKey {
            id: Uuid::new_v4(),
            permission: ApiKeyPermission::Write,
            site_id: None,
            auth_source: AuthSource::ApiKey,
        };
        assert!(key.can_write());

        let key = AuthenticatedKey {
            id: Uuid::new_v4(),
            permission: ApiKeyPermission::Read,
            site_id: None,
            auth_source: AuthSource::ApiKey,
        };
        assert!(!key.can_write());
    }

    #[test]
    fn test_authenticated_key_has_site_access() {
        let site_id = Uuid::new_v4();

        // Key with no site restriction
        let key = AuthenticatedKey {
            id: Uuid::new_v4(),
            permission: ApiKeyPermission::Read,
            site_id: None,
            auth_source: AuthSource::ApiKey,
        };
        assert!(key.has_site_access(site_id));
        assert!(key.has_site_access(Uuid::new_v4()));

        // Key restricted to specific site
        let key = AuthenticatedKey {
            id: Uuid::new_v4(),
            permission: ApiKeyPermission::Read,
            site_id: Some(site_id),
            auth_source: AuthSource::ApiKey,
        };
        assert!(key.has_site_access(site_id));
        assert!(!key.has_site_access(Uuid::new_v4()));
    }

    #[test]
    fn test_ensure_site_access() {
        let site_id = Uuid::new_v4();

        // Unrestricted key should succeed for any site
        let key = AuthenticatedKey {
            id: Uuid::new_v4(),
            permission: ApiKeyPermission::Read,
            site_id: None,
            auth_source: AuthSource::ApiKey,
        };
        assert!(key.ensure_site_access(site_id).is_ok());

        // Restricted key should succeed for its site
        let key = AuthenticatedKey {
            id: Uuid::new_v4(),
            permission: ApiKeyPermission::Read,
            site_id: Some(site_id),
            auth_source: AuthSource::ApiKey,
        };
        assert!(key.ensure_site_access(site_id).is_ok());

        // Restricted key should fail for other sites
        assert!(key.ensure_site_access(Uuid::new_v4()).is_err());
    }

    #[test]
    fn test_is_site_scoped() {
        let key = AuthenticatedKey {
            id: Uuid::new_v4(),
            permission: ApiKeyPermission::Read,
            site_id: None,
            auth_source: AuthSource::ApiKey,
        };
        assert!(!key.is_site_scoped());

        let key = AuthenticatedKey {
            id: Uuid::new_v4(),
            permission: ApiKeyPermission::Read,
            site_id: Some(Uuid::new_v4()),
            auth_source: AuthSource::ApiKey,
        };
        assert!(key.is_site_scoped());
    }

    #[test]
    fn test_clerk_user_id_to_uuid() {
        let user_id = "user_2abc123";
        let uuid1 = Uuid::new_v5(&CLERK_UUID_NAMESPACE, user_id.as_bytes());
        let uuid2 = Uuid::new_v5(&CLERK_UUID_NAMESPACE, user_id.as_bytes());
        assert_eq!(uuid1, uuid2); // Deterministic

        let other_uuid = Uuid::new_v5(&CLERK_UUID_NAMESPACE, b"user_different");
        assert_ne!(uuid1, other_uuid);
    }

    // --- is_loopback tests ---

    #[test]
    fn test_is_loopback_ipv4() {
        assert!(is_loopback("127.0.0.1"));
    }

    #[test]
    fn test_is_loopback_ipv6() {
        assert!(is_loopback("::1"));
    }

    #[test]
    fn test_is_loopback_localhost() {
        assert!(is_loopback("localhost"));
    }

    #[test]
    fn test_is_loopback_public_ip() {
        assert!(!is_loopback("203.0.113.42"));
        assert!(!is_loopback("10.0.0.1"));
    }

    // --- resolve_client_ip tests ---

    #[test]
    fn test_resolve_client_ip_no_trust() {
        // When trust_proxy_headers is false, always returns direct IP
        let result = resolve_client_ip(
            Some("203.0.113.42"),
            Some("198.51.100.5"),
            "127.0.0.1",
            false,
        );
        assert_eq!(result, "127.0.0.1");
    }

    #[test]
    fn test_resolve_client_ip_xff_trusted() {
        // X-Forwarded-For takes priority when trusted
        let result = resolve_client_ip(
            Some("203.0.113.42, 10.0.0.1"),
            Some("198.51.100.5"),
            "127.0.0.1",
            true,
        );
        assert_eq!(result, "203.0.113.42");
    }

    #[test]
    fn test_resolve_client_ip_xff_single() {
        let result = resolve_client_ip(Some("203.0.113.42"), None, "127.0.0.1", true);
        assert_eq!(result, "203.0.113.42");
    }

    #[test]
    fn test_resolve_client_ip_real_ip_fallback() {
        // Falls back to X-Real-IP when X-Forwarded-For is absent
        let result = resolve_client_ip(None, Some("198.51.100.5"), "127.0.0.1", true);
        assert_eq!(result, "198.51.100.5");
    }

    #[test]
    fn test_resolve_client_ip_direct_fallback() {
        // Falls back to direct IP when no forwarded headers present
        let result = resolve_client_ip(None, None, "127.0.0.1", true);
        assert_eq!(result, "127.0.0.1");
    }

    #[test]
    fn test_resolve_client_ip_empty_xff() {
        // Empty X-Forwarded-For should fall through to X-Real-IP
        let result = resolve_client_ip(Some(""), Some("198.51.100.5"), "127.0.0.1", true);
        assert_eq!(result, "198.51.100.5");
    }

    #[test]
    fn test_resolve_client_ip_whitespace_xff() {
        // Whitespace-only X-Forwarded-For should fall through
        let result = resolve_client_ip(Some("  "), Some("198.51.100.5"), "127.0.0.1", true);
        assert_eq!(result, "198.51.100.5");
    }

    #[test]
    fn test_resolve_client_ip_xff_with_spaces() {
        // X-Forwarded-For entries may have surrounding whitespace
        let result = resolve_client_ip(Some("  203.0.113.42 , 10.0.0.1 "), None, "127.0.0.1", true);
        assert_eq!(result, "203.0.113.42");
    }

    // --- JWKS URL SSRF validation ---

    #[tokio::test]
    async fn get_keys_rejects_metadata_endpoint_url() {
        // Regression: JWKS URL to internal endpoint must be blocked.
        let state = ClerkJwksState::with_jwks_url("http://169.254.169.254/latest".into());
        let result =
            tokio::time::timeout(std::time::Duration::from_secs(5), state.get_keys()).await;
        assert!(
            result.is_ok(),
            "get_keys should return quickly (with or without SSRF check)"
        );
        let result = result.unwrap();
        assert!(
            result.is_err(),
            "expected SSRF rejection for metadata endpoint"
        );
    }

    #[tokio::test]
    async fn get_keys_rejects_loopback_url() {
        let state = ClerkJwksState::with_jwks_url("http://127.0.0.1:9999/.well-known/jwks".into());
        let result =
            tokio::time::timeout(std::time::Duration::from_secs(5), state.get_keys()).await;
        assert!(result.is_ok(), "get_keys should return quickly");
        let result = result.unwrap();
        assert!(result.is_err(), "expected SSRF rejection for loopback");
    }

    #[tokio::test]
    async fn get_keys_rejects_private_ip_url() {
        let state = ClerkJwksState::with_jwks_url("http://10.0.0.1/.well-known/jwks".into());
        let result =
            tokio::time::timeout(std::time::Duration::from_secs(5), state.get_keys()).await;
        assert!(result.is_ok(), "get_keys should return quickly");
        let result = result.unwrap();
        assert!(result.is_err(), "expected SSRF rejection for private IP");
    }

    // --- RoleGate predicates --------------------------------------------
    // The gate predicate is the pure core of the role-gated extractor; the
    // system-admin override path needs a DB, so it's covered by integration
    // tests. Here we lock the allow/forbid matrix on the same actor.

    use crate::guards::actor::{Actor, ActorKind};

    fn api_key_actor(permission: ApiKeyPermission) -> Actor {
        Actor {
            id: Uuid::new_v4(),
            kind: ActorKind::ApiKey {
                permission,
                site_id: None,
            },
        }
    }

    #[test]
    fn role_gates_apply_their_permission_predicate() {
        // Same actor, different gates → different verdicts (tracer).
        let write = api_key_actor(ApiKeyPermission::Write);
        assert!(WriteGate::permits(&write), "write key satisfies WriteGate");
        assert!(
            !MasterGate::permits(&write),
            "write key must not satisfy MasterGate"
        );
        assert!(
            !AdminGate::permits(&write),
            "write key must not satisfy AdminGate"
        );
        assert!(ReadGate::permits(&write), "ReadGate accepts any actor");

        let master = api_key_actor(ApiKeyPermission::Master);
        assert!(MasterGate::permits(&master));
        assert!(AdminGate::permits(&master));
        assert!(WriteGate::permits(&master));
    }

    #[test]
    fn read_gate_accepts_everyone_and_skips_admin_override() {
        // Read short-circuits before any system-admin DB lookup.
        let read_only = api_key_actor(ApiKeyPermission::Read);
        assert!(ReadGate::permits(&read_only));
        assert!(!ReadGate::allow_system_admin_override());
        // The write tiers all honour the override.
        assert!(MasterGate::allow_system_admin_override());
        assert!(AdminGate::allow_system_admin_override());
        assert!(WriteGate::allow_system_admin_override());
    }
}
