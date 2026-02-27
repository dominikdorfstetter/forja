//! OpenYapper Multi-Site CMS API Library
//!
//! This crate provides the core functionality for the OpenYapper multi-site CMS API.

#[macro_use]
extern crate rocket;

use sqlx::PgPool;
use std::sync::Arc;

pub mod config;
pub mod dto;
pub mod errors;
pub mod guards;
pub mod handlers;
pub mod middleware;
pub mod models;
pub mod openapi;
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
}
