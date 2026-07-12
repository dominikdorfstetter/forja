//! Static security headers + CSP fallback. Mirrors the Rocket
//! `Security Headers` fairing in `main.rs` (the response-mutating closure
//! attached via `AdHoc::on_response`).
//!
//! Headers applied unconditionally on every response:
//! - `X-Content-Type-Options: nosniff`
//! - `X-XSS-Protection: 1; mode=block`
//! - `Referrer-Policy: strict-origin-when-cross-origin`
//! - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
//! - `Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()`
//! - `Cross-Origin-Opener-Policy: same-origin-allow-popups` (Clerk OAuth popups)
//!
//! Path-aware:
//! - `X-Frame-Options: DENY` everywhere except `/api-docs/*` (so the
//!   admin Swagger UI can be embedded in the dashboard iframe).
//! - **CSP fallback**: only set if the handler didn't already provide a
//!   `Content-Security-Policy` header (dashboard SPA + admin docs set
//!   their own per-request nonce-based CSPs). The fallback uses a tighter
//!   policy on `/api-docs/*` (allow inline styles for Swagger UI assets)
//!   and `default-src 'self'` everywhere else.
//!
//! Implemented via `axum::middleware::from_fn` rather than a hand-rolled
//! `Service` impl because all logic is post-response header mutation —
//! no request-time work, no async dependencies.

use axum::extract::Request;
use axum::http::HeaderName;
use axum::http::header::{
    CONTENT_SECURITY_POLICY, HeaderMap, HeaderValue, REFERRER_POLICY, STRICT_TRANSPORT_SECURITY,
};
use axum::middleware::Next;
use axum::response::Response;

const X_CONTENT_TYPE_OPTIONS: HeaderName = HeaderName::from_static("x-content-type-options");
const X_FRAME_OPTIONS: HeaderName = HeaderName::from_static("x-frame-options");
const X_XSS_PROTECTION: HeaderName = HeaderName::from_static("x-xss-protection");
const PERMISSIONS_POLICY: HeaderName = HeaderName::from_static("permissions-policy");
const COOP: HeaderName = HeaderName::from_static("cross-origin-opener-policy");

const CSP_DEFAULT: HeaderValue = HeaderValue::from_static("default-src 'self'");
// Consumer Swagger UI (mounted by utoipa-swagger-ui at /api-docs) ships
// HTML with **unnonced** inline `<script>` blocks that bootstrap the
// Swagger UI bundle. `script-src 'self'` would block them and the spec
// would never load, so this fallback allows `'unsafe-inline'` on the
// /api-docs/* surface only. The admin docs handler in
// `axum_app::handlers::docs` sets its own nonced CSP and overrides this
// fallback — only the read-only consumer Swagger UI relies on this.
const CSP_API_DOCS: HeaderValue = HeaderValue::from_static(
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'",
);

fn apply_static_headers(headers: &mut HeaderMap) {
    headers.insert(X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff"));
    headers.insert(X_XSS_PROTECTION, HeaderValue::from_static("1; mode=block"));
    headers.insert(
        REFERRER_POLICY,
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    headers.insert(
        STRICT_TRANSPORT_SECURITY,
        HeaderValue::from_static("max-age=31536000; includeSubDomains"),
    );
    headers.insert(
        PERMISSIONS_POLICY,
        HeaderValue::from_static("geolocation=(), microphone=(), camera=(), payment=()"),
    );
    headers.insert(COOP, HeaderValue::from_static("same-origin-allow-popups"));
}

/// `axum::middleware::from_fn` handler. The path is captured before
/// `next.run()` because the `Request` is consumed by the call.
pub async fn layer(req: Request, next: Next) -> Response {
    let path_starts_with_api_docs = req.uri().path().starts_with("/api-docs");
    let mut response = next.run(req).await;
    let headers = response.headers_mut();

    apply_static_headers(headers);

    if !path_starts_with_api_docs {
        headers.insert(X_FRAME_OPTIONS, HeaderValue::from_static("DENY"));
    }

    if !headers.contains_key(CONTENT_SECURITY_POLICY) {
        let csp = if path_starts_with_api_docs {
            CSP_API_DOCS
        } else {
            CSP_DEFAULT
        };
        headers.insert(CONTENT_SECURITY_POLICY, csp);
    }

    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::Router;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use axum::routing::get;
    use tower::ServiceExt;

    /// Trivial handler that returns 200 with no headers, so the middleware is
    /// the only thing producing response headers.
    async fn ok() -> StatusCode {
        StatusCode::OK
    }

    /// Handler that returns its own CSP. The fallback layer must NOT overwrite it.
    async fn ok_with_csp() -> ([(HeaderName, HeaderValue); 1], StatusCode) {
        (
            [(
                CONTENT_SECURITY_POLICY,
                HeaderValue::from_static("script-src 'self' 'nonce-abc'"),
            )],
            StatusCode::OK,
        )
    }

    fn build(handler: &str) -> Router {
        let r = Router::new();
        let r = match handler {
            "ok" => r.route("/test", get(ok)),
            "ok_csp" => r.route("/test", get(ok_with_csp)),
            "ok_docs" => r.route("/api-docs/admin", get(ok)),
            _ => unreachable!(),
        };
        r.layer(axum::middleware::from_fn(layer))
    }

    async fn header_for(handler: &str, path: &str, header: HeaderName) -> Option<String> {
        let resp = build(handler)
            .oneshot(Request::builder().uri(path).body(Body::empty()).unwrap())
            .await
            .unwrap();
        resp.headers()
            .get(&header)
            .map(|v| v.to_str().unwrap().to_string())
    }

    #[tokio::test]
    async fn always_emits_static_security_headers() {
        for (header, want) in [
            ("x-content-type-options", "nosniff"),
            ("x-xss-protection", "1; mode=block"),
            ("referrer-policy", "strict-origin-when-cross-origin"),
            (
                "strict-transport-security",
                "max-age=31536000; includeSubDomains",
            ),
            ("cross-origin-opener-policy", "same-origin-allow-popups"),
        ] {
            let got = header_for("ok", "/test", HeaderName::from_static(header)).await;
            assert_eq!(got.as_deref(), Some(want), "header {header}");
        }
    }

    #[tokio::test]
    async fn x_frame_options_set_outside_api_docs() {
        let got = header_for("ok", "/test", X_FRAME_OPTIONS).await;
        assert_eq!(got.as_deref(), Some("DENY"));
    }

    #[tokio::test]
    async fn x_frame_options_skipped_on_api_docs() {
        let got = header_for("ok_docs", "/api-docs/admin", X_FRAME_OPTIONS).await;
        assert_eq!(got, None, "Swagger UI must be embeddable in admin iframe");
    }

    #[tokio::test]
    async fn csp_fallback_default_for_api_paths() {
        let got = header_for("ok", "/test", CONTENT_SECURITY_POLICY).await;
        assert_eq!(got.as_deref(), Some("default-src 'self'"));
    }

    #[tokio::test]
    async fn csp_fallback_relaxed_for_api_docs() {
        let got = header_for("ok_docs", "/api-docs/admin", CONTENT_SECURITY_POLICY).await;
        assert!(
            got.as_deref()
                .is_some_and(|v| v.contains("style-src 'self' 'unsafe-inline'")),
            "got: {got:?}"
        );
    }

    #[tokio::test]
    async fn csp_handler_value_wins_over_fallback() {
        let got = header_for("ok_csp", "/test", CONTENT_SECURITY_POLICY).await;
        assert_eq!(got.as_deref(), Some("script-src 'self' 'nonce-abc'"));
    }
}
