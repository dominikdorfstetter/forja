//! Webhook dispatch buffer flush worker.
//!
//! Polls for debounce buffers whose flush_at has passed, then delivers
//! the batched payload via the standard retry queue.

use std::time::Duration;

use sqlx::PgPool;

use crate::AppState;
use crate::models::webhook::{Webhook, WebhookDispatchBuffer};
use crate::services::{webhook_service, worker_lock};

const POLL_INTERVAL_SECS: u64 = 5;
const BATCH_SIZE: i64 = 10;
const CLEANUP_INTERVAL_CYCLES: u64 = 720; // ~1 hour at 5s interval

pub struct WebhookFlushWorker;

impl WebhookFlushWorker {
    pub fn spawn(state: AppState) {
        start_worker(state.db.clone());
    }
}

fn start_worker(pool: PgPool) {
    tokio::spawn(async move {
        tracing::info!(
            "Webhook flush worker started (poll interval: {}s)",
            POLL_INTERVAL_SECS
        );

        let mut cycle_count: u64 = 0;

        loop {
            tokio::time::sleep(Duration::from_secs(POLL_INTERVAL_SECS)).await;

            worker_lock::run_if_leader(&pool, "webhook_flush", || async {
                cycle_count += 1;

                match WebhookDispatchBuffer::dequeue_pending(&pool, BATCH_SIZE).await {
                    Ok(buffers) if buffers.is_empty() => {}
                    Ok(buffers) => {
                        for buffer in buffers {
                            process_buffer(&pool, &buffer).await;
                        }
                    }
                    Err(e) => {
                        tracing::warn!(worker = "webhook_flush", phase = "poll", error = %e, "poll failed");
                    }
                }

                if cycle_count.is_multiple_of(CLEANUP_INTERVAL_CYCLES) {
                    match WebhookDispatchBuffer::cleanup_flushed(&pool, 24).await {
                        Ok(count) if count > 0 => {
                            tracing::info!(
                                worker = "webhook_flush",
                                buffers_cleaned = count,
                                "cleanup complete"
                            );
                        }
                        Err(e) => {
                            tracing::warn!(worker = "webhook_flush", phase = "cleanup", error = %e, "cleanup failed");
                        }
                        _ => {}
                    }
                }
            })
            .await;
        }
    });
}

#[tracing::instrument(name = "webhook_flush_buffer", skip_all, fields(buffer_id = %buffer.id, webhook_id = %buffer.webhook_id))]
async fn process_buffer(pool: &PgPool, buffer: &WebhookDispatchBuffer) {
    let webhook = match Webhook::find_by_id(pool, buffer.webhook_id).await {
        Ok(w) => w,
        Err(_) => {
            let _ = WebhookDispatchBuffer::mark_flushed(pool, buffer.id).await;
            return;
        }
    };

    let events = &buffer.events;
    let event_count = events.as_array().map(|a| a.len()).unwrap_or(0);

    webhook_service::deliver_batch(pool, &webhook, events, event_count).await;

    if let Err(e) = WebhookDispatchBuffer::mark_flushed(pool, buffer.id).await {
        tracing::warn!(
            buffer_id = %buffer.id,
            "Webhook flush worker: failed to mark flushed: {e}"
        );
    }
}
