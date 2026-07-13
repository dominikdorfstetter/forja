//! First-class legal-document references on navigation items
//! (consumer-feedback roadmap §4): canonical legal slugs (auto-derived from
//! the document type, unique per site, editable only until first publish),
//! exactly-one-of-three link validation, chain-root slug resolution in the
//! public tree, purge tolerance for target-less items, and the demo seed's
//! first-class footer rows.

mod common;

use axum::http::StatusCode;
use serde_json::json;
use serial_test::serial;
use sqlx::PgPool;
use uuid::Uuid;

use forja::dto::legal::CreateLegalDocumentRequest;
use forja::errors::codes;
use forja::models::api_key::ApiKeyPermission;
use forja::models::content::ContentStatus;
use forja::models::legal::{LegalDocType, LegalDocument};
use forja::models::navigation::NavigationItem;
use forja::models::site_locale::SiteLocale;
use forja::repos::legal_repo::LegalDocumentRepo;
use forja::services::content_service::ContentService;

use common::{TestContext, create_test_api_key, create_test_site, enable_module, test_context};

async fn locale_id(pool: &PgPool, code: &str) -> Uuid {
    sqlx::query_scalar("SELECT id FROM locales WHERE code = $1")
        .bind(code)
        .fetch_one(pool)
        .await
        .expect("seeded locale row")
}

fn create_req(
    site_id: Uuid,
    document_type: LegalDocType,
    slug: Option<&str>,
    status: ContentStatus,
) -> CreateLegalDocumentRequest {
    CreateLegalDocumentRequest {
        cookie_name: format!("nav-{}", &Uuid::new_v4().to_string()[..8]),
        document_type,
        slug: slug.map(str::to_string),
        status,
        site_ids: vec![site_id],
    }
}

async fn create_doc(pool: &PgPool, req: CreateLegalDocumentRequest) -> LegalDocument {
    LegalDocumentRepo::create(&mut pool.acquire().await.unwrap(), req, Some("test-user"))
        .await
        .expect("create legal document")
}

async fn content_slug(pool: &PgPool, doc: &LegalDocument) -> Option<String> {
    sqlx::query_scalar("SELECT slug FROM contents WHERE id = $1")
        .bind(doc.content_id.expect("content_id"))
        .fetch_one(pool)
        .await
        .expect("fetch content slug")
}

async fn site_specific_slug(pool: &PgPool, doc: &LegalDocument) -> Option<String> {
    sqlx::query_scalar("SELECT site_specific_slug FROM content_sites WHERE content_id = $1")
        .bind(doc.content_id.expect("content_id"))
        .fetch_one(pool)
        .await
        .expect("fetch site_specific_slug")
}

async fn set_status(pool: &PgPool, doc: &LegalDocument, status: &str) {
    sqlx::query("UPDATE contents SET status = $1::content_status, published_at = CASE WHEN $1 = 'published' THEN NOW() ELSE published_at END WHERE id = $2")
        .bind(status)
        .bind(doc.content_id.expect("content_id"))
        .execute(pool)
        .await
        .expect("set content status");
}

async fn create_menu(ctx: &TestContext, site_id: Uuid, write_key: &str, slug: &str) -> Uuid {
    let resp = ctx
        .server
        .post(&format!("/api/v1/sites/{site_id}/menus"))
        .add_header("x-api-key", write_key)
        .json(&json!({ "slug": slug }))
        .await;
    resp.assert_status(StatusCode::CREATED);
    resp.json::<serde_json::Value>()["id"]
        .as_str()
        .expect("menu id")
        .parse()
        .expect("menu id uuid")
}

fn item_body(site_id: Uuid, menu_id: Uuid, extra: serde_json::Value) -> serde_json::Value {
    let mut body = json!({
        "site_id": site_id,
        "menu_id": menu_id,
        "display_order": 0,
    });
    body.as_object_mut()
        .expect("object")
        .extend(extra.as_object().expect("object").clone());
    body
}

async fn tree(ctx: &TestContext, menu_id: Uuid, read_key: &str) -> serde_json::Value {
    let resp = ctx
        .server
        .get(&format!("/api/v1/menus/{menu_id}/tree"))
        .add_header("x-api-key", read_key)
        .await;
    resp.assert_status_ok();
    resp.json()
}

async fn admin_items(ctx: &TestContext, menu_id: Uuid, read_key: &str) -> serde_json::Value {
    let resp = ctx
        .server
        .get(&format!("/api/v1/menus/{menu_id}/items"))
        .add_header("x-api-key", read_key)
        .await;
    resp.assert_status_ok();
    resp.json()
}

// ── Canonical legal slug ────────────────────────────────────────────────

#[tokio::test]
#[serial]
async fn create_without_slug_derives_it_from_document_type() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;

    let doc = create_doc(
        &ctx.pool,
        create_req(
            site_id,
            LegalDocType::PrivacyPolicy,
            None,
            ContentStatus::Draft,
        ),
    )
    .await;

    assert_eq!(
        content_slug(&ctx.pool, &doc).await.as_deref(),
        Some("privacy-policy")
    );
    assert_eq!(
        site_specific_slug(&ctx.pool, &doc).await.as_deref(),
        Some("privacy-policy"),
        "slug is mirrored into the #762 per-site uniqueness join table"
    );

    let resolved = LegalDocumentRepo::find_by_slug_for_site(&ctx.pool, site_id, "privacy-policy")
        .await
        .expect("derived slug resolves");
    assert_eq!(resolved.id, doc.id);
}

#[tokio::test]
#[serial]
async fn create_respects_an_explicit_slug() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;

    let doc = create_doc(
        &ctx.pool,
        create_req(
            site_id,
            LegalDocType::PrivacyPolicy,
            Some("datenschutz"),
            ContentStatus::Draft,
        ),
    )
    .await;

    assert_eq!(
        content_slug(&ctx.pool, &doc).await.as_deref(),
        Some("datenschutz")
    );
    let resolved = LegalDocumentRepo::find_by_slug_for_site(&ctx.pool, site_id, "datenschutz")
        .await
        .expect("explicit slug resolves");
    assert_eq!(resolved.id, doc.id);
}

#[tokio::test]
#[serial]
async fn create_rejects_a_per_site_slug_collision() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;

    create_doc(
        &ctx.pool,
        create_req(
            site_id,
            LegalDocType::PrivacyPolicy,
            None,
            ContentStatus::Draft,
        ),
    )
    .await;

    let err = LegalDocumentRepo::create(
        &mut ctx.pool.acquire().await.unwrap(),
        create_req(
            site_id,
            LegalDocType::PrivacyPolicy,
            None,
            ContentStatus::Draft,
        ),
        Some("test-user"),
    )
    .await
    .expect_err("second privacy-policy on the same site collides");
    assert_eq!(err.code(), codes::ENTITY_SLUG_TAKEN);

    let err = LegalDocumentRepo::create(
        &mut ctx.pool.acquire().await.unwrap(),
        create_req(
            site_id,
            LegalDocType::Imprint,
            Some("privacy-policy"),
            ContentStatus::Draft,
        ),
        Some("test-user"),
    )
    .await
    .expect_err("explicit slug collides too");
    assert_eq!(err.code(), codes::ENTITY_SLUG_TAKEN);
}

#[tokio::test]
#[serial]
async fn same_slug_on_another_site_is_fine() {
    let ctx = test_context().await;
    let site_a = create_test_site(&ctx.pool).await;
    let site_b = create_test_site(&ctx.pool).await;

    let doc_a = create_doc(
        &ctx.pool,
        create_req(
            site_a,
            LegalDocType::PrivacyPolicy,
            None,
            ContentStatus::Draft,
        ),
    )
    .await;
    let doc_b = create_doc(
        &ctx.pool,
        create_req(
            site_b,
            LegalDocType::PrivacyPolicy,
            None,
            ContentStatus::Draft,
        ),
    )
    .await;

    assert_eq!(
        content_slug(&ctx.pool, &doc_a).await.as_deref(),
        Some("privacy-policy")
    );
    assert_eq!(
        content_slug(&ctx.pool, &doc_b).await.as_deref(),
        Some("privacy-policy")
    );
}

#[tokio::test]
#[serial]
async fn slug_is_editable_before_publish_and_locked_after() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    enable_module(&ctx.pool, site_id, "legal").await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;

    let doc = create_doc(
        &ctx.pool,
        create_req(
            site_id,
            LegalDocType::TermsOfService,
            None,
            ContentStatus::Draft,
        ),
    )
    .await;

    let renamed = ctx
        .server
        .put(&format!("/api/v1/legal/{}", doc.id))
        .add_header("x-api-key", write_key.as_str())
        .json(&json!({ "slug": "agb" }))
        .await;
    renamed.assert_status_ok();
    assert_eq!(content_slug(&ctx.pool, &doc).await.as_deref(), Some("agb"));
    LegalDocumentRepo::find_by_slug_for_site(&ctx.pool, site_id, "agb")
        .await
        .expect("new slug resolves");
    LegalDocumentRepo::find_by_slug_for_site(&ctx.pool, site_id, "terms-of-service")
        .await
        .expect_err("old slug is released");

    set_status(&ctx.pool, &doc, "published").await;

    let locked = ctx
        .server
        .put(&format!("/api/v1/legal/{}", doc.id))
        .add_header("x-api-key", write_key.as_str())
        .json(&json!({ "slug": "agb-2" }))
        .await;
    locked.assert_status(StatusCode::CONFLICT);
    assert_eq!(
        locked.json::<serde_json::Value>()["code"],
        codes::LEGAL_SLUG_IMMUTABLE
    );
    assert_eq!(
        content_slug(&ctx.pool, &doc).await.as_deref(),
        Some("agb"),
        "published chain keeps its slug"
    );
}

#[tokio::test]
#[serial]
async fn derived_slug_resolves_across_a_version_chain() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;

    let v1 = create_doc(
        &ctx.pool,
        create_req(
            site_id,
            LegalDocType::Imprint,
            None,
            ContentStatus::Published,
        ),
    )
    .await;
    let v2 =
        LegalDocumentRepo::create_new_version(&ctx.pool, v1.id, vec![site_id], Some("test-user"))
            .await
            .expect("create v2");

    assert_eq!(
        content_slug(&ctx.pool, &v2).await,
        None,
        "version clones carry no slug of their own"
    );

    set_status(&ctx.pool, &v2, "published").await;
    LegalDocumentRepo::supersede_other_published_versions(&ctx.pool, v2.id)
        .await
        .expect("supersede v1");

    let resolved = LegalDocumentRepo::find_by_slug_for_site(&ctx.pool, site_id, "imprint")
        .await
        .expect("root slug still resolves after publishing v2");
    assert_eq!(
        resolved.id, v2.id,
        "chain root slug serves the live version"
    );
}

// ── Navigation items with legal references ──────────────────────────────

#[tokio::test]
#[serial]
async fn nav_item_write_enforces_exactly_one_link_target() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;
    let menu_id = create_menu(&ctx, site_id, &write_key, "footer-v").await;

    let doc = create_doc(
        &ctx.pool,
        create_req(
            site_id,
            LegalDocType::PrivacyPolicy,
            None,
            ContentStatus::Published,
        ),
    )
    .await;

    let none = ctx
        .server
        .post(&format!("/api/v1/menus/{menu_id}/items"))
        .add_header("x-api-key", write_key.as_str())
        .json(&item_body(site_id, menu_id, json!({})))
        .await;
    none.assert_status(StatusCode::UNPROCESSABLE_ENTITY);

    let two = ctx
        .server
        .post(&format!("/api/v1/menus/{menu_id}/items"))
        .add_header("x-api-key", write_key.as_str())
        .json(&item_body(
            site_id,
            menu_id,
            json!({ "external_url": "/blog", "legal_document_id": doc.id }),
        ))
        .await;
    two.assert_status(StatusCode::UNPROCESSABLE_ENTITY);

    let ok = ctx
        .server
        .post(&format!("/api/v1/menus/{menu_id}/items"))
        .add_header("x-api-key", write_key.as_str())
        .json(&item_body(
            site_id,
            menu_id,
            json!({ "legal_document_id": doc.id }),
        ))
        .await;
    ok.assert_status(StatusCode::CREATED);
    let body: serde_json::Value = ok.json();
    assert_eq!(body["legal_document_id"], doc.id.to_string());
    assert_eq!(body["external_url"], serde_json::Value::Null);
}

#[tokio::test]
#[serial]
async fn nav_item_update_switches_the_link_target() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;
    let menu_id = create_menu(&ctx, site_id, &write_key, "footer-w").await;

    let doc = create_doc(
        &ctx.pool,
        create_req(
            site_id,
            LegalDocType::Disclaimer,
            None,
            ContentStatus::Published,
        ),
    )
    .await;

    let created = ctx
        .server
        .post(&format!("/api/v1/menus/{menu_id}/items"))
        .add_header("x-api-key", write_key.as_str())
        .json(&item_body(
            site_id,
            menu_id,
            json!({ "external_url": "/legal/disclaimer" }),
        ))
        .await;
    created.assert_status(StatusCode::CREATED);
    let item_id = created.json::<serde_json::Value>()["id"]
        .as_str()
        .expect("item id")
        .to_string();

    let two = ctx
        .server
        .put(&format!("/api/v1/navigation/{item_id}"))
        .add_header("x-api-key", write_key.as_str())
        .json(&json!({ "external_url": "/x", "legal_document_id": doc.id }))
        .await;
    two.assert_status(StatusCode::UNPROCESSABLE_ENTITY);

    let switched = ctx
        .server
        .put(&format!("/api/v1/navigation/{item_id}"))
        .add_header("x-api-key", write_key.as_str())
        .json(&json!({ "legal_document_id": doc.id }))
        .await;
    switched.assert_status_ok();
    let body: serde_json::Value = switched.json();
    assert_eq!(body["legal_document_id"], doc.id.to_string());
    assert_eq!(
        body["external_url"],
        serde_json::Value::Null,
        "switching targets clears the previous one"
    );
}

#[tokio::test]
#[serial]
async fn public_tree_resolves_the_chain_root_slug() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;
    let read_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;
    let menu_id = create_menu(&ctx, site_id, &write_key, "footer-x").await;

    let v1 = create_doc(
        &ctx.pool,
        create_req(
            site_id,
            LegalDocType::PrivacyPolicy,
            None,
            ContentStatus::Published,
        ),
    )
    .await;
    let v2 =
        LegalDocumentRepo::create_new_version(&ctx.pool, v1.id, vec![site_id], Some("test-user"))
            .await
            .expect("create v2");

    // The item may reference any version in the chain — the tree resolves
    // the ROOT slug either way.
    let created = ctx
        .server
        .post(&format!("/api/v1/menus/{menu_id}/items"))
        .add_header("x-api-key", write_key.as_str())
        .json(&item_body(
            site_id,
            menu_id,
            json!({ "legal_document_id": v2.id }),
        ))
        .await;
    created.assert_status(StatusCode::CREATED);

    let tree = tree(&ctx, menu_id, &read_key).await;
    let items = tree.as_array().expect("tree array");
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["legal_document_id"], v2.id.to_string());
    assert_eq!(items[0]["legal_slug"], "privacy-policy");
    assert_eq!(items[0]["page_slug"], serde_json::Value::Null);
}

#[tokio::test]
#[serial]
async fn purging_the_legal_document_nulls_the_fk_and_hides_the_item_publicly() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;
    let read_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;
    let menu_id = create_menu(&ctx, site_id, &write_key, "footer-y").await;

    let doc = create_doc(
        &ctx.pool,
        create_req(
            site_id,
            LegalDocType::TermsOfService,
            None,
            ContentStatus::Published,
        ),
    )
    .await;
    let created = ctx
        .server
        .post(&format!("/api/v1/menus/{menu_id}/items"))
        .add_header("x-api-key", write_key.as_str())
        .json(&item_body(
            site_id,
            menu_id,
            json!({ "legal_document_id": doc.id }),
        ))
        .await;
    created.assert_status(StatusCode::CREATED);
    let item_id: Uuid = created.json::<serde_json::Value>()["id"]
        .as_str()
        .expect("item id")
        .parse()
        .expect("uuid");

    LegalDocumentRepo::soft_delete(&ctx.pool, doc.id)
        .await
        .expect("trash the document");
    LegalDocumentRepo::permanent_delete(&ctx.pool, doc.id)
        .await
        .expect("purge the document");

    let item = NavigationItem::find_by_id(&ctx.pool, item_id)
        .await
        .expect("item survives the purge target-less");
    assert_eq!(item.legal_document_id, None, "ON DELETE SET NULL fired");
    assert_eq!(item.page_id, None);
    assert_eq!(item.external_url, None);

    let tree = tree(&ctx, menu_id, &read_key).await;
    assert!(
        tree.as_array().expect("tree array").is_empty(),
        "broken links never render in the public tree"
    );

    let admin = admin_items(&ctx, menu_id, &read_key).await;
    let rows = admin.as_array().expect("items array");
    assert_eq!(rows.len(), 1, "admin read keeps the broken item for repair");
    assert_eq!(rows[0]["id"], item_id.to_string());
    assert_eq!(rows[0]["legal_document_id"], serde_json::Value::Null);
}

#[tokio::test]
#[serial]
async fn page_purge_leaves_a_page_only_item_target_less() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;
    let read_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;
    let menu_id = create_menu(&ctx, site_id, &write_key, "footer-z").await;

    let page_id = {
        let mut conn = ctx.pool.acquire().await.unwrap();
        let content_id = ContentService::create_content(
            &mut conn,
            "page",
            Some("nav-purge-page"),
            &ContentStatus::Published,
            &[site_id],
            None,
            None,
            Some("test-user"),
        )
        .await
        .expect("page content");
        sqlx::query_scalar::<_, Uuid>(
            "INSERT INTO pages (content_id, route) VALUES ($1, '/nav-purge-page') RETURNING id",
        )
        .bind(content_id)
        .fetch_one(&ctx.pool)
        .await
        .expect("page row")
    };

    let created = ctx
        .server
        .post(&format!("/api/v1/menus/{menu_id}/items"))
        .add_header("x-api-key", write_key.as_str())
        .json(&item_body(site_id, menu_id, json!({ "page_id": page_id })))
        .await;
    created.assert_status(StatusCode::CREATED);
    let item_id: Uuid = created.json::<serde_json::Value>()["id"]
        .as_str()
        .expect("item id")
        .parse()
        .expect("uuid");

    // The latent chk_nav_target bug: this DELETE used to re-check the
    // constraint while SET NULL cleared the only target.
    sqlx::query("DELETE FROM pages WHERE id = $1")
        .bind(page_id)
        .execute(&ctx.pool)
        .await
        .expect("page purge must not violate any navigation CHECK");

    let item = NavigationItem::find_by_id(&ctx.pool, item_id)
        .await
        .expect("item survives target-less");
    assert_eq!(item.page_id, None);
    assert_eq!(item.external_url, None);
    assert_eq!(item.legal_document_id, None);

    assert!(
        tree(&ctx, menu_id, &read_key)
            .await
            .as_array()
            .expect("tree array")
            .is_empty()
    );
    assert_eq!(
        admin_items(&ctx, menu_id, &read_key)
            .await
            .as_array()
            .expect("items array")
            .len(),
        1
    );
}

#[tokio::test]
#[serial]
async fn soft_deleted_legal_document_drops_from_the_public_tree_until_restored() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;
    let read_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;
    let menu_id = create_menu(&ctx, site_id, &write_key, "footer-trash").await;

    let doc = create_doc(
        &ctx.pool,
        create_req(
            site_id,
            LegalDocType::PrivacyPolicy,
            None,
            ContentStatus::Published,
        ),
    )
    .await;
    let created = ctx
        .server
        .post(&format!("/api/v1/menus/{menu_id}/items"))
        .add_header("x-api-key", write_key.as_str())
        .json(&item_body(
            site_id,
            menu_id,
            json!({ "legal_document_id": doc.id }),
        ))
        .await;
    created.assert_status(StatusCode::CREATED);
    let item_id = created.json::<serde_json::Value>()["id"]
        .as_str()
        .expect("item id")
        .to_string();

    LegalDocumentRepo::soft_delete(&ctx.pool, doc.id)
        .await
        .expect("trash the document");

    let public = tree(&ctx, menu_id, &read_key).await;
    assert!(
        public.as_array().expect("tree array").is_empty(),
        "a trashed target must not leave a dead link in the public tree"
    );

    let admin = admin_items(&ctx, menu_id, &read_key).await;
    let rows = admin.as_array().expect("items array");
    assert_eq!(rows.len(), 1, "admin read keeps the item for repair");
    assert_eq!(rows[0]["id"], item_id);
    assert_eq!(
        rows[0]["legal_document_id"],
        doc.id.to_string(),
        "the reference itself survives the trash"
    );

    LegalDocumentRepo::restore(&ctx.pool, doc.id)
        .await
        .expect("restore the document");

    let public = tree(&ctx, menu_id, &read_key).await;
    let items = public.as_array().expect("tree array");
    assert_eq!(items.len(), 1, "restore brings the public link back");
    assert_eq!(items[0]["legal_slug"], "privacy-policy");
}

#[tokio::test]
#[serial]
async fn nav_item_create_rejects_a_cross_site_legal_document() {
    let ctx = test_context().await;
    let site_a = create_test_site(&ctx.pool).await;
    let site_b = create_test_site(&ctx.pool).await;
    let write_key_b = create_test_api_key(&ctx.pool, site_b, ApiKeyPermission::Write).await;
    let menu_b = create_menu(&ctx, site_b, &write_key_b, "footer-xsite").await;

    let foreign_doc = create_doc(
        &ctx.pool,
        create_req(
            site_a,
            LegalDocType::PrivacyPolicy,
            None,
            ContentStatus::Published,
        ),
    )
    .await;
    let own_doc = create_doc(
        &ctx.pool,
        create_req(
            site_b,
            LegalDocType::Imprint,
            None,
            ContentStatus::Published,
        ),
    )
    .await;

    let rejected = ctx
        .server
        .post(&format!("/api/v1/menus/{menu_b}/items"))
        .add_header("x-api-key", write_key_b.as_str())
        .json(&item_body(
            site_b,
            menu_b,
            json!({ "legal_document_id": foreign_doc.id }),
        ))
        .await;
    rejected.assert_status(StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(
        rejected.json::<serde_json::Value>()["code"],
        codes::LEGAL_DOC_CROSS_SITE
    );

    let accepted = ctx
        .server
        .post(&format!("/api/v1/menus/{menu_b}/items"))
        .add_header("x-api-key", write_key_b.as_str())
        .json(&item_body(
            site_b,
            menu_b,
            json!({ "legal_document_id": own_doc.id }),
        ))
        .await;
    accepted.assert_status(StatusCode::CREATED);
}

#[tokio::test]
#[serial]
async fn nav_item_update_rejects_a_cross_site_legal_document() {
    let ctx = test_context().await;
    let site_a = create_test_site(&ctx.pool).await;
    let site_b = create_test_site(&ctx.pool).await;
    let write_key_b = create_test_api_key(&ctx.pool, site_b, ApiKeyPermission::Write).await;
    let menu_b = create_menu(&ctx, site_b, &write_key_b, "footer-xsite-upd").await;

    let foreign_doc = create_doc(
        &ctx.pool,
        create_req(
            site_a,
            LegalDocType::Disclaimer,
            None,
            ContentStatus::Published,
        ),
    )
    .await;
    let own_doc = create_doc(
        &ctx.pool,
        create_req(
            site_b,
            LegalDocType::TermsOfService,
            None,
            ContentStatus::Published,
        ),
    )
    .await;

    let created = ctx
        .server
        .post(&format!("/api/v1/menus/{menu_b}/items"))
        .add_header("x-api-key", write_key_b.as_str())
        .json(&item_body(
            site_b,
            menu_b,
            json!({ "external_url": "/contact" }),
        ))
        .await;
    created.assert_status(StatusCode::CREATED);
    let item_id = created.json::<serde_json::Value>()["id"]
        .as_str()
        .expect("item id")
        .to_string();

    let rejected = ctx
        .server
        .put(&format!("/api/v1/navigation/{item_id}"))
        .add_header("x-api-key", write_key_b.as_str())
        .json(&json!({ "legal_document_id": foreign_doc.id }))
        .await;
    rejected.assert_status(StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(
        rejected.json::<serde_json::Value>()["code"],
        codes::LEGAL_DOC_CROSS_SITE
    );

    let switched = ctx
        .server
        .put(&format!("/api/v1/navigation/{item_id}"))
        .add_header("x-api-key", write_key_b.as_str())
        .json(&json!({ "legal_document_id": own_doc.id }))
        .await;
    switched.assert_status_ok();
    assert_eq!(
        switched.json::<serde_json::Value>()["legal_document_id"],
        own_doc.id.to_string()
    );
}

// ── Cross-site page references (mirror of the legal FK validation) ──────

/// Insert a published page assigned to `site_id`, returning its id.
async fn create_page(pool: &PgPool, site_id: Uuid, route: &str) -> Uuid {
    let mut conn = pool.acquire().await.unwrap();
    let content_id = ContentService::create_content(
        &mut conn,
        "page",
        Some(&format!("nav-page-{}", &Uuid::new_v4().to_string()[..8])),
        &ContentStatus::Published,
        &[site_id],
        None,
        None,
        Some("test-user"),
    )
    .await
    .expect("page content");
    sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO pages (content_id, route) VALUES ($1, $2) RETURNING id",
    )
    .bind(content_id)
    .bind(route)
    .fetch_one(pool)
    .await
    .expect("page row")
}

#[tokio::test]
#[serial]
async fn nav_item_create_rejects_a_cross_site_page() {
    let ctx = test_context().await;
    let site_a = create_test_site(&ctx.pool).await;
    let site_b = create_test_site(&ctx.pool).await;
    let write_key_b = create_test_api_key(&ctx.pool, site_b, ApiKeyPermission::Write).await;
    let menu_b = create_menu(&ctx, site_b, &write_key_b, "footer-xsite-page").await;

    let foreign_page = create_page(&ctx.pool, site_a, "/foreign-about").await;
    let own_page = create_page(&ctx.pool, site_b, "/own-about").await;

    let rejected = ctx
        .server
        .post(&format!("/api/v1/menus/{menu_b}/items"))
        .add_header("x-api-key", write_key_b.as_str())
        .json(&item_body(
            site_b,
            menu_b,
            json!({ "page_id": foreign_page }),
        ))
        .await;
    rejected.assert_status(StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(
        rejected.json::<serde_json::Value>()["code"],
        codes::PAGE_CROSS_SITE
    );

    let accepted = ctx
        .server
        .post(&format!("/api/v1/menus/{menu_b}/items"))
        .add_header("x-api-key", write_key_b.as_str())
        .json(&item_body(site_b, menu_b, json!({ "page_id": own_page })))
        .await;
    accepted.assert_status(StatusCode::CREATED);
}

#[tokio::test]
#[serial]
async fn nav_item_update_rejects_a_cross_site_page() {
    let ctx = test_context().await;
    let site_a = create_test_site(&ctx.pool).await;
    let site_b = create_test_site(&ctx.pool).await;
    let write_key_b = create_test_api_key(&ctx.pool, site_b, ApiKeyPermission::Write).await;
    let menu_b = create_menu(&ctx, site_b, &write_key_b, "footer-xsite-page-upd").await;

    let foreign_page = create_page(&ctx.pool, site_a, "/foreign-contact").await;
    let own_page = create_page(&ctx.pool, site_b, "/own-contact").await;

    let created = ctx
        .server
        .post(&format!("/api/v1/menus/{menu_b}/items"))
        .add_header("x-api-key", write_key_b.as_str())
        .json(&item_body(
            site_b,
            menu_b,
            json!({ "external_url": "/somewhere" }),
        ))
        .await;
    created.assert_status(StatusCode::CREATED);
    let item_id = created.json::<serde_json::Value>()["id"]
        .as_str()
        .expect("item id")
        .to_string();

    let rejected = ctx
        .server
        .put(&format!("/api/v1/navigation/{item_id}"))
        .add_header("x-api-key", write_key_b.as_str())
        .json(&json!({ "page_id": foreign_page }))
        .await;
    rejected.assert_status(StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(
        rejected.json::<serde_json::Value>()["code"],
        codes::PAGE_CROSS_SITE
    );

    let switched = ctx
        .server
        .put(&format!("/api/v1/navigation/{item_id}"))
        .add_header("x-api-key", write_key_b.as_str())
        .json(&json!({ "page_id": own_page }))
        .await;
    switched.assert_status_ok();
    assert_eq!(
        switched.json::<serde_json::Value>()["page_id"],
        own_page.to_string()
    );
}

/// Defense in depth: a cross-site page row seeded behind the validation
/// (direct SQL) never leaks a foreign route into the public tree — the
/// site-scoped page join drops the item, and the admin read keeps it for
/// repair, mirroring the legal chain-root behaviour.
#[tokio::test]
#[serial]
async fn tree_drops_a_cross_site_page_item() {
    let ctx = test_context().await;
    let site_a = create_test_site(&ctx.pool).await;
    let site_b = create_test_site(&ctx.pool).await;
    let write_key_b = create_test_api_key(&ctx.pool, site_b, ApiKeyPermission::Write).await;
    let read_key_b = create_test_api_key(&ctx.pool, site_b, ApiKeyPermission::Read).await;
    let menu_b = create_menu(&ctx, site_b, &write_key_b, "footer-xsite-tree").await;

    let foreign_page = create_page(&ctx.pool, site_a, "/foreign-leak").await;
    sqlx::query(
        "INSERT INTO navigation_items (site_id, menu_id, page_id, display_order)
         VALUES ($1, $2, $3, 0)",
    )
    .bind(site_b)
    .bind(menu_b)
    .bind(foreign_page)
    .execute(&ctx.pool)
    .await
    .expect("seed cross-site item behind the validation");

    let public = tree(&ctx, menu_b, &read_key_b).await;
    assert!(
        public.as_array().expect("tree array").is_empty(),
        "a cross-site page must not leak its route into the public tree"
    );

    let admin = admin_items(&ctx, menu_b, &read_key_b).await;
    assert_eq!(
        admin.as_array().expect("items array").len(),
        1,
        "admin read keeps the item for repair"
    );
}

// ── Locale-mode tree title fallback (ADR 0002) ──────────────────────────

#[tokio::test]
#[serial]
async fn tree_locale_mode_titles_fall_back_to_default_then_first() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;
    let read_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;
    let menu_id = create_menu(&ctx, site_id, &write_key, "footer-l10n").await;

    let de = locale_id(&ctx.pool, "de").await;
    let en = locale_id(&ctx.pool, "en").await;
    let es = locale_id(&ctx.pool, "es").await;
    SiteLocale::add(&ctx.pool, site_id, de, true, Some("de"))
        .await
        .expect("add de");
    SiteLocale::add(&ctx.pool, site_id, en, false, Some("en"))
        .await
        .expect("add en");
    SiteLocale::add(&ctx.pool, site_id, es, false, Some("es"))
        .await
        .expect("add es");

    for (url, order, localizations) in [
        (
            "/exact",
            0,
            json!([
                { "locale_id": de, "title": "Genau (DE)" },
                { "locale_id": en, "title": "Exact (EN)" },
            ]),
        ),
        (
            "/default-only",
            1,
            json!([{ "locale_id": de, "title": "Nur Standard (DE)" }]),
        ),
        (
            "/no-default",
            2,
            json!([{ "locale_id": es, "title": "Sin defecto (ES)" }]),
        ),
    ] {
        let created = ctx
            .server
            .post(&format!("/api/v1/menus/{menu_id}/items"))
            .add_header("x-api-key", write_key.as_str())
            .json(&item_body(
                site_id,
                menu_id,
                json!({
                    "external_url": url,
                    "display_order": order,
                    "localizations": localizations,
                }),
            ))
            .await;
        created.assert_status(StatusCode::CREATED);
    }

    let resp = ctx
        .server
        .get(&format!("/api/v1/menus/{menu_id}/tree?locale=en"))
        .add_header("x-api-key", read_key.as_str())
        .await;
    resp.assert_status_ok();
    let tree: serde_json::Value = resp.json();
    let items = tree.as_array().expect("tree array");
    assert_eq!(items.len(), 3);

    let title_of = |url: &str| -> serde_json::Value {
        items
            .iter()
            .find(|i| i["external_url"] == url)
            .unwrap_or_else(|| panic!("item {url}"))["title"]
            .clone()
    };
    assert_eq!(
        title_of("/exact"),
        "Exact (EN)",
        "requested locale wins when present"
    );
    assert_eq!(
        title_of("/default-only"),
        "Nur Standard (DE)",
        "missing requested locale falls back to the site default"
    );
    assert_eq!(
        title_of("/no-default"),
        "Sin defecto (ES)",
        "no requested or default localization falls back to the first available"
    );
}

// ── Restore backfills a pre-slug-era chain root ─────────────────────────

/// Insert a chain root the way the pre-076 create path did: a
/// `legal_document` content row with a NULL slug.
async fn create_slug_less_root(
    pool: &PgPool,
    site_id: Uuid,
    cookie_name: &str,
    document_type: &str,
) -> Uuid {
    let mut conn = pool.acquire().await.unwrap();
    let content_id = ContentService::create_content(
        &mut conn,
        "legal_document",
        None,
        &ContentStatus::Published,
        &[site_id],
        None,
        None,
        Some("test-user"),
    )
    .await
    .expect("slug-less content row");
    sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO legal_documents (content_id, cookie_name, document_type)
         VALUES ($1, $2, $3::legal_doc_type) RETURNING id",
    )
    .bind(content_id)
    .bind(cookie_name)
    .bind(document_type)
    .fetch_one(pool)
    .await
    .expect("legal root row")
}

#[tokio::test]
#[serial]
async fn restore_backfills_a_missing_chain_root_slug() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;

    let doc_id = create_slug_less_root(&ctx.pool, site_id, "pre_slug_era", "privacy_policy").await;

    LegalDocumentRepo::soft_delete(&ctx.pool, doc_id)
        .await
        .expect("trash the document");
    LegalDocumentRepo::restore(&ctx.pool, doc_id)
        .await
        .expect("restore the document");

    let doc = LegalDocumentRepo::find_by_id(&ctx.pool, doc_id)
        .await
        .expect("restored document");
    assert_eq!(
        content_slug(&ctx.pool, &doc).await.as_deref(),
        Some("privacy-policy"),
        "restore derives the canonical slug the create path would have set"
    );
    assert_eq!(
        site_specific_slug(&ctx.pool, &doc).await.as_deref(),
        Some("privacy-policy"),
        "slug is mirrored into the #762 per-site uniqueness join table"
    );
    let resolved = LegalDocumentRepo::find_by_slug_for_site(&ctx.pool, site_id, "privacy-policy")
        .await
        .expect("backfilled slug resolves");
    assert_eq!(resolved.id, doc_id);
}

#[tokio::test]
#[serial]
async fn restore_slug_backfill_suffixes_on_a_per_site_collision() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;

    // A live document already owns the canonical slug on this site.
    create_doc(
        &ctx.pool,
        create_req(
            site_id,
            LegalDocType::PrivacyPolicy,
            None,
            ContentStatus::Published,
        ),
    )
    .await;

    let doc_id = create_slug_less_root(&ctx.pool, site_id, "essential", "privacy_policy").await;

    LegalDocumentRepo::soft_delete(&ctx.pool, doc_id)
        .await
        .expect("trash the document");
    LegalDocumentRepo::restore(&ctx.pool, doc_id)
        .await
        .expect("restore the document");

    let doc = LegalDocumentRepo::find_by_id(&ctx.pool, doc_id)
        .await
        .expect("restored document");
    assert_eq!(
        content_slug(&ctx.pool, &doc).await.as_deref(),
        Some("privacy-policy-essential"),
        "collision falls back to the cookie_name suffix"
    );
}

// ── Demo seed sanity ────────────────────────────────────────────────────

/// The test schema is migrations-only (`tests/common::test_db_pool` runs
/// `sqlx::migrate!` and nothing else); the demo seed is a runtime script
/// (`scripts/demo_seed.sql`, executed by `DemoModeFairing` at boot). Apply
/// it here the same way the fairing does and pin that its footer legal
/// links are first-class references, not `/legal/…` free text.
#[tokio::test]
#[serial]
async fn demo_seed_footer_legal_links_are_first_class_references() {
    let ctx = test_context().await;

    sqlx::raw_sql(include_str!("../scripts/demo_seed.sql"))
        .execute(&ctx.pool)
        .await
        .expect("demo seed applies on a migrated schema");

    let demo_site: Uuid = sqlx::query_scalar("SELECT id FROM sites WHERE slug = 'john-forja'")
        .fetch_one(&ctx.pool)
        .await
        .expect("demo site seeded");

    let legacy: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM navigation_items WHERE site_id = $1 AND external_url LIKE '/legal/%'",
    )
    .bind(demo_site)
    .fetch_one(&ctx.pool)
    .await
    .expect("count legacy links");
    assert_eq!(legacy, 0, "no free-text /legal/… links remain in the seed");

    let first_class: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM navigation_items WHERE site_id = $1 AND legal_document_id IS NOT NULL",
    )
    .bind(demo_site)
    .fetch_one(&ctx.pool)
    .await
    .expect("count first-class links");
    assert_eq!(first_class, 2, "privacy policy + imprint footer links");

    let footer_menu: Uuid = sqlx::query_scalar(
        "SELECT id FROM navigation_menus WHERE site_id = $1 AND slug = 'footer'",
    )
    .bind(demo_site)
    .fetch_one(&ctx.pool)
    .await
    .expect("footer menu");

    let tree = NavigationItem::find_tree_for_menu(&ctx.pool, footer_menu, None)
        .await
        .expect("footer tree");
    let mut legal_slugs: Vec<String> = tree
        .iter()
        .filter_map(|item| item.legal_slug.clone())
        .collect();
    legal_slugs.sort();
    assert_eq!(legal_slugs, ["imprint", "privacy-policy"]);
}
