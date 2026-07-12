//! Per-site CORS middleware.
//!
//! Routes fall into three categories:
//! 1. **Public** — health, .well-known, nodeinfo → allow any origin
//! 2. **Admin** — dashboard, auth, everything not under /sites/ → global allowlist
//! 3. **Site-scoped** — /sites/<uuid>/… → per-site `allowed_origins` from DB

use sqlx::PgPool;
use uuid::Uuid;

use crate::axum_app::API_MOUNT_PREFIX;
use crate::models::site_settings::{KEY_ALLOWED_ORIGINS, SiteSetting};

/// Path prefixes that are public and allow any origin.
const PUBLIC_PREFIXES: &[&str] = &["/health", "/.well-known/", "/nodeinfo/"];

/// Categorises a request path into one of three CORS buckets.
#[derive(Debug, Clone, PartialEq)]
pub enum CorsCategory {
    /// Public endpoints — any origin allowed
    Public,
    /// Admin / dashboard — checked against global `CORS_ALLOWED_ORIGINS`
    Admin,
    /// Site-scoped API — checked against the site's `allowed_origins` setting
    Site(Uuid),
}

/// Determine the CORS category for a given request path.
///
/// Strips the `API_MOUNT_PREFIX` first so paths arriving via the router nest
/// (e.g. `/api/v1/sites/<uuid>/...`) categorise the same as their un-prefixed
/// form. Without this, every `/api/v1/sites/...` request fell through to
/// `Admin` and the per-site `allowed_origins` setting was never consulted.
pub fn categorise_path(path: &str) -> CorsCategory {
    let stripped = path.strip_prefix(API_MOUNT_PREFIX).unwrap_or(path);

    for prefix in PUBLIC_PREFIXES {
        if stripped.starts_with(prefix) || stripped == "/health" {
            return CorsCategory::Public;
        }
    }

    if let Some(rest) = stripped.strip_prefix("/sites/") {
        let uuid_str = rest.split('/').next().unwrap_or("");
        if let Ok(site_id) = Uuid::parse_str(uuid_str) {
            return CorsCategory::Site(site_id);
        }
    }

    CorsCategory::Admin
}

/// Check if an origin is in a list of allowed origins.
fn origin_in_list(origin: &str, list: &[String]) -> bool {
    list.iter().any(|o| o == origin)
}

/// Resolve the allowed origin header value for a non-DB category.
///
/// Returns `Some(origin_value)` for public/admin, or `None` if blocked.
/// For `CorsCategory::Site`, returns `None` — caller must handle DB lookup.
pub fn resolve_origin_no_db(
    origin: &str,
    category: &CorsCategory,
    global_origins: &[String],
) -> Option<String> {
    match category {
        CorsCategory::Public => Some(origin.to_string()),
        CorsCategory::Admin => {
            if origin_in_list(origin, global_origins) {
                Some(origin.to_string())
            } else {
                None
            }
        }
        CorsCategory::Site(_) => {
            // Check global origins first (admin user accessing a site endpoint)
            if origin_in_list(origin, global_origins) {
                Some(origin.to_string())
            } else {
                None // Caller must check per-site origins via DB
            }
        }
    }
}

/// Resolve the allowed origin header value for a request.
///
/// Returns `Some(origin_value)` to set as `Access-Control-Allow-Origin`,
/// or `None` to omit the header entirely (blocking cross-origin access).
pub async fn resolve_allowed_origin(
    request_origin: Option<&str>,
    path: &str,
    global_origins: &[String],
    pool: &PgPool,
) -> Option<String> {
    // Dev mode: wildcard overrides everything
    if global_origins.len() == 1 && global_origins[0] == "*" {
        return Some("*".to_string());
    }

    // No Origin header → same-origin or non-browser request, skip CORS
    let origin = request_origin?;

    let category = categorise_path(path);

    // Try non-DB resolution first
    if let Some(result) = resolve_origin_no_db(origin, &category, global_origins) {
        return Some(result);
    }

    // For site-scoped paths, query per-site allowed origins from DB
    if let CorsCategory::Site(site_id) = category {
        match SiteSetting::get_value(pool, site_id, KEY_ALLOWED_ORIGINS).await {
            Ok(value) => {
                let origins: Vec<String> = serde_json::from_value(value).unwrap_or_default();
                if origin_in_list(origin, &origins) {
                    return Some(origin.to_string());
                }
            }
            Err(e) => {
                tracing::warn!(
                    site_id = %site_id,
                    error = %e,
                    "Failed to fetch allowed_origins for site, blocking cross-origin request"
                );
            }
        }
    }

    None
}

/// Whether to add `Vary: Origin` (required when origin is dynamic, not `*`).
pub fn needs_vary_header(origin_value: &str) -> bool {
    origin_value != "*"
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- categorise_path ---

    #[test]
    fn test_categorise_public_paths() {
        assert_eq!(categorise_path("/health"), CorsCategory::Public);
        assert_eq!(
            categorise_path("/.well-known/webfinger"),
            CorsCategory::Public
        );
        assert_eq!(categorise_path("/nodeinfo/2.0"), CorsCategory::Public);
    }

    #[test]
    fn test_categorise_admin_paths() {
        assert_eq!(categorise_path("/dashboard/"), CorsCategory::Admin);
        assert_eq!(categorise_path("/admin/storage"), CorsCategory::Admin);
        assert_eq!(categorise_path("/api-docs"), CorsCategory::Admin);
        assert_eq!(categorise_path("/auth/callback"), CorsCategory::Admin);
    }

    #[test]
    fn test_categorise_site_paths() {
        let uuid = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
        assert_eq!(
            categorise_path("/sites/550e8400-e29b-41d4-a716-446655440000/settings"),
            CorsCategory::Site(uuid)
        );
        assert_eq!(
            categorise_path("/sites/550e8400-e29b-41d4-a716-446655440000/posts"),
            CorsCategory::Site(uuid)
        );
        assert_eq!(
            categorise_path("/sites/550e8400-e29b-41d4-a716-446655440000"),
            CorsCategory::Site(uuid)
        );
    }

    #[test]
    fn test_categorise_invalid_uuid_falls_to_admin() {
        assert_eq!(
            categorise_path("/sites/not-a-uuid/posts"),
            CorsCategory::Admin
        );
    }

    // --- categorise_path with /api/v1 mount prefix (real production paths) ---

    #[test]
    fn test_categorise_site_path_with_api_prefix() {
        let uuid = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
        assert_eq!(
            categorise_path("/api/v1/sites/550e8400-e29b-41d4-a716-446655440000/posts"),
            CorsCategory::Site(uuid)
        );
    }

    #[test]
    fn test_categorise_bare_site_path_with_api_prefix() {
        let uuid = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
        assert_eq!(
            categorise_path("/api/v1/sites/550e8400-e29b-41d4-a716-446655440000"),
            CorsCategory::Site(uuid)
        );
    }

    #[test]
    fn test_categorise_invalid_uuid_with_api_prefix_falls_to_admin() {
        assert_eq!(
            categorise_path("/api/v1/sites/not-a-uuid/posts"),
            CorsCategory::Admin
        );
    }

    #[test]
    fn test_categorise_health_with_api_prefix() {
        assert_eq!(categorise_path("/api/v1/health"), CorsCategory::Public);
    }

    #[test]
    fn test_categorise_well_known_with_api_prefix() {
        assert_eq!(
            categorise_path("/api/v1/.well-known/webfinger"),
            CorsCategory::Public
        );
    }

    #[test]
    fn test_categorise_admin_path_with_api_prefix_stays_admin() {
        assert_eq!(categorise_path("/api/v1/dashboard/"), CorsCategory::Admin);
    }

    // --- resolve_origin_no_db ---

    #[test]
    fn test_public_reflects_any_origin() {
        let result = resolve_origin_no_db(
            "https://anything.com",
            &CorsCategory::Public,
            &["https://admin.example.com".to_string()],
        );
        assert_eq!(result, Some("https://anything.com".to_string()));
    }

    #[test]
    fn test_admin_allowed_origin() {
        let global = vec![
            "https://admin.example.com".to_string(),
            "http://localhost:3000".to_string(),
        ];
        let result =
            resolve_origin_no_db("https://admin.example.com", &CorsCategory::Admin, &global);
        assert_eq!(result, Some("https://admin.example.com".to_string()));
    }

    #[test]
    fn test_admin_blocked_origin() {
        let global = vec!["https://admin.example.com".to_string()];
        let result = resolve_origin_no_db("https://evil.com", &CorsCategory::Admin, &global);
        assert_eq!(result, None);
    }

    #[test]
    fn test_site_global_origin_passes() {
        let uuid = Uuid::new_v4();
        let global = vec!["https://admin.example.com".to_string()];
        let result = resolve_origin_no_db(
            "https://admin.example.com",
            &CorsCategory::Site(uuid),
            &global,
        );
        assert_eq!(result, Some("https://admin.example.com".to_string()));
    }

    #[test]
    fn test_site_unknown_origin_returns_none() {
        let uuid = Uuid::new_v4();
        let global = vec!["https://admin.example.com".to_string()];
        let result = resolve_origin_no_db("https://myblog.com", &CorsCategory::Site(uuid), &global);
        // None means "caller must check per-site DB"
        assert_eq!(result, None);
    }

    // --- needs_vary_header ---

    #[test]
    fn test_needs_vary_header() {
        assert!(needs_vary_header("https://example.com"));
        assert!(!needs_vary_header("*"));
    }
}
