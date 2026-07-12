//! Tower middleware layer for auth brute-force rate limiting.
//!
//! Applied globally via `build_router()`; uses `is_auth_path` to gate on
//! auth endpoints only. Non-auth requests pass through unchanged.
//!
//! Two-phase: pre-check (block early if limit exceeded) and post-check
//! (record 401/403 failures). No-op when Redis is unavailable (fail-open).

use axum::extract::{Request, State};
use axum::http::{HeaderValue, StatusCode, header};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};

use crate::AppState;
use crate::errors::ProblemDetails;
use crate::guards::auth_guard;
use crate::middleware::auth_rate_limit::{AuthRateLimiter, is_auth_path};

fn rate_limited_response() -> Response {
    let body = ProblemDetails {
        problem_type: "https://forja.dev/errors/auth_rate_limited".to_string(),
        title: "Too Many Authentication Attempts".to_string(),
        status: 429,
        detail: Some(
            "Too many failed authentication attempts from your IP. Wait before retrying."
                .to_string(),
        ),
        instance: None,
        code: "AUTH_RATE_LIMITED".to_string(),
        entity_type: None,
        errors: None,
    };
    let json = serde_json::to_string(&body).unwrap_or_else(|_| "{}".to_string());
    (
        StatusCode::TOO_MANY_REQUESTS,
        [(
            header::CONTENT_TYPE,
            HeaderValue::from_static("application/json"),
        )],
        json,
    )
        .into_response()
}

pub async fn layer(State(state): State<AppState>, req: Request, next: Next) -> Response {
    let path = req.uri().path().to_string();

    if !is_auth_path(&path) {
        return next.run(req).await;
    }

    let Some(mut redis) = state.redis.clone() else {
        // No Redis configured — fail-open, pass through
        return next.run(req).await;
    };

    // Resolve client IP before consuming the request
    let xff = req
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let xri = req
        .headers()
        .get("x-real-ip")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let ip = auth_guard::resolve_client_ip(
        xff.as_deref(),
        xri.as_deref(),
        "unknown",
        state.settings.security.trust_proxy_headers,
    );

    // Pre-check: block if this IP is already rate-limited
    if AuthRateLimiter::check_auth_limit(&mut redis, &ip, &state.settings.security)
        .await
        .is_err()
    {
        return rate_limited_response();
    }

    // Run the handler
    let response = next.run(req).await;

    // Post-check: record failure if 401 or 403
    AuthRateLimiter::record_failure(
        &mut redis,
        &ip,
        &state.settings.security,
        response.status().as_u16(),
    )
    .await;

    response
}
