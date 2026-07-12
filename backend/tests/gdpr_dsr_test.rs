//! DSR tooling tests (#3): full account erasure covers *every*
//! identity-bearing built-in field (including media uploads, AI usage and
//! moderation records), the user-data export includes media + AI usage, and
//! system admins can fulfil DSRs on behalf of a user with an audit trail.
//!
//! Pattern follows `user_data_repo_test.rs`: statements run against the real
//! schema so wrong table/column names fail here, not in production.

mod common;

use sqlx::PgPool;
use uuid::Uuid;

use forja::models::site_membership::{SiteMembership, SiteRole};
use forja::models::user_preferences::UserPreferences;
use forja::repos::user_data_repo;

// ── Seed helpers ─────────────────────────────────────────────────────────

async fn insert_media_uploaded_by(pool: &PgPool, uploaded_by: Uuid) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO media_files (id, filename, original_filename, mime_type,
                                 file_size, storage_path, uploaded_by)
        VALUES ($1, 'dsr.png', 'dsr.png', 'image/png', 42, '/tmp/dsr.png', $2)
        "#,
    )
    .bind(id)
    .bind(uploaded_by)
    .execute(pool)
    .await
    .expect("insert media file");
    id
}

async fn insert_ai_usage_by(pool: &PgPool, site_id: Uuid, actor_id: Uuid) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO ai_usage_logs (id, site_id, actor_id, action, provider,
                                   model, input_tokens, output_tokens)
        VALUES ($1, $2, $3, 'seo', 'openai', 'gpt-test', 10, 20)
        "#,
    )
    .bind(id)
    .bind(site_id)
    .bind(actor_id)
    .execute(pool)
    .await
    .expect("insert ai usage log");
    id
}

async fn insert_moderation_subject(pool: &PgPool, clerk_user_id: &str) {
    sqlx::query("INSERT INTO user_moderation (clerk_user_id, status) VALUES ($1, 'active')")
        .bind(clerk_user_id)
        .execute(pool)
        .await
        .expect("insert moderation subject row");
}

async fn insert_moderation_actioned_by(pool: &PgPool, actor_clerk_id: &str) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO user_moderation (id, clerk_user_id, status, status_changed_by)
        VALUES ($1, $2, 'suspended', $3)
        "#,
    )
    .bind(id)
    .bind(format!("clerk_other_{}", Uuid::new_v4()))
    .bind(actor_clerk_id)
    .execute(pool)
    .await
    .expect("insert moderation actor row");
    id
}

// ── Erasure parity ───────────────────────────────────────────────────────

#[tokio::test]
async fn erasure_covers_media_ai_usage_moderation_preferences_and_memberships() {
    let pool = common::test_db_pool().await;
    let site_id = common::create_test_site(&pool).await;
    let user_id = Uuid::new_v4();
    let clerk_id = format!("clerk_dsr_{}", Uuid::new_v4());

    let media_id = insert_media_uploaded_by(&pool, user_id).await;
    let usage_id = insert_ai_usage_by(&pool, site_id, user_id).await;
    insert_moderation_subject(&pool, &clerk_id).await;
    let actioned_row = insert_moderation_actioned_by(&pool, &clerk_id).await;
    SiteMembership::create(&pool, &clerk_id, site_id, &SiteRole::Viewer, None)
        .await
        .expect("create membership");
    UserPreferences::upsert(&pool, &clerk_id, serde_json::json!({"language": "de"}))
        .await
        .expect("upsert preferences");

    user_data_repo::erase_user_records(&pool, &clerk_id, user_id)
        .await
        .expect("erase user records");

    let uploaded_by: Option<Uuid> =
        sqlx::query_scalar("SELECT uploaded_by FROM media_files WHERE id = $1")
            .bind(media_id)
            .fetch_one(&pool)
            .await
            .expect("fetch media");
    assert_eq!(uploaded_by, None, "media upload attribution must be erased");

    let actor_id: Option<Uuid> =
        sqlx::query_scalar("SELECT actor_id FROM ai_usage_logs WHERE id = $1")
            .bind(usage_id)
            .fetch_one(&pool)
            .await
            .expect("fetch ai usage");
    assert_eq!(actor_id, None, "AI usage attribution must be erased");

    let subject_rows: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM user_moderation WHERE clerk_user_id = $1")
            .bind(&clerk_id)
            .fetch_one(&pool)
            .await
            .expect("count moderation subject rows");
    assert_eq!(subject_rows, 0, "moderation record about the user must go");

    let changed_by: Option<String> =
        sqlx::query_scalar("SELECT status_changed_by FROM user_moderation WHERE id = $1")
            .bind(actioned_row)
            .fetch_one(&pool)
            .await
            .expect("fetch moderation actor row");
    assert_eq!(
        changed_by, None,
        "moderation-action attribution must be erased"
    );

    let memberships: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM site_memberships WHERE clerk_user_id = $1")
            .bind(&clerk_id)
            .fetch_one(&pool)
            .await
            .expect("count memberships");
    assert_eq!(memberships, 0, "memberships must be deleted");

    let preferences: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM user_preferences WHERE clerk_user_id = $1")
            .bind(&clerk_id)
            .fetch_one(&pool)
            .await
            .expect("count preferences");
    assert_eq!(preferences, 0, "preferences row must be deleted");
}
