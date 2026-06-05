//! Tower middleware layers for the Axum app, ported from
//! `crate::middleware::*` (Rocket fairings). Each submodule is a single
//! layer that targets one concern. Composition order is set by
//! `axum_app::build_router`; outer layers see requests first / responses
//! last, so the final layer chain reads bottom-up at the construction
//! site.

pub mod auth_rate_limit;
pub mod cors;
pub mod not_found;
pub mod public_rate_limit;
pub mod rate_limit_headers;
pub mod security_headers;
pub mod usage_tracking;
