//! Data-access repositories
//!
//! Sibling to `models/`. Phase 1 introduces `ContentQuery`, the shared
//! JOIN/pagination builder for content entities (blog/page/legal/document/
//! cv/project). Phase 2 will move per-entity SQL out of `models/` into
//! `{entity}_repo.rs` files here.

pub mod blog_repo;
pub mod content_query;
pub mod cv_repo;
pub mod document_repo;
pub mod form_submission_repo;
pub mod legal_repo;
pub mod page_repo;
pub mod project_repo;
pub mod trash_repo;
pub mod ui_string_repo;
pub mod user_data_repo;

/// Liveness probe for the health endpoint — round-trips one query.
pub async fn ping(pool: &sqlx::PgPool) -> Result<(), sqlx::Error> {
    sqlx::query("SELECT 1").fetch_one(pool).await.map(|_| ())
}
