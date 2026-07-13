//! Consumer/admin OpenAPI split. Mirrors the Rocket-era
//! `ConsumerApiDoc` / `AdminApiDoc` separation:
//!
//! - **Admin doc** = the full `AxumApiDoc` (everything the API can do).
//!   Served from `/api-docs/admin/openapi.json` behind a Clerk session.
//! - **Consumer doc** = a filtered view of the full doc that only
//!   exposes operations whose `operation_id` is in
//!   [`CONSUMER_OPERATION_IDS`]. Served from
//!   `/api-docs/consumer/openapi.json` (public).
//!
//! The filter walks `OpenApi.paths.paths` and clears every per-method
//! `Operation` whose `operation_id` is not in the allowlist. Paths that
//! end up with no surviving methods are dropped entirely. Schemas are
//! left untouched — the spec stays self-contained even if some schemas
//! are no longer reachable from the surviving paths.
//!
//! Maintenance: when a new public-facing endpoint is added, append its
//! `operation_id` to `CONSUMER_OPERATION_IDS`. Same discipline as the
//! pre-cutover Rocket file.

use utoipa::openapi::OpenApi;

/// Operation IDs of every endpoint that should appear in the consumer
/// (public) Swagger UI. Order doesn't matter; lookup is via `HashSet`.
const CONSUMER_OPERATION_IDS: &[&str] = &[
    // System
    "index",
    "health",
    // Blogs (public listing + RSS)
    "list_published_blogs",
    "list_published_blogs_by_category",
    "list_featured_blogs",
    "list_similar_blogs",
    "get_blog_by_slug",
    "rss_feed",
    // Pages (public read)
    "get_page_by_route",
    "get_page_sections",
    "get_section_localizations",
    "get_page_section_localizations",
    // CV
    "list_skills",
    "get_skill",
    "get_skill_by_slug",
    "list_cv_entries",
    "get_cv_entry",
    // Legal
    "list_legal_documents",
    "get_legal_document",
    "get_cookie_consent",
    "get_legal_document_by_slug",
    "get_legal_groups",
    "get_legal_items",
    // Media (read only)
    "list_media",
    "get_media",
    // Navigation
    "list_navigation",
    "list_menu_items",
    "get_navigation_item",
    "get_navigation_children",
    "get_navigation_item_localizations",
    // Navigation Menus
    "list_navigation_menus",
    "get_navigation_menu",
    "get_navigation_menu_by_slug",
    "get_navigation_tree",
    // Social Links
    "list_social_links",
    "get_social_link",
    // Taxonomy
    "list_tags",
    "get_tag",
    "get_tag_by_slug",
    "get_content_tags",
    "list_categories",
    "get_category",
    "get_category_children",
    "get_content_categories",
    "get_categories_with_blog_counts",
    // Sites (public info)
    "get_site_by_slug",
    "get_site_context",
    "get_public_site_settings",
    // Per-site public assets
    "get_sitemap",
    "get_robots_txt",
    "get_webmanifest",
    "get_browserconfig",
    // Environments + Locales
    "list_environments",
    "get_environment",
    "get_default_environment",
    "list_locales",
    "get_locale",
    "get_locale_by_code",
    // UI Strings (public locale-resolved read)
    "get_site_ui_strings",
    // Analytics ingest (write but public)
    "track_pageview",
    // Misc public
    "get_config",
    "lookup_redirect",
    "get_guest_token",
    "list_error_codes",
];

/// Build the consumer-facing OpenAPI doc by filtering operations from
/// the full admin/everything doc.
pub fn build_consumer_openapi(mut full: OpenApi) -> OpenApi {
    use std::collections::HashSet;

    let allowed: HashSet<&str> = CONSUMER_OPERATION_IDS.iter().copied().collect();

    full.info.title = "Forja Consumer API".to_string();
    full.info.description = Some(
        "Public read-only API for building frontends against a Forja-powered site. \
         Authenticate with an API key that has Read permission.\n\n\
         Naming conventions: all JSON response fields and query parameters use snake_case. \
         Enum values use PascalCase. The only exception is the RFC 7807 Problem Details `type` field."
            .to_string(),
    );

    let original = std::mem::take(&mut full.paths.paths);
    let mut kept = utoipa::openapi::path::PathsMap::new();

    for (path, mut item) in original {
        // Clear each method whose operation_id isn't in the allowlist.
        for op in [
            &mut item.get,
            &mut item.put,
            &mut item.post,
            &mut item.delete,
            &mut item.options,
            &mut item.head,
            &mut item.patch,
            &mut item.trace,
        ] {
            let drop = match op.as_ref() {
                Some(o) => !o
                    .operation_id
                    .as_deref()
                    .is_some_and(|id| allowed.contains(id)),
                None => false,
            };
            if drop {
                *op = None;
            }
        }

        // Only keep the path if at least one method survived.
        let any_op = item.get.is_some()
            || item.put.is_some()
            || item.post.is_some()
            || item.delete.is_some()
            || item.options.is_some()
            || item.head.is_some()
            || item.patch.is_some()
            || item.trace.is_some();
        if any_op {
            kept.insert(path, item);
        }
    }

    full.paths.paths = kept;
    full
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::axum_app::{AxumApiDoc, handlers};
    use utoipa::OpenApi as _; // bring the derive trait into scope for `.openapi()`
    use utoipa_axum::router::OpenApiRouter;

    fn full_spec() -> utoipa::openapi::OpenApi {
        let (_router, api) = OpenApiRouter::<crate::AppState>::with_openapi(AxumApiDoc::openapi())
            .merge(handlers::system::router())
            .merge(handlers::files::router())
            .nest("/api/v1", handlers::api_v1_router())
            .split_for_parts();
        api
    }

    #[test]
    fn consumer_doc_keeps_known_consumer_paths() {
        let consumer = build_consumer_openapi(full_spec());
        let json = serde_json::to_value(&consumer).expect("serializes");
        // A canonical consumer endpoint should be present.
        assert!(
            json["paths"]["/api/v1/sites/{slug}/sitemap.xml"].is_object(),
            "expected /sites/{{slug}}/sitemap.xml in consumer spec"
        );
    }

    #[test]
    fn consumer_doc_strips_admin_paths() {
        let consumer = build_consumer_openapi(full_spec());
        let json = serde_json::to_value(&consumer).expect("serializes");
        // Webhook CRUD is admin-only — must not appear in consumer doc.
        for admin_only in [
            "/api/v1/sites/{site_id}/webhooks",
            "/api/v1/api-keys",
            "/api/v1/sites/{site_id}/audit",
        ] {
            assert!(
                json["paths"][admin_only].is_null(),
                "{admin_only} leaked into consumer spec"
            );
        }
    }

    #[test]
    fn consumer_doc_strips_admin_methods_on_shared_paths() {
        // /api/v1/blogs (POST) is admin (create); but the path doesn't
        // collide with a consumer GET. Use a path that has both shapes:
        // /api/v1/sites/{site_id}/social has GET (consumer) + POST (admin).
        let consumer = build_consumer_openapi(full_spec());
        let json = serde_json::to_value(&consumer).expect("serializes");
        let path = &json["paths"]["/api/v1/sites/{site_id}/social"];
        // Consumer GET stays, admin POST goes.
        if path.is_object() {
            assert!(path["get"].is_object(), "consumer GET should survive");
            assert!(path["post"].is_null(), "admin POST should be filtered out");
        }
    }

    #[test]
    fn consumer_doc_overrides_title() {
        let consumer = build_consumer_openapi(full_spec());
        assert_eq!(consumer.info.title, "Forja Consumer API");
    }
}
