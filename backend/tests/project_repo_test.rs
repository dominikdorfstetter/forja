//! Integration tests for `repos::project_repo`. Phase 2 of #520
//! (issue #533, project entity).

mod common;

use serial_test::serial;
use sqlx::PgPool;
use uuid::Uuid;

use forja::dto::project::CreateProjectRequest;
use forja::models::content::ContentStatus;
use forja::repos::project_repo::ProjectRepo;

use common::{create_test_site, test_db_pool};

async fn insert_skill(pool: &PgPool) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO skills (id, name, slug)
        VALUES ($1, $2, $3)
        "#,
    )
    .bind(id)
    .bind(format!("Skill {}", &id.to_string()[..8]))
    .bind(format!("skill-{}", &id.to_string()[..8]))
    .execute(pool)
    .await
    .expect("insert skill");
    id
}

async fn create_project_with_skills(pool: &PgPool, site_id: Uuid, skill_ids: Vec<Uuid>) -> Uuid {
    let req = CreateProjectRequest {
        slug: format!("p-{}", &Uuid::new_v4().to_string()[..8]),
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
        skill_ids: if skill_ids.is_empty() {
            None
        } else {
            Some(skill_ids)
        },
        cv_entry_ids: None,
    };
    ProjectRepo::create(&mut pool.acquire().await.unwrap(), req, Some("test-user"))
        .await
        .expect("create project")
        .id
}

#[tokio::test]
#[serial]
async fn tracer_project_repo_round_trip_via_create_and_find_by_id() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    let req = CreateProjectRequest {
        slug: format!("repo-tracer-{}", &Uuid::new_v4().to_string()[..8]),
        display_order: Some(0),
        is_featured: Some(true),
        start_date: None,
        end_date: None,
        is_ongoing: Some(false),
        status: ContentStatus::Draft,
        site_ids: vec![site_id],
        links: None,
        media: None,
        skill_ids: None,
        cv_entry_ids: None,
        localizations: None,
    };

    let created = ProjectRepo::create(&mut pool.acquire().await.unwrap(), req, Some("test-user"))
        .await
        .expect("ProjectRepo::create succeeds");

    let fetched = ProjectRepo::find_by_id(&pool, created.id)
        .await
        .expect("ProjectRepo::find_by_id succeeds");

    assert_eq!(fetched.id, created.id);
    assert!(fetched.is_featured);
    assert_eq!(fetched.status, ContentStatus::Draft);
}

// Issue #738 — bulk skill_ids lookup powers GET /projects without N+1.
#[tokio::test]
#[serial]
async fn tracer_bulk_skill_ids_for_projects_returns_ids_per_project() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    let two_skills: Vec<Uuid> = {
        let mut v = Vec::new();
        for _ in 0..2 {
            v.push(insert_skill(&pool).await);
        }
        v
    };
    let five_skills: Vec<Uuid> = {
        let mut v = Vec::new();
        for _ in 0..5 {
            v.push(insert_skill(&pool).await);
        }
        v
    };

    let p1 = create_project_with_skills(&pool, site_id, two_skills.clone()).await;
    let p2 = create_project_with_skills(&pool, site_id, vec![]).await;
    let p3 = create_project_with_skills(&pool, site_id, five_skills.clone()).await;

    let map = ProjectRepo::skill_ids_for_projects(&pool, &[p1, p2, p3])
        .await
        .expect("bulk skill_ids fetch succeeds");

    assert_eq!(map.get(&p1).map(|v| v.len()).unwrap_or(0), 2);
    assert_eq!(map.get(&p2).map(|v| v.len()).unwrap_or(0), 0);
    assert_eq!(map.get(&p3).map(|v| v.len()).unwrap_or(0), 5);

    let p1_ids: std::collections::HashSet<_> = map.get(&p1).unwrap().iter().copied().collect();
    let expected_p1: std::collections::HashSet<_> = two_skills.into_iter().collect();
    assert_eq!(p1_ids, expected_p1);
}
