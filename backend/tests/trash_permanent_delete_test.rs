//! Service-layer tests for #948 — `trash_service::permanent_delete`.
//!
//! The permanent-delete path is irreversible (it erases encrypted documents
//! from storage), so the critical property is that it **fails closed** on a
//! site-less (orphaned) content row: with no site to authorize against, the
//! only safe answer is `404`, never a silent hard delete. The old inline
//! handler looped over a possibly-empty `site_ids` (a no-op permission check)
//! and deleted anyway — this exercises the service entry point directly to lock
//! the hole shut and to prove the happy path still gates + deletes.

mod common;

use std::sync::Arc;

use serial_test::serial;
use sqlx::PgPool;
use uuid::Uuid;

use forja::guards::actor::Actor;
use forja::guards::auth_guard::{AuthSource, AuthenticatedKey};
use forja::models::api_key::ApiKeyPermission;
use forja::models::content::ContentStatus;
use forja::services::content_service::ContentService;
use forja::services::storage::{LocalStorage, StorageBackend};
use forja::services::trash_service;

use common::{create_test_api_key, create_test_site, test_db_pool};

/// An [`Actor`] backed by an Admin API key for `site_id` — enough to clear the
/// `delete` permission gate on every resource.
async fn admin_actor(pool: &PgPool, site_id: Uuid) -> Actor {
    let _ = create_test_api_key(pool, site_id, ApiKeyPermission::Admin).await;
    let key_id: Uuid = sqlx::query_scalar(
        "SELECT id FROM api_keys WHERE site_id = $1 ORDER BY created_at DESC LIMIT 1",
    )
    .bind(site_id)
    .fetch_one(pool)
    .await
    .expect("api_key row");
    let auth = AuthenticatedKey {
        id: key_id,
        permission: ApiKeyPermission::Admin,
        site_id: Some(site_id),
        auth_source: AuthSource::ApiKey,
    };
    Actor::from_authenticated(&auth).expect("actor from API key")
}

/// A throwaway storage backend; the content arms never touch it.
fn noop_storage() -> Arc<dyn StorageBackend> {
    Arc::new(LocalStorage::new(
        std::env::temp_dir().to_string_lossy().to_string(),
        "http://localhost/uploads".to_string(),
    ))
}

/// Seed a soft-deleted blog content row scoped to `site_id`, returning its id.
async fn seed_trashed_blog(pool: &PgPool, site_id: Uuid) -> Uuid {
    let mut conn = pool.acquire().await.unwrap();
    let content_id = ContentService::create_content(
        &mut conn,
        "blog",
        Some(&format!("trash-{}", &Uuid::new_v4().to_string()[..8])),
        &ContentStatus::Draft,
        &[site_id],
        None,
        None,
        Some("test-user"),
    )
    .await
    .expect("create blog content");
    drop(conn);
    ContentService::soft_delete_content(pool, content_id)
        .await
        .expect("soft delete");
    content_id
}

async fn content_row_exists(pool: &PgPool, id: Uuid) -> bool {
    sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM contents WHERE id = $1")
        .bind(id)
        .fetch_one(pool)
        .await
        .expect("count contents")
        > 0
}

// ---------------------------------------------------------------------------
// Tracer bullet: permanent-delete of a site-less (orphaned) content row is
// rejected, not silently deleted.
// ---------------------------------------------------------------------------
#[tokio::test]
#[serial]
async fn permanent_delete_orphaned_content_fails_closed() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let actor = admin_actor(&pool, site_id).await;
    let storage = noop_storage();

    let content_id = seed_trashed_blog(&pool, site_id).await;

    // Orphan the row: drop its `content_sites` link so it belongs to no site.
    sqlx::query("DELETE FROM content_sites WHERE content_id = $1")
        .bind(content_id)
        .execute(&pool)
        .await
        .expect("orphan the content row");

    let result =
        trash_service::permanent_delete(&pool, &actor, &storage, "content", content_id).await;

    // Fail closed: 404, and the row must survive (no silent hard delete).
    let err = result.expect_err("orphaned permanent-delete must be rejected");
    assert_eq!(err.status(), axum::http::StatusCode::NOT_FOUND);
    assert!(
        content_row_exists(&pool, content_id).await,
        "orphaned row must not be permanently deleted without authorization"
    );
}

// ---------------------------------------------------------------------------
// Happy path: a site-scoped trashed content row is gated on `delete` and then
// permanently removed.
// ---------------------------------------------------------------------------
#[tokio::test]
#[serial]
async fn permanent_delete_site_scoped_content_succeeds() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let actor = admin_actor(&pool, site_id).await;
    let storage = noop_storage();

    let content_id = seed_trashed_blog(&pool, site_id).await;

    trash_service::permanent_delete(&pool, &actor, &storage, "content", content_id)
        .await
        .expect("authorized permanent-delete succeeds");

    assert!(
        !content_row_exists(&pool, content_id).await,
        "authorized permanent-delete must remove the row"
    );
}
