//! Issue #875 / ADR 0003 — uniform content route convention for documents.
//!
//! `GET /documents/{id}` returns the lightweight `DocumentListItem`
//! (no `localizations[]`); `GET /documents/{id}/detail` returns the full
//! `DocumentResponse` (with `localizations[]`). This pins the altitude split.

mod common;

use serial_test::serial;
use uuid::Uuid;

use forja::dto::document::{CreateDocumentLocalizationRequest, CreateDocumentRequest};
use forja::models::api_key::ApiKeyPermission;
use forja::repos::document_repo::{DocumentLocalizationRepo, DocumentRepo};

use common::{create_test_api_key, create_test_site, enable_module, test_context};

async fn locale_id(pool: &sqlx::PgPool, code: &str) -> Uuid {
    use sqlx::Row;
    sqlx::query("SELECT id FROM locales WHERE code = $1")
        .bind(code)
        .fetch_one(pool)
        .await
        .expect("seeded locale row")
        .get::<Uuid, _>(0)
}

/// Create a document with one localization. Returns `(site_id, document_id)`.
async fn seed_localized_document(pool: &sqlx::PgPool) -> (Uuid, Uuid) {
    let site_id = create_test_site(pool).await;
    enable_module(pool, site_id, "documents").await;
    let req = CreateDocumentRequest {
        url: None,
        file_data: Some(base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            b"hello",
        )),
        file_name: Some(format!("doc-{}.txt", &Uuid::new_v4().to_string()[..8])),
        file_size: Some(5),
        mime_type: Some("text/plain".into()),
        document_type: "pdf".into(),
        folder_id: None,
        display_order: 0,
    };
    let doc = DocumentRepo::create(pool, site_id, &req, Some(b"hello".to_vec()))
        .await
        .expect("create document");

    let en = locale_id(pool, "en").await;
    DocumentLocalizationRepo::create(
        pool,
        doc.id,
        CreateDocumentLocalizationRequest {
            locale_id: en,
            name: "Getting Started".into(),
            description: Some("Guide".into()),
        },
    )
    .await
    .expect("create document localization");

    (site_id, doc.id)
}

/// ADR 0003 tracer bullet: bare route is lightweight, `/detail` is full.
#[tokio::test]
#[serial]
async fn bare_route_omits_localizations_detail_includes_them() {
    let ctx = test_context().await;
    let (site_id, doc_id) = seed_localized_document(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let bare = ctx
        .server
        .get(&format!("/api/v1/documents/{doc_id}"))
        .add_header("x-api-key", key.as_str())
        .await;
    bare.assert_status_ok();
    let bare_body: serde_json::Value = bare.json();
    assert_eq!(bare_body["id"], doc_id.to_string());
    assert!(
        bare_body.get("localizations").is_none(),
        "lightweight DocumentListItem omits localizations[]"
    );

    let detail = ctx
        .server
        .get(&format!("/api/v1/documents/{doc_id}/detail"))
        .add_header("x-api-key", key.as_str())
        .await;
    detail.assert_status_ok();
    let detail_body: serde_json::Value = detail.json();
    let locs = detail_body["localizations"]
        .as_array()
        .expect("detail exposes localizations[]");
    assert_eq!(
        locs.len(),
        1,
        "the seeded localization is hydrated on detail"
    );
}
