//! Per-request, per-site dynamic CORS. Mirrors the Rocket CORS block
//! inside the security-headers fairing (`main.rs` lines 415–453).
//!
//! Three categories (`crate::middleware::cors::CorsCategory`):
//! - **Public** — health, `.well-known`, nodeinfo → echo the requesting Origin
//! - **Admin** — dashboard, auth, anything not under `/sites/<uuid>/` →
//!   global `CORS_ALLOWED_ORIGINS` allowlist
//! - **Site-scoped** — `/sites/<uuid>/...` → the site's `allowed_origins`
//!   setting, fetched per request via `SiteSetting::get_value`
//!
//! Standard `tower-http::CorsLayer` is static (one allowlist for the
//! whole app), so we hand-roll this layer with `from_fn_with_state` to
//! get the per-site DB lookup. The lookup is one Postgres round-trip
//! per cross-origin request that targets `/sites/<uuid>/...` — the
//! call site can be cached later if it shows up in profiling.
//!
//! Preflight (OPTIONS) is short-circuited with 204 + headers and never
//! reaches the handler. Non-preflight requests pass through and the
//! response gets CORS headers grafted on after `next.run()`.

use axum::extract::{Request, State};
use axum::http::header::{HeaderMap, ACCESS_CONTROL_ALLOW_METHODS};
use axum::http::{HeaderName, HeaderValue, Method, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};

use crate::middleware::cors;
use crate::AppState;

const ACCESS_CONTROL_ALLOW_ORIGIN: HeaderName =
    HeaderName::from_static("access-control-allow-origin");
const ACCESS_CONTROL_ALLOW_HEADERS: HeaderName =
    HeaderName::from_static("access-control-allow-headers");
const ACCESS_CONTROL_MAX_AGE: HeaderName = HeaderName::from_static("access-control-max-age");
const VARY: HeaderName = HeaderName::from_static("vary");

const ALLOW_METHODS: HeaderValue =
    HeaderValue::from_static("GET, POST, PUT, PATCH, DELETE, OPTIONS");
const ALLOW_HEADERS: HeaderValue =
    HeaderValue::from_static("Content-Type, Authorization, X-API-Key, X-Site-Domain, X-Request-ID");
const MAX_AGE: HeaderValue = HeaderValue::from_static("86400");

fn parse_global_origins(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

fn write_cors_headers(headers: &mut HeaderMap, allowed_origin: Option<&str>) {
    if let Some(origin) = allowed_origin {
        if let Ok(v) = HeaderValue::from_str(origin) {
            headers.insert(ACCESS_CONTROL_ALLOW_ORIGIN, v);
        }
        if cors::needs_vary_header(origin) {
            headers.insert(VARY, HeaderValue::from_static("Origin"));
        }
    }
    headers.insert(ACCESS_CONTROL_ALLOW_METHODS, ALLOW_METHODS);
    headers.insert(ACCESS_CONTROL_ALLOW_HEADERS, ALLOW_HEADERS);
    headers.insert(ACCESS_CONTROL_MAX_AGE, MAX_AGE);
}

pub async fn layer(State(state): State<AppState>, req: Request, next: Next) -> Response {
    let origin = req
        .headers()
        .get("origin")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let path = req.uri().path().to_string();
    let is_preflight = req.method() == Method::OPTIONS;

    let global_origins = parse_global_origins(&state.settings.security.cors_allowed_origins);
    let allowed =
        cors::resolve_allowed_origin(origin.as_deref(), &path, &global_origins, &state.db).await;

    if is_preflight {
        let mut response = (StatusCode::NO_CONTENT, ()).into_response();
        write_cors_headers(response.headers_mut(), allowed.as_deref());
        return response;
    }

    let mut response = next.run(req).await;
    write_cors_headers(response.headers_mut(), allowed.as_deref());
    response
}
