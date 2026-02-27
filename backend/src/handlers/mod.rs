//! Request handlers (controllers)
//!
//! This module contains all the route handlers organized by domain.

// API key management
pub mod api_key;

// Authentication
pub mod auth;

// Clerk user management
pub mod clerk_user;

// Public configuration
pub mod config;

// Dashboard
pub mod dashboard;

// System (health, index)
pub mod system;

// Domain handlers
pub mod audit;
pub mod blog;
pub mod content_template;
pub mod cv;
pub mod document;
pub mod environment;
pub mod legal;
pub mod locale;
pub mod media;
pub mod media_folder;
pub mod navigation;
pub mod navigation_menu;
pub mod notification;
pub mod page;
pub mod redirect;
pub mod site;
pub mod site_locale;
pub mod site_membership;
pub mod site_settings;
pub mod social;
pub mod taxonomy;
pub mod webhook;

use rocket::Route;

/// Collect all API routes
pub fn routes() -> Vec<Route> {
    let mut routes = Vec::new();

    // Authentication
    routes.extend(auth::routes());

    // API key management (requires master key)
    routes.extend(api_key::routes());

    // Site management
    routes.extend(site::routes());
    routes.extend(site_settings::routes());

    // Infrastructure
    routes.extend(environment::routes());
    routes.extend(locale::routes());

    // Media
    routes.extend(media::routes());
    routes.extend(media_folder::routes());

    // Content
    routes.extend(blog::routes());
    routes.extend(document::routes());
    routes.extend(page::routes());
    routes.extend(cv::routes());
    routes.extend(legal::routes());

    // Navigation & Social
    routes.extend(navigation::routes());
    routes.extend(navigation_menu::routes());
    routes.extend(social::routes());

    // Taxonomy
    routes.extend(taxonomy::routes());

    // Webhooks
    routes.extend(webhook::routes());

    // Redirects
    routes.extend(redirect::routes());

    // Content Templates
    routes.extend(content_template::routes());

    // Notifications
    routes.extend(notification::routes());

    // Audit
    routes.extend(audit::routes());

    // Clerk user management
    routes.extend(clerk_user::routes());

    // Site locale management
    routes.extend(site_locale::routes());

    // Site membership management
    routes.extend(site_membership::routes());

    // Public configuration (no auth)
    routes.extend(config::routes());

    routes
}
