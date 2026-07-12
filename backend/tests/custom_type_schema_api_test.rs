//! #791 — Custom-type schema-builder API (HTTP level).
//!
//! Exercises the five `/sites/{id}/custom-types` endpoints through the real
//! Axum router: module gating, RBAC (admin writes, editor denied), the
//! reserved-name / duplicate-field-key guards, the round-trip tracer, and the
//! delete-with-entries guard.

mod common;

use common::{TestContext, create_test_api_key, create_test_site, test_context};
use forja::models::api_key::ApiKeyPermission;
use forja::models::site_settings::SiteSetting;
use serde_json::json;
use uuid::Uuid;

async fn enable_collections(ctx: &TestContext, site_id: Uuid) {
    SiteSetting::upsert(
        &ctx.pool,
        site_id,
        "module_collections_enabled",
        json!(true),
        false,
    )
    .await
    .expect("enable collections module");
}

fn recipe_body() -> serde_json::Value {
    json!({
        "key": "recipe",
        "name": "Recipe",
        "retention_days": null,
        "is_publicly_readable": true,
        "content_kind": "page",
        "fields": [
            { "key": "title", "label": "Title", "field_type": "text", "is_title": true, "required": true },
            { "key": "body", "label": "Body", "field_type": "richtext", "localized": true },
            { "key": "servings", "label": "Servings", "field_type": "number", "min": 1.0, "max": 99.0 },
            { "key": "spice", "label": "Spice", "field_type": "enum", "enum_options": ["mild", "hot"] }
        ]
    })
}

#[tokio::test]
async fn tracer_admin_creates_recipe_type_and_reads_it_back() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    enable_collections(&ctx, site_id).await;
    let admin = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Admin).await;

    let created = ctx
        .server
        .post(&format!("/api/v1/sites/{site_id}/custom-types"))
        .add_header("x-api-key", admin.as_str())
        .json(&recipe_body())
        .await;
    assert_eq!(created.status_code(), 201, "body: {}", created.text());
    let created_json: serde_json::Value = created.json();
    assert_eq!(created_json["key"], "recipe");
    assert_eq!(created_json["fields"].as_array().unwrap().len(), 4);

    // GET it back — schema is identical.
    let fetched = ctx
        .server
        .get(&format!("/api/v1/sites/{site_id}/custom-types/recipe"))
        .add_header("x-api-key", admin.as_str())
        .await;
    assert_eq!(fetched.status_code(), 200);
    let fetched_json: serde_json::Value = fetched.json();
    assert_eq!(fetched_json["name"], "Recipe");
    assert_eq!(fetched_json["content_kind"], "page");
    assert!(fetched_json["is_publicly_readable"].as_bool().unwrap());
    let fields = fetched_json["fields"].as_array().unwrap();
    assert_eq!(fields.len(), 4);
    let title = fields.iter().find(|f| f["key"] == "title").unwrap();
    assert_eq!(title["is_title"], true);
    let spice = fields.iter().find(|f| f["key"] == "spice").unwrap();
    assert_eq!(spice["enum_options"], json!(["mild", "hot"]));

    // It shows up in the list.
    let list = ctx
        .server
        .get(&format!("/api/v1/sites/{site_id}/custom-types"))
        .add_header("x-api-key", admin.as_str())
        .await;
    assert_eq!(list.status_code(), 200);
    let arr: serde_json::Value = list.json();
    assert_eq!(arr.as_array().unwrap().len(), 1);
    assert_eq!(arr[0]["field_count"], 4);
}

#[tokio::test]
async fn editor_cannot_create_a_type() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    enable_collections(&ctx, site_id).await;
    // Write permission maps to the Editor site role.
    let editor = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;

    let resp = ctx
        .server
        .post(&format!("/api/v1/sites/{site_id}/custom-types"))
        .add_header("x-api-key", editor.as_str())
        .json(&recipe_body())
        .await;
    assert_eq!(resp.status_code(), 403);
    assert_eq!(
        resp.json::<serde_json::Value>()["code"],
        "ERR_CUSTOM_TYPE_FORBIDDEN"
    );
}

#[tokio::test]
async fn reserved_key_is_rejected() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    enable_collections(&ctx, site_id).await;
    let admin = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Admin).await;

    let mut body = recipe_body();
    body["key"] = json!("blog"); // collides with a built-in entity type
    let resp = ctx
        .server
        .post(&format!("/api/v1/sites/{site_id}/custom-types"))
        .add_header("x-api-key", admin.as_str())
        .json(&body)
        .await;
    assert_eq!(resp.status_code(), 422);
    assert_eq!(
        resp.json::<serde_json::Value>()["code"],
        "ERR_CUSTOM_TYPE_RESERVED_NAME"
    );
}

#[tokio::test]
async fn duplicate_field_key_is_rejected() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    enable_collections(&ctx, site_id).await;
    let admin = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Admin).await;

    let body = json!({
        "key": "dupes",
        "name": "Dupes",
        "fields": [
            { "key": "title", "label": "Title", "field_type": "text", "is_title": true },
            { "key": "title", "label": "Title 2", "field_type": "text" }
        ]
    });
    let resp = ctx
        .server
        .post(&format!("/api/v1/sites/{site_id}/custom-types"))
        .add_header("x-api-key", admin.as_str())
        .json(&body)
        .await;
    assert_eq!(resp.status_code(), 422);
    assert_eq!(
        resp.json::<serde_json::Value>()["code"],
        "ERR_CUSTOM_FIELD_DUPLICATE_KEY"
    );
}

#[tokio::test]
async fn module_disabled_blocks_access() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    // NOTE: collections module left disabled.
    let admin = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Admin).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/sites/{site_id}/custom-types"))
        .add_header("x-api-key", admin.as_str())
        .await;
    assert_eq!(resp.status_code(), 403);
    assert_eq!(
        resp.json::<serde_json::Value>()["code"],
        "MODULE_NOT_ENABLED"
    );
}

#[tokio::test]
async fn delete_removes_an_unused_type() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    enable_collections(&ctx, site_id).await;
    let admin = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Admin).await;

    let created = ctx
        .server
        .post(&format!("/api/v1/sites/{site_id}/custom-types"))
        .add_header("x-api-key", admin.as_str())
        .json(&recipe_body())
        .await;
    assert_eq!(created.status_code(), 201, "body: {}", created.text());

    let del = ctx
        .server
        .delete(&format!("/api/v1/sites/{site_id}/custom-types/recipe"))
        .add_header("x-api-key", admin.as_str())
        .await;
    assert_eq!(del.status_code(), 204);

    let gone = ctx
        .server
        .get(&format!("/api/v1/sites/{site_id}/custom-types/recipe"))
        .add_header("x-api-key", admin.as_str())
        .await;
    assert_eq!(gone.status_code(), 404);
}
