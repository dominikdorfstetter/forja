//! Public-path classification for the unauthenticated rate-limit
//! middleware. The Axum side (`axum_app::middleware::public_rate_limit`)
//! reads `is_public_path` to decide whether to apply IP-based limits.

/// Classify a request path as public (rate-limited via the IP layer)
/// or authenticated (rate-limited via the auth extractor's per-key
/// counters). Single source of truth — add new public paths here.
///
/// Parametric public routes (those with `{site_id}` / `{slug}` segments)
/// are matched via `is_public_parametric_path` so the allowlist stays
/// precise — adjacent auth-gated routes under the same parent (e.g.
/// `/api/v1/sites/{id}/preview-token`) are NOT swept in. See #687.
pub fn is_public_path(path: &str) -> bool {
    const PUBLIC_PREFIXES: &[&str] = &[
        "/health",
        "/files/",
        "/.well-known/",
        "/nodeinfo/",
        "/api/v1/config",
        // Public form rendering + submission (Forms module #582/#584).
        // Unauthenticated; IP-rate-limited to deter brute-force lookups
        // and enumeration of reference codes.
        "/api/v1/public/",
        // Consumer-facing OpenAPI/Swagger UI. Unauthenticated docs surface.
        "/api-docs/",
    ];
    const PUBLIC_EXACT: &[&str] = &[
        "/sitemap.xml",
        "/robots.txt",
        "/api-docs",
        // Static doc-lookup endpoint for client SDKs (#687).
        "/api/v1/error-codes",
    ];

    if PUBLIC_EXACT.contains(&path) || PUBLIC_PREFIXES.iter().any(|&p| path.starts_with(p)) {
        return true;
    }
    is_public_parametric_path(path)
}

/// Match the set of unauthenticated routes that have parametric segments,
/// without sweeping in their authenticated siblings.
fn is_public_parametric_path(path: &str) -> bool {
    let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    matches!(
        segments.as_slice(),
        // Public site lookup + bootstrap context
        ["api", "v1", "sites", "by-slug", _]
            | ["api", "v1", "sites", _, "context"]
            // Per-site web assets / manifests / robots / sitemap / feed
            | ["api", "v1", "sites", _, "feed.rss"]
            | ["api", "v1", "sites", _, "site.webmanifest"]
            | ["api", "v1", "sites", _, "browserconfig.xml"]
            | ["api", "v1", "sites", _, "robots.txt"]
            | ["api", "v1", "sites", _, "sitemap.xml"]
            | ["api", "v1", "sites", _, "favicon", "download"]
            // Public blog reads (NOT bulk/seed/samples/status-counts)
            | ["api", "v1", "sites", _, "blogs", "published"]
            | ["api", "v1", "sites", _, "blogs", "published", "category", _]
            | ["api", "v1", "sites", _, "blogs", "featured"]
            | ["api", "v1", "sites", _, "blogs", "by-slug", _]
            | ["api", "v1", "sites", _, "blogs", _, "similar"]
            // Public document access (verify-access is also covered by
            // a stricter per-document limiter in the sibling issue #685)
            | ["api", "v1", "documents", _, "download"]
            | ["api", "v1", "documents", _, "verify-access"]
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_health_as_public() {
        assert!(is_public_path("/health"));
    }

    #[test]
    fn classifies_files_as_public() {
        assert!(is_public_path("/files/media/2026/photo.png"));
        assert!(is_public_path("/files/"));
    }

    #[test]
    fn classifies_sitemap_and_robots_as_public() {
        assert!(is_public_path("/sitemap.xml"));
        assert!(is_public_path("/robots.txt"));
    }

    #[test]
    fn classifies_well_known_as_public() {
        assert!(is_public_path("/.well-known/webfinger"));
        assert!(is_public_path("/.well-known/"));
    }

    #[test]
    fn classifies_public_config_endpoint() {
        assert!(is_public_path("/api/v1/config"));
    }

    #[test]
    fn does_not_classify_auth_gated_routes_as_public() {
        // Top-level listings and the dashboard SPA remain authenticated.
        assert!(!is_public_path("/api/v1/sites"));
        assert!(!is_public_path("/api/v1/blogs"));
        assert!(!is_public_path("/dashboard/"));
        // Sibling routes under /api/v1/sites/{id}/ that are NOT public —
        // precision check from #687: the parametric matcher must not sweep
        // these into the public limiter.
        assert!(!is_public_path(
            "/api/v1/sites/00000000-0000-0000-0000-000000000000"
        ));
        assert!(!is_public_path(
            "/api/v1/sites/00000000-0000-0000-0000-000000000000/preview-token"
        ));
        assert!(!is_public_path(
            "/api/v1/sites/00000000-0000-0000-0000-000000000000/settings"
        ));
        assert!(!is_public_path(
            "/api/v1/sites/00000000-0000-0000-0000-000000000000/audit"
        ));
        assert!(!is_public_path(
            "/api/v1/sites/00000000-0000-0000-0000-000000000000/webhooks"
        ));
        assert!(!is_public_path(
            "/api/v1/sites/00000000-0000-0000-0000-000000000000/blogs/bulk"
        ));
        assert!(!is_public_path(
            "/api/v1/sites/00000000-0000-0000-0000-000000000000/blogs/seed"
        ));
        assert!(!is_public_path(
            "/api/v1/sites/00000000-0000-0000-0000-000000000000/blogs/status-counts"
        ));
        // /api/v1/documents/{id} CRUD remains authenticated; only the
        // download and verify-access sub-routes are public.
        assert!(!is_public_path("/api/v1/documents/abc-123"));
        assert!(!is_public_path("/api/v1/documents/abc-123/privacy"));
        assert!(!is_public_path("/api/v1/documents/abc-123/localizations"));
    }

    #[test]
    fn classifies_site_lookup_by_slug_as_public() {
        assert!(is_public_path("/api/v1/sites/by-slug/example-site"));
    }

    #[test]
    fn classifies_site_context_as_public() {
        assert!(is_public_path(
            "/api/v1/sites/00000000-0000-0000-0000-000000000000/context"
        ));
    }

    #[test]
    fn classifies_per_site_assets_as_public() {
        assert!(is_public_path("/api/v1/sites/my-site/site.webmanifest"));
        assert!(is_public_path("/api/v1/sites/my-site/browserconfig.xml"));
        assert!(is_public_path("/api/v1/sites/my-site/robots.txt"));
        assert!(is_public_path("/api/v1/sites/my-site/sitemap.xml"));
        assert!(is_public_path(
            "/api/v1/sites/00000000-0000-0000-0000-000000000000/feed.rss"
        ));
        assert!(is_public_path(
            "/api/v1/sites/00000000-0000-0000-0000-000000000000/favicon/download"
        ));
    }

    #[test]
    fn classifies_public_blog_reads_as_public() {
        let site = "/api/v1/sites/00000000-0000-0000-0000-000000000000";
        assert!(is_public_path(&format!("{site}/blogs/featured")));
        assert!(is_public_path(&format!(
            "{site}/blogs/published/category/news"
        )));
        assert!(is_public_path(&format!("{site}/blogs/by-slug/hello-world")));
        assert!(is_public_path(&format!("{site}/blogs/abc-123/similar")));
    }

    #[test]
    fn classifies_public_document_routes_as_public() {
        // Both routes are anonymous; #685 adds a stricter per-document
        // limiter on top of the IP-based one for verify-access.
        assert!(is_public_path("/api/v1/documents/abc-123/download"));
        assert!(is_public_path("/api/v1/documents/abc-123/verify-access"));
    }

    #[test]
    fn classifies_error_codes_lookup_as_public() {
        assert!(is_public_path("/api/v1/error-codes"));
    }

    #[test]
    fn classifies_consumer_api_docs_as_public() {
        assert!(is_public_path("/api-docs"));
        assert!(is_public_path("/api-docs/consumer"));
        assert!(is_public_path("/api-docs/consumer/"));
        assert!(is_public_path("/api-docs/consumer/openapi.json"));
    }

    #[test]
    fn classifies_site_blogs_published_as_public() {
        // Tracer bullet for issue #687: this is the route used in the PoC.
        // Before the fix it slipped through the allowlist with no rate limit.
        assert!(is_public_path(
            "/api/v1/sites/00000000-0000-0000-0000-000000000000/blogs/published"
        ));
    }

    #[test]
    fn does_not_match_documents_without_trailing_slash() {
        // Boundary guard from #685: the parametric matcher requires the
        // segment to be exactly "documents", so sibling paths like
        // `/api/v1/documentsX` cannot accidentally slip through.
        assert!(!is_public_path("/api/v1/documentsX"));
    }

    #[test]
    fn does_not_misclassify_similar_but_distinct_paths() {
        // /healthy should NOT match /health (prefix is too permissive — test
        // guards the future if anyone adds a longer endpoint).
        // Currently we use starts_with("/health") which WOULD match "/healthy",
        // so this test documents the intended behavior: if a real handler
        // exists at /healthy we'd need to tighten this to an exact match.
        // For now, there is no such handler and we prefer permissive matching.
        assert!(is_public_path("/healthy"));
        // Note: /files-private would be caught as NOT public since the prefix
        // requires the trailing slash.
        assert!(!is_public_path("/files-private"));
    }
}
