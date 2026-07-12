//! Webhook retry background worker
//!
//! Rocket fairing that polls `webhook_retry_queue` for pending deliveries
//! and retries them with exponential backoff (0s, 5m, 30m, 2h, 12h, 48h).

use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Semaphore;

use crate::AppState;
use crate::models::webhook::{Webhook, WebhookRetryJob};
use crate::services::{encryption, webhook_service, worker_lock};

/// How often the worker polls the queue (seconds).
const POLL_INTERVAL_SECS: u64 = 15;

/// Maximum concurrent retry deliveries.
const MAX_CONCURRENCY: usize = 5;

/// Number of jobs to dequeue per poll cycle.
const BATCH_SIZE: i64 = 10;

/// Default retention for dead (max-attempts-exhausted) retry rows, in days.
/// Overridable via `WEBHOOK_DEAD_RETENTION_DAYS`.
const DEFAULT_DEAD_RETENTION_DAYS: i64 = 30;

/// Resolve the dead-row retention window, honoring `WEBHOOK_DEAD_RETENTION_DAYS`.
fn dead_retention_days() -> i64 {
    std::env::var("WEBHOOK_DEAD_RETENTION_DAYS")
        .ok()
        .and_then(|s| s.parse::<i64>().ok())
        .filter(|&n| n > 0)
        .unwrap_or(DEFAULT_DEAD_RETENTION_DAYS)
}

/// Rocket fairing that starts the webhook retry worker on liftoff.
pub struct WebhookRetryWorker;

impl WebhookRetryWorker {
    pub fn spawn(state: AppState) {
        let key = match encryption::resolve_key(&state.settings.security.document_encryption_key) {
            Ok(k) => Some(k),
            Err(e) => {
                tracing::warn!(
                    "Webhook retry worker: encryption key unavailable — retries will fail for encrypted secrets: {e}"
                );
                None
            }
        };
        start_worker(state.db.clone(), key);
    }
}

fn start_worker(pool: PgPool, encryption_key: Option<[u8; 32]>) {
    tokio::spawn(async move {
        tracing::info!(
            "Webhook retry worker started (poll interval: {}s)",
            POLL_INTERVAL_SECS
        );
        let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENCY));

        loop {
            tokio::time::sleep(std::time::Duration::from_secs(POLL_INTERVAL_SECS)).await;

            let Some(ref key) = encryption_key else {
                tracing::debug!(
                    worker = "webhook_retry",
                    reason = "no_encryption_key",
                    "cycle skipped"
                );
                continue;
            };

            worker_lock::run_if_leader(&pool, "webhook_retry", || async {
                match WebhookRetryJob::dequeue_pending(&pool, BATCH_SIZE).await {
                    Ok(jobs) if jobs.is_empty() => {}
                    Ok(jobs) => {
                        tracing::debug!(
                            worker = "webhook_retry",
                            job_count = jobs.len(),
                            "processing jobs"
                        );
                        for job in jobs {
                            let pool = pool.clone();
                            let permit = semaphore.clone().acquire_owned().await;
                            let key = *key;
                            tokio::spawn(async move {
                                let _permit = permit;
                                process_retry_job(&pool, &job, &key).await;
                            });
                        }
                    }
                    Err(e) => {
                        tracing::warn!(worker = "webhook_retry", error = %e, "poll failed");
                    }
                }

                // Retention sweep: dead rows accumulate forever on permanently
                // failing endpoints. The DELETE is date-bounded, so most ticks
                // remove nothing.
                match WebhookRetryJob::purge_dead(&pool, dead_retention_days()).await {
                    Ok(n) if n > 0 => {
                        tracing::info!(worker = "webhook_retry", purged = n, "purged dead retry rows")
                    }
                    Ok(_) => {}
                    Err(e) => {
                        tracing::warn!(worker = "webhook_retry", error = %e, "dead-row purge failed")
                    }
                }
            })
            .await;
        }
    });
}

/// Process a single retry job: attempt delivery, then mark done or schedule next retry.
#[tracing::instrument(name = "webhook_retry_job", skip_all, fields(job_id = %job.id, webhook_id = %job.webhook_id))]
async fn process_retry_job(pool: &PgPool, job: &WebhookRetryJob, encryption_key: &[u8; 32]) {
    let webhook = match Webhook::find_by_id(pool, job.webhook_id).await {
        Ok(w) if w.is_active => w,
        Ok(_) => {
            let _ = WebhookRetryJob::schedule_retry(pool, job.id, "Webhook deactivated").await;
            return;
        }
        Err(_) => {
            let _ = WebhookRetryJob::schedule_retry(pool, job.id, "Webhook not found").await;
            return;
        }
    };

    let attempt = (job.attempts + 1) as i16;
    let (status_code, error, _delivery_id) = webhook_service::attempt_delivery(
        pool,
        &webhook,
        &job.event_type,
        &job.payload,
        attempt,
        encryption_key,
    )
    .await;

    if webhook_service::is_success(status_code) {
        let _ = WebhookRetryJob::mark_done(pool, job.id).await;
        tracing::info!(
            webhook_id = %job.webhook_id,
            event = %job.event_type,
            attempt = attempt,
            "Webhook retry succeeded"
        );
    } else {
        let error_msg = error.unwrap_or_else(|| "Unknown error".to_string());
        let _ = WebhookRetryJob::schedule_retry(pool, job.id, &error_msg).await;
        tracing::warn!(
            webhook_id = %job.webhook_id,
            event = %job.event_type,
            attempt = attempt,
            error = %error_msg,
            "Webhook retry failed"
        );
    }
}
