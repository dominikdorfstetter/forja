//! Postgres advisory-lock helper so each background worker runs on
//! only one replica at a time.
//!
//! ## Problem
//!
//! `axum_app::workers::spawn_all` runs once per process. With N replicas,
//! every long-running worker loop runs N times concurrently. Idempotent
//! workers waste DB cycles; non-idempotent ones (publish scheduler,
//! webhook delivery, anomaly alerts, site exports) risk emitting
//! duplicate events.
//!
//! ## Approach
//!
//! Each worker wraps its tick body in [`run_if_leader`]. The helper:
//!
//! 1. Acquires a dedicated connection from the pool.
//! 2. Runs `SELECT pg_try_advisory_lock(hashtext($1)::bigint)` with the
//!    worker name as the key source.
//! 3. If the lock is granted, executes the body, then runs
//!    `pg_advisory_unlock` on the same connection.
//! 4. If not, logs at debug and returns — the next tick re-tries.
//!
//! ## Replica-loss recovery
//!
//! Advisory locks are session-scoped. When the leader replica dies, its
//! pool connections close, Postgres releases the held locks, and the next
//! tick from any surviving replica acquires them. No coordinator service,
//! no leader election layer.
//!
//! ## Worker naming
//!
//! Pass a stable string per worker (e.g. `"publish_scheduler"`). Different
//! names hash via `hashtext` to different lock slots, so unrelated workers
//! don't block each other.
//!
//! ## Known limitation
//!
//! If `body` panics, the `pg_advisory_unlock` call is skipped and the
//! lock stays on the pool connection until that connection is recycled
//! (typically a few minutes of pool idle, or until process restart).
//! In practice every worker's tick body uses `Result` handling rather
//! than panicking, and a panicking worker already kills its own loop —
//! so the leak window is bounded and rare.

use sqlx::PgPool;
use std::future::Future;

/// Run `body` only if this process holds the leader lock for `worker_name`.
///
/// On non-leader replicas: logs `skipped: leader held by another replica`
/// at `debug` and returns immediately. On infrastructure errors (cannot
/// acquire pool connection, lock query fails): logs at `warn` and skips
/// the cycle — fail-safe rather than fail-open.
pub async fn run_if_leader<F, Fut>(pool: &PgPool, worker_name: &str, body: F)
where
    F: FnOnce() -> Fut,
    Fut: Future<Output = ()>,
{
    let mut conn = match pool.acquire().await {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!(
                worker = worker_name,
                error = %e,
                "advisory lock: pool acquire failed, skipping cycle"
            );
            return;
        }
    };

    let try_lock: Result<(bool,), _> =
        sqlx::query_as("SELECT pg_try_advisory_lock(hashtext($1)::bigint)")
            .bind(worker_name)
            .fetch_one(&mut *conn)
            .await;

    let acquired = match try_lock {
        Ok((b,)) => b,
        Err(e) => {
            tracing::warn!(
                worker = worker_name,
                error = %e,
                "advisory lock: try_lock query failed, skipping cycle"
            );
            return;
        }
    };

    if !acquired {
        tracing::debug!(
            worker = worker_name,
            "skipped: leader held by another replica"
        );
        return;
    }

    body().await;

    if let Err(e) = sqlx::query("SELECT pg_advisory_unlock(hashtext($1)::bigint)")
        .bind(worker_name)
        .execute(&mut *conn)
        .await
    {
        tracing::warn!(
            worker = worker_name,
            error = %e,
            "advisory lock: unlock failed; lock will release when pool connection closes"
        );
    }
}
