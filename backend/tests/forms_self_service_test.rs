//! Self-service API tests (#584).

mod common;

use common::{cleanup_test_data, create_test_site, test_context, test_db_pool};
use forja::dto::forms::{
    CreateFormRequest, FormBotProtection, FormFieldInput, FormFieldType, FormStorageMode,
    SubmitFormRequest,
};
use forja::models::forms::Form;
use forja::repos::form_submission_repo;
use forja::services::form_submission_service;
use forja::services::form_submission_service::AlwaysAllow;
use serde_json::json;
use serial_test::serial;
use uuid::Uuid;

async fn seed_and_submit(pool: &sqlx::PgPool) -> (Uuid, String) {
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

    let (_id, code) = form_submission_service::submit(
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
    (site_id, code)
}

#[tokio::test]
#[serial]
async fn tracer_lookup_view_delete_full_lifecycle() {
    let pool = test_db_pool().await;
    let (site_id, code) = seed_and_submit(&pool).await;

    // LOOKUP — minimal info
    let (status, _ts) = form_submission_repo::lookup_by_reference_code(&pool, &code, site_id)
        .await
        .expect("lookup");
    assert_eq!(status, "new");

    // GET — full data
    let row = form_submission_repo::get_by_reference_code(&pool, &code, site_id)
        .await
        .expect("get");
    assert_eq!(row.reference_code, code);
    assert_eq!(row.data["Email"], "v@example.com");

    // DELETE — soft-delete; row still in table with is_deleted = true
    form_submission_repo::delete_by_reference_code(&pool, &code, site_id)
        .await
        .expect("delete");

    // Subsequent operations all return 410 Gone.
    let err = form_submission_repo::lookup_by_reference_code(&pool, &code, site_id)
        .await
        .expect_err("lookup after delete");
    assert_eq!(err.status().as_u16(), 410);

    let err = form_submission_repo::get_by_reference_code(&pool, &code, site_id)
        .await
        .expect_err("get after delete");
    assert_eq!(err.status().as_u16(), 410);

    // Idempotent delete: second call → 410, not 500/404.
    let err = form_submission_repo::delete_by_reference_code(&pool, &code, site_id)
        .await
        .expect_err("second delete");
    assert_eq!(err.status().as_u16(), 410);
}

#[tokio::test]
#[serial]
async fn unknown_reference_code_returns_404() {
    let pool = test_db_pool().await;
    cleanup_test_data(&pool).await;
    let site_id = create_test_site(&pool).await;

    let err = form_submission_repo::lookup_by_reference_code(&pool, "ZZZZ-ZZZZ-ZZZZ", site_id)
        .await
        .expect_err("not found");
    assert_eq!(err.status().as_u16(), 404);
    let err = form_submission_repo::get_by_reference_code(&pool, "ZZZZ-ZZZZ-ZZZZ", site_id)
        .await
        .expect_err("not found");
    assert_eq!(err.status().as_u16(), 404);
    let err = form_submission_repo::delete_by_reference_code(&pool, "ZZZZ-ZZZZ-ZZZZ", site_id)
        .await
        .expect_err("not found");
    assert_eq!(err.status().as_u16(), 404);
}

/// Tenant isolation: a reference code minted on site A is invisible to
/// queries scoped to site B. Locks in the fix for the security-audit
/// finding "self-service endpoints lack tenant scoping".
#[tokio::test]
#[serial]
async fn cross_tenant_lookup_returns_404() {
    let pool = test_db_pool().await;
    let (site_a, code) = seed_and_submit(&pool).await;
    let site_b = create_test_site(&pool).await;
    assert_ne!(site_a, site_b);

    let err = form_submission_repo::lookup_by_reference_code(&pool, &code, site_b)
        .await
        .expect_err("cross-tenant lookup");
    assert_eq!(err.status().as_u16(), 404);

    let err = form_submission_repo::get_by_reference_code(&pool, &code, site_b)
        .await
        .expect_err("cross-tenant get");
    assert_eq!(err.status().as_u16(), 404);

    let err = form_submission_repo::delete_by_reference_code(&pool, &code, site_b)
        .await
        .expect_err("cross-tenant delete");
    assert_eq!(err.status().as_u16(), 404);

    // Original site still sees its own code intact.
    let row = form_submission_repo::get_by_reference_code(&pool, &code, site_a)
        .await
        .expect("site_a still sees the submission");
    assert_eq!(row.reference_code, code);
}

/// Malformed reference codes short-circuit at the model layer without a DB
/// roundtrip — guards the enumeration-oracle fix.
#[tokio::test]
#[serial]
async fn malformed_reference_code_returns_404() {
    let pool = test_db_pool().await;
    cleanup_test_data(&pool).await;
    let site_id = create_test_site(&pool).await;

    let err = form_submission_repo::lookup_by_reference_code(&pool, "!!garbage!!", site_id)
        .await
        .expect_err("malformed lookup");
    assert_eq!(err.status().as_u16(), 404);
    let err = form_submission_repo::get_by_reference_code(&pool, "too-short", site_id)
        .await
        .expect_err("malformed get");
    assert_eq!(err.status().as_u16(), 404);
}

/// Lowercase input maps to the uppercase stored value — locks in the
/// case-normalization half of the fix.
#[tokio::test]
#[serial]
async fn lowercase_reference_code_normalizes_and_matches() {
    let pool = test_db_pool().await;
    let (site_id, code) = seed_and_submit(&pool).await;
    let lower = code.to_lowercase();
    assert_ne!(lower, code, "generated code is uppercase");

    let (status, _ts) = form_submission_repo::lookup_by_reference_code(&pool, &lower, site_id)
        .await
        .expect("lookup with lowercase input");
    assert_eq!(status, "new");
}

/// Submitting fields not declared on the form drops the extras silently
/// rather than persisting them — locks in the open-object fix.
#[tokio::test]
#[serial]
async fn submit_drops_undeclared_keys() {
    let pool = test_db_pool().await;
    cleanup_test_data(&pool).await;
    let site_id = create_test_site(&pool).await;
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

    let (_id, code) = form_submission_service::submit(
        &pool,
        &form,
        SubmitFormRequest {
            data: json!({
                "Email": "v@example.com",
                "__exfil": "<script>alert(1)</script>",
                "padding": "x".repeat(50),
            }),
            consent_given: false,
            bot_protection_token: None,
        },
        &AlwaysAllow,
    )
    .await
    .expect("submit");

    let row = form_submission_repo::get_by_reference_code(&pool, &code, site_id)
        .await
        .expect("get");
    let obj = row.data.as_object().expect("data is object");
    assert_eq!(obj.len(), 1, "only declared field survives: {obj:?}");
    assert_eq!(
        obj.get("Email").and_then(|v| v.as_str()),
        Some("v@example.com")
    );
    assert!(obj.get("__exfil").is_none());
    assert!(obj.get("padding").is_none());
}

/// Security regression (#880, ADR-0005): the public lookup endpoint must NOT
/// validate `reference_code` at the request boundary. A malformed code has to
/// collapse to the same 404 as a well-formed-but-unknown code — otherwise a
/// boundary validator (e.g. someone "tightening" this onto `ValidatedJson`)
/// would answer 422 for malformed and 404 for not-found, handing an attacker
/// an enumeration oracle. This test guards the seam exemption at the HTTP layer
/// (the repo-level guard lives in `malformed_reference_code_returns_404`).
#[tokio::test]
#[serial]
async fn lookup_endpoint_malformed_code_returns_404_not_validation_error() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;
    let site_id = create_test_site(&ctx.pool).await;
    let domain = format!("ln-{}.example.test", &Uuid::new_v4().to_string()[..8]);
    sqlx::query("INSERT INTO site_domains (site_id, domain, is_active) VALUES ($1, $2, TRUE)")
        .bind(site_id)
        .bind(&domain)
        .execute(&ctx.pool)
        .await
        .expect("register domain");

    let resp = ctx
        .server
        .post("/api/v1/public/submissions/lookup")
        .add_header("x-site-domain", domain.as_str())
        .json(&json!({ "reference_code": "!!garbage!!" }))
        .await;

    assert_eq!(
        resp.status_code(),
        404,
        "malformed code must look identical to not-found (anti-enumeration), \
         never a 4xx validation error; body: {}",
        resp.text()
    );
    assert_eq!(
        resp.json::<serde_json::Value>()["code"],
        "INVALID_REFERENCE_CODE"
    );
}
