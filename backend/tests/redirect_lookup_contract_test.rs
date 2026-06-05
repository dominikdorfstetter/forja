//! Issue #743 — pin the `/redirects/lookup` contract.
//!
//! Promotes the consumer-facing invariants to a guarded regression:
//!
//! - `GET /sites/{site_id}/redirects/lookup?path=…` → **200** with
//!   `{ destination_path, status_code }` on match.
//! - **404** (RFC 7807 ProblemDetails) when no active redirect exists —
//!   never `200` with a null body.
//! - `status_code` is always one of `301 | 302 | 307 | 308`. The
//!   create-side validator and the `chk_redirect_status_code` DB CHECK
//!   reject everything else.

mod common;

use axum::http::StatusCode;
use serial_test::serial;
use uuid::Uuid;

use forja::dto::redirect::CreateRedirectRequest;
use forja::models::api_key::ApiKeyPermission;
use forja::models::redirect::Redirect;

use common::{create_test_api_key, create_test_site, test_context};

fn create_req(site_id: Uuid, source: &str, dest: &str, code: i16) -> CreateRedirectRequest {
    CreateRedirectRequest {
        source_path: source.to_string(),
        destination_path: dest.to_string(),
        status_code: code,
        is_active: Some(true),
        description: None,
        site_id,
    }
}

#[tokio::test]
#[serial]
async fn lookup_returns_200_with_each_allowed_status_code() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    for code in [301_i16, 302, 307, 308] {
        let suffix = &Uuid::new_v4().to_string()[..8];
        let source = format!("/old-{code}-{suffix}");
        let dest = format!("/new-{code}-{suffix}");
        Redirect::create(&ctx.pool, create_req(site_id, &source, &dest, code))
            .await
            .unwrap_or_else(|e| panic!("seed redirect with status_code {code} failed: {e:?}"));

        let resp = ctx
            .server
            .get(&format!("/api/v1/sites/{site_id}/redirects/lookup"))
            .add_query_param("path", &source)
            .add_header("x-api-key", key.as_str())
            .await;

        resp.assert_status_ok();
        let body: serde_json::Value = resp.json();
        assert_eq!(
            body["destination_path"], dest,
            "destination_path for {code}"
        );
        assert_eq!(body["status_code"], code, "status_code for {code}");
    }
}

#[tokio::test]
#[serial]
async fn lookup_returns_404_when_no_redirect_matches() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/sites/{site_id}/redirects/lookup"))
        .add_query_param("path", "/does-not-exist")
        .add_header("x-api-key", key.as_str())
        .await;

    assert_eq!(
        resp.status_code(),
        StatusCode::NOT_FOUND,
        "missing redirect must surface as 404, not 200 with a null body"
    );
}

#[tokio::test]
#[serial]
async fn create_rejects_status_code_outside_allowed_domain() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;

    let resp = ctx
        .server
        .post(&format!("/api/v1/sites/{site_id}/redirects"))
        .add_header("x-api-key", key.as_str())
        .json(&serde_json::json!({
            "source_path": "/old",
            "destination_path": "/new",
            "status_code": 200,
            "site_id": site_id,
        }))
        .await;

    assert_eq!(
        resp.status_code(),
        StatusCode::UNPROCESSABLE_ENTITY,
        "validator must reject status_code = 200 (ValidatedJson seam → 422)"
    );
}

#[tokio::test]
#[serial]
async fn db_check_constraint_rejects_status_code_outside_domain() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;

    let result = sqlx::query(
        r#"
        INSERT INTO redirects (site_id, source_path, destination_path, status_code)
        VALUES ($1, '/db-old', '/db-new', 305)
        "#,
    )
    .bind(site_id)
    .execute(&ctx.pool)
    .await;

    let err = result.expect_err("DB CHECK must reject status_code = 305");
    let msg = format!("{err}");
    assert!(
        msg.contains("chk_redirect_status_code"),
        "expected chk_redirect_status_code violation, got: {msg}"
    );
}
