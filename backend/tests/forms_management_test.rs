//! Submission management + GDPR retention worker tests (#583).

mod common;

use common::{cleanup_test_data, create_test_site, test_db_pool};
use forja::dto::forms::{
    CreateFormRequest, CreateSubmissionNoteRequest, FormBotProtection, FormFieldInput,
    FormFieldType, FormStorageMode, FormSubmissionStatus, SubmitFormRequest,
};
use forja::models::forms::Form;
use forja::repos::form_submission_repo;
use forja::services::form_submission_service;
use forja::services::form_submission_service::AlwaysAllow;
use forja::services::forms_retention_cleanup;
use forja::utils::list_params::ListParams;
use serde_json::json;
use serial_test::serial;
use uuid::Uuid;

async fn seed_form_and_submission(
    pool: &sqlx::PgPool,
    retention_days: Option<i32>,
) -> (Uuid, Uuid, String) {
    cleanup_test_data(pool).await;
    let site_id = create_test_site(pool).await;
    let form = Form::create(
        pool,
        site_id,
        CreateFormRequest {
            name: "Contact".into(),
            slug: format!("c-{}", &Uuid::new_v4().to_string()[..8]),
            description: None,
            is_active: true,
            consent_required: false,
            consent_text: None,
            bot_protection: FormBotProtection::None,
            storage_mode: FormStorageMode::Simple,
            retention_days,
            fields: vec![FormFieldInput {
                label: "Email".into(),
                field_type: FormFieldType::Email,
                placeholder: None,
                help_text: None,
                validation: json!({}),
                options: None,
                is_required: true,
                display_order: 0,
                localizations: vec![],
            }],
            template_id: None,
            localizations: vec![],
        },
    )
    .await
    .expect("form");

    let (sub_id, code) = form_submission_service::submit(
        pool,
        &form,
        SubmitFormRequest {
            data: json!({"Email": "v@example.com"}),
            consent_given: false,
            bot_protection_token: None,
        },
        &AlwaysAllow,
    )
    .await
    .expect("submit");
    (form.id, sub_id, code)
}

#[tokio::test]
#[serial]
async fn tracer_status_state_machine_and_history() {
    let pool = test_db_pool().await;
    let (_, sub_id, _) = seed_form_and_submission(&pool, None).await;

    // Initial status is New.
    let detail = form_submission_repo::get_detail(&pool, sub_id)
        .await
        .expect("get");
    assert_eq!(detail.status, FormSubmissionStatus::New);
    assert!(detail.status_history.is_empty());

    // Valid transition New → InReview.
    form_submission_repo::update_status(
        &pool,
        sub_id,
        FormSubmissionStatus::InReview,
        Some("user_1"),
    )
    .await
    .expect("new → in_review");

    // Invalid transition InReview → New rejected.
    let err = form_submission_repo::update_status(&pool, sub_id, FormSubmissionStatus::New, None)
        .await
        .expect_err("backwards transition");
    assert!(err.to_string().to_lowercase().contains("transition"));

    // Valid: InReview → Resolved → Archived
    form_submission_repo::update_status(
        &pool,
        sub_id,
        FormSubmissionStatus::Resolved,
        Some("user_1"),
    )
    .await
    .expect("in_review → resolved");
    form_submission_repo::update_status(
        &pool,
        sub_id,
        FormSubmissionStatus::Archived,
        Some("user_1"),
    )
    .await
    .expect("resolved → archived");

    // History has 3 entries with the right from→to chain.
    let detail = form_submission_repo::get_detail(&pool, sub_id)
        .await
        .expect("get");
    assert_eq!(detail.status, FormSubmissionStatus::Archived);
    assert_eq!(detail.status_history.len(), 3);
    assert_eq!(
        detail.status_history[0].from_status,
        Some(FormSubmissionStatus::New)
    );
    assert_eq!(
        detail.status_history[0].to_status,
        FormSubmissionStatus::InReview
    );
}

/// Submit an extra submission against an already-seeded form, returning its id.
/// Used by tests that need several submissions in distinct states without
/// re-running `seed_form_and_submission` (which wipes the schema each call).
async fn submit_extra(pool: &sqlx::PgPool, form_id: Uuid) -> Uuid {
    let form = Form::find_by_id(pool, form_id).await.expect("find form");
    let (id, _code) = form_submission_service::submit(
        pool,
        &form,
        SubmitFormRequest {
            data: json!({"Email": "extra@example.com"}),
            consent_given: false,
            bot_protection_token: None,
        },
        &AlwaysAllow,
    )
    .await
    .expect("submit extra");
    id
}

#[tokio::test]
#[serial]
async fn rejected_status_and_new_state_machine() {
    let pool = test_db_pool().await;
    let (form_id, new_sub, _) = seed_form_and_submission(&pool, None).await;

    // New → Rejected is now a valid escape for non-follow-through submissions.
    form_submission_repo::update_status(
        &pool,
        new_sub,
        FormSubmissionStatus::Rejected,
        Some("user_1"),
    )
    .await
    .expect("new → rejected");

    // Rejected → Archived files the rejected item away.
    form_submission_repo::update_status(
        &pool,
        new_sub,
        FormSubmissionStatus::Archived,
        Some("user_1"),
    )
    .await
    .expect("rejected → archived");

    // The old direct shortcut New → Archived is no longer allowed; archiving
    // now requires going through Resolved or Rejected first.
    let direct_archive = submit_extra(&pool, form_id).await;
    let err = form_submission_repo::update_status(
        &pool,
        direct_archive,
        FormSubmissionStatus::Archived,
        None,
    )
    .await
    .expect_err("new → archived must be rejected");
    assert!(err.to_string().to_lowercase().contains("transition"));

    // InReview → Archived is likewise gone; InReview → Rejected is allowed.
    let in_review_sub = submit_extra(&pool, form_id).await;
    form_submission_repo::update_status(&pool, in_review_sub, FormSubmissionStatus::InReview, None)
        .await
        .expect("new → in_review");
    form_submission_repo::update_status(&pool, in_review_sub, FormSubmissionStatus::Archived, None)
        .await
        .expect_err("in_review → archived must be rejected");
    form_submission_repo::update_status(&pool, in_review_sub, FormSubmissionStatus::Rejected, None)
        .await
        .expect("in_review → rejected");

    // status_counts surfaces the rejected bucket.
    let counts = form_submission_repo::status_counts(&pool, form_id)
        .await
        .expect("counts");
    assert_eq!(counts.archived, 1, "new_sub ended archived");
    assert_eq!(counts.rejected, 1, "in_review_sub ended rejected");
    assert_eq!(counts.new, 1, "direct_archive stayed new");
}

#[tokio::test]
#[serial]
async fn notes_can_be_added_and_deleted() {
    let pool = test_db_pool().await;
    let (_, sub_id, _) = seed_form_and_submission(&pool, None).await;

    let note = form_submission_repo::add_note(
        &pool,
        sub_id,
        Some("user_1"),
        CreateSubmissionNoteRequest {
            body: "Looks like spam — closed.".into(),
        },
    )
    .await
    .expect("add note");
    assert_eq!(note.author_id.as_deref(), Some("user_1"));
    assert!(note.body.starts_with("Looks like spam"));

    let detail = form_submission_repo::get_detail(&pool, sub_id)
        .await
        .expect("get");
    assert_eq!(detail.notes.len(), 1);

    form_submission_repo::delete_note(&pool, sub_id, note.id)
        .await
        .expect("delete note");
    let detail = form_submission_repo::get_detail(&pool, sub_id)
        .await
        .expect("get");
    assert_eq!(detail.notes.len(), 0);
}

#[tokio::test]
#[serial]
async fn list_filters_by_status() {
    let pool = test_db_pool().await;
    let (form_id, sub_id, _) = seed_form_and_submission(&pool, None).await;
    form_submission_repo::update_status(&pool, sub_id, FormSubmissionStatus::InReview, None)
        .await
        .expect("transition");

    let (rows, total) = form_submission_repo::list_for_form(
        &pool,
        form_id,
        Some(FormSubmissionStatus::InReview),
        &ListParams::new(None, None, None, None, None),
    )
    .await
    .expect("list");
    assert_eq!(total, 1);
    assert_eq!(rows.len(), 1);

    let (_, none_total) = form_submission_repo::list_for_form(
        &pool,
        form_id,
        Some(FormSubmissionStatus::Resolved),
        &ListParams::new(None, None, None, None, None),
    )
    .await
    .expect("list resolved");
    assert_eq!(none_total, 0);

    let counts = form_submission_repo::status_counts(&pool, form_id)
        .await
        .expect("counts");
    assert_eq!(counts.new, 0);
    assert_eq!(counts.in_review, 1);
}

#[tokio::test]
#[serial]
async fn retention_worker_soft_deletes_expired_submissions() {
    let pool = test_db_pool().await;
    let (_, sub_id, _) = seed_form_and_submission(&pool, Some(1)).await;

    // Backdate this submission to "2 days ago" so the 1-day retention window
    // marks it as expired.
    sqlx::query("UPDATE form_submissions SET created_at = NOW() - INTERVAL '2 days' WHERE id = $1")
        .bind(sub_id)
        .execute(&pool)
        .await
        .expect("backdate");

    forms_retention_cleanup::run_once(&pool).await;

    let row: (bool, Option<chrono::DateTime<chrono::Utc>>) =
        sqlx::query_as("SELECT is_deleted, deleted_at FROM form_submissions WHERE id = $1")
            .bind(sub_id)
            .fetch_one(&pool)
            .await
            .expect("fetch");
    assert!(row.0, "expected is_deleted=true after retention run");
    assert!(row.1.is_some(), "expected deleted_at set");
}

#[tokio::test]
#[serial]
async fn retention_worker_skips_forms_with_null_retention() {
    let pool = test_db_pool().await;
    let (_, sub_id, _) = seed_form_and_submission(&pool, None).await;

    sqlx::query(
        "UPDATE form_submissions SET created_at = NOW() - INTERVAL '365 days' WHERE id = $1",
    )
    .bind(sub_id)
    .execute(&pool)
    .await
    .expect("backdate");

    forms_retention_cleanup::run_once(&pool).await;

    let is_deleted: bool =
        sqlx::query_scalar("SELECT is_deleted FROM form_submissions WHERE id = $1")
            .bind(sub_id)
            .fetch_one(&pool)
            .await
            .expect("fetch");
    assert!(!is_deleted, "NULL retention should never auto-delete");
}

#[tokio::test]
#[serial]
async fn retention_worker_skips_forms_with_zero_retention() {
    let pool = test_db_pool().await;
    let (_, sub_id, _) = seed_form_and_submission(&pool, Some(0)).await;

    sqlx::query(
        "UPDATE form_submissions SET created_at = NOW() - INTERVAL '365 days' WHERE id = $1",
    )
    .bind(sub_id)
    .execute(&pool)
    .await
    .expect("backdate");

    forms_retention_cleanup::run_once(&pool).await;

    let is_deleted: bool =
        sqlx::query_scalar("SELECT is_deleted FROM form_submissions WHERE id = $1")
            .bind(sub_id)
            .fetch_one(&pool)
            .await
            .expect("fetch");
    assert!(!is_deleted, "retention_days=0 should never auto-delete");
}
