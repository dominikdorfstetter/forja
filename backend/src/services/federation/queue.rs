//! Delivery queue abstraction with PostgreSQL backend and circuit breaker.
//!
//! `DeliveryQueue` is the core trait for enqueueing and processing outbound
//! ActivityPub delivery jobs. `PgQueue` provides a PostgreSQL-backed
//! implementation using `SELECT FOR UPDATE SKIP LOCKED`.
//!
//! `CompositeQueue` wraps `PgQueue` and can optionally front it with a Redis
//! queue (TODO). A `CircuitBreaker` gates Redis access so a Redis outage does
//! not block the hot path.

use async_trait::async_trait;
use sqlx::PgPool;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Instant;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::models::federation::delivery::ApDeliveryJob;

// ── DeliveryQueue trait ─────────────────────────────────────────────────

/// Abstraction over the outbound delivery queue.
#[async_trait]
pub trait DeliveryQueue: Send + Sync {
    /// Enqueue a single delivery job for the given activity.
    async fn enqueue(&self, activity_id: Uuid, target_inbox_uri: &str) -> Result<(), ApiError>;

    /// Dequeue up to `batch_size` jobs ready for delivery.
    async fn dequeue(&self, batch_size: usize) -> Result<Vec<ApDeliveryJob>, ApiError>;

    /// Mark a job as successfully delivered.
    async fn mark_done(&self, job_id: Uuid) -> Result<(), ApiError>;

    /// Mark a job as failed with an error message.
    async fn mark_failed(&self, job_id: Uuid, error: &str) -> Result<(), ApiError>;
}

// ── PgQueue ─────────────────────────────────────────────────────────────

/// PostgreSQL-backed delivery queue.
pub struct PgQueue {
    pool: PgPool,
}

impl PgQueue {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl DeliveryQueue for PgQueue {
    async fn enqueue(&self, activity_id: Uuid, target_inbox_uri: &str) -> Result<(), ApiError> {
        sqlx::query(
            r#"
            INSERT INTO ap_delivery_queue (activity_id, target_inbox_uri, queue_backend, next_retry_at)
            VALUES ($1, $2, 'pg', NOW())
            "#,
        )
        .bind(activity_id)
        .bind(target_inbox_uri)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn dequeue(&self, batch_size: usize) -> Result<Vec<ApDeliveryJob>, ApiError> {
        let jobs = sqlx::query_as::<_, ApDeliveryJob>(
            r#"
            SELECT * FROM ap_delivery_queue
            WHERE status IN ('pending', 'failed')
              AND (next_retry_at IS NULL OR next_retry_at <= NOW())
            ORDER BY created_at ASC
            LIMIT $1
            FOR UPDATE SKIP LOCKED
            "#,
        )
        .bind(batch_size as i64)
        .fetch_all(&self.pool)
        .await?;

        Ok(jobs)
    }

    async fn mark_done(&self, job_id: Uuid) -> Result<(), ApiError> {
        ApDeliveryJob::mark_done(&self.pool, job_id).await
    }

    async fn mark_failed(&self, job_id: Uuid, error: &str) -> Result<(), ApiError> {
        ApDeliveryJob::mark_failed(&self.pool, job_id, error).await
    }
}

// ── CircuitBreaker ──────────────────────────────────────────────────────

/// Simple circuit breaker for gating Redis access.
///
/// States:
/// - **Closed** — Redis is healthy; all calls go through.
/// - **Open** — Redis is down; skip Redis for `RESET_TIMEOUT` seconds.
/// - **Half-open** — `RESET_TIMEOUT` elapsed; next call is a probe.
pub struct CircuitBreaker {
    is_open: AtomicBool,
    opened_at: Mutex<Option<Instant>>,
}

/// How long the circuit stays open before allowing a probe.
const RESET_TIMEOUT_SECS: u64 = 60;

impl CircuitBreaker {
    pub fn new() -> Self {
        Self {
            is_open: AtomicBool::new(false),
            opened_at: Mutex::new(None),
        }
    }

    /// Returns `true` when Redis should be attempted.
    ///
    /// - Closed -> true
    /// - Open (< 60 s) -> false
    /// - Open (>= 60 s) -> true (half-open probe)
    pub fn should_try_redis(&self) -> bool {
        if !self.is_open.load(Ordering::Acquire) {
            return true;
        }

        let guard = self
            .opened_at
            .lock()
            .expect("circuit breaker mutex poisoned");
        match *guard {
            Some(opened) => opened.elapsed().as_secs() >= RESET_TIMEOUT_SECS,
            None => true,
        }
    }

    /// Record a Redis failure — opens the circuit.
    pub fn record_failure(&self) {
        self.is_open.store(true, Ordering::Release);
        let mut guard = self
            .opened_at
            .lock()
            .expect("circuit breaker mutex poisoned");
        *guard = Some(Instant::now());
    }

    /// Record a Redis success — closes the circuit.
    pub fn record_success(&self) {
        self.is_open.store(false, Ordering::Release);
        let mut guard = self
            .opened_at
            .lock()
            .expect("circuit breaker mutex poisoned");
        *guard = None;
    }
}

impl Default for CircuitBreaker {
    fn default() -> Self {
        Self::new()
    }
}

// ── CompositeQueue ──────────────────────────────────────────────────────

/// Composite queue that delegates to PgQueue and optionally fronts it with
/// Redis for lower-latency enqueue operations.
///
/// When `redis_url` is `None`, all operations use PgQueue directly.
pub struct CompositeQueue {
    pg: PgQueue,
    _circuit_breaker: CircuitBreaker,
    // TODO: Add `redis: Option<RedisQueue>` once Redis queue is implemented.
    //       The circuit breaker will gate access to prevent blocking when Redis
    //       is unavailable.
    _redis_url: Option<String>,
}

impl CompositeQueue {
    pub fn new(pool: PgPool, redis_url: Option<String>) -> Self {
        Self {
            pg: PgQueue::new(pool),
            _circuit_breaker: CircuitBreaker::new(),
            _redis_url: redis_url,
        }
    }
}

#[async_trait]
impl DeliveryQueue for CompositeQueue {
    async fn enqueue(&self, activity_id: Uuid, target_inbox_uri: &str) -> Result<(), ApiError> {
        // TODO: When Redis is available and circuit breaker allows it,
        //       enqueue to Redis first for lower latency.
        //       On Redis failure, fall back to PgQueue and record_failure().
        self.pg.enqueue(activity_id, target_inbox_uri).await
    }

    async fn dequeue(&self, batch_size: usize) -> Result<Vec<ApDeliveryJob>, ApiError> {
        // TODO: When Redis is available, dequeue from Redis first.
        //       Fall back to PgQueue for any remaining capacity.
        self.pg.dequeue(batch_size).await
    }

    async fn mark_done(&self, job_id: Uuid) -> Result<(), ApiError> {
        self.pg.mark_done(job_id).await
    }

    async fn mark_failed(&self, job_id: Uuid, error: &str) -> Result<(), ApiError> {
        self.pg.mark_failed(job_id, error).await
    }
}

// ── Tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_circuit_starts_closed() {
        let cb = CircuitBreaker::new();
        assert!(
            cb.should_try_redis(),
            "circuit should start closed (allow Redis)"
        );
    }

    #[test]
    fn test_circuit_opens_on_failure() {
        let cb = CircuitBreaker::new();
        cb.record_failure();
        assert!(
            !cb.should_try_redis(),
            "circuit should be open after failure"
        );
    }

    #[test]
    fn test_circuit_half_open_after_timeout() {
        let cb = CircuitBreaker::new();
        cb.record_failure();

        // Manually set opened_at to the past to simulate timeout
        {
            let mut guard = cb.opened_at.lock().unwrap();
            *guard = Some(Instant::now() - Duration::from_secs(RESET_TIMEOUT_SECS + 1));
        }

        assert!(
            cb.should_try_redis(),
            "circuit should be half-open after timeout"
        );
    }

    #[test]
    fn test_circuit_closes_on_success() {
        let cb = CircuitBreaker::new();
        cb.record_failure();
        assert!(!cb.should_try_redis());

        cb.record_success();
        assert!(cb.should_try_redis(), "circuit should close after success");
    }

    #[test]
    fn test_circuit_stays_open_before_timeout() {
        let cb = CircuitBreaker::new();
        cb.record_failure();

        // Even after a short sleep, circuit should remain open
        thread::sleep(Duration::from_millis(10));
        assert!(
            !cb.should_try_redis(),
            "circuit should stay open before timeout"
        );
    }

    #[test]
    fn test_circuit_multiple_failures_do_not_panic() {
        let cb = CircuitBreaker::new();
        cb.record_failure();
        cb.record_failure();
        cb.record_failure();
        assert!(!cb.should_try_redis());
    }

    #[test]
    fn test_circuit_default_is_closed() {
        let cb = CircuitBreaker::default();
        assert!(cb.should_try_redis());
    }
}
