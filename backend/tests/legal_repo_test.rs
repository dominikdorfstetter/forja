//! Integration tests for `repos::legal_repo`.
//!
//! Phase 2 of #520 (issue #533, legal entity).

mod common;

use serial_test::serial;
use uuid::Uuid;

use forja::dto::legal::CreateLegalDocumentRequest;
use forja::models::content::ContentStatus;
use forja::models::legal::LegalDocType;
use forja::repos::legal_repo::{LegalDocumentRepo, LegalListFilters};
use forja::utils::list_params::ListParams;

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

/// Regression test for the Legal admin list: `status`, `exclude_status`, and
/// `exclude_document_type` must filter the rows AND the count identically.
/// The list shipped without these filters wired (blogs/pages had them), so the
/// status chips and the Active/Archived tabs were no-ops.
#[tokio::test]
#[serial]
async fn list_filters_by_status_and_excludes_cookie_consent() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    let mk = |name: &str, document_type: LegalDocType, status: ContentStatus| {
        CreateLegalDocumentRequest {
            cookie_name: name.to_string(),
            document_type,
            status,
            site_ids: vec![site_id],
        }
    };
    // Fresh site, so exactly these three documents exist on it.
    for req in [
        mk(
            "filters-draft",
            LegalDocType::PrivacyPolicy,
            ContentStatus::Draft,
        ),
        mk(
            "filters-archived",
            LegalDocType::TermsOfService,
            ContentStatus::Archived,
        ),
        mk(
            "filters-cookie",
            LegalDocType::CookieConsent,
            ContentStatus::Draft,
        ),
    ] {
        LegalDocumentRepo::create(&mut pool.acquire().await.unwrap(), req, Some("test-user"))
            .await
            .expect("LegalDocumentRepo::create succeeds");
    }

    let params = ListParams::new(None, None, None, None, None);
    let names = |rows: &[forja::models::legal::LegalDocumentWithContent]| {
        rows.iter()
            .map(|d| d.cookie_name.clone())
            .collect::<Vec<_>>()
    };

    // Archived tab: status=Archived (API PascalCase value, as the admin sends it).
    let archived_only = LegalListFilters {
        status: Some("Archived"),
        ..Default::default()
    };
    let rows =
        LegalDocumentRepo::find_all_for_site_filtered(&pool, site_id, &params, archived_only)
            .await
            .expect("status filter lists");
    assert_eq!(names(&rows), ["filters-archived"]);
    assert_eq!(
        LegalDocumentRepo::count_for_site_filtered(&pool, site_id, archived_only)
            .await
            .expect("status filter counts"),
        1,
        "count must match the filtered rows"
    );

    // Active tab: exclude Archived and hide CookieConsent (own UI surface).
    let active = LegalListFilters {
        exclude_status: Some("Archived"),
        exclude_document_type: Some("CookieConsent"),
        ..Default::default()
    };
    let rows = LegalDocumentRepo::find_all_for_site_filtered(&pool, site_id, &params, active)
        .await
        .expect("exclusion filters list");
    assert_eq!(names(&rows), ["filters-draft"]);
    assert_eq!(
        LegalDocumentRepo::count_for_site_filtered(&pool, site_id, active)
            .await
            .expect("exclusion filters count"),
        1,
        "count must match the filtered rows"
    );

    // No filters: everything on the site is listed (SDK default unchanged).
    let all = LegalDocumentRepo::find_all_for_site_filtered(
        &pool,
        site_id,
        &params,
        LegalListFilters::default(),
    )
    .await
    .expect("unfiltered list");
    assert_eq!(all.len(), 3);
}
