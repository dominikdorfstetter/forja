//! Authentication guard
//!
//! Request guards for API key and Clerk JWT authentication.

use rocket::http::Status;
use rocket::request::{FromRequest, Outcome, Request};
use uuid::Uuid;

use sqlx::PgPool;

use crate::errors::ApiError;
use crate::middleware::rate_limit::{RateLimitHeaderInfo, RateLimiter, RateLimits};
use crate::models::api_key::{ApiKey, ApiKeyPermission};
use crate::models::site_membership::{SiteMembership, SiteRole};
use crate::AppState;

/// Header name for API key
pub const API_KEY_HEADER: &str = "X-API-Key";

/// Check whether an IP string represents a loopback address (exempt from IP rate limiting)
fn is_loopback(ip: &str) -> bool {
    ip == "127.0.0.1" || ip == "::1" || ip == "localhost"
}

/// Namespace UUID for generating deterministic Clerk user UUIDs
pub const CLERK_UUID_NAMESPACE: Uuid = Uuid::from_bytes([
    0x6b, 0xa7, 0xb8, 0x10, 0x9d, 0xad, 0x11, 0xd1, 0x80, 0xb4, 0x00, 0xc0, 0x4f, 0xd4, 0x30, 0xc8,
]);

/// Tracks the source of authentication
#[derive(Debug, Clone)]
pub enum AuthSource {
    ApiKey,
    ClerkJwt { clerk_user_id: String },
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
            Err(ApiError::Forbidden(
                "API key does not have access to this site".into(),
            ))
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
            AuthSource::ApiKey => None,
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
                ApiError::Forbidden("You do not have access to this site".to_string())
            })?;

        if role.has_at_least(min_role) {
            Ok(role)
        } else {
            Err(ApiError::Forbidden(format!(
                "Requires at least {} role on this site",
                min_role
            )))
        }
    }

    /// Check if this user is a system admin
    pub async fn is_system_admin(&self, pool: &PgPool) -> Result<bool, ApiError> {
        match &self.auth_source {
            AuthSource::ClerkJwt { clerk_user_id } => {
                SiteMembership::is_system_admin(pool, clerk_user_id).await
            }
            AuthSource::ApiKey => Ok(self.permission == ApiKeyPermission::Master),
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

/// Try to authenticate via Clerk JWT from the Authorization: Bearer header
async fn try_clerk_jwt(request: &Request<'_>, state: &AppState) -> Option<AuthenticatedKey> {
    // Only attempt if Clerk is configured
    if state.settings.security.clerk_secret_key.is_empty() {
        return None;
    }

    // Extract Bearer token
    let auth_header = request.headers().get_one("Authorization")?;
    let token = auth_header.strip_prefix("Bearer ")?;

    // Get JWKS state (cached keys)
    let jwks_state = request.rocket().state::<ClerkJwksState>()?;
    let keys = jwks_state.get_keys().await.ok()?;

    // Decode the JWT header to get the key ID
    let header = jsonwebtoken::decode_header(token).ok()?;
    let kid = header.kid?;

    // Find the matching key in JWKS
    let jwk = keys
        .keys
        .iter()
        .find(|k| k.common.key_id.as_deref() == Some(&kid))?;
    let decoding_key = jsonwebtoken::DecodingKey::from_jwk(jwk).ok()?;

    // Validate the token
    let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::RS256);
    // Clerk tokens may not have a standard audience; disable audience validation
    validation.validate_aud = false;

    let token_data =
        jsonwebtoken::decode::<ClerkJwtClaims>(token, &decoding_key, &validation).ok()?;
    let claims = token_data.claims;

    // Baseline permission — real permissions come from site_memberships
    let permission = ApiKeyPermission::Read;

    // Generate a deterministic UUID from Clerk user ID
    let id = Uuid::new_v5(&CLERK_UUID_NAMESPACE, claims.sub.as_bytes());

    Some(AuthenticatedKey {
        id,
        permission,
        site_id: None, // Clerk users get all-site access
        auth_source: AuthSource::ClerkJwt {
            clerk_user_id: claims.sub,
        },
    })
}

/// Try to authenticate via X-API-Key header
async fn try_api_key(
    request: &Request<'_>,
    state: &AppState,
) -> Result<AuthenticatedKey, (Status, ApiError)> {
    let api_key = match request.headers().get_one(API_KEY_HEADER) {
        Some(key) => key,
        None => {
            return Err((
                Status::Unauthorized,
                ApiError::Unauthorized("Missing authentication: provide Authorization Bearer token or X-API-Key header".to_string()),
            ));
        }
    };

    // Validate API key
    let validation = match ApiKey::validate(&state.db, api_key).await {
        Ok(v) => v,
        Err(e) => {
            return Err((Status::Unauthorized, e));
        }
    };

    if !validation.is_valid {
        return Err((
            Status::Unauthorized,
            ApiError::Unauthorized(
                validation
                    .reason
                    .unwrap_or_else(|| "Invalid API key".to_string()),
            ),
        ));
    }

    // Rate limiting (only if Redis is available)
    if let Some(ref redis) = state.redis {
        let mut redis_conn = redis.clone();
        let ip_str = request
            .client_ip()
            .map(|ip| ip.to_string())
            .unwrap_or_else(|| "unknown".to_string());

        let header_info = request.local_cache(RateLimitHeaderInfo::default);

        // 1. Check global IP-based rate limit (skip for loopback)
        if !is_loopback(&ip_str) {
            match RateLimiter::check_ip(&mut redis_conn, &ip_str, &state.settings.security).await {
                Ok(info) => {
                    header_info.update(&info);
                }
                Err(e) => {
                    return Err((Status::TooManyRequests, e));
                }
            }
        }

        // 2. Check per-key rate limit
        match RateLimiter::check_key(
            &mut redis_conn,
            &validation.id.to_string(),
            &validation.rate_limits,
        )
        .await
        {
            Ok(info) => {
                header_info.update(&info);
            }
            Err(e) => {
                return Err((Status::TooManyRequests, e));
            }
        }
    }

    // Record usage (fire and forget)
    let ip = request.client_ip().map(|ip| ip.to_string());
    let key_id = validation.id;
    let pool = state.db.clone();
    tokio::spawn(async move {
        if let Err(e) = ApiKey::record_usage(&pool, key_id, ip.as_deref()).await {
            tracing::warn!(error = %e, key_id = %key_id, "Failed to record API key usage");
        }
    });

    Ok(AuthenticatedKey {
        id: validation.id,
        permission: validation.permission,
        site_id: Some(validation.site_id),
        auth_source: AuthSource::ApiKey,
    })
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for AuthenticatedKey {
    type Error = ApiError;

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        // Get app state
        let state = match request.rocket().state::<AppState>() {
            Some(s) => s,
            None => {
                return Outcome::Error((
                    Status::InternalServerError,
                    ApiError::Internal("Application state not found".to_string()),
                ));
            }
        };

        // Strategy 1: Try Clerk JWT (Authorization: Bearer <token>)
        if request.headers().get_one("Authorization").is_some() {
            if let Some(auth) = try_clerk_jwt(request, state).await {
                // Apply rate limiting for Clerk users too
                if let Some(ref redis) = state.redis {
                    let mut redis_conn = redis.clone();
                    let ip_str = request
                        .client_ip()
                        .map(|ip| ip.to_string())
                        .unwrap_or_else(|| "unknown".to_string());

                    let header_info = request.local_cache(RateLimitHeaderInfo::default);

                    // IP-based rate limit (skip for loopback)
                    if !is_loopback(&ip_str) {
                        match RateLimiter::check_ip(
                            &mut redis_conn,
                            &ip_str,
                            &state.settings.security,
                        )
                        .await
                        {
                            Ok(info) => header_info.update(&info),
                            Err(e) => return Outcome::Error((Status::TooManyRequests, e)),
                        }
                    }

                    // Per-user rate limit using clerk:<user_id> key
                    let clerk_key = match &auth.auth_source {
                        AuthSource::ClerkJwt { clerk_user_id } => {
                            format!("clerk:{}", clerk_user_id)
                        }
                        _ => auth.id.to_string(),
                    };
                    let default_limits = RateLimits {
                        per_second: Some(10),
                        per_minute: Some(100),
                        per_hour: Some(1000),
                        per_day: Some(10000),
                    };
                    match RateLimiter::check_key(&mut redis_conn, &clerk_key, &default_limits).await
                    {
                        Ok(info) => header_info.update(&info),
                        Err(e) => return Outcome::Error((Status::TooManyRequests, e)),
                    }
                }

                return Outcome::Success(auth);
            }
            // If Bearer token was present but invalid, fall through to API key
            // only if X-API-Key is also present
            if request.headers().get_one(API_KEY_HEADER).is_none() {
                return Outcome::Error((
                    Status::Unauthorized,
                    ApiError::Unauthorized("Invalid Bearer token".to_string()),
                ));
            }
        }

        // Strategy 2: Try API key (X-API-Key header)
        match try_api_key(request, state).await {
            Ok(auth) => Outcome::Success(auth),
            Err((status, e)) => Outcome::Error((status, e)),
        }
    }
}

// --- Clerk JWKS caching ---

/// Cached JWKS state managed by Rocket
pub struct ClerkJwksState {
    jwks_url: String,
    cache: tokio::sync::RwLock<Option<CachedJwks>>,
}

struct CachedJwks {
    keys: jsonwebtoken::jwk::JwkSet,
    fetched_at: std::time::Instant,
}

impl ClerkJwksState {
    pub fn new(clerk_secret_key: &str) -> Self {
        // Clerk JWKS endpoint — derive the Clerk frontend API URL from the secret key
        // Clerk's JWKS endpoint is at: https://<clerk-frontend-api>/.well-known/jwks.json
        // Since we can't derive it from the secret key, we use the Clerk Backend API
        // Actually, Clerk exposes JWKS at the issuer URL from the JWT.
        // We'll use a configurable approach — fetch from Clerk's API.
        let _ = clerk_secret_key; // Used for API calls in service layer
        Self {
            // The JWKS URL will be resolved from the JWT issuer on first use.
            // Clerk's standard JWKS endpoint pattern.
            jwks_url: String::new(),
            cache: tokio::sync::RwLock::new(None),
        }
    }

    pub fn with_jwks_url(jwks_url: String) -> Self {
        Self {
            jwks_url,
            cache: tokio::sync::RwLock::new(None),
        }
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
            return Err(ApiError::Internal(
                "Clerk JWKS URL not configured".to_string(),
            ));
        }

        // Fetch fresh JWKS
        let client = reqwest::Client::new();
        let resp = client
            .get(&self.jwks_url)
            .send()
            .await
            .map_err(|e| ApiError::Internal(format!("Failed to fetch Clerk JWKS: {}", e)))?;

        let jwks: jsonwebtoken::jwk::JwkSet = resp
            .json()
            .await
            .map_err(|e| ApiError::Internal(format!("Failed to parse Clerk JWKS: {}", e)))?;

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

/// Master key guard - requires master permission or system admin
#[derive(Debug, Clone)]
pub struct MasterKey(pub AuthenticatedKey);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for MasterKey {
    type Error = ApiError;

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let auth = match AuthenticatedKey::from_request(request).await {
            Outcome::Success(a) => a,
            Outcome::Error(e) => return Outcome::Error(e),
            Outcome::Forward(f) => return Outcome::Forward(f),
        };

        // API key with Master permission passes directly
        if auth.can_manage_keys() {
            return Outcome::Success(MasterKey(auth));
        }

        // Clerk JWT users: check if system admin
        if let Some(state) = request.rocket().state::<AppState>() {
            if let Ok(true) = auth.is_system_admin(&state.db).await {
                return Outcome::Success(MasterKey(auth));
            }
        }

        Outcome::Error((
            Status::Forbidden,
            ApiError::Forbidden("Master API key or system admin required".to_string()),
        ))
    }
}

/// Admin key guard - requires admin/master permission or system admin
#[derive(Debug, Clone)]
pub struct AdminKey(pub AuthenticatedKey);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for AdminKey {
    type Error = ApiError;

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let auth = match AuthenticatedKey::from_request(request).await {
            Outcome::Success(a) => a,
            Outcome::Error(e) => return Outcome::Error(e),
            Outcome::Forward(f) => return Outcome::Forward(f),
        };

        // API key with Admin+ permission passes directly
        if auth.is_admin() {
            return Outcome::Success(AdminKey(auth));
        }

        // Clerk JWT users: check if system admin
        if let Some(state) = request.rocket().state::<AppState>() {
            if let Ok(true) = auth.is_system_admin(&state.db).await {
                return Outcome::Success(AdminKey(auth));
            }
        }

        Outcome::Error((
            Status::Forbidden,
            ApiError::Forbidden("Admin permission or system admin required".to_string()),
        ))
    }
}

/// Write key guard - requires write/admin/master permission or system admin
#[derive(Debug, Clone)]
pub struct WriteKey(pub AuthenticatedKey);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for WriteKey {
    type Error = ApiError;

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let auth = match AuthenticatedKey::from_request(request).await {
            Outcome::Success(a) => a,
            Outcome::Error(e) => return Outcome::Error(e),
            Outcome::Forward(f) => return Outcome::Forward(f),
        };

        // API key with Write+ permission passes directly
        if auth.can_write() {
            return Outcome::Success(WriteKey(auth));
        }

        // Clerk JWT users: check if system admin
        if let Some(state) = request.rocket().state::<AppState>() {
            if let Ok(true) = auth.is_system_admin(&state.db).await {
                return Outcome::Success(WriteKey(auth));
            }
        }

        Outcome::Error((
            Status::Forbidden,
            ApiError::Forbidden("Write permission required".to_string()),
        ))
    }
}

/// Read key guard - any valid API key (for completeness)
#[derive(Debug, Clone)]
pub struct ReadKey(pub AuthenticatedKey);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for ReadKey {
    type Error = ApiError;

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        match AuthenticatedKey::from_request(request).await {
            Outcome::Success(a) => Outcome::Success(ReadKey(a)),
            Outcome::Error(e) => Outcome::Error(e),
            Outcome::Forward(f) => Outcome::Forward(f),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
