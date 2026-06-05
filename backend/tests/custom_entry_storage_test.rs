//! #792 — runtime validator + PII encryption-at-rest (storage level).
//!
//! Drives the model layer (no HTTP): define a type with a PII field, store a
//! valid entry, and assert the PII value is ciphertext in the DB, decrypts on
//! an authorized read, is redacted for an unauthorized read, lands a version
//! snapshot, and enforces cross-entry uniqueness.

mod common;

use common::{create_test_site, test_db_pool};
use forja::dto::custom_entry::CustomEntryRequest;
use forja::dto::custom_type::{
    CreateCustomTypeRequest, CustomContentKind, CustomFieldInput, CustomFieldType,
};
use forja::models::custom_entry::CustomEntry;
use forja::models::custom_type::CustomType;
use forja::services::encryption::resolve_key;
use serde_json::{json, Value};
use std::collections::HashMap;
use uuid::Uuid;

fn field(key: &str, ft: CustomFieldType) -> CustomFieldInput {
    CustomFieldInput {
        id: None,
        key: key.to_string(),
        label: key.to_string(),
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

async fn contact_type(pool: &sqlx::PgPool, site_id: Uuid) {
    let mut title = field("name", CustomFieldType::Text);
    title.is_title = true;
    title.required = true;

    let mut email = field("email", CustomFieldType::Text);
    email.is_pii = true;
    email.legal_basis = Some("consent".into());
    email.is_unique = true;

    let mut body = field("body", CustomFieldType::Richtext);
    body.localized = true;

    CustomType::create(
        pool,
        site_id,
        Uuid::new_v4(),
        CreateCustomTypeRequest {
            key: "contact".into(),
            name: "Contact".into(),
            retention_days: None,
            is_publicly_readable: false,
            content_kind: CustomContentKind::Data,
            fields: vec![title, email, body],
        },
    )
    .await
    .expect("create contact type");
}

fn entry(email: &str) -> CustomEntryRequest {
    let mut shared = HashMap::new();
    shared.insert("name".to_string(), Value::from("Ada Lovelace"));
    shared.insert("email".to_string(), Value::from(email));
    let mut en = HashMap::new();
    en.insert("body".to_string(), Value::from("Hello"));
    let mut localized = HashMap::new();
    localized.insert("en".to_string(), en);
    CustomEntryRequest {
        slug: Some("ada".into()),
        shared,
        localized,
    }
}

#[tokio::test]
async fn tracer_entry_stores_pii_as_ciphertext_and_decrypts_on_read() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    contact_type(&pool, site_id).await;
    let key = resolve_key("").unwrap();

    let created = CustomEntry::create(
        &pool,
        &key,
        site_id,
        "contact",
        Uuid::new_v4(),
        entry("ada@example.com"),
    )
    .await
    .expect("create entry");
    let content_id = created.id;

    // Authorized read decrypts the PII field.
    assert_eq!(created.shared["email"], json!("ada@example.com"));
    assert_eq!(created.shared["name"], json!("Ada Lovelace"));
    assert_eq!(created.localized["en"]["body"], json!("Hello"));

    // At rest, the email column holds an encrypted envelope, NOT the plaintext.
    let stored: Value =
        sqlx::query_scalar("SELECT data FROM custom_entry_values WHERE content_id = $1")
            .bind(content_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    let email_at_rest = &stored["email"];
    assert!(
        email_at_rest.get("__enc").is_some(),
        "email must be enveloped: {stored}"
    );
    assert!(
        !stored.to_string().contains("ada@example.com"),
        "plaintext PII leaked into storage: {stored}"
    );
    // Title is routed out of the value table.
    assert!(
        stored.get("name").is_none(),
        "title should not be in value table"
    );

    // A version snapshot exists.
    let versions: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM content_versions WHERE content_id = $1")
            .bind(content_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(versions, 1);

    // Unauthorized read redacts the PII field.
    let redacted = CustomEntry::read(&pool, &key, site_id, "contact", content_id, false)
        .await
        .unwrap();
    assert_eq!(redacted.shared["email"], Value::Null);
    assert_eq!(redacted.shared["name"], json!("Ada Lovelace")); // non-PII stays
}

#[tokio::test]
async fn unique_field_conflict_is_rejected() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    contact_type(&pool, site_id).await;
    let key = resolve_key("").unwrap();

    CustomEntry::create(
        &pool,
        &key,
        site_id,
        "contact",
        Uuid::new_v4(),
        entry("dup@example.com"),
    )
    .await
    .expect("first entry");
    let err = CustomEntry::create(
        &pool,
        &key,
        site_id,
        "contact",
        Uuid::new_v4(),
        entry("dup@example.com"),
    )
    .await
    .expect_err("second entry with same unique email must conflict");
    assert_eq!(err.code(), "ERR_CUSTOM_FIELD_UNIQUE_CONFLICT");
}

#[tokio::test]
async fn invalid_entry_is_rejected_before_storage() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    contact_type(&pool, site_id).await;
    let key = resolve_key("").unwrap();

    // Missing the required title field.
    let mut bad = entry("x@example.com");
    bad.shared.remove("name");
    let err = CustomEntry::create(&pool, &key, site_id, "contact", Uuid::new_v4(), bad)
        .await
        .expect_err("missing required title");
    assert_eq!(err.code(), "ERR_CUSTOM_ENTRY_REQUIRED_FIELD");
}
