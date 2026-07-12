//! DB-level tests for issue #19: built-in PII classification, the per-site
//! `data_retention_days` purge, RoPA built-in entities, and account-deletion
//! erasure of authored-content identity columns.
//!
//! Pattern follows `user_data_repo_test.rs`: every statement runs against the
//! real schema so wrong table/column names fail here, not in production.

mod common;

use chrono::{Duration, Utc};
use serial_test::serial;
use sqlx::PgPool;
use uuid::Uuid;

use forja::models::site_membership::{SiteMembership, SiteRole};
use forja::models::site_settings::{KEY_DATA_RETENTION_DAYS, SiteSetting};
use forja::repos::user_data_repo;

// ── Helpers ──────────────────────────────────────────────────────────────

async fn insert_content(
    pool: &PgPool,
    created_by: &str,
    updated_by: Option<&str>,
    deleted_by: Option<&str>,
) -> Uuid {
    let content_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO contents (id, entity_type_id, environment_id, status,
                              created_by, updated_by, deleted_by, is_deleted)
        SELECT $1,
               (SELECT id FROM entity_types WHERE name = 'blog' LIMIT 1),
               (SELECT id FROM environments ORDER BY created_at LIMIT 1),
               'draft', $2, $3, $4, FALSE
        "#,
    )
    .bind(content_id)
    .bind(created_by)
    .bind(updated_by)
    .bind(deleted_by)
    .execute(pool)
    .await
    .expect("insert content");
    content_id
}

async fn content_identity(
    pool: &PgPool,
    id: Uuid,
) -> (Option<String>, Option<String>, Option<String>) {
    sqlx::query_as("SELECT created_by, updated_by, deleted_by FROM contents WHERE id = $1")
        .bind(id)
        .fetch_one(pool)
        .await
        .expect("fetch content identity")
}

async fn insert_audit_log(pool: &PgPool, site_id: Uuid, age_days: i64) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO audit_logs (id, site_id, action, entity_type, entity_id, created_at)
        VALUES ($1, $2, 'update', 'test_entity', $3, $4)
        "#,
    )
    .bind(id)
    .bind(site_id)
    .bind(Uuid::new_v4())
    .bind(Utc::now() - Duration::days(age_days))
    .execute(pool)
    .await
    .expect("insert audit log");
    id
}

async fn insert_change_history(pool: &PgPool, site_id: Uuid, age_days: i64) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO change_history (id, site_id, entity_type, entity_id, field_name, changed_at)
        VALUES ($1, $2, 'test_entity', $3, 'title', $4)
        "#,
    )
    .bind(id)
    .bind(site_id)
    .bind(Uuid::new_v4())
    .bind(Utc::now() - Duration::days(age_days))
    .execute(pool)
    .await
    .expect("insert change history");
    id
}

async fn row_exists(pool: &PgPool, table: &str, id: Uuid) -> bool {
    let count: i64 = sqlx::query_scalar(sqlx::AssertSqlSafe(format!(
        "SELECT COUNT(*) FROM {table} WHERE id = $1"
    )))
    .bind(id)
    .fetch_one(pool)
    .await
    .expect("count rows");
    count > 0
}

// ── (a) Retention purge ──────────────────────────────────────────────────

#[tokio::test]
#[serial]
async fn tracer_purge_deletes_only_expired_rows_and_only_where_retention_is_set() {
    let pool = common::test_db_pool().await;
    let site_with_retention = common::create_test_site(&pool).await;
    let site_without_retention = common::create_test_site(&pool).await;

    SiteSetting::upsert(
        &pool,
        site_with_retention,
        KEY_DATA_RETENTION_DAYS,
        serde_json::json!(30),
        false,
    )
    .await
    .expect("set retention");

    // Rows past the 30-day retention but well inside the 365-day audit default.
    let expired_audit = insert_audit_log(&pool, site_with_retention, 60).await;
    let fresh_audit = insert_audit_log(&pool, site_with_retention, 1).await;
    let expired_history = insert_change_history(&pool, site_with_retention, 60).await;
    let fresh_history = insert_change_history(&pool, site_with_retention, 1).await;

    let other_audit = insert_audit_log(&pool, site_without_retention, 60).await;
    let other_history = insert_change_history(&pool, site_without_retention, 60).await;

    forja::services::audit_cleanup::run_cleanup(&pool, 365).await;

    assert!(
        !row_exists(&pool, "audit_logs", expired_audit).await,
        "audit row older than the site retention must be purged"
    );
    assert!(
        !row_exists(&pool, "change_history", expired_history).await,
        "change-history row older than the site retention must be purged"
    );
    assert!(
        row_exists(&pool, "audit_logs", fresh_audit).await,
        "audit row inside the retention window must survive"
    );
    assert!(
        row_exists(&pool, "change_history", fresh_history).await,
        "change-history row inside the retention window must survive"
    );
    assert!(
        row_exists(&pool, "audit_logs", other_audit).await,
        "site without data_retention_days keeps rows inside the system default"
    );
    assert!(
        row_exists(&pool, "change_history", other_history).await,
        "site without data_retention_days keeps rows inside the system default"
    );
}

// ── (b) Account-deletion erasure of authored-content identity ────────────

#[tokio::test]
async fn tracer_account_deletion_anonymizes_all_authored_identity_columns() {
    let pool = common::test_db_pool().await;
    let clerk_id = format!("clerk_erase_{}", Uuid::new_v4());
    let other_clerk = format!("clerk_other_{}", Uuid::new_v4());

    let mine = insert_content(&pool, &clerk_id, Some(&clerk_id), Some(&clerk_id)).await;
    let theirs = insert_content(&pool, &other_clerk, Some(&other_clerk), None).await;
    // Mixed attribution: created by someone else, last updated by the erased user.
    let mixed = insert_content(&pool, &other_clerk, Some(&clerk_id), None).await;

    user_data_repo::erase_user_records(&pool, &clerk_id, Uuid::new_v4())
        .await
        .expect("anonymize user records");

    assert_eq!(content_identity(&pool, mine).await, (None, None, None));
    assert_eq!(
        content_identity(&pool, theirs).await,
        (Some(other_clerk.clone()), Some(other_clerk.clone()), None),
        "other users' attribution must be untouched"
    );
    assert_eq!(
        content_identity(&pool, mixed).await,
        (Some(other_clerk.clone()), None, None),
        "only the erased user's identity is removed from mixed rows"
    );
}

#[tokio::test]
async fn banned_user_purge_anonymizes_updated_by_and_deleted_by_too() {
    let pool = common::test_db_pool().await;
    let clerk_id = format!("clerk_banned_{}", Uuid::new_v4());

    let content = insert_content(&pool, &clerk_id, Some(&clerk_id), Some(&clerk_id)).await;

    user_data_repo::anonymize_authored_content(&pool, &clerk_id)
        .await
        .expect("anonymize authored content");

    assert_eq!(content_identity(&pool, content).await, (None, None, None));
}

#[tokio::test]
async fn account_deletion_erases_membership_invites_site_provenance_and_notifications() {
    let pool = common::test_db_pool().await;
    let site_id = common::create_test_site(&pool).await;
    let clerk_id = format!("clerk_full_{}", Uuid::new_v4());
    let invitee = format!("clerk_invitee_{}", Uuid::new_v4());

    // The erased user invited someone else (their id lives on the invitee's row).
    SiteMembership::create(&pool, &invitee, site_id, &SiteRole::Viewer, Some(&clerk_id))
        .await
        .expect("create membership");
    sqlx::query("UPDATE sites SET created_by = $1 WHERE id = $2")
        .bind(&clerk_id)
        .bind(site_id)
        .execute(&pool)
        .await
        .expect("set site creator");
    sqlx::query(
        r#"
        INSERT INTO notifications (site_id, recipient_clerk_id, actor_clerk_id,
                                   notification_type, entity_type, entity_id, title)
        VALUES ($1, $2, $3, 'review_requested', 'blog', $4, 'for the erased user'),
               ($1, $3, $2, 'review_requested', 'blog', $4, 'acted by the erased user')
        "#,
    )
    .bind(site_id)
    .bind(&clerk_id)
    .bind(&invitee)
    .bind(Uuid::new_v4())
    .execute(&pool)
    .await
    .expect("insert notifications");

    user_data_repo::erase_user_records(&pool, &clerk_id, Uuid::new_v4())
        .await
        .expect("anonymize user records");

    let invited_by: Option<String> = sqlx::query_scalar(
        "SELECT invited_by FROM site_memberships WHERE clerk_user_id = $1 AND site_id = $2",
    )
    .bind(&invitee)
    .bind(site_id)
    .fetch_one(&pool)
    .await
    .expect("fetch invited_by");
    assert_eq!(invited_by, None, "inviter identity must be anonymized");

    let site_creator: Option<String> =
        sqlx::query_scalar("SELECT created_by FROM sites WHERE id = $1")
            .bind(site_id)
            .fetch_one(&pool)
            .await
            .expect("fetch site creator");
    assert_eq!(site_creator, None, "site provenance must be anonymized");

    let received: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM notifications WHERE recipient_clerk_id = $1")
            .bind(&clerk_id)
            .fetch_one(&pool)
            .await
            .expect("count received");
    assert_eq!(received, 0, "the erased user's inbox must be deleted");

    let acted: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM notifications WHERE actor_clerk_id = $1")
            .bind(&clerk_id)
            .fetch_one(&pool)
            .await
            .expect("count acted");
    assert_eq!(
        acted, 0,
        "actor identity on others' notifications must be anonymized"
    );

    let invitee_inbox: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM notifications WHERE recipient_clerk_id = $1")
            .bind(&invitee)
            .fetch_one(&pool)
            .await
            .expect("count invitee inbox");
    assert_eq!(invitee_inbox, 1, "other users keep their notifications");
}

// ── (c) RoPA includes built-in entities ──────────────────────────────────

#[tokio::test]
async fn tracer_ropa_report_includes_builtin_entities_and_retention_setting() {
    let pool = common::test_db_pool().await;
    let site_id = common::create_test_site(&pool).await;

    let report = forja::models::ropa::generate(&pool, site_id)
        .await
        .expect("generate ropa");

    assert!(
        !report.builtin_entities.is_empty(),
        "RoPA must document built-in entities even with zero custom types"
    );
    let contents = report
        .builtin_entities
        .iter()
        .find(|e| e.table == "contents")
        .expect("contents spine must be documented");
    for field in ["created_by", "updated_by", "deleted_by"] {
        let entry = contents
            .fields
            .iter()
            .find(|f| f.field == field)
            .unwrap_or_else(|| panic!("contents.{field} must be classified"));
        assert!(!entry.purpose.is_empty());
        assert!(
            entry.legal_basis.contains("6(1)"),
            "legal basis must cite GDPR Art. 6(1)"
        );
    }
    assert_eq!(
        report.data_retention_days, None,
        "retention disabled by default"
    );

    SiteSetting::upsert(
        &pool,
        site_id,
        KEY_DATA_RETENTION_DAYS,
        serde_json::json!(90),
        false,
    )
    .await
    .expect("set retention");
    let report = forja::models::ropa::generate(&pool, site_id)
        .await
        .expect("generate ropa with retention");
    assert_eq!(report.data_retention_days, Some(90));
}

// ── (d) Retention setting accessor ───────────────────────────────────────

#[tokio::test]
async fn data_retention_days_accessor_round_trips_and_null_disables() {
    let pool = common::test_db_pool().await;
    let site_id = common::create_test_site(&pool).await;

    let initial = SiteSetting::data_retention_days(&pool, site_id)
        .await
        .expect("read default");
    assert_eq!(initial, None, "retention is disabled until a site opts in");

    SiteSetting::upsert(
        &pool,
        site_id,
        KEY_DATA_RETENTION_DAYS,
        serde_json::json!(180),
        false,
    )
    .await
    .expect("set retention");
    let set = SiteSetting::data_retention_days(&pool, site_id)
        .await
        .expect("read configured");
    assert_eq!(set, Some(180));

    SiteSetting::upsert(
        &pool,
        site_id,
        KEY_DATA_RETENTION_DAYS,
        serde_json::Value::Null,
        false,
    )
    .await
    .expect("clear retention");
    let cleared = SiteSetting::data_retention_days(&pool, site_id)
        .await
        .expect("read cleared");
    assert_eq!(cleared, None, "explicit null disables retention again");
}
