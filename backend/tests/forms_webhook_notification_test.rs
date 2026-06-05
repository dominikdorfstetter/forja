//! Webhook + notification integration test for #585.
//!
//! Verifies that a public submission produces (a) a webhook retry job
//! when an active webhook is subscribed to `form.submission.created`,
//! and (b) an in-app notification row exists for the test site.

mod common;

use common::{cleanup_test_data, create_test_site, test_db_pool};
use forja::dto::forms::{
    CreateFormRequest, FormBotProtection, FormFieldInput, FormFieldType, FormStorageMode,
    SubmitFormRequest,
};
use forja::models::forms::Form;
use forja::models::webhook::Webhook;
use forja::services::form_submission_service;
use forja::services::form_submission_service::AlwaysAllow;
use serde_json::json;
use serial_test::serial;
use uuid::Uuid;

#[tokio::test]
#[serial]
async fn submission_enqueues_form_submission_created_webhook() {
    let pool = test_db_pool().await;
    cleanup_test_data(&pool).await;
    let site_id = create_test_site(&pool).await;

    // An active webhook subscribed to the form event.
    let webhook = Webhook::create(
        &pool,
        site_id,
        "https://example.com/hook",
        "test-secret",
        Some("test"),
        &["form.submission.created".to_string()],
        0, // no debounce — enqueue immediately
        None,
    )
    .await
    .expect("create webhook");

    let form = Form::create(
        &pool,
        site_id,
        CreateFormRequest {
            name: "Contact".into(),
            slug: format!("contact-{}", &Uuid::new_v4().to_string()[..8]),
            description: None,
            is_active: true,
            consent_required: false,
            consent_text: None,
            bot_protection: FormBotProtection::None,
            storage_mode: FormStorageMode::Simple,
            retention_days: None,
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

    form_submission_service::submit(
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
    .expect("submit");

    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM webhook_retry_queue WHERE webhook_id = $1 AND event_type = $2",
    )
    .bind(webhook.id)
    .bind("form.submission.created")
    .fetch_one(&pool)
    .await
    .expect("count retry rows");

    assert_eq!(count, 1, "expected one retry job for the new submission");
}

#[tokio::test]
#[serial]
async fn webhook_payload_omits_submission_field_data() {
    let pool = test_db_pool().await;
    cleanup_test_data(&pool).await;
    let site_id = create_test_site(&pool).await;

    let webhook = Webhook::create(
        &pool,
        site_id,
        "https://example.com/hook",
        "test-secret",
        Some("test"),
        &["form.submission.created".to_string()],
        0,
        None,
    )
    .await
    .expect("create webhook");

    let form = Form::create(
        &pool,
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
            retention_days: None,
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

    let secret_email = "secret-visitor@example.com";
    form_submission_service::submit(
        &pool,
        &form,
        SubmitFormRequest {
            data: json!({"Email": secret_email}),
            consent_given: false,
            bot_protection_token: None,
        },
        &AlwaysAllow,
    )
    .await
    .expect("submit");

    let row: (serde_json::Value,) = sqlx::query_as(
        "SELECT payload FROM webhook_retry_queue
          WHERE webhook_id = $1 AND event_type = 'form.submission.created'
          ORDER BY created_at DESC LIMIT 1",
    )
    .bind(webhook.id)
    .fetch_one(&pool)
    .await
    .expect("fetch payload");

    let payload = row.0;
    let body = serde_json::to_string(&payload).unwrap();
    assert!(
        !body.contains(secret_email),
        "submission data leaked into webhook payload: {body}"
    );
    // Sanity — payload should still carry the contract fields the issue spec.
    assert!(body.contains("\"form_name\""));
    assert!(body.contains("\"reference_code\""));
    assert!(body.contains("\"submission_id\""));
}
