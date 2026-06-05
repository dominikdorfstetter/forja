//! Site content-reset: bulk soft-delete every site-scoped content item
//! and site-owned media file into the existing trash, keeping the site
//! row, settings, and memberships (issue #714, epic #708).
//!
//! Vertical-slice TDD: the tracer proves the whole reset path; later
//! tests add legal/navigation coverage, idempotency, the shared-media
//! and cross-site isolation guarantees, and the HTTP + audit seam.

mod common;

use serial_test::serial;
use sqlx::PgPool;
use uuid::Uuid;

use forja::errors::codes;
use forja::models::api_key::ApiKeyPermission;
use forja::models::content::ContentStatus;
use forja::models::site::Site;
use forja::models::site_membership::SiteRole;
use forja::services::content_service::ContentService;
use forja::services::site_content_reset::reset_site_content;

use common::{create_test_api_key, create_test_site, test_context, test_db_pool};

async fn count(pool: &PgPool, sql: &str, id: Uuid) -> i64 {
    sqlx::query_scalar::<_, i64>(sql)
        .bind(id)
        .fetch_one(pool)
        .await
        .expect("count query succeeds")
}

/// Seed one content row (blog) linked to `site_id` via content_sites.
async fn seed_content(pool: &PgPool, site_id: Uuid, slug: &str) -> Uuid {
    ContentService::create_content(
        &mut pool.acquire().await.unwrap(),
        "blog",
        Some(slug),
        &ContentStatus::Draft,
        &[site_id],
        None,
        None,
        None,
    )
    .await
    .expect("seed content")
}

async fn seed_social_link(pool: &PgPool, site_id: Uuid) {
    sqlx::query(
        "INSERT INTO social_links (site_id, title, url, icon) VALUES ($1, 'X', 'https://x.test', 'x')",
    )
    .bind(site_id)
    .execute(pool)
    .await
    .expect("seed social_link");
}

async fn seed_document(pool: &PgPool, site_id: Uuid) {
    sqlx::query(
        "INSERT INTO documents (site_id, url, document_type) VALUES ($1, 'https://d.test/f.pdf', 'pdf')",
    )
    .bind(site_id)
    .execute(pool)
    .await
    .expect("seed document");
}

/// Seed a media file owned by `site_id` (media_sites.is_owner = TRUE).
async fn seed_owned_media(pool: &PgPool, site_id: Uuid) -> Uuid {
    let media_id: Uuid = sqlx::query_scalar(
        "INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_path) \
         VALUES ('a.png', 'a.png', 'image/png', 10, 'local/a.png') RETURNING id",
    )
    .fetch_one(pool)
    .await
    .expect("seed media_file");
    sqlx::query("INSERT INTO media_sites (media_file_id, site_id, is_owner) VALUES ($1, $2, TRUE)")
        .bind(media_id)
        .bind(site_id)
        .execute(pool)
        .await
        .expect("seed media_sites");
    media_id
}

/// Seed a legal document linked to `site_id` through its content row.
async fn seed_legal_document(pool: &PgPool, site_id: Uuid) -> Uuid {
    let content_id = ContentService::create_content(
        &mut pool.acquire().await.unwrap(),
        "legal_document",
        Some(&format!("legal-{}", &Uuid::new_v4().to_string()[..8])),
        &ContentStatus::Draft,
        &[site_id],
        None,
        None,
        None,
    )
    .await
    .expect("seed legal content");
    sqlx::query(
        "INSERT INTO legal_documents (content_id, cookie_name, document_type) \
         VALUES ($1, 'consent', 'privacy_policy') RETURNING id",
    )
    .bind(content_id)
    .execute(pool)
    .await
    .expect("seed legal_document");
    content_id
}

async fn seed_navigation(pool: &PgPool, site_id: Uuid) {
    let menu_id: Uuid = sqlx::query_scalar(
        "INSERT INTO navigation_menus (site_id, slug) VALUES ($1, 'primary') RETURNING id",
    )
    .bind(site_id)
    .fetch_one(pool)
    .await
    .expect("seed navigation_menu");
    sqlx::query(
        "INSERT INTO navigation_items (site_id, menu_id, external_url) \
         VALUES ($1, $2, 'https://nav.test')",
    )
    .bind(site_id)
    .bind(menu_id)
    .execute(pool)
    .await
    .expect("seed navigation_item");
}

#[tokio::test]
#[serial]
async fn tracer_reset_trashes_site_content_and_media_but_keeps_site() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    // Content + media to be trashed.
    let content_id = seed_content(&pool, site_id, "tracer-post").await;
    seed_social_link(&pool, site_id).await;
    seed_document(&pool, site_id).await;
    let media_id = seed_owned_media(&pool, site_id).await;

    // Settings + membership that must survive the reset untouched.
    forja::models::site_settings::SiteSetting::upsert(
        &pool,
        site_id,
        "tracer_key",
        serde_json::json!("keep-me"),
        false,
    )
    .await
    .expect("seed site setting");
    forja::models::site_membership::SiteMembership::create(
        &pool,
        "clerk_tracer_user",
        site_id,
        &SiteRole::Owner,
        None,
    )
    .await
    .expect("seed membership");

    let counts = reset_site_content(&pool, site_id)
        .await
        .expect("reset_site_content succeeds");

    // Per-category counts reflect exactly what was seeded.
    assert_eq!(counts.contents, 1, "one content trashed");
    assert_eq!(counts.social_links, 1, "one social link trashed");
    assert_eq!(counts.documents, 1, "one document trashed");
    assert_eq!(counts.media_files, 1, "one owned media file trashed");
    assert_eq!(counts.total, 4, "total is the sum of every category count");

    // Every seeded item is now soft-deleted with a stamp.
    assert_eq!(
        count(
            &pool,
            "SELECT COUNT(*) FROM contents WHERE id = $1 AND is_deleted = TRUE AND deleted_at IS NOT NULL",
            content_id,
        )
        .await,
        1,
        "content is stamped into trash"
    );
    assert_eq!(
        count(
            &pool,
            "SELECT COUNT(*) FROM media_files WHERE id = $1 AND is_deleted = TRUE AND deleted_at IS NOT NULL",
            media_id,
        )
        .await,
        1,
        "owned media is stamped into trash"
    );
    assert_eq!(
        count(
            &pool,
            "SELECT COUNT(*) FROM social_links WHERE site_id = $1 AND is_deleted = FALSE",
            site_id,
        )
        .await,
        0,
        "no live social links remain"
    );
    assert_eq!(
        count(
            &pool,
            "SELECT COUNT(*) FROM documents WHERE site_id = $1 AND is_deleted = FALSE",
            site_id,
        )
        .await,
        0,
        "no live documents remain"
    );

    // The site itself, its settings, and its members are untouched.
    assert_eq!(
        count(
            &pool,
            "SELECT COUNT(*) FROM sites WHERE id = $1 AND is_deleted = FALSE",
            site_id,
        )
        .await,
        1,
        "site row is left live"
    );
    assert_eq!(
        count(
            &pool,
            "SELECT COUNT(*) FROM site_settings WHERE site_id = $1",
            site_id,
        )
        .await,
        1,
        "site settings are kept"
    );
    assert_eq!(
        count(
            &pool,
            "SELECT COUNT(*) FROM site_memberships WHERE site_id = $1",
            site_id,
        )
        .await,
        1,
        "site memberships are kept"
    );
}

#[tokio::test]
#[serial]
async fn reset_trashes_legal_documents_and_navigation() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    let legal_content = seed_legal_document(&pool, site_id).await;
    seed_navigation(&pool, site_id).await;

    let counts = reset_site_content(&pool, site_id)
        .await
        .expect("reset_site_content succeeds");

    assert_eq!(counts.legal_documents, 1, "one legal document trashed");
    assert_eq!(counts.navigation_menus, 1, "one navigation menu trashed");
    assert_eq!(counts.navigation_items, 1, "one navigation item trashed");
    // The legal doc's backing content row is also trashed (it is a
    // content-backed entity), so it counts once under `contents` too.
    assert_eq!(counts.contents, 1, "legal-backing content trashed");
    assert_eq!(
        counts.total,
        counts.contents
            + counts.legal_documents
            + counts.navigation_menus
            + counts.navigation_items,
        "total sums every category"
    );

    assert_eq!(
        count(
            &pool,
            "SELECT COUNT(*) FROM legal_documents ld JOIN content_sites cs ON ld.content_id = cs.content_id \
             WHERE cs.site_id = $1 AND ld.is_deleted = TRUE AND ld.deleted_at IS NOT NULL",
            site_id,
        )
        .await,
        1,
        "legal document stamped into trash"
    );
    assert_eq!(
        count(
            &pool,
            "SELECT COUNT(*) FROM navigation_menus WHERE site_id = $1 AND is_deleted = FALSE",
            site_id,
        )
        .await,
        0,
        "no live navigation menus remain"
    );
    assert_eq!(
        count(
            &pool,
            "SELECT COUNT(*) FROM navigation_items WHERE site_id = $1 AND is_deleted = FALSE",
            site_id,
        )
        .await,
        0,
        "no live navigation items remain"
    );

    let _ = legal_content;
}

#[tokio::test]
#[serial]
async fn reset_is_idempotent_and_empty_site_yields_zero_counts() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    // Empty site: no error, every count zero.
    let empty = reset_site_content(&pool, site_id)
        .await
        .expect("reset on empty site succeeds");
    assert_eq!(empty.total, 0, "empty site trashes nothing");

    // Seed, reset, then reset again — the second pass is a no-op because
    // every UPDATE filters is_deleted = FALSE.
    seed_content(&pool, site_id, "idem-post").await;
    seed_social_link(&pool, site_id).await;

    let first = reset_site_content(&pool, site_id)
        .await
        .expect("first reset succeeds");
    assert_eq!(first.contents, 1);
    assert_eq!(first.social_links, 1);

    let second = reset_site_content(&pool, site_id)
        .await
        .expect("second reset succeeds");
    assert_eq!(
        second.total, 0,
        "re-resetting an already-reset site trashes nothing"
    );
}

#[tokio::test]
#[serial]
async fn reset_leaves_non_owned_shared_media_intact() {
    let pool = test_db_pool().await;
    let owner_site = create_test_site(&pool).await;
    let sharing_site = create_test_site(&pool).await;

    // One media file owned by `owner_site`, merely shared into
    // `sharing_site` (is_owner = FALSE).
    let media_id: Uuid = sqlx::query_scalar(
        "INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_path) \
         VALUES ('s.png', 's.png', 'image/png', 20, 'local/s.png') RETURNING id",
    )
    .fetch_one(&pool)
    .await
    .expect("seed media_file");
    sqlx::query("INSERT INTO media_sites (media_file_id, site_id, is_owner) VALUES ($1, $2, TRUE)")
        .bind(media_id)
        .bind(owner_site)
        .execute(&pool)
        .await
        .expect("owner link");
    sqlx::query(
        "INSERT INTO media_sites (media_file_id, site_id, is_owner) VALUES ($1, $2, FALSE)",
    )
    .bind(media_id)
    .bind(sharing_site)
    .execute(&pool)
    .await
    .expect("shared link");

    // Resetting the non-owning site must NOT trash the shared media.
    let shared_reset = reset_site_content(&pool, sharing_site)
        .await
        .expect("reset sharing site");
    assert_eq!(
        shared_reset.media_files, 0,
        "shared (non-owned) media is not trashed by the borrowing site"
    );
    assert_eq!(
        count(
            &pool,
            "SELECT COUNT(*) FROM media_files WHERE id = $1 AND is_deleted = FALSE",
            media_id,
        )
        .await,
        1,
        "media file is still live after the non-owning reset"
    );

    // Resetting the owning site trashes it.
    let owner_reset = reset_site_content(&pool, owner_site)
        .await
        .expect("reset owner site");
    assert_eq!(
        owner_reset.media_files, 1,
        "owned media is trashed by its owning site"
    );
}

#[tokio::test]
#[serial]
async fn reset_does_not_touch_a_sibling_site() {
    let pool = test_db_pool().await;
    let target = create_test_site(&pool).await;
    let sibling = create_test_site(&pool).await;

    seed_content(&pool, target, "target-post").await;
    let sibling_content = seed_content(&pool, sibling, "sibling-post").await;
    seed_social_link(&pool, sibling).await;

    reset_site_content(&pool, target)
        .await
        .expect("reset target site");

    assert_eq!(
        count(
            &pool,
            "SELECT COUNT(*) FROM contents WHERE id = $1 AND is_deleted = FALSE",
            sibling_content,
        )
        .await,
        1,
        "sibling site content is untouched"
    );
    assert_eq!(
        count(
            &pool,
            "SELECT COUNT(*) FROM social_links WHERE site_id = $1 AND is_deleted = FALSE",
            sibling,
        )
        .await,
        1,
        "sibling site social links are untouched"
    );
}

// ── HTTP surface ────────────────────────────────────────────────────────

#[tokio::test]
#[serial]
async fn http_owner_reset_returns_counts_and_writes_audit() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    // site:delete (reused for reset) is Owner-only → Master key maps to Owner.
    let owner = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Master).await;

    let content_id = seed_content(&ctx.pool, site_id, "http-post").await;
    seed_social_link(&ctx.pool, site_id).await;

    let resp = ctx
        .server
        .post(&format!("/api/v1/sites/{site_id}/reset-content"))
        .add_header("x-api-key", owner.as_str())
        .await;

    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    assert_eq!(body["contents"], 1, "one content trashed");
    assert_eq!(body["social_links"], 1, "one social link trashed");
    assert_eq!(body["total"], 2, "total reported");

    assert_eq!(
        count(
            &ctx.pool,
            "SELECT COUNT(*) FROM contents WHERE id = $1 AND is_deleted = TRUE",
            content_id,
        )
        .await,
        1,
        "content is trashed via the HTTP path"
    );

    // The audit row is the sibling-consistent shape: entity_type=site,
    // action=delete, metadata.reason=content_reset, counts embedded.
    let meta: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT metadata FROM audit_logs \
         WHERE site_id = $1 AND entity_type = 'site' AND action = 'delete' \
         ORDER BY created_at DESC LIMIT 1",
    )
    .bind(site_id)
    .fetch_one(&ctx.pool)
    .await
    .expect("audit row exists");
    let meta = meta.expect("audit metadata present");
    assert_eq!(meta["reason"], "content_reset", "audit reason recorded");
    assert_eq!(
        meta["counts"]["total"], 2,
        "audit metadata carries the counts"
    );
}

#[tokio::test]
#[serial]
async fn http_reset_forbidden_for_non_owner() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let reader = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .post(&format!("/api/v1/sites/{site_id}/reset-content"))
        .add_header("x-api-key", reader.as_str())
        .await;

    assert_eq!(resp.status_code().as_u16(), 403);
    let body: serde_json::Value = resp.json();
    assert_eq!(body["code"], codes::AUTH_INSUFFICIENT_ROLE);
}

#[tokio::test]
#[serial]
async fn http_reset_on_soft_deleted_site_returns_404() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let owner = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Master).await;
    // Soft-deleting the site makes it invisible to find_by_id → 404.
    Site::soft_delete(&ctx.pool, site_id)
        .await
        .expect("soft_delete");

    let resp = ctx
        .server
        .post(&format!("/api/v1/sites/{site_id}/reset-content"))
        .add_header("x-api-key", owner.as_str())
        .await;

    assert_eq!(resp.status_code().as_u16(), 404);
    let body: serde_json::Value = resp.json();
    assert_eq!(body["code"], codes::ENTITY_NOT_FOUND);
}
