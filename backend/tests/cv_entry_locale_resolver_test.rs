//! Issue #754 — ?locale= resolver wired into /cv-entries.
//!
//! Re-uses the shared `ResolveLocale` extractor and `resolve_localization`
//! helper landed in #753 / PR #758. This test pins the same ADR-0002
//! contract on cv-entries: opt-in collapse, silent fallback on unknown
//! code, empty array (not 404) on zero localizations.

mod common;

use serial_test::serial;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use forja::dto::cv::{CreateCvEntryRequest, CvEntryLocalizationInput};
use forja::models::api_key::ApiKeyPermission;
use forja::models::content::ContentStatus;
use forja::models::cv::{CvEntry, CvEntryType};
use forja::models::site_locale::SiteLocale;
use forja::repos::cv_repo::CvEntryRepo;

use common::{create_test_api_key, create_test_site, enable_module, test_context};

async fn locale_id(pool: &PgPool, code: &str) -> Uuid {
    sqlx::query("SELECT id FROM locales WHERE code = $1")
        .bind(code)
        .fetch_one(pool)
        .await
        .expect("seeded locale row")
        .get::<Uuid, _>(0)
}

fn loc_input(locale_id: Uuid, position: &str) -> CvEntryLocalizationInput {
    CvEntryLocalizationInput {
        locale_id,
        position: position.to_string(),
        description: Some(format!("{position} description")),
        achievements: None,
    }
}

async fn seed_trilingual_entry(pool: &PgPool) -> (Uuid, CvEntry, (Uuid, Uuid, Uuid)) {
    let site_id = create_test_site(pool).await;
    enable_module(pool, site_id, "portfolio").await;
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

    let req = CreateCvEntryRequest {
        company: "Acme".to_string(),
        company_url: None,
        company_logo_id: None,
        location: "Vienna".to_string(),
        start_date: chrono::NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
        end_date: None,
        is_current: true,
        entry_type: CvEntryType::Work,
        display_order: 0,
        status: ContentStatus::Draft,
        site_ids: vec![site_id],
        localizations: Some(vec![
            loc_input(de, "DE position"),
            loc_input(en, "EN position"),
            loc_input(es, "ES position"),
        ]),
        skill_ids: None,
    };
    let entry = CvEntryRepo::create(&mut pool.acquire().await.unwrap(), req, Some("test"))
        .await
        .expect("create cv entry");
    (site_id, entry, (de, en, es))
}

#[tokio::test]
#[serial]
async fn list_with_locale_collapses_to_one_localization() {
    let ctx = test_context().await;
    let (site_id, _entry, (_de, en, _es)) = seed_trilingual_entry(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/sites/{site_id}/cv?locale=en"))
        .add_header("x-api-key", key.as_str())
        .await;

    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    let locs = body["data"][0]["localizations"]
        .as_array()
        .expect("locs array");
    assert_eq!(locs.len(), 1);
    assert_eq!(locs[0]["locale_id"], en.to_string());
}

#[tokio::test]
#[serial]
async fn list_with_unknown_locale_falls_back_to_site_default() {
    let ctx = test_context().await;
    let (site_id, _entry, (de, _en, _es)) = seed_trilingual_entry(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/sites/{site_id}/cv?locale=fr"))
        .add_header("x-api-key", key.as_str())
        .await;

    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    let locs = body["data"][0]["localizations"]
        .as_array()
        .expect("locs array");
    assert_eq!(
        locs.len(),
        1,
        "unknown ?locale= falls back, still collapsed"
    );
    assert_eq!(locs[0]["locale_id"], de.to_string(), "site default = de");
}

#[tokio::test]
#[serial]
async fn list_without_locale_param_returns_all_localizations() {
    let ctx = test_context().await;
    let (site_id, _entry, _ids) = seed_trilingual_entry(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/sites/{site_id}/cv"))
        .add_header("x-api-key", key.as_str())
        .await;

    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    let locs = body["data"][0]["localizations"]
        .as_array()
        .expect("locs array");
    assert_eq!(
        locs.len(),
        3,
        "no ?locale= → all localizations (admin/editor contract preserved)"
    );
}

#[tokio::test]
#[serial]
async fn detail_with_locale_collapses_to_one_localization() {
    let ctx = test_context().await;
    let (site_id, entry, (_de, en, _es)) = seed_trilingual_entry(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/cv/{}/detail?locale=en", entry.id))
        .add_header("x-api-key", key.as_str())
        .await;

    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    let locs = body["localizations"].as_array().expect("locs array");
    assert_eq!(locs.len(), 1);
    assert_eq!(locs[0]["locale_id"], en.to_string());
}

/// ADR 0003 tracer bullet: both `/cv/{id}` (lightweight) and
/// `/cv/{id}/detail` (full) resolve. CV's list and detail shapes are
/// intentionally identical (the relational graph is bounded), so the
/// `/detail` route is the uniform convention slot — it must still answer.
#[tokio::test]
#[serial]
async fn bare_and_detail_routes_both_resolve() {
    let ctx = test_context().await;
    let (site_id, entry, (_de, en, _es)) = seed_trilingual_entry(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let bare = ctx
        .server
        .get(&format!("/api/v1/cv/{}?locale=en", entry.id))
        .add_header("x-api-key", key.as_str())
        .await;
    bare.assert_status_ok();
    let bare_body: serde_json::Value = bare.json();
    assert_eq!(bare_body["id"], entry.id.to_string());
    let bare_locs = bare_body["localizations"].as_array().expect("locs array");
    assert_eq!(bare_locs.len(), 1, "lightweight collapses on ?locale=");
    assert_eq!(bare_locs[0]["locale_id"], en.to_string());

    let detail = ctx
        .server
        .get(&format!("/api/v1/cv/{}", entry.id))
        .add_header("x-api-key", key.as_str())
        .await;
    detail.assert_status_ok();
}

#[tokio::test]
#[serial]
async fn entry_with_zero_localizations_returns_empty_array_not_404() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    enable_module(&ctx.pool, site_id, "portfolio").await;
    let de = locale_id(&ctx.pool, "de").await;
    SiteLocale::add(&ctx.pool, site_id, de, true, Some("de"))
        .await
        .expect("add de");

    let req = CreateCvEntryRequest {
        company: "NoLocs".to_string(),
        company_url: None,
        company_logo_id: None,
        location: "Vienna".to_string(),
        start_date: chrono::NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
        end_date: None,
        is_current: true,
        entry_type: CvEntryType::Work,
        display_order: 0,
        status: ContentStatus::Draft,
        site_ids: vec![site_id],
        localizations: None,
        skill_ids: None,
    };
    CvEntryRepo::create(&mut ctx.pool.acquire().await.unwrap(), req, Some("test"))
        .await
        .expect("create entry");
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/sites/{site_id}/cv?locale=en"))
        .add_header("x-api-key", key.as_str())
        .await;

    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    let locs = body["data"][0]["localizations"]
        .as_array()
        .expect("locs array");
    assert!(
        locs.is_empty(),
        "zero localizations + ?locale= → empty array, ADR 0002 §1.4"
    );
}
