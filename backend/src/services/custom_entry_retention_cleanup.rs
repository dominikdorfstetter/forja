//! GDPR retention worker for custom-type entries (#794).
//!
//! Hourly tick (matching the other Forja workers — see
//! `forms_retention_cleanup`) that hard-deletes entries older than their
//! type's `retention_days`. Types with NULL/0 retention opt out. Leader-
//! elected via `worker_lock` so only one replica purges per tick.

use sqlx::PgPool;

use crate::AppState;
use crate::models::custom_entry::CustomEntry;
use crate::services::worker_lock;

const POLL_INTERVAL_SECS: u64 = 3_600;

pub struct CustomEntryRetentionCleanupWorker;

impl CustomEntryRetentionCleanupWorker {
    pub fn spawn(state: AppState) {
        let pool = state.db.clone();
        tracing::info!(
            "Custom-entry retention cleanup worker starting (interval={}h)",
            POLL_INTERVAL_SECS / 3600,
        );
        tokio::spawn(async move {
            let mut interval =
                tokio::time::interval(std::time::Duration::from_secs(POLL_INTERVAL_SECS));
            loop {
                interval.tick().await;
                worker_lock::run_if_leader(&pool, "custom_entry_retention_cleanup", || {
                    run_once(&pool)
                })
                .await;
            }
        });
    }
}

/// One retention sweep. Public so integration tests can drive it directly.
#[tracing::instrument(name = "custom_entry_retention_cleanup_tick", skip_all)]
pub async fn run_once(pool: &PgPool) {
    match CustomEntry::purge_expired(pool).await {
        Ok(0) => {}
        Ok(n) => tracing::info!(
            worker = "custom_entry_retention_cleanup",
            purged = n,
            "custom-entry retention sweep purged entries"
        ),
        // A failed sweep is a partial-failure signal on-call should see — tag it
        // with the worker so it surfaces alongside the other workers' summaries.
        Err(e) => tracing::error!(
            worker = "custom_entry_retention_cleanup",
            error = %e,
            "custom-entry retention sweep failed"
        ),
    }
}
