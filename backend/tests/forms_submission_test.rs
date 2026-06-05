//! Public form-submission integration tests (#582).

mod common;

use common::{cleanup_test_data, create_test_site, test_db_pool};
use forja::dto::forms::{
    CreateFormRequest, FormBotProtection, FormFieldInput, FormFieldType, FormStorageMode,
    SubmitFormRequest,
};
use forja::models::forms::Form;
use forja::services::form_submission_service;
use forja::services::form_submission_service::{AlwaysAllow, AlwaysReject};
use forja::utils::reference_code;
use serde_json::json;
use serial_test::serial;

fn email_field(label: &str, required: bool) -> FormFieldInput {
    FormFieldInput {
        label: label.into(),
        field_type: FormFieldType::Email,
        placeholder: None,
        help_text: None,
        validation: json!({}),
        options: None,
        is_required: required,
        display_order: 0,
        localizations: vec![],
    }
}

async fn make_contact_form(
    pool: &sqlx::PgPool,
    site_id: uuid::Uuid,
    consent_required: bool,
    bot_protection: FormBotProtection,
) -> forja::dto::forms::FormDetailResponse {
    Form::create(
        pool,
        site_id,
        CreateFormRequest {
            name: "Contact".into(),
            slug: format!("contact-{}", &uuid::Uuid::new_v4().to_string()[..8]),
            description: None,
            is_active: true,
            consent_required,
            consent_text: if consent_required {
                Some("I agree".into())
            } else {
                None
            },
            bot_protection,
            storage_mode: FormStorageMode::Simple,
            retention_days: None,
            fields: vec![email_field("Email", true)],
            template_id: None,
            localizations: vec![],
        },
    )
    .await
    .expect("create form")
}

#[tokio::test]
#[serial]
async fn tracer_submit_form_returns_reference_code() {
    let pool = test_db_pool().await;
    cleanup_test_data(&pool).await;
    let site_id = create_test_site(&pool).await;

    let form = make_contact_form(&pool, site_id, false, FormBotProtection::None).await;

    let (sub_id, code) = form_submission_service::submit(
        &pool,
        &form,
        SubmitFormRequest {
            data: json!({"Email": "visitor@example.com"}),
            consent_given: false,
            bot_protection_token: None,
        },
        &AlwaysAllow,
    )
    .await
    .expect("submit");

    assert!(reference_code::is_well_formed(&code), "got: {code}");
    assert!(!sub_id.is_nil());

    // Look up the row directly to assert payload + status defaults.
    let row: (String, String, serde_json::Value) = sqlx::query_as(
        "SELECT status::text, reference_code, data FROM form_submissions WHERE id = $1",
    )
    .bind(sub_id)
    .fetch_one(&pool)
    .await
    .expect("row");
    assert_eq!(row.0, "new");
    assert_eq!(row.1, code);
    assert_eq!(row.2["Email"], "visitor@example.com");
}

#[tokio::test]
#[serial]
async fn invalid_email_rejected_with_field_error() {
    let pool = test_db_pool().await;
    cleanup_test_data(&pool).await;
    let site_id = create_test_site(&pool).await;

    let form = make_contact_form(&pool, site_id, false, FormBotProtection::None).await;
    let err = form_submission_service::submit(
        &pool,
        &form,
        SubmitFormRequest {
            data: json!({"Email": "notanemail"}),
            consent_given: false,
            bot_protection_token: None,
        },
        &AlwaysAllow,
    )
    .await
    .expect_err("validation should fail");
    let msg = err.to_string().to_lowercase();
    assert!(msg.contains("validation"), "got: {msg}");
}

#[tokio::test]
#[serial]
async fn consent_required_form_rejects_unchecked_submission() {
    let pool = test_db_pool().await;
    cleanup_test_data(&pool).await;
    let site_id = create_test_site(&pool).await;

    let form = make_contact_form(&pool, site_id, true, FormBotProtection::None).await;

    let err = form_submission_service::submit(
        &pool,
        &form,
        SubmitFormRequest {
            data: json!({"Email": "v@example.com"}),
            consent_given: false,
            bot_protection_token: None,
        },
        &AlwaysAllow,
    )
    .await
    .expect_err("consent should be required");
    assert!(
        err.to_string().to_lowercase().contains("consent"),
        "got: {err}"
    );

    // With consent_given=true the submission succeeds and consent_text is recorded.
    let (sub_id, _) = form_submission_service::submit(
        &pool,
        &form,
        SubmitFormRequest {
            data: json!({"Email": "v@example.com"}),
            consent_given: true,
            bot_protection_token: None,
        },
        &AlwaysAllow,
    )
    .await
    .expect("with consent");
    let consent_text: Option<String> =
        sqlx::query_scalar("SELECT consent_text_at_submission FROM form_submissions WHERE id = $1")
            .bind(sub_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(consent_text.as_deref(), Some("I agree"));
}

#[tokio::test]
#[serial]
async fn bot_protection_seam_short_circuits_when_check_rejects() {
    // Slice 3 behaviour: when the form is Mandatory-protected and the
    // BotProtectionCheck returns an error, the service surfaces it before
    // touching the database — no row inserted, no webhook dispatched.
    let pool = test_db_pool().await;
    cleanup_test_data(&pool).await;
    let site_id = create_test_site(&pool).await;

    let form = make_contact_form(&pool, site_id, false, FormBotProtection::Mandatory).await;

    let err = form_submission_service::submit(
        &pool,
        &form,
        SubmitFormRequest {
            data: json!({"Email": "v@example.com"}),
            consent_given: false,
            bot_protection_token: Some("looks-real".into()),
        },
        &AlwaysReject,
    )
    .await
    .expect_err("AlwaysReject should reject");
    assert!(
        err.to_string().to_lowercase().contains("bot protection"),
        "got: {err}"
    );

    // No row persisted.
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM form_submissions WHERE form_id = $1")
        .bind(form.id)
        .fetch_one(&pool)
        .await
        .expect("count");
    assert_eq!(count, 0, "rejected submissions must not be persisted");

    // Sanity: with AlwaysAllow the same payload succeeds — proves the gate is
    // the check, not some other side-effect of Mandatory protection.
    form_submission_service::submit(
        &pool,
        &form,
        SubmitFormRequest {
            data: json!({"Email": "v@example.com"}),
            consent_given: false,
            bot_protection_token: Some("looks-real".into()),
        },
        &AlwaysAllow,
    )
    .await
    .expect("with AlwaysAllow");
}

#[tokio::test]
#[serial]
async fn inactive_form_rejects_submissions() {
    let pool = test_db_pool().await;
    cleanup_test_data(&pool).await;
    let site_id = create_test_site(&pool).await;

    let mut form = make_contact_form(&pool, site_id, false, FormBotProtection::None).await;
    form.is_active = false;
    let err = form_submission_service::submit(
        &pool,
        &form,
        SubmitFormRequest {
            data: json!({"Email": "v@example.com"}),
            consent_given: false,
            bot_protection_token: None,
        },
        &AlwaysAllow,
    )
    .await
    .expect_err("inactive form should reject");
    assert!(
        err.to_string().to_lowercase().contains("not accepting"),
        "got: {err}"
    );
}
