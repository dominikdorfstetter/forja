//! Global 404 fallback. Replaces `crate::handlers::system::not_found`,
//! the Rocket catcher that returned RFC 7807 JSON when no route
//! matched.
//!
//! 401 and 429 don't get fallback handlers here:
//! - 401 is emitted from `ApiError::unauthorized()` in the auth
//!   extractors and already serializes to the same ProblemDetails shape.
//! - 429 is emitted inline by `middleware::public_rate_limit::layer`,
//!   also already in the right shape.
//!
//! 404 is the only error code that can reach the response without a
//! Forja code path running, so it's the only case that needs a backstop
//! in Axum.

use axum::extract::Request;
use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};

use crate::errors::ProblemDetails;

pub async fn handler(req: Request) -> Response {
    let body = ProblemDetails {
        problem_type: "https://forja.dev/errors/not_found".to_string(),
        title: "Not Found".to_string(),
        status: 404,
        detail: Some(format!("No route matched: {} {}", req.method(), req.uri())),
        instance: None,
        code: "NOT_FOUND".to_string(),
        entity_type: None,
        errors: None,
    };
    let json = serde_json::to_string(&body).unwrap_or_default();
    (
        StatusCode::NOT_FOUND,
        [(
            header::CONTENT_TYPE,
            HeaderValue::from_static("application/json"),
        )],
        json,
    )
        .into_response()
}
