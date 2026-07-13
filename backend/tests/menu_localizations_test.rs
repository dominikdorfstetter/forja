//! Navigation-menu display-name localizations: the explicit removal path
//! (`removed_locale_ids` on the menu update) — upsert-only before this,
//! so a cleared name silently reappeared and the admin had to block it.

mod common;

use axum::http::StatusCode;
use serde_json::json;
use serial_test::serial;
use sqlx::PgPool;
use uuid::Uuid;

use forja::models::api_key::ApiKeyPermission;

use common::{TestContext, create_test_api_key, create_test_site, test_context};

async fn locale_id(pool: &PgPool, code: &str) -> Uuid {
    sqlx::query_scalar("SELECT id FROM locales WHERE code = $1")
        .bind(code)
        .fetch_one(pool)
        .await
        .expect("seeded locale row")
}

async fn create_menu_with_names(
    ctx: &TestContext,
    site_id: Uuid,
    write_key: &str,
    slug: &str,
    localizations: serde_json::Value,
) -> Uuid {
    let resp = ctx
        .server
        .post(&format!("/api/v1/sites/{site_id}/menus"))
        .add_header("x-api-key", write_key)
        .json(&json!({ "slug": slug, "localizations": localizations }))
        .await;
    resp.assert_status(StatusCode::CREATED);
    resp.json::<serde_json::Value>()["id"]
        .as_str()
        .expect("menu id")
        .parse()
        .expect("menu id uuid")
}

fn localization_names(menu: &serde_json::Value) -> Vec<(String, String)> {
    menu["localizations"]
        .as_array()
        .expect("localizations array")
        .iter()
        .map(|l| {
            (
                l["locale_id"].as_str().expect("locale_id").to_string(),
                l["name"].as_str().expect("name").to_string(),
            )
        })
        .collect()
}

#[tokio::test]
#[serial]
async fn menu_update_with_removed_locale_ids_deletes_the_rows() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;
    let de = locale_id(&ctx.pool, "de").await;
    let en = locale_id(&ctx.pool, "en").await;

    let menu_id = create_menu_with_names(
        &ctx,
        site_id,
        &write_key,
        "footer-rm",
        json!([
            { "locale_id": de, "name": "Fußzeile" },
            { "locale_id": en, "name": "Footer links" },
        ]),
    )
    .await;

    // Removal combined with an upsert in the same PUT: de is dropped while
    // en is renamed — one update transaction.
    let updated = ctx
        .server
        .put(&format!("/api/v1/menus/{menu_id}"))
        .add_header("x-api-key", write_key.as_str())
        .json(&json!({
            "localizations": [{ "locale_id": en, "name": "Footer navigation" }],
            "removed_locale_ids": [de],
        }))
        .await;
    updated.assert_status_ok();

    let names = localization_names(&updated.json());
    assert_eq!(
        names,
        vec![(en.to_string(), "Footer navigation".to_string())],
        "de row is deleted, en row is renamed"
    );

    let fetched = ctx
        .server
        .get(&format!("/api/v1/menus/{menu_id}"))
        .add_header("x-api-key", write_key.as_str())
        .await;
    fetched.assert_status_ok();
    assert_eq!(
        localization_names(&fetched.json()),
        vec![(en.to_string(), "Footer navigation".to_string())],
        "the removal persisted"
    );
}

#[tokio::test]
#[serial]
async fn menu_update_removal_alone_deletes_the_row() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;
    let de = locale_id(&ctx.pool, "de").await;
    let en = locale_id(&ctx.pool, "en").await;

    let menu_id = create_menu_with_names(
        &ctx,
        site_id,
        &write_key,
        "footer-rm-only",
        json!([
            { "locale_id": de, "name": "Fußzeile" },
            { "locale_id": en, "name": "Footer links" },
        ]),
    )
    .await;

    let updated = ctx
        .server
        .put(&format!("/api/v1/menus/{menu_id}"))
        .add_header("x-api-key", write_key.as_str())
        .json(&json!({ "removed_locale_ids": [en] }))
        .await;
    updated.assert_status_ok();
    assert_eq!(
        localization_names(&updated.json()),
        vec![(de.to_string(), "Fußzeile".to_string())],
        "only the removed locale's row is deleted"
    );
}

#[tokio::test]
#[serial]
async fn menu_update_locale_in_both_upserts_and_removals_conflicts() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;
    let de = locale_id(&ctx.pool, "de").await;

    let menu_id = create_menu_with_names(
        &ctx,
        site_id,
        &write_key,
        "footer-rm-conflict",
        json!([{ "locale_id": de, "name": "Fußzeile" }]),
    )
    .await;

    let conflicted = ctx
        .server
        .put(&format!("/api/v1/menus/{menu_id}"))
        .add_header("x-api-key", write_key.as_str())
        .json(&json!({
            "localizations": [{ "locale_id": de, "name": "Fußbereich" }],
            "removed_locale_ids": [de],
        }))
        .await;
    conflicted.assert_status(StatusCode::UNPROCESSABLE_ENTITY);

    let fetched = ctx
        .server
        .get(&format!("/api/v1/menus/{menu_id}"))
        .add_header("x-api-key", write_key.as_str())
        .await;
    fetched.assert_status_ok();
    assert_eq!(
        localization_names(&fetched.json()),
        vec![(de.to_string(), "Fußzeile".to_string())],
        "the conflicted request changed nothing"
    );
}
