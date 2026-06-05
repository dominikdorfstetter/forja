//! Issue #753 — ?locale= resolver tracer-bullet on /projects.
//!
//! End-to-end integration: seed a site with three locales (de/en/es,
//! default de) and a project with three localizations, then hit the
//! HTTP endpoints with and without ?locale= and assert ADR 0002's
//! contract holds.

mod common;

use serial_test::serial;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use forja::dto::project::{CreateProjectLocalizationRequest, CreateProjectRequest};
use forja::models::api_key::ApiKeyPermission;
use forja::models::content::ContentStatus;
use forja::models::site_locale::SiteLocale;
use forja::repos::project_repo::ProjectRepo;

use common::{create_test_api_key, create_test_site, enable_module, test_context};

async fn locale_id(pool: &PgPool, code: &str) -> Uuid {
    sqlx::query("SELECT id FROM locales WHERE code = $1")
        .bind(code)
        .fetch_one(pool)
        .await
        .expect("seeded locale row")
        .get::<Uuid, _>(0)
}

fn loc_req(locale_id: Uuid, title: &str) -> CreateProjectLocalizationRequest {
    CreateProjectLocalizationRequest {
        locale_id,
        title: title.to_string(),
        short_description: Some(format!("{title} short")),
        description: Some(format!("{title} long")),
    }
}

/// Build a site with {de(default), en, es} locales and one project with
/// localizations in all three. Returns `(site_id, project_id, locale ids)`.
async fn seed_trilingual_project(pool: &PgPool) -> (Uuid, Uuid, (Uuid, Uuid, Uuid)) {
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

    let req = CreateProjectRequest {
        slug: format!("locale-tracer-{}", &Uuid::new_v4().to_string()[..8]),
        display_order: Some(0),
        is_featured: Some(false),
        start_date: None,
        end_date: None,
        is_ongoing: Some(false),
        status: ContentStatus::Draft,
        site_ids: vec![site_id],
        localizations: Some(vec![
            loc_req(de, "DE title"),
            loc_req(en, "EN title"),
            loc_req(es, "ES title"),
        ]),
        links: None,
        media: None,
        skill_ids: None,
        cv_entry_ids: None,
    };
    let project = ProjectRepo::create(&mut pool.acquire().await.unwrap(), req, Some("test"))
        .await
        .expect("create project");

    (site_id, project.id, (de, en, es))
}

#[tokio::test]
#[serial]
async fn list_with_locale_collapses_to_one_localization() {
    let ctx = test_context().await;
    let (site_id, _project_id, (_de, en, _es)) = seed_trilingual_project(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/sites/{site_id}/projects?locale=en"))
        .add_header("x-api-key", key.as_str())
        .await;

    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    let items = body["data"].as_array().expect("data array");
    assert_eq!(items.len(), 1, "one seeded project");
    let locs = items[0]["localizations"].as_array().expect("locs array");
    assert_eq!(locs.len(), 1, "?locale=en collapses to a single entry");
    assert_eq!(locs[0]["locale_id"], en.to_string());
    assert_eq!(locs[0]["title"], "EN title");
}

#[tokio::test]
#[serial]
async fn list_with_unknown_locale_falls_back_to_site_default() {
    let ctx = test_context().await;
    let (site_id, _project_id, (de, _en, _es)) = seed_trilingual_project(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/sites/{site_id}/projects?locale=fr"))
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
    let (site_id, _project_id, _ids) = seed_trilingual_project(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/sites/{site_id}/projects"))
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
    let (site_id, project_id, (_de, en, _es)) = seed_trilingual_project(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/projects/{project_id}/detail?locale=en"))
        .add_header("x-api-key", key.as_str())
        .await;

    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    let locs = body["localizations"].as_array().expect("locs array");
    assert_eq!(locs.len(), 1);
    assert_eq!(locs[0]["locale_id"], en.to_string());
    assert_eq!(locs[0]["title"], "EN title");
}

/// ADR 0003 tracer bullet: the bare `/projects/{id}` route returns the
/// lightweight list shape (no `links`/`media`/`cv_entry_ids`), while
/// `/projects/{id}/detail` exposes the full relational graph.
#[tokio::test]
#[serial]
async fn bare_route_is_lightweight_detail_exposes_relational_graph() {
    let ctx = test_context().await;
    let (site_id, project_id, _ids) = seed_trilingual_project(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let bare = ctx
        .server
        .get(&format!("/api/v1/projects/{project_id}"))
        .add_header("x-api-key", key.as_str())
        .await;
    bare.assert_status_ok();
    let bare_body: serde_json::Value = bare.json();
    assert!(
        bare_body.get("links").is_none(),
        "lightweight shape omits links[]"
    );
    assert!(
        bare_body.get("media").is_none(),
        "lightweight shape omits media[]"
    );
    assert!(
        bare_body.get("cv_entry_ids").is_none(),
        "lightweight shape omits cv_entry_ids[]"
    );
    assert!(
        bare_body["localizations"].is_array(),
        "lightweight shape keeps the list-shape localizations[]"
    );

    let detail = ctx
        .server
        .get(&format!("/api/v1/projects/{project_id}/detail"))
        .add_header("x-api-key", key.as_str())
        .await;
    detail.assert_status_ok();
    let detail_body: serde_json::Value = detail.json();
    assert!(
        detail_body["links"].is_array(),
        "detail shape exposes links[]"
    );
    assert!(
        detail_body["media"].is_array(),
        "detail shape exposes media[]"
    );
    assert!(
        detail_body["cv_entry_ids"].is_array(),
        "detail shape exposes cv_entry_ids[]"
    );
}

#[tokio::test]
#[serial]
async fn detail_by_slug_honours_locale_param() {
    let ctx = test_context().await;
    let (site_id, project_id, (_de, en, _es)) = seed_trilingual_project(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;
    let slug = ProjectRepo::find_by_id(&ctx.pool, project_id)
        .await
        .expect("fetch project")
        .slug;

    let resp = ctx
        .server
        .get(&format!(
            "/api/v1/sites/{site_id}/projects/by-slug/{slug}?locale=en"
        ))
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
async fn project_with_zero_localizations_returns_empty_array_not_404() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    enable_module(&ctx.pool, site_id, "portfolio").await;
    let de = locale_id(&ctx.pool, "de").await;
    SiteLocale::add(&ctx.pool, site_id, de, true, Some("de"))
        .await
        .expect("add de");

    let req = CreateProjectRequest {
        slug: format!("no-locs-{}", &Uuid::new_v4().to_string()[..8]),
        display_order: Some(0),
        is_featured: Some(false),
        start_date: None,
        end_date: None,
        is_ongoing: Some(false),
        status: ContentStatus::Draft,
        site_ids: vec![site_id],
        localizations: None,
        links: None,
        media: None,
        skill_ids: None,
        cv_entry_ids: None,
    };
    ProjectRepo::create(&mut ctx.pool.acquire().await.unwrap(), req, Some("test"))
        .await
        .expect("create project");
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/sites/{site_id}/projects?locale=en"))
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
