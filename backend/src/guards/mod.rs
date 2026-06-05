//! Auth + module guards (shared across the binary). The Axum-side
//! extractors live in `axum_app::extractors`; this module owns the
//! types they wrap (`AuthenticatedKey`, `ClerkJwksState`, `ModuleGuard`,
//! marker traits).

pub mod actor;
pub mod auth_guard;
pub mod module_guard;
