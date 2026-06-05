//! #794 — privacy & GDPR controls: RoPA, erasure, retention purge.

mod common;

use common::{create_test_site, test_db_pool};
use forja::dto::custom_entry::CustomEntryRequest;
use forja::dto::custom_type::{
    CreateCustomTypeRequest, CustomContentKind, CustomFieldInput, CustomFieldType,
};
use forja::models::custom_entry::CustomEntry;
use forja::models::custom_type::CustomType;
use forja::models::ropa;
use forja::services::encryption::resolve_key;
use serde_json::{json, Value};
use std::collections::HashMap;
use uuid::Uuid;

fn field(key: &str, ft: CustomFieldType) -> CustomFieldInput {
    CustomFieldInput {
        id: None,
        key: key.into(),
        label: key.into(),
        labels: None,
        field_type: ft,
        required: false,
        localized: false,
        is_title: false,
        is_pii: false,
        data_category: None,
        processing_purpose: None,
        legal_basis: None,
        enum_options: None,
        min: None,
        max: None,
        min_length: None,
        max_length: None,
        pattern: None,
        is_unique: false,
        display_order: 0,
    }
}

async fn contact_type(pool: &sqlx::PgPool, site_id: Uuid, retention_days: Option<i32>) {
    let mut title = field("name", CustomFieldType::Text);
    title.is_title = true;
    title.required = true;
    let mut email = field("email", CustomFieldType::Text);
    email.is_pii = true;
    email.data_category = Some("contact data".into());
    email.processing_purpose = Some("newsletter".into());
    email.legal_basis = Some("consent".into());
    CustomType::create(
        pool,
        site_id,
        Uuid::new_v4(),
        CreateCustomTypeRequest {
            key: "contact".into(),
            name: "Contact".into(),
            retention_days,
            is_publicly_readable: false,
            content_kind: CustomContentKind::Data,
            fields: vec![title, email],
        },
    )
    .await
    .expect("create contact type");
}

fn entry(name: &str, email: &str) -> CustomEntryRequest {
    let mut shared = HashMap::new();
    shared.insert("name".to_string(), Value::from(name));
    shared.insert("email".to_string(), Value::from(email));
    CustomEntryRequest {
        slug: None,
        shared,
        localized: HashMap::new(),
    }
}

#[tokio::test]
async fn tracer_ropa_lists_pii_then_erasure_removes_it() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    contact_type(&pool, site_id, Some(30)).await;
    let key = resolve_key("").unwrap();

    let created = CustomEntry::create(
        &pool,
        &key,
        site_id,
        "contact",
        Uuid::new_v4(),
        entry("Ada", "ada@example.com"),
    )
    .await
    .expect("create entry");

    // RoPA lists the PII field with its full data-protection contract.
    let report = ropa::generate(&pool, site_id).await.expect("generate ropa");
    assert_eq!(report.processing_activities.len(), 1);
    let activity = &report.processing_activities[0];
    assert_eq!(activity.key, "contact");
    assert_eq!(activity.retention_days, Some(30));
    assert_eq!(activity.record_count, 1);
    assert_eq!(activity.pii_fields.len(), 1);
    let f = &activity.pii_fields[0];
    assert_eq!(f.key, "email");
    assert_eq!(f.processing_purpose.as_deref(), Some("newsletter"));
    assert_eq!(f.legal_basis.as_deref(), Some("consent"));

    // Export (authorized read) shows the PII.
    let before = CustomEntry::read(&pool, &key, site_id, "contact", created.id, true)
        .await
        .unwrap();
    assert_eq!(before.shared["email"], json!("ada@example.com"));

    // Erase, then re-export: PII gone, non-PII kept.
    CustomEntry::erase_pii(&pool, site_id, "contact", created.id, Uuid::new_v4())
        .await
        .expect("erase pii");
    let after = CustomEntry::read(&pool, &key, site_id, "contact", created.id, true)
        .await
        .unwrap();
    assert!(!after.shared.contains_key("email"), "PII must be erased");
    assert_eq!(after.shared["name"], json!("Ada")); // non-PII retained

    // The erasure was audited.
    let audits: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM audit_logs WHERE entity_type = 'custom_entry_pii_erasure' AND entity_id = $1",
    )
    .bind(created.id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(audits, 1);
}

#[tokio::test]
async fn retention_purges_aged_entries_but_keeps_fresh_and_null() {
    let pool = test_db_pool().await;
    let key = resolve_key("").unwrap();

    // Site A: 1-day retention. Site B: NULL retention (keep forever).
    let site_a = create_test_site(&pool).await;
    contact_type(&pool, site_a, Some(1)).await;
    let site_b = create_test_site(&pool).await;
    contact_type(&pool, site_b, None).await;

    let aged = CustomEntry::create(
        &pool,
        &key,
        site_a,
        "contact",
        Uuid::new_v4(),
        entry("Old", "old@a.com"),
    )
    .await
    .unwrap();
    let fresh = CustomEntry::create(
        &pool,
        &key,
        site_a,
        "contact",
        Uuid::new_v4(),
        entry("New", "new@a.com"),
    )
    .await
    .unwrap();
    let evergreen = CustomEntry::create(
        &pool,
        &key,
        site_b,
        "contact",
        Uuid::new_v4(),
        entry("Keep", "keep@b.com"),
    )
    .await
    .unwrap();

    // Age the first A entry and the B entry well past 1 day.
    for id in [aged.id, evergreen.id] {
        sqlx::query("UPDATE contents SET created_at = NOW() - INTERVAL '3 days' WHERE id = $1")
            .bind(id)
            .execute(&pool)
            .await
            .unwrap();
    }

    let purged = CustomEntry::purge_expired(&pool).await.unwrap();
    assert!(purged >= 1, "the aged site-A entry should be purged");

    let exists = |id: Uuid| async move {
        let pool = test_db_pool().await;
        sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM contents WHERE id = $1)")
            .bind(id)
            .fetch_one(&pool)
            .await
            .unwrap()
    };
    assert!(!exists(aged.id).await, "aged entry purged");
    assert!(exists(fresh.id).await, "fresh entry kept");
    assert!(
        exists(evergreen.id).await,
        "NULL-retention entry never purged"
    );
}
