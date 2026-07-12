//! Axum port of `crate::handlers::dashboard`. Serves the React admin SPA
//! out of `static/dashboard/` with per-request CSP nonce injection on
//! `index.html` and SPA fallback routing for client-side routes.
//!
//! The CSP template is built once at startup (with the resolved Clerk
//! domains baked in) and lives on `AppState.dashboard_csp_template`.
//! `{{CSP_NONCE}}` in the HTML and `{{NONCE}}` in the CSP header are
//! replaced per request with the same fresh nonce, so MUI/Emotion and
//! Clerk inline styles are authorized at runtime.
//!
//! The bundle returns a plain `Router<AppState>` (not `OpenApiRouter`)
//! because the dashboard surface is HTML — there's no JSON contract to
//! document via OpenAPI. The router is `.nest("/dashboard", ...)`-ed at
//! the top level so the inner paths stay relative to the SPA root.
//!
//! Static-file serving uses `tower_http::services::ServeDir` for asset
//! hits. SPA fallback to nonce-injected `index.html` is a custom Axum
//! handler so we can attach the per-request CSP header.

use std::path::Path;

use axum::Router;
use axum::extract::{Request, State};
use axum::http::header::{CACHE_CONTROL, CONTENT_SECURITY_POLICY, CONTENT_TYPE};
use axum::http::{HeaderName, HeaderValue, StatusCode};
use axum::response::IntoResponse;
use axum::routing::get;
use tower::ServiceExt;
use tower_http::services::ServeDir;

use crate::AppState;
use crate::utils::csp::generate_nonce;

const NO_CACHE: &str = "no-cache, no-store, must-revalidate";
const IMMUTABLE_CACHE: &str = "public, max-age=31536000, immutable";
const FALLBACK_CSP: &str = "default-src 'self'; style-src 'self' 'unsafe-inline'";

/// Fallback HTML when `static/dashboard/index.html` is missing — happens
/// in dev environments where the SPA hasn't been built yet.
fn dashboard_not_built_html() -> String {
    r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard Not Built</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #1a237e 0%, #0d47a1 50%, #01579b 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
            max-width: 600px;
        }
        h1 { font-size: 2rem; margin-bottom: 1rem; }
        p { opacity: 0.9; line-height: 1.6; }
        code {
            display: block;
            background: rgba(255,255,255,0.1);
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Dashboard Not Built</h1>
        <p>The dashboard has not been built yet. Run the following commands to build it:</p>
        <code>
            cd admin<br>
            npm install<br>
            npm run build
        </code>
        <p>The built files will be placed in <strong>backend/static/dashboard</strong></p>
    </div>
</body>
</html>"#
        .to_string()
}

/// Replace `{{CSP_NONCE}}` in the HTML and `{{NONCE}}` in the CSP template
/// with the same fresh nonce. Mirrors `serve_with_nonce` in the Rocket
/// bundle, but returns the bare strings so Axum can compose them into an
/// `IntoResponse` tuple at the call site.
fn inject_nonce(html: &str, csp_template: &str) -> (String, String) {
    let nonce = generate_nonce();
    let html = html.replace("{{CSP_NONCE}}", &nonce);
    let csp = csp_template.replace("{{NONCE}}", &nonce);
    (html, csp)
}

fn html_with_csp(html: String, csp: String) -> impl IntoResponse {
    (
        [
            (
                CONTENT_TYPE,
                HeaderValue::from_static("text/html; charset=utf-8"),
            ),
            (
                CONTENT_SECURITY_POLICY,
                HeaderValue::from_str(&csp).unwrap_or(HeaderValue::from_static("")),
            ),
            (CACHE_CONTROL, HeaderValue::from_static(NO_CACHE)),
        ],
        html,
    )
}

async fn render_index(state: &AppState) -> axum::response::Response {
    let path = Path::new("static/dashboard/index.html");
    if path.exists() {
        match std::fs::read_to_string(path) {
            Ok(html) => {
                let (html, csp) = inject_nonce(&html, &state.dashboard_csp_template);
                html_with_csp(html, csp).into_response()
            }
            Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        }
    } else {
        html_with_csp(dashboard_not_built_html(), FALLBACK_CSP.to_string()).into_response()
    }
}

/// `GET /dashboard` (and `GET /dashboard/`) — serve the SPA index with a
/// per-request nonce, or the build-missing fallback page.
async fn dashboard_index(State(state): State<AppState>) -> axum::response::Response {
    render_index(&state).await
}

/// SPA fallback: try the static file under `static/dashboard/`, otherwise
/// return the nonce-injected `index.html` so client-side routing can
/// take over. `ServeDir` handles MIME detection + ETag / Last-Modified;
/// Vite's content-hashed asset filenames make `immutable` cache safe for
/// hits.
async fn dashboard_fallback(
    State(state): State<AppState>,
    req: Request,
) -> axum::response::Response {
    let serve = ServeDir::new("static/dashboard");
    match serve.oneshot(req).await {
        Ok(resp) if resp.status() != StatusCode::NOT_FOUND => {
            let (mut parts, body) = resp.into_parts();
            parts.headers.insert(
                HeaderName::from_static("cache-control"),
                HeaderValue::from_static(IMMUTABLE_CACHE),
            );
            axum::response::Response::from_parts(parts, axum::body::Body::new(body)).into_response()
        }
        _ => render_index(&state).await,
    }
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(dashboard_index))
        .route("/{*path}", get(dashboard_fallback))
}
