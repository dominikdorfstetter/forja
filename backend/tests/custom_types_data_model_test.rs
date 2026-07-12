//! #790 — Custom types data model + migration.
//!
//! These tests prove the storage spine round-trips: a site-scoped entity type,
//! a custom type with fields covering all seven field kinds, a `contents` row
//! of that entity type, and shared + localized JSONB values — all readable back
//! via SQL. They also lock the schema invariants the rest of the epic relies on
//! (per-type unique field keys, NULL retention = keep-forever, at-most-one
//! title field). The repository/API layers arrive in #791/#792/#793.

mod common;

use serde_json::json;
use sqlx::Row;
use uuid::Uuid;

/// Insert a site-scoped entity type (mirrors what the schema-builder API will
/// do in #791) and return its id.
async fn insert_site_entity_type(pool: &sqlx::PgPool, site_id: Uuid, name: &str) -> Uuid {
    sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO entity_types (name, table_name, site_id, is_versionable, is_localizable, is_site_specific)
         VALUES ($1, 'custom_entry_values', $2, TRUE, TRUE, TRUE)
         RETURNING id",
    )
    .bind(name)
    .bind(site_id)
    .fetch_one(pool)
    .await
    .expect("insert site entity_type")
}

async fn default_environment_id(pool: &sqlx::PgPool) -> Uuid {
    sqlx::query_scalar::<_, Uuid>("SELECT id FROM environments WHERE is_default = TRUE LIMIT 1")
        .fetch_one(pool)
        .await
        .expect("default environment seeded")
}

async fn any_locale_id(pool: &sqlx::PgPool) -> Uuid {
    sqlx::query_scalar::<_, Uuid>("SELECT id FROM locales ORDER BY code LIMIT 1")
        .fetch_one(pool)
        .await
        .expect("locales seeded")
}

#[tokio::test]
async fn tracer_custom_type_entry_round_trips_shared_and_localized_values() {
    let pool = common::test_db_pool().await;
    let site_id = common::create_test_site(&pool).await;

    // 1. Register the entity type + custom type ("Recipe").
    let entity_type_id = insert_site_entity_type(&pool, site_id, "recipe").await;
    let custom_type_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO custom_types (entity_type_id, site_id, key, name, retention_days)
         VALUES ($1, $2, 'recipe', 'Recipe', NULL) RETURNING id",
    )
    .bind(entity_type_id)
    .bind(site_id)
    .fetch_one(&pool)
    .await
    .expect("insert custom_type");

    // 2. Fields: a designated-title shared text, a localized text, a number.
    sqlx::query(
        "INSERT INTO custom_type_fields
            (custom_type_id, key, label, field_type, required, localized, is_title, display_order)
         VALUES
            ($1, 'name',        'Name',        'text',   TRUE,  FALSE, TRUE,  0),
            ($1, 'description', 'Description', 'text',   FALSE, TRUE,  FALSE, 1),
            ($1, 'servings',    'Servings',    'number', FALSE, FALSE, FALSE, 2)",
    )
    .bind(custom_type_id)
    .execute(&pool)
    .await
    .expect("insert fields");

    // 3. A `contents` row of the custom entity type makes the entry first-class.
    let env_id = default_environment_id(&pool).await;
    let content_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO contents (entity_type_id, environment_id, slug, status)
         VALUES ($1, $2, 'spaghetti', 'draft') RETURNING id",
    )
    .bind(entity_type_id)
    .bind(env_id)
    .fetch_one(&pool)
    .await
    .expect("insert contents row");

    // 4. Shared values + one localized row.
    let locale_id = any_locale_id(&pool).await;
    sqlx::query("INSERT INTO custom_entry_values (content_id, data) VALUES ($1, $2)")
        .bind(content_id)
        .bind(json!({ "servings": 4 }))
        .execute(&pool)
        .await
        .expect("insert shared values");
    sqlx::query(
        "INSERT INTO custom_entry_localizations (content_id, locale_id, data) VALUES ($1, $2, $3)",
    )
    .bind(content_id)
    .bind(locale_id)
    .bind(json!({ "description": "A simple pasta dish" }))
    .execute(&pool)
    .await
    .expect("insert localized values");

    // 5. Round-trip read: join contents → values → localizations.
    let row = sqlx::query(
        "SELECT c.slug,
                v.data AS shared,
                l.data AS localized
           FROM contents c
           JOIN custom_entry_values v ON v.content_id = c.id
           JOIN custom_entry_localizations l ON l.content_id = c.id
          WHERE c.id = $1",
    )
    .bind(content_id)
    .fetch_one(&pool)
    .await
    .expect("round-trip read");

    let slug: String = row.get("slug");
    let shared: serde_json::Value = row.get("shared");
    let localized: serde_json::Value = row.get("localized");

    assert_eq!(slug, "spaghetti");
    assert_eq!(shared["servings"], json!(4));
    assert_eq!(localized["description"], json!("A simple pasta dish"));
}

#[tokio::test]
async fn all_seven_field_types_are_representable() {
    let pool = common::test_db_pool().await;
    let site_id = common::create_test_site(&pool).await;
    let entity_type_id = insert_site_entity_type(&pool, site_id, "kitchen_sink").await;
    let custom_type_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO custom_types (entity_type_id, site_id, key, name)
         VALUES ($1, $2, 'kitchen_sink', 'Kitchen Sink') RETURNING id",
    )
    .bind(entity_type_id)
    .bind(site_id)
    .fetch_one(&pool)
    .await
    .expect("insert custom_type");

    // One field per kind. `enum` carries enum_options; `flavour` is PII with a
    // full compliance contract.
    sqlx::query(
        "INSERT INTO custom_type_fields
            (custom_type_id, key, label, field_type, enum_options, is_pii,
             data_category, processing_purpose, legal_basis, is_title, display_order)
         VALUES
            ($1, 'f_text',    'T', 'text',     NULL, FALSE, NULL, NULL, NULL, TRUE,  0),
            ($1, 'f_rich',    'R', 'richtext', NULL, FALSE, NULL, NULL, NULL, FALSE, 1),
            ($1, 'f_num',     'N', 'number',   NULL, FALSE, NULL, NULL, NULL, FALSE, 2),
            ($1, 'f_bool',    'B', 'boolean',  NULL, FALSE, NULL, NULL, NULL, FALSE, 3),
            ($1, 'f_date',    'D', 'date',     NULL, FALSE, NULL, NULL, NULL, FALSE, 4),
            ($1, 'f_enum',    'E', 'enum',     $2,   FALSE, NULL, NULL, NULL, FALSE, 5),
            ($1, 'f_media',   'M', 'media',    NULL, FALSE, NULL, NULL, NULL, FALSE, 6),
            ($1, 'f_contact', 'C', 'text',     NULL, TRUE,  'contact', 'newsletter', 'consent', FALSE, 7)",
    )
    .bind(custom_type_id)
    .bind(json!(["spicy", "mild"]))
    .execute(&pool)
    .await
    .expect("insert all field kinds");

    let kinds: Vec<String> = sqlx::query_scalar(
        "SELECT field_type::text FROM custom_type_fields
          WHERE custom_type_id = $1 ORDER BY display_order",
    )
    .bind(custom_type_id)
    .fetch_all(&pool)
    .await
    .expect("read field kinds");

    assert_eq!(
        kinds,
        vec![
            "text", "richtext", "number", "boolean", "date", "enum", "media", "text"
        ]
    );

    // The enum field kept its options; the PII field kept its legal basis.
    let enum_opts: serde_json::Value = sqlx::query_scalar(
        "SELECT enum_options FROM custom_type_fields WHERE custom_type_id=$1 AND key='f_enum'",
    )
    .bind(custom_type_id)
    .fetch_one(&pool)
    .await
    .expect("read enum options");
    assert_eq!(enum_opts, json!(["spicy", "mild"]));

    let legal_basis: Option<String> = sqlx::query_scalar(
        "SELECT legal_basis FROM custom_type_fields WHERE custom_type_id=$1 AND key='f_contact'",
    )
    .bind(custom_type_id)
    .fetch_one(&pool)
    .await
    .expect("read legal basis");
    assert_eq!(legal_basis.as_deref(), Some("consent"));
}

#[tokio::test]
async fn duplicate_field_key_in_one_type_is_rejected() {
    let pool = common::test_db_pool().await;
    let site_id = common::create_test_site(&pool).await;
    let entity_type_id = insert_site_entity_type(&pool, site_id, "dupes").await;
    let custom_type_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO custom_types (entity_type_id, site_id, key, name)
         VALUES ($1, $2, 'dupes', 'Dupes') RETURNING id",
    )
    .bind(entity_type_id)
    .bind(site_id)
    .fetch_one(&pool)
    .await
    .expect("insert custom_type");

    sqlx::query(
        "INSERT INTO custom_type_fields (custom_type_id, key, label, field_type, is_title)
         VALUES ($1, 'title', 'Title', 'text', TRUE)",
    )
    .bind(custom_type_id)
    .execute(&pool)
    .await
    .expect("first field inserts");

    let err = sqlx::query(
        "INSERT INTO custom_type_fields (custom_type_id, key, label, field_type)
         VALUES ($1, 'title', 'Title Again', 'text')",
    )
    .bind(custom_type_id)
    .execute(&pool)
    .await
    .expect_err("duplicate (custom_type_id, key) must violate UNIQUE");

    let db_err = err.as_database_error().expect("a database error");
    assert!(
        db_err.is_unique_violation(),
        "expected unique violation, got: {db_err}"
    );
}

#[tokio::test]
async fn at_most_one_title_field_per_type() {
    let pool = common::test_db_pool().await;
    let site_id = common::create_test_site(&pool).await;
    let entity_type_id = insert_site_entity_type(&pool, site_id, "titles").await;
    let custom_type_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO custom_types (entity_type_id, site_id, key, name)
         VALUES ($1, $2, 'titles', 'Titles') RETURNING id",
    )
    .bind(entity_type_id)
    .bind(site_id)
    .fetch_one(&pool)
    .await
    .expect("insert custom_type");

    sqlx::query(
        "INSERT INTO custom_type_fields (custom_type_id, key, label, field_type, is_title)
         VALUES ($1, 'a', 'A', 'text', TRUE)",
    )
    .bind(custom_type_id)
    .execute(&pool)
    .await
    .expect("first title field inserts");

    let err = sqlx::query(
        "INSERT INTO custom_type_fields (custom_type_id, key, label, field_type, is_title)
         VALUES ($1, 'b', 'B', 'text', TRUE)",
    )
    .bind(custom_type_id)
    .execute(&pool)
    .await
    .expect_err("a second is_title field must violate the partial unique index");

    assert!(err.as_database_error().unwrap().is_unique_violation());
}

#[tokio::test]
async fn null_retention_days_is_keep_forever() {
    let pool = common::test_db_pool().await;
    let site_id = common::create_test_site(&pool).await;
    let entity_type_id = insert_site_entity_type(&pool, site_id, "evergreen").await;

    // NULL retention is accepted and read back as None (keep forever).
    let retention: Option<i32> = sqlx::query_scalar(
        "INSERT INTO custom_types (entity_type_id, site_id, key, name, retention_days)
         VALUES ($1, $2, 'evergreen', 'Evergreen', NULL) RETURNING retention_days",
    )
    .bind(entity_type_id)
    .bind(site_id)
    .fetch_one(&pool)
    .await
    .expect("insert with NULL retention");

    assert_eq!(retention, None);
}
