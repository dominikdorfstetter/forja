//! Integration tests for `services::content_lifecycle` (#524 phase 1).
//!
//! ContentLifecycle is the high-level orchestrator that wraps the
//! `publish_pipeline`: it owns the pre-mutation status/gate validation,
//! the model mutation, and the post-mutation `publish_pipeline::execute`
//! call. Phase 1 ports blog-only — page/legal/project come in #526.
//!
//! These tests drive the public ContentLifecycle interface, not internals,
//! so they survive the trait-based refactor in #526.
//!
//! Prereq: same as `integration_tests.rs` — a `forja_test` PostgreSQL
//! database is reachable via `TEST_DATABASE_URL` (or default
//! `postgres://forja:forja@localhost:5432/forja_test`).

mod common;

use chrono::NaiveDate;
use serial_test::serial;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use forja::dto::blog::{CreateBlogRequest, UpdateBlogRequest};
use forja::dto::cv::{CreateCvEntryRequest, UpdateCvEntryRequest};
use forja::dto::legal::{CreateLegalDocumentRequest, UpdateLegalDocumentRequest};
use forja::dto::page::{CreatePageRequest, UpdatePageRequest};
use forja::dto::project::{CreateProjectRequest, UpdateProjectRequest};
use forja::guards::actor::Actor;
use forja::guards::auth_guard::{AuthSource, AuthenticatedKey};
use forja::models::api_key::ApiKeyPermission;
use forja::models::content::{Content, ContentLocalization, ContentStatus};
use forja::services::content_lifecycle;

use common::{create_test_api_key, create_test_site, test_db_pool};

const SEEDED_LOCALE_CODE: &str = "en";

async fn seeded_locale_id(pool: &PgPool) -> Uuid {
    sqlx::query("SELECT id FROM locales WHERE code = $1")
        .bind(SEEDED_LOCALE_CODE)
        .fetch_one(pool)
        .await
        .expect("seeded en locale")
        .get::<Uuid, _>(0)
}

async fn build_test_auth(pool: &PgPool, site_id: Uuid) -> Actor {
    build_test_auth_with_permission(pool, site_id, ApiKeyPermission::Write).await
}

/// Build an [`Actor`] backed by an API key with the given permission.
/// `effective_site_role` maps Write → Editor and Read → Viewer (see
/// `guards::actor`), so this is how a test drives the generic driver as a
/// less-privileged role.
async fn build_test_auth_with_permission(
    pool: &PgPool,
    site_id: Uuid,
    permission: ApiKeyPermission,
) -> Actor {
    let _ = create_test_api_key(pool, site_id, permission).await;
    let row =
        sqlx::query("SELECT id FROM api_keys WHERE site_id = $1 ORDER BY created_at DESC LIMIT 1")
            .bind(site_id)
            .fetch_one(pool)
            .await
            .expect("api_key row");
    let key_id: Uuid = row.get(0);
    let auth = AuthenticatedKey {
        id: key_id,
        permission,
        site_id: Some(site_id),
        auth_source: AuthSource::ApiKey,
    };
    Actor::from_authenticated(&auth).expect("actor from API key")
}

/// Build the full empty [`UpdateBlogRequest`] with only `slug`/`status`
/// optionally set — the two fields the generic driver inspects. Keeps the
/// generic-driver tests free of the 11-field struct literal.
fn blog_update(slug: Option<String>, status: Option<ContentStatus>) -> UpdateBlogRequest {
    UpdateBlogRequest {
        slug,
        author: None,
        published_date: None,
        reading_time_minutes: None,
        cover_image_id: None,
        header_image_id: None,
        is_featured: None,
        allow_comments: None,
        status,
        publish_start: None,
        publish_end: None,
    }
}

fn make_create_request(site_id: Uuid, status: ContentStatus) -> CreateBlogRequest {
    CreateBlogRequest {
        slug: Some(format!(
            "lifecycle-test-{}",
            &Uuid::new_v4().to_string()[..8]
        )),
        title: Some("Lifecycle Test Post".to_string()),
        author: "Test Author".to_string(),
        published_date: NaiveDate::from_ymd_opt(2026, 5, 8).expect("valid date"),
        reading_time_minutes: Some(5),
        cover_image_id: None,
        header_image_id: None,
        is_featured: false,
        allow_comments: true,
        status,
        publish_start: None,
        publish_end: None,
        site_ids: vec![site_id],
    }
}

async fn add_default_localization(pool: &PgPool, content_id: Uuid) {
    let locale_id = seeded_locale_id(pool).await;
    ContentLocalization::create(
        pool,
        content_id,
        locale_id,
        "Lifecycle Title",
        None,
        None,
        Some("Lifecycle body content."),
        Some("Lifecycle meta title"),
        None,
    )
    .await
    .expect("localization insert succeeds");
}

async fn seed_webhook_for_events(pool: &PgPool, site_id: Uuid, events: Vec<String>) {
    sqlx::query(
        r#"INSERT INTO webhooks (site_id, url, secret, events, debounce_seconds, is_active)
           VALUES ($1, $2, $3, $4, 0, TRUE)"#,
    )
    .bind(site_id)
    .bind("https://example.invalid/lifecycle-hook")
    .bind("whsec_lifecycle_test")
    .bind(events)
    .execute(pool)
    .await
    .expect("webhook insert succeeds");
}

async fn webhook_event_types_for_entity(pool: &PgPool, entity_id: Uuid) -> Vec<String> {
    sqlx::query(
        r#"SELECT event_type FROM webhook_retry_queue
           WHERE payload->>'entity_id' = $1::text
           ORDER BY created_at ASC"#,
    )
    .bind(entity_id)
    .fetch_all(pool)
    .await
    .expect("fetch webhook events")
    .into_iter()
    .map(|r| r.get::<String, _>(0))
    .collect()
}

async fn count_audit_rows_for_type(pool: &PgPool, entity_id: Uuid, entity_type: &str) -> i64 {
    sqlx::query("SELECT COUNT(*) FROM audit_logs WHERE entity_id = $1 AND entity_type = $2")
        .bind(entity_id)
        .bind(entity_type)
        .fetch_one(pool)
        .await
        .expect("count audit rows")
        .get::<i64, _>(0)
}

async fn seed_webhook_for_blogs(pool: &PgPool, site_id: Uuid) {
    sqlx::query(
        r#"INSERT INTO webhooks (site_id, url, secret, events, debounce_seconds, is_active)
           VALUES ($1, $2, $3, $4, 0, TRUE)"#,
    )
    .bind(site_id)
    .bind("https://example.invalid/lifecycle-hook")
    .bind("whsec_lifecycle_test")
    .bind(vec![
        "blog.created".to_string(),
        "blog.updated".to_string(),
        "blog.deleted".to_string(),
        "blog.published".to_string(),
    ])
    .execute(pool)
    .await
    .expect("webhook insert succeeds");
}

async fn count_audit_rows(pool: &PgPool, entity_id: Uuid) -> i64 {
    sqlx::query("SELECT COUNT(*) FROM audit_logs WHERE entity_id = $1 AND entity_type = 'blog'")
        .bind(entity_id)
        .fetch_one(pool)
        .await
        .expect("count audit rows")
        .get::<i64, _>(0)
}

/// Count spine `contents` rows associated with a site — used to detect an
/// orphaned spine row after a failed entity insert (#863).
async fn count_contents_for_site(pool: &PgPool, site_id: Uuid) -> i64 {
    sqlx::query(
        r#"SELECT COUNT(*) FROM contents c
           JOIN content_sites cs ON cs.content_id = c.id
           WHERE cs.site_id = $1"#,
    )
    .bind(site_id)
    .fetch_one(pool)
    .await
    .expect("count contents rows")
    .get::<i64, _>(0)
}

async fn webhook_event_types_for(pool: &PgPool, entity_id: Uuid) -> Vec<String> {
    sqlx::query(
        r#"SELECT event_type FROM webhook_retry_queue
           WHERE payload->>'entity_id' = $1::text
           ORDER BY created_at ASC"#,
    )
    .bind(entity_id)
    .fetch_all(pool)
    .await
    .expect("fetch webhook events")
    .into_iter()
    .map(|r| r.get::<String, _>(0))
    .collect()
}

async fn audit_metadata_for(pool: &PgPool, entity_id: Uuid) -> Vec<serde_json::Value> {
    sqlx::query(
        r#"SELECT metadata FROM audit_logs
           WHERE entity_id = $1 AND entity_type = 'blog' AND metadata IS NOT NULL"#,
    )
    .bind(entity_id)
    .fetch_all(pool)
    .await
    .expect("fetch audit metadata")
    .into_iter()
    .map(|r| r.get::<serde_json::Value, _>(0))
    .collect()
}

// ── Phase 2 — trait-based generic create ─────────────────────────────────

#[tokio::test]
#[serial]
async fn content_lifecycle_create_page_via_trait_fires_full_pipeline() {
    use forja::models::page::PageWithContent;

    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook_for_events(&pool, site_id, vec!["page.created".to_string()]).await;
    let auth = build_test_auth(&pool, site_id).await;

    let req = CreatePageRequest {
        route: format!("/lifecycle-page-{}", &Uuid::new_v4().to_string()[..8]),
        slug: None,
        page_type: forja::models::page::PageType::Static,
        template: None,
        is_in_navigation: false,
        navigation_order: None,
        parent_page_id: None,
        status: ContentStatus::Draft,
        publish_start: None,
        publish_end: None,
        site_ids: vec![site_id],
    };

    let page = content_lifecycle::create::<PageWithContent>(&pool, req, &auth)
        .await
        .expect("create::<Page> succeeds");

    assert_eq!(page.status, ContentStatus::Draft);
    assert!(
        count_audit_rows_for_type(&pool, page.id, "page").await >= 1,
        "create::<Page> writes a 'page' audit row"
    );
    let events = webhook_event_types_for_entity(&pool, page.id).await;
    assert!(
        events.iter().any(|e| e == "page.created"),
        "create::<Page> enqueues page.created webhook — got {:?}",
        events
    );
}

#[tokio::test]
#[serial]
async fn content_lifecycle_create_legal_via_trait_uses_diverged_webhook_prefix() {
    use forja::models::legal::LegalDocument;

    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook_for_events(
        &pool,
        site_id,
        vec!["legal.created".to_string(), "legal.published".to_string()],
    )
    .await;
    let auth = build_test_auth(&pool, site_id).await;

    let req = CreateLegalDocumentRequest {
        cookie_name: format!("ck_lifecycle_{}", &Uuid::new_v4().to_string()[..8]),
        document_type: forja::models::legal::LegalDocType::PrivacyPolicy,
        slug: None,
        status: ContentStatus::Draft,
        site_ids: vec![site_id],
    };

    let document = content_lifecycle::create::<LegalDocument>(&pool, req, &auth)
        .await
        .expect("create::<LegalDocument> succeeds");

    assert!(
        count_audit_rows_for_type(&pool, document.id, "legal_document").await >= 1,
        "audit row uses 'legal_document' entity_type — got 0"
    );
    assert_eq!(
        count_audit_rows_for_type(&pool, document.id, "legal").await,
        0,
        "no audit row uses 'legal' entity_type (that's the webhook prefix)"
    );
    let events = webhook_event_types_for_entity(&pool, document.id).await;
    assert!(
        events.iter().any(|e| e == "legal.created"),
        "webhook fires 'legal.created' (webhook prefix), not 'legal_document.created' — got {:?}",
        events
    );
    assert!(
        !events.iter().any(|e| e.starts_with("legal_document")),
        "no webhook event uses the audit-only 'legal_document' prefix — got {:?}",
        events
    );
}

#[tokio::test]
#[serial]
async fn content_lifecycle_create_project_via_trait_skips_workflow_validation() {
    use forja::models::project::ProjectWithContent;

    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook_for_events(&pool, site_id, vec!["project.created".to_string()]).await;
    let auth = build_test_auth(&pool, site_id).await;

    // Set up the editorial workflow setting on the site to "strict_review"
    // — if `runs_editorial_workflow()` were true, a Draft → Published
    // transition by a Viewer-level role would be rejected here. Project
    // returns false, so this should succeed regardless of workflow state.
    sqlx::query("INSERT INTO site_settings (site_id, key, value) VALUES ($1, 'editorial_workflow', 'strict_review')")
        .bind(site_id)
        .execute(&pool)
        .await
        .ok();

    let req = CreateProjectRequest {
        slug: format!("lifecycle-project-{}", &Uuid::new_v4().to_string()[..8]),
        display_order: None,
        is_featured: None,
        start_date: None,
        end_date: None,
        is_ongoing: None,
        status: ContentStatus::Draft,
        site_ids: vec![site_id],
        localizations: None,
        links: None,
        media: None,
        skill_ids: None,
        cv_entry_ids: None,
    };

    let project = content_lifecycle::create::<ProjectWithContent>(&pool, req, &auth)
        .await
        .expect("create::<Project> succeeds even with strict_review workflow");

    assert!(
        count_audit_rows_for_type(&pool, project.id, "project").await >= 1,
        "create::<Project> writes a 'project' audit row"
    );
    let events = webhook_event_types_for_entity(&pool, project.id).await;
    assert!(
        events.iter().any(|e| e == "project.created"),
        "create::<Project> enqueues project.created webhook — got {:?}",
        events
    );
}

// ── #864 — cv_entry onboarded to the generic trait create ────────────────

#[tokio::test]
#[serial]
async fn content_lifecycle_create_cv_entry_via_trait_uses_diverged_webhook_prefix() {
    use forja::models::cv::{CvEntry, CvEntryType};

    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook_for_events(&pool, site_id, vec!["cv.created".to_string()]).await;
    let auth = build_test_auth(&pool, site_id).await;

    let contents_before = count_contents_for_site(&pool, site_id).await;

    let req = CreateCvEntryRequest {
        company: "Forja GmbH".to_string(),
        company_url: None,
        company_logo_id: None,
        location: "Vienna, Austria".to_string(),
        start_date: NaiveDate::from_ymd_opt(2026, 1, 1).expect("valid date"),
        end_date: None,
        is_current: true,
        entry_type: CvEntryType::Work,
        display_order: 0,
        status: ContentStatus::Draft,
        site_ids: vec![site_id],
        localizations: None,
        skill_ids: None,
    };

    let entry = content_lifecycle::create::<CvEntry>(&pool, req, &auth)
        .await
        .expect("create::<CvEntry> succeeds");

    // Spine + entity rows committed together in one tx.
    assert!(
        entry.content_id.is_some(),
        "cv_entry create writes a spine content_id"
    );
    assert_eq!(
        count_contents_for_site(&pool, site_id).await,
        contents_before + 1,
        "create::<CvEntry> writes exactly one spine row"
    );
    assert!(
        count_audit_rows_for_type(&pool, entry.id, "cv_entry").await >= 1,
        "create::<CvEntry> writes a 'cv_entry' audit row"
    );

    let events = webhook_event_types_for_entity(&pool, entry.id).await;
    assert!(
        events.iter().any(|e| e == "cv.created"),
        "webhook fires 'cv.created' (webhook prefix), not 'cv_entry.created' — got {:?}",
        events
    );
    assert!(
        !events.iter().any(|e| e.starts_with("cv_entry")),
        "no webhook event uses the audit-only 'cv_entry' prefix — got {:?}",
        events
    );
}

// ── Tracer bullet ────────────────────────────────────────────────────────

#[tokio::test]
#[serial]
async fn content_lifecycle_create_blog_fires_full_pipeline() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook_for_blogs(&pool, site_id).await;
    let auth = build_test_auth(&pool, site_id).await;

    let blog = content_lifecycle::create::<forja::models::blog::BlogWithContent>(
        &pool,
        make_create_request(site_id, ContentStatus::Draft),
        &auth,
    )
    .await
    .expect("create_blog succeeds");

    assert_eq!(blog.status, ContentStatus::Draft);
    assert!(
        count_audit_rows(&pool, blog.id).await >= 1,
        "create_blog writes an audit row"
    );
    let events = webhook_event_types_for(&pool, blog.id).await;
    assert!(
        events.iter().any(|e| e == "blog.created"),
        "create_blog enqueues blog.created webhook — got {:?}",
        events
    );
}

// ── Atomicity (#863): entity-insert failure rolls back the spine row ─────

#[tokio::test]
#[serial]
async fn content_lifecycle_create_blog_rolls_back_spine_row_on_entity_insert_failure() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let auth = build_test_auth(&pool, site_id).await;

    let contents_before = count_contents_for_site(&pool, site_id).await;

    // A non-existent `cover_image_id` violates the `blogs → media_files` FK,
    // so `INSERT INTO blogs` fails *after* `create_content` has already
    // inserted the spine `contents` row. Pre-#863 this orphaned the spine
    // row (create_content committed its own tx); now the whole create runs
    // in one tx, so the spine row must roll back.
    let mut req = make_create_request(site_id, ContentStatus::Draft);
    req.cover_image_id = Some(Uuid::new_v4());

    let result =
        content_lifecycle::create::<forja::models::blog::BlogWithContent>(&pool, req, &auth).await;

    assert!(
        result.is_err(),
        "create must fail when the blog row violates the media FK"
    );

    let contents_after = count_contents_for_site(&pool, site_id).await;
    assert_eq!(
        contents_after, contents_before,
        "entity INSERT failure must leave no orphaned spine `contents` row"
    );
}

// ── Update path: Draft → Published runs the full pipeline ────────────────

#[tokio::test]
#[serial]
async fn content_lifecycle_update_blog_publishes_via_gate() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook_for_blogs(&pool, site_id).await;
    let auth = build_test_auth(&pool, site_id).await;

    let blog = content_lifecycle::create::<forja::models::blog::BlogWithContent>(
        &pool,
        make_create_request(site_id, ContentStatus::Draft),
        &auth,
    )
    .await
    .expect("create_blog succeeds");
    add_default_localization(&pool, blog.content_id).await;

    let site_ids = Content::find_site_ids(&pool, blog.content_id)
        .await
        .expect("find_site_ids succeeds");
    let blog_id = blog.id;

    let updated = content_lifecycle::update::<forja::models::blog::BlogWithContent>(
        &pool,
        blog_id,
        UpdateBlogRequest {
            slug: None,
            author: None,
            published_date: None,
            reading_time_minutes: None,
            cover_image_id: None,
            header_image_id: None,
            is_featured: None,
            allow_comments: None,
            status: Some(ContentStatus::Published),
            publish_start: None,
            publish_end: None,
        },
        blog,
        site_ids,
        &auth,
    )
    .await
    .expect("update_blog Draft → Published succeeds when gate passes");

    assert_eq!(updated.status, ContentStatus::Published);
    let events = webhook_event_types_for(&pool, blog_id).await;
    assert!(
        events.iter().any(|e| e == "blog.updated"),
        "primary blog.updated webhook fires — got {:?}",
        events
    );
    assert!(
        events.iter().any(|e| e == "blog.published"),
        "publish_hooks emits blog.published on Draft → Published — got {:?}",
        events
    );
}

// ── Update path: blocked publish leaves no orphan rows ───────────────────

#[tokio::test]
#[serial]
async fn content_lifecycle_update_blog_blocks_publish_when_gate_fails() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook_for_blogs(&pool, site_id).await;
    let auth = build_test_auth(&pool, site_id).await;

    let blog = content_lifecycle::create::<forja::models::blog::BlogWithContent>(
        &pool,
        make_create_request(site_id, ContentStatus::Draft),
        &auth,
    )
    .await
    .expect("create_blog succeeds");
    // Intentionally skip add_default_localization — gate must reject.

    let site_ids = Content::find_site_ids(&pool, blog.content_id)
        .await
        .expect("find_site_ids succeeds");
    let blog_id = blog.id;
    let audit_before = count_audit_rows(&pool, blog_id).await;
    let webhooks_before = webhook_event_types_for(&pool, blog_id).await.len();

    let result = content_lifecycle::update::<forja::models::blog::BlogWithContent>(
        &pool,
        blog_id,
        UpdateBlogRequest {
            slug: None,
            author: None,
            published_date: None,
            reading_time_minutes: None,
            cover_image_id: None,
            header_image_id: None,
            is_featured: None,
            allow_comments: None,
            status: Some(ContentStatus::Published),
            publish_start: None,
            publish_end: None,
        },
        blog,
        site_ids,
        &auth,
    )
    .await;

    let err = result.expect_err("publish gate must reject blog without localization");
    assert_eq!(err.code(), "VALIDATION_ERROR");
    assert_eq!(
        count_audit_rows(&pool, blog_id).await,
        audit_before,
        "no audit rows written when gate rejects pre-mutation"
    );
    assert_eq!(
        webhook_event_types_for(&pool, blog_id).await.len(),
        webhooks_before,
        "no webhook events enqueued when gate rejects pre-mutation"
    );
}

// ── #865 — publish gate dispatched via the ContentEntity trait method ────

#[tokio::test]
#[serial]
async fn content_lifecycle_update_page_blocks_publish_via_trait_gate() {
    use forja::dto::page::UpdatePageRequest;
    use forja::models::page::{PageType, PageWithContent};

    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let auth = build_test_auth(&pool, site_id).await;

    let req = CreatePageRequest {
        route: format!("/gate-page-{}", &Uuid::new_v4().to_string()[..8]),
        slug: None,
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
    let page = content_lifecycle::create::<PageWithContent>(&pool, req, &auth)
        .await
        .expect("create page");
    // No localization and no sections — the page publish gate must reject.

    let site_ids = Content::find_site_ids(&pool, page.content_id)
        .await
        .expect("find_site_ids succeeds");
    let page_id = page.id;

    let result = content_lifecycle::update::<PageWithContent>(
        &pool,
        page_id,
        UpdatePageRequest {
            route: None,
            slug: None,
            page_type: None,
            template: None,
            is_in_navigation: None,
            navigation_order: None,
            parent_page_id: None,
            status: Some(ContentStatus::Published),
            publish_start: None,
            publish_end: None,
        },
        page,
        site_ids,
        &auth,
    )
    .await;

    // The gate runs via PageWithContent's ContentEntity::validate_publish_gate
    // override (#865) — same VALIDATION_ERROR the string switch produced.
    let err = result.expect_err("incomplete page must be blocked by the publish gate");
    assert_eq!(err.code(), "VALIDATION_ERROR");
}

// ── Delete path: emits blog.deleted ──────────────────────────────────────

#[tokio::test]
#[serial]
async fn content_lifecycle_delete_blog_emits_delete_event() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook_for_blogs(&pool, site_id).await;
    let auth = build_test_auth(&pool, site_id).await;

    let blog = content_lifecycle::create::<forja::models::blog::BlogWithContent>(
        &pool,
        make_create_request(site_id, ContentStatus::Draft),
        &auth,
    )
    .await
    .expect("create_blog succeeds");
    let site_ids = Content::find_site_ids(&pool, blog.content_id)
        .await
        .expect("find_site_ids succeeds");
    let blog_id = blog.id;

    content_lifecycle::blog::delete(&pool, blog_id, blog, site_ids, &auth)
        .await
        .expect("delete_blog succeeds");

    let events = webhook_event_types_for(&pool, blog_id).await;
    assert!(
        events.iter().any(|e| e == "blog.deleted"),
        "blog.deleted webhook enqueued — got {:?}",
        events
    );
}

// ── Clone path: emits create event with cloned_from metadata ─────────────

#[tokio::test]
#[serial]
async fn content_lifecycle_clone_blog_emits_create_with_metadata() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook_for_blogs(&pool, site_id).await;
    let auth = build_test_auth(&pool, site_id).await;

    let source = content_lifecycle::create::<forja::models::blog::BlogWithContent>(
        &pool,
        make_create_request(site_id, ContentStatus::Draft),
        &auth,
    )
    .await
    .expect("source create_blog succeeds");
    let site_ids = Content::find_site_ids(&pool, source.content_id)
        .await
        .expect("find_site_ids succeeds");

    let clone = content_lifecycle::blog::clone(&pool, source.id, site_ids, &auth)
        .await
        .expect("clone_blog succeeds");

    assert_eq!(clone.status, ContentStatus::Draft);
    assert_ne!(clone.id, source.id);
    let events = webhook_event_types_for(&pool, clone.id).await;
    assert!(
        events.iter().any(|e| e == "blog.created"),
        "clone enqueues blog.created — got {:?}",
        events
    );
    let meta = audit_metadata_for(&pool, clone.id).await;
    assert!(
        meta.iter().any(|m| m
            .get("cloned_from")
            .and_then(|v| v.as_str())
            .map(|s| s == source.id.to_string())
            .unwrap_or(false)),
        "cloned_from metadata recorded on the clone's audit row — got {:?}",
        meta
    );
}

// ── Generic update::<E> driver (#893) ────────────────────────────────────
//
// These exercise `content_lifecycle::update::<BlogWithContent>` — the new
// generic driver behind the `ContentUpdate` supertrait — rather than the
// bespoke `blog::update`. Same pipeline guarantees: validated transition,
// one transaction, one post-mutation event.

/// Draft → Published through the generic driver fires the full pipeline
/// exactly once: one `blog.updated` and one `blog.published`.
#[tokio::test]
#[serial]
async fn content_lifecycle_generic_update_blog_publishes() {
    use forja::models::blog::BlogWithContent;

    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook_for_blogs(&pool, site_id).await;
    let auth = build_test_auth(&pool, site_id).await;

    let blog = content_lifecycle::create::<BlogWithContent>(
        &pool,
        make_create_request(site_id, ContentStatus::Draft),
        &auth,
    )
    .await
    .expect("create_blog succeeds");
    add_default_localization(&pool, blog.content_id).await;

    let site_ids = Content::find_site_ids(&pool, blog.content_id)
        .await
        .expect("find_site_ids succeeds");
    let blog_id = blog.id;

    let updated = content_lifecycle::update::<BlogWithContent>(
        &pool,
        blog_id,
        blog_update(None, Some(ContentStatus::Published)),
        blog,
        site_ids,
        &auth,
    )
    .await
    .expect("generic update Draft → Published succeeds when gate passes");

    assert_eq!(updated.status, ContentStatus::Published);

    let events = webhook_event_types_for(&pool, blog_id).await;
    assert_eq!(
        events.iter().filter(|e| *e == "blog.updated").count(),
        1,
        "exactly one blog.updated fires — got {:?}",
        events
    );
    assert_eq!(
        events.iter().filter(|e| *e == "blog.published").count(),
        1,
        "exactly one blog.published fires on Draft → Published — got {:?}",
        events
    );
}

/// A Viewer attempting a status transition is rejected by the editorial
/// workflow gate. With workflow enabled, `validate_status` rejects the
/// Viewer before any row is written.
///
/// NOTE: the real `workflow_service::validate_status_transition` returns
/// `WORKFLOW_NO_PERMISSION` for a Viewer — NOT `VALIDATION_ERROR` as the
/// slice spec guessed. The intent ("an unauthorized transition is blocked")
/// holds; we assert the actual code the production path produces.
#[tokio::test]
#[serial]
async fn content_lifecycle_generic_update_blog_viewer_blocked() {
    use forja::models::blog::BlogWithContent;
    use forja::models::site_settings::SiteSetting;

    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook_for_blogs(&pool, site_id).await;
    let master = build_test_auth(&pool, site_id).await;

    // Editorial workflow OFF by default would let any role transition;
    // enable it so the Viewer path is actually gated.
    SiteSetting::upsert(
        &pool,
        site_id,
        "editorial_workflow_enabled",
        serde_json::json!(true),
        false,
    )
    .await
    .expect("enable editorial workflow");

    let blog = content_lifecycle::create::<BlogWithContent>(
        &pool,
        make_create_request(site_id, ContentStatus::Draft),
        &master,
    )
    .await
    .expect("create_blog succeeds");
    add_default_localization(&pool, blog.content_id).await;

    let site_ids = Content::find_site_ids(&pool, blog.content_id)
        .await
        .expect("find_site_ids succeeds");

    let viewer = build_test_auth_with_permission(&pool, site_id, ApiKeyPermission::Read).await;

    let result = content_lifecycle::update::<BlogWithContent>(
        &pool,
        blog.id,
        blog_update(None, Some(ContentStatus::Published)),
        blog,
        site_ids,
        &viewer,
    )
    .await;

    let err = result.expect_err("a Viewer must not transition status under editorial workflow");
    assert_eq!(
        err.code(),
        "WORKFLOW_NO_PERMISSION",
        "unauthorized transition surfaces the workflow permission code"
    );
}

/// A failure inside `BlogRepo::update` rolls the whole transaction back —
/// including the spine `contents.status` write — so the blog stays Draft.
/// Proves the driver owns one atomic unit of work.
///
/// NOTE: the slice spec assumed a per-site unique-slug constraint would fail
/// here, but the blog update path stores its slug on the shared
/// `contents.slug` column, which has NO uniqueness (the per-site unique index
/// is on `content_sites.site_specific_slug`, untouched by blog update). So we
/// induce a deterministic failure via a dangling `cover_image_id` FK instead:
/// `ContentService::update_content` stages the `contents.status = Published`
/// write first, then the `UPDATE blogs ... cover_image_id = <bogus>` violates
/// `blogs_cover_image_id_fkey` inside the same tx. The assertion is unchanged:
/// the spine status must be back to Draft after the failed update.
#[tokio::test]
#[serial]
async fn content_lifecycle_generic_update_blog_atomic_rollback() {
    use forja::models::blog::BlogWithContent;

    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook_for_blogs(&pool, site_id).await;
    let auth = build_test_auth(&pool, site_id).await;

    // Blog A — Draft, fully publishable (localized), so only the bad FK fails.
    let blog_a = content_lifecycle::create::<BlogWithContent>(
        &pool,
        make_create_request(site_id, ContentStatus::Draft),
        &auth,
    )
    .await
    .expect("create blog A succeeds");
    add_default_localization(&pool, blog_a.content_id).await;

    let content_id_a = blog_a.content_id;
    let site_ids = Content::find_site_ids(&pool, content_id_a)
        .await
        .expect("find_site_ids succeeds");

    // Publish + a cover_image_id that references no media_files row. The spine
    // status write is staged first; the entity UPDATE then trips the FK and
    // the whole tx rolls back.
    let mut bad_payload = blog_update(None, Some(ContentStatus::Published));
    bad_payload.cover_image_id = Some(Uuid::new_v4());

    let result = content_lifecycle::update::<BlogWithContent>(
        &pool,
        blog_a.id,
        bad_payload,
        blog_a,
        site_ids,
        &auth,
    )
    .await;

    assert!(
        result.is_err(),
        "update must fail on the dangling cover_image_id FK"
    );

    // The spine status must be untouched — the tx rolled back atomically.
    let reloaded = Content::find_by_id(&pool, content_id_a)
        .await
        .expect("blog A spine row still exists");
    assert_eq!(
        reloaded.status,
        ContentStatus::Draft,
        "spine status rolled back to Draft after the failed update"
    );
}

// ── #894 — page + legal onboarded to the generic update::<E> driver ──────

/// An incomplete Draft page requesting Published must be rejected by the
/// page publish gate *through the generic driver* — proving PageWithContent
/// flows through `update::<PageWithContent>` (status on struct, change_diff
/// captured, trait gate run pre-mutation). Same VALIDATION_ERROR the bespoke
/// `page::update` produced.
#[tokio::test]
#[serial]
async fn content_lifecycle_generic_update_page_publishes() {
    use forja::models::page::{PageType, PageWithContent};

    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let auth = build_test_auth(&pool, site_id).await;

    let req = CreatePageRequest {
        route: format!("/generic-page-{}", &Uuid::new_v4().to_string()[..8]),
        slug: None,
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
    let page = content_lifecycle::create::<PageWithContent>(&pool, req, &auth)
        .await
        .expect("create draft page");
    // No localization, no sections — the publish gate must reject.

    let site_ids = Content::find_site_ids(&pool, page.content_id)
        .await
        .expect("find_site_ids succeeds");
    let page_id = page.id;

    let result = content_lifecycle::update::<PageWithContent>(
        &pool,
        page_id,
        UpdatePageRequest {
            route: None,
            slug: None,
            page_type: None,
            template: None,
            is_in_navigation: None,
            navigation_order: None,
            parent_page_id: None,
            status: Some(ContentStatus::Published),
            publish_start: None,
            publish_end: None,
        },
        page,
        site_ids,
        &auth,
    )
    .await;

    let err = result.expect_err("incomplete page must be blocked through the generic driver");
    assert_eq!(err.code(), "VALIDATION_ERROR");
}

/// A legal document flows through `update::<LegalDocument>` even though its
/// status lives only on the spine, it skips the editorial workflow, and its
/// webhook prefix (`legal`) diverges from its audit type (`legal_document`).
/// The driver's spine-status fallback (content_id may be None → Draft) +
/// placeholder role + prefix-divergence wiring handle it; a non-status field
/// change succeeds and fires exactly one `legal.updated` without panicking on
/// the nullable content_id path.
#[tokio::test]
#[serial]
async fn content_lifecycle_generic_update_legal() {
    use forja::models::legal::{LegalDocType, LegalDocument};

    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook_for_events(
        &pool,
        site_id,
        vec!["legal.updated".to_string(), "legal.published".to_string()],
    )
    .await;
    let auth = build_test_auth(&pool, site_id).await;

    let document = content_lifecycle::create::<LegalDocument>(
        &pool,
        CreateLegalDocumentRequest {
            cookie_name: format!("ck_generic_{}", &Uuid::new_v4().to_string()[..8]),
            document_type: LegalDocType::PrivacyPolicy,
            slug: None,
            status: ContentStatus::Draft,
            site_ids: vec![site_id],
        },
        &auth,
    )
    .await
    .expect("create legal document");

    let site_ids = match document.content_id {
        Some(cid) => Content::find_site_ids(&pool, cid)
            .await
            .expect("find_site_ids succeeds"),
        None => vec![site_id],
    };
    let document_id = document.id;
    let renamed = format!("ck_renamed_{}", &Uuid::new_v4().to_string()[..8]);

    // Rename only — no status transition, so the publish gate is never run.
    // This drives the legal entity through the generic driver's update path:
    // spine-status fallback for `previous_status`, placeholder editorial role,
    // and the prefix-divergence `legal.updated` / `legal.published` wiring.
    let updated = content_lifecycle::update::<LegalDocument>(
        &pool,
        document_id,
        UpdateLegalDocumentRequest {
            cookie_name: Some(renamed.clone()),
            document_type: None,
            slug: None,
            status: None,
        },
        document,
        site_ids,
        &auth,
    )
    .await
    .expect("update legal document through the generic driver");

    assert_eq!(updated.id, document_id);
    assert_eq!(
        updated.cookie_name, renamed,
        "the returned document reflects the renamed cookie_name"
    );

    let events = webhook_event_types_for_entity(&pool, document_id).await;
    assert_eq!(
        events.iter().filter(|e| *e == "legal.updated").count(),
        1,
        "exactly one legal.updated fires through the generic driver — got {:?}",
        events
    );
}

/// One-live-version invariant: publishing a legal version through the
/// GENERIC lifecycle drivers — not the legal PUT convenience handler —
/// supersedes the previously-published version of its chain. The supersede
/// rule lives on the `ContentEntity::on_published` hook, so every publish
/// entry point flowing through the lifecycle upholds it.
#[tokio::test]
#[serial]
async fn content_lifecycle_generic_publish_supersedes_previous_legal_version() {
    use forja::models::legal::{LegalDocType, LegalDocument};
    use forja::repos::legal_repo::LegalDocumentRepo;

    async fn status_of(pool: &PgPool, content_id: Uuid) -> String {
        sqlx::query_scalar("SELECT status::text FROM contents WHERE id = $1")
            .bind(content_id)
            .fetch_one(pool)
            .await
            .expect("fetch content status")
    }

    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let auth = build_test_auth(&pool, site_id).await;

    // v1 lands as Published through the generic create driver (the
    // create-side hook runs with no chain siblings — a no-op supersede).
    let v1 = content_lifecycle::create::<LegalDocument>(
        &pool,
        CreateLegalDocumentRequest {
            cookie_name: format!("ck_supersede_{}", &Uuid::new_v4().to_string()[..8]),
            document_type: LegalDocType::Imprint,
            slug: None,
            status: ContentStatus::Published,
            site_ids: vec![site_id],
        },
        &auth,
    )
    .await
    .expect("create published v1");
    let v1_content_id = v1.content_id.expect("v1 content_id");
    assert_eq!(status_of(&pool, v1_content_id).await, "published");

    let v2 = LegalDocumentRepo::create_new_version(&pool, v1.id, vec![site_id], Some("test-user"))
        .await
        .expect("create v2 draft");
    let v2_content_id = v2.content_id.expect("v2 content_id");
    add_default_localization(&pool, v2_content_id).await;

    content_lifecycle::update::<LegalDocument>(
        &pool,
        v2.id,
        UpdateLegalDocumentRequest {
            cookie_name: None,
            document_type: None,
            slug: None,
            status: Some(ContentStatus::Published),
        },
        v2,
        vec![site_id],
        &auth,
    )
    .await
    .expect("publish v2 through the generic driver");

    assert_eq!(
        status_of(&pool, v2_content_id).await,
        "published",
        "v2 is live after the generic publish"
    );
    assert_eq!(
        status_of(&pool, v1_content_id).await,
        "archived",
        "the previously-published v1 is superseded without the legal PUT handler"
    );
}

// ── #895 — project + cv_entry onboarded to the generic update::<E> driver ──

/// A project flows through `update::<ProjectWithContent>`. Project's bespoke
/// update emitted NO status transition (even when the payload carries a
/// status), so the override reports no requested status and the driver skips
/// the transition block entirely. A field change persists and exactly one
/// `project.updated` fires — proving the no-transition parity path works.
#[tokio::test]
#[serial]
async fn content_lifecycle_generic_update_project() {
    use forja::models::project::ProjectWithContent;

    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook_for_events(
        &pool,
        site_id,
        vec![
            "project.updated".to_string(),
            "project.published".to_string(),
        ],
    )
    .await;
    let auth = build_test_auth(&pool, site_id).await;

    let project = content_lifecycle::create::<ProjectWithContent>(
        &pool,
        CreateProjectRequest {
            slug: format!("generic-project-{}", &Uuid::new_v4().to_string()[..8]),
            display_order: None,
            is_featured: None,
            start_date: None,
            end_date: None,
            is_ongoing: None,
            status: ContentStatus::Draft,
            site_ids: vec![site_id],
            localizations: None,
            links: None,
            media: None,
            skill_ids: None,
            cv_entry_ids: None,
        },
        &auth,
    )
    .await
    .expect("create project");

    let site_ids = Content::find_site_ids(&pool, project.content_id)
        .await
        .expect("find_site_ids succeeds");
    let project_id = project.id;

    // Change is_featured AND request a Published status. Because project
    // reports no requested status, the driver skips the transition block —
    // the update must still succeed (no editorial-workflow / gate error).
    let updated = content_lifecycle::update::<ProjectWithContent>(
        &pool,
        project_id,
        UpdateProjectRequest {
            slug: None,
            display_order: None,
            is_featured: Some(true),
            start_date: None,
            end_date: None,
            is_ongoing: None,
            status: Some(ContentStatus::Published),
            localizations: None,
            links: None,
            media: None,
            skill_ids: None,
            cv_entry_ids: None,
        },
        project,
        site_ids,
        &auth,
    )
    .await
    .expect("generic update project succeeds (no transition emitted)");

    assert_eq!(project_id, updated.id);
    assert!(
        updated.is_featured,
        "the is_featured change persists through the generic driver"
    );

    let events = webhook_event_types_for_entity(&pool, project_id).await;
    assert_eq!(
        events.iter().filter(|e| *e == "project.updated").count(),
        1,
        "exactly one project.updated fires — got {:?}",
        events
    );
    assert_eq!(
        events.iter().filter(|e| *e == "project.published").count(),
        0,
        "project skips the transition path — no project.published fires — got {:?}",
        events
    );
}

/// The fold-in tracer: cv_entry's handler-side update is now folded into the
/// seam. `CvEntryRepo::update` is connection-based, so the generic driver owns
/// the single transaction. Changing a field (company) and a status succeeds,
/// the field change persists, the spine status is updated by the repo, and
/// exactly one `cv.updated` fires — without panicking on the single-tx path.
#[tokio::test]
#[serial]
async fn content_lifecycle_generic_update_cv() {
    use forja::models::cv::{CvEntry, CvEntryType};

    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook_for_events(&pool, site_id, vec!["cv.updated".to_string()]).await;
    let auth = build_test_auth(&pool, site_id).await;

    let entry = content_lifecycle::create::<CvEntry>(
        &pool,
        CreateCvEntryRequest {
            company: "Forja GmbH".to_string(),
            company_url: None,
            company_logo_id: None,
            location: "Vienna, Austria".to_string(),
            start_date: NaiveDate::from_ymd_opt(2026, 1, 1).expect("valid date"),
            end_date: None,
            is_current: true,
            entry_type: CvEntryType::Work,
            display_order: 0,
            status: ContentStatus::Draft,
            site_ids: vec![site_id],
            localizations: None,
            skill_ids: None,
        },
        &auth,
    )
    .await
    .expect("create cv_entry");

    let content_id = entry.content_id.expect("cv_entry has a spine content_id");
    let site_ids = Content::find_site_ids(&pool, content_id)
        .await
        .expect("find_site_ids succeeds");
    let entry_id = entry.id;

    let updated = content_lifecycle::update::<CvEntry>(
        &pool,
        entry_id,
        UpdateCvEntryRequest {
            company: Some("Forja Renamed GmbH".to_string()),
            company_url: None,
            company_logo_id: None,
            location: None,
            start_date: None,
            end_date: None,
            is_current: None,
            entry_type: None,
            display_order: None,
            status: Some(ContentStatus::Published),
            localizations: None,
            skill_ids: None,
        },
        entry,
        site_ids,
        &auth,
    )
    .await
    .expect("generic update cv_entry succeeds through the folded-in seam");

    assert_eq!(entry_id, updated.id);
    assert_eq!(
        updated.company, "Forja Renamed GmbH",
        "the company change persists through the generic driver"
    );

    // The repo updates the spine status even though no pipeline transition is
    // emitted — confirm the spine row reflects Published.
    let spine = Content::find_by_id(&pool, content_id)
        .await
        .expect("spine content row exists");
    assert_eq!(
        spine.status,
        ContentStatus::Published,
        "the repo updated the spine status to Published"
    );

    let events = webhook_event_types_for_entity(&pool, entry_id).await;
    assert_eq!(
        events.iter().filter(|e| *e == "cv.updated").count(),
        1,
        "exactly one cv.updated fires through the folded-in seam — got {:?}",
        events
    );
}

// ── #896 — change_diff byte-parity for page through the generic driver ────

/// Fetch the recorded `change_history` row for one field of an entity. The
/// generic `update::<E>` driver threads `change_diff = (to_value(existing),
/// to_value(updated))` into `publish_pipeline::execute`, which calls
/// `audit_service::log_changes` — that diffs the two JSON objects field-by-field
/// and writes one `change_history` row per changed field with the raw
/// `old_value` / `new_value` taken straight from those `serde_json::to_value`
/// outputs. Returning `(old_value, new_value)` lets the parity test assert the
/// persisted bytes equal the struct's own serialization.
async fn change_history_for_field(
    pool: &PgPool,
    entity_type: &str,
    entity_id: Uuid,
    field_name: &str,
) -> Option<(Option<serde_json::Value>, Option<serde_json::Value>)> {
    sqlx::query(
        r#"SELECT old_value, new_value FROM change_history
           WHERE entity_type = $1 AND entity_id = $2 AND field_name = $3
           ORDER BY changed_at DESC
           LIMIT 1"#,
    )
    .bind(entity_type)
    .bind(entity_id)
    .bind(field_name)
    .fetch_optional(pool)
    .await
    .expect("fetch change_history row")
    .map(|r| {
        (
            r.get::<Option<serde_json::Value>, _>(0),
            r.get::<Option<serde_json::Value>, _>(1),
        )
    })
}

/// #896 acceptance: the generic `update::<PageWithContent>` driver records
/// change_diff byte-identically to the deleted bespoke `page::update`.
///
/// Both paths derived change_diff from the *same* expression —
/// `serde_json::to_value(&existing)` / `serde_json::to_value(&updated)` on the
/// same `PageWithContent` struct — so parity holds by construction. This test
/// proves it end-to-end against the persisted `change_history` row: it flips a
/// non-status field (`is_in_navigation` false → true) so the publish gate and
/// editorial workflow are never engaged, then asserts the stored `old_value` /
/// `new_value` for that field equal the values pulled directly out of
/// `serde_json::to_value(PageWithContent)` for the before/after structs.
#[tokio::test]
#[serial]
async fn content_lifecycle_generic_update_page_change_diff_parity() {
    use forja::models::page::{PageType, PageWithContent};

    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook_for_events(&pool, site_id, vec!["page.updated".to_string()]).await;
    let auth = build_test_auth(&pool, site_id).await;

    let req = CreatePageRequest {
        route: format!("/diff-page-{}", &Uuid::new_v4().to_string()[..8]),
        slug: None,
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
    let before = content_lifecycle::create::<PageWithContent>(&pool, req, &auth)
        .await
        .expect("create draft page");

    let site_ids = Content::find_site_ids(&pool, before.content_id)
        .await
        .expect("find_site_ids succeeds");
    let page_id = before.id;

    // Snapshot the struct serialization the driver will diff from. Cloning
    // `before` keeps the original around to compute the expected `old` bytes
    // after the move into the driver.
    let before_json = serde_json::to_value(&before).expect("serialize existing page");

    // Flip a non-status field — no transition, no gate, no workflow. The driver
    // captures change_diff = (to_value(before), to_value(after)) and persists it.
    let after = content_lifecycle::update::<PageWithContent>(
        &pool,
        page_id,
        UpdatePageRequest {
            route: None,
            slug: None,
            page_type: None,
            template: None,
            is_in_navigation: Some(true),
            navigation_order: None,
            parent_page_id: None,
            status: None,
            publish_start: None,
            publish_end: None,
        },
        before,
        site_ids,
        &auth,
    )
    .await
    .expect("generic update page (is_in_navigation flip) succeeds");

    assert!(
        after.is_in_navigation,
        "the is_in_navigation change persists through the generic driver"
    );
    let after_json = serde_json::to_value(&after).expect("serialize updated page");

    // The expected bytes come straight from the structs' own serialization —
    // exactly what the deleted bespoke `page::update` fed into change_diff.
    let expected_old = before_json.get("is_in_navigation").cloned();
    let expected_new = after_json.get("is_in_navigation").cloned();
    assert_eq!(
        expected_old,
        Some(serde_json::json!(false)),
        "sanity: serialized old is_in_navigation is false"
    );
    assert_eq!(
        expected_new,
        Some(serde_json::json!(true)),
        "sanity: serialized new is_in_navigation is true"
    );

    let (stored_old, stored_new) =
        change_history_for_field(&pool, "page", page_id, "is_in_navigation")
            .await
            .expect("a change_history row was recorded for is_in_navigation");

    assert_eq!(
        stored_old, expected_old,
        "persisted old_value is byte-identical to serde_json::to_value(PageWithContent) before"
    );
    assert_eq!(
        stored_new, expected_new,
        "persisted new_value is byte-identical to serde_json::to_value(PageWithContent) after"
    );
}
