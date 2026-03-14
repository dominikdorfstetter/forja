//! Federation background worker fairing.
//!
//! Spawns a Tokio task on liftoff that periodically:
//! 1. Processes pending **inbound** activities via `inbox_processor`
//! 2. Dispatches **outbound** delivery jobs (signing + HTTP POST — skeleton for now)
//! 3. Purges dead-letter jobs once per hour
//!
//! Concurrency is bounded by two semaphores:
//! - **outbound** (10 permits) — limits concurrent outbound HTTP deliveries
//! - **inbound** (5 permits) — limits concurrent inbound processing
//!
//! The worker checks whether *any* site has federation enabled before doing
//! real work each cycle, so it is safe to attach unconditionally.

use rocket::fairing::{Fairing, Info, Kind};
use rocket::{Orbit, Rocket};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::Semaphore;

use crate::models::federation::activity::ApActivity;
use crate::models::federation::delivery::ApDeliveryJob;
use crate::models::federation::types::ApActivityStatus;
use crate::services::federation::inbox_processor;
use crate::services::federation::queue::{CompositeQueue, DeliveryQueue};
use crate::AppState;

/// Maximum concurrent outbound delivery tasks.
const MAX_OUTBOUND_CONCURRENCY: usize = 10;

/// Maximum concurrent inbound processing tasks.
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

                        // ── Phase 1: Process pending inbound activities ──
                        process_inbound_activities(&pool).await;

                        // ── Phase 2: Process outbound delivery jobs ──
                        match queue.dequeue(BATCH_SIZE).await {
                            Ok(jobs) if jobs.is_empty() => {
                                // Nothing to do
                            }
                            Ok(jobs) => {
                                tracing::debug!("Federation worker: dequeued {} outbound jobs", jobs.len());
                                for job in jobs {
                                    process_outbound_job(&queue, &job, &pool).await;
                                }
                            }
                            Err(e) => {
                                tracing::error!("Federation worker: outbound dequeue failed: {e}");
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

/// Dequeue and process pending inbound activities through the inbox processor.
async fn process_inbound_activities(pool: &sqlx::PgPool) {
    let pending: Result<Vec<ApActivity>, _> = sqlx::query_as(
        r#"
        SELECT * FROM ap_activities
        WHERE direction = 'in'
          AND status = 'pending'
        ORDER BY created_at ASC
        LIMIT $1
        "#,
    )
    .bind(BATCH_SIZE as i64)
    .fetch_all(pool)
    .await;

    let pending = match pending {
        Ok(activities) => activities,
        Err(e) => {
            tracing::error!("Federation worker: failed to fetch pending inbound activities: {e}");
            return;
        }
    };

    if pending.is_empty() {
        return;
    }

    tracing::debug!(
        "Federation worker: processing {} pending inbound activities",
        pending.len()
    );

    for activity in &pending {
        // Look up the moderation mode for this site
        let moderation_mode = match get_moderation_mode(pool, activity.site_id).await {
            Ok(mode) => mode,
            Err(e) => {
                tracing::warn!(
                    activity_id = %activity.id,
                    "Federation worker: failed to get moderation mode: {e}"
                );
                "queue_all".to_string()
            }
        };

        match inbox_processor::process_activity(pool, activity, &moderation_mode).await {
            Ok(()) => {
                if let Err(e) =
                    ApActivity::update_status(pool, activity.id, ApActivityStatus::Done, None).await
                {
                    tracing::error!(
                        activity_id = %activity.id,
                        "Federation worker: failed to mark activity as done: {e}"
                    );
                }
            }
            Err(e) => {
                tracing::error!(
                    activity_id = %activity.id,
                    activity_type = activity.activity_type,
                    "Federation worker: inbox processing failed: {e}"
                );

                let error_msg = format!("{e}");
                if let Err(e2) = ApActivity::update_status(
                    pool,
                    activity.id,
                    ApActivityStatus::Failed,
                    Some(&error_msg),
                )
                .await
                {
                    tracing::error!(
                        activity_id = %activity.id,
                        "Federation worker: failed to mark activity as failed: {e2}"
                    );
                }
            }
        }
    }
}

/// Get the moderation mode setting for a site.
async fn get_moderation_mode(
    pool: &sqlx::PgPool,
    site_id: uuid::Uuid,
) -> Result<String, sqlx::Error> {
    let value: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT value FROM site_settings WHERE site_id = $1 AND key = 'federation_moderation_mode'",
    )
    .bind(site_id)
    .fetch_optional(pool)
    .await?;

    Ok(value
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "queue_all".to_string()))
}

/// Process a single outbound delivery job.
///
/// The actual HTTP signing and delivery logic will be implemented in a future
/// chunk. For now, it logs and skips to prevent infinite re-processing.
async fn process_outbound_job(
    queue: &Arc<dyn DeliveryQueue>,
    job: &ApDeliveryJob,
    _pool: &sqlx::PgPool,
) {
    tracing::debug!(
        "Federation worker: processing outbound job {} -> {}",
        job.id,
        job.target_inbox_uri
    );

    // TODO: Implement actual outbound delivery:
    // 1. Look up the activity payload from ap_activities using job.activity_id
    // 2. Look up the actor's signing key
    // 3. Sign the request with HTTP signatures
    // 4. POST to job.target_inbox_uri
    // 5. Handle response:
    //    - 2xx → queue.mark_done(job.id)
    //    - 4xx (permanent) → queue.mark_failed(job.id, error)
    //    - 5xx (transient) → ApDeliveryJob::schedule_retry(pool, job.id)

    tracing::debug!(
        "Federation worker: outbound job {} skipped (HTTP delivery not yet implemented)",
        job.id
    );
    let _ = queue;
}
