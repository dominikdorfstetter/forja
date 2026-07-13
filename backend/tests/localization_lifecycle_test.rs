//! Integration tests for `services::localization_lifecycle` (#674).
//!
//! Tracer-bullet slice: the generic `create<E: LocalizationEntity>`
//! driver, the `BlogLocalization` marker impl, and the audit + webhook
//! fan-out emitted through `publish_pipeline::execute`.
//!
//! These tests drive the public lifecycle interface, not internals — so
//! they survive the eventual handler migration in this same slice and
//! the Page / Legal slices that follow.
//!
//! Prereq: same as `integration_tests.rs` — a `forja_test` PostgreSQL
//! database reachable via `TEST_DATABASE_URL` (default
//! `postgres://forja:forja@localhost:5432/forja_test`).

mod common;

use chrono::NaiveDate;
use serial_test::serial;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use forja::dto::blog::CreateBlogRequest;
use forja::dto::content::{CreateLocalizationRequest, UpdateLocalizationRequest};
use forja::dto::legal::CreateLegalDocumentRequest;
use forja::dto::page::CreatePageRequest;
use forja::guards::actor::Actor;
use forja::guards::auth_guard::{AuthSource, AuthenticatedKey};
use forja::models::api_key::ApiKeyPermission;
use forja::models::blog::BlogWithContent;
use forja::models::content::ContentStatus;
use forja::models::legal::LegalDocument;
use forja::models::page::PageWithContent;
use forja::services::content_lifecycle;
use forja::services::localization_lifecycle::{
    self, blog::BlogLocalization, legal::LegalLocalization, page::PageLocalization,
};

use common::{create_test_api_key, create_test_site, enable_module, test_db_pool};

const SEEDED_LOCALE_CODE: &str = "en";

async fn seeded_locale_id(pool: &PgPool, code: &str) -> Uuid {
    sqlx::query("SELECT id FROM locales WHERE code = $1")
        .bind(code)
        .fetch_one(pool)
        .await
        .expect("seeded locale row")
        .get::<Uuid, _>(0)
}

async fn build_test_auth(pool: &PgPool, site_id: Uuid, permission: ApiKeyPermission) -> Actor {
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

async fn create_test_blog(pool: &PgPool, site_id: Uuid, auth: &Actor) -> BlogWithContent {
    let req = CreateBlogRequest {
        slug: Some(format!(
            "loc-lifecycle-{}",
            &Uuid::new_v4().to_string()[..8]
        )),
        title: Some("Loc Lifecycle Blog".to_string()),
        author: "Test Author".to_string(),
        published_date: NaiveDate::from_ymd_opt(2026, 5, 14).expect("valid date"),
        reading_time_minutes: Some(5),
        cover_image_id: None,
        header_image_id: None,
        is_featured: false,
        allow_comments: true,
        status: ContentStatus::Draft,
        publish_start: None,
        publish_end: None,
        site_ids: vec![site_id],
    };
    content_lifecycle::create::<BlogWithContent>(pool, req, auth)
        .await
        .expect("seed blog for localization tests")
}

async fn seed_webhook_for_events(pool: &PgPool, site_id: Uuid, events: Vec<String>) {
    sqlx::query(
        r#"INSERT INTO webhooks (site_id, url, secret, events, debounce_seconds, is_active)
           VALUES ($1, $2, $3, $4, 0, TRUE)"#,
    )
    .bind(site_id)
    .bind("https://example.invalid/loc-lifecycle-hook")
    .bind("whsec_loc_lifecycle_test")
    .bind(events)
    .execute(pool)
    .await
    .expect("webhook insert succeeds");
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

fn make_localization_request(locale_id: Uuid, title: &str) -> CreateLocalizationRequest {
    CreateLocalizationRequest {
        locale_id,
        title: title.to_string(),
        subtitle: None,
        excerpt: None,
        body: Some("Lifecycle test body content.".to_string()),
        meta_title: Some("Lifecycle meta title".to_string()),
        meta_description: None,
    }
}

// ── Tracer bullet ──────────────────────────────────────────────────────────

#[tokio::test]
#[serial]
async fn blog_create_localization_via_lifecycle_persists_and_fires_audit_and_webhook() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let auth = build_test_auth(&pool, site_id, ApiKeyPermission::Write).await;
    let blog = create_test_blog(&pool, site_id, &auth).await;
    let locale_id = seeded_locale_id(&pool, SEEDED_LOCALE_CODE).await;

    seed_webhook_for_events(
        &pool,
        site_id,
        vec!["blog.localization.created".to_string()],
    )
    .await;

    let request = make_localization_request(locale_id, "Tracer Localization");
    let loc =
        localization_lifecycle::create::<BlogLocalization>(&pool, blog.content_id, request, &auth)
            .await
            .expect("lifecycle create succeeds");

    assert_eq!(loc.content_id, blog.content_id);
    assert_eq!(loc.locale_id, locale_id);
    assert_eq!(loc.title, "Tracer Localization");

    assert!(
        count_audit_rows_for_type(&pool, loc.id, "blog_localization").await >= 1,
        "lifecycle create writes a 'blog_localization' audit row"
    );

    let events = webhook_event_types_for_entity(&pool, loc.id).await;
    assert!(
        events.iter().any(|e| e == "blog.localization.created"),
        "lifecycle create enqueues blog.localization.created — got {:?}",
        events
    );
}

#[tokio::test]
#[serial]
async fn blog_update_localization_via_lifecycle_persists_and_fires_audit_and_webhook() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let auth = build_test_auth(&pool, site_id, ApiKeyPermission::Write).await;
    let blog = create_test_blog(&pool, site_id, &auth).await;
    let locale_id = seeded_locale_id(&pool, SEEDED_LOCALE_CODE).await;

    seed_webhook_for_events(
        &pool,
        site_id,
        vec!["blog.localization.updated".to_string()],
    )
    .await;

    let loc = localization_lifecycle::create::<BlogLocalization>(
        &pool,
        blog.content_id,
        make_localization_request(locale_id, "Original Title"),
        &auth,
    )
    .await
    .expect("seed localization");

    let updated = localization_lifecycle::update::<BlogLocalization>(
        &pool,
        loc.id,
        UpdateLocalizationRequest {
            title: Some("Updated Title".to_string()),
            subtitle: None,
            excerpt: None,
            body: None,
            meta_title: None,
            meta_description: None,
            translation_status: None,
        },
        &auth,
    )
    .await
    .expect("lifecycle update succeeds");

    assert_eq!(updated.title, "Updated Title");
    assert!(
        count_audit_rows_for_type(&pool, loc.id, "blog_localization").await >= 2,
        "update writes a second 'blog_localization' audit row on top of the create row"
    );
    let events = webhook_event_types_for_entity(&pool, loc.id).await;
    assert!(
        events.iter().any(|e| e == "blog.localization.updated"),
        "lifecycle update enqueues blog.localization.updated — got {:?}",
        events
    );
}

#[tokio::test]
#[serial]
async fn blog_delete_localization_via_lifecycle_persists_and_fires_audit_and_webhook() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let auth = build_test_auth(&pool, site_id, ApiKeyPermission::Write).await;
    let blog = create_test_blog(&pool, site_id, &auth).await;
    let locale_id = seeded_locale_id(&pool, SEEDED_LOCALE_CODE).await;

    seed_webhook_for_events(
        &pool,
        site_id,
        vec!["blog.localization.deleted".to_string()],
    )
    .await;

    let loc = localization_lifecycle::create::<BlogLocalization>(
        &pool,
        blog.content_id,
        make_localization_request(locale_id, "To Be Deleted"),
        &auth,
    )
    .await
    .expect("seed localization");

    localization_lifecycle::delete::<BlogLocalization>(&pool, loc.id, &auth)
        .await
        .expect("lifecycle delete succeeds");

    let still_exists: i64 = sqlx::query("SELECT COUNT(*) FROM content_localizations WHERE id = $1")
        .bind(loc.id)
        .fetch_one(&pool)
        .await
        .expect("count")
        .get(0);
    assert_eq!(still_exists, 0, "row deleted");

    assert!(
        count_audit_rows_for_type(&pool, loc.id, "blog_localization").await >= 2,
        "delete writes a second 'blog_localization' audit row on top of the create row"
    );
    let events = webhook_event_types_for_entity(&pool, loc.id).await;
    assert!(
        events.iter().any(|e| e == "blog.localization.deleted"),
        "lifecycle delete enqueues blog.localization.deleted — got {:?}",
        events
    );
}

#[tokio::test]
#[serial]
async fn blog_create_localization_without_write_permission_returns_forbidden_and_writes_nothing() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    let writer = build_test_auth(&pool, site_id, ApiKeyPermission::Write).await;
    let blog = create_test_blog(&pool, site_id, &writer).await;

    let reader = build_test_auth(&pool, site_id, ApiKeyPermission::Read).await;
    let locale_id = seeded_locale_id(&pool, SEEDED_LOCALE_CODE).await;

    seed_webhook_for_events(
        &pool,
        site_id,
        vec!["blog.localization.created".to_string()],
    )
    .await;

    let result = localization_lifecycle::create::<BlogLocalization>(
        &pool,
        blog.content_id,
        make_localization_request(locale_id, "Should Be Rejected"),
        &reader,
    )
    .await;

    assert!(result.is_err(), "Read actor should be forbidden");

    let rows: i64 = sqlx::query("SELECT COUNT(*) FROM content_localizations WHERE content_id = $1")
        .bind(blog.content_id)
        .fetch_one(&pool)
        .await
        .expect("count rows")
        .get(0);
    assert_eq!(rows, 0, "no row written on forbidden create");

    let audit_rows: i64 = sqlx::query(
        "SELECT COUNT(*) FROM audit_logs WHERE entity_type = 'blog_localization' AND site_id = $1",
    )
    .bind(site_id)
    .fetch_one(&pool)
    .await
    .expect("count audit")
    .get(0);
    assert_eq!(audit_rows, 0, "no audit row on forbidden create");

    let queued: i64 = sqlx::query(
        r#"SELECT COUNT(*) FROM webhook_retry_queue q
           JOIN webhooks w ON w.id = q.webhook_id
           WHERE q.event_type = 'blog.localization.created' AND w.site_id = $1"#,
    )
    .bind(site_id)
    .fetch_one(&pool)
    .await
    .expect("count webhooks")
    .get(0);
    assert_eq!(queued, 0, "no webhook fired on forbidden create");
}

#[tokio::test]
#[serial]
async fn blog_create_localization_with_module_disabled_returns_forbidden() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let auth = build_test_auth(&pool, site_id, ApiKeyPermission::Write).await;
    let blog = create_test_blog(&pool, site_id, &auth).await;
    let locale_id = seeded_locale_id(&pool, SEEDED_LOCALE_CODE).await;

    sqlx::query(
        r#"INSERT INTO site_settings (site_id, setting_key, setting_value)
           VALUES ($1, 'module_blog_enabled', to_jsonb(FALSE))
           ON CONFLICT (site_id, setting_key) DO UPDATE SET setting_value = to_jsonb(FALSE)"#,
    )
    .bind(site_id)
    .execute(&pool)
    .await
    .expect("disable blog module");

    let result = localization_lifecycle::create::<BlogLocalization>(
        &pool,
        blog.content_id,
        make_localization_request(locale_id, "Module Disabled"),
        &auth,
    )
    .await;

    assert!(result.is_err(), "module-disabled should be forbidden");
    let err = result.unwrap_err();
    let msg = format!("{:?}", err);
    assert!(
        msg.contains("blog") && msg.to_lowercase().contains("not enabled"),
        "error should mention module disabled — got {}",
        msg
    );
}

#[tokio::test]
#[serial]
async fn blog_create_localization_with_duplicate_locale_returns_existing_code() {
    use forja::errors::codes;

    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let auth = build_test_auth(&pool, site_id, ApiKeyPermission::Write).await;
    let blog = create_test_blog(&pool, site_id, &auth).await;
    let locale_id = seeded_locale_id(&pool, SEEDED_LOCALE_CODE).await;

    localization_lifecycle::create::<BlogLocalization>(
        &pool,
        blog.content_id,
        make_localization_request(locale_id, "First"),
        &auth,
    )
    .await
    .expect("first create succeeds");

    let dup = localization_lifecycle::create::<BlogLocalization>(
        &pool,
        blog.content_id,
        make_localization_request(locale_id, "Duplicate"),
        &auth,
    )
    .await;

    let err = dup.expect_err("duplicate locale must be rejected");
    assert_eq!(
        err.code(),
        codes::ENTITY_LOCALIZATION_EXISTS,
        "preserves the existing-localization error code — got {}",
        err.code()
    );
}

// ── Coverage gate ──────────────────────────────────────────────────────────

async fn add_active_site_locale(pool: &PgPool, site_id: Uuid, code: &str) -> Uuid {
    let locale_id = seeded_locale_id(pool, code).await;
    sqlx::query(
        r#"INSERT INTO site_locales (site_id, locale_id, is_default, is_active)
           VALUES ($1, $2, FALSE, TRUE)
           ON CONFLICT (site_id, locale_id) DO UPDATE SET is_active = TRUE"#,
    )
    .bind(site_id)
    .bind(locale_id)
    .execute(pool)
    .await
    .expect("add site_locale");
    locale_id
}

/// Add a site_locale and mark it the Site's default (`is_default = TRUE`).
async fn add_default_site_locale(pool: &PgPool, site_id: Uuid, code: &str) -> Uuid {
    let locale_id = seeded_locale_id(pool, code).await;
    sqlx::query(
        r#"INSERT INTO site_locales (site_id, locale_id, is_default, is_active)
           VALUES ($1, $2, TRUE, TRUE)
           ON CONFLICT (site_id, locale_id)
           DO UPDATE SET is_default = TRUE, is_active = TRUE"#,
    )
    .bind(site_id)
    .bind(locale_id)
    .execute(pool)
    .await
    .expect("add default site_locale");
    locale_id
}

#[tokio::test]
#[serial]
async fn default_locale_ids_returns_only_the_site_default() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let de = add_default_site_locale(&pool, site_id, "de").await;
    let _en = add_active_site_locale(&pool, site_id, SEEDED_LOCALE_CODE).await;
    let auth = build_test_auth(&pool, site_id, ApiKeyPermission::Write).await;
    let blog = create_test_blog(&pool, site_id, &auth).await;

    let defaults = localization_lifecycle::default_locale_ids(&pool, blog.content_id)
        .await
        .expect("default lookup ok");

    assert_eq!(
        defaults.len(),
        1,
        "exactly one default — got {:?}",
        defaults
    );
    assert_eq!(defaults[0].locale_id, de);
    assert_eq!(defaults[0].code, "de");
}

#[tokio::test]
#[serial]
async fn publish_gate_passes_when_default_filled_even_if_other_locales_missing() {
    use forja::services::content_lifecycle::ContentEntity;

    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let de = add_default_site_locale(&pool, site_id, "de").await;
    // en + fr are active non-default locales with NO localization — they must
    // not block publish (readers fall back to the default per ADR 0002).
    let _en = add_active_site_locale(&pool, site_id, SEEDED_LOCALE_CODE).await;
    let _fr = add_active_site_locale(&pool, site_id, "fr").await;
    let auth = build_test_auth(&pool, site_id, ApiKeyPermission::Write).await;
    let blog = create_test_blog(&pool, site_id, &auth).await;

    localization_lifecycle::create::<BlogLocalization>(
        &pool,
        blog.content_id,
        make_localization_request(de, "DE title"),
        &auth,
    )
    .await
    .expect("seed default DE localization");

    let result = blog.validate_publish_gate(&pool).await;
    assert!(
        result.is_ok(),
        "default locale filled — publish must pass with non-default locales missing: {:?}",
        result.err()
    );
}

#[tokio::test]
#[serial]
async fn publish_gate_blocks_when_default_locale_unfilled() {
    use forja::errors::codes;
    use forja::services::content_lifecycle::ContentEntity;

    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let _de = add_default_site_locale(&pool, site_id, "de").await;
    let en = add_active_site_locale(&pool, site_id, SEEDED_LOCALE_CODE).await;
    let auth = build_test_auth(&pool, site_id, ApiKeyPermission::Write).await;
    let blog = create_test_blog(&pool, site_id, &auth).await;

    // Only the non-default EN locale is filled; the default DE is absent.
    localization_lifecycle::create::<BlogLocalization>(
        &pool,
        blog.content_id,
        make_localization_request(en, "EN only"),
        &auth,
    )
    .await
    .expect("seed EN");

    let result = blog.validate_publish_gate(&pool).await;
    let err = result.expect_err("publish-gate should block an unfilled default locale");
    assert_eq!(
        err.code(),
        codes::VALIDATION_ERROR,
        "publish-gate failure surfaces as VALIDATION_ERROR — got {}",
        err.code()
    );
    let msg = format!("{:?}", err);
    assert!(
        msg.contains("default locale") && msg.contains("de"),
        "error should name the unfilled default locale — got {}",
        msg
    );
}

// ── Page parity ────────────────────────────────────────────────────────────

async fn create_test_page(pool: &PgPool, site_id: Uuid, auth: &Actor) -> PageWithContent {
    let req = CreatePageRequest {
        route: format!("/loc-lifecycle-{}", &Uuid::new_v4().to_string()[..8]),
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
    content_lifecycle::create::<PageWithContent>(pool, req, auth)
        .await
        .expect("seed page for localization tests")
}

#[tokio::test]
#[serial]
async fn page_create_localization_via_lifecycle_persists_and_fires_audit_and_webhook() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let auth = build_test_auth(&pool, site_id, ApiKeyPermission::Write).await;
    let page = create_test_page(&pool, site_id, &auth).await;
    let locale_id = seeded_locale_id(&pool, SEEDED_LOCALE_CODE).await;

    seed_webhook_for_events(
        &pool,
        site_id,
        vec!["page.localization.created".to_string()],
    )
    .await;

    let loc = localization_lifecycle::create::<PageLocalization>(
        &pool,
        page.content_id,
        make_localization_request(locale_id, "Page Tracer"),
        &auth,
    )
    .await
    .expect("page lifecycle create succeeds");

    assert_eq!(loc.content_id, page.content_id);
    assert!(
        count_audit_rows_for_type(&pool, loc.id, "page_localization").await >= 1,
        "writes 'page_localization' audit row"
    );
    let events = webhook_event_types_for_entity(&pool, loc.id).await;
    assert!(
        events.iter().any(|e| e == "page.localization.created"),
        "page.localization.created enqueued — got {:?}",
        events
    );
}

// ── Legal parity ───────────────────────────────────────────────────────────

async fn create_test_legal(pool: &PgPool, site_id: Uuid, auth: &Actor) -> LegalDocument {
    let req = CreateLegalDocumentRequest {
        cookie_name: format!("ck_loc_{}", &Uuid::new_v4().to_string()[..8]),
        document_type: forja::models::legal::LegalDocType::PrivacyPolicy,
        slug: None,
        status: ContentStatus::Draft,
        site_ids: vec![site_id],
    };
    content_lifecycle::create::<LegalDocument>(pool, req, auth)
        .await
        .expect("seed legal for localization tests")
}

#[tokio::test]
#[serial]
async fn legal_create_localization_via_lifecycle_uses_diverged_audit_and_webhook_names() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    enable_module(&pool, site_id, "legal").await;
    let auth = build_test_auth(&pool, site_id, ApiKeyPermission::Write).await;
    let doc = create_test_legal(&pool, site_id, &auth).await;
    let content_id = doc
        .content_id
        .expect("legal doc has content_id after create");
    let locale_id = seeded_locale_id(&pool, SEEDED_LOCALE_CODE).await;

    seed_webhook_for_events(
        &pool,
        site_id,
        vec!["legal.localization.created".to_string()],
    )
    .await;

    let loc = localization_lifecycle::create::<LegalLocalization>(
        &pool,
        content_id,
        make_localization_request(locale_id, "Legal Tracer"),
        &auth,
    )
    .await
    .expect("legal lifecycle create succeeds");

    assert!(
        count_audit_rows_for_type(&pool, loc.id, "legal_document_localization").await >= 1,
        "writes 'legal_document_localization' audit row (audit type diverges from webhook prefix)"
    );
    let events = webhook_event_types_for_entity(&pool, loc.id).await;
    assert!(
        events.iter().any(|e| e == "legal.localization.created"),
        "legal.localization.created enqueued (webhook uses short 'legal' prefix) — got {:?}",
        events
    );
}

// ── Clerk site-member access (#17 e2e finding) ─────────────────────────────
//
// The admin UI saves localized content with the user's Clerk session, not
// an API key. The handlers used to pre-gate with `WriteKey`, which denies
// every non-system-admin Clerk user before the lifecycle's per-site
// permission check could run — so no site member could save a title/body
// through the editor. These tests pin the intended semantics: membership
// role decides, evaluated by the lifecycle itself.

fn clerk_actor(clerk_user_id: &str) -> Actor {
    let auth = AuthenticatedKey {
        id: Uuid::new_v5(
            &forja::guards::auth_guard::CLERK_UUID_NAMESPACE,
            clerk_user_id.as_bytes(),
        ),
        permission: ApiKeyPermission::Read,
        site_id: None,
        auth_source: AuthSource::ClerkJwt {
            clerk_user_id: clerk_user_id.to_string(),
        },
    };
    Actor::from_authenticated(&auth).expect("actor from Clerk auth")
}

#[tokio::test]
#[serial]
async fn blog_localization_create_allows_clerk_member_with_editor_role() {
    use forja::models::site_membership::{SiteMembership, SiteRole};

    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    enable_module(&pool, site_id, "blog").await;

    let seed_auth = build_test_auth(&pool, site_id, ApiKeyPermission::Write).await;
    let blog = create_test_blog(&pool, site_id, &seed_auth).await;
    let locale_id = seeded_locale_id(&pool, SEEDED_LOCALE_CODE).await;

    let clerk_id = format!("clerk_loc_member_{}", &Uuid::new_v4().to_string()[..8]);
    SiteMembership::create(&pool, &clerk_id, site_id, &SiteRole::Editor, None)
        .await
        .expect("create editor membership");
    let actor = clerk_actor(&clerk_id);

    let created = localization_lifecycle::create::<BlogLocalization>(
        &pool,
        blog.content_id,
        make_localization_request(locale_id, "Editor-saved localization"),
        &actor,
    )
    .await
    .expect("clerk editor can create a localization");

    let updated = localization_lifecycle::update::<BlogLocalization>(
        &pool,
        created.id,
        UpdateLocalizationRequest {
            title: Some("Editor-updated localization".to_string()),
            subtitle: None,
            excerpt: None,
            body: Some("Updated body.".to_string()),
            meta_title: None,
            meta_description: None,
            translation_status: None,
        },
        &actor,
    )
    .await
    .expect("clerk editor can update a localization");
    assert_eq!(updated.title, "Editor-updated localization");
}

#[tokio::test]
#[serial]
async fn blog_localization_create_denies_clerk_user_without_membership() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    enable_module(&pool, site_id, "blog").await;

    let seed_auth = build_test_auth(&pool, site_id, ApiKeyPermission::Write).await;
    let blog = create_test_blog(&pool, site_id, &seed_auth).await;
    let locale_id = seeded_locale_id(&pool, SEEDED_LOCALE_CODE).await;

    let actor = clerk_actor(&format!(
        "clerk_loc_stranger_{}",
        &Uuid::new_v4().to_string()[..8]
    ));

    let err = localization_lifecycle::create::<BlogLocalization>(
        &pool,
        blog.content_id,
        make_localization_request(locale_id, "Should not exist"),
        &actor,
    )
    .await
    .expect_err("non-member clerk user must be denied");
    assert_eq!(err.status().as_u16(), 403);
}
