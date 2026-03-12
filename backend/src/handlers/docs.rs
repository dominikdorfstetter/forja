//! API documentation handlers
//!
//! Serves the admin Swagger UI behind Clerk session auth and
//! redirects the base `/api-docs/` path to the consumer docs.

use rocket::http::{ContentType, CookieJar, Status};
use rocket::response::content::RawHtml;
use rocket::response::Redirect;
use rocket::{Route, State};
use utoipa::OpenApi;

use crate::guards::auth_guard::ClerkJwksState;
use crate::models::site_membership::SiteMembership;
use crate::openapi::AdminApiDoc;
use crate::AppState;

/// Swagger UI HTML that reuses assets from the consumer mount
const ADMIN_SWAGGER_HTML: &str = r#"<!DOCTYPE html>
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
    <script>
        SwaggerUIBundle({
            url: '/api-docs/admin/openapi.json',
            dom_id: '#swagger-ui',
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIBundle.SwaggerUIStandalonePreset
            ],
            layout: 'BaseLayout'
        });
    </script>
</body>
</html>"#;

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

/// Validate the Clerk session cookie and check system admin status.
/// Returns Ok(()) if the caller is an authenticated system admin.
async fn validate_admin_session(
    cookies: &CookieJar<'_>,
    jwks: &ClerkJwksState,
    state: &AppState,
) -> Result<(), (Status, RawHtml<&'static str>)> {
    let session_cookie = cookies
        .get("__session")
        .ok_or((Status::Forbidden, RawHtml(FORBIDDEN_HTML)))?;

    let clerk_user_id = jwks
        .validate_token(session_cookie.value())
        .await
        .ok_or((Status::Forbidden, RawHtml(FORBIDDEN_HTML)))?;

    let is_admin = SiteMembership::is_system_admin(&state.db, &clerk_user_id)
        .await
        .map_err(|_| {
            (
                Status::InternalServerError,
                RawHtml("Internal server error"),
            )
        })?;

    if !is_admin {
        return Err((Status::Forbidden, RawHtml(FORBIDDEN_HTML)));
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Admin docs routes (session-protected)
// ---------------------------------------------------------------------------

#[get("/api-docs/admin")]
async fn admin_docs_index(
    cookies: &CookieJar<'_>,
    jwks: &State<ClerkJwksState>,
    state: &State<AppState>,
) -> Result<RawHtml<&'static str>, (Status, RawHtml<&'static str>)> {
    validate_admin_session(cookies, jwks.inner(), state.inner()).await?;
    Ok(RawHtml(ADMIN_SWAGGER_HTML))
}

#[get("/api-docs/admin/openapi.json")]
async fn admin_openapi_json(
    cookies: &CookieJar<'_>,
    jwks: &State<ClerkJwksState>,
    state: &State<AppState>,
) -> Result<(ContentType, String), (Status, RawHtml<&'static str>)> {
    validate_admin_session(cookies, jwks.inner(), state.inner()).await?;
    let spec = AdminApiDoc::openapi();
    let json = serde_json::to_string(&spec).expect("OpenAPI spec serializes to JSON");
    Ok((ContentType::JSON, json))
}

// ---------------------------------------------------------------------------
// Redirect: /api-docs/ → /api-docs/consumer/
// ---------------------------------------------------------------------------

#[get("/api-docs")]
fn docs_redirect() -> Redirect {
    Redirect::permanent("/api-docs/consumer/")
}

/// Collect all documentation routes
pub fn routes() -> Vec<Route> {
    routes![admin_docs_index, admin_openapi_json, docs_redirect]
}
