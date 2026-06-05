//! Site content reset (issue #714, epic #708).
//!
//! Bulk soft-deletes every site-scoped content item and site-owned media
//! file into the **existing trash** by stamping `is_deleted = TRUE,
//! deleted_at = NOW()`. The site row, its settings, and its memberships
//! are deliberately left intact.
//!
//! This is the structural inverse of [`super::trash_cleanup`]: that
//! worker `DELETE`s expired trash globally; this stamps rows *into* the
//! trash for one site. Because the table set and the
//! `is_deleted/deleted_at` columns are identical, the shared 30-day
//! `TrashCleanupWorker` already reclaims everything — no new purge path.
//!
//! Every statement filters `is_deleted = FALSE`, so a second reset (or
//! an already-empty site) affects zero rows and returns zero counts
//! without erroring — the operation is idempotent by construction.

use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::site::ResetContentResponse;
use crate::errors::ApiError;

/// Soft-delete all site-scoped content + site-owned media for `site_id`
/// in a single transaction, returning per-category counts.
pub async fn reset_site_content(
    pool: &PgPool,
    site_id: Uuid,
) -> Result<ResetContentResponse, ApiError> {
    let mut tx = pool.begin().await?;

    // contents — site-scoped via the content_sites junction. Covers
    // blogs/pages/CV/project, each of which references a content row.
    let contents = sqlx::query(
        "UPDATE contents SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW() \
         WHERE is_deleted = FALSE \
           AND id IN (SELECT content_id FROM content_sites WHERE site_id = $1)",
    )
    .bind(site_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    // legal_documents — keyed off the same content_sites linkage as
    // contents (legal_documents.content_id -> contents.id).
    let legal_documents = sqlx::query(
        "UPDATE legal_documents SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW() \
         WHERE is_deleted = FALSE \
           AND content_id IN (SELECT content_id FROM content_sites WHERE site_id = $1)",
    )
    .bind(site_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    // social_links — direct site_id.
    let social_links = sqlx::query(
        "UPDATE social_links SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW() \
         WHERE site_id = $1 AND is_deleted = FALSE",
    )
    .bind(site_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    // documents — direct site_id.
    let documents = sqlx::query(
        "UPDATE documents SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW() \
         WHERE site_id = $1 AND is_deleted = FALSE",
    )
    .bind(site_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    // navigation_menus — direct site_id.
    let navigation_menus = sqlx::query(
        "UPDATE navigation_menus SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW() \
         WHERE site_id = $1 AND is_deleted = FALSE",
    )
    .bind(site_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    // navigation_items — direct site_id.
    let navigation_items = sqlx::query(
        "UPDATE navigation_items SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW() \
         WHERE site_id = $1 AND is_deleted = FALSE",
    )
    .bind(site_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    // media_files — site-owned only. Media merely shared into this site
    // is owned elsewhere (media_sites.is_owner = FALSE) and left intact.
    let media_files = sqlx::query(
        "UPDATE media_files SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW() \
         WHERE is_deleted = FALSE \
           AND id IN (SELECT media_file_id FROM media_sites \
                      WHERE site_id = $1 AND is_owner = TRUE)",
    )
    .bind(site_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    tx.commit().await?;

    Ok(ResetContentResponse {
        contents,
        legal_documents,
        documents,
        social_links,
        navigation_menus,
        navigation_items,
        media_files,
        total: contents
            + legal_documents
            + documents
            + social_links
            + navigation_menus
            + navigation_items
            + media_files,
    })
}
