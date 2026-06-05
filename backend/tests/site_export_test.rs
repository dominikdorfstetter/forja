//! Site export-job HTTP surface (issue #716, epic #708).
//!
//! Vertical-slice TDD: the tracer proves the enqueue → status path;
//! later tests add the persisted requester + audit, the owner/admin
//! role gate, the single-active-job guard, and the unknown-job 404.

mod common;

use serial_test::serial;
use uuid::Uuid;

use forja::errors::codes;
use forja::models::api_key::ApiKeyPermission;

use common::{create_test_api_key, create_test_site, test_context};

#[tokio::test]
#[serial]
async fn tracer_enqueue_then_status_reports_queued() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    // Export is Owner/Admin-gated; the Master key resolves to Owner.
    let owner = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Master).await;

    let create = ctx
        .server
        .post(&format!("/api/v1/sites/{site_id}/export"))
        .add_header("x-api-key", owner.as_str())
        .await;

    assert_eq!(
        create.status_code().as_u16(),
        202,
        "enqueue is accepted, not completed inline"
    );
    let created: serde_json::Value = create.json();
    let job_id = created["id"].as_str().expect("job id present");
    assert_eq!(created["status"], "queued", "fresh job is queued");
    assert!(
        created["download_url"].is_null(),
        "no download URL until the worker finishes"
    );

    let status = ctx
        .server
        .get(&format!("/api/v1/sites/{site_id}/export/{job_id}"))
        .add_header("x-api-key", owner.as_str())
        .await;

    status.assert_status_ok();
    let body: serde_json::Value = status.json();
    assert_eq!(body["id"], job_id, "status reports the same job");
    assert_eq!(body["status"], "queued", "status is still queued");
}

#[tokio::test]
#[serial]
async fn enqueue_persists_requester_and_writes_audit() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let owner = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Master).await;

    let create = ctx
        .server
        .post(&format!("/api/v1/sites/{site_id}/export"))
        .add_header("x-api-key", owner.as_str())
        .await;
    assert_eq!(create.status_code().as_u16(), 202);

    // The job row records who requested it.
    let requested_by: Option<Uuid> =
        sqlx::query_scalar("SELECT requested_by FROM site_export_jobs WHERE site_id = $1")
            .bind(site_id)
            .fetch_one(&ctx.pool)
            .await
            .expect("export job row exists");
    assert!(requested_by.is_some(), "requester is stamped on the job");

    // An audit event is written on the export request.
    let meta: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT metadata FROM audit_logs \
         WHERE site_id = $1 AND entity_type = 'site' AND action = 'export' \
         ORDER BY created_at DESC LIMIT 1",
    )
    .bind(site_id)
    .fetch_one(&ctx.pool)
    .await
    .expect("export audit row exists");
    assert_eq!(
        meta.expect("audit metadata present")["reason"],
        "site_export_requested",
        "audit reason recorded"
    );
}

#[tokio::test]
#[serial]
async fn export_forbidden_for_non_admin() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let reader = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .post(&format!("/api/v1/sites/{site_id}/export"))
        .add_header("x-api-key", reader.as_str())
        .await;

    assert_eq!(resp.status_code().as_u16(), 403);
    let body: serde_json::Value = resp.json();
    assert_eq!(body["code"], codes::SITE_EXPORT_FORBIDDEN);
}

#[tokio::test]
#[serial]
async fn second_request_while_active_is_rejected_without_duplicating() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let owner = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Master).await;

    let first = ctx
        .server
        .post(&format!("/api/v1/sites/{site_id}/export"))
        .add_header("x-api-key", owner.as_str())
        .await;
    assert_eq!(first.status_code().as_u16(), 202);

    let second = ctx
        .server
        .post(&format!("/api/v1/sites/{site_id}/export"))
        .add_header("x-api-key", owner.as_str())
        .await;
    assert_eq!(
        second.status_code().as_u16(),
        409,
        "a queued job blocks a second request"
    );
    let body: serde_json::Value = second.json();
    assert_eq!(body["code"], codes::SITE_EXPORT_ALREADY_RUNNING);

    let job_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM site_export_jobs WHERE site_id = $1")
            .bind(site_id)
            .fetch_one(&ctx.pool)
            .await
            .expect("count query");
    assert_eq!(job_count, 1, "no duplicate job row was created");
}

#[tokio::test]
#[serial]
async fn unknown_or_cross_site_job_is_not_found() {
    let ctx = test_context().await;
    let site_a = create_test_site(&ctx.pool).await;
    let site_b = create_test_site(&ctx.pool).await;
    let key_a = create_test_api_key(&ctx.pool, site_a, ApiKeyPermission::Master).await;
    let key_b = create_test_api_key(&ctx.pool, site_b, ApiKeyPermission::Master).await;

    // Unknown job id on a real site → 404.
    let unknown = Uuid::new_v4();
    let miss = ctx
        .server
        .get(&format!("/api/v1/sites/{site_a}/export/{unknown}"))
        .add_header("x-api-key", key_a.as_str())
        .await;
    assert_eq!(miss.status_code().as_u16(), 404);
    assert_eq!(
        miss.json::<serde_json::Value>()["code"],
        codes::SITE_EXPORT_JOB_NOT_FOUND
    );

    // A job created for site A is invisible (404) when queried via site B
    // — the site scoping blocks cross-site job enumeration.
    let created = ctx
        .server
        .post(&format!("/api/v1/sites/{site_a}/export"))
        .add_header("x-api-key", key_a.as_str())
        .await;
    let job_id = created.json::<serde_json::Value>()["id"]
        .as_str()
        .expect("job id")
        .to_string();

    let cross = ctx
        .server
        .get(&format!("/api/v1/sites/{site_b}/export/{job_id}"))
        .add_header("x-api-key", key_b.as_str())
        .await;
    assert_eq!(cross.status_code().as_u16(), 404);
    assert_eq!(
        cross.json::<serde_json::Value>()["code"],
        codes::SITE_EXPORT_JOB_NOT_FOUND
    );
}
