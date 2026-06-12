//! DB-level tests for the GDPR export / account-erasure queries extracted
//! from the auth and clerk_user handlers into `repos::user_data_repo`, plus
//! the membership lookups extracted from the site_membership handler.
//!
//! Every repo function is executed against the real schema — a wrong table
//! or column name (the class of bug that hid in the handlers, e.g.
//! `UPDATE content` vs the actual `contents` table) fails here.

mod common;

use sqlx::PgPool;
use uuid::Uuid;

use forja::models::api_key::{ApiKey, ApiKeyPermission};
use forja::models::site_membership::{SiteMembership, SiteRole};
use forja::repos::user_data_repo;

async fn insert_content_authored_by(pool: &PgPool, clerk_user_id: &str, deleted: bool) -> Uuid {
    let content_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO contents (id, entity_type_id, environment_id, status, created_by, is_deleted)
        SELECT $1,
               (SELECT id FROM entity_types WHERE name = 'blog' LIMIT 1),
               (SELECT id FROM environments ORDER BY created_at LIMIT 1),
               'draft', $2, $3
        "#,
    )
    .bind(content_id)
    .bind(clerk_user_id)
    .bind(deleted)
    .execute(pool)
    .await
    .expect("insert content");
    content_id
}

#[tokio::test]
async fn anonymize_authored_content_nulls_created_by() {
    let pool = common::test_db_pool().await;
    let clerk_id = format!("clerk_anon_{}", Uuid::new_v4());
    let content_id = insert_content_authored_by(&pool, &clerk_id, false).await;

    user_data_repo::anonymize_authored_content(&pool, &clerk_id)
        .await
        .expect("anonymize authored content");

    let created_by: Option<String> =
        sqlx::query_scalar("SELECT created_by FROM contents WHERE id = $1")
            .bind(content_id)
            .fetch_one(&pool)
            .await
            .expect("fetch content");
    assert_eq!(created_by, None);
}

#[tokio::test]
async fn anonymize_user_records_clears_references_and_system_admin() {
    let pool = common::test_db_pool().await;
    let site_id = common::create_test_site(&pool).await;
    let user_id = Uuid::new_v4();
    let clerk_id = format!("clerk_erase_{}", Uuid::new_v4());

    ApiKey::create(
        &pool,
        "erasure-test-key",
        None,
        ApiKeyPermission::Read,
        site_id,
        Some(user_id),
        None,
        None,
        None,
        None,
        None,
        Some(user_id),
        None,
        None,
        None,
    )
    .await
    .expect("create api key");
    sqlx::query("INSERT INTO system_admins (clerk_user_id) VALUES ($1)")
        .bind(&clerk_id)
        .execute(&pool)
        .await
        .expect("insert system admin");

    user_data_repo::anonymize_user_records(&pool, &clerk_id, user_id)
        .await
        .expect("anonymize user records");

    let dangling: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM api_keys WHERE user_id = $1 OR created_by = $1")
            .bind(user_id)
            .fetch_one(&pool)
            .await
            .expect("count api keys");
    assert_eq!(dangling, 0);

    let admin_rows: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM system_admins WHERE clerk_user_id = $1")
            .bind(&clerk_id)
            .fetch_one(&pool)
            .await
            .expect("count system admins");
    assert_eq!(admin_rows, 0);
}

#[tokio::test]
async fn authored_content_counts_ignore_soft_deleted_rows() {
    let pool = common::test_db_pool().await;
    let clerk_id = format!("clerk_counts_{}", Uuid::new_v4());
    insert_content_authored_by(&pool, &clerk_id, false).await;
    insert_content_authored_by(&pool, &clerk_id, true).await;

    let counts = user_data_repo::authored_content_counts(&pool, &clerk_id)
        .await
        .expect("authored counts");

    assert_eq!(counts.blogs, 1);
    assert_eq!(counts.pages, 0);
    assert_eq!(counts.documents, 0);
    assert_eq!(counts.legal_docs, 0);
}

#[tokio::test]
async fn export_row_queries_run_against_the_real_schema() {
    let pool = common::test_db_pool().await;
    let unknown_user = Uuid::new_v4();

    let api_keys = user_data_repo::api_keys_for_user(&pool, unknown_user)
        .await
        .expect("api keys export query");
    assert!(api_keys.is_empty());

    let history = user_data_repo::change_history_for_user(&pool, unknown_user, 1000)
        .await
        .expect("change history export query");
    assert!(history.is_empty());
}

#[tokio::test]
async fn membership_lookup_is_scoped_to_the_site() {
    let pool = common::test_db_pool().await;
    let site_a = common::create_test_site(&pool).await;
    let site_b = common::create_test_site(&pool).await;
    let clerk_id = format!("clerk_member_{}", Uuid::new_v4());

    let membership = SiteMembership::create(&pool, &clerk_id, site_a, &SiteRole::Viewer, None)
        .await
        .expect("create membership");

    let cross_site = SiteMembership::find_by_id_and_site(&pool, membership.id, site_b)
        .await
        .expect("cross-site lookup");
    assert!(
        cross_site.is_none(),
        "membership must not resolve via another site"
    );

    let same_site = SiteMembership::find_by_id_and_site(&pool, membership.id, site_a)
        .await
        .expect("same-site lookup");
    assert_eq!(same_site.map(|m| m.id), Some(membership.id));
}

#[tokio::test]
async fn membership_summaries_join_site_metadata() {
    let pool = common::test_db_pool().await;
    let site_id = common::create_test_site(&pool).await;
    let clerk_id = format!("clerk_summary_{}", Uuid::new_v4());

    SiteMembership::create(&pool, &clerk_id, site_id, &SiteRole::Editor, None)
        .await
        .expect("create membership");

    let summaries = SiteMembership::find_summaries_for_user(&pool, &clerk_id)
        .await
        .expect("summaries");
    assert_eq!(summaries.len(), 1);
    assert_eq!(summaries[0].site_id, site_id);

    let count = SiteMembership::count_for_site(&pool, site_id)
        .await
        .expect("count for site");
    assert_eq!(count, 1);
}
