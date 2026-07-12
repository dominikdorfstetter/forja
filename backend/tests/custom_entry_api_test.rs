//! #793 — Entry CRUD API (HTTP level).
//!
//! Localized create → publish → list tracer, plus RBAC (viewer read-only),
//! the default-locale publish gate, and per-locale merge on update.

mod common;

use common::{TestContext, create_test_api_key, create_test_site, test_context};
use forja::dto::custom_type::{
    CreateCustomTypeRequest, CustomContentKind, CustomFieldInput, CustomFieldType,
};
use forja::models::api_key::ApiKeyPermission;
use forja::models::custom_type::CustomType;
use forja::models::site_settings::SiteSetting;
use serde_json::json;
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

/// A "note" type: shared required title + localized required body.
async fn note_type(ctx: &TestContext, site_id: Uuid) {
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
    let mut body = field("body", CustomFieldType::Richtext);
    body.localized = true;
    body.required = true;
    CustomType::create(
        &ctx.pool,
        site_id,
        Uuid::new_v4(),
        CreateCustomTypeRequest {
            key: "note".into(),
            name: "Note".into(),
            retention_days: None,
            is_publicly_readable: false,
            content_kind: CustomContentKind::Data,
            fields: vec![title, body],
        },
    )
    .await
    .expect("create note type");
}

#[tokio::test]
async fn tracer_create_localized_entry_publish_and_list() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    note_type(&ctx, site_id).await;
    let editor = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;
    let base = format!("/api/v1/sites/{site_id}/custom-types/note/entries");

    // Create a draft with a localized body in the default locale (en).
    let created = ctx
        .server
        .post(&base)
        .add_header("x-api-key", editor.as_str())
        .json(&json!({ "shared": { "title": "First note" }, "localized": { "en": { "body": "Hello" } } }))
        .await;
    assert_eq!(created.status_code(), 201, "body: {}", created.text());
    let entry_id = created.json::<serde_json::Value>()["id"]
        .as_str()
        .unwrap()
        .to_string();
    assert_eq!(created.json::<serde_json::Value>()["status"], "draft");

    // Publish it.
    let published = ctx
        .server
        .post(&format!("{base}/{entry_id}/publish"))
        .add_header("x-api-key", editor.as_str())
        .await;
    assert_eq!(published.status_code(), 200, "body: {}", published.text());
    assert_eq!(published.json::<serde_json::Value>()["status"], "published");

    // List shows it as published.
    let list = ctx
        .server
        .get(&format!("{base}?status=published"))
        .add_header("x-api-key", editor.as_str())
        .await;
    assert_eq!(list.status_code(), 200);
    let body: serde_json::Value = list.json();
    assert_eq!(body["meta"]["total_items"], 1);
    assert_eq!(body["data"][0]["title"], "First note");
    assert_eq!(body["data"][0]["status"], "published");
}

#[tokio::test]
async fn viewer_cannot_write_entries() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    note_type(&ctx, site_id).await;
    let viewer = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .post(&format!(
            "/api/v1/sites/{site_id}/custom-types/note/entries"
        ))
        .add_header("x-api-key", viewer.as_str())
        .json(&json!({ "shared": { "title": "x" }, "localized": { "en": { "body": "y" } } }))
        .await;
    assert_eq!(resp.status_code(), 403);
}

#[tokio::test]
async fn publish_missing_default_locale_required_field_is_rejected() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    note_type(&ctx, site_id).await;
    let editor = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;
    let base = format!("/api/v1/sites/{site_id}/custom-types/note/entries");

    // Body provided only for a NON-default locale (de); default is en.
    let created = ctx
        .server
        .post(&base)
        .add_header("x-api-key", editor.as_str())
        .json(&json!({ "shared": { "title": "DE only" }, "localized": { "de": { "body": "Hallo" } } }))
        .await;
    assert_eq!(created.status_code(), 201, "body: {}", created.text());
    let entry_id = created.json::<serde_json::Value>()["id"]
        .as_str()
        .unwrap()
        .to_string();

    let publish = ctx
        .server
        .post(&format!("{base}/{entry_id}/publish"))
        .add_header("x-api-key", editor.as_str())
        .await;
    assert_eq!(publish.status_code(), 422);
    assert_eq!(
        publish.json::<serde_json::Value>()["code"],
        "ERR_CUSTOM_ENTRY_REQUIRED_FIELD"
    );
}

#[tokio::test]
async fn update_one_locale_leaves_others_untouched() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    note_type(&ctx, site_id).await;
    let editor = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;
    let base = format!("/api/v1/sites/{site_id}/custom-types/note/entries");

    let created = ctx
        .server
        .post(&base)
        .add_header("x-api-key", editor.as_str())
        .json(&json!({
            "shared": { "title": "Multi" },
            "localized": { "en": { "body": "English" }, "de": { "body": "Deutsch" } }
        }))
        .await;
    assert_eq!(created.status_code(), 201, "body: {}", created.text());
    let entry_id = created.json::<serde_json::Value>()["id"]
        .as_str()
        .unwrap()
        .to_string();

    // Update only the English body.
    let updated = ctx
        .server
        .put(&format!("{base}/{entry_id}"))
        .add_header("x-api-key", editor.as_str())
        .json(&json!({ "shared": { "title": "Multi" }, "localized": { "en": { "body": "Updated EN" } } }))
        .await;
    assert_eq!(updated.status_code(), 200, "body: {}", updated.text());
    let body: serde_json::Value = updated.json();
    assert_eq!(body["localized"]["en"]["body"], "Updated EN");
    // German is untouched (merge, not replace).
    assert_eq!(body["localized"]["de"]["body"], "Deutsch");
}

#[tokio::test]
async fn get_entry_is_site_scoped_cross_tenant_404() {
    let ctx = test_context().await;

    // Two independent tenants, each with a `note` type + a write key.
    let site_a = create_test_site(&ctx.pool).await;
    note_type(&ctx, site_a).await;
    let editor_a = create_test_api_key(&ctx.pool, site_a, ApiKeyPermission::Write).await;

    let site_b = create_test_site(&ctx.pool).await;
    note_type(&ctx, site_b).await;
    let editor_b = create_test_api_key(&ctx.pool, site_b, ApiKeyPermission::Write).await;

    // Create an entry on site A.
    let created = ctx
        .server
        .post(&format!("/api/v1/sites/{site_a}/custom-types/note/entries"))
        .add_header("x-api-key", editor_a.as_str())
        .json(&json!({ "shared": { "title": "Tenant A secret" }, "localized": { "en": { "body": "private" } } }))
        .await;
    assert_eq!(created.status_code(), 201, "body: {}", created.text());
    let entry_id = created.json::<serde_json::Value>()["id"]
        .as_str()
        .unwrap()
        .to_string();

    // Site A can read its own entry.
    let own = ctx
        .server
        .get(&format!(
            "/api/v1/sites/{site_a}/custom-types/note/entries/{entry_id}"
        ))
        .add_header("x-api-key", editor_a.as_str())
        .await;
    assert_eq!(own.status_code(), 200, "body: {}", own.text());

    // Site B replaying A's entry_id under its own (fully authorized) site must
    // 404 — no cross-tenant read of another site's entry.
    let cross = ctx
        .server
        .get(&format!(
            "/api/v1/sites/{site_b}/custom-types/note/entries/{entry_id}"
        ))
        .add_header("x-api-key", editor_b.as_str())
        .await;
    assert_eq!(cross.status_code(), 404, "body: {}", cross.text());
}

/// Tracer (#879): a schema-violating body is rejected at the request boundary
/// by the `ValidatedJson` seam *before* the handler body runs its permission
/// check. A read-only key — which `authorize()` would 403 — POSTs an entry
/// with an unknown field. The seam wins: 422 (validation), not 403 (authz),
/// proving validation now runs at the extractor, not deep inside `create`.
#[tokio::test]
async fn invalid_body_rejected_at_seam_before_authorize() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    note_type(&ctx, site_id).await;
    let viewer = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .post(&format!(
            "/api/v1/sites/{site_id}/custom-types/note/entries"
        ))
        .add_header("x-api-key", viewer.as_str())
        .json(&json!({ "shared": { "no_such_field": "x" } }))
        .await;

    assert_eq!(
        resp.status_code(),
        422,
        "validation must run at the boundary before the handler's authz check; body: {}",
        resp.text()
    );
    assert_eq!(
        resp.json::<serde_json::Value>()["code"],
        "ERR_CUSTOM_ENTRY_VALIDATION"
    );
}
