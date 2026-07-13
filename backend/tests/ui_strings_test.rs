//! UI Strings module (consumer-feedback roadmap §1) — admin CRUD, the
//! 500-key cap, the default-locale auto-outdated rule, and the public
//! locale-resolved flat-map read with the ADR 0002 fallback chain.

mod common;

use axum_test::TestResponse;
use serde_json::json;
use serial_test::serial;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use forja::errors::codes;
use forja::models::api_key::ApiKeyPermission;
use forja::models::site_locale::SiteLocale;

use common::{TestContext, create_test_api_key, create_test_site, test_context};

async fn locale_id(pool: &PgPool, code: &str) -> Uuid {
    sqlx::query("SELECT id FROM locales WHERE code = $1")
        .bind(code)
        .fetch_one(pool)
        .await
        .expect("seeded locale row")
        .get::<Uuid, _>(0)
}

/// Site with de (default) + en + es locales.
async fn site_with_locales(pool: &PgPool) -> (Uuid, Uuid, Uuid, Uuid) {
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
    (site_id, de, en, es)
}

async fn create_string(
    ctx: &TestContext,
    site_id: Uuid,
    api_key: &str,
    key: &str,
    localizations: serde_json::Value,
) -> TestResponse {
    ctx.server
        .post(&format!("/api/v1/sites/{site_id}/strings"))
        .add_header("x-api-key", api_key)
        .json(&json!({ "key": key, "localizations": localizations }))
        .await
}

async fn list_entries(ctx: &TestContext, site_id: Uuid, api_key: &str) -> serde_json::Value {
    let resp = ctx
        .server
        .get(&format!("/api/v1/sites/{site_id}/strings/entries"))
        .add_header("x-api-key", api_key)
        .await;
    resp.assert_status_ok();
    resp.json()
}

fn status_of(entry: &serde_json::Value, locale_id: Uuid) -> String {
    entry["localizations"]
        .as_array()
        .expect("localizations array")
        .iter()
        .find(|l| l["locale_id"] == locale_id.to_string())
        .unwrap_or_else(|| panic!("localization for {locale_id}"))["translation_status"]
        .as_str()
        .expect("translation_status string")
        .to_string()
}

// ── Admin CRUD ──────────────────────────────────────────────────────────

#[tokio::test]
#[serial]
async fn crud_roundtrip_with_localization_upsert() {
    let ctx = test_context().await;
    let (site_id, de, en, es) = site_with_locales(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;
    let read_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let created = create_string(
        &ctx,
        site_id,
        &write_key,
        "blog.min_read",
        json!([
            { "locale_id": de, "value": "Min. Lesezeit" },
            { "locale_id": en, "value": "min read" },
        ]),
    )
    .await;
    created.assert_status(axum::http::StatusCode::CREATED);
    let body: serde_json::Value = created.json();
    assert_eq!(body["key"], "blog.min_read");
    assert_eq!(body["localizations"].as_array().expect("locs").len(), 2);
    assert_eq!(status_of(&body, de), "Pending");
    let id = body["id"].as_str().expect("id").to_string();

    let entries = list_entries(&ctx, site_id, &read_key).await;
    assert_eq!(entries.as_array().expect("entries").len(), 1);

    let updated = ctx
        .server
        .put(&format!("/api/v1/sites/{site_id}/strings/{id}"))
        .add_header("x-api-key", write_key.as_str())
        .json(&json!({
            "key": "blog.min-read",
            "localizations": [
                { "locale_id": en, "value": "minute read" },
                { "locale_id": es, "value": "min de lectura" },
            ],
        }))
        .await;
    updated.assert_status_ok();
    let body: serde_json::Value = updated.json();
    assert_eq!(body["key"], "blog.min-read");
    assert_eq!(
        body["localizations"].as_array().expect("locs").len(),
        3,
        "upsert keeps de and adds es"
    );

    let deleted = ctx
        .server
        .delete(&format!("/api/v1/sites/{site_id}/strings/{id}"))
        .add_header("x-api-key", write_key.as_str())
        .await;
    deleted.assert_status(axum::http::StatusCode::NO_CONTENT);

    let entries = list_entries(&ctx, site_id, &read_key).await;
    assert!(entries.as_array().expect("entries").is_empty());
}

#[tokio::test]
#[serial]
async fn create_enforces_500_key_cap() {
    let ctx = test_context().await;
    let (site_id, de, _en, _es) = site_with_locales(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;

    sqlx::query(
        "INSERT INTO ui_strings (site_id, key)
         SELECT $1, 'seed.k' || g::text FROM generate_series(1, 499) g",
    )
    .bind(site_id)
    .execute(&ctx.pool)
    .await
    .expect("seed 499 keys");

    let at_cap = create_string(
        &ctx,
        site_id,
        &write_key,
        "cap.last",
        json!([{ "locale_id": de, "value": "fits" }]),
    )
    .await;
    at_cap.assert_status(axum::http::StatusCode::CREATED);

    let over_cap = create_string(
        &ctx,
        site_id,
        &write_key,
        "cap.overflow",
        json!([{ "locale_id": de, "value": "rejected" }]),
    )
    .await;
    over_cap.assert_status(axum::http::StatusCode::UNPROCESSABLE_ENTITY);
    let body: serde_json::Value = over_cap.json();
    assert_eq!(body["code"], codes::ERR_STRINGS_LIMIT_EXCEEDED);
}

#[tokio::test]
#[serial]
async fn malformed_keys_and_values_return_422() {
    let ctx = test_context().await;
    let (site_id, de, _en, _es) = site_with_locales(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;

    for bad_key in [
        "Blog.MinRead",
        "double..dot",
        ".leading",
        "a".repeat(129).as_str(),
    ] {
        let resp = create_string(
            &ctx,
            site_id,
            &write_key,
            bad_key,
            json!([{ "locale_id": de, "value": "v" }]),
        )
        .await;
        resp.assert_status(axum::http::StatusCode::UNPROCESSABLE_ENTITY);
    }

    let over_long_value = create_string(
        &ctx,
        site_id,
        &write_key,
        "ok.key",
        json!([{ "locale_id": de, "value": "v".repeat(1001) }]),
    )
    .await;
    over_long_value.assert_status(axum::http::StatusCode::UNPROCESSABLE_ENTITY);
}

#[tokio::test]
#[serial]
async fn duplicate_key_conflicts_within_site_only() {
    let ctx = test_context().await;
    let (site_id, de, _en, _es) = site_with_locales(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;

    let first = create_string(
        &ctx,
        site_id,
        &write_key,
        "dup.key",
        json!([{ "locale_id": de, "value": "one" }]),
    )
    .await;
    first.assert_status(axum::http::StatusCode::CREATED);

    let duplicate = create_string(
        &ctx,
        site_id,
        &write_key,
        "dup.key",
        json!([{ "locale_id": de, "value": "two" }]),
    )
    .await;
    duplicate.assert_status(axum::http::StatusCode::CONFLICT);
    let body: serde_json::Value = duplicate.json();
    assert_eq!(body["code"], codes::ERR_STRINGS_KEY_TAKEN);

    let (other_site, other_de, _other_en, _other_es) = site_with_locales(&ctx.pool).await;
    let other_key = create_test_api_key(&ctx.pool, other_site, ApiKeyPermission::Write).await;
    let same_key_other_site = create_string(
        &ctx,
        other_site,
        &other_key,
        "dup.key",
        json!([{ "locale_id": other_de, "value": "elsewhere" }]),
    )
    .await;
    same_key_other_site.assert_status(axum::http::StatusCode::CREATED);
}

// ── Auto-outdated rule ──────────────────────────────────────────────────

#[tokio::test]
#[serial]
async fn default_locale_value_change_flips_other_locales_to_outdated() {
    let ctx = test_context().await;
    let (site_id, de, en, es) = site_with_locales(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;

    let created = create_string(
        &ctx,
        site_id,
        &write_key,
        "footer.links",
        json!([
            { "locale_id": de, "value": "Links" },
            { "locale_id": en, "value": "Links (EN)" },
            { "locale_id": es, "value": "Enlaces" },
        ]),
    )
    .await;
    created.assert_status(axum::http::StatusCode::CREATED);
    let id = created.json::<serde_json::Value>()["id"]
        .as_str()
        .expect("id")
        .to_string();

    let updated = ctx
        .server
        .put(&format!("/api/v1/sites/{site_id}/strings/{id}"))
        .add_header("x-api-key", write_key.as_str())
        .json(&json!({
            "localizations": [{ "locale_id": de, "value": "Verweise" }],
        }))
        .await;
    updated.assert_status_ok();

    let entries = list_entries(&ctx, site_id, &write_key).await;
    let entry = &entries.as_array().expect("entries")[0];
    assert_eq!(status_of(entry, en), "Outdated");
    assert_eq!(status_of(entry, es), "Outdated");
    assert_eq!(
        status_of(entry, de),
        "Pending",
        "default itself never flips"
    );
}

#[tokio::test]
#[serial]
async fn non_default_locale_update_does_not_flip_others() {
    let ctx = test_context().await;
    let (site_id, de, en, es) = site_with_locales(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;

    let created = create_string(
        &ctx,
        site_id,
        &write_key,
        "nav.home",
        json!([
            { "locale_id": de, "value": "Startseite" },
            { "locale_id": en, "value": "Home" },
            { "locale_id": es, "value": "Inicio" },
        ]),
    )
    .await;
    created.assert_status(axum::http::StatusCode::CREATED);
    let id = created.json::<serde_json::Value>()["id"]
        .as_str()
        .expect("id")
        .to_string();

    let updated = ctx
        .server
        .put(&format!("/api/v1/sites/{site_id}/strings/{id}"))
        .add_header("x-api-key", write_key.as_str())
        .json(&json!({
            "localizations": [{ "locale_id": en, "value": "Homepage" }],
        }))
        .await;
    updated.assert_status_ok();

    let entries = list_entries(&ctx, site_id, &write_key).await;
    let entry = &entries.as_array().expect("entries")[0];
    for locale in [de, en, es] {
        assert_ne!(
            status_of(entry, locale),
            "Outdated",
            "non-default update must not outdate {locale}"
        );
    }
}

// ── Public locale-resolved read ─────────────────────────────────────────

async fn public_read(ctx: &TestContext, site_id: Uuid, api_key: &str, query: &str) -> TestResponse {
    ctx.server
        .get(&format!("/api/v1/sites/{site_id}/strings{query}"))
        .add_header("x-api-key", api_key)
        .await
}

#[tokio::test]
#[serial]
async fn public_read_resolves_flat_map_with_fallbacks() {
    let ctx = test_context().await;
    let (site_id, de, en, es) = site_with_locales(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;
    let read_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    // Exact match, fallback to default, fallback to first-by-code, omitted.
    create_string(
        &ctx,
        site_id,
        &write_key,
        "footer.links",
        json!([
            { "locale_id": de, "value": "Links (DE)" },
            { "locale_id": en, "value": "Links (EN)" },
        ]),
    )
    .await
    .assert_status(axum::http::StatusCode::CREATED);
    create_string(
        &ctx,
        site_id,
        &write_key,
        "nav.home",
        json!([{ "locale_id": de, "value": "Startseite" }]),
    )
    .await
    .assert_status(axum::http::StatusCode::CREATED);
    create_string(
        &ctx,
        site_id,
        &write_key,
        "no.default",
        json!([
            { "locale_id": en, "value": "EN wins" },
            { "locale_id": es, "value": "ES second" },
        ]),
    )
    .await
    .assert_status(axum::http::StatusCode::CREATED);
    create_string(&ctx, site_id, &write_key, "empty.key", json!([]))
        .await
        .assert_status(axum::http::StatusCode::CREATED);

    let resp = public_read(&ctx, site_id, &read_key, "?locale=en").await;
    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    assert_eq!(body["footer.links"], "Links (EN)", "exact locale match");
    assert_eq!(body["nav.home"], "Startseite", "falls back to site default");
    assert_eq!(body["no.default"], "EN wins", "exact match beats order");
    assert!(
        body.get("empty.key").is_none(),
        "key without localizations is omitted"
    );

    // Requested locale missing on the key AND no default row → first-by-code.
    let resp = public_read(&ctx, site_id, &read_key, "?locale=de").await;
    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    assert_eq!(
        body["no.default"], "EN wins",
        "default row missing → first localization by locale code"
    );
}

#[tokio::test]
#[serial]
async fn public_read_requires_locale_param() {
    let ctx = test_context().await;
    let (site_id, _de, _en, _es) = site_with_locales(&ctx.pool).await;
    let read_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = public_read(&ctx, site_id, &read_key, "").await;
    resp.assert_status(axum::http::StatusCode::BAD_REQUEST);
    let body: serde_json::Value = resp.json();
    assert_eq!(body["code"], codes::ERR_STRINGS_LOCALE_REQUIRED);
}

#[tokio::test]
#[serial]
async fn public_read_unknown_locale_falls_back_silently() {
    let ctx = test_context().await;
    let (site_id, de, en, _es) = site_with_locales(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;
    let read_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    create_string(
        &ctx,
        site_id,
        &write_key,
        "footer.built_with",
        json!([
            { "locale_id": de, "value": "Erstellt mit Forja" },
            { "locale_id": en, "value": "Built with Forja" },
        ]),
    )
    .await
    .assert_status(axum::http::StatusCode::CREATED);

    let resp = public_read(&ctx, site_id, &read_key, "?locale=fr").await;
    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    assert_eq!(
        body["footer.built_with"], "Erstellt mit Forja",
        "unknown code → site default, no 400"
    );
}

// ── Auth tiers ──────────────────────────────────────────────────────────

#[tokio::test]
#[serial]
async fn read_key_can_read_but_not_mutate() {
    let ctx = test_context().await;
    let (site_id, de, en, _es) = site_with_locales(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;
    let read_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let created = create_string(
        &ctx,
        site_id,
        &write_key,
        "aria.toggle_dark",
        json!([{ "locale_id": de, "value": "Dunkelmodus umschalten" }]),
    )
    .await;
    created.assert_status(axum::http::StatusCode::CREATED);
    let id = created.json::<serde_json::Value>()["id"]
        .as_str()
        .expect("id")
        .to_string();

    public_read(&ctx, site_id, &read_key, "?locale=de")
        .await
        .assert_status_ok();
    list_entries(&ctx, site_id, &read_key).await;

    let create_denied = create_string(
        &ctx,
        site_id,
        &read_key,
        "denied.key",
        json!([{ "locale_id": de, "value": "nope" }]),
    )
    .await;
    create_denied.assert_status(axum::http::StatusCode::FORBIDDEN);

    let update_denied = ctx
        .server
        .put(&format!("/api/v1/sites/{site_id}/strings/{id}"))
        .add_header("x-api-key", read_key.as_str())
        .json(&json!({ "localizations": [{ "locale_id": en, "value": "Toggle dark mode" }] }))
        .await;
    update_denied.assert_status(axum::http::StatusCode::FORBIDDEN);

    let delete_denied = ctx
        .server
        .delete(&format!("/api/v1/sites/{site_id}/strings/{id}"))
        .add_header("x-api-key", read_key.as_str())
        .await;
    delete_denied.assert_status(axum::http::StatusCode::FORBIDDEN);
}
