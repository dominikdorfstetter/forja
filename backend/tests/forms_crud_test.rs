//! Form + template CRUD model-level tests (#581).

mod common;

use common::{cleanup_test_data, create_test_site, test_db_pool};
use forja::dto::forms::{
    CreateFormRequest, CreateFormTemplateRequest, FormBotProtection, FormFieldInput,
    FormFieldLocalizationInput, FormFieldType, FormLocalizationInput, FormStorageMode,
    UpdateFormRequest,
};
use forja::models::forms::{Form, FormTemplate};
use forja::utils::list_params::ListParams;
use serde_json::json;
use serial_test::serial;

fn email_field(label: &str) -> FormFieldInput {
    FormFieldInput {
        label: label.to_string(),
        field_type: FormFieldType::Email,
        placeholder: Some("you@example.com".into()),
        help_text: None,
        validation: json!({"required": true}),
        options: None,
        is_required: true,
        display_order: 0,
        localizations: vec![],
    }
}

#[tokio::test]
#[serial]
async fn tracer_form_create_update_delete_round_trip() {
    let pool = test_db_pool().await;
    cleanup_test_data(&pool).await;
    let site_id = create_test_site(&pool).await;

    // CREATE
    let req = CreateFormRequest {
        name: "Contact".into(),
        slug: "contact".into(),
        description: Some("Reach us".into()),
        is_active: true,
        consent_required: false,
        consent_text: None,
        bot_protection: FormBotProtection::None,
        storage_mode: FormStorageMode::Simple,
        retention_days: Some(30),
        fields: vec![email_field("Email")],
        template_id: None,
        localizations: vec![],
    };
    let created = Form::create(&pool, site_id, req)
        .await
        .expect("create form");
    assert_eq!(created.fields.len(), 1);
    assert_eq!(created.fields[0].label, "Email");
    assert!(created.is_active);

    // READ by id
    let fetched = Form::find_by_id(&pool, created.id)
        .await
        .expect("find by id");
    assert_eq!(fetched.id, created.id);

    // READ by slug
    let by_slug = Form::find_by_slug(&pool, site_id, "contact")
        .await
        .expect("find by slug");
    assert_eq!(by_slug.id, created.id);

    // UPDATE — replace field set with two fields
    let update = UpdateFormRequest {
        name: Some("Contact Form".into()),
        slug: None,
        description: None,
        is_active: None,
        consent_required: None,
        consent_text: None,
        bot_protection: None,
        storage_mode: None,
        retention_days: None,
        localizations: None,
        fields: Some(vec![
            email_field("Email"),
            FormFieldInput {
                label: "Message".into(),
                field_type: FormFieldType::Textarea,
                placeholder: None,
                help_text: None,
                validation: json!({"required": true, "min_length": 10}),
                options: None,
                is_required: true,
                display_order: 1,
                localizations: vec![],
            },
        ]),
    };
    let updated = Form::update(&pool, created.id, update)
        .await
        .expect("update form");
    assert_eq!(updated.name, "Contact Form");
    assert_eq!(updated.fields.len(), 2);

    // LIST
    let (items, total) = Form::list_for_site(
        &pool,
        site_id,
        &ListParams::new(None, None, None, None, None),
    )
    .await
    .expect("list");
    assert_eq!(total, 1);
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].field_count, 2);
    assert_eq!(items[0].submission_count, 0);

    // DELETE — soft-delete; subsequent find returns not-found
    Form::delete(&pool, created.id).await.expect("delete");
    let err = Form::find_by_id(&pool, created.id)
        .await
        .expect_err("should be gone");
    assert!(err.to_string().to_lowercase().contains("not found"));
}

#[tokio::test]
#[serial]
async fn duplicate_field_labels_rejected() {
    let pool = test_db_pool().await;
    cleanup_test_data(&pool).await;
    let site_id = create_test_site(&pool).await;

    let req = CreateFormRequest {
        name: "Bad".into(),
        slug: "bad-dup".into(),
        description: None,
        is_active: true,
        consent_required: false,
        consent_text: None,
        bot_protection: FormBotProtection::None,
        storage_mode: FormStorageMode::Simple,
        retention_days: None,
        fields: vec![email_field("Email"), email_field("Email")],
        template_id: None,
        localizations: vec![],
    };
    let err = Form::create(&pool, site_id, req)
        .await
        .expect_err("duplicate labels should be rejected");
    let msg = err.to_string();
    assert!(msg.contains("Duplicate field label"), "got: {msg}");
}

#[tokio::test]
#[serial]
async fn slug_uniqueness_enforced_per_site() {
    let pool = test_db_pool().await;
    cleanup_test_data(&pool).await;
    let site_id = create_test_site(&pool).await;

    let req = || CreateFormRequest {
        name: "A".into(),
        slug: "same-slug".into(),
        description: None,
        is_active: true,
        consent_required: false,
        consent_text: None,
        bot_protection: FormBotProtection::None,
        storage_mode: FormStorageMode::Simple,
        retention_days: None,
        fields: vec![],
        template_id: None,
        localizations: vec![],
    };
    Form::create(&pool, site_id, req()).await.expect("first ok");
    let err = Form::create(&pool, site_id, req())
        .await
        .expect_err("second should conflict");
    assert!(
        err.to_string().to_lowercase().contains("slug"),
        "got: {err}"
    );
}

#[tokio::test]
#[serial]
async fn template_copy_on_create_merges_fields_by_label() {
    let pool = test_db_pool().await;
    cleanup_test_data(&pool).await;
    let site_id = create_test_site(&pool).await;

    let template = FormTemplate::create(
        &pool,
        site_id,
        CreateFormTemplateRequest {
            name: "Contact Template".into(),
            description: None,
            icon: None,
            fields: vec![
                FormFieldInput {
                    label: "Name".into(),
                    field_type: FormFieldType::Text,
                    placeholder: None,
                    help_text: None,
                    validation: json!({"required": true}),
                    options: None,
                    is_required: true,
                    display_order: 0,
                    localizations: vec![],
                },
                email_field("Email"),
            ],
            consent_required: false,
            consent_text: None,
            is_active: true,
        },
    )
    .await
    .expect("template");

    // Caller supplies one override (Email with custom validation) and adds
    // a third field. Template's Name field is inherited unchanged.
    let req = CreateFormRequest {
        name: "From Template".into(),
        slug: "from-template".into(),
        description: None,
        is_active: true,
        consent_required: false,
        consent_text: None,
        bot_protection: FormBotProtection::None,
        storage_mode: FormStorageMode::Simple,
        retention_days: None,
        fields: vec![
            FormFieldInput {
                label: "Email".into(),
                field_type: FormFieldType::Email,
                placeholder: None,
                help_text: None,
                validation: json!({"required": true, "pattern": "@company\\.com$"}),
                options: None,
                is_required: true,
                display_order: 1,
                localizations: vec![],
            },
            FormFieldInput {
                label: "Message".into(),
                field_type: FormFieldType::Textarea,
                placeholder: None,
                help_text: None,
                validation: json!({}),
                options: None,
                is_required: false,
                display_order: 2,
                localizations: vec![],
            },
        ],
        template_id: Some(template.id),
        localizations: vec![],
    };

    let form = Form::create(&pool, site_id, req)
        .await
        .expect("create from template");

    let labels: std::collections::HashSet<_> =
        form.fields.iter().map(|f| f.label.clone()).collect();
    assert!(labels.contains("Name"), "inherits Name");
    assert!(labels.contains("Email"), "Email merged");
    assert!(labels.contains("Message"), "added Message");

    let email = form.fields.iter().find(|f| f.label == "Email").unwrap();
    assert_eq!(
        email.validation["pattern"], "@company\\.com$",
        "caller validation overrides template"
    );
}

#[tokio::test]
#[serial]
async fn template_name_unique_per_site() {
    let pool = test_db_pool().await;
    cleanup_test_data(&pool).await;
    let site_id = create_test_site(&pool).await;

    let req = || CreateFormTemplateRequest {
        name: "Same Name".into(),
        description: None,
        icon: None,
        fields: vec![],
        consent_required: false,
        consent_text: None,
        is_active: true,
    };
    FormTemplate::create(&pool, site_id, req())
        .await
        .expect("first");
    let err = FormTemplate::create(&pool, site_id, req())
        .await
        .expect_err("second should conflict");
    assert!(
        err.to_string().to_lowercase().contains("template"),
        "got: {err}"
    );
}

#[tokio::test]
#[serial]
async fn localizations_round_trip_through_create_and_update() {
    let pool = test_db_pool().await;
    cleanup_test_data(&pool).await;
    let site_id = create_test_site(&pool).await;

    let de_locale_id: uuid::Uuid = sqlx::query_scalar("SELECT id FROM locales WHERE code = $1")
        .bind("de")
        .fetch_one(&pool)
        .await
        .expect("de locale");

    // CREATE with a German form localization + a German field localization.
    let mut email = email_field("Email");
    email.localizations = vec![FormFieldLocalizationInput {
        locale_id: de_locale_id,
        display_label: Some("E-Mail".into()),
        placeholder: Some("du@beispiel.de".into()),
        help_text: None,
    }];

    let req = CreateFormRequest {
        name: "Contact".into(),
        slug: "contact-loc".into(),
        description: Some("Reach us".into()),
        is_active: true,
        consent_required: false,
        consent_text: None,
        bot_protection: FormBotProtection::None,
        storage_mode: FormStorageMode::Simple,
        retention_days: None,
        fields: vec![email],
        template_id: None,
        localizations: vec![FormLocalizationInput {
            locale_id: de_locale_id,
            name: Some("Kontakt".into()),
            description: Some("Schreiben Sie uns".into()),
            consent_text: None,
        }],
    };

    let created = forja::models::forms::Form::create(&pool, site_id, req)
        .await
        .expect("create");
    assert_eq!(created.localizations.len(), 1, "1 form loc");
    assert_eq!(created.localizations[0].name.as_deref(), Some("Kontakt"));
    assert_eq!(created.fields[0].localizations.len(), 1, "1 field loc");
    assert_eq!(
        created.fields[0].localizations[0].display_label.as_deref(),
        Some("E-Mail")
    );

    // READ — round-trip preserves both.
    let fetched = forja::models::forms::Form::find_by_id(&pool, created.id)
        .await
        .expect("find");
    assert_eq!(fetched.localizations.len(), 1);
    assert_eq!(fetched.fields[0].localizations.len(), 1);

    // UPDATE with empty localizations array — replaces atomically, so loc
    // count drops to zero.
    let update = UpdateFormRequest {
        name: None,
        slug: None,
        description: None,
        is_active: None,
        consent_required: None,
        consent_text: None,
        bot_protection: None,
        storage_mode: None,
        retention_days: None,
        localizations: Some(vec![]),
        fields: None,
    };
    let updated = forja::models::forms::Form::update(&pool, created.id, update)
        .await
        .expect("update");
    assert_eq!(updated.localizations.len(), 0, "form locs replaced");
}
