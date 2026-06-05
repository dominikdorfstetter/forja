//! Integration tests for skill localization exposure on the public
//! API. Issue #737 — consumer ask #1.
//!
//! The `skill_localizations` table existed in the schema since the
//! initial CV migration but was never wired into a read path. These
//! tests exercise the new `SkillRepo::find_localizations_for_skills`
//! bulk fetch and the `localizations[]` field on `SkillResponse`.

mod common;

use serial_test::serial;
use sqlx::PgPool;
use uuid::Uuid;

use forja::dto::cv::CreateSkillRequest;
use forja::models::cv::SkillCategory;
use forja::repos::cv_repo::SkillRepo;

use common::{create_test_site, test_db_pool};

async fn seeded_locale_id(pool: &PgPool, code: &str) -> Uuid {
    sqlx::query_scalar("SELECT id FROM locales WHERE code = $1")
        .bind(code)
        .fetch_one(pool)
        .await
        .expect("locale present from migrations")
}

async fn seed_skill_localization(
    pool: &PgPool,
    skill_id: Uuid,
    locale_id: Uuid,
    display_name: &str,
    description: Option<&str>,
) {
    sqlx::query(
        r#"
        INSERT INTO skill_localizations (skill_id, locale_id, display_name, description)
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(skill_id)
    .bind(locale_id)
    .bind(display_name)
    .bind(description)
    .execute(pool)
    .await
    .expect("insert skill_localization");
}

async fn create_skill(pool: &PgPool, site_id: Uuid, slug: &str) -> Uuid {
    let req = CreateSkillRequest {
        name: format!("Skill {slug}"),
        slug: format!("{slug}-{}", &Uuid::new_v4().to_string()[..8]),
        category: Some(SkillCategory::Programming),
        icon: None,
        proficiency_level: Some(4),
        is_global: false,
        site_ids: vec![site_id],
    };
    SkillRepo::create(pool, req)
        .await
        .expect("SkillRepo::create succeeds")
        .id
}

#[tokio::test]
#[serial]
async fn find_localizations_for_skills_groups_rows_by_skill_id() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    let skill_id = create_skill(&pool, site_id, "rust-loc").await;
    let de = seeded_locale_id(&pool, "de").await;
    let en = seeded_locale_id(&pool, "en").await;

    seed_skill_localization(&pool, skill_id, de, "Rost", Some("Speichersicherheit")).await;
    seed_skill_localization(&pool, skill_id, en, "Rust", None).await;

    let map = SkillRepo::find_localizations_for_skills(&pool, &[skill_id])
        .await
        .expect("bulk fetch succeeds");

    let locs = map.get(&skill_id).expect("skill present in map");
    assert_eq!(locs.len(), 2);

    let de_loc = locs.iter().find(|l| l.locale_id == de).expect("de present");
    assert_eq!(de_loc.display_name, "Rost");
    assert_eq!(de_loc.description.as_deref(), Some("Speichersicherheit"));

    let en_loc = locs.iter().find(|l| l.locale_id == en).expect("en present");
    assert_eq!(en_loc.display_name, "Rust");
    assert!(en_loc.description.is_none());
}

#[tokio::test]
#[serial]
async fn find_localizations_for_skills_with_empty_input_returns_empty_map() {
    let pool = test_db_pool().await;

    let map = SkillRepo::find_localizations_for_skills(&pool, &[])
        .await
        .expect("empty input returns Ok");

    assert!(map.is_empty());
}

#[tokio::test]
#[serial]
async fn find_localizations_for_skills_omits_skill_with_no_rows() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    let with_locs = create_skill(&pool, site_id, "with-locs").await;
    let without_locs = create_skill(&pool, site_id, "without-locs").await;
    let en = seeded_locale_id(&pool, "en").await;
    seed_skill_localization(&pool, with_locs, en, "With Locs", None).await;

    let map = SkillRepo::find_localizations_for_skills(&pool, &[with_locs, without_locs])
        .await
        .expect("bulk fetch succeeds");

    assert!(map.contains_key(&with_locs));
    assert!(
        !map.contains_key(&without_locs),
        "skill with zero localizations should be absent from the map; \
         handlers default to an empty Vec",
    );
}
