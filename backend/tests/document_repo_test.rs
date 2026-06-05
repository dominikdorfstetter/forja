//! Integration tests for `repos::document_repo`. Phase 2 of #520
//! (issue #533, document entity).

mod common;

use serial_test::serial;
use uuid::Uuid;

use forja::dto::document::CreateDocumentRequest;
use forja::repos::document_repo::DocumentRepo;

use common::{create_test_site, test_db_pool};

#[tokio::test]
#[serial]
async fn tracer_document_repo_round_trip_via_create_and_find_by_id() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    let req = CreateDocumentRequest {
        url: Some(format!(
            "https://example.com/doc-{}.pdf",
            &Uuid::new_v4().to_string()[..8]
        )),
        file_data: None,
        file_name: None,
        file_size: None,
        mime_type: None,
        document_type: "pdf".to_string(),
        folder_id: None,
        display_order: 0,
    };

    let created = DocumentRepo::create(&pool, site_id, &req, None)
        .await
        .expect("DocumentRepo::create succeeds");

    let fetched = DocumentRepo::find_by_id(&pool, created.id)
        .await
        .expect("DocumentRepo::find_by_id succeeds");

    assert_eq!(fetched.id, created.id);
    assert_eq!(fetched.document_type, "pdf");
    assert!(!fetched.is_private);
}
