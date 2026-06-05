//! #800 — safe schema evolution: rename, retype, optional→required, soft-delete.

mod common;

use common::{create_test_site, test_db_pool};
use forja::dto::custom_entry::CustomEntryRequest;
use forja::dto::custom_type::{
    CreateCustomTypeRequest, CustomContentKind, CustomFieldInput, CustomFieldResponse,
    CustomFieldType, UpdateCustomTypeRequest,
};
use forja::models::custom_entry::CustomEntry;
use forja::models::custom_type::CustomType;
use forja::services::encryption::resolve_key;
use serde_json::Value;
use std::collections::HashMap;
use uuid::Uuid;

fn new_field(key: &str, ft: CustomFieldType, is_title: bool) -> CustomFieldInput {
    CustomFieldInput {
        id: None,
        key: key.into(),
        label: key.into(),
        labels: None,
        field_type: ft,
        required: false,
        localized: false,
        is_title,
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

/// Round-trip an existing field into an update input (carrying its id).
fn to_input(f: &CustomFieldResponse) -> CustomFieldInput {
    CustomFieldInput {
        id: Some(f.id),
        key: f.key.clone(),
        label: f.label.clone(),
        labels: f.labels.clone(),
        field_type: f.field_type,
        required: f.required,
        localized: f.localized,
        is_title: f.is_title,
        is_pii: f.is_pii,
        data_category: f.data_category.clone(),
        processing_purpose: f.processing_purpose.clone(),
        legal_basis: f.legal_basis.clone(),
        enum_options: f
            .enum_options
            .as_ref()
            .and_then(|v| serde_json::from_value(v.clone()).ok()),
        min: f.min,
        max: f.max,
        min_length: f.min_length,
        max_length: f.max_length,
        pattern: f.pattern.clone(),
        is_unique: f.is_unique,
        display_order: f.display_order,
    }
}

fn update_req(fields: Vec<CustomFieldInput>) -> UpdateCustomTypeRequest {
    UpdateCustomTypeRequest {
        name: "Post".into(),
        retention_days: None,
        is_publicly_readable: false,
        content_kind: CustomContentKind::Data,
        fields,
    }
}

async fn make_type(pool: &sqlx::PgPool, site_id: Uuid, fields: Vec<CustomFieldInput>) {
    CustomType::create(
        pool,
        site_id,
        Uuid::new_v4(),
        CreateCustomTypeRequest {
            key: "post".into(),
            name: "Post".into(),
            retention_days: None,
            is_publicly_readable: false,
            content_kind: CustomContentKind::Data,
            fields,
        },
    )
    .await
    .expect("create type");
}

fn entry(pairs: &[(&str, Value)]) -> CustomEntryRequest {
    CustomEntryRequest {
        slug: None,
        shared: pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.clone()))
            .collect(),
        localized: HashMap::new(),
    }
}

#[tokio::test]
async fn tracer_rename_preserves_values_under_new_key() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let key = resolve_key("").unwrap();
    make_type(
        &pool,
        site_id,
        vec![
            new_field("title", CustomFieldType::Text, true),
            new_field("body", CustomFieldType::Text, false),
        ],
    )
    .await;

    let created = CustomEntry::create(
        &pool,
        &key,
        site_id,
        "post",
        Uuid::new_v4(),
        entry(&[
            ("title", Value::from("Hello")),
            ("body", Value::from("World")),
        ]),
    )
    .await
    .unwrap();

    // Rename `body` → `content` (same field id).
    let schema = CustomType::get(&pool, site_id, "post").await.unwrap();
    let inputs: Vec<CustomFieldInput> = schema
        .fields
        .iter()
        .map(|f| {
            let mut i = to_input(f);
            if f.key == "body" {
                i.key = "content".into();
            }
            i
        })
        .collect();
    CustomType::update(&pool, site_id, Uuid::new_v4(), "post", update_req(inputs))
        .await
        .expect("rename");

    let after = CustomEntry::read(&pool, &key, site_id, "post", created.id, true)
        .await
        .unwrap();
    assert_eq!(
        after.shared.get("content"),
        Some(&Value::from("World")),
        "value preserved under new key"
    );
    assert!(!after.shared.contains_key("body"), "old key gone");
}

#[tokio::test]
async fn optional_to_required_with_violating_data_is_rejected() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let key = resolve_key("").unwrap();
    make_type(
        &pool,
        site_id,
        vec![
            new_field("title", CustomFieldType::Text, true),
            new_field("subtitle", CustomFieldType::Text, false),
        ],
    )
    .await;
    // Entry without the optional subtitle.
    CustomEntry::create(
        &pool,
        &key,
        site_id,
        "post",
        Uuid::new_v4(),
        entry(&[("title", Value::from("T"))]),
    )
    .await
    .unwrap();

    let schema = CustomType::get(&pool, site_id, "post").await.unwrap();
    let inputs: Vec<CustomFieldInput> = schema
        .fields
        .iter()
        .map(|f| {
            let mut i = to_input(f);
            if f.key == "subtitle" {
                i.required = true;
            }
            i
        })
        .collect();
    let err = CustomType::update(&pool, site_id, Uuid::new_v4(), "post", update_req(inputs))
        .await
        .expect_err("should reject tightening with violating data");
    assert_eq!(err.code(), "ERR_CUSTOM_FIELD_REQUIRED_CONFLICT");
}

#[tokio::test]
async fn incompatible_retype_is_rejected() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let key = resolve_key("").unwrap();
    make_type(
        &pool,
        site_id,
        vec![
            new_field("title", CustomFieldType::Text, true),
            new_field("count", CustomFieldType::Text, false),
        ],
    )
    .await;
    CustomEntry::create(
        &pool,
        &key,
        site_id,
        "post",
        Uuid::new_v4(),
        entry(&[
            ("title", Value::from("T")),
            ("count", Value::from("not-a-number")),
        ]),
    )
    .await
    .unwrap();

    let schema = CustomType::get(&pool, site_id, "post").await.unwrap();
    let inputs: Vec<CustomFieldInput> = schema
        .fields
        .iter()
        .map(|f| {
            let mut i = to_input(f);
            if f.key == "count" {
                i.field_type = CustomFieldType::Number;
            }
            i
        })
        .collect();
    let err = CustomType::update(&pool, site_id, Uuid::new_v4(), "post", update_req(inputs))
        .await
        .expect_err("should reject incompatible retype");
    assert_eq!(err.code(), "ERR_CUSTOM_FIELD_RETYPE_INCOMPATIBLE");
}

#[tokio::test]
async fn dropped_field_is_soft_deprecated_and_values_stay_readable() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let key = resolve_key("").unwrap();
    make_type(
        &pool,
        site_id,
        vec![
            new_field("title", CustomFieldType::Text, true),
            new_field("extra", CustomFieldType::Text, false),
        ],
    )
    .await;
    let created = CustomEntry::create(
        &pool,
        &key,
        site_id,
        "post",
        Uuid::new_v4(),
        entry(&[
            ("title", Value::from("T")),
            ("extra", Value::from("keepme")),
        ]),
    )
    .await
    .unwrap();

    // Update omitting `extra` → soft-deprecate.
    let schema = CustomType::get(&pool, site_id, "post").await.unwrap();
    let inputs: Vec<CustomFieldInput> = schema
        .fields
        .iter()
        .filter(|f| f.key != "extra")
        .map(to_input)
        .collect();
    CustomType::update(&pool, site_id, Uuid::new_v4(), "post", update_req(inputs))
        .await
        .expect("drop field");

    // The field is soft-deprecated, not gone.
    let deprecated: Option<chrono::DateTime<chrono::Utc>> = sqlx::query_scalar(
        "SELECT deprecated_at FROM custom_type_fields f
           JOIN custom_types t ON t.id = f.custom_type_id
          WHERE t.site_id = $1 AND t.key = 'post' AND f.key = 'extra'",
    )
    .bind(site_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(deprecated.is_some(), "field should be soft-deprecated");

    // Its stored value is still readable.
    let after = CustomEntry::read(&pool, &key, site_id, "post", created.id, true)
        .await
        .unwrap();
    assert_eq!(after.shared.get("extra"), Some(&Value::from("keepme")));
}

#[tokio::test]
async fn reorder_only_does_not_bump_schema_version() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    make_type(
        &pool,
        site_id,
        vec![
            new_field("title", CustomFieldType::Text, true),
            new_field("body", CustomFieldType::Text, false),
        ],
    )
    .await;

    let before = CustomType::get(&pool, site_id, "post").await.unwrap();
    let v0 = before.schema_version;

    // Reverse the field order (swap display_order), change nothing else.
    let mut inputs: Vec<CustomFieldInput> = before.fields.iter().map(to_input).collect();
    inputs.reverse();
    for (i, f) in inputs.iter_mut().enumerate() {
        f.display_order = i as i16;
    }
    CustomType::update(&pool, site_id, Uuid::new_v4(), "post", update_req(inputs))
        .await
        .expect("reorder");

    let after = CustomType::get(&pool, site_id, "post").await.unwrap();
    assert_eq!(
        after.schema_version, v0,
        "reordering fields must not bump schema_version"
    );
    let after_order: Vec<&str> = after.fields.iter().map(|f| f.key.as_str()).collect();
    let reversed_before: Vec<&str> = before.fields.iter().rev().map(|f| f.key.as_str()).collect();
    assert_eq!(after_order, reversed_before, "order actually changed");
}

#[tokio::test]
async fn structural_change_bumps_schema_version() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    make_type(
        &pool,
        site_id,
        vec![
            new_field("title", CustomFieldType::Text, true),
            new_field("body", CustomFieldType::Text, false),
        ],
    )
    .await;

    let before = CustomType::get(&pool, site_id, "post").await.unwrap();
    let v0 = before.schema_version;

    // Add a field → a real contract change.
    let mut inputs: Vec<CustomFieldInput> = before.fields.iter().map(to_input).collect();
    inputs.push(new_field("subtitle", CustomFieldType::Text, false));
    CustomType::update(&pool, site_id, Uuid::new_v4(), "post", update_req(inputs))
        .await
        .expect("add field");

    let after = CustomType::get(&pool, site_id, "post").await.unwrap();
    assert_eq!(
        after.schema_version,
        v0 + 1,
        "adding a field must bump schema_version"
    );
}
