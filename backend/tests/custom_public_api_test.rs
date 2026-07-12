//! #795 — public Consumer API for custom-type entries (HTTP level).
//!
//! Published entries of publicly-readable collections are served PII-stripped;
//! drafts are hidden and non-public/data-only types 404.

mod common;

use common::{TestContext, create_test_api_key, create_test_site, test_context};
use forja::dto::custom_entry::CustomEntryRequest;
use forja::dto::custom_type::{
    CreateCustomTypeRequest, CustomContentKind, CustomFieldInput, CustomFieldType,
};
use forja::models::api_key::ApiKeyPermission;
use forja::models::custom_entry::CustomEntry;
use forja::models::custom_type::CustomType;
use forja::models::site_settings::SiteSetting;
use forja::services::encryption::resolve_key;
use serde_json::{Value, json};
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

/// A public "recipe" type with a normal field + a PII field.
async fn public_recipe(ctx: &TestContext, site_id: Uuid, publicly_readable: bool) {
    SiteSetting::upsert(
        &ctx.pool,
        site_id,
        "module_collections_enabled",
        json!(true),
        false,
    )
    .await
    .unwrap();
    let mut title = field("title", CustomFieldType::Text);
    title.is_title = true;
    title.required = true;
    let servings = field("servings", CustomFieldType::Number);
    let mut author_email = field("author_email", CustomFieldType::Text);
    author_email.is_pii = true;
    author_email.legal_basis = Some("consent".into());
    CustomType::create(
        &ctx.pool,
        site_id,
        Uuid::new_v4(),
        CreateCustomTypeRequest {
            key: "recipe".into(),
            name: "Recipe".into(),
            retention_days: None,
            is_publicly_readable: publicly_readable,
            content_kind: CustomContentKind::Page,
            fields: vec![title, servings, author_email],
        },
    )
    .await
    .expect("create recipe type");
}

async fn make_published_entry(ctx: &TestContext, site_id: Uuid, slug: &str) -> Uuid {
    let key = resolve_key("").unwrap();
    let mut shared = HashMap::new();
    shared.insert("title".to_string(), Value::from("Spaghetti"));
    shared.insert("servings".to_string(), Value::from(4));
    shared.insert("author_email".to_string(), Value::from("chef@example.com"));
    let created = CustomEntry::create(
        &ctx.pool,
        &key,
        site_id,
        "recipe",
        Uuid::new_v4(),
        CustomEntryRequest {
            slug: Some(slug.into()),
            shared,
            localized: HashMap::new(),
        },
    )
    .await
    .expect("create entry");
    CustomEntry::publish(
        &ctx.pool,
        &key,
        site_id,
        "recipe",
        created.id,
        Uuid::new_v4(),
    )
    .await
    .expect("publish");
    created.id
}

#[tokio::test]
async fn tracer_published_entry_is_served_without_pii() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    public_recipe(&ctx, site_id, true).await;
    make_published_entry(&ctx, site_id, "spaghetti").await;
    let reader = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!(
            "/api/v1/sites/{site_id}/collections/recipe/by-slug/spaghetti"
        ))
        .add_header("x-api-key", reader.as_str())
        .await;
    assert_eq!(resp.status_code(), 200, "body: {}", resp.text());
    let body: serde_json::Value = resp.json();
    assert_eq!(body["data"]["title"], "Spaghetti");
    assert_eq!(body["data"]["servings"], 4);
    // PII must be absent entirely.
    assert!(
        body["data"].get("author_email").is_none(),
        "PII leaked: {body}"
    );
    assert!(!resp.text().contains("chef@example.com"));
}

#[tokio::test]
async fn published_list_excludes_drafts() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    public_recipe(&ctx, site_id, true).await;
    make_published_entry(&ctx, site_id, "live").await;
    // A second, unpublished (draft) entry.
    let key = resolve_key("").unwrap();
    let mut shared = HashMap::new();
    shared.insert("title".to_string(), Value::from("Draft"));
    CustomEntry::create(
        &ctx.pool,
        &key,
        site_id,
        "recipe",
        Uuid::new_v4(),
        CustomEntryRequest {
            slug: Some("draft".into()),
            shared,
            localized: HashMap::new(),
        },
    )
    .await
    .unwrap();
    let reader = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!(
            "/api/v1/sites/{site_id}/collections/recipe/published"
        ))
        .add_header("x-api-key", reader.as_str())
        .await;
    assert_eq!(resp.status_code(), 200);
    let body: serde_json::Value = resp.json();
    assert_eq!(
        body["meta"]["total_items"], 1,
        "only the published entry: {body}"
    );
}

#[tokio::test]
async fn public_schema_omits_pii_fields() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    public_recipe(&ctx, site_id, true).await;
    let reader = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!(
            "/api/v1/sites/{site_id}/collections/recipe/schema"
        ))
        .add_header("x-api-key", reader.as_str())
        .await;
    assert_eq!(resp.status_code(), 200);
    let body: serde_json::Value = resp.json();
    let keys: Vec<&str> = body["fields"]
        .as_array()
        .unwrap()
        .iter()
        .map(|f| f["key"].as_str().unwrap())
        .collect();
    assert!(keys.contains(&"title"));
    assert!(keys.contains(&"servings"));
    assert!(
        !keys.contains(&"author_email"),
        "PII field advertised in public schema"
    );
}

#[tokio::test]
async fn data_only_type_is_not_publicly_readable() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    public_recipe(&ctx, site_id, false).await; // is_publicly_readable = false
    let reader = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!(
            "/api/v1/sites/{site_id}/collections/recipe/published"
        ))
        .add_header("x-api-key", reader.as_str())
        .await;
    assert_eq!(resp.status_code(), 404);
}
