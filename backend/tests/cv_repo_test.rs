//! Integration tests for `repos::cv_repo`. Phase 2 of #520
//! (issue #533, cv entity — sixth and final port).

mod common;

use chrono::NaiveDate;
use serial_test::serial;
use uuid::Uuid;

use forja::dto::cv::CreateCvEntryRequest;
use forja::models::content::ContentStatus;
use forja::models::cv::CvEntryType;
use forja::repos::cv_repo::CvEntryRepo;

use common::{create_test_site, test_db_pool};

#[tokio::test]
#[serial]
async fn tracer_cv_repo_round_trip_via_create_and_find_by_id() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    let req = CreateCvEntryRequest {
        company: format!("Tracer Co {}", &Uuid::new_v4().to_string()[..8]),
        company_url: None,
        company_logo_id: None,
        location: "Remote".to_string(),
        start_date: NaiveDate::from_ymd_opt(2026, 1, 1).expect("valid date"),
        end_date: None,
        is_current: true,
        entry_type: CvEntryType::Work,
        display_order: 0,
        status: ContentStatus::Draft,
        site_ids: vec![site_id],
        localizations: None,
        skill_ids: None,
    };

    let created = CvEntryRepo::create(&mut pool.acquire().await.unwrap(), req, Some("test-user"))
        .await
        .expect("CvEntryRepo::create succeeds");

    let fetched = CvEntryRepo::find_by_id(&pool, created.id)
        .await
        .expect("CvEntryRepo::find_by_id succeeds");

    assert_eq!(fetched.id, created.id);
    assert_eq!(fetched.entry_type, CvEntryType::Work);
    assert!(fetched.is_current);
}
