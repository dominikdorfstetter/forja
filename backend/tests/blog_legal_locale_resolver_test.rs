//! Issue #757 — ?locale= resolver wired into /blogs and /legal detail.
//!
//! AUDIT FINDING (recorded for reviewers):
//! - `BlogResponse` (list shape) does NOT carry `localizations[]`; only
//!   `BlogDetailResponse` does. Resolver applies to `/blogs/{id}/detail`.
//! - `LegalDocumentResponse` (list shape) does NOT carry localizations.
//!   `LegalDocumentDetailResponse` and `LegalDocumentFullDetailResponse`
//!   do, behind `/sites/{site_id}/legal/by-slug/{slug}` and
//!   `/legal/{id}/detail` respectively.
//!
//! Adding `localizations[]` to either list shape is a separate
//! canonicalization gap — out of scope for this slice.

mod common;

use chrono::NaiveDate;
use serial_test::serial;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use forja::dto::blog::CreateBlogRequest;
use forja::models::api_key::ApiKeyPermission;
use forja::models::blog::BlogWithContent;
use forja::models::content::{ContentLocalization, ContentStatus};
use forja::models::site_locale::SiteLocale;
use forja::repos::blog_repo::BlogRepo;

use common::{create_test_api_key, create_test_site, test_context};

async fn locale_id(pool: &PgPool, code: &str) -> Uuid {
    sqlx::query("SELECT id FROM locales WHERE code = $1")
        .bind(code)
        .fetch_one(pool)
        .await
        .expect("seeded locale row")
        .get::<Uuid, _>(0)
}

async fn seed_trilingual_blog(pool: &PgPool) -> (Uuid, BlogWithContent, (Uuid, Uuid, Uuid)) {
    let site_id = create_test_site(pool).await;
    let de = locale_id(pool, "de").await;
    let en = locale_id(pool, "en").await;
    let es = locale_id(pool, "es").await;

    SiteLocale::add(pool, site_id, de, true, Some("de"))
        .await
        .expect("add de");
    SiteLocale::add(pool, site_id, en, false, Some("en"))
        .await
        .expect("add en");
    SiteLocale::add(pool, site_id, es, false, Some("es"))
        .await
        .expect("add es");

    let suffix = &Uuid::new_v4().to_string()[..8];
    let req = CreateBlogRequest {
        slug: Some(format!("trace-{}", suffix)),
        title: Some("Tracer Post".to_string()),
        author: "Author".to_string(),
        published_date: NaiveDate::from_ymd_opt(2026, 5, 21).expect("valid date"),
        reading_time_minutes: Some(3),
        cover_image_id: None,
        header_image_id: None,
        is_featured: false,
        allow_comments: false,
        status: ContentStatus::Draft,
        publish_start: None,
        publish_end: None,
        site_ids: vec![site_id],
    };
    let blog = BlogRepo::create(&mut pool.acquire().await.unwrap(), req, Some("test"))
        .await
        .expect("create blog");

    for (loc, title) in [(de, "DE title"), (en, "EN title"), (es, "ES title")] {
        ContentLocalization::create(
            pool,
            blog.content_id,
            loc,
            title,
            None,
            None,
            Some(&format!("{title} body")),
            None,
            None,
        )
        .await
        .expect("insert content_localization");
    }

    (site_id, blog, (de, en, es))
}

#[tokio::test]
#[serial]
async fn blog_detail_with_locale_collapses_to_one_localization() {
    let ctx = test_context().await;
    let (site_id, blog, (_de, en, _es)) = seed_trilingual_blog(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/blogs/{}/detail?locale=en", blog.id))
        .add_header("x-api-key", key.as_str())
        .await;

    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    let locs = body["localizations"].as_array().expect("locs array");
    assert_eq!(locs.len(), 1);
    assert_eq!(locs[0]["locale_id"], en.to_string());
}

#[tokio::test]
#[serial]
async fn blog_detail_with_unknown_locale_falls_back_to_site_default() {
    let ctx = test_context().await;
    let (site_id, blog, (de, _en, _es)) = seed_trilingual_blog(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/blogs/{}/detail?locale=fr", blog.id))
        .add_header("x-api-key", key.as_str())
        .await;

    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    let locs = body["localizations"].as_array().expect("locs array");
    assert_eq!(locs.len(), 1);
    assert_eq!(locs[0]["locale_id"], de.to_string());
}

#[tokio::test]
#[serial]
async fn blog_detail_without_locale_param_returns_all_localizations() {
    let ctx = test_context().await;
    let (site_id, blog, _ids) = seed_trilingual_blog(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/blogs/{}/detail", blog.id))
        .add_header("x-api-key", key.as_str())
        .await;

    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    let locs = body["localizations"].as_array().expect("locs array");
    assert_eq!(
        locs.len(),
        3,
        "no ?locale= → all localizations (admin/editor contract preserved)"
    );
}
