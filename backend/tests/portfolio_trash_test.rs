//! Integration tests for #818 — soft-deleted Portfolio content (projects,
//! CV entries, skills) must be recoverable through Trash: listed, restorable,
//! and purged after the retention window like every other content type.
//!
//! Exercises the `TrashRepo` union + the per-entity restore/permanent-delete
//! repo seams directly against the test database.

mod common;

use serial_test::serial;
use sqlx::PgPool;
use uuid::Uuid;

use chrono::{DateTime, NaiveDate, Utc};

use forja::dto::cv::{CreateCvEntryRequest, CreateSkillRequest};
use forja::dto::project::{CreateProjectLocalizationRequest, CreateProjectRequest};
use forja::models::api_key::ApiKeyPermission;
use forja::models::content::ContentStatus;
use forja::models::cv::CvEntryType;
use forja::repos::cv_repo::{CvEntryRepo, SkillRepo};
use forja::repos::project_repo::ProjectRepo;
use forja::repos::trash_repo::TrashRepo;
use forja::services::content_service::ContentService;

use common::{create_test_api_key, create_test_site, test_context, test_db_pool};

async fn any_locale_id(pool: &PgPool) -> Uuid {
    sqlx::query_scalar("SELECT id FROM locales LIMIT 1")
        .fetch_one(pool)
        .await
        .expect("a seeded locale")
}

// ---------------------------------------------------------------------------
// Tracer bullet: a soft-deleted project appears in Trash and can be restored.
// ---------------------------------------------------------------------------

#[tokio::test]
#[serial]
async fn project_soft_delete_appears_in_trash_and_restores() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let locale_id = any_locale_id(&pool).await;

    let req = CreateProjectRequest {
        slug: format!("proj-{}", &Uuid::new_v4().to_string()[..8]),
        display_order: Some(0),
        is_featured: Some(false),
        start_date: None,
        end_date: None,
        is_ongoing: Some(false),
        status: ContentStatus::Draft,
        site_ids: vec![site_id],
        localizations: Some(vec![CreateProjectLocalizationRequest {
            locale_id,
            title: "My Flagship Project".to_string(),
            short_description: None,
            description: None,
        }]),
        links: None,
        media: None,
        skill_ids: None,
        cv_entry_ids: None,
    };
    let project = ProjectRepo::create(&mut pool.acquire().await.unwrap(), req, Some("test-user"))
        .await
        .expect("create project");

    // Before deletion: not in trash.
    let before = TrashRepo::list(&pool, site_id, 100, 0)
        .await
        .expect("list trash");
    assert!(
        !before.iter().any(|i| i.id == project.content_id),
        "active project must not be in trash"
    );

    ProjectRepo::soft_delete(&pool, project.id)
        .await
        .expect("soft delete project");

    // After deletion: appears in trash, keyed by content id, typed "project".
    let after = TrashRepo::list(&pool, site_id, 100, 0)
        .await
        .expect("list trash");
    let item = after
        .iter()
        .find(|i| i.id == project.content_id)
        .expect("soft-deleted project must appear in trash");
    assert_eq!(item.entity_type, "project");
    assert_eq!(item.title.as_deref(), Some("My Flagship Project"));
    assert!(item.deleted_at.is_some(), "deleted_at must be stamped");

    // Restore removes it from trash and returns it to the active project list.
    ContentService::restore_content(&pool, project.content_id)
        .await
        .expect("restore project");
    let restored = TrashRepo::list(&pool, site_id, 100, 0)
        .await
        .expect("list trash");
    assert!(
        !restored.iter().any(|i| i.id == project.content_id),
        "restored project must leave trash"
    );
    ProjectRepo::find_by_id(&pool, project.id)
        .await
        .expect("restored project is active again");
}

// ---------------------------------------------------------------------------
// CV entries (content spine, title from cv_entries.company — they have no slug).
// ---------------------------------------------------------------------------

#[tokio::test]
#[serial]
async fn cv_entry_soft_delete_appears_in_trash_with_company_title() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    let req = CreateCvEntryRequest {
        company: "Acme Corp".to_string(),
        company_url: None,
        company_logo_id: None,
        location: "Vienna, Austria".to_string(),
        start_date: NaiveDate::from_ymd_opt(2020, 1, 15).unwrap(),
        end_date: None,
        is_current: true,
        entry_type: CvEntryType::Work,
        display_order: 0,
        status: ContentStatus::Draft,
        site_ids: vec![site_id],
        localizations: None,
        skill_ids: None,
    };
    let entry = CvEntryRepo::create(&mut pool.acquire().await.unwrap(), req, Some("test-user"))
        .await
        .expect("create cv entry");
    let content_id = entry.content_id.expect("cv entry has content_id");

    CvEntryRepo::soft_delete(&pool, entry.id)
        .await
        .expect("soft delete cv entry");

    let after = TrashRepo::list(&pool, site_id, 100, 0)
        .await
        .expect("list trash");
    let item = after
        .iter()
        .find(|i| i.id == content_id)
        .expect("soft-deleted cv entry must appear in trash");
    assert_eq!(item.entity_type, "cv_entry");
    assert_eq!(item.title.as_deref(), Some("Acme Corp"));

    // Count reflects it too.
    let count = TrashRepo::count(&pool, site_id).await.expect("count trash");
    assert_eq!(count, 1, "trash count includes the cv entry");

    ContentService::restore_content(&pool, content_id)
        .await
        .expect("restore cv entry");
    let restored = TrashRepo::list(&pool, site_id, 100, 0)
        .await
        .expect("list trash");
    assert!(
        !restored.iter().any(|i| i.id == content_id),
        "restored cv entry must leave trash"
    );
}

// ---------------------------------------------------------------------------
// Skills (own table, not the content spine). The forever-orphan: must now be
// stamped with deleted_at, listed, restorable, and permanently deletable.
// ---------------------------------------------------------------------------

async fn create_skill(pool: &PgPool, site_id: Uuid, name: &str) -> Uuid {
    let suffix = &Uuid::new_v4().to_string()[..8];
    let req = CreateSkillRequest {
        name: name.to_string(),
        slug: format!("skill-{suffix}"),
        category: None,
        icon: None,
        proficiency_level: None,
        is_global: false,
        site_ids: vec![site_id],
    };
    SkillRepo::create(pool, req).await.expect("create skill").id
}

async fn skill_deleted_at(pool: &PgPool, id: Uuid) -> Option<DateTime<Utc>> {
    sqlx::query_scalar("SELECT deleted_at FROM skills WHERE id = $1")
        .bind(id)
        .fetch_one(pool)
        .await
        .expect("read skill deleted_at")
}

#[tokio::test]
#[serial]
async fn skill_soft_delete_stamps_deleted_at() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let skill_id = create_skill(&pool, site_id, "Rust").await;

    assert!(skill_deleted_at(&pool, skill_id).await.is_none());

    SkillRepo::soft_delete(&pool, skill_id)
        .await
        .expect("soft delete skill");

    assert!(
        skill_deleted_at(&pool, skill_id).await.is_some(),
        "soft delete must stamp deleted_at so the skill enters the retention window"
    );
}

#[tokio::test]
#[serial]
async fn skill_soft_delete_appears_in_trash_restores_and_permanent_deletes() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let skill_id = create_skill(&pool, site_id, "Rust").await;

    SkillRepo::soft_delete(&pool, skill_id)
        .await
        .expect("soft delete skill");

    // Appears in trash, typed "skill", titled by name.
    let after = TrashRepo::list(&pool, site_id, 100, 0)
        .await
        .expect("list trash");
    let item = after
        .iter()
        .find(|i| i.id == skill_id)
        .expect("soft-deleted skill must appear in trash");
    assert_eq!(item.entity_type, "skill");
    assert_eq!(item.title.as_deref(), Some("Rust"));
    assert!(item.deleted_at.is_some());
    assert_eq!(
        TrashRepo::count(&pool, site_id).await.expect("count"),
        1,
        "trash count includes the skill"
    );

    // Restore returns it to the active list and clears the stamp.
    SkillRepo::restore(&pool, skill_id)
        .await
        .expect("restore skill");
    let restored = TrashRepo::list(&pool, site_id, 100, 0)
        .await
        .expect("list trash");
    assert!(
        !restored.iter().any(|i| i.id == skill_id),
        "restored skill must leave trash"
    );
    assert!(skill_deleted_at(&pool, skill_id).await.is_none());

    // Re-delete, then permanently delete — the row is gone for good.
    SkillRepo::soft_delete(&pool, skill_id)
        .await
        .expect("re-delete skill");
    SkillRepo::permanent_delete(&pool, skill_id)
        .await
        .expect("permanent delete skill");
    let gone: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM skills WHERE id = $1")
        .bind(skill_id)
        .fetch_optional(&pool)
        .await
        .expect("query skill");
    assert!(gone.is_none(), "permanently deleted skill row is gone");

    // Permanent delete refuses an active (not-trashed) skill.
    let active = create_skill(&pool, site_id, "Go").await;
    assert!(
        SkillRepo::permanent_delete(&pool, active).await.is_err(),
        "permanent_delete must only act on trashed skills"
    );
}

#[tokio::test]
#[serial]
async fn skill_past_retention_is_purged_but_recent_survives() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let recent = create_skill(&pool, site_id, "Recent").await;
    let old = create_skill(&pool, site_id, "Old").await;

    SkillRepo::soft_delete(&pool, recent)
        .await
        .expect("delete recent");
    SkillRepo::soft_delete(&pool, old)
        .await
        .expect("delete old");
    // Backdate the "old" skill past the 30-day retention window.
    sqlx::query("UPDATE skills SET deleted_at = NOW() - INTERVAL '31 days' WHERE id = $1")
        .bind(old)
        .execute(&pool)
        .await
        .expect("backdate old skill");

    let purged = SkillRepo::purge_expired(&pool, 30)
        .await
        .expect("purge expired");
    assert!(purged >= 1, "at least the expired skill is purged");

    let old_row: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM skills WHERE id = $1")
        .bind(old)
        .fetch_optional(&pool)
        .await
        .expect("query old");
    assert!(old_row.is_none(), "expired skill is purged");

    let recent_row: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM skills WHERE id = $1")
        .bind(recent)
        .fetch_optional(&pool)
        .await
        .expect("query recent");
    assert!(
        recent_row.is_some(),
        "recently-deleted skill survives the retention window"
    );
}

// ---------------------------------------------------------------------------
// Authorization guard (HTTP): an orphaned, site-less row has no site to
// authorize against, so restore/permanent-delete must fail closed (404)
// rather than mutating without a permission check.
// ---------------------------------------------------------------------------

#[tokio::test]
#[serial]
async fn orphaned_skill_cannot_be_restored_without_a_site() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Master).await;
    let skill_id = create_skill(&ctx.pool, site_id, "Orphan").await;

    SkillRepo::soft_delete(&ctx.pool, skill_id)
        .await
        .expect("soft delete skill");
    // Orphan the row: drop its site association while it stays soft-deleted.
    sqlx::query("DELETE FROM skill_sites WHERE skill_id = $1")
        .bind(skill_id)
        .execute(&ctx.pool)
        .await
        .expect("orphan skill");

    let resp = ctx
        .server
        .post(&format!(
            "/api/v1/trash/{skill_id}/restore?entity_type=skill"
        ))
        .add_header("x-api-key", key.as_str())
        .await;
    assert_eq!(
        resp.status_code().as_u16(),
        404,
        "a site-less skill has no site to authorize against and must not restore"
    );

    let still_deleted: bool = sqlx::query_scalar("SELECT is_deleted FROM skills WHERE id = $1")
        .bind(skill_id)
        .fetch_one(&ctx.pool)
        .await
        .expect("query skill");
    assert!(
        still_deleted,
        "the guard must leave the orphaned skill untouched"
    );
}
