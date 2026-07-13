//! Section `settings.items` localization (parked consumer-feedback item).
//!
//! A locale's non-null `page_section_localizations.items` replaces the
//! entire default `settings.items` array for that locale (full override —
//! no per-field merge). NULL means "no localized items, fall back to the
//! default". The public read (`GET /pages/{id}/sections?locale=`) resolves
//! the override server-side into `settings.items`, so consumers keep
//! reading the same wire location.

mod common;

use axum::http::StatusCode;
use serde_json::json;
use serial_test::serial;
use sqlx::PgPool;
use uuid::Uuid;

use forja::dto::page::{CreatePageRequest, CreatePageSectionRequest};
use forja::models::api_key::ApiKeyPermission;
use forja::models::content::ContentStatus;
use forja::models::page::{PageType, SectionType};
use forja::models::site_locale::SiteLocale;
use forja::repos::page_repo::{PageRepo, PageSectionRepo};

use common::{TestContext, create_test_api_key, create_test_site, test_context};

async fn locale_id(pool: &PgPool, code: &str) -> Uuid {
    sqlx::query_scalar("SELECT id FROM locales WHERE code = $1")
        .bind(code)
        .fetch_one(pool)
        .await
        .expect("seeded locale row")
}

fn default_items() -> serde_json::Value {
    json!([
        { "title": "Fast", "text": "Ships in seconds", "icon": "⚡" },
        { "title": "Safe", "text": "GDPR by construction", "icon": "🔒" },
    ])
}

fn en_items() -> serde_json::Value {
    json!([
        { "title": "Quick", "text": "Deploys in seconds", "icon": "⚡" },
        { "title": "Secure", "text": "Privacy first", "icon": "🔒" },
    ])
}

/// Site with `de` (default), `en`, `es`; one page with one Features section
/// whose default `settings.items` is [`default_items`]. Returns
/// `(site_id, page_id, section_id)`.
async fn seed_page_with_items_section(pool: &PgPool) -> (Uuid, Uuid, Uuid) {
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
    let page = PageRepo::create(
        &mut pool.acquire().await.unwrap(),
        CreatePageRequest {
            route: format!("/features-{suffix}"),
            slug: Some(format!("features-{suffix}")),
            page_type: PageType::Landing,
            template: None,
            is_in_navigation: false,
            navigation_order: None,
            parent_page_id: None,
            status: ContentStatus::Published,
            publish_start: None,
            publish_end: None,
            site_ids: vec![site_id],
        },
        Some("test"),
    )
    .await
    .expect("create page");

    let section = PageSectionRepo::create(
        pool,
        page.id,
        CreatePageSectionRequest {
            section_type: SectionType::Features,
            display_order: 0,
            cover_image_id: None,
            call_to_action_route: None,
            settings: Some(json!({ "columns": 2, "items": default_items() })),
        },
    )
    .await
    .expect("create section");

    (site_id, page.id, section.id)
}

async fn upsert_localization(
    ctx: &TestContext,
    write_key: &str,
    section_id: Uuid,
    body: serde_json::Value,
) -> axum_test::TestResponse {
    ctx.server
        .put(&format!(
            "/api/v1/pages/sections/{section_id}/localizations"
        ))
        .add_header("x-api-key", write_key)
        .json(&body)
        .await
}

async fn fetch_sections(
    ctx: &TestContext,
    read_key: &str,
    page_id: Uuid,
    locale: Option<&str>,
) -> serde_json::Value {
    let path = match locale {
        Some(code) => format!("/api/v1/pages/{page_id}/sections?locale={code}"),
        None => format!("/api/v1/pages/{page_id}/sections"),
    };
    let resp = ctx
        .server
        .get(&path)
        .add_header("x-api-key", read_key)
        .await;
    resp.assert_status_ok();
    resp.json()
}

fn section_items(sections: &serde_json::Value) -> serde_json::Value {
    sections.as_array().expect("sections array")[0]["settings"]["items"].clone()
}

#[tokio::test]
#[serial]
async fn upsert_localization_with_items_roundtrips() {
    let ctx = test_context().await;
    let (site_id, _page_id, section_id) = seed_page_with_items_section(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;
    let en = locale_id(&ctx.pool, "en").await;

    let resp = upsert_localization(
        &ctx,
        &write_key,
        section_id,
        json!({ "locale_id": en, "title": "Features", "items": en_items() }),
    )
    .await;
    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    assert_eq!(body["items"], en_items());

    let read_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;
    let locs: serde_json::Value = ctx
        .server
        .get(&format!(
            "/api/v1/pages/sections/{section_id}/localizations"
        ))
        .add_header("x-api-key", read_key.as_str())
        .await
        .json();
    let en_loc = locs
        .as_array()
        .expect("localizations array")
        .iter()
        .find(|l| l["locale_id"] == en.to_string())
        .expect("EN localization present");
    assert_eq!(en_loc["items"], en_items());
}

#[tokio::test]
#[serial]
async fn upsert_localization_rejects_non_array_items_with_422() {
    let ctx = test_context().await;
    let (site_id, _page_id, section_id) = seed_page_with_items_section(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;
    let en = locale_id(&ctx.pool, "en").await;

    let resp = upsert_localization(
        &ctx,
        &write_key,
        section_id,
        json!({ "locale_id": en, "items": { "title": "not an array" } }),
    )
    .await;
    resp.assert_status(StatusCode::UNPROCESSABLE_ENTITY);
}

#[tokio::test]
#[serial]
async fn sections_with_locale_return_the_override_items() {
    let ctx = test_context().await;
    let (site_id, page_id, section_id) = seed_page_with_items_section(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;
    let read_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;
    let en = locale_id(&ctx.pool, "en").await;

    upsert_localization(
        &ctx,
        &write_key,
        section_id,
        json!({ "locale_id": en, "items": en_items() }),
    )
    .await
    .assert_status_ok();

    let sections = fetch_sections(&ctx, &read_key, page_id, Some("en")).await;
    assert_eq!(section_items(&sections), en_items());
    // Non-items settings survive the substitution.
    assert_eq!(sections[0]["settings"]["columns"], 2);
}

#[tokio::test]
#[serial]
async fn sections_with_locale_without_override_fall_back_to_default_items() {
    let ctx = test_context().await;
    let (site_id, page_id, section_id) = seed_page_with_items_section(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;
    let read_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;
    let en = locale_id(&ctx.pool, "en").await;

    // EN has an override; ES has a localization row but NO items override.
    upsert_localization(
        &ctx,
        &write_key,
        section_id,
        json!({ "locale_id": en, "items": en_items() }),
    )
    .await
    .assert_status_ok();
    let es = locale_id(&ctx.pool, "es").await;
    upsert_localization(
        &ctx,
        &write_key,
        section_id,
        json!({ "locale_id": es, "title": "Funciones" }),
    )
    .await
    .assert_status_ok();

    let sections = fetch_sections(&ctx, &read_key, page_id, Some("es")).await;
    assert_eq!(section_items(&sections), default_items());

    // Unknown locale code falls back silently too (ADR 0002 §1).
    let sections = fetch_sections(&ctx, &read_key, page_id, Some("fr")).await;
    assert_eq!(section_items(&sections), default_items());
}

#[tokio::test]
#[serial]
async fn sections_without_locale_param_keep_default_items() {
    let ctx = test_context().await;
    let (site_id, page_id, section_id) = seed_page_with_items_section(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;
    let read_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;
    let en = locale_id(&ctx.pool, "en").await;

    upsert_localization(
        &ctx,
        &write_key,
        section_id,
        json!({ "locale_id": en, "items": en_items() }),
    )
    .await
    .assert_status_ok();

    let sections = fetch_sections(&ctx, &read_key, page_id, None).await;
    assert_eq!(
        section_items(&sections),
        default_items(),
        "no ?locale= → default items (opt-in resolver, admin contract preserved)"
    );
}

#[tokio::test]
#[serial]
async fn clearing_the_override_restores_the_fallback() {
    let ctx = test_context().await;
    let (site_id, page_id, section_id) = seed_page_with_items_section(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;
    let read_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;
    let en = locale_id(&ctx.pool, "en").await;

    upsert_localization(
        &ctx,
        &write_key,
        section_id,
        json!({ "locale_id": en, "title": "Features", "items": en_items() }),
    )
    .await
    .assert_status_ok();

    // Explicit null clears the override (omitting the field does the same).
    let resp = upsert_localization(
        &ctx,
        &write_key,
        section_id,
        json!({ "locale_id": en, "title": "Features", "items": null }),
    )
    .await;
    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    assert!(body["items"].is_null());

    let sections = fetch_sections(&ctx, &read_key, page_id, Some("en")).await;
    assert_eq!(section_items(&sections), default_items());
}
