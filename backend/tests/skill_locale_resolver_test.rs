//! Issue #755 — ?locale= resolver wired into /skills.
//!
//! Re-uses the resolver core from PR #758. Same ADR-0002 contract as
//! projects (#753) and cv-entries (#754).

mod common;

use serial_test::serial;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use forja::dto::cv::CreateSkillRequest;
use forja::models::api_key::ApiKeyPermission;
use forja::models::cv::SkillCategory;
use forja::models::site_locale::SiteLocale;
use forja::repos::cv_repo::SkillRepo;

use common::{create_test_api_key, create_test_site, enable_module, test_context};

async fn locale_id(pool: &PgPool, code: &str) -> Uuid {
    sqlx::query("SELECT id FROM locales WHERE code = $1")
        .bind(code)
        .fetch_one(pool)
        .await
        .expect("seeded locale row")
        .get::<Uuid, _>(0)
}

async fn seed_skill_localization(
    pool: &PgPool,
    skill_id: Uuid,
    locale_id: Uuid,
    display_name: &str,
) {
    sqlx::query(
        "INSERT INTO skill_localizations (skill_id, locale_id, display_name, description) VALUES ($1, $2, $3, $4)",
    )
    .bind(skill_id)
    .bind(locale_id)
    .bind(display_name)
    .bind(Option::<&str>::None)
    .execute(pool)
    .await
    .expect("insert skill_localization");
}

async fn seed_trilingual_skill(pool: &PgPool) -> (Uuid, Uuid, String, (Uuid, Uuid, Uuid)) {
    let site_id = create_test_site(pool).await;
    // /skills is gated by the portfolio module (disabled by default).
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

    let slug = format!("rust-{}", &Uuid::new_v4().to_string()[..8]);
    let req = CreateSkillRequest {
        name: "Rust".to_string(),
        slug: slug.clone(),
        category: Some(SkillCategory::Programming),
        icon: None,
        proficiency_level: Some(4),
        is_global: false,
        site_ids: vec![site_id],
    };
    let skill = SkillRepo::create(pool, req).await.expect("create skill");

    seed_skill_localization(pool, skill.id, de, "Rost").await;
    seed_skill_localization(pool, skill.id, en, "Rust").await;
    seed_skill_localization(pool, skill.id, es, "Óxido").await;

    (site_id, skill.id, slug, (de, en, es))
}

#[tokio::test]
#[serial]
async fn list_with_locale_collapses_to_one_localization() {
    let ctx = test_context().await;
    let (site_id, _skill_id, _slug, (_de, en, _es)) = seed_trilingual_skill(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/sites/{site_id}/skills?locale=en"))
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
    let (site_id, _skill_id, _slug, (de, _en, _es)) = seed_trilingual_skill(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/sites/{site_id}/skills?locale=fr"))
        .add_header("x-api-key", key.as_str())
        .await;

    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    let locs = body["data"][0]["localizations"]
        .as_array()
        .expect("locs array");
    assert_eq!(locs.len(), 1);
    assert_eq!(locs[0]["locale_id"], de.to_string(), "site default = de");
}

#[tokio::test]
#[serial]
async fn list_without_locale_param_returns_all_localizations() {
    let ctx = test_context().await;
    let (site_id, _skill_id, _slug, _ids) = seed_trilingual_skill(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/sites/{site_id}/skills"))
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
async fn detail_by_id_with_locale_collapses() {
    let ctx = test_context().await;
    let (site_id, skill_id, _slug, (_de, en, _es)) = seed_trilingual_skill(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/skills/{skill_id}?locale=en"))
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
async fn detail_by_slug_with_locale_collapses() {
    let ctx = test_context().await;
    let (site_id, _skill_id, slug, (_de, en, _es)) = seed_trilingual_skill(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/skills/by-slug/{slug}?locale=en"))
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
async fn skill_with_zero_localizations_returns_empty_array_not_404() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    // /skills is gated by the portfolio module (disabled by default).
    enable_module(&ctx.pool, site_id, "portfolio").await;
    let de = locale_id(&ctx.pool, "de").await;
    SiteLocale::add(&ctx.pool, site_id, de, true, Some("de"))
        .await
        .expect("add de");

    let req = CreateSkillRequest {
        name: "Bare".to_string(),
        slug: format!("bare-{}", &Uuid::new_v4().to_string()[..8]),
        category: None,
        icon: None,
        proficiency_level: None,
        is_global: false,
        site_ids: vec![site_id],
    };
    SkillRepo::create(&ctx.pool, req)
        .await
        .expect("create skill");
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/sites/{site_id}/skills?locale=en"))
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
