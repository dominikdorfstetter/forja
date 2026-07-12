//! Form-submission orchestration (#620 Slice 1).
//!
//! Owns the public submit pipeline: bot-protection gate, consent enforcement,
//! field validation, persistence (delegated to `repos::form_submission_repo`),
//! and follow-up webhook + in-app notification dispatch. Pure data structures
//! and the `validate_submission` engine remain in `models::form_submission`.

use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::forms::{FormBotProtection, FormDetailResponse, SubmitFormRequest};
use crate::errors::{ApiError, codes};
use crate::models::form_submission_validation::{
    filter_to_declared_fields, validate_submission, validation_failed_error,
};
use crate::repos::form_submission_repo;
use crate::services::{notification_service, webhook_service};

/// Seam for verifying a submission's bot-protection token (#620 Slice 3).
///
/// Forja is headless — it doesn't ship with a captcha vendor. The production
/// adapter lives in the submit handler and proxies the token to whatever
/// provider URL the site admin configured (per
/// [feedback_headless_cms_no_vendor_picks]). Tests inject `AlwaysAllow` /
/// `AlwaysReject` to exercise the success / rejection branches without a
/// network round-trip.
///
/// `verify` is called only when the form has `FormBotProtection::Mandatory`.
/// Implementations are responsible for surfacing the appropriate
/// `FORM_BOT_PROTECTION_*` error code on rejection (missing token, provider
/// rejection, provider unreachable, etc.).
#[async_trait]
pub trait BotProtectionCheck: Send + Sync {
    async fn verify(&self, req: &SubmitFormRequest) -> Result<(), ApiError>;
}

/// Test fake that always succeeds. Use for the consent / validation /
/// persistence tests where bot protection isn't the subject under test.
pub struct AlwaysAllow;

#[async_trait]
impl BotProtectionCheck for AlwaysAllow {
    async fn verify(&self, _req: &SubmitFormRequest) -> Result<(), ApiError> {
        Ok(())
    }
}

/// Test fake that always rejects with `FORM_BOT_PROTECTION_FAILED`. Use to
/// assert that a rejection short-circuits the submit pipeline (no persistence,
/// no webhook dispatch).
pub struct AlwaysReject;

#[async_trait]
impl BotProtectionCheck for AlwaysReject {
    async fn verify(&self, _req: &SubmitFormRequest) -> Result<(), ApiError> {
        Err(
            ApiError::bad_request("Bot protection rejected the submission")
                .with_code(codes::FORM_BOT_PROTECTION_INVALID),
        )
    }
}

/// Validate + persist a public form submission. Returns the new row's id and
/// reference code.
pub async fn submit(
    pool: &PgPool,
    form: &FormDetailResponse,
    req: SubmitFormRequest,
    bot_check: &dyn BotProtectionCheck,
) -> Result<(Uuid, String), ApiError> {
    if !form.is_active {
        return Err(ApiError::not_found("Form is not accepting submissions")
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type("form"));
    }

    if matches!(form.bot_protection, FormBotProtection::Mandatory) {
        bot_check.verify(&req).await?;
    }

    if form.consent_required && !req.consent_given {
        return Err(
            ApiError::bad_request("Consent is required to submit this form")
                .with_code(codes::FORM_CONSENT_REQUIRED),
        );
    }

    let errors = validate_submission(&form.fields, &req.data);
    if !errors.is_empty() {
        return Err(validation_failed_error(errors));
    }

    let stored_data = filter_to_declared_fields(&req.data, &form.fields);
    let consent_text = form.consent_text.clone().filter(|_| form.consent_required);

    let (id, code) = form_submission_repo::insert_with_unique_code(
        pool,
        form.id,
        &stored_data,
        req.consent_given,
        consent_text.as_deref(),
        req.bot_protection_token.as_deref(),
    )
    .await?;

    let payload = serde_json::json!({
        "form_id": form.id,
        "form_name": form.name,
        "submission_id": id,
        "reference_code": code,
        "submitted_at": chrono::Utc::now().to_rfc3339(),
        "site_id": form.site_id,
    });
    webhook_service::dispatch(pool, form.site_id, "form.submission.created", id, &payload).await;
    notification_service::notify_form_submission_received(
        pool,
        form.site_id,
        id,
        &form.name,
        &code,
    )
    .await;

    Ok((id, code))
}
