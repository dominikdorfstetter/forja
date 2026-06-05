//! IP-based rate limiting for unauthenticated public endpoints.
//!
//! Mirrors `crate::middleware::public_rate_limit::PublicRateLimitFairing`
//! but in tower-middleware shape. The Rocket version had to use the
//! flag-on-request / replace-on-response dance because Rocket fairings
//! can't short-circuit. Axum middleware can return a response directly,
//! so this layer dispatches the 429 inline and the handler never runs.
//!
//! Public-path classification reuses
//! `crate::middleware::public_rate_limit::is_public_path` — single source
//! of truth for which routes count as "public" across both stacks.
//!
//! No-op when Redis isn't configured (matches the authenticated-guard
//! fail-open behavior).

use axum::extract::{Request, State};
use axum::http::{header, HeaderValue, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};

use crate::errors::ProblemDetails;
use crate::guards::auth_guard;
use crate::middleware::public_rate_limit::is_public_path;
use crate::middleware::rate_limit::RateLimiter;
use crate::AppState;

fn rate_limited_response() -> Response {
    let body = ProblemDetails {
        problem_type: "https://forja.dev/errors/rate_limited".to_string(),
        title: "Too Many Requests".to_string(),
        status: 429,
        detail: Some(
            "Rate limit exceeded on a public endpoint. Slow down and retry shortly.".to_string(),
        ),
        instance: None,
        code: "RATE_LIMITED".to_string(),
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
    if !is_public_path(req.uri().path()) {
        return next.run(req).await;
    }

    let Some(redis) = state.redis.clone() else {
        return next.run(req).await;
    };

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

    let mut conn = redis;
    if RateLimiter::check_ip(&mut conn, &ip, &state.settings.security)
        .await
        .is_err()
    {
        return rate_limited_response();
    }

    next.run(req).await
}
