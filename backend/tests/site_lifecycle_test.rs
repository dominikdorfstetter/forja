//! Site soft-delete → restore → purge lifecycle (issue #711, epic #708).
//!
//! Vertical-slice TDD: the tracer proves the whole soft-delete/restore
//! path; later tests add the expiry window, the grace-window list, the
//! purge cascade, and the HTTP + worker seams.

mod common;

use serial_test::serial;
use sqlx::PgPool;
use uuid::Uuid;

use forja::errors::codes;
use forja::models::site::Site;

use forja::models::api_key::ApiKeyPermission;

use common::{create_test_api_key, create_test_site, test_context, test_db_pool};

async fn count_where(pool: &PgPool, sql: &str, id: Uuid) -> i64 {
    sqlx::query_scalar::<_, i64>(sql)
        .bind(id)
        .fetch_one(pool)
        .await
        .expect("count query succeeds")
}

/// Backdate a soft-deleted site's `deleted_at` to simulate the grace
/// window lapsing without waiting 30 days.
async fn backdate_deletion(pool: &PgPool, id: Uuid, days_ago: i64) {
    sqlx::query("UPDATE sites SET is_deleted = TRUE, deleted_at = NOW() - ($2 || ' days')::interval WHERE id = $1")
        .bind(id)
        .bind(days_ago.to_string())
        .execute(pool)
        .await
        .expect("backdate succeeds");
}

/// Read the raw soft-delete columns, bypassing `find_by_id` (which
/// filters out soft-deleted rows).
async fn raw_delete_state(
    pool: &PgPool,
    id: Uuid,
) -> (bool, Option<chrono::DateTime<chrono::Utc>>) {
    sqlx::query_as::<_, (bool, Option<chrono::DateTime<chrono::Utc>>)>(
        "SELECT is_deleted, deleted_at FROM sites WHERE id = $1",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .expect("site row exists")
}

#[tokio::test]
#[serial]
async fn tracer_site_soft_delete_then_restore_within_window() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    // Soft-delete: row is hidden and the deletion is stamped.
    Site::soft_delete(&pool, site_id)
        .await
        .expect("soft_delete succeeds");
    assert!(
        Site::find_by_id(&pool, site_id).await.is_err(),
        "soft-deleted site must be hidden from find_by_id"
    );
    let (is_deleted, deleted_at) = raw_delete_state(&pool, site_id).await;
    assert!(is_deleted, "is_deleted must be TRUE after soft_delete");
    assert!(
        deleted_at.is_some(),
        "deleted_at must be stamped on soft_delete"
    );

    // Restore within the grace window: site is visible again, stamp cleared.
    let restored = Site::restore(&pool, site_id)
        .await
        .expect("restore within window succeeds");
    assert_eq!(restored.id, site_id);
    assert!(!restored.is_deleted, "restored site must not be deleted");

    let found = Site::find_by_id(&pool, site_id)
        .await
        .expect("restored site is visible again");
    assert_eq!(found.id, site_id);
    let (is_deleted, deleted_at) = raw_delete_state(&pool, site_id).await;
    assert!(!is_deleted, "is_deleted must be FALSE after restore");
    assert!(
        deleted_at.is_none(),
        "deleted_at must be cleared on restore"
    );
}

#[tokio::test]
#[serial]
async fn restore_after_grace_window_returns_410_expired() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    backdate_deletion(&pool, site_id, Site::SOFT_DELETE_RETENTION_DAYS + 1).await;

    let err = Site::restore(&pool, site_id)
        .await
        .expect_err("restore past the grace window must fail");

    assert_eq!(
        err.status().as_u16(),
        410,
        "expired restore is HTTP 410 Gone"
    );
    assert_eq!(err.code(), codes::SITE_RESTORE_EXPIRED);

    // The row is left intact for the purge worker — not restored.
    let (is_deleted, _) = raw_delete_state(&pool, site_id).await;
    assert!(is_deleted, "expired site stays soft-deleted, not restored");
}

#[tokio::test]
#[serial]
async fn restore_unknown_or_live_site_returns_404() {
    let pool = test_db_pool().await;

    // Never-existed id.
    let missing = Site::restore(&pool, Uuid::new_v4())
        .await
        .expect_err("restoring an unknown site fails");
    assert_eq!(missing.status().as_u16(), 404);
    assert_eq!(missing.code(), codes::ENTITY_NOT_FOUND);

    // Live (not soft-deleted) site is not a restore target.
    let site_id = create_test_site(&pool).await;
    let live = Site::restore(&pool, site_id)
        .await
        .expect_err("restoring a live site fails");
    assert_eq!(live.status().as_u16(), 404);
    assert_eq!(live.code(), codes::ENTITY_NOT_FOUND);
}

#[tokio::test]
#[serial]
async fn find_deleted_within_grace_lists_only_in_window_soft_deleted() {
    let pool = test_db_pool().await;
    let live = create_test_site(&pool).await;
    let recent = create_test_site(&pool).await;
    let expired = create_test_site(&pool).await;

    Site::soft_delete(&pool, recent)
        .await
        .expect("soft_delete recent");
    backdate_deletion(&pool, expired, Site::SOFT_DELETE_RETENTION_DAYS + 1).await;

    let deleted = Site::find_deleted_within_grace(&pool)
        .await
        .expect("find_deleted_within_grace succeeds");
    let ids: Vec<Uuid> = deleted.iter().map(|s| s.id).collect();

    assert!(
        ids.contains(&recent),
        "recently deleted site is in the grace window"
    );
    assert!(!ids.contains(&live), "live site is not a deleted site");
    assert!(
        !ids.contains(&expired),
        "expired site is past the grace window"
    );
    assert!(
        deleted
            .iter()
            .all(|s| s.is_deleted && s.deleted_at.is_some()),
        "every listed site is soft-deleted with a stamp"
    );
}

#[tokio::test]
#[serial]
async fn purge_expired_hard_deletes_expired_site_and_cascades() {
    let pool = test_db_pool().await;
    let expired = create_test_site(&pool).await;
    let in_window = create_test_site(&pool).await;

    // Site-scoped child row that must cascade-delete with the site.
    let _key = create_test_api_key(&pool, expired, ApiKeyPermission::Read).await;
    assert_eq!(
        count_where(
            &pool,
            "SELECT COUNT(*) FROM api_keys WHERE site_id = $1",
            expired
        )
        .await,
        1,
        "precondition: the expired site has an api key"
    );

    backdate_deletion(&pool, expired, Site::SOFT_DELETE_RETENTION_DAYS + 1).await;
    Site::soft_delete(&pool, in_window)
        .await
        .expect("soft_delete in-window site");

    let purged = Site::purge_expired(&pool)
        .await
        .expect("purge_expired succeeds");

    assert!(purged.contains(&expired), "expired site id is returned");
    assert!(
        !purged.contains(&in_window),
        "in-window soft-deleted site is not purged"
    );
    assert_eq!(
        count_where(&pool, "SELECT COUNT(*) FROM sites WHERE id = $1", expired).await,
        0,
        "expired site row is hard-deleted"
    );
    assert_eq!(
        count_where(
            &pool,
            "SELECT COUNT(*) FROM api_keys WHERE site_id = $1",
            expired
        )
        .await,
        0,
        "site-scoped child rows cascade-delete with the site"
    );
    assert_eq!(
        count_where(&pool, "SELECT COUNT(*) FROM sites WHERE id = $1", in_window).await,
        1,
        "in-window site is left intact"
    );
}

// ── HTTP surface ────────────────────────────────────────────────────────

#[tokio::test]
#[serial]
async fn http_restore_revives_site_and_writes_audit() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    // site:delete (reused for restore) is Owner-only → Master key maps to Owner.
    let owner = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Master).await;
    Site::soft_delete(&ctx.pool, site_id)
        .await
        .expect("soft_delete");

    let resp = ctx
        .server
        .post(&format!("/api/v1/sites/{site_id}/restore"))
        .add_header("x-api-key", owner.as_str())
        .await;

    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    assert_eq!(body["id"], site_id.to_string());

    // Visible again through the normal endpoint.
    ctx.server
        .get(&format!("/api/v1/sites/{site_id}"))
        .add_header("x-api-key", owner.as_str())
        .await
        .assert_status_ok();

    let audit: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM audit_logs WHERE site_id = $1 AND entity_type = 'site' AND action = 'restore'",
    )
    .bind(site_id)
    .fetch_one(&ctx.pool)
    .await
    .expect("audit count");
    assert!(audit >= 1, "a 'restore' audit event was written");
}

#[tokio::test]
#[serial]
async fn http_restore_forbidden_for_non_owner() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let reader = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;
    Site::soft_delete(&ctx.pool, site_id)
        .await
        .expect("soft_delete");

    let resp = ctx
        .server
        .post(&format!("/api/v1/sites/{site_id}/restore"))
        .add_header("x-api-key", reader.as_str())
        .await;

    assert_eq!(resp.status_code().as_u16(), 403);
    let body: serde_json::Value = resp.json();
    assert_eq!(body["code"], codes::AUTH_INSUFFICIENT_ROLE);
}

#[tokio::test]
#[serial]
async fn http_list_deleted_sites_shows_in_grace_window() {
    let ctx = test_context().await;
    let live = create_test_site(&ctx.pool).await;
    let deleted = create_test_site(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, deleted, ApiKeyPermission::Master).await;
    Site::soft_delete(&ctx.pool, deleted)
        .await
        .expect("soft_delete");

    let resp = ctx
        .server
        .get("/api/v1/sites/deleted")
        .add_header("x-api-key", key.as_str())
        .await;

    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    let ids: Vec<String> = body
        .as_array()
        .expect("array body")
        .iter()
        .map(|s| s["id"].as_str().unwrap_or_default().to_string())
        .collect();
    assert!(
        ids.contains(&deleted.to_string()),
        "soft-deleted site listed"
    );
    assert!(!ids.contains(&live.to_string()), "live site not listed");
}

// ── Purge worker ────────────────────────────────────────────────────────

// `purge_expired_sites` is a global sweep and the test DB is shared
// across parallel test binaries, so this test asserts only on its own
// unique site id — never on global counts. The "in-window site is not
// purged" guarantee is covered deterministically by
// `purge_expired_hard_deletes_expired_site_and_cascades` (set membership
// on its own id).
#[tokio::test]
#[serial]
async fn worker_purges_expired_sites_and_writes_surviving_audit() {
    let pool = test_db_pool().await;
    let expired = create_test_site(&pool).await;
    backdate_deletion(&pool, expired, Site::SOFT_DELETE_RETENTION_DAYS + 1).await;

    let purged = forja::services::trash_cleanup::purge_expired_sites(&pool).await;

    assert!(
        purged >= 1,
        "the global sweep purged at least our expired site"
    );
    assert_eq!(
        count_where(&pool, "SELECT COUNT(*) FROM sites WHERE id = $1", expired).await,
        0,
        "expired site is hard-deleted"
    );

    // The purge audit must be system-level (site_id NULL) — a site-scoped
    // row would be cascade-deleted by the same DELETE FROM sites. Keyed to
    // the unique purged id, so it stays isolation-safe under parallelism.
    let audit: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM audit_logs WHERE site_id IS NULL AND entity_type = 'site' AND entity_id = $1",
    )
    .bind(expired)
    .fetch_one(&pool)
    .await
    .expect("audit count");
    assert_eq!(
        audit, 1,
        "exactly one system-level purge audit row survives the cascade"
    );
}
