//! Trash cleanup worker.
//!
//! Spawns a Tokio task on liftoff that runs once per day and permanently
//! deletes soft-deleted items older than the retention period (30 days).
//!
//! Covers: content-spine entities (blogs, pages, projects, CV entries — all
//! purged together via `ContentService::purge_expired_trash`), skills, media
//! files, documents, legal documents, social links, navigation items, and
//! navigation menus.

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::audit::AuditAction;
use crate::models::media::MediaFile;
use crate::models::site::Site;
use crate::repos::cv_repo::SkillRepo;
use crate::repos::legal_repo::LegalDocumentRepo;
use crate::services::audited_mutation::{self, MutationEvent};
use crate::services::content_service::ContentService;
use crate::services::worker_lock;
use crate::AppState;

/// How often the cleanup runs (seconds). Default: 24 hours.
const POLL_INTERVAL_SECS: u64 = 86_400;

/// Default retention period for trashed items (days).
const DEFAULT_RETENTION_DAYS: i64 = 30;

/// Rocket fairing that spawns the trash cleanup worker on liftoff.
pub struct TrashCleanupWorker;

impl TrashCleanupWorker {
    pub fn spawn(state: AppState) {
        let pool = state.db.clone();
        tracing::info!(
            worker = "trash_cleanup",
            interval_hours = POLL_INTERVAL_SECS / 3600,
            retention_days = DEFAULT_RETENTION_DAYS,
            "worker starting"
        );
        tokio::spawn(async move {
            let mut interval =
                tokio::time::interval(std::time::Duration::from_secs(POLL_INTERVAL_SECS));
            loop {
                interval.tick().await;
                worker_lock::run_if_leader(&pool, "trash_cleanup", || run_cleanup(&pool)).await;
            }
        });
    }
}

/// Purge expired trash items from a given table.
/// Returns the number of items purged.
async fn purge_table(pool: &PgPool, table: &str, retention_days: i64) -> u64 {
    let cutoff = chrono::Utc::now() - chrono::TimeDelta::days(retention_days);

    let query = format!(
        "DELETE FROM {} WHERE is_deleted = TRUE AND deleted_at IS NOT NULL AND deleted_at < $1",
        table
    );

    match sqlx::query(sqlx::AssertSqlSafe(query))
        .bind(cutoff)
        .execute(pool)
        .await
    {
        Ok(result) => result.rows_affected(),
        Err(e) => {
            tracing::error!(worker = "trash_cleanup", table = %table, error = %e, "table purge failed");
            0
        }
    }
}

/// Purge expired media files via per-record permanent delete (DB cleanup).
async fn purge_expired_media(pool: &PgPool, retention_days: i64) -> u64 {
    let cutoff = chrono::Utc::now() - chrono::TimeDelta::days(retention_days);

    let expired_ids: Vec<(Uuid,)> = match sqlx::query_as(
        "SELECT id FROM media_files WHERE is_deleted = TRUE AND deleted_at IS NOT NULL AND deleted_at < $1",
    )
    .bind(cutoff)
    .fetch_all(pool)
    .await
    {
        Ok(ids) => ids,
        Err(e) => {
            tracing::error!(worker = "trash_cleanup", error = %e, "expired media query failed");
            return 0;
        }
    };

    let count = expired_ids.len() as u64;
    for (id,) in expired_ids {
        if let Err(e) = MediaFile::permanent_delete(pool, id).await {
            tracing::warn!(worker = "trash_cleanup", media_id = %id, error = %e, "media purge failed");
        }
    }

    count
}

/// Purge expired legal documents via per-record permanent delete (cleans up associated content).
async fn purge_expired_legal(pool: &PgPool, retention_days: i64) -> u64 {
    let cutoff = chrono::Utc::now() - chrono::TimeDelta::days(retention_days);

    let expired_ids: Vec<(Uuid,)> = match sqlx::query_as(
        "SELECT id FROM legal_documents WHERE is_deleted = TRUE AND deleted_at IS NOT NULL AND deleted_at < $1",
    )
    .bind(cutoff)
    .fetch_all(pool)
    .await
    {
        Ok(ids) => ids,
        Err(e) => {
            tracing::error!(worker = "trash_cleanup", error = %e, "expired legal docs query failed");
            return 0;
        }
    };

    let count = expired_ids.len() as u64;
    for (id,) in expired_ids {
        if let Err(e) = LegalDocumentRepo::permanent_delete(pool, id).await {
            tracing::warn!(worker = "trash_cleanup", legal_id = %id, error = %e, "legal doc purge failed");
        }
    }

    count
}

/// Hard-delete soft-deleted sites past the restore grace window and emit
/// a **system-level** audit row per purged site. Returns the count.
///
/// The audit row deliberately uses `site_id: None` — a site-scoped row
/// would be cascade-deleted by the same `DELETE FROM sites`. The purged
/// id is preserved in `entity_id`.
pub async fn purge_expired_sites(pool: &PgPool) -> u64 {
    let purged = match Site::purge_expired(pool).await {
        Ok(ids) => ids,
        Err(e) => {
            tracing::error!(worker = "trash_cleanup", error = %e, "site purge failed");
            return 0;
        }
    };

    for id in &purged {
        audited_mutation::execute(
            pool,
            MutationEvent {
                site_id: None,
                user_id: None,
                action: AuditAction::Delete,
                entity_type: "site",
                entity_id: *id,
                webhook_event: None,
                webhook_payload: serde_json::Value::Null,
                audit_metadata: Some(serde_json::json!({
                    "reason": "purge_expired",
                    "retention_days": Site::SOFT_DELETE_RETENTION_DAYS,
                })),
                change_diff: None,
            },
        )
        .await;
    }

    purged.len() as u64
}

#[tracing::instrument(name = "trash_cleanup_tick", skip_all)]
async fn run_cleanup(pool: &PgPool) {
    tracing::info!(worker = "trash_cleanup", "run starting");

    // Content (blogs, pages) — uses ContentService for proper cascade
    match ContentService::purge_expired_trash(pool, DEFAULT_RETENTION_DAYS).await {
        Ok(count) if count > 0 => tracing::info!(
            worker = "trash_cleanup",
            kind = "content",
            purged = count,
            "items purged"
        ),
        Ok(_) => {}
        Err(e) => tracing::error!(
            worker = "trash_cleanup",
            kind = "content",
            error = %e,
            "purge failed"
        ),
    }

    // Media files — need per-record handling for DB cleanup
    let media_count = purge_expired_media(pool, DEFAULT_RETENTION_DAYS).await;
    if media_count > 0 {
        tracing::info!(
            worker = "trash_cleanup",
            kind = "media",
            purged = media_count,
            "items purged"
        );
    }

    // Legal documents — need per-record handling to clean up associated content records
    let legal_count = purge_expired_legal(pool, DEFAULT_RETENTION_DAYS).await;
    if legal_count > 0 {
        tracing::info!(
            worker = "trash_cleanup",
            kind = "legal_documents",
            purged = legal_count,
            "items purged"
        );
    }

    // Skills — own table (not the content spine); FK cascade reclaims
    // skill_sites / localizations / project & cv junctions.
    match SkillRepo::purge_expired(pool, DEFAULT_RETENTION_DAYS).await {
        Ok(count) if count > 0 => tracing::info!(
            worker = "trash_cleanup",
            kind = "skills",
            purged = count,
            "items purged"
        ),
        Ok(_) => {}
        Err(e) => tracing::error!(
            worker = "trash_cleanup",
            kind = "skills",
            error = %e,
            "purge failed"
        ),
    }

    // Simple table purges (FK cascades handle child records)
    // Note: navigation_items before navigation_menus (items purged independently,
    // menus cascade-delete remaining items when purged)
    let tables = [
        ("documents", "documents"),
        ("social_links", "social links"),
        ("navigation_items", "navigation items"),
        ("navigation_menus", "navigation menus"),
    ];

    for (table, label) in &tables {
        let count = purge_table(pool, table, DEFAULT_RETENTION_DAYS).await;
        if count > 0 {
            tracing::info!(worker = "trash_cleanup", kind = %label, purged = count, "items purged");
        }
    }

    // Sites — hard-delete past the grace window; FK cascade reclaims all
    // site-scoped data. Audited at system level (see purge_expired_sites).
    let site_count = purge_expired_sites(pool).await;
    if site_count > 0 {
        tracing::info!(
            worker = "trash_cleanup",
            kind = "sites",
            purged = site_count,
            "items purged"
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants() {
        assert_eq!(POLL_INTERVAL_SECS, 86_400);
        assert_eq!(DEFAULT_RETENTION_DAYS, 30);
    }
}
