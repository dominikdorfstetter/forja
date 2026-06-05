//! Integration tests for the private-document TTL (#695), 3-attempt
//! lockout (#696), and admin unlock endpoint (#697). Drives the public
//! HTTP surface where possible; uses repo setup for fixture construction.

mod common;

use chrono::{Duration, Utc};
use serde_json::json;
use serial_test::serial;
use uuid::Uuid;

use forja::dto::document::CreateDocumentRequest;
use forja::repos::document_repo::DocumentRepo;
use forja::services::document_encryption;

use common::{create_test_api_key, create_test_site, test_context, TestContext};

async fn enable_documents_module(pool: &sqlx::PgPool, site_id: Uuid) {
    sqlx::query(
        r#"INSERT INTO site_settings (site_id, setting_key, setting_value)
           VALUES ($1, 'module_documents_enabled', to_jsonb(TRUE))
           ON CONFLICT (site_id, setting_key) DO UPDATE SET setting_value = to_jsonb(TRUE)"#,
    )
    .bind(site_id)
    .execute(pool)
    .await
    .expect("enable documents module");
}

const PASSWORD: &str = "correct-horse-battery-staple";
const PLAINTEXT: &[u8] = b"top-secret-document-payload";

struct PrivateDocFixture {
    site_id: Uuid,
    document_id: Uuid,
}

async fn make_private_document(ctx: &TestContext) -> PrivateDocFixture {
    let site_id = create_test_site(&ctx.pool).await;
    enable_documents_module(&ctx.pool, site_id).await;

    let req = CreateDocumentRequest {
        url: None,
        file_data: None,
        file_name: Some(format!("doc-{}.txt", &Uuid::new_v4().to_string()[..8])),
        file_size: Some(PLAINTEXT.len() as i64),
        mime_type: Some("text/plain".into()),
        document_type: "pdf".into(),
        folder_id: None,
        display_order: 0,
    };
    let doc = DocumentRepo::create(&ctx.pool, site_id, &req, Some(PLAINTEXT.to_vec()))
        .await
        .expect("create document");

    let encrypted = document_encryption::encrypt_document(PLAINTEXT, PASSWORD, None, None)
        .expect("encrypt document");

    DocumentRepo::set_privacy(
        &ctx.pool,
        doc.id,
        &encrypted.ciphertext,
        &encrypted.password_hash,
        &encrypted.salt,
        &encrypted.nonce,
        encrypted.encrypted_dek.as_deref(),
        encrypted.key_version,
        None,
    )
    .await
    .expect("set_privacy");

    PrivateDocFixture {
        site_id,
        document_id: doc.id,
    }
}

async fn force_expiry(pool: &sqlx::PgPool, id: Uuid) {
    let past = Utc::now() - Duration::minutes(5);
    sqlx::query("UPDATE documents SET private_access_expires_at = $2 WHERE id = $1")
        .bind(id)
        .bind(past)
        .execute(pool)
        .await
        .expect("force expiry");
}

#[tokio::test]
#[serial]
async fn verify_access_returns_410_on_expired_document() {
    let ctx = test_context().await;
    let fix = make_private_document(&ctx).await;
    force_expiry(&ctx.pool, fix.document_id).await;

    let resp = ctx
        .server
        .post(&format!(
            "/api/v1/documents/{}/verify-access",
            fix.document_id
        ))
        .json(&json!({ "password": PASSWORD }))
        .await;

    assert_eq!(resp.status_code(), 410);
    let body: serde_json::Value = resp.json();
    assert_eq!(body["code"], "DOCUMENT_EXPIRED");
}

#[tokio::test]
#[serial]
async fn verify_access_expired_takes_precedence_over_wrong_password() {
    let ctx = test_context().await;
    let fix = make_private_document(&ctx).await;
    force_expiry(&ctx.pool, fix.document_id).await;

    let resp = ctx
        .server
        .post(&format!(
            "/api/v1/documents/{}/verify-access",
            fix.document_id
        ))
        .json(&json!({ "password": "wrong-password" }))
        .await;

    // Wrong password on an expired doc still returns 410 — no info leak.
    assert_eq!(resp.status_code(), 410);
}

#[tokio::test]
#[serial]
async fn three_wrong_passwords_lock_the_document() {
    let ctx = test_context().await;
    let fix = make_private_document(&ctx).await;

    for attempt in 1..=3 {
        let resp = ctx
            .server
            .post(&format!(
                "/api/v1/documents/{}/verify-access",
                fix.document_id
            ))
            .json(&json!({ "password": "wrong" }))
            .await;
        if attempt < 3 {
            assert_eq!(resp.status_code(), 403, "attempt {} expected 403", attempt);
            let body: serde_json::Value = resp.json();
            assert_eq!(body["code"], "DOCUMENT_PASSWORD_INCORRECT");
        } else {
            // Third wrong attempt: handler reports 423 (now locked).
            assert_eq!(resp.status_code(), 423);
            let body: serde_json::Value = resp.json();
            assert_eq!(body["code"], "DOCUMENT_LOCKED");
        }
    }

    // 4th attempt — even with the CORRECT password — still 423.
    let resp = ctx
        .server
        .post(&format!(
            "/api/v1/documents/{}/verify-access",
            fix.document_id
        ))
        .json(&json!({ "password": PASSWORD }))
        .await;
    assert_eq!(resp.status_code(), 423);
}

#[tokio::test]
#[serial]
async fn correct_password_before_lockout_resets_counter() {
    let ctx = test_context().await;
    let fix = make_private_document(&ctx).await;

    // Two wrong attempts.
    for _ in 0..2 {
        let r = ctx
            .server
            .post(&format!(
                "/api/v1/documents/{}/verify-access",
                fix.document_id
            ))
            .json(&json!({ "password": "wrong" }))
            .await;
        assert_eq!(r.status_code(), 403);
    }

    // Correct password: should succeed and reset counter.
    let r = ctx
        .server
        .post(&format!(
            "/api/v1/documents/{}/verify-access",
            fix.document_id
        ))
        .json(&json!({ "password": PASSWORD }))
        .await;
    assert_eq!(r.status_code(), 200);

    let count: i32 =
        sqlx::query_scalar("SELECT private_failed_attempt_count FROM documents WHERE id = $1")
            .bind(fix.document_id)
            .fetch_one(&ctx.pool)
            .await
            .unwrap();
    assert_eq!(count, 0, "counter resets on successful verify");

    // After reset, two more wrong attempts must NOT lock (counter starts from 0).
    for _ in 0..2 {
        let r = ctx
            .server
            .post(&format!(
                "/api/v1/documents/{}/verify-access",
                fix.document_id
            ))
            .json(&json!({ "password": "wrong" }))
            .await;
        assert_eq!(r.status_code(), 403);
    }
    let locked: Option<chrono::DateTime<Utc>> =
        sqlx::query_scalar("SELECT private_locked_until FROM documents WHERE id = $1")
            .bind(fix.document_id)
            .fetch_one(&ctx.pool)
            .await
            .unwrap();
    assert!(locked.is_none(), "still not locked after reset");
}

#[tokio::test]
#[serial]
async fn unlock_endpoint_clears_lockout_and_allows_retry() {
    let ctx = test_context().await;
    let fix = make_private_document(&ctx).await;

    // Lock the document.
    for _ in 0..3 {
        let _ = ctx
            .server
            .post(&format!(
                "/api/v1/documents/{}/verify-access",
                fix.document_id
            ))
            .json(&json!({ "password": "wrong" }))
            .await;
    }

    let write_key = create_test_api_key(
        &ctx.pool,
        fix.site_id,
        forja::models::api_key::ApiKeyPermission::Write,
    )
    .await;

    let unlock = ctx
        .server
        .post(&format!(
            "/api/v1/documents/{}/unlock-access",
            fix.document_id
        ))
        .add_header("x-api-key", &write_key)
        .await;
    assert_eq!(unlock.status_code(), 204);

    // Now correct password should succeed.
    let r = ctx
        .server
        .post(&format!(
            "/api/v1/documents/{}/verify-access",
            fix.document_id
        ))
        .json(&json!({ "password": PASSWORD }))
        .await;
    assert_eq!(r.status_code(), 200);
}

#[tokio::test]
#[serial]
async fn unlock_endpoint_on_unlocked_document_returns_409() {
    let ctx = test_context().await;
    let fix = make_private_document(&ctx).await;

    let write_key = create_test_api_key(
        &ctx.pool,
        fix.site_id,
        forja::models::api_key::ApiKeyPermission::Write,
    )
    .await;

    let resp = ctx
        .server
        .post(&format!(
            "/api/v1/documents/{}/unlock-access",
            fix.document_id
        ))
        .add_header("x-api-key", &write_key)
        .await;
    assert_eq!(resp.status_code(), 409);
    let body: serde_json::Value = resp.json();
    assert_eq!(body["code"], "DOCUMENT_NOT_LOCKED");
}

#[tokio::test]
#[serial]
async fn unlock_endpoint_rejects_read_role() {
    let ctx = test_context().await;
    let fix = make_private_document(&ctx).await;

    let read_key = create_test_api_key(
        &ctx.pool,
        fix.site_id,
        forja::models::api_key::ApiKeyPermission::Read,
    )
    .await;

    let resp = ctx
        .server
        .post(&format!(
            "/api/v1/documents/{}/unlock-access",
            fix.document_id
        ))
        .add_header("x-api-key", &read_key)
        .await;
    assert!(
        resp.status_code() == 401 || resp.status_code() == 403,
        "Read key must not unlock — got {}",
        resp.status_code()
    );
}

#[tokio::test]
#[serial]
async fn set_privacy_rejects_past_ttl() {
    // We can't easily call set_privacy through the API without going via
    // create_document first (which itself needs WriteKey + the file). The
    // validation logic lives in the handler — so we exercise it through
    // the live endpoint with a fresh document.
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    enable_documents_module(&ctx.pool, site_id).await;
    let write_key = create_test_api_key(
        &ctx.pool,
        site_id,
        forja::models::api_key::ApiKeyPermission::Write,
    )
    .await;

    let create_resp = ctx
        .server
        .post(&format!("/api/v1/sites/{}/documents", site_id))
        .add_header("x-api-key", &write_key)
        .json(&json!({
            "url": null,
            "file_data": base64::Engine::encode(&base64::engine::general_purpose::STANDARD, b"data"),
            "file_name": "t.txt",
            "file_size": 4,
            "mime_type": "text/plain",
            "document_type": "pdf",
            "display_order": 0
        }))
        .await;
    if create_resp.status_code() != 201 {
        let body: serde_json::Value = create_resp.json();
        panic!(
            "create doc failed: {} {:?}",
            create_resp.status_code(),
            body
        );
    }
    let doc_id = create_resp.json::<serde_json::Value>()["id"]
        .as_str()
        .unwrap()
        .to_string();

    let past = Utc::now() - Duration::hours(1);
    let resp = ctx
        .server
        .post(&format!("/api/v1/documents/{}/privacy", doc_id))
        .add_header("x-api-key", &write_key)
        .json(&json!({
            "password": PASSWORD,
            "expires_at": past,
        }))
        .await;
    assert_eq!(resp.status_code(), 400);
    let body: serde_json::Value = resp.json();
    assert_eq!(body["code"], "DOCUMENT_INVALID_TTL");
}

#[tokio::test]
#[serial]
async fn set_privacy_rejects_ttl_over_one_year() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    enable_documents_module(&ctx.pool, site_id).await;
    let write_key = create_test_api_key(
        &ctx.pool,
        site_id,
        forja::models::api_key::ApiKeyPermission::Write,
    )
    .await;

    let create_resp = ctx
        .server
        .post(&format!("/api/v1/sites/{}/documents", site_id))
        .add_header("x-api-key", &write_key)
        .json(&json!({
            "url": null,
            "file_data": base64::Engine::encode(&base64::engine::general_purpose::STANDARD, b"data"),
            "file_name": "t.txt",
            "file_size": 4,
            "mime_type": "text/plain",
            "document_type": "pdf",
            "display_order": 0
        }))
        .await;
    let doc_id = create_resp.json::<serde_json::Value>()["id"]
        .as_str()
        .unwrap()
        .to_string();

    let too_far = Utc::now() + Duration::days(400);
    let resp = ctx
        .server
        .post(&format!("/api/v1/documents/{}/privacy", doc_id))
        .add_header("x-api-key", &write_key)
        .json(&json!({
            "password": PASSWORD,
            "expires_at": too_far,
        }))
        .await;
    assert_eq!(resp.status_code(), 400);
    let body: serde_json::Value = resp.json();
    assert_eq!(body["code"], "DOCUMENT_INVALID_TTL");
}

#[tokio::test]
#[serial]
async fn set_privacy_accepts_valid_ttl_and_verify_succeeds_before_expiry() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    enable_documents_module(&ctx.pool, site_id).await;
    let write_key = create_test_api_key(
        &ctx.pool,
        site_id,
        forja::models::api_key::ApiKeyPermission::Write,
    )
    .await;

    let create_resp = ctx
        .server
        .post(&format!("/api/v1/sites/{}/documents", site_id))
        .add_header("x-api-key", &write_key)
        .json(&json!({
            "url": null,
            "file_data": base64::Engine::encode(&base64::engine::general_purpose::STANDARD, b"data"),
            "file_name": "t.txt",
            "file_size": 4,
            "mime_type": "text/plain",
            "document_type": "pdf",
            "display_order": 0
        }))
        .await;
    let doc_id = create_resp.json::<serde_json::Value>()["id"]
        .as_str()
        .unwrap()
        .to_string();

    let exp = Utc::now() + Duration::hours(24);
    let resp = ctx
        .server
        .post(&format!("/api/v1/documents/{}/privacy", doc_id))
        .add_header("x-api-key", &write_key)
        .json(&json!({
            "password": PASSWORD,
            "expires_at": exp,
        }))
        .await;
    assert_eq!(resp.status_code(), 200);

    let verify = ctx
        .server
        .post(&format!("/api/v1/documents/{}/verify-access", doc_id))
        .json(&json!({ "password": PASSWORD }))
        .await;
    assert_eq!(verify.status_code(), 200);
}
