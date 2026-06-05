//! Integration tests for `services::worker_lock::run_if_leader`.
//!
//! Exercises the real Postgres advisory-lock semantics that protect
//! workers from double-firing across replicas. Uses two independent
//! `PgPool`s pointed at the same test DB to simulate two replicas.
//!
//! Lock names are uuid-suffixed so tests can run in parallel without
//! colliding on the same advisory-lock slot.

mod common;

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::time::Duration;

use forja::services::worker_lock::run_if_leader;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use uuid::Uuid;

/// A second pool against the same test DB — represents a second replica.
async fn second_pool() -> PgPool {
    let db_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://forja:forja@localhost:5432/forja_test".to_string());
    PgPoolOptions::new()
        .max_connections(2)
        .connect(&db_url)
        .await
        .expect("second pool: connect to test DB")
}

fn unique_worker_name() -> String {
    format!("test_worker_{}", Uuid::new_v4().simple())
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn concurrent_calls_only_one_runs_body() {
    let pool_a = common::test_db_pool().await;
    let pool_b = second_pool().await;
    let name = unique_worker_name();
    let counter = Arc::new(AtomicU32::new(0));

    // Slow body so both tasks are sure to race for the lock.
    let body = |c: Arc<AtomicU32>| async move {
        tokio::time::sleep(Duration::from_millis(200)).await;
        c.fetch_add(1, Ordering::SeqCst);
    };

    let (c1, c2) = (counter.clone(), counter.clone());
    let n1 = name.clone();
    let n2 = name.clone();
    let task_a = tokio::spawn(async move { run_if_leader(&pool_a, &n1, || body(c1)).await });
    let task_b = tokio::spawn(async move { run_if_leader(&pool_b, &n2, || body(c2)).await });

    task_a.await.unwrap();
    task_b.await.unwrap();

    assert_eq!(
        counter.load(Ordering::SeqCst),
        1,
        "exactly one replica should have run the body"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn different_worker_names_do_not_block_each_other() {
    let pool_a = common::test_db_pool().await;
    let pool_b = second_pool().await;
    let name_a = unique_worker_name();
    let name_b = unique_worker_name();
    let counter = Arc::new(AtomicU32::new(0));

    let body = |c: Arc<AtomicU32>| async move {
        tokio::time::sleep(Duration::from_millis(100)).await;
        c.fetch_add(1, Ordering::SeqCst);
    };

    let (c1, c2) = (counter.clone(), counter.clone());
    let task_a = tokio::spawn(async move { run_if_leader(&pool_a, &name_a, || body(c1)).await });
    let task_b = tokio::spawn(async move { run_if_leader(&pool_b, &name_b, || body(c2)).await });

    task_a.await.unwrap();
    task_b.await.unwrap();

    assert_eq!(
        counter.load(Ordering::SeqCst),
        2,
        "different worker names should not contend"
    );
}

#[tokio::test]
async fn sequential_calls_with_same_name_both_run() {
    let pool = common::test_db_pool().await;
    let name = unique_worker_name();
    let counter = Arc::new(AtomicU32::new(0));

    let c1 = counter.clone();
    run_if_leader(&pool, &name, || async move {
        c1.fetch_add(1, Ordering::SeqCst);
    })
    .await;

    let c2 = counter.clone();
    run_if_leader(&pool, &name, || async move {
        c2.fetch_add(1, Ordering::SeqCst);
    })
    .await;

    assert_eq!(
        counter.load(Ordering::SeqCst),
        2,
        "lock must be released between sequential calls"
    );
}

#[tokio::test]
async fn lock_released_after_body_so_other_replica_can_acquire() {
    let pool_a = common::test_db_pool().await;
    let pool_b = second_pool().await;
    let name = unique_worker_name();
    let counter = Arc::new(AtomicU32::new(0));

    // First replica runs and completes — lock should be released.
    let c1 = counter.clone();
    run_if_leader(&pool_a, &name, || async move {
        c1.fetch_add(1, Ordering::SeqCst);
    })
    .await;

    // Second replica should now acquire freely.
    let c2 = counter.clone();
    run_if_leader(&pool_b, &name, || async move {
        c2.fetch_add(1, Ordering::SeqCst);
    })
    .await;

    assert_eq!(
        counter.load(Ordering::SeqCst),
        2,
        "second replica must be able to acquire after first releases"
    );
}
