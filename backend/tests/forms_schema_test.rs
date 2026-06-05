//! Schema-level tests for the Forms module (#580).
//!
//! These tests hit the database directly via raw SQL — they're proving the
//! migration creates the right tables, columns, constraints and indexes
//! before any Rust models are written on top.

mod common;

use common::{cleanup_test_data, create_test_site, test_db_pool};
use serde_json::json;
use serial_test::serial;
use sqlx::Row;
use uuid::Uuid;

#[tokio::test]
#[serial]
async fn tracer_forms_schema_round_trip() {
    let pool = test_db_pool().await;
    cleanup_test_data(&pool).await;
    let site_id = create_test_site(&pool).await;

    // 1. Insert a form
    let form_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO forms
            (id, site_id, name, slug, description, is_active,
             consent_required, consent_text, bot_protection, storage_mode, retention_days)
        VALUES ($1, $2, $3, $4, $5, TRUE, FALSE, NULL, 'none', 'simple', NULL)
        "#,
    )
    .bind(form_id)
    .bind(site_id)
    .bind("Contact")
    .bind("contact")
    .bind("A contact form")
    .execute(&pool)
    .await
    .expect("insert form");

    // 2. Insert a field
    let field_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO form_fields
            (id, form_id, label, field_type, placeholder, help_text,
             validation, options, is_required, display_order)
        VALUES ($1, $2, $3, 'email', NULL, NULL, $4, NULL, TRUE, 0)
        "#,
    )
    .bind(field_id)
    .bind(form_id)
    .bind("Email")
    .bind(json!({"required": true}))
    .execute(&pool)
    .await
    .expect("insert field");

    // 3. Insert a submission
    let submission_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO form_submissions
            (id, form_id, reference_code, data, consent_given,
             consent_text_at_submission, bot_protection_token, status)
        VALUES ($1, $2, $3, $4, FALSE, NULL, NULL, 'new')
        "#,
    )
    .bind(submission_id)
    .bind(form_id)
    .bind("AAAA-BBBB-CCCC")
    .bind(json!({"email": "test@example.com"}))
    .execute(&pool)
    .await
    .expect("insert submission");

    // 4. Insert a submission note
    sqlx::query(
        r#"
        INSERT INTO submission_notes (id, submission_id, author_id, body)
        VALUES ($1, $2, NULL, $3)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(submission_id)
    .bind("first note")
    .execute(&pool)
    .await
    .expect("insert note");

    // 5. Insert a status log entry
    sqlx::query(
        r#"
        INSERT INTO form_submission_status_log
            (id, submission_id, from_status, to_status, changed_by)
        VALUES ($1, $2, 'new', 'in_review', NULL)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(submission_id)
    .execute(&pool)
    .await
    .expect("insert status log");

    // 6. Read submission back
    let row = sqlx::query("SELECT reference_code, data FROM form_submissions WHERE id = $1")
        .bind(submission_id)
        .fetch_one(&pool)
        .await
        .expect("fetch submission");
    let code: String = row.get("reference_code");
    let data: serde_json::Value = row.get("data");
    assert_eq!(code, "AAAA-BBBB-CCCC");
    assert_eq!(data["email"], "test@example.com");

    // 7. Cascade delete: removing the form should remove fields, submissions, notes, log entries
    sqlx::query("DELETE FROM forms WHERE id = $1")
        .bind(form_id)
        .execute(&pool)
        .await
        .expect("delete form");

    let remaining_subs: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM form_submissions WHERE form_id = $1")
            .bind(form_id)
            .fetch_one(&pool)
            .await
            .expect("count submissions");
    assert_eq!(remaining_subs, 0, "submissions should cascade-delete");
}

#[tokio::test]
#[serial]
async fn reference_code_unique_constraint() {
    let pool = test_db_pool().await;
    cleanup_test_data(&pool).await;
    let site_id = create_test_site(&pool).await;

    let form_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO forms (id, site_id, name, slug, is_active,
                           consent_required, bot_protection, storage_mode)
        VALUES ($1, $2, 'F', 'f-unique', TRUE, FALSE, 'none', 'simple')
        "#,
    )
    .bind(form_id)
    .bind(site_id)
    .execute(&pool)
    .await
    .expect("insert form");

    let insert_sub = |code: String| {
        let pool = pool.clone();
        async move {
            sqlx::query(
                r#"
                INSERT INTO form_submissions
                    (id, form_id, reference_code, data, consent_given, status)
                VALUES ($1, $2, $3, '{}'::jsonb, FALSE, 'new')
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(form_id)
            .bind(code)
            .execute(&pool)
            .await
        }
    };

    // Per-run unique code so the test is self-contained against the shared
    // forja_test DB — the reference_code index is global, so a fixed literal
    // would collide with a prior run's leftover row.
    let code = format!("REF-{}", Uuid::new_v4());
    insert_sub(code.clone()).await.expect("first insert");
    let err = insert_sub(code)
        .await
        .expect_err("second insert with same reference_code should fail");
    let msg = err.to_string();
    assert!(
        msg.contains("duplicate") || msg.contains("unique"),
        "expected unique violation, got: {msg}"
    );
}

#[tokio::test]
#[serial]
async fn form_submissions_data_has_gin_index() {
    let pool = test_db_pool().await;

    let row: Option<(String,)> = sqlx::query_as(
        r#"
        SELECT indexname FROM pg_indexes
         WHERE tablename = 'form_submissions'
           AND indexdef LIKE '%USING gin%'
           AND indexdef LIKE '%data%'
         LIMIT 1
        "#,
    )
    .fetch_optional(&pool)
    .await
    .expect("query pg_indexes");

    assert!(
        row.is_some(),
        "expected a GIN index on form_submissions.data"
    );
}

#[tokio::test]
#[serial]
async fn form_submission_status_enum_exists() {
    let pool = test_db_pool().await;

    let labels: Vec<(String,)> = sqlx::query_as(
        r#"
        SELECT enumlabel::text
          FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
         WHERE t.typname = 'form_submission_status'
         ORDER BY e.enumsortorder
        "#,
    )
    .fetch_all(&pool)
    .await
    .expect("query enum");

    let labels: Vec<String> = labels.into_iter().map(|(s,)| s).collect();

    // Order-insensitive superset check (#841): every variant the application
    // relies on must exist, but additive migrations that append new variants
    // (e.g. `ALTER TYPE ... ADD VALUE 'rejected'`, migration 065) must not break
    // this test spuriously. A removed variant still fails it.
    for required in ["new", "in_review", "resolved", "archived", "rejected"] {
        assert!(
            labels.iter().any(|l| l == required),
            "form_submission_status enum is missing '{required}'; found {labels:?}"
        );
    }
}
