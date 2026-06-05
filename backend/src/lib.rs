//! Forja Multi-Site CMS API Library
//!
//! This crate provides the core functionality for the Forja multi-site CMS API.

use sqlx::PgPool;
use std::sync::Arc;

pub mod axum_app;
pub mod config;
pub mod dto;
pub mod errors;
pub mod guards;
pub mod middleware;
pub mod models;
pub mod repos;
pub mod services;
pub mod utils;

pub use config::{SecurityConfig, Settings};
pub use errors::ApiError;

/// Application state shared across all routes
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub settings: Settings,
    /// Redis connection manager for rate limiting (None if Redis is unavailable)
    pub redis: Option<redis::aio::ConnectionManager>,
    /// Clerk service for user management (None if Clerk is not configured)
    pub clerk_service: Option<Arc<services::clerk_service::ClerkService>>,
    /// Storage backend for media file uploads
    pub storage: Arc<dyn services::storage::StorageBackend>,
    /// Cached Clerk JWKS state for JWT validation (None if Clerk is not configured).
    /// Both Rocket and Axum auth guards read from here so there is a single source
    /// of truth across frameworks during the migration.
    pub clerk_jwks: Option<Arc<guards::auth_guard::ClerkJwksState>>,
    /// CSP header template for dashboard responses, with `{{NONCE}}` placeholder
    /// replaced per request. Built at startup with the resolved Clerk domains so
    /// MUI/Emotion and Clerk inline styles can be authorized via per-request nonce.
    pub dashboard_csp_template: Arc<str>,
    /// Randomly-generated demo guest API key (set at boot when DEMO_MODE=true,
    /// empty otherwise). The key is generated once per process lifetime — a
    /// server restart produces a fresh key.
    pub demo_guest_key: std::sync::OnceLock<String>,
}
