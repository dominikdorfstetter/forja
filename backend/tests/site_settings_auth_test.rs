//! Auth-tier pins for the settings routes.
//!
//! The raw `GET /sites/{site_id}/settings` payload carries operational
//! config (allowed origins, quotas, retention, module flags), so it stays
//! behind the Admin-only `settings:read` permission: Read (Viewer) and
//! Write (Editor) keys are denied with `AUTH_INSUFFICIENT_ROLE`, Admin and
//! Master keys pass.
//!
//! Lower tiers read the curated `GET /sites/{site_id}/settings/public`
//! (`site:read`, so every key tier passes), whose body is EXACTLY the
//! code-side allowlist — contact email, manifest colors, SEO defaults —
//! and reflects `PUT /sites/{site_id}/settings` immediately (pins the
//! response-cache invalidation bundled with the endpoint).

mod common;

use axum_test::TestResponse;
use serial_test::serial;
use uuid::Uuid;

use forja::errors::codes;
use forja::models::api_key::ApiKeyPermission;

use common::{TestContext, create_test_api_key, create_test_site, test_context};

/// The v1 public-settings allowlist, sorted. The public endpoint must
/// expose exactly these fields — nothing operational.
const PUBLIC_SETTINGS_FIELDS: [&str; 5] = [
    "background_color",
    "contact_email",
    "seo_default_description",
    "seo_title_template",
    "theme_color",
];

async fn get_settings_as(
    ctx: &TestContext,
    site_id: Uuid,
    permission: ApiKeyPermission,
) -> TestResponse {
    let key = create_test_api_key(&ctx.pool, site_id, permission).await;
    ctx.server
        .get(&format!("/api/v1/sites/{site_id}/settings"))
        .add_header("x-api-key", key.as_str())
        .await
}

async fn get_public_settings_as(
    ctx: &TestContext,
    site_id: Uuid,
    permission: ApiKeyPermission,
) -> TestResponse {
    let key = create_test_api_key(&ctx.pool, site_id, permission).await;
    ctx.server
        .get(&format!("/api/v1/sites/{site_id}/settings/public"))
        .add_header("x-api-key", key.as_str())
        .await
}

#[tokio::test]
#[serial]
async fn settings_read_denied_below_admin_tier() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;

    for permission in [ApiKeyPermission::Read, ApiKeyPermission::Write] {
        let resp = get_settings_as(&ctx, site_id, permission).await;
        assert_eq!(
            resp.status_code().as_u16(),
            403,
            "{permission:?} key must not read raw settings"
        );
        let body: serde_json::Value = resp.json();
        assert_eq!(body["code"], codes::AUTH_INSUFFICIENT_ROLE);
    }
}

#[tokio::test]
#[serial]
async fn settings_read_allowed_for_admin_and_master_tiers() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;

    for permission in [ApiKeyPermission::Admin, ApiKeyPermission::Master] {
        let resp = get_settings_as(&ctx, site_id, permission).await;
        assert_eq!(
            resp.status_code().as_u16(),
            200,
            "{permission:?} key must read raw settings"
        );
        let body: serde_json::Value = resp.json();
        assert!(
            body.get("code_injection_head").is_some(),
            "{permission:?} response carries the full settings payload"
        );
    }
}

#[tokio::test]
#[serial]
async fn public_settings_read_allowed_for_every_key_tier() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;

    for permission in [
        ApiKeyPermission::Read,
        ApiKeyPermission::Write,
        ApiKeyPermission::Admin,
        ApiKeyPermission::Master,
    ] {
        let resp = get_public_settings_as(&ctx, site_id, permission).await;
        assert_eq!(
            resp.status_code().as_u16(),
            200,
            "{permission:?} key must read public settings"
        );
    }
}

#[tokio::test]
#[serial]
async fn public_settings_expose_exactly_the_allowlisted_fields() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;

    let resp = get_public_settings_as(&ctx, site_id, ApiKeyPermission::Read).await;
    assert_eq!(resp.status_code().as_u16(), 200);

    let body: serde_json::Value = resp.json();
    let mut keys: Vec<&str> = body
        .as_object()
        .expect("public settings is a JSON object")
        .keys()
        .map(|k| k.as_str())
        .collect();
    keys.sort_unstable();
    assert_eq!(keys, PUBLIC_SETTINGS_FIELDS, "field-pick allowlist drifted");

    for operational in [
        "allowed_origins",
        "storage_quota_bytes",
        "data_retention_days",
        "code_injection_head",
        "code_injection_footer",
        "preview_templates",
    ] {
        assert!(
            body.get(operational).is_none(),
            "operational field {operational} leaked into the public payload"
        );
    }
}

#[tokio::test]
#[serial]
async fn public_settings_reflect_put_values_immediately() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let admin_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Admin).await;

    // Warm the read path first so a stale cache entry would be caught.
    let warm = get_public_settings_as(&ctx, site_id, ApiKeyPermission::Read).await;
    assert_eq!(warm.status_code().as_u16(), 200);

    let put = ctx
        .server
        .put(&format!("/api/v1/sites/{site_id}/settings"))
        .add_header("x-api-key", admin_key.as_str())
        .json(&serde_json::json!({
            "contact_email": "hello@example.com",
            "theme_color": "#123456",
            "background_color": "#654321",
            "seo_title_template": "{{title}} — Example",
            "seo_default_description": "An example site",
        }))
        .await;
    assert_eq!(put.status_code().as_u16(), 200);

    let resp = get_public_settings_as(&ctx, site_id, ApiKeyPermission::Read).await;
    assert_eq!(resp.status_code().as_u16(), 200);
    let body: serde_json::Value = resp.json();
    assert_eq!(body["contact_email"], "hello@example.com");
    assert_eq!(body["theme_color"], "#123456");
    assert_eq!(body["background_color"], "#654321");
    assert_eq!(body["seo_title_template"], "{{title}} — Example");
    assert_eq!(body["seo_default_description"], "An example site");
}

#[tokio::test]
#[serial]
async fn public_settings_fall_back_to_house_defaults_when_unset() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;

    let resp = get_public_settings_as(&ctx, site_id, ApiKeyPermission::Read).await;
    assert_eq!(resp.status_code().as_u16(), 200);
    let body: serde_json::Value = resp.json();
    assert_eq!(body["contact_email"], "");
    assert_eq!(body["theme_color"], "#ffffff");
    assert_eq!(body["background_color"], "#ffffff");
    assert_eq!(body["seo_title_template"], "{{title}} | {{site_name}}");
    assert_eq!(body["seo_default_description"], "");
}
