//! Axum-side request extractors.
//!
//! These mirror the Rocket `FromRequest` guards in `crate::guards` and
//! `crate::handlers::analytics`. They live here separately so the migration
//! branch can compile both frameworks side by side; at cutover the Rocket
//! versions get deleted and these become canonical.

use std::convert::Infallible;
use std::sync::Arc;

use axum::extract::{FromRequestParts, RawPathParams};
use axum::http::request::Parts;
use axum::http::{HeaderMap, StatusCode};
use uuid::Uuid;

use crate::errors::{codes, ApiError};
use crate::guards::actor::Actor;
use crate::guards::auth_guard::{
    self, AuthSource, AuthenticatedKey, RoleGate, RoleGated, API_KEY_HEADER, CLERK_UUID_NAMESPACE,
    PREVIEW_TOKEN_HEADER,
};
use crate::guards::module_guard::{ModuleGuard, ModuleMarker};
use crate::middleware::rate_limit::{QuotaHeaderInfo, RateLimitHeaderInfo, RateLimiter};
use crate::middleware::usage_tracking::ApiKeyUsageContext;
use crate::models::api_key::{ApiKey, ApiKeyPermission};
use crate::models::site::Site;
use crate::AppState;
use std::marker::PhantomData;

/// Wrapper around the requesting client's IP address.
///
/// Source priority: `X-Forwarded-For` (first hop) → `X-Real-IP` → `"unknown"`.
/// We deliberately do not look at the TCP peer address: in production this app
/// always runs behind a reverse proxy (Railway / nginx), so the proxy headers
/// are the source of truth. Used for hashing only — never stored verbatim.
pub struct ClientIp(pub String);

impl<S: Send + Sync> FromRequestParts<S> for ClientIp {
    type Rejection = Infallible;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let ip = parts
            .headers
            .get("x-forwarded-for")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.split(',').next())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .or_else(|| parts.headers.get("x-real-ip").and_then(|v| v.to_str().ok()))
            .unwrap_or("unknown")
            .to_string();
        Ok(ClientIp(ip))
    }
}

/// Wrapper around the `User-Agent` header. Used for hashing only.
pub struct UserAgent(pub String);

impl<S: Send + Sync> FromRequestParts<S> for UserAgent {
    type Rejection = Infallible;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let ua = parts
            .headers
            .get("user-agent")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("unknown")
            .to_string();
        Ok(UserAgent(ua))
    }
}

/// Optional `?locale=<code>` query parameter, per ADR 0002.
///
/// Carries `Some(code)` when the caller sets the param to a non-empty value;
/// `None` otherwise. No validation against the site's locale set here — the
/// handler resolves the code → locale_id and falls through the chain
/// (`utils::locale_resolver::resolve_localization`) silently per ADR §1.
///
/// Empty `?locale=` (e.g. `?locale=`) is treated as absent — the chain then
/// drops straight to site default → first.
pub struct ResolveLocale(pub Option<String>);

impl<S: Send + Sync> FromRequestParts<S> for ResolveLocale {
    type Rejection = Infallible;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let code = parts.uri.query().and_then(parse_locale_query);
        Ok(ResolveLocale(code))
    }
}

fn parse_locale_query(query: &str) -> Option<String> {
    query
        .split('&')
        .filter_map(|pair| pair.split_once('='))
        .find(|(k, _)| *k == "locale")
        .map(|(_, v)| v.to_string())
        .filter(|s| !s.is_empty())
}

/// Current site context extracted from the request.
///
/// Resolution order:
/// 1. `X-Site-Domain` header → `Site::find_by_domain`
/// 2. Path parameter named `site_id` (UUID) → `Site::find_by_id`
///
/// Mirrors the Rocket `CurrentSite` guard but resolves the path param by
/// name (`site_id`) rather than positional index, which is the Axum-native
/// way to avoid coupling the guard to a specific URL shape.
pub struct CurrentSite(pub Site);

impl FromRequestParts<AppState> for CurrentSite {
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        if let Some(domain) = site_domain_from_headers(&parts.headers) {
            return Site::find_by_domain(&state.db, domain)
                .await
                .map(CurrentSite)
                .map_err(|_| (StatusCode::NOT_FOUND, "site not found"));
        }

        // RawPathParams reads from request extensions non-destructively, so
        // it coexists with any Path<...> extractor the handler also declares.
        if let Ok(params) = RawPathParams::from_request_parts(parts, &()).await {
            if let Some(id) = site_id_from_path_params(params.iter()) {
                return Site::find_by_id(&state.db, id)
                    .await
                    .map(CurrentSite)
                    .map_err(|_| (StatusCode::NOT_FOUND, "site not found"));
            }
        }

        Err((StatusCode::BAD_REQUEST, "site context required"))
    }
}

/// Extract a non-empty `X-Site-Domain` header value.
fn site_domain_from_headers(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("x-site-domain")?
        .to_str()
        .ok()
        .map(str::trim)
        .filter(|s| !s.is_empty())
}

/// Find a path param named `site_id` and parse it as a UUID.
///
/// Takes an iterator of `(name, value)` pairs so callers can pass
/// `RawPathParams::iter()` in production and plain slices in tests
/// (`RawPathParams` itself has no public constructor).
fn site_id_from_path_params<'a>(
    params: impl IntoIterator<Item = (&'a str, &'a str)>,
) -> Option<Uuid> {
    params
        .into_iter()
        .find(|(name, _)| *name == "site_id")
        .and_then(|(_, value)| Uuid::parse_str(value).ok())
}

/// Axum extractor that rejects requests when the content module is disabled
/// for the site identified by the `site_id` path parameter.
///
/// Use as a handler argument:
/// ```ignore
/// async fn list_blogs(State(s): State<AppState>, _g: ModuleGuard<BlogModule>) { ... }
/// ```
///
/// For routes where `site_id` is resolved from an entity (not in the URL),
/// call `ModuleGuard::<M>::check(&db, site_id)` directly and propagate
/// the `ApiError`.
impl<M: ModuleMarker> FromRequestParts<AppState> for ModuleGuard<M> {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let params = RawPathParams::from_request_parts(parts, &())
            .await
            .map_err(|_| missing_site_id_error::<M>())?;

        let site_id =
            site_id_from_path_params(params.iter()).ok_or_else(missing_site_id_error::<M>)?;

        ModuleGuard::<M>::check(&state.db, site_id).await?;
        Ok(ModuleGuard::<M>::new())
    }
}

fn missing_site_id_error<M: ModuleMarker>() -> ApiError {
    ApiError::internal(format!(
        "ModuleGuard<{}> requires site_id in route path",
        M::MODULE_NAME
    ))
}

// ── AuthenticatedKey ─────────────────────────────────────────────────────
//
// Mirrors the Rocket `FromRequest for AuthenticatedKey` in
// `guards::auth_guard`. The three-strategy auth ladder (Clerk JWT → preview
// token → API key) is identical. Where Rocket stashes per-request state via
// `request.local_cache(F)`, the Axum side stores the same atomics-bearing
// structs in `parts.extensions` so response middleware can read them later.

/// Read a header by static name as `&str`, ignoring non-UTF-8 values.
fn header_str<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers.get(name).and_then(|v| v.to_str().ok())
}

/// Resolve the proxy-aware client IP from request headers alone.
///
/// Axum has no built-in equivalent to Rocket's `client_ip()` — the TCP peer
/// address requires `ConnectInfo<SocketAddr>` plumbing, which is not yet set
/// up on this router. For both rate limiting and usage recording we use the
/// shared `auth_guard::resolve_client_ip` helper, falling back to `"unknown"`
/// when no forwarded headers are present.
fn axum_client_ip(parts: &Parts, trust_proxy_headers: bool) -> String {
    auth_guard::resolve_client_ip(
        header_str(&parts.headers, "x-forwarded-for"),
        header_str(&parts.headers, "x-real-ip"),
        "unknown",
        trust_proxy_headers,
    )
}

/// Get-or-create a per-request `Arc<T>` extension. Mirrors Rocket's
/// `request.local_cache(T::default)` for types using interior mutability.
fn ensure_extension<T>(parts: &mut Parts) -> Arc<T>
where
    T: Default + Send + Sync + 'static,
{
    if let Some(existing) = parts.extensions.get::<Arc<T>>() {
        return existing.clone();
    }
    let arc = Arc::new(T::default());
    parts.extensions.insert(arc.clone());
    arc
}

/// Strategy 1 — Clerk JWT from `Authorization: Bearer ...`.
///
/// Returns `None` for any reason the token isn't a valid Clerk JWT (Clerk
/// disabled, header missing/malformed, JWKS state absent, signature check
/// failure). The caller decides whether to treat that as "fall through to
/// next strategy" or as an outright rejection.
async fn try_clerk_jwt_axum(headers: &HeaderMap, state: &AppState) -> Option<AuthenticatedKey> {
    if state.settings.security.clerk_secret_key.is_empty() {
        return None;
    }
    let auth_header = header_str(headers, "authorization")?;
    let token = auth_header.strip_prefix("Bearer ")?;
    let jwks_state = state.clerk_jwks.as_deref()?;
    let clerk_user_id = jwks_state.validate_token(token).await?;

    let id = Uuid::new_v5(&CLERK_UUID_NAMESPACE, clerk_user_id.as_bytes());
    Some(AuthenticatedKey {
        id,
        permission: ApiKeyPermission::Read,
        site_id: None,
        auth_source: AuthSource::ClerkJwt { clerk_user_id },
    })
}

/// Strategy 2 — read-only site-scoped key from `X-Preview-Token`.
fn try_preview_token_axum(headers: &HeaderMap, state: &AppState) -> Option<AuthenticatedKey> {
    let token = header_str(headers, PREVIEW_TOKEN_HEADER)?;
    let secret = &state.settings.security.preview_token_secret;
    if secret.is_empty() {
        return None;
    }
    let site_id = crate::services::preview_token::validate(token, secret).ok()?;
    Some(AuthenticatedKey {
        // Stable, per-site principal id. No longer a discriminator — the
        // `PreviewToken` variant is what identifies the preview strategy.
        id: Uuid::new_v5(
            &CLERK_UUID_NAMESPACE,
            format!("preview:{site_id}").as_bytes(),
        ),
        permission: ApiKeyPermission::Read,
        site_id: Some(site_id),
        auth_source: AuthSource::PreviewToken { site_id },
    })
}

/// Apply IP-based + per-user rate limits for an authenticated Clerk JWT.
/// Stashes the resulting limit headers in `parts.extensions` for the response
/// side to read. Returns the originating `ApiError` on rate-limit denial.
async fn apply_clerk_rate_limits(
    auth: &AuthenticatedKey,
    state: &AppState,
    parts: &mut Parts,
) -> Result<(), ApiError> {
    let Some(redis) = state.redis.clone() else {
        return Ok(());
    };
    let mut redis_conn = redis;
    let security = &state.settings.security;
    let ip_str = axum_client_ip(parts, security.trust_proxy_headers);

    let header_info = ensure_extension::<RateLimitHeaderInfo>(parts);

    if !auth_guard::is_loopback(&ip_str) {
        let info = RateLimiter::check_ip(&mut redis_conn, &ip_str, security).await?;
        header_info.update(&info);
    }

    // Per-second burst bound on the Clerk principal, keyed `clerk:<user_id>` —
    // the same enforced burst path API keys use. Replaces the retired windowed
    // `check_key`; signed-in traffic stays bounded by IP + burst.
    let clerk_key = match &auth.auth_source {
        AuthSource::ClerkJwt { clerk_user_id } => format!("clerk:{}", clerk_user_id),
        _ => auth.id.to_string(),
    };
    // Clerk principals have no per-key override → global burst default.
    RateLimiter::check_burst(
        &mut redis_conn,
        &clerk_key,
        None,
        &security.rate_limit_fail_mode,
    )
    .await?;
    Ok(())
}

/// Strategy 3 — `X-API-Key` validation + IP / burst / quota rate limits +
/// usage tracking. Mirrors Rocket's `try_api_key`, with `local_cache`
/// substituted by `parts.extensions`.
async fn try_api_key_axum(
    parts: &mut Parts,
    state: &AppState,
) -> Result<AuthenticatedKey, ApiError> {
    let api_key = header_str(&parts.headers, API_KEY_HEADER).ok_or_else(|| {
        ApiError::unauthorized(
            "Missing authentication: provide Authorization Bearer token or X-API-Key header",
        )
        .with_code(codes::AUTH_MISSING_CREDENTIALS)
    })?;

    let validation = ApiKey::validate(&state.db, api_key).await?;

    if !validation.is_valid {
        return Err(ApiError::unauthorized(
            validation
                .reason
                .unwrap_or_else(|| "Invalid API key".to_string()),
        )
        .with_code(codes::AUTH_TOKEN_INVALID));
    }

    if let Some(redis) = state.redis.clone() {
        let mut redis_conn = redis;
        let security = &state.settings.security;
        let ip_str = axum_client_ip(parts, security.trust_proxy_headers);

        let header_info = ensure_extension::<RateLimitHeaderInfo>(parts);

        if !auth_guard::is_loopback(&ip_str) {
            let info = RateLimiter::check_ip(&mut redis_conn, &ip_str, security).await?;
            header_info.update(&info);
        }

        RateLimiter::check_burst(
            &mut redis_conn,
            &validation.id.to_string(),
            validation.burst_limit.map(|c| c as u32),
            &security.rate_limit_fail_mode,
        )
        .await?;

        let quota_header = ensure_extension::<QuotaHeaderInfo>(parts);
        let info = RateLimiter::check_quota(
            &mut redis_conn,
            &validation.id.to_string(),
            &validation.quota_limits,
            &security.rate_limit_fail_mode,
        )
        .await?;
        quota_header.update(&info);
    }

    // Aggregate usage counter (fire and forget). The IP recorded here is
    // proxy-aware; on Railway behind nginx this is the real client IP when
    // `trust_proxy_headers` is enabled, falling back to `"unknown"`.
    let recorded_ip = axum_client_ip(parts, state.settings.security.trust_proxy_headers);
    let key_id = validation.id;
    let pool = state.db.clone();
    tokio::spawn(async move {
        let ip_opt = if recorded_ip == "unknown" {
            None
        } else {
            Some(recorded_ip)
        };
        if let Err(e) = ApiKey::record_usage(&pool, key_id, ip_opt.as_deref()).await {
            tracing::warn!(error = %e, key_id = %key_id, "Failed to record API key usage");
        }
    });

    // Detailed usage stash for the response-side fairing/middleware.
    let usage_ctx = ensure_extension::<ApiKeyUsageContext>(parts);
    let path = parts.uri.path().to_string();
    let method = parts.method.as_str().to_string();
    let ip_for_ctx = axum_client_ip(parts, state.settings.security.trust_proxy_headers);
    let ip_for_ctx = if ip_for_ctx == "unknown" {
        None
    } else {
        Some(ip_for_ctx)
    };
    let user_agent = header_str(&parts.headers, "user-agent").map(String::from);
    usage_ctx.populate(validation.id, path, method, ip_for_ctx, user_agent);

    Ok(AuthenticatedKey {
        id: validation.id,
        permission: validation.permission,
        site_id: Some(validation.site_id),
        auth_source: AuthSource::ApiKey,
    })
}

// ── AuthStrategy chain ───────────────────────────────────────────────────
//
// The three-strategy ladder expressed as a uniform interface. Each strategy
// owns its own credential validation *and* side effects (rate-limit headers,
// usage tracking, burst/quota, moderation) behind the trait; `AuthResolver`
// owns only the ordering. Holding the returned `AuthenticatedKey` is proof
// that exactly one strategy resolved it, with its side effects fired once.

/// One authentication strategy in the resolver chain.
///
/// Contract:
/// - `Ok(Some(key))` — this strategy owns and validated the credential; any
///   side effects have already fired exactly once.
/// - `Ok(None)`      — not my credential; the resolver tries the next strategy.
/// - `Err(e)`        — this strategy owns the credential but it is invalid;
///   resolution stops and `e` is returned.
trait AuthStrategy {
    async fn try_resolve(
        &self,
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Option<AuthenticatedKey>, ApiError>;
}

/// Strategy 1 — Clerk JWT from `Authorization: Bearer …`, with per-IP /
/// per-user rate limits and moderation-status enforcement as side effects.
struct ClerkStrategy;

impl AuthStrategy for ClerkStrategy {
    async fn try_resolve(
        &self,
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Option<AuthenticatedKey>, ApiError> {
        if !parts.headers.contains_key("authorization") {
            return Ok(None);
        }
        if let Some(auth) = try_clerk_jwt_axum(&parts.headers, state).await {
            apply_clerk_rate_limits(&auth, state, parts).await?;
            if let AuthSource::ClerkJwt { ref clerk_user_id } = auth.auth_source {
                auth_guard::check_moderation_status(&state.db, clerk_user_id).await?;
            }
            return Ok(Some(auth));
        }
        // Authorization header present but not a resolvable Clerk JWT. Defer to
        // another credential when the caller supplied one; otherwise this is a
        // hard "invalid bearer" failure (preserves the Rocket-era precedent).
        if parts.headers.contains_key(API_KEY_HEADER)
            || parts.headers.contains_key(PREVIEW_TOKEN_HEADER)
        {
            return Ok(None);
        }
        Err(ApiError::unauthorized("Invalid Bearer token").with_code(codes::AUTH_TOKEN_INVALID))
    }
}

/// Strategy 2 — read-only, site-scoped preview token (`X-Preview-Token`).
/// No rate-limit / usage side effects by construction.
struct PreviewStrategy;

impl AuthStrategy for PreviewStrategy {
    async fn try_resolve(
        &self,
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Option<AuthenticatedKey>, ApiError> {
        Ok(try_preview_token_axum(&parts.headers, state))
    }
}

/// Strategy 3 — `X-API-Key`, with IP / burst / quota limits + usage tracking.
struct ApiKeyStrategy;

impl AuthStrategy for ApiKeyStrategy {
    async fn try_resolve(
        &self,
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Option<AuthenticatedKey>, ApiError> {
        if !parts.headers.contains_key(API_KEY_HEADER) {
            return Ok(None);
        }
        try_api_key_axum(parts, state).await.map(Some)
    }
}

/// Owns the ordered fallthrough across the three strategies. The first
/// `Ok(Some)` wins; if every strategy declines, the request carried no
/// recognised credential.
struct AuthResolver;

impl AuthResolver {
    async fn resolve(parts: &mut Parts, state: &AppState) -> Result<AuthenticatedKey, ApiError> {
        if let Some(auth) = ClerkStrategy.try_resolve(parts, state).await? {
            return Ok(auth);
        }
        if let Some(auth) = PreviewStrategy.try_resolve(parts, state).await? {
            return Ok(auth);
        }
        if let Some(auth) = ApiKeyStrategy.try_resolve(parts, state).await? {
            return Ok(auth);
        }
        Err(ApiError::unauthorized(
            "Missing authentication: provide Authorization Bearer token or X-API-Key header",
        )
        .with_code(codes::AUTH_MISSING_CREDENTIALS))
    }
}

impl FromRequestParts<AppState> for AuthenticatedKey {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        AuthResolver::resolve(parts, state).await
    }
}

// ── Role-gated extractor ─────────────────────────────────────────────────
//
// One generic impl resolves the `Actor` once and applies the gate's
// `predicate || is_system_admin`. Clerk JWT users only satisfy the write
// tiers via system-admin status — a regular signed-in user is denied even
// when their token validates, matching the Rocket precedent. API keys pass
// directly when their permission tier is sufficient. The four role-named
// aliases (`MasterKey`/`AdminKey`/`WriteKey`/`ReadKey`) select the gate.

impl<G: RoleGate> FromRequestParts<AppState> for RoleGated<G> {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let actor = Actor::from_request_parts(parts, state).await?;

        if G::permits(&actor) {
            return Ok(RoleGated(actor, PhantomData));
        }
        if G::allow_system_admin_override()
            && actor.is_system_admin(&state.db).await.unwrap_or(false)
        {
            return Ok(RoleGated(actor, PhantomData));
        }
        Err(ApiError::forbidden(G::denied_message()).with_code(codes::AUTH_INSUFFICIENT_ROLE))
    }
}

// ── Actor — unified authenticated-principal seam ─────────────────────────
//
// Slice 1+2 of issue #619: runs the existing strategy ladder via
// `AuthenticatedKey`, then converts the result into an `Actor`. Resolution
// is cached in `parts.extensions` so repeated `Actor` extraction within
// the same request is zero-cost (the JWT verify / API-key DB lookup that
// `AuthenticatedKey::from_request_parts` performs runs at most once).
// Slice 3 will re-express the role-gated wrappers as newtypes over `Actor`.

impl FromRequestParts<AppState> for Actor {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        if let Some(cached) = parts.extensions.get::<Actor>() {
            return Ok(cached.clone());
        }
        let auth = AuthenticatedKey::from_request_parts(parts, state).await?;
        let actor = Actor::from_authenticated(&auth)?;
        parts.extensions.insert(actor.clone());
        Ok(actor)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::extract::Request;
    use axum::http::HeaderValue;

    /// Drives a header-based extractor against a synthetic request — no router,
    /// no listener, no state. Returns the extracted value.
    async fn extract<E>(headers: &[(&str, &str)]) -> E
    where
        E: FromRequestParts<()>,
        E::Rejection: std::fmt::Debug,
    {
        let mut req = Request::builder().uri("/");
        for (k, v) in headers {
            req = req.header(*k, HeaderValue::from_str(v).unwrap());
        }
        let (mut parts, _) = req.body(Body::empty()).unwrap().into_parts();
        E::from_request_parts(&mut parts, &()).await.unwrap()
    }

    #[tokio::test]
    async fn client_ip_prefers_x_forwarded_for() {
        let ClientIp(ip) = extract(&[("x-forwarded-for", "203.0.113.5, 10.0.0.1")]).await;
        assert_eq!(ip, "203.0.113.5");
    }

    #[tokio::test]
    async fn client_ip_falls_back_to_x_real_ip() {
        let ClientIp(ip) = extract(&[("x-real-ip", "198.51.100.7")]).await;
        assert_eq!(ip, "198.51.100.7");
    }

    #[tokio::test]
    async fn client_ip_unknown_when_no_proxy_headers() {
        let ClientIp(ip) = extract(&[]).await;
        assert_eq!(ip, "unknown");
    }

    #[tokio::test]
    async fn client_ip_skips_empty_x_forwarded_for() {
        let ClientIp(ip) = extract(&[("x-forwarded-for", ""), ("x-real-ip", "192.0.2.9")]).await;
        assert_eq!(ip, "192.0.2.9");
    }

    #[tokio::test]
    async fn user_agent_reads_header() {
        let UserAgent(ua) = extract(&[("user-agent", "curl/8.0")]).await;
        assert_eq!(ua, "curl/8.0");
    }

    #[tokio::test]
    async fn user_agent_unknown_when_missing() {
        let UserAgent(ua) = extract(&[]).await;
        assert_eq!(ua, "unknown");
    }

    // --- ResolveLocale ---------------------------------------------------

    async fn extract_locale(uri: &str) -> ResolveLocale {
        let (mut parts, _) = Request::builder()
            .uri(uri)
            .body(Body::empty())
            .unwrap()
            .into_parts();
        ResolveLocale::from_request_parts(&mut parts, &())
            .await
            .unwrap()
    }

    #[tokio::test]
    async fn resolve_locale_reads_query_param() {
        let ResolveLocale(code) = extract_locale("/projects?locale=en").await;
        assert_eq!(code.as_deref(), Some("en"));
    }

    #[tokio::test]
    async fn resolve_locale_none_when_absent() {
        let ResolveLocale(code) = extract_locale("/projects").await;
        assert!(code.is_none());
    }

    #[tokio::test]
    async fn resolve_locale_none_when_empty() {
        let ResolveLocale(code) = extract_locale("/projects?locale=").await;
        assert!(code.is_none());
    }

    #[tokio::test]
    async fn resolve_locale_picks_locale_among_other_params() {
        let ResolveLocale(code) = extract_locale("/projects?page=1&locale=de-AT&sort=asc").await;
        assert_eq!(code.as_deref(), Some("de-AT"));
    }

    // --- CurrentSite resolution helpers ---------------------------------
    // The full CurrentSite extractor needs an AppState (DB pool) so its
    // success path is covered by integration tests. Here we exercise the
    // pure resolution helpers — that's where the routing logic lives.

    fn build_headers(pairs: &[(&str, &str)]) -> axum::http::HeaderMap {
        let mut h = axum::http::HeaderMap::new();
        for (k, v) in pairs {
            h.insert(
                axum::http::HeaderName::from_bytes(k.as_bytes()).unwrap(),
                axum::http::HeaderValue::from_str(v).unwrap(),
            );
        }
        h
    }

    #[test]
    fn site_domain_extracts_header_value() {
        let h = build_headers(&[("x-site-domain", "example.com")]);
        assert_eq!(site_domain_from_headers(&h), Some("example.com"));
    }

    #[test]
    fn site_domain_trims_whitespace() {
        let h = build_headers(&[("x-site-domain", "  example.com  ")]);
        assert_eq!(site_domain_from_headers(&h), Some("example.com"));
    }

    #[test]
    fn site_domain_rejects_empty_header() {
        let h = build_headers(&[("x-site-domain", "")]);
        assert_eq!(site_domain_from_headers(&h), None);
    }

    #[test]
    fn site_domain_rejects_whitespace_only() {
        let h = build_headers(&[("x-site-domain", "   ")]);
        assert_eq!(site_domain_from_headers(&h), None);
    }

    #[test]
    fn site_domain_none_when_header_absent() {
        let h = build_headers(&[]);
        assert_eq!(site_domain_from_headers(&h), None);
    }

    #[test]
    fn site_id_picks_named_param() {
        let id = Uuid::new_v4();
        let id_str = id.to_string();
        let params = [("site_id", id_str.as_str())];
        assert_eq!(site_id_from_path_params(params.iter().copied()), Some(id));
    }

    #[test]
    fn site_id_ignores_other_params() {
        let id = Uuid::new_v4();
        let id_str = id.to_string();
        let params = [
            ("post_id", "irrelevant"),
            ("site_id", id_str.as_str()),
            ("page", "2"),
        ];
        assert_eq!(site_id_from_path_params(params.iter().copied()), Some(id));
    }

    #[test]
    fn site_id_none_when_param_missing() {
        let params: [(&str, &str); 0] = [];
        assert_eq!(site_id_from_path_params(params.iter().copied()), None);
    }

    #[test]
    fn site_id_none_when_param_not_uuid() {
        let params = [("site_id", "not-a-uuid")];
        assert_eq!(site_id_from_path_params(params.iter().copied()), None);
    }

    // --- ModuleGuard rejection helper -----------------------------------
    // The full ModuleGuard extractor needs an AppState for its success path
    // (DB lookup) so that's covered by integration tests. Here we lock the
    // shape of the error returned when site_id is absent — both branches of
    // the impl funnel through this helper.

    use crate::guards::module_guard::{BlogModule, LegalModule};

    #[test]
    fn missing_site_id_error_uses_module_name() {
        let err = missing_site_id_error::<BlogModule>();
        assert_eq!(err.status().as_u16(), 500);
        assert!(err.to_string().contains("blog"));
    }

    #[test]
    fn missing_site_id_error_distinguishes_modules() {
        let blog_err = missing_site_id_error::<BlogModule>();
        let legal_err = missing_site_id_error::<LegalModule>();
        assert_ne!(blog_err.to_string(), legal_err.to_string());
        assert!(legal_err.to_string().contains("legal"));
    }

    // --- AuthenticatedKey orchestration helpers -------------------------
    // The full extractor needs an AppState (DB pool, Redis, Clerk JWKS)
    // so its success path lives in integration tests. Here we lock the
    // pure helpers and the no-Clerk early-out branch.

    fn make_headers(pairs: &[(&str, &str)]) -> HeaderMap {
        let mut h = HeaderMap::new();
        for (k, v) in pairs {
            h.insert(
                axum::http::HeaderName::from_bytes(k.as_bytes()).unwrap(),
                HeaderValue::from_str(v).unwrap(),
            );
        }
        h
    }

    #[test]
    fn header_str_returns_utf8_value() {
        let h = make_headers(&[("x-test", "hello")]);
        assert_eq!(header_str(&h, "x-test"), Some("hello"));
    }

    #[test]
    fn header_str_none_when_missing() {
        let h = make_headers(&[]);
        assert_eq!(header_str(&h, "x-test"), None);
    }

    #[test]
    fn header_str_none_for_non_utf8() {
        let mut h = HeaderMap::new();
        h.insert(
            axum::http::HeaderName::from_static("x-binary"),
            HeaderValue::from_bytes(&[0xff, 0xfe]).unwrap(),
        );
        assert_eq!(header_str(&h, "x-binary"), None);
    }

    #[test]
    fn ensure_extension_creates_once_and_returns_same_arc() {
        let req = Request::builder().uri("/").body(Body::empty()).unwrap();
        let (mut parts, _) = req.into_parts();
        let first = ensure_extension::<RateLimitHeaderInfo>(&mut parts);
        let second = ensure_extension::<RateLimitHeaderInfo>(&mut parts);
        // Same allocation: the second call must reuse the inserted instance
        // rather than constructing a fresh default.
        assert!(Arc::ptr_eq(&first, &second));
    }

    /// Build an AppState pointed at no DB / no Redis / no Clerk. The fields
    /// we read in the test paths are independent of the placeholder pool.
    fn make_minimal_state() -> AppState {
        use std::sync::Arc;
        AppState {
            db: sqlx::PgPool::connect_lazy("postgres://localhost/forja_test_unused").unwrap(),
            settings: crate::config::Settings::default(),
            redis: None,
            clerk_service: None,
            storage: Arc::new(crate::services::storage::LocalStorage::new(
                "/tmp/forja-test-unused".to_string(),
                "/uploads".to_string(),
            )),
            clerk_jwks: None,
            dashboard_csp_template: Arc::from(""),
            demo_guest_key: std::sync::OnceLock::new(),
        }
    }

    #[tokio::test]
    async fn try_clerk_jwt_axum_returns_none_when_clerk_disabled() {
        // Empty clerk_secret_key means Clerk auth is disabled — the helper
        // must short-circuit with None rather than attempting validation.
        let state = make_minimal_state();
        let headers = make_headers(&[("authorization", "Bearer some.token.value")]);
        assert!(try_clerk_jwt_axum(&headers, &state).await.is_none());
    }

    #[tokio::test]
    async fn try_clerk_jwt_axum_returns_none_when_no_authorization_header() {
        let mut state = make_minimal_state();
        state.settings.security.clerk_secret_key = "sk_test_anything".to_string();
        let headers = make_headers(&[]);
        assert!(try_clerk_jwt_axum(&headers, &state).await.is_none());
    }

    #[tokio::test]
    async fn try_clerk_jwt_axum_returns_none_when_authorization_not_bearer() {
        let mut state = make_minimal_state();
        state.settings.security.clerk_secret_key = "sk_test_anything".to_string();
        let headers = make_headers(&[("authorization", "Basic dXNlcjpwYXNz")]);
        assert!(try_clerk_jwt_axum(&headers, &state).await.is_none());
    }

    // `try_preview_token_axum` is sync, but `make_minimal_state()` builds
    // a lazy `PgPool` whose constructor needs a Tokio runtime in scope.
    // Marking these `#[tokio::test]` is the lightest way to satisfy that.

    #[tokio::test]
    async fn try_preview_token_axum_returns_none_when_secret_unset() {
        // No secret configured → preview tokens disabled even if the header
        // is present. This guards against accidentally accepting forged
        // tokens when an operator has not opted in.
        let state = make_minimal_state();
        let headers = make_headers(&[("x-preview-token", "any.value")]);
        assert!(try_preview_token_axum(&headers, &state).is_none());
    }

    #[tokio::test]
    async fn try_preview_token_axum_returns_none_when_header_missing() {
        let mut state = make_minimal_state();
        state.settings.security.preview_token_secret = "secret".to_string();
        let headers = make_headers(&[]);
        assert!(try_preview_token_axum(&headers, &state).is_none());
    }

    #[tokio::test]
    async fn try_preview_token_axum_returns_none_when_token_invalid() {
        let mut state = make_minimal_state();
        state.settings.security.preview_token_secret = "secret".to_string();
        let headers = make_headers(&[("x-preview-token", "not-a-valid-token")]);
        assert!(try_preview_token_axum(&headers, &state).is_none());
    }

    #[test]
    fn axum_client_ip_prefers_xff_when_trusted() {
        let req = Request::builder()
            .uri("/")
            .header("x-forwarded-for", "203.0.113.5, 10.0.0.1")
            .body(Body::empty())
            .unwrap();
        let (parts, _) = req.into_parts();
        assert_eq!(axum_client_ip(&parts, true), "203.0.113.5");
    }

    #[test]
    fn axum_client_ip_returns_unknown_without_proxy_headers() {
        let req = Request::builder().uri("/").body(Body::empty()).unwrap();
        let (parts, _) = req.into_parts();
        assert_eq!(axum_client_ip(&parts, true), "unknown");
    }

    #[tokio::test]
    async fn actor_extraction_returns_cached_value_on_repeat() {
        // When an `Actor` is already in `parts.extensions`, the extractor
        // must short-circuit before touching `AppState` — this is what makes
        // a request with both `ReadKey` and `Actor` (or two `Actor` reads
        // for that matter) pay the auth cost at most once.
        let state = make_minimal_state();
        let req = Request::builder().uri("/").body(Body::empty()).unwrap();
        let (mut parts, _) = req.into_parts();

        let cached = Actor {
            id: Uuid::new_v4(),
            kind: crate::guards::actor::ActorKind::Clerk {
                clerk_user_id: "user_cached".to_string(),
            },
        };
        parts.extensions.insert(cached.clone());

        let extracted = Actor::from_request_parts(&mut parts, &state)
            .await
            .expect("cached actor must round-trip without AppState resolution");
        assert_eq!(extracted.id, cached.id);
    }

    #[test]
    fn axum_client_ip_ignores_xff_when_not_trusted() {
        // Forwarded headers must be ignored when the operator hasn't opted
        // in to trusting them — otherwise an attacker could spoof source IPs
        // and bypass per-IP rate limits.
        let req = Request::builder()
            .uri("/")
            .header("x-forwarded-for", "203.0.113.5")
            .body(Body::empty())
            .unwrap();
        let (parts, _) = req.into_parts();
        assert_eq!(axum_client_ip(&parts, false), "unknown");
    }

    // --- AuthStrategy chain ---------------------------------------------
    // Each adapter's "not my credential → Ok(None)" path and the resolver's
    // ordering/terminal behaviour are pure of the DB, so they unit-test here.
    // The credential-valid success paths for Clerk/API key need a live DB and
    // JWKS, so those live in integration tests.

    fn parts_with(pairs: &[(&str, &str)]) -> Parts {
        let mut builder = Request::builder().uri("/");
        for (k, v) in pairs {
            builder = builder.header(*k, *v);
        }
        builder.body(Body::empty()).unwrap().into_parts().0
    }

    #[tokio::test]
    async fn clerk_strategy_declines_without_authorization_header() {
        let state = make_minimal_state();
        let mut parts = parts_with(&[]);
        let resolved = ClerkStrategy.try_resolve(&mut parts, &state).await.unwrap();
        assert!(resolved.is_none(), "no bearer → not my credential");
    }

    #[tokio::test]
    async fn clerk_strategy_hard_fails_invalid_bearer_without_fallback() {
        // Authorization present, unresolvable, and no other credential header:
        // the caller clearly intended bearer auth, so fail loudly.
        let state = make_minimal_state();
        let mut parts = parts_with(&[("authorization", "Bearer not.a.jwt")]);
        let err = ClerkStrategy
            .try_resolve(&mut parts, &state)
            .await
            .expect_err("invalid bearer with no fallback must hard-fail");
        assert_eq!(err.code(), codes::AUTH_TOKEN_INVALID);
    }

    #[tokio::test]
    async fn clerk_strategy_defers_when_api_key_header_present() {
        // Unresolvable bearer but an X-API-Key is also supplied → defer, so the
        // resolver falls through to the API-key strategy.
        let state = make_minimal_state();
        let mut parts = parts_with(&[("authorization", "Bearer not.a.jwt"), (API_KEY_HEADER, "k")]);
        let resolved = ClerkStrategy.try_resolve(&mut parts, &state).await.unwrap();
        assert!(resolved.is_none(), "must defer to the API-key strategy");
    }

    #[tokio::test]
    async fn preview_strategy_declines_without_token_header() {
        let mut state = make_minimal_state();
        state.settings.security.preview_token_secret = "secret".to_string();
        let mut parts = parts_with(&[]);
        let resolved = PreviewStrategy
            .try_resolve(&mut parts, &state)
            .await
            .unwrap();
        assert!(resolved.is_none());
    }

    #[tokio::test]
    async fn preview_strategy_resolves_valid_token_to_preview_variant() {
        let mut state = make_minimal_state();
        state.settings.security.preview_token_secret = "test-secret".to_string();
        let site_id = Uuid::new_v4();
        let (token, _ttl) =
            crate::services::preview_token::generate(site_id, "test-secret").unwrap();
        let mut parts = parts_with(&[(PREVIEW_TOKEN_HEADER, &token)]);

        let resolved = PreviewStrategy
            .try_resolve(&mut parts, &state)
            .await
            .unwrap()
            .expect("valid preview token resolves");
        match resolved.auth_source {
            AuthSource::PreviewToken { site_id: got } => assert_eq!(got, site_id),
            other => panic!("expected PreviewToken, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn api_key_strategy_declines_without_header() {
        let state = make_minimal_state();
        let mut parts = parts_with(&[]);
        let resolved = ApiKeyStrategy
            .try_resolve(&mut parts, &state)
            .await
            .unwrap();
        assert!(resolved.is_none());
    }

    #[tokio::test]
    async fn resolver_missing_credentials_when_no_headers() {
        let state = make_minimal_state();
        let mut parts = parts_with(&[]);
        let err = AuthResolver::resolve(&mut parts, &state)
            .await
            .expect_err("no credentials → terminal error");
        assert_eq!(err.code(), codes::AUTH_MISSING_CREDENTIALS);
    }

    #[tokio::test]
    async fn resolver_first_some_wins_preview_before_api_key() {
        // A valid preview token AND an X-API-Key are both present. Preview sits
        // ahead of API key in the chain, so it wins — and the DB-backed API-key
        // path is never reached (this test runs without a live DB).
        let mut state = make_minimal_state();
        state.settings.security.preview_token_secret = "test-secret".to_string();
        let site_id = Uuid::new_v4();
        let (token, _ttl) =
            crate::services::preview_token::generate(site_id, "test-secret").unwrap();
        let mut parts = parts_with(&[(PREVIEW_TOKEN_HEADER, &token), (API_KEY_HEADER, "ignored")]);

        let resolved = AuthResolver::resolve(&mut parts, &state).await.unwrap();
        match resolved.auth_source {
            AuthSource::PreviewToken { site_id: got } => assert_eq!(got, site_id),
            other => panic!("expected preview to win, got {:?}", other),
        }
    }
}
