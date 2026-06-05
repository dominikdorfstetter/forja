//! Custom docs surface that lives next to the bundled consumer Swagger UI:
//!
//! - `GET /api-docs/admin` — Swagger UI HTML for the admin OpenAPI doc,
//!   gated by Clerk session cookie + system-admin role check. Reuses the
//!   bundled JS/CSS assets that `utoipa-swagger-ui` serves at
//!   `/api-docs/consumer/...`.
//! - `GET /api-docs/admin/openapi.json` — the admin spec, same gate.
//! - `GET /api-docs` — permanent redirect to `/api-docs/consumer/`.
//!   The admin SPA's `ApiDocs` page loads two iframes pointing at
//!   `/api-docs/consumer/` and `/api-docs/admin/`, so both URL spaces
//!   must exist exactly as the SPA expects.
//!
//! The session check parses the `__session` cookie out of the `Cookie:`
//! request header (no `axum-extra` dep required), validates it against
//! the cached `ClerkJwksState` on `AppState.clerk_jwks`, and confirms
//! the resulting Clerk user is a system admin via
//! `SiteMembership::is_system_admin`.

use std::sync::Arc;

use axum::extract::State;
use axum::http::header::CONTENT_SECURITY_POLICY;
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Redirect};
use axum::routing::get;
use axum::{Extension, Router};

use crate::models::site_membership::SiteMembership;
use crate::utils::csp::generate_nonce;
use crate::AppState;

const FORBIDDEN_HTML: &str = r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>403 Forbidden</title>
    <style>
        body { font-family: system-ui, sans-serif; max-width: 600px; margin: 80px auto; padding: 0 1rem; }
        h1 { color: #d32f2f; }
    </style>
</head>
<body>
    <h1>403 Forbidden</h1>
    <p>Admin API documentation requires a valid Clerk session with system admin role.</p>
    <p>Please <a href="/dashboard">log in to the admin dashboard</a> first.</p>
</body>
</html>"#;

/// Build the Swagger UI HTML with a per-request CSP nonce on inline scripts.
/// Returns `(html, nonce)` so the caller can set a matching CSP header.
fn admin_swagger_html() -> (String, String) {
    let nonce = generate_nonce();
    let html = format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Forja Admin API</title>
    <link rel="stylesheet" href="/api-docs/consumer/swagger-ui.css" />
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="/api-docs/consumer/swagger-ui-bundle.js"></script>
    <script nonce="{nonce}">
        SwaggerUIBundle({{
            url: '/api-docs/admin/openapi.json',
            dom_id: '#swagger-ui',
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIBundle.SwaggerUIStandalonePreset
            ],
            layout: 'BaseLayout'
        }});
    </script>
</body>
</html>"#
    );
    (html, nonce)
}

/// Pull the value of a single cookie out of the `Cookie:` header. Cookies
/// in HTTP are sent as `name1=value1; name2=value2; ...`, so we just split
/// the header on `;`, trim, and look for `name=`. This avoids pulling in
/// `axum-extra` for a one-cookie use case.
fn cookie_value<'h>(headers: &'h HeaderMap, name: &str) -> Option<&'h str> {
    let raw = headers.get(axum::http::header::COOKIE)?.to_str().ok()?;
    raw.split(';').find_map(|pair| {
        let pair = pair.trim();
        let (k, v) = pair.split_once('=')?;
        if k == name {
            Some(v)
        } else {
            None
        }
    })
}

/// HTML response body returned when admin-session validation fails.
fn forbidden_html() -> axum::response::Response {
    (
        StatusCode::FORBIDDEN,
        [(
            axum::http::header::CONTENT_TYPE,
            HeaderValue::from_static("text/html; charset=utf-8"),
        )],
        FORBIDDEN_HTML,
    )
        .into_response()
}

/// Validate the `__session` cookie and confirm the caller is a Forja
/// system admin. Returns `Ok(())` on success; `Err(response)` short-
/// circuits with a 403 HTML page (matching the Rocket behavior so the
/// admin docs page never reveals whether the cookie was malformed vs.
/// merely non-admin).
///
/// CSRF defense-in-depth: rejects requests where `Origin` or `Referer`
/// doesn't match the configured `public_url`. Clerk's `__session` cookie
/// uses `SameSite=Lax` in production (blocks cross-origin form POST/fetch),
/// but this adds a server-side check for browsers that don't enforce
/// SameSite and for development where SameSite may be `None`.
async fn validate_admin_session(
    headers: &HeaderMap,
    state: &AppState,
) -> Result<(), axum::response::Response> {
    // ── CSRF defense-in-depth: reject cross-origin requests ────────
    // Clerk's production __session cookie has SameSite=Lax, which the
    // browser enforces.  This server-side check catches edge-cases:
    // SameSite=None development instances, browsers that don't enforce
    // SameSite, and misconfigured reverse proxies.
    let public_url = &state.settings.public_url;
    if let Some(origin) = headers
        .get(axum::http::header::ORIGIN)
        .and_then(|v| v.to_str().ok())
    {
        if origin != public_url {
            return Err(forbidden_html());
        }
    } else if let Some(referer) = headers
        .get(axum::http::header::REFERER)
        .and_then(|v| v.to_str().ok())
    {
        // Referer must exactly equal public_url OR start with public_url + "/"
        // (prevents http://public.url.evil.com bypass)
        if referer != public_url && !referer.starts_with(&format!("{public_url}/")) {
            return Err(forbidden_html());
        }
    }
    let session = cookie_value(headers, "__session").ok_or_else(forbidden_html)?;

    let jwks = state.clerk_jwks.as_ref().ok_or_else(forbidden_html)?;
    let clerk_user_id = jwks
        .validate_token(session)
        .await
        .ok_or_else(forbidden_html)?;

    let is_admin = SiteMembership::is_system_admin(&state.db, &clerk_user_id)
        .await
        .map_err(|_| {
            (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error").into_response()
        })?;

    if !is_admin {
        return Err(forbidden_html());
    }
    Ok(())
}

/// Compose the admin Swagger UI's CSP header — the same shape Rocket
/// emits, mirrored here so admin browsers don't get a content-policy
/// regression at cutover.
fn admin_csp(nonce: &str) -> String {
    format!(
        "default-src 'self'; \
         script-src 'self' 'nonce-{nonce}'; \
         style-src 'self' 'unsafe-inline'; \
         img-src 'self' data: https:; \
         connect-src 'self'"
    )
}

async fn admin_docs_index(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> axum::response::Response {
    if let Err(resp) = validate_admin_session(&headers, &state).await {
        return resp;
    }
    let (html, nonce) = admin_swagger_html();
    let csp = admin_csp(&nonce);
    (
        [
            (
                axum::http::header::CONTENT_TYPE,
                HeaderValue::from_static("text/html; charset=utf-8"),
            ),
            (
                CONTENT_SECURITY_POLICY,
                HeaderValue::from_str(&csp).unwrap_or(HeaderValue::from_static("")),
            ),
        ],
        html,
    )
        .into_response()
}

/// The full post-`split_for_parts` OpenAPI document is injected via an
/// `Extension` layer in `axum_app::build_router`. Calling
/// `AxumApiDoc::openapi()` directly would return only the bare derive
/// output (schemas + tags, no paths) and produce empty Swagger
/// accordions — the auto-collected paths from `routes!()` only exist
/// on the post-split spec.
async fn admin_openapi_json(
    State(state): State<AppState>,
    Extension(spec): Extension<Arc<utoipa::openapi::OpenApi>>,
    headers: HeaderMap,
) -> axum::response::Response {
    if let Err(resp) = validate_admin_session(&headers, &state).await {
        return resp;
    }
    let json = serde_json::to_string(&*spec).expect("OpenAPI spec serializes to JSON");
    (
        [(
            axum::http::header::CONTENT_TYPE,
            HeaderValue::from_static("application/json"),
        )],
        json,
    )
        .into_response()
}

/// `GET /api-docs` → `GET /api-docs/consumer/`. Matches Rocket's behavior
/// so existing bookmarks / navigation keep working — the admin SPA loads
/// the iframes by their explicit `/api-docs/consumer/` URL, but `/api-docs`
/// itself was the entry point in the navigation menu.
async fn docs_redirect() -> Redirect {
    Redirect::permanent("/api-docs/consumer/")
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api-docs", get(docs_redirect))
        // Both with-and-without trailing slash. The admin SPA's iframe
        // loads `/api-docs/admin/` (with slash); browser address-bar
        // navigation typically lands on `/api-docs/admin` (without).
        // Axum doesn't auto-canonicalize trailing slashes.
        .route("/api-docs/admin", get(admin_docs_index))
        .route("/api-docs/admin/", get(admin_docs_index))
        .route("/api-docs/admin/openapi.json", get(admin_openapi_json))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    fn minimal_state() -> AppState {
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

    fn test_app() -> Router {
        let dummy_spec = Arc::new(utoipa::openapi::OpenApi::default());
        router()
            .layer(Extension(dummy_spec))
            .with_state(minimal_state())
    }

    /// `/api-docs/admin/openapi.json` must reach `admin_openapi_json` and
    /// short-circuit to 403 when no session cookie is present. Locks in
    /// the routing + extractor wiring so a future refactor that drops
    /// the Extension layer or the trailing-slash route fails loudly
    /// (missing Extension would surface as a 500, not a 403).
    #[tokio::test]
    async fn admin_openapi_json_returns_403_without_session() {
        let resp = test_app()
            .oneshot(
                Request::builder()
                    .uri("/api-docs/admin/openapi.json")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn admin_html_returns_403_without_session_with_or_without_slash() {
        for path in ["/api-docs/admin", "/api-docs/admin/"] {
            let resp = test_app()
                .oneshot(Request::builder().uri(path).body(Body::empty()).unwrap())
                .await
                .unwrap();
            assert_eq!(resp.status(), StatusCode::FORBIDDEN, "path: {path}");
        }
    }

    // ── CSRF Origin validation ──────────────────────────────────

    #[tokio::test]
    async fn admin_rejects_cross_origin_request() {
        let resp = test_app()
            .oneshot(
                Request::builder()
                    .uri("/api-docs/admin/openapi.json")
                    .header("Origin", "https://evil.com")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn admin_rejects_cross_origin_referer() {
        let resp = test_app()
            .oneshot(
                Request::builder()
                    .uri("/api-docs/admin/openapi.json")
                    .header("Referer", "https://evil.com/page")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn admin_allows_same_origin_through_to_session_check() {
        // Same-origin requests pass the CSRF check and fall through to session
        // validation (which returns 403 because there's no cookie).
        let resp = test_app()
            .oneshot(
                Request::builder()
                    .uri("/api-docs/admin/openapi.json")
                    .header("Origin", "http://localhost:8000")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        // Returns 403 (no session), not 500 or some other error
        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    }
}
