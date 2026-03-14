//! Federation (ActivityPub) handlers
//!
//! Protocol endpoints (WebFinger, actor, inbox) are mounted at root `/`.
//! Admin endpoints (settings, followers, activities, blocks) are mounted
//! under `/api/v1`.

pub mod actor;
pub mod admin_activities;
pub mod admin_blocks;
pub mod admin_followers;
pub mod admin_settings;
pub mod inbox;
pub mod webfinger;

use rocket::Route;

/// Collect all federation protocol routes (mounted at `/`).
pub fn protocol_routes() -> Vec<Route> {
    let mut routes = Vec::new();
    routes.extend(webfinger::routes());
    routes.extend(actor::routes());
    routes.extend(inbox::routes());
    routes
}

/// Collect all federation admin API routes (mounted at `/api/v1`).
pub fn admin_routes() -> Vec<Route> {
    let mut routes = Vec::new();
    routes.extend(admin_settings::routes());
    routes.extend(admin_followers::routes());
    routes.extend(admin_activities::routes());
    routes.extend(admin_blocks::routes());
    routes
}
