//! Auth-tier pin for `GET /sites/{site_id}/settings`.
//!
//! The raw settings payload carries operational config (allowed origins,
//! quotas, retention, module flags), so it stays behind the Admin-only
//! `settings:read` permission: Read (Viewer) and Write (Editor) keys are
//! denied with `AUTH_INSUFFICIENT_ROLE`, Admin and Master keys pass.
//! Lower tiers read the curated `GET /sites/{site_id}/context` instead.

mod common;

use axum_test::TestResponse;
use serial_test::serial;
use uuid::Uuid;

use forja::errors::codes;
use forja::models::api_key::ApiKeyPermission;

use common::{TestContext, create_test_api_key, create_test_site, test_context};

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
