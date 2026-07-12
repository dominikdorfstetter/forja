//! Background worker spawn aggregator. Replaces the chain of `attach()`
//! calls Rocket made on liftoff (`main.rs` lines 542–550) with a single
//! call invoked from `main.rs` once Axum is the sole server.
//!
//! Each worker module exposes a `pub fn spawn(state: AppState)` that
//! contains the body of its old Rocket fairing's `on_liftoff` (after
//! the state extraction). The `pub fn` is shared by both the Rocket
//! fairing impl (still alive during the cutover window) and the call
//! below — no duplication, no behavioral drift between stacks.
//!
//! Each `spawn` returns immediately after registering its `tokio::spawn`,
//! so the caller doesn't block.
//!
//! # Single-leader convention (issue #732)
//!
//! `spawn_all` runs once per process. With N replicas, every worker loop
//! would otherwise run N times concurrently — wasted DB cycles for
//! idempotent workers, and duplicate emissions (webhooks, publishes,
//! anomaly alerts, site exports) for the non-idempotent ones.
//!
//! To prevent that, every tick body is wrapped in
//! [`crate::services::worker_lock::run_if_leader`], which uses a
//! per-worker Postgres advisory lock as a soft leader election. Replicas
//! that don't currently hold the lock log `skipped: leader held by
//! another replica` at debug and wait for the next tick. When the leader
//! replica dies, its pool connections close, Postgres releases the locks,
//! and any surviving replica picks them up on its next tick — no
//! coordinator service required.
//!
//! ## Adding a new worker
//!
//! 1. Write `pub fn spawn(state: AppState)` following the existing
//!    pattern (see e.g. [`crate::services::usage_aggregation`]).
//! 2. Inside the tick loop, wrap the cycle body in
//!    `worker_lock::run_if_leader(&pool, "<stable_name>", || …).await`.
//!    Pick a stable string identifier — different names hash to
//!    different lock slots, so unrelated workers don't block each other.
//! 3. Register the spawn call in [`spawn_all`] below.

use crate::AppState;
use crate::services::{
    anomaly_detection::AnomalyDetectionWorker, audit_cleanup::AuditCleanupWorker,
    custom_entry_retention_cleanup::CustomEntryRetentionCleanupWorker, demo_mode::DemoModeFairing,
    forms_retention_cleanup::FormsRetentionCleanupWorker, publish_scheduler::PublishScheduler,
    site_export_worker::SiteExportWorker, trash_cleanup::TrashCleanupWorker,
    usage_aggregation::UsageAggregationWorker, webhook_flush_worker::WebhookFlushWorker,
    webhook_retry_worker::WebhookRetryWorker,
};

/// Spawn every long-running background task. Idempotent within one process
/// — call it exactly once at startup. Calling it twice would register
/// duplicate timer loops.
pub fn spawn_all(state: AppState) {
    PublishScheduler::spawn(state.clone());
    AuditCleanupWorker::spawn(state.clone());
    TrashCleanupWorker::spawn(state.clone());
    UsageAggregationWorker::spawn(state.clone());
    AnomalyDetectionWorker::spawn(state.clone());
    DemoModeFairing::spawn(state.clone());
    WebhookRetryWorker::spawn(state.clone());
    WebhookFlushWorker::spawn(state.clone());
    FormsRetentionCleanupWorker::spawn(state.clone());
    CustomEntryRetentionCleanupWorker::spawn(state.clone());
    SiteExportWorker::spawn(state);
}
