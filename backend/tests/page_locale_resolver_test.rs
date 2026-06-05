//! Issue #756 — ?locale= resolver wired into /pages/{id}/detail.
//!
//! AUDIT FINDING (recorded for reviewers):
//! - `PageResponse` (list shape) does NOT carry `localizations[]`.
//! - `PageDetailResponse` (detail shape, behind `/pages/{id}/detail`)
//!   DOES carry `localizations: Vec<LocalizationResponse>`.
//!
//! Therefore the resolver applies only to the detail endpoint. Adding
//! `localizations[]` to the list shape (mirroring #747's project work)
//! is a separate canonicalization gap — out of scope for this slice.

mod common;

use serial_test::serial;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use forja::dto::page::CreatePageRequest;
use forja::models::api_key::ApiKeyPermission;
use forja::models::content::{ContentLocalization, ContentStatus};
use forja::models::page::{PageType, PageWithContent};
use forja::models::site_locale::SiteLocale;
use forja::repos::page_repo::PageRepo;

use common::{create_test_api_key, create_test_site, test_context};

async fn locale_id(pool: &PgPool, code: &str) -> Uuid {
    sqlx::query("SELECT id FROM locales WHERE code = $1")
        .bind(code)
        .fetch_one(pool)
        .await
        .expect("seeded locale row")
        .get::<Uuid, _>(0)
}

async fn seed_trilingual_page(pool: &PgPool) -> (Uuid, PageWithContent, (Uuid, Uuid, Uuid)) {
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
    let req = CreatePageRequest {
        route: format!("/about-{}", suffix),
        slug: Some(format!("about-{}", suffix)),
        page_type: PageType::Static,
        template: None,
        is_in_navigation: false,
        navigation_order: None,
        parent_page_id: None,
        status: ContentStatus::Draft,
        publish_start: None,
        publish_end: None,
        site_ids: vec![site_id],
    };
    let page = PageRepo::create(&mut pool.acquire().await.unwrap(), req, Some("test"))
        .await
        .expect("create page");

    for (locale, title) in [(de, "DE title"), (en, "EN title"), (es, "ES title")] {
        ContentLocalization::create(
            pool,
            page.content_id,
            locale,
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

    (site_id, page, (de, en, es))
}

#[tokio::test]
#[serial]
async fn detail_with_locale_collapses_to_one_localization() {
    let ctx = test_context().await;
    let (site_id, page, (_de, en, _es)) = seed_trilingual_page(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/pages/{}/detail?locale=en", page.id))
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
async fn detail_with_unknown_locale_falls_back_to_site_default() {
    let ctx = test_context().await;
    let (site_id, page, (de, _en, _es)) = seed_trilingual_page(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/pages/{}/detail?locale=fr", page.id))
        .add_header("x-api-key", key.as_str())
        .await;

    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    let locs = body["localizations"].as_array().expect("locs array");
    assert_eq!(locs.len(), 1);
    assert_eq!(locs[0]["locale_id"], de.to_string(), "site default = de");
}

#[tokio::test]
#[serial]
async fn detail_without_locale_param_returns_all_localizations() {
    let ctx = test_context().await;
    let (site_id, page, _ids) = seed_trilingual_page(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/pages/{}/detail", page.id))
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
