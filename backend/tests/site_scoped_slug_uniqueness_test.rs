//! Schema-level tests for migration #762 — site-scoped slug uniqueness.
//!
//! Proves the migration:
//!   1. Drops the global-slug UNIQUE on `projects`, `skills`, `tags`,
//!      `categories` so a second tenant can seed an overlapping slug.
//!   2. Adds a partial UNIQUE on each `*_sites` join table over
//!      `(site_id, site_specific_slug) WHERE site_specific_slug IS NOT NULL`
//!      so the app layer can opt into per-site uniqueness by setting the
//!      column on insert.
//!
//! Repo code that doesn't yet set `site_specific_slug` continues to work —
//! the partial index is a no-op for rows where the column is NULL.

mod common;

use common::{create_test_site, test_db_pool};
use serial_test::serial;
use sqlx::PgPool;
use uuid::Uuid;

/// Insert a minimal `contents` row for tying `projects` to a site through
/// `content_sites`. Uses the first registered project entity_type + the
/// default environment seeded by the onboarding migration.
async fn insert_minimal_content(pool: &PgPool) -> Uuid {
    let content_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO contents (id, entity_type_id, environment_id, status)
        SELECT $1,
               (SELECT id FROM entity_types WHERE name = 'project' LIMIT 1),
               (SELECT id FROM environments ORDER BY created_at LIMIT 1),
               'draft'
        "#,
    )
    .bind(content_id)
    .execute(pool)
    .await
    .expect("insert content");
    content_id
}

async fn link_content_to_site(
    pool: &PgPool,
    content_id: Uuid,
    site_id: Uuid,
    site_specific_slug: Option<&str>,
) -> sqlx::Result<sqlx::postgres::PgQueryResult> {
    sqlx::query(
        r#"
        INSERT INTO content_sites (content_id, site_id, is_owner, site_specific_slug)
        VALUES ($1, $2, TRUE, $3)
        "#,
    )
    .bind(content_id)
    .bind(site_id)
    .bind(site_specific_slug)
    .execute(pool)
    .await
}

async fn insert_skill(pool: &PgPool, slug: &str) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO skills (id, name, slug) VALUES ($1, $2, $3)")
        .bind(id)
        .bind(format!("Skill {slug}"))
        .bind(slug)
        .execute(pool)
        .await
        .expect("insert skill");
    id
}

async fn link_skill_to_site(
    pool: &PgPool,
    skill_id: Uuid,
    site_id: Uuid,
    site_specific_slug: Option<&str>,
) -> sqlx::Result<sqlx::postgres::PgQueryResult> {
    sqlx::query(
        r#"
        INSERT INTO skill_sites (skill_id, site_id, is_owner, site_specific_slug)
        VALUES ($1, $2, TRUE, $3)
        "#,
    )
    .bind(skill_id)
    .bind(site_id)
    .bind(site_specific_slug)
    .execute(pool)
    .await
}

// ---------------------------------------------------------------------------
// 1. The original reproduction: two tenants seeding overlapping slugs
// ---------------------------------------------------------------------------

#[tokio::test]
#[serial]
async fn two_sites_can_have_projects_with_same_slug() {
    let pool = test_db_pool().await;
    let site_a = create_test_site(&pool).await;
    let site_b = create_test_site(&pool).await;

    let content_a = insert_minimal_content(&pool).await;
    let content_b = insert_minimal_content(&pool).await;

    sqlx::query("INSERT INTO projects (content_id, slug) VALUES ($1, $2)")
        .bind(content_a)
        .bind("forja-cms")
        .execute(&pool)
        .await
        .expect("project A insert");

    sqlx::query("INSERT INTO projects (content_id, slug) VALUES ($1, $2)")
        .bind(content_b)
        .bind("forja-cms")
        .execute(&pool)
        .await
        .expect("project B with overlapping slug must succeed after #762");

    link_content_to_site(&pool, content_a, site_a, None)
        .await
        .expect("link A");
    link_content_to_site(&pool, content_b, site_b, None)
        .await
        .expect("link B — different site");
}

#[tokio::test]
#[serial]
async fn two_sites_can_have_skills_with_same_slug() {
    let pool = test_db_pool().await;
    let site_a = create_test_site(&pool).await;
    let site_b = create_test_site(&pool).await;

    let suffix = &Uuid::new_v4().to_string()[..8];
    let slug = format!("typescript-{suffix}");

    let skill_a = insert_skill(&pool, &slug).await;
    let skill_b = insert_skill(&pool, &slug).await;

    link_skill_to_site(&pool, skill_a, site_a, None)
        .await
        .expect("skill A linked to site A");
    link_skill_to_site(&pool, skill_b, site_b, None)
        .await
        .expect("skill B linked to site B — same slug must coexist after #762");
}

// ---------------------------------------------------------------------------
// 2. Join-table partial UNIQUE actually enforces per-site uniqueness when
//    the app populates site_specific_slug
// ---------------------------------------------------------------------------

#[tokio::test]
#[serial]
async fn content_sites_rejects_duplicate_site_specific_slug_within_site() {
    let pool = test_db_pool().await;
    let site_a = create_test_site(&pool).await;

    let content_1 = insert_minimal_content(&pool).await;
    let content_2 = insert_minimal_content(&pool).await;

    link_content_to_site(&pool, content_1, site_a, Some("portfolio"))
        .await
        .expect("first link with site_specific_slug succeeds");

    let err = link_content_to_site(&pool, content_2, site_a, Some("portfolio"))
        .await
        .expect_err("second link with same (site_id, site_specific_slug) must fail");
    let msg = err.to_string();
    assert!(
        msg.contains("duplicate") || msg.contains("unique"),
        "expected unique violation, got: {msg}"
    );
}

#[tokio::test]
#[serial]
async fn skill_sites_rejects_duplicate_site_specific_slug_within_site() {
    let pool = test_db_pool().await;
    let site_a = create_test_site(&pool).await;

    let suffix = &Uuid::new_v4().to_string()[..8];
    let skill_1 = insert_skill(&pool, &format!("a-{suffix}")).await;
    let skill_2 = insert_skill(&pool, &format!("b-{suffix}")).await;

    link_skill_to_site(&pool, skill_1, site_a, Some("rust"))
        .await
        .expect("first skill_sites with site_specific_slug succeeds");

    let err = link_skill_to_site(&pool, skill_2, site_a, Some("rust"))
        .await
        .expect_err("second link with same (site_id, site_specific_slug) must fail");
    let msg = err.to_string();
    assert!(
        msg.contains("duplicate") || msg.contains("unique"),
        "expected unique violation, got: {msg}"
    );
}

// ---------------------------------------------------------------------------
// 3. Smoke: the partial indexes the migration introduced are actually present
// ---------------------------------------------------------------------------

#[tokio::test]
#[serial]
async fn site_scoped_slug_indexes_exist_on_all_four_join_tables() {
    let pool = test_db_pool().await;

    let expected = [
        ("content_sites", "idx_content_sites_site_slug"),
        ("skill_sites", "idx_skill_sites_site_slug"),
        ("tag_sites", "idx_tag_sites_site_slug"),
        ("category_sites", "idx_category_sites_site_slug"),
    ];

    for (table, index) in expected {
        let row: Option<(String,)> = sqlx::query_as(
            r#"
            SELECT indexdef
              FROM pg_indexes
             WHERE tablename = $1
               AND indexname = $2
            "#,
        )
        .bind(table)
        .bind(index)
        .fetch_optional(&pool)
        .await
        .expect("query pg_indexes");

        let def = row
            .unwrap_or_else(|| panic!("missing index {index} on {table}"))
            .0;
        assert!(
            def.contains("UNIQUE") && def.contains("site_id") && def.contains("site_specific_slug"),
            "{index} should be UNIQUE on (site_id, site_specific_slug); got: {def}"
        );
    }
}

#[tokio::test]
#[serial]
async fn old_global_slug_constraints_are_gone() {
    let pool = test_db_pool().await;

    // skills_slug_key, tags_slug_key, categories_parent_id_slug_key
    let dropped_constraints = [
        ("skills", "skills_slug_key"),
        ("tags", "tags_slug_key"),
        ("categories", "categories_parent_id_slug_key"),
    ];
    for (table, constraint) in dropped_constraints {
        let exists: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS (
                SELECT 1 FROM pg_constraint c
                  JOIN pg_class t ON c.conrelid = t.oid
                 WHERE t.relname = $1
                   AND c.conname = $2
            )
            "#,
        )
        .bind(table)
        .bind(constraint)
        .fetch_one(&pool)
        .await
        .expect("query pg_constraint");
        assert!(!exists, "{constraint} on {table} should have been dropped");
    }

    // idx_projects_slug (was a UNIQUE index, not a named constraint)
    let proj_idx_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_projects_slug')",
    )
    .fetch_one(&pool)
    .await
    .expect("query pg_indexes");
    assert!(
        !proj_idx_exists,
        "idx_projects_slug should have been dropped"
    );
}
