//! Tests for the user-facing PII inventory (GDPR Art. 15 transparency view):
//! `GET /auth/pii-inventory` renders the built-in PII registry together with
//! the calling user's live record count per identity-bearing field.

mod common;

use sqlx::PgPool;
use uuid::Uuid;

use forja::models::builtin_pii::REGISTRY;
use forja::models::site_membership::{SiteMembership, SiteRole};
use forja::repos::user_data_repo;

async fn insert_content_authored_by(pool: &PgPool, clerk_user_id: &str) {
    sqlx::query(
        r#"
        INSERT INTO contents (id, entity_type_id, environment_id, status, created_by)
        SELECT $1,
               (SELECT id FROM entity_types WHERE name = 'blog' LIMIT 1),
               (SELECT id FROM environments ORDER BY created_at LIMIT 1),
               'draft', $2
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(clerk_user_id)
    .execute(pool)
    .await
    .expect("insert content");
}

#[tokio::test]
async fn pii_record_counts_cover_every_registry_field() {
    let pool = common::test_db_pool().await;
    let clerk_id = format!("clerk_inv_{}", Uuid::new_v4());

    let counts = user_data_repo::pii_record_counts(&pool, &clerk_id, Uuid::new_v4())
        .await
        .expect("pii record counts");

    for entity in REGISTRY {
        for field in entity.fields {
            assert!(
                counts
                    .iter()
                    .any(|c| c.table == entity.table && c.field == field.field),
                "registry field {}.{} has no count query — registry and \
                 pii_record_counts drifted apart",
                entity.table,
                field.field,
            );
        }
    }
}

#[tokio::test]
async fn pii_record_counts_reflect_the_users_rows() {
    let pool = common::test_db_pool().await;
    let site_id = common::create_test_site(&pool).await;
    let clerk_id = format!("clerk_inv_{}", Uuid::new_v4());

    insert_content_authored_by(&pool, &clerk_id).await;
    SiteMembership::create(&pool, &clerk_id, site_id, &SiteRole::Viewer, None)
        .await
        .expect("create membership");

    let counts = user_data_repo::pii_record_counts(&pool, &clerk_id, Uuid::new_v4())
        .await
        .expect("pii record counts");

    let count_of = |table: &str, field: &str| {
        counts
            .iter()
            .find(|c| c.table == table && c.field == field)
            .map(|c| c.record_count)
            .unwrap_or_default()
    };

    assert_eq!(count_of("contents", "created_by"), 1);
    assert_eq!(count_of("site_memberships", "clerk_user_id"), 1);
    assert_eq!(count_of("contents", "deleted_by"), 0);
}

#[tokio::test]
async fn pii_inventory_endpoint_renders_registry_without_counts_for_api_keys() {
    let ctx = common::test_context().await;
    let site_id = common::create_test_site(&ctx.pool).await;
    let key = common::create_test_api_key(
        &ctx.pool,
        site_id,
        forja::models::api_key::ApiKeyPermission::Read,
    )
    .await;

    let response = ctx
        .server
        .get("/api/v1/auth/pii-inventory")
        .add_header("x-api-key", key.as_str())
        .await;
    response.assert_status_ok();

    let body: serde_json::Value = response.json();
    let entities = body["entities"].as_array().expect("entities array");
    assert_eq!(entities.len(), REGISTRY.len());

    // API-key actors are not a person Forja stores rows about — counts are null.
    let first_field = &entities[0]["fields"][0];
    assert!(first_field["record_count"].is_null());
    assert!(first_field["purpose"].is_string());
    assert!(first_field["legal_basis"].is_string());
    assert!(first_field["retention_behavior"].is_string());
}
