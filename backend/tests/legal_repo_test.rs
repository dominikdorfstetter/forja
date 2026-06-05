//! Integration tests for `repos::legal_repo`.
//!
//! Phase 2 of #520 (issue #533, legal entity).

mod common;

use serial_test::serial;
use uuid::Uuid;

use forja::dto::legal::CreateLegalDocumentRequest;
use forja::models::content::ContentStatus;
use forja::models::legal::LegalDocType;
use forja::repos::legal_repo::LegalDocumentRepo;

use common::{create_test_site, test_db_pool};

#[tokio::test]
#[serial]
async fn tracer_legal_repo_round_trip_via_create_and_find_by_id() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    let req = CreateLegalDocumentRequest {
        cookie_name: format!("tracer-{}", &Uuid::new_v4().to_string()[..8]),
        document_type: LegalDocType::PrivacyPolicy,
        status: ContentStatus::Draft,
        site_ids: vec![site_id],
    };

    let created =
        LegalDocumentRepo::create(&mut pool.acquire().await.unwrap(), req, Some("test-user"))
            .await
            .expect("LegalDocumentRepo::create succeeds");

    let fetched = LegalDocumentRepo::find_by_id(&pool, created.id)
        .await
        .expect("LegalDocumentRepo::find_by_id succeeds");

    assert_eq!(fetched.id, created.id);
    assert_eq!(fetched.document_type, LegalDocType::PrivacyPolicy);
    assert_eq!(fetched.version, 1);
    assert!(!fetched.is_deleted);
}
