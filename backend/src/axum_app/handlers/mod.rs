//! Axum-side handler bundles, ported one resource at a time from
//! `crate::handlers::*` (Rocket). Each submodule exposes a `router()`
//! returning an `OpenApiRouter<AppState>` that the top-level
//! `axum_app::build_router` merges (or nests) into the root tree. The
//! bundle name mirrors the Rocket module name to make the migration
//! grep-friendly.
//!
//! ## Mount layout
//!
//! - `system` is mounted at `/` to mirror the Rocket
//!   `mount("/", handlers::system::routes())` call.
//! - Everything else is mounted under `/api/v1` (Rocket equivalent:
//!   `mount("/api/v1", handlers::routes())`). New bundles for that
//!   prefix get added to `api_v1_router()` below.

use utoipa_axum::router::OpenApiRouter;

use crate::AppState;

pub mod ai;
pub mod ai_usage;
pub mod analytics;
pub mod api_key;
pub mod audit;
pub mod auth;
pub mod blog;
pub mod cache_admin;
pub mod clerk_user;
pub mod config;
pub mod content_template;
pub mod custom_entry;
pub mod custom_public;
pub mod custom_type;
pub mod cv;
pub mod dashboard;
pub mod docs;
pub mod document;
pub mod environment;
pub mod error_codes;
pub mod favicon;
pub mod files;
pub mod forms;
pub mod imprint;
pub mod legal;
pub mod locale;
pub mod media;
pub mod media_folder;
pub mod media_tag;
pub mod navigation;
pub mod navigation_menu;
pub mod notification;
pub mod onboarding_progress;
pub mod page;
pub mod project;
pub mod redirect;
pub mod robots;
pub mod site;
pub mod site_locale;
pub mod site_membership;
pub mod site_settings;
pub mod sitemap;
pub mod social;
pub mod system;
pub mod taxonomy;
pub mod trash;
pub mod ui_strings;
pub mod webhook;

/// Aggregate router for everything mounted under `/api/v1`. Each newly
/// ported resource bundle is one extra `.merge(...)` line. The outer
/// `build_router` calls `.nest("/api/v1", api_v1_router())` so the
/// `/api/v1` prefix shows up exactly once in the build pipeline (and,
/// thanks to `utoipa-axum`, exactly once in the OpenAPI document).
pub fn api_v1_router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .merge(error_codes::router())
        .merge(environment::router())
        .merge(config::router())
        .merge(imprint::router())
        .merge(robots::router())
        .merge(sitemap::router())
        .merge(locale::router())
        .merge(media_folder::router())
        .merge(media_tag::router())
        .merge(onboarding_progress::router())
        .merge(social::router())
        .merge(site_locale::router())
        .merge(redirect::router())
        .merge(notification::router())
        .merge(audit::router())
        .merge(analytics::router())
        .merge(content_template::router())
        .merge(custom_type::router())
        .merge(custom_entry::router())
        .merge(custom_public::router())
        .merge(forms::router())
        .merge(webhook::router())
        .merge(navigation_menu::router())
        .merge(navigation::router())
        .merge(ui_strings::router())
        .merge(taxonomy::router())
        .merge(clerk_user::router())
        .merge(site::router())
        .merge(site_settings::router())
        .merge(site_membership::router())
        .merge(cv::router())
        .merge(project::router())
        .merge(ai::router())
        .merge(ai_usage::router())
        .merge(trash::router())
        .merge(api_key::router())
        .merge(cache_admin::router())
        .merge(legal::router())
        .merge(page::router())
        .merge(blog::router())
        .merge(auth::router())
        .merge(document::router())
        .merge(favicon::router())
        .merge(media::router())
}
