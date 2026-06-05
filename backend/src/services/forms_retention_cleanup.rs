//! GDPR retention worker for form submissions (#583).
//!
//! Per-form retention policy: each `forms.retention_days` value sets how
//! long submissions can live before being soft-deleted automatically. The
//! worker ticks hourly, finds submissions older than their parent form's
//! retention window, and flips `is_deleted = TRUE`. Forms with
//! `retention_days IS NULL` or `0` opt out — their submissions are never
//! auto-deleted.
//!
//! ## Design choice: tokio::time::interval, not tokio-cron-scheduler
//!
//! Issue #583 suggests `tokio-cron-scheduler`. Forja's existing workers
//! (publish_scheduler, audit_cleanup, trash_cleanup, …) all use
//! `tokio::time::interval`, and hourly retention doesn't need
//! cron-precise scheduling — drift of a few seconds per day across hours
//! is irrelevant for GDPR purposes (the regulation cares about whether
//! data is deleted, not whether the deletion happens at HH:00:00.000).
//! Sticking to the established pattern keeps the worker surface uniform
//! and avoids pulling in a new transitive dependency for one tick loop.
//!
//! Resilience properties:
//! - DB connection failure → log error, retry on next tick (no crash).
//! - Worker panic → tokio task ends, but the parent server keeps serving.
//!   (matches behavior of every other worker — see workers.rs)

use sqlx::PgPool;

use crate::services::worker_lock;
use crate::AppState;

/// Tick interval. Hourly per the #583 spec.
const POLL_INTERVAL_SECS: u64 = 3_600;

pub struct FormsRetentionCleanupWorker;

impl FormsRetentionCleanupWorker {
    pub fn spawn(state: AppState) {
        let pool = state.db.clone();
        tracing::info!(
            "Forms retention cleanup worker starting (interval={}h)",
            POLL_INTERVAL_SECS / 3600,
        );
        tokio::spawn(async move {
            let mut interval =
                tokio::time::interval(std::time::Duration::from_secs(POLL_INTERVAL_SECS));
            loop {
                interval.tick().await;
                worker_lock::run_if_leader(&pool, "forms_retention_cleanup", || run_once(&pool))
                    .await;
            }
        });
    }
}

/// One pass of the retention sweep. Public so integration tests can drive
/// it without spawning the loop.
#[tracing::instrument(name = "forms_retention_cleanup_tick", skip_all)]
pub async fn run_once(pool: &PgPool) {
    let result = sqlx::query_scalar::<_, i64>(
        r#"
        WITH expired AS (
            SELECT fs.id
              FROM form_submissions fs
              JOIN forms f ON f.id = fs.form_id
             WHERE NOT fs.is_deleted
               AND f.retention_days IS NOT NULL
               AND f.retention_days > 0
               AND fs.created_at < NOW() - (f.retention_days || ' days')::INTERVAL
        )
        UPDATE form_submissions
           SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW()
          FROM expired
         WHERE form_submissions.id = expired.id
        RETURNING 1
        "#,
    )
    .fetch_all(pool)
    .await;

    match result {
        Ok(rows) => {
            let count = rows.len();
            if count > 0 {
                tracing::info!(
                    "Forms retention cleanup: soft-deleted {} submissions",
                    count
                );
            }
        }
        Err(e) => {
            // No crash — log and let the next tick retry.
            tracing::error!(worker = "forms_retention_cleanup", error = %e, "query failed");
        }
    }
}
