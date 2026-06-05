//! Integration tests for the i18n'd document password page (#698).
//! Drives the public download endpoint and asserts on the rendered HTML.

mod common;

use chrono::{Duration, Utc};
use serial_test::serial;
use uuid::Uuid;

use forja::dto::document::CreateDocumentRequest;
use forja::repos::document_repo::DocumentRepo;
use forja::services::document_encryption;

use common::{create_test_site, test_context, TestContext};

const PASSWORD: &str = "correct-horse-battery-staple";

async fn seed_private_doc(ctx: &TestContext) -> Uuid {
    let site_id = create_test_site(&ctx.pool).await;
    let req = CreateDocumentRequest {
        url: None,
        file_data: None,
        file_name: Some("secret.pdf".into()),
        file_size: Some(5),
        mime_type: Some("application/pdf".into()),
        document_type: "pdf".into(),
        folder_id: None,
        display_order: 0,
    };
    let doc = DocumentRepo::create(&ctx.pool, site_id, &req, Some(b"hello".to_vec()))
        .await
        .expect("create doc");

    let encrypted =
        document_encryption::encrypt_document(b"hello", PASSWORD, None, None).expect("encrypt");
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
    doc.id
}

#[tokio::test]
#[serial]
async fn password_page_default_locale_is_english() {
    let ctx = test_context().await;
    let id = seed_private_doc(&ctx).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/documents/{}/download", id))
        .await;
    assert_eq!(resp.status_code(), 401);
    let body = resp.text();
    assert!(
        body.contains(r#"<html lang="en""#),
        "expected html lang=en, got: {}",
        body.lines().take(2).collect::<Vec<_>>().join("\n")
    );
    assert!(body.contains("Protected Document"));
    assert!(body.contains(r#"dir="ltr""#));
}

#[tokio::test]
#[serial]
async fn password_page_negotiates_german_via_accept_language() {
    let ctx = test_context().await;
    let id = seed_private_doc(&ctx).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/documents/{}/download", id))
        .add_header("accept-language", "de-CH, de;q=0.9, en;q=0.1")
        .await;
    assert_eq!(resp.status_code(), 401);
    let body = resp.text();
    assert!(
        body.contains(r#"<html lang="de""#),
        "expected German lang attribute"
    );
    assert!(body.contains("Geschütztes Dokument"));
}

#[tokio::test]
#[serial]
async fn password_page_arabic_is_rtl() {
    let ctx = test_context().await;
    let id = seed_private_doc(&ctx).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/documents/{}/download", id))
        .add_header("accept-language", "ar")
        .await;
    let body = resp.text();
    assert!(body.contains(r#"<html lang="ar""#));
    assert!(body.contains(r#"dir="rtl""#));
    assert!(body.contains("مستند محمي"));
}

#[tokio::test]
#[serial]
async fn password_page_unsupported_locale_falls_back_to_english() {
    let ctx = test_context().await;
    let id = seed_private_doc(&ctx).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/documents/{}/download", id))
        .add_header("accept-language", "zh-CN, ja;q=0.5")
        .await;
    let body = resp.text();
    assert!(body.contains(r#"<html lang="en""#));
    assert!(body.contains("Protected Document"));
}

#[tokio::test]
#[serial]
async fn password_page_shows_expired_banner_in_chosen_locale() {
    let ctx = test_context().await;
    let id = seed_private_doc(&ctx).await;
    let past = Utc::now() - Duration::hours(1);
    sqlx::query("UPDATE documents SET private_access_expires_at = $2 WHERE id = $1")
        .bind(id)
        .bind(past)
        .execute(&ctx.pool)
        .await
        .unwrap();

    let resp = ctx
        .server
        .get(&format!("/api/v1/documents/{}/download", id))
        .add_header("accept-language", "fr")
        .await;
    let body = resp.text();
    assert!(body.contains(r#"<html lang="fr""#));
    // French "expired" string from the locale shard.
    assert!(
        body.contains("Ce document n'est plus disponible"),
        "expected French expired banner in response body"
    );
}

#[tokio::test]
#[serial]
async fn password_page_shows_locked_banner_in_chosen_locale() {
    let ctx = test_context().await;
    let id = seed_private_doc(&ctx).await;
    // Force lockout state.
    sqlx::query(
        "UPDATE documents SET private_locked_until = TIMESTAMPTZ '9999-12-31 23:59:59+00' WHERE id = $1",
    )
    .bind(id)
    .execute(&ctx.pool)
    .await
    .unwrap();

    let resp = ctx
        .server
        .get(&format!("/api/v1/documents/{}/download", id))
        .add_header("accept-language", "pl")
        .await;
    let body = resp.text();
    assert!(body.contains(r#"<html lang="pl""#));
    assert!(body.contains("Zbyt wiele błędnych prób"));
}
