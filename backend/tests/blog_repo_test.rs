//! Integration tests for `repos::blog_repo::BlogRepo`.
//!
//! Phase 2 of #520 (issue #533). The tracer test asserts that the new
//! repository round-trips a blog through `create` → `find_by_id` so the
//! port from `models::blog::Blog` preserves end-to-end behaviour.

mod common;

use chrono::NaiveDate;
use serial_test::serial;
use uuid::Uuid;

use forja::dto::blog::CreateBlogRequest;
use forja::models::content::ContentStatus;
use forja::repos::blog_repo::BlogRepo;

use common::{create_test_site, test_db_pool};

#[tokio::test]
#[serial]
async fn tracer_blog_repo_round_trip_via_create_and_find_by_id() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    let req = CreateBlogRequest {
        slug: Some(format!("repo-tracer-{}", &Uuid::new_v4().to_string()[..8])),
        title: Some("Repo Tracer".to_string()),
        author: "Test Author".to_string(),
        published_date: NaiveDate::from_ymd_opt(2026, 5, 8).expect("valid date"),
        reading_time_minutes: Some(4),
        cover_image_id: None,
        header_image_id: None,
        is_featured: true,
        allow_comments: false,
        status: ContentStatus::Draft,
        publish_start: None,
        publish_end: None,
        site_ids: vec![site_id],
    };

    let created = BlogRepo::create(&mut pool.acquire().await.unwrap(), req, Some("test-user"))
        .await
        .expect("BlogRepo::create succeeds");

    let fetched = BlogRepo::find_by_id(&pool, created.id)
        .await
        .expect("BlogRepo::find_by_id succeeds");

    assert_eq!(fetched.id, created.id);
    assert_eq!(fetched.author, "Test Author");
    assert_eq!(fetched.published_date, created.published_date);
    assert!(fetched.is_featured);
    assert!(!fetched.allow_comments);
    assert_eq!(fetched.status, ContentStatus::Draft);
}

#[tokio::test]
#[serial]
async fn featured_blogs_filter_excludes_non_featured_via_repo() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    let featured = BlogRepo::create(
        &mut pool.acquire().await.unwrap(),
        CreateBlogRequest {
            slug: Some(format!("feat-{}", &Uuid::new_v4().to_string()[..8])),
            title: Some("Featured".to_string()),
            author: "A".to_string(),
            published_date: NaiveDate::from_ymd_opt(2026, 5, 8).expect("valid date"),
            reading_time_minutes: Some(1),
            cover_image_id: None,
            header_image_id: None,
            is_featured: true,
            allow_comments: true,
            status: ContentStatus::Published,
            publish_start: None,
            publish_end: None,
            site_ids: vec![site_id],
        },
        Some("test-user"),
    )
    .await
    .expect("create featured blog");

    let _plain = BlogRepo::create(
        &mut pool.acquire().await.unwrap(),
        CreateBlogRequest {
            slug: Some(format!("plain-{}", &Uuid::new_v4().to_string()[..8])),
            title: Some("Plain".to_string()),
            author: "B".to_string(),
            published_date: NaiveDate::from_ymd_opt(2026, 5, 7).expect("valid date"),
            reading_time_minutes: Some(1),
            cover_image_id: None,
            header_image_id: None,
            is_featured: false,
            allow_comments: true,
            status: ContentStatus::Published,
            publish_start: None,
            publish_end: None,
            site_ids: vec![site_id],
        },
        Some("test-user"),
    )
    .await
    .expect("create plain blog");

    let featured_only = BlogRepo::find_featured_for_site(&pool, site_id, 10)
        .await
        .expect("find_featured_for_site");

    assert_eq!(featured_only.len(), 1);
    assert_eq!(featured_only[0].id, featured.id);
}

/// Seed three blogs (distinct author / slug / status) on a fresh site.
/// These pin the filtered-list behaviour so the #834 refactor (folding the
/// hand-rolled WHERE builder into `ContentQuery`) provably preserves results.
async fn seed_filter_fixture(pool: &sqlx::PgPool) -> Uuid {
    let site_id = create_test_site(pool).await;

    let seed = |author: &'static str, slug: &str, status: ContentStatus, date: (i32, u32, u32)| {
        CreateBlogRequest {
            slug: Some(slug.to_string()),
            title: Some(author.to_string()),
            author: author.to_string(),
            published_date: NaiveDate::from_ymd_opt(date.0, date.1, date.2).expect("valid date"),
            reading_time_minutes: Some(1),
            cover_image_id: None,
            header_image_id: None,
            is_featured: false,
            allow_comments: true,
            status,
            publish_start: None,
            publish_end: None,
            site_ids: vec![site_id],
        }
    };

    let uniq = &Uuid::new_v4().to_string()[..8];
    for (author, slug, status, date) in [
        (
            "Alice",
            format!("alpha-{uniq}"),
            ContentStatus::Published,
            (2026, 5, 10),
        ),
        (
            "Bob",
            format!("beta-{uniq}"),
            ContentStatus::Draft,
            (2026, 5, 9),
        ),
        (
            "Carol",
            format!("gamma-{uniq}"),
            ContentStatus::Archived,
            (2026, 5, 8),
        ),
    ] {
        BlogRepo::create(
            &mut pool.acquire().await.unwrap(),
            seed(author, &slug, status, date),
            Some("test-user"),
        )
        .await
        .expect("seed blog");
    }

    site_id
}

#[tokio::test]
#[serial]
async fn filtered_list_by_search_matches_slug_and_count_agrees() {
    let pool = test_db_pool().await;
    let site_id = seed_filter_fixture(&pool).await;

    let rows = BlogRepo::find_all_for_site_filtered(
        &pool,
        site_id,
        10,
        0,
        Some("alpha"),
        None,
        None,
        None,
        None,
    )
    .await
    .expect("filtered list");
    assert_eq!(
        rows.len(),
        1,
        "search 'alpha' should match exactly one slug"
    );
    assert_eq!(rows[0].author, "Alice");

    let total = BlogRepo::count_for_site_filtered(&pool, site_id, Some("alpha"), None, None)
        .await
        .expect("filtered count");
    assert_eq!(total, 1, "count must agree with the filtered row set");
}

#[tokio::test]
#[serial]
async fn filtered_list_by_status_returns_only_that_status() {
    let pool = test_db_pool().await;
    let site_id = seed_filter_fixture(&pool).await;

    let rows = BlogRepo::find_all_for_site_filtered(
        &pool,
        site_id,
        10,
        0,
        None,
        Some("Published"),
        None,
        None,
        None,
    )
    .await
    .expect("filtered list");
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].author, "Alice");
    assert_eq!(rows[0].status, ContentStatus::Published);
}

#[tokio::test]
#[serial]
async fn filtered_list_excludes_status_and_orders_by_author_asc() {
    let pool = test_db_pool().await;
    let site_id = seed_filter_fixture(&pool).await;

    let rows = BlogRepo::find_all_for_site_filtered(
        &pool,
        site_id,
        10,
        0,
        None,
        None,
        Some("author"),
        Some("asc"),
        Some("Archived"),
    )
    .await
    .expect("filtered list");
    let authors: Vec<&str> = rows.iter().map(|r| r.author.as_str()).collect();
    assert_eq!(
        authors,
        vec!["Alice", "Bob"],
        "Carol (Archived) excluded, sorted asc"
    );

    let total = BlogRepo::count_for_site_filtered(&pool, site_id, None, None, Some("Archived"))
        .await
        .expect("filtered count");
    assert_eq!(total, 2);
}

#[tokio::test]
#[serial]
async fn filtered_list_orders_by_author_desc_with_pagination() {
    let pool = test_db_pool().await;
    let site_id = seed_filter_fixture(&pool).await;

    let page1 = BlogRepo::find_all_for_site_filtered(
        &pool,
        site_id,
        1,
        0,
        None,
        None,
        Some("author"),
        Some("desc"),
        None,
    )
    .await
    .expect("page 1");
    assert_eq!(page1.len(), 1);
    assert_eq!(page1[0].author, "Carol", "desc order: Carol first");

    let page2 = BlogRepo::find_all_for_site_filtered(
        &pool,
        site_id,
        1,
        1,
        None,
        None,
        Some("author"),
        Some("desc"),
        None,
    )
    .await
    .expect("page 2");
    assert_eq!(page2.len(), 1);
    assert_eq!(page2[0].author, "Bob", "desc order, offset 1: Bob second");
}
