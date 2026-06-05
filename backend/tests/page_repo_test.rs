//! Integration tests for `repos::page_repo::PageRepo`.
//!
//! Phase 2 of #520 (issue #533, page entity). Tracer-bullet round-trip
//! through `PageRepo::create` → `PageRepo::find_by_id`.

mod common;

use serial_test::serial;
use uuid::Uuid;

use forja::dto::page::CreatePageRequest;
use forja::models::content::ContentStatus;
use forja::models::page::PageType;
use forja::repos::page_repo::PageRepo;

use common::{create_test_site, test_db_pool};

#[tokio::test]
#[serial]
async fn tracer_page_repo_round_trip_via_create_and_find_by_id() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    let suffix = &Uuid::new_v4().to_string()[..8];
    let req = CreatePageRequest {
        route: format!("/repo-tracer-{}", suffix),
        slug: Some(format!("repo-tracer-{}", suffix)),
        page_type: PageType::Static,
        template: None,
        is_in_navigation: true,
        navigation_order: Some(1),
        parent_page_id: None,
        status: ContentStatus::Draft,
        publish_start: None,
        publish_end: None,
        site_ids: vec![site_id],
    };

    let created = PageRepo::create(&mut pool.acquire().await.unwrap(), req, Some("test-user"))
        .await
        .expect("PageRepo::create succeeds");

    let fetched = PageRepo::find_by_id(&pool, created.id)
        .await
        .expect("PageRepo::find_by_id succeeds");

    assert_eq!(fetched.id, created.id);
    assert_eq!(fetched.route, format!("/repo-tracer-{}", suffix));
    assert_eq!(fetched.page_type, PageType::Static);
    assert_eq!(fetched.status, ContentStatus::Draft);
    assert!(fetched.is_in_navigation);
}
