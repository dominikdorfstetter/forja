//! Integration tests for `services::publish_pipeline`.
//!
//! Phase 1 wrapper for #531. Validates the post-mutation orchestration in
//! `execute` (audit → webhook → notify → hooks) plus the pre-mutation
//! `validate_publish_gate` short-circuit.
//!
//! Prereq: same as `integration_tests.rs` — a `forja_test` PostgreSQL
//! database is reachable via `TEST_DATABASE_URL` (or default
//! `postgres://forja:forja@localhost:5432/forja_test`).

mod common;

use chrono::NaiveDate;
use serial_test::serial;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use forja::dto::blog::CreateBlogRequest;
use forja::models::audit::AuditAction;
use forja::models::content::{ContentLocalization, ContentStatus};
use forja::models::site_membership::SiteRole;
use forja::repos::blog_repo::BlogRepo;
use forja::services::content_lifecycle::ContentEntity;
use forja::services::publish_pipeline::{self, PublishEvent, StatusTransition};

use common::{create_test_site, test_db_pool};

const SEEDED_LOCALE_CODE: &str = "en";

async fn seeded_locale_id(pool: &PgPool) -> Uuid {
    sqlx::query("SELECT id FROM locales WHERE code = $1")
        .bind(SEEDED_LOCALE_CODE)
        .fetch_one(pool)
        .await
        .expect("seeded en locale")
        .get::<Uuid, _>(0)
}

async fn seed_blog_with_localization(pool: &PgPool, site_id: Uuid) -> (Uuid, Uuid) {
    let req = CreateBlogRequest {
        slug: Some(format!(
            "pipeline-test-{}",
            &Uuid::new_v4().to_string()[..8]
        )),
        title: Some("Pipeline Test Post".to_string()),
        author: "Test Author".to_string(),
        published_date: NaiveDate::from_ymd_opt(2026, 5, 8).expect("valid date"),
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
    let blog = BlogRepo::create(&mut pool.acquire().await.unwrap(), req, Some("test-user"))
        .await
        .expect("BlogRepo::create succeeds");
    let locale_id = seeded_locale_id(pool).await;
    ContentLocalization::create(
        pool,
        blog.content_id,
        locale_id,
        "Pipeline Title",
        None,
        None,
        Some("Pipeline body content."),
        Some("Pipeline meta title"),
        None,
    )
    .await
    .expect("localization insert succeeds");
    (blog.id, blog.content_id)
}

async fn seed_blog_without_localization(pool: &PgPool, site_id: Uuid) -> (Uuid, Uuid) {
    let req = CreateBlogRequest {
        slug: Some(format!(
            "pipeline-bare-{}",
            &Uuid::new_v4().to_string()[..8]
        )),
        title: Some("Bare".to_string()),
        author: "Test Author".to_string(),
        published_date: NaiveDate::from_ymd_opt(2026, 5, 8).expect("valid date"),
        reading_time_minutes: Some(1),
        cover_image_id: None,
        header_image_id: None,
        is_featured: false,
        allow_comments: false,
        status: ContentStatus::Draft,
        publish_start: None,
        publish_end: None,
        site_ids: vec![site_id],
    };
    let blog = BlogRepo::create(&mut pool.acquire().await.unwrap(), req, Some("test-user"))
        .await
        .expect("BlogRepo::create succeeds");
    (blog.id, blog.content_id)
}

async fn seed_webhook_for_blogs(pool: &PgPool, site_id: Uuid) {
    sqlx::query(
        r#"INSERT INTO webhooks (site_id, url, secret, events, debounce_seconds, is_active)
           VALUES ($1, $2, $3, $4, 0, TRUE)"#,
    )
    .bind(site_id)
    .bind("https://example.invalid/hook")
    .bind("whsec_pipeline_test")
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

fn build_publish_event(
    site_id: Uuid,
    blog_id: Uuid,
    content_id: Uuid,
    transition: Option<StatusTransition>,
    action: AuditAction,
    webhook_event: &str,
) -> PublishEvent {
    PublishEvent {
        site_id,
        entity_type: "blog",
        entity_id: blog_id,
        content_id,
        user_id: None,
        clerk_actor_id: None,
        action,
        webhook_event: webhook_event.to_string(),
        webhook_payload: serde_json::json!({"id": blog_id}),
        audit_metadata: None,
        status_transition: transition,
        change_diff: None,
        slug: Some("pipeline-test".to_string()),
        webhook_published_event: None,
    }
}

// ── Tracer bullet ────────────────────────────────────────────────────────

#[tokio::test]
#[serial]
async fn publish_pipeline_publishes_blog_full_pipeline() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook_for_blogs(&pool, site_id).await;
    let (blog_id, content_id) = seed_blog_with_localization(&pool, site_id).await;

    publish_pipeline::validate_status(
        &pool,
        site_id,
        &SiteRole::Editor,
        &ContentStatus::Draft,
        &ContentStatus::Published,
    )
    .await
    .expect("Editor may transition Draft → Published");
    BlogRepo::find_by_id(&pool, blog_id)
        .await
        .expect("fetch blog")
        .validate_publish_gate(&pool)
        .await
        .expect("blog with localization passes gate");

    let event = build_publish_event(
        site_id,
        blog_id,
        content_id,
        Some(StatusTransition {
            from: ContentStatus::Draft,
            to: ContentStatus::Published,
            user_role: SiteRole::Editor,
        }),
        AuditAction::Update,
        "blog.updated",
    );

    publish_pipeline::execute(&pool, event)
        .await
        .expect("execute succeeds for a fully-formed publish event");

    assert!(
        count_audit_rows(&pool, blog_id).await >= 1,
        "primary log_audit step writes an audit row"
    );

    let events = webhook_event_types_for(&pool, blog_id).await;
    assert!(
        events.iter().any(|e| e == "blog.updated"),
        "primary webhook event 'blog.updated' enqueued — got {:?}",
        events
    );
    assert!(
        events.iter().any(|e| e == "blog.published"),
        "publish_hooks fires the canonical 'blog.published' webhook — got {:?}",
        events
    );
}

// ── Pre-mutation publish gate rejects incomplete content ─────────────────

#[tokio::test]
#[serial]
async fn validate_publish_gate_blocks_blog_without_localization() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let (blog_id, _content_id) = seed_blog_without_localization(&pool, site_id).await;

    let blog = BlogRepo::find_by_id(&pool, blog_id)
        .await
        .expect("fetch blog");
    let result = blog.validate_publish_gate(&pool).await;

    let err = result.expect_err("blog with no localization must fail the publish gate");
    assert_eq!(
        err.code(),
        "VALIDATION_ERROR",
        "gate failure surfaces VALIDATION_ERROR — got {}",
        err.code()
    );
}

// ── Create event runs audit + webhook only ───────────────────────────────

#[tokio::test]
#[serial]
async fn publish_pipeline_create_event_skips_publish_hooks() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook_for_blogs(&pool, site_id).await;
    let (blog_id, content_id) = seed_blog_with_localization(&pool, site_id).await;

    let event = build_publish_event(
        site_id,
        blog_id,
        content_id,
        None,
        AuditAction::Create,
        "blog.created",
    );

    publish_pipeline::execute(&pool, event)
        .await
        .expect("create event succeeds");

    let events = webhook_event_types_for(&pool, blog_id).await;
    assert_eq!(
        events,
        vec!["blog.created".to_string()],
        "create event fires only the primary webhook (no publish_hooks) — got {:?}",
        events
    );
    assert_eq!(
        count_audit_rows(&pool, blog_id).await,
        1,
        "create event writes exactly one audit row (no hooks-side double log)"
    );
}

// ── Audit before webhook ordering ─────────────────────────────────────────

#[tokio::test]
#[serial]
async fn publish_pipeline_orders_audit_before_webhook() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook_for_blogs(&pool, site_id).await;
    let (blog_id, content_id) = seed_blog_with_localization(&pool, site_id).await;

    let event = build_publish_event(
        site_id,
        blog_id,
        content_id,
        Some(StatusTransition {
            from: ContentStatus::Draft,
            to: ContentStatus::Published,
            user_role: SiteRole::Editor,
        }),
        AuditAction::Update,
        "blog.updated",
    );

    publish_pipeline::execute(&pool, event)
        .await
        .expect("pipeline succeeds");

    let earliest_audit: chrono::DateTime<chrono::Utc> = sqlx::query(
        "SELECT MIN(created_at) FROM audit_logs WHERE entity_id = $1 AND entity_type = 'blog'",
    )
    .bind(blog_id)
    .fetch_one(&pool)
    .await
    .expect("query earliest audit")
    .get::<chrono::DateTime<chrono::Utc>, _>(0);

    let earliest_webhook: chrono::DateTime<chrono::Utc> = sqlx::query(
        r#"SELECT MIN(created_at) FROM webhook_retry_queue
           WHERE payload->>'entity_id' = $1::text"#,
    )
    .bind(blog_id)
    .fetch_one(&pool)
    .await
    .expect("query earliest webhook")
    .get::<chrono::DateTime<chrono::Utc>, _>(0);

    assert!(
        earliest_audit <= earliest_webhook,
        "audit ({}) must be written at or before the first webhook ({}) — order invariant for #531",
        earliest_audit,
        earliest_webhook
    );
}

// ── #532: tracer bullets per non-blog entity ─────────────────────────────

async fn seed_webhook_for_events(pool: &PgPool, site_id: Uuid, events: Vec<String>) {
    sqlx::query(
        r#"INSERT INTO webhooks (site_id, url, secret, events, debounce_seconds, is_active)
           VALUES ($1, $2, $3, $4, 0, TRUE)"#,
    )
    .bind(site_id)
    .bind("https://example.invalid/hook")
    .bind("whsec_pipeline_test")
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

#[allow(clippy::too_many_arguments)]
fn build_event(
    site_id: Uuid,
    entity_type: &'static str,
    entity_id: Uuid,
    content_id: Uuid,
    action: AuditAction,
    webhook_event: &str,
    webhook_published_event: Option<String>,
    status_transition: Option<StatusTransition>,
) -> PublishEvent {
    PublishEvent {
        site_id,
        entity_type,
        entity_id,
        content_id,
        user_id: None,
        clerk_actor_id: None,
        action,
        webhook_event: webhook_event.to_string(),
        webhook_payload: serde_json::json!({"id": entity_id}),
        audit_metadata: None,
        status_transition,
        change_diff: None,
        slug: None,
        webhook_published_event,
    }
}

#[tokio::test]
#[serial]
async fn publish_pipeline_emits_page_create_webhook() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook_for_events(&pool, site_id, vec!["page.created".to_string()]).await;
    let entity_id = Uuid::new_v4();

    publish_pipeline::execute(
        &pool,
        build_event(
            site_id,
            "page",
            entity_id,
            Uuid::new_v4(),
            AuditAction::Create,
            "page.created",
            None,
            None,
        ),
    )
    .await
    .expect("page create event succeeds");

    assert_eq!(
        webhook_event_types_for(&pool, entity_id).await,
        vec!["page.created".to_string()],
        "create event for page emits exactly the page.created webhook"
    );
    assert_eq!(
        count_audit_rows_for_type(&pool, entity_id, "page").await,
        1,
        "create event writes one audit row under entity_type='page'"
    );
}

#[tokio::test]
#[serial]
async fn publish_pipeline_emits_document_create_webhook() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook_for_events(&pool, site_id, vec!["document.created".to_string()]).await;
    let entity_id = Uuid::new_v4();

    publish_pipeline::execute(
        &pool,
        build_event(
            site_id,
            "document",
            entity_id,
            Uuid::nil(),
            AuditAction::Create,
            "document.created",
            None,
            None,
        ),
    )
    .await
    .expect("document create event succeeds");

    assert_eq!(
        webhook_event_types_for(&pool, entity_id).await,
        vec!["document.created".to_string()],
    );
    assert_eq!(
        count_audit_rows_for_type(&pool, entity_id, "document").await,
        1,
    );
}

#[tokio::test]
#[serial]
async fn publish_pipeline_emits_cv_subentity_create_webhook() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    // CV subentities (skill, cv_entry) audit under their subtype but
    // dispatch a single `cv.<action>` webhook prefix.
    seed_webhook_for_events(&pool, site_id, vec!["cv.created".to_string()]).await;
    let entity_id = Uuid::new_v4();

    publish_pipeline::execute(
        &pool,
        build_event(
            site_id,
            "skill",
            entity_id,
            Uuid::nil(),
            AuditAction::Create,
            "cv.created",
            None,
            None,
        ),
    )
    .await
    .expect("skill create event succeeds");

    assert_eq!(
        webhook_event_types_for(&pool, entity_id).await,
        vec!["cv.created".to_string()],
        "skill audit type drives audit_logs row but cv.created drives the webhook"
    );
    assert_eq!(
        count_audit_rows_for_type(&pool, entity_id, "skill").await,
        1,
    );
}

#[tokio::test]
#[serial]
async fn publish_pipeline_emits_project_create_webhook() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    seed_webhook_for_events(&pool, site_id, vec!["project.created".to_string()]).await;
    let entity_id = Uuid::new_v4();

    publish_pipeline::execute(
        &pool,
        build_event(
            site_id,
            "project",
            entity_id,
            Uuid::new_v4(),
            AuditAction::Create,
            "project.created",
            None,
            None,
        ),
    )
    .await
    .expect("project create event succeeds");

    assert_eq!(
        webhook_event_types_for(&pool, entity_id).await,
        vec!["project.created".to_string()],
    );
    assert_eq!(
        count_audit_rows_for_type(&pool, entity_id, "project").await,
        1,
    );
}

#[tokio::test]
#[serial]
async fn publish_pipeline_uses_webhook_published_event_override() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    // Subscribe to the override prefix; deliberately do NOT subscribe
    // to "legal_document.published" to prove the override is what's
    // dispatched (otherwise this would be a vacuous test).
    seed_webhook_for_events(
        &pool,
        site_id,
        vec!["legal.updated".to_string(), "legal.published".to_string()],
    )
    .await;
    let entity_id = Uuid::new_v4();

    publish_pipeline::execute(
        &pool,
        build_event(
            site_id,
            "legal_document",
            entity_id,
            Uuid::new_v4(),
            AuditAction::Update,
            "legal.updated",
            Some("legal.published".to_string()),
            Some(StatusTransition {
                from: ContentStatus::Draft,
                to: ContentStatus::Published,
                user_role: SiteRole::Editor,
            }),
        ),
    )
    .await
    .expect("legal_document → Published succeeds");

    let events = webhook_event_types_for(&pool, entity_id).await;
    assert!(
        events.iter().any(|e| e == "legal.published"),
        "webhook_published_event override emits 'legal.published' — got {:?}",
        events
    );
    assert!(
        !events.iter().any(|e| e == "legal_document.published"),
        "the default '{{entity_type}}.published' must NOT fire when override is set — got {:?}",
        events
    );
}
