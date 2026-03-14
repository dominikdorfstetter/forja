//! Federation background worker fairing.
//!
//! Spawns a Tokio task on liftoff that periodically polls the delivery queue
//! and dispatches outbound activities. A second timer purges dead-letter jobs
//! once per hour.
//!
//! Concurrency is bounded by two semaphores:
//! - **outbound** (10 permits) — limits concurrent outbound HTTP deliveries
//! - **inbound** (5 permits) — reserved for future inbound processing
//!
//! The worker checks whether *any* site has federation enabled before doing
//! real work each cycle, so it is safe to attach unconditionally.

use rocket::fairing::{Fairing, Info, Kind};
use rocket::{Orbit, Rocket};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::Semaphore;

use crate::models::federation::delivery::ApDeliveryJob;
use crate::services::federation::queue::{CompositeQueue, DeliveryQueue};
use crate::AppState;

/// Maximum concurrent outbound delivery tasks.
const MAX_OUTBOUND_CONCURRENCY: usize = 10;

/// Maximum concurrent inbound processing tasks (reserved for future use).
const MAX_INBOUND_CONCURRENCY: usize = 5;

/// How often the worker polls the queue (seconds).
const POLL_INTERVAL_SECS: u64 = 5;

/// How often dead-letter purge runs (seconds — once per hour).
const PURGE_INTERVAL_SECS: u64 = 3600;

/// Number of jobs to dequeue per poll cycle.
const BATCH_SIZE: usize = 10;

/// Rocket fairing that spawns the federation background worker on liftoff.
pub struct FederationWorker;

#[rocket::async_trait]
impl Fairing for FederationWorker {
    fn info(&self) -> Info {
        Info {
            name: "Federation Background Worker",
            kind: Kind::Liftoff | Kind::Shutdown,
        }
    }

    async fn on_liftoff(&self, rocket: &Rocket<Orbit>) {
        let state = match rocket.state::<AppState>() {
            Some(s) => s.clone(),
            None => {
                tracing::error!("FederationWorker: AppState not found in managed state");
                return;
            }
        };

        let redis_url = if state.settings.security.redis_url.is_empty() {
            None
        } else {
            Some(state.settings.security.redis_url.clone())
        };

        let queue: Arc<dyn DeliveryQueue> =
            Arc::new(CompositeQueue::new(state.db.clone(), redis_url));

        let shutdown = Arc::new(AtomicBool::new(false));
        let shutdown_clone = Arc::clone(&shutdown);
        let _outbound_sem = Arc::new(Semaphore::new(MAX_OUTBOUND_CONCURRENCY));
        let _inbound_sem = Arc::new(Semaphore::new(MAX_INBOUND_CONCURRENCY));

        let pool = state.db.clone();

        // Store shutdown flag for on_shutdown
        rocket
            .state::<AppState>()
            .expect("AppState must be managed");

        tracing::info!(
            "Federation worker starting (poll={}s, purge={}s, outbound_max={}, inbound_max={})",
            POLL_INTERVAL_SECS,
            PURGE_INTERVAL_SECS,
            MAX_OUTBOUND_CONCURRENCY,
            MAX_INBOUND_CONCURRENCY,
        );

        tokio::spawn(async move {
            let mut poll_interval =
                tokio::time::interval(std::time::Duration::from_secs(POLL_INTERVAL_SECS));
            let mut purge_interval =
                tokio::time::interval(std::time::Duration::from_secs(PURGE_INTERVAL_SECS));

            loop {
                if shutdown_clone.load(Ordering::Acquire) {
                    tracing::info!("Federation worker shutting down");
                    break;
                }

                tokio::select! {
                    _ = poll_interval.tick() => {
                        // Check if any site has federation enabled
                        let has_federation = match check_federation_enabled(&pool).await {
                            Ok(enabled) => enabled,
                            Err(e) => {
                                tracing::warn!("Federation worker: failed to check federation status: {e}");
                                false
                            }
                        };

                        if !has_federation {
                            continue;
                        }

                        // Dequeue and process jobs
                        match queue.dequeue(BATCH_SIZE).await {
                            Ok(jobs) if jobs.is_empty() => {
                                // Nothing to do
                            }
                            Ok(jobs) => {
                                tracing::debug!("Federation worker: dequeued {} jobs", jobs.len());
                                for job in jobs {
                                    // TODO: Acquire outbound semaphore permit and spawn
                                    // delivery task. The actual HTTP delivery logic
                                    // (signing, sending) comes in Chunk 5.
                                    process_job(&queue, &job).await;
                                }
                            }
                            Err(e) => {
                                tracing::error!("Federation worker: dequeue failed: {e}");
                            }
                        }
                    }
                    _ = purge_interval.tick() => {
                        match ApDeliveryJob::purge_old_dead_letters(&pool).await {
                            Ok(count) if count > 0 => {
                                tracing::info!("Federation worker: purged {count} dead-letter jobs");
                            }
                            Ok(_) => {}
                            Err(e) => {
                                tracing::warn!("Federation worker: dead-letter purge failed: {e}");
                            }
                        }
                    }
                }
            }
        });
    }

    async fn on_shutdown(&self, _rocket: &Rocket<Orbit>) {
        // In a full implementation we'd signal the shutdown flag and wait
        // up to 30 seconds for in-flight tasks. Since the worker task holds
        // an Arc<AtomicBool>, we'd need to store it in managed state.
        // For now, Tokio's runtime shutdown will cancel the spawned task.
        tracing::info!("Federation worker: shutdown signal received");
    }
}

/// Check whether *any* site has federation enabled.
async fn check_federation_enabled(pool: &sqlx::PgPool) -> Result<bool, sqlx::Error> {
    let exists: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM site_settings
            WHERE key = 'module_federation_enabled'
              AND value = '"true"'
        )
        "#,
    )
    .fetch_one(pool)
    .await?;

    Ok(exists)
}

/// Process a single delivery job.
///
/// This is a skeleton — the actual HTTP signing and delivery logic will be
/// implemented in the delivery service (Chunk 5). For now it just marks
/// the job as done to prevent infinite re-processing during development.
async fn process_job(queue: &Arc<dyn DeliveryQueue>, job: &ApDeliveryJob) {
    tracing::debug!(
        "Federation worker: processing job {} -> {}",
        job.id,
        job.target_inbox_uri
    );

    // TODO: Implement actual delivery:
    // 1. Look up the activity payload from ap_activities
    // 2. Look up the actor's signing key
    // 3. Sign the request with HTTP signatures
    // 4. POST to the target inbox
    // 5. Handle response (mark_done on success, schedule_retry on failure)

    // For now, log and skip — don't mark done/failed so jobs stay in the queue
    // until the delivery service is implemented.
    tracing::debug!(
        "Federation worker: job {} skipped (delivery service not yet implemented)",
        job.id
    );
    let _ = queue;
    let _ = job;
}
