//! Integration tests for `services::audited_mutation`.
//!
//! `AuditedMutation` is the narrower sibling of `publish_pipeline` —
//! it handles audit + webhook ordering for non-content sibling entities
//! (legal groups, document folders, navigation, taxonomies, sites).
//! Issue #621.
//!
//! Prereq: same as `integration_tests.rs` — a `forja_test` PostgreSQL
//! database is reachable via `TEST_DATABASE_URL`.

mod common;

use serial_test::serial;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use forja::models::audit::AuditAction;
use forja::services::audited_mutation::{self, MutationEvent};

use common::{create_test_site, test_db_pool};

async fn seed_webhook(pool: &PgPool, site_id: Uuid, events: Vec<String>) {
    sqlx::query(
        r#"INSERT INTO webhooks (site_id, url, secret, events, debounce_seconds, is_active)
           VALUES ($1, $2, $3, $4, 0, TRUE)"#,
    )
    .bind(site_id)
    .bind("https://example.invalid/hook")
    .bind("whsec_audited_mutation_test")
    .bind(events)
    .execute(pool)
    .await
    .expect("webhook insert succeeds");
}

async fn fetch_audit_id(pool: &PgPool, entity_id: Uuid, entity_type: &str) -> Uuid {
    sqlx::query("SELECT id FROM audit_logs WHERE entity_id = $1 AND entity_type = $2")
        .bind(entity_id)
        .bind(entity_type)
        .fetch_one(pool)
        .await
        .expect("audit row exists")
        .get::<Uuid, _>(0)
}

async fn fetch_audit_created_at(
    pool: &PgPool,
    entity_id: Uuid,
    entity_type: &str,
) -> chrono::DateTime<chrono::Utc> {
    sqlx::query("SELECT created_at FROM audit_logs WHERE entity_id = $1 AND entity_type = $2")
        .bind(entity_id)
        .bind(entity_type)
        .fetch_one(pool)
        .await
        .expect("audit row exists")
        .get::<chrono::DateTime<chrono::Utc>, _>(0)
}

async fn fetch_webhook_envelope(pool: &PgPool, entity_id: Uuid) -> serde_json::Value {
    sqlx::query(
        r#"SELECT payload FROM webhook_retry_queue
           WHERE payload->>'entity_id' = $1::text
           ORDER BY created_at ASC LIMIT 1"#,
    )
    .bind(entity_id)
    .fetch_one(pool)
    .await
    .expect("webhook queue row exists")
    .get::<serde_json::Value, _>(0)
}

async fn fetch_webhook_created_at(pool: &PgPool, entity_id: Uuid) -> chrono::DateTime<chrono::Utc> {
    sqlx::query(
        r#"SELECT created_at FROM webhook_retry_queue
           WHERE payload->>'entity_id' = $1::text
           ORDER BY created_at ASC LIMIT 1"#,
    )
    .bind(entity_id)
    .fetch_one(pool)
    .await
    .expect("webhook queue row exists")
    .get::<chrono::DateTime<chrono::Utc>, _>(0)
}

// ── Tracer bullet ────────────────────────────────────────────────────────

#[tokio::test]
#[serial]
async fn audited_mutation_writes_audit_then_webhook_with_audit_id_reference() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook(&pool, site_id, vec!["legal.created".to_string()]).await;

    let entity_id = Uuid::new_v4();
    let event = MutationEvent {
        site_id: Some(site_id),
        user_id: None,
        action: AuditAction::Create,
        entity_type: "legal_group",
        entity_id,
        webhook_event: Some("legal.created".to_string()),
        webhook_payload: serde_json::json!({"type": "legal_group"}),
        audit_metadata: None,
        change_diff: None,
    };

    let returned_audit_id = audited_mutation::execute(&pool, event)
        .await
        .expect("audit insert returns id");

    let audit_id = fetch_audit_id(&pool, entity_id, "legal_group").await;
    assert_eq!(
        returned_audit_id, audit_id,
        "execute returns the same audit_id that was written"
    );

    let envelope = fetch_webhook_envelope(&pool, entity_id).await;
    let data = envelope.get("data").expect("envelope has data field");
    let payload_audit_id = data
        .get("audit_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok())
        .expect("webhook payload.data.audit_id is a UUID");

    assert_eq!(
        payload_audit_id, audit_id,
        "webhook payload references the audit row id"
    );

    let audit_at = fetch_audit_created_at(&pool, entity_id, "legal_group").await;
    let webhook_at = fetch_webhook_created_at(&pool, entity_id).await;
    assert!(
        audit_at <= webhook_at,
        "audit ({audit_at}) must be written at or before the webhook ({webhook_at})"
    );
}

// ── Audit fields preserved through the seam ──────────────────────────────

#[tokio::test]
#[serial]
async fn audited_mutation_preserves_action_user_and_metadata() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook(&pool, site_id, vec!["legal.updated".to_string()]).await;

    let entity_id = Uuid::new_v4();
    let event = MutationEvent {
        site_id: Some(site_id),
        user_id: None,
        action: AuditAction::Update,
        entity_type: "legal_group",
        entity_id,
        webhook_event: Some("legal.updated".to_string()),
        webhook_payload: serde_json::json!({"type": "legal_group"}),
        audit_metadata: Some(serde_json::json!({"reason": "rename"})),
        change_diff: None,
    };

    audited_mutation::execute(&pool, event).await;

    let row = sqlx::query(
        "SELECT action::text, metadata FROM audit_logs WHERE entity_id = $1 AND entity_type = $2",
    )
    .bind(entity_id)
    .bind("legal_group")
    .fetch_one(&pool)
    .await
    .expect("audit row exists");

    let action: String = row.get(0);
    let metadata: serde_json::Value = row.get(1);
    assert_eq!(action, "update", "action persisted on audit row");
    assert_eq!(
        metadata,
        serde_json::json!({"reason": "rename"}),
        "metadata persisted on audit row"
    );
}
