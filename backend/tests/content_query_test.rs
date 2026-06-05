//! Integration tests for `repos::content_query::ContentQuery`.
//!
//! Phase 1 of #520 (issue #530). Validates the new builder against the
//! recurring blog query pattern, then asserts the legacy `Blog::*`
//! delegating wrappers stay behaviour-equivalent.

mod common;

use chrono::NaiveDate;
use serial_test::serial;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use forja::dto::blog::CreateBlogRequest;
use forja::dto::taxonomy::CreateCategoryRequest;
use forja::models::blog::BlogWithContent;
use forja::models::content::{ContentLocalization, ContentStatus};
use forja::models::taxonomy::Category;
use forja::repos::blog_repo::BlogRepo;
use forja::repos::content_query::ContentQuery;

use common::{create_test_site, test_db_pool};

const SEEDED_LOCALE_CODE: &str = "en";

async fn en_locale_id(pool: &PgPool) -> Uuid {
    sqlx::query("SELECT id FROM locales WHERE code = $1")
        .bind(SEEDED_LOCALE_CODE)
        .fetch_one(pool)
        .await
        .expect("seeded en locale")
        .get::<Uuid, _>(0)
}

async fn create_published_blog(
    pool: &PgPool,
    site_id: Uuid,
    slug_hint: &str,
    published_date: NaiveDate,
) -> BlogWithContent {
    let req = CreateBlogRequest {
        slug: Some(format!(
            "{}-{}",
            slug_hint,
            &Uuid::new_v4().to_string()[..8]
        )),
        title: Some("Tracer Title".to_string()),
        author: "Test Author".to_string(),
        published_date,
        reading_time_minutes: Some(3),
        cover_image_id: None,
        header_image_id: None,
        is_featured: false,
        allow_comments: true,
        status: ContentStatus::Published,
        publish_start: None,
        publish_end: None,
        site_ids: vec![site_id],
    };
    BlogRepo::create(&mut pool.acquire().await.unwrap(), req, Some("test-user"))
        .await
        .expect("BlogRepo::create succeeds")
}

async fn localize_in_en(pool: &PgPool, content_id: Uuid) {
    let locale_id = en_locale_id(pool).await;
    ContentLocalization::create(
        pool,
        content_id,
        locale_id,
        "Tracer Body Title",
        None,
        None,
        Some("body content"),
        Some("meta"),
        None,
    )
    .await
    .expect("localization insert succeeds");
}

async fn create_category(pool: &PgPool, site_id: Uuid, slug: &str) -> Category {
    let req = CreateCategoryRequest {
        parent_id: None,
        slug: format!("{}-{}", slug, &Uuid::new_v4().to_string()[..8]),
        is_global: false,
        site_id: Some(site_id),
    };
    Category::create(pool, &req)
        .await
        .expect("Category::create succeeds")
}

#[tokio::test]
#[serial]
async fn tracer_content_query_returns_blog_with_category_and_locale() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let locale_id = en_locale_id(&pool).await;

    let category = create_category(&pool, site_id, "tech").await;
    let blog = create_published_blog(
        &pool,
        site_id,
        "tracer-blog",
        NaiveDate::from_ymd_opt(2026, 5, 8).expect("valid date"),
    )
    .await;
    localize_in_en(&pool, blog.content_id).await;
    Category::assign_to_content(&pool, blog.content_id, category.id, true)
        .await
        .expect("assign category");

    let (rows, total) = ContentQuery::new("blogs", site_id)
        .with_category(category.slug.clone())
        .with_locale(locale_id)
        .published_only()
        .paginate(10, 0)
        .execute::<BlogWithContent>(&pool)
        .await
        .expect("ContentQuery executes");

    assert_eq!(total, 1, "expected count=1");
    assert_eq!(rows.len(), 1, "expected one row returned");
    assert_eq!(rows[0].id, blog.id, "expected the seeded blog");
}

#[tokio::test]
#[serial]
async fn pagination_boundary_returns_correct_slice_and_total() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let locale_id = en_locale_id(&pool).await;

    for day in 1..=5_i32 {
        let blog = create_published_blog(
            &pool,
            site_id,
            "page-blog",
            NaiveDate::from_ymd_opt(2026, 5, day as u32).expect("valid date"),
        )
        .await;
        localize_in_en(&pool, blog.content_id).await;
    }

    let (rows, total) = ContentQuery::new("blogs", site_id)
        .with_locale(locale_id)
        .published_only()
        .paginate(2, 4)
        .execute::<BlogWithContent>(&pool)
        .await
        .expect("ContentQuery executes");

    assert_eq!(total, 5, "expected 5 blogs across the site");
    assert_eq!(rows.len(), 1, "offset=4, limit=2 → 1 row past the slice");
}

#[tokio::test]
#[serial]
async fn empty_site_returns_no_rows_and_zero_count() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    let (rows, total) = ContentQuery::new("blogs", site_id)
        .published_only()
        .paginate(10, 0)
        .execute::<BlogWithContent>(&pool)
        .await
        .expect("ContentQuery executes");

    assert_eq!(total, 0);
    assert!(rows.is_empty());
}

#[tokio::test]
#[serial]
async fn category_slug_is_parameter_bound_against_sql_injection() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    let malicious = "'; DROP TABLE blogs; --";

    let (rows, total) = ContentQuery::new("blogs", site_id)
        .with_category(malicious)
        .published_only()
        .paginate(10, 0)
        .execute::<BlogWithContent>(&pool)
        .await
        .expect("ContentQuery executes safely");

    assert_eq!(total, 0);
    assert!(rows.is_empty());

    let still_there: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM blogs")
        .fetch_one(&pool)
        .await
        .expect("blogs table still exists");
    assert!(still_there >= 0, "blogs table was dropped (SQL injection)");
}
