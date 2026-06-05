//! Issue #739 — localizations[] on ProjectResponse list endpoint.
//!
//! Tracer-bullet integration tests over the public repo seam used by the
//! list handlers (`list_projects`, `list_published_projects`). The handler
//! pulls projects once + localizations once (bulk) — no N+1.

mod common;

use serial_test::serial;
use sqlx::Row;
use uuid::Uuid;

use forja::dto::project::{CreateProjectLocalizationRequest, CreateProjectRequest};
use forja::models::content::ContentStatus;
use forja::repos::project_repo::ProjectRepo;

use common::{create_test_site, test_db_pool};

async fn seeded_locale_id(pool: &sqlx::PgPool, code: &str) -> Uuid {
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

fn project_req(
    site_id: Uuid,
    slug_seed: &str,
    locs: Option<Vec<CreateProjectLocalizationRequest>>,
) -> CreateProjectRequest {
    CreateProjectRequest {
        slug: format!("{slug_seed}-{}", &Uuid::new_v4().to_string()[..8]),
        display_order: Some(0),
        is_featured: Some(false),
        start_date: None,
        end_date: None,
        is_ongoing: Some(false),
        status: ContentStatus::Draft,
        site_ids: vec![site_id],
        localizations: locs,
        links: None,
        media: None,
        skill_ids: None,
        cv_entry_ids: None,
    }
}

#[tokio::test]
#[serial]
async fn tracer_bulk_fetch_returns_localizations_grouped_per_project() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let en = seeded_locale_id(&pool, "en").await;
    let de = seeded_locale_id(&pool, "de").await;
    let es = seeded_locale_id(&pool, "es").await;

    let mut created_ids = Vec::with_capacity(2);
    for i in 0..2 {
        let p = ProjectRepo::create(
            &mut pool.acquire().await.unwrap(),
            project_req(
                site_id,
                "tracer",
                Some(vec![
                    loc_req(en, &format!("EN {i}")),
                    loc_req(de, &format!("DE {i}")),
                    loc_req(es, &format!("ES {i}")),
                ]),
            ),
            Some("test"),
        )
        .await
        .expect("create project");
        created_ids.push(p.id);
    }

    let locs = ProjectRepo::find_localizations_for_project_ids(&pool, &created_ids)
        .await
        .expect("bulk fetch");

    assert_eq!(locs.len(), 6, "2 projects × 3 locales = 6 rows");

    let mut by_project: std::collections::HashMap<Uuid, Vec<_>> = std::collections::HashMap::new();
    for l in locs {
        by_project.entry(l.project_id).or_default().push(l);
    }
    assert_eq!(by_project.len(), 2, "two distinct project groups");
    for id in &created_ids {
        let group = by_project.get(id).expect("group present");
        assert_eq!(group.len(), 3, "every project has 3 locales");
        let mut codes: Vec<Uuid> = group.iter().map(|l| l.locale_id).collect();
        codes.sort();
        let mut expected = vec![en, de, es];
        expected.sort();
        assert_eq!(codes, expected);
    }
}

#[tokio::test]
#[serial]
async fn bulk_fetch_returns_empty_for_project_without_localizations() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    let project = ProjectRepo::create(
        &mut pool.acquire().await.unwrap(),
        project_req(site_id, "no-locs", None),
        Some("test"),
    )
    .await
    .expect("create project");

    let locs = ProjectRepo::find_localizations_for_project_ids(&pool, &[project.id])
        .await
        .expect("bulk fetch empty");

    assert!(
        locs.is_empty(),
        "no localizations seeded → empty bulk result"
    );
}

#[tokio::test]
#[serial]
async fn bulk_fetch_with_empty_id_slice_returns_empty_without_hitting_db() {
    let pool = test_db_pool().await;
    let locs = ProjectRepo::find_localizations_for_project_ids(&pool, &[])
        .await
        .expect("empty slice ok");
    assert!(locs.is_empty());
}
