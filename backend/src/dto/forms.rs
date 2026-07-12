//! Forms module DTOs (#581).
//!
//! A form has a header (name/slug/settings) and an ordered list of fields.
//! `CreateFormRequest` and `UpdateFormRequest` carry the full field array;
//! the model layer performs an atomic replace inside a transaction. Form
//! templates store a JSONB snapshot of field definitions — copy-on-create,
//! no ongoing link to derived forms.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::dto::validated::{Validated, ValidatedDto};
use crate::utils::pagination::Paginated;

// ── Enums ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, ToSchema)]
#[sqlx(type_name = "form_field_type", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum FormFieldType {
    Text,
    Textarea,
    Email,
    Number,
    Select,
    Checkbox,
    Radio,
    Date,
    Custom,
}

#[derive(
    Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, ToSchema,
)]
#[sqlx(type_name = "form_bot_protection", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum FormBotProtection {
    #[default]
    None,
    Mandatory,
}

/// How a site verifies bot-protection tokens (#768).
///
/// `Altcha` is the default for newly-configured sites: self-hosted
/// proof-of-work verified in-process, no third-party call. `Remote` is the
/// original #608 vendor model (POST a token to the vendor's siteverify URL).
#[derive(
    Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, ToSchema,
)]
#[sqlx(type_name = "bot_protection_mode", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum BotProtectionMode {
    #[default]
    Altcha,
    Remote,
}

#[derive(
    Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, ToSchema,
)]
#[sqlx(type_name = "form_storage_mode", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum FormStorageMode {
    #[default]
    Simple,
    Queryable,
}

// ── Field input / response ──────────────────────────────────────────────

/// Field definition supplied by the admin when creating or updating a form.
/// On update, the full array replaces the existing fields atomically.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, ToSchema)]
pub struct FormFieldInput {
    #[validate(length(min = 1, max = 200))]
    pub label: String,
    pub field_type: FormFieldType,
    #[validate(length(max = 200))]
    pub placeholder: Option<String>,
    #[validate(length(max = 1000))]
    pub help_text: Option<String>,
    /// Free-form validation rules; structure validated at submission time.
    #[serde(default)]
    pub validation: serde_json::Value,
    /// For select/radio/checkbox: array of choice objects.
    pub options: Option<serde_json::Value>,
    #[serde(default)]
    pub is_required: bool,
    #[serde(default)]
    pub display_order: i16,
    /// Per-locale overrides for visitor-facing text. Empty = no translations.
    #[serde(default)]
    #[validate(nested)]
    pub localizations: Vec<FormFieldLocalizationInput>,
}

/// One per-locale override for a form field. The technical `label` on the
/// parent `FormFieldInput` stays canonical (used as the submission JSONB
/// key); these fields override what visitors see when the resolved locale
/// matches `locale_id`.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, ToSchema)]
pub struct FormFieldLocalizationInput {
    pub locale_id: Uuid,
    #[validate(length(max = 200))]
    pub display_label: Option<String>,
    #[validate(length(max = 200))]
    pub placeholder: Option<String>,
    #[validate(length(max = 1000))]
    pub help_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FormFieldLocalizationResponse {
    pub id: Uuid,
    pub form_field_id: Uuid,
    pub locale_id: Uuid,
    pub display_label: Option<String>,
    pub placeholder: Option<String>,
    pub help_text: Option<String>,
}

/// Per-locale override for a form's top-level text. `name` falls back to the
/// canonical `forms.name`; same for `description` and `consent_text`.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, ToSchema)]
pub struct FormLocalizationInput {
    pub locale_id: Uuid,
    #[validate(length(max = 200))]
    pub name: Option<String>,
    #[validate(length(max = 2000))]
    pub description: Option<String>,
    #[validate(length(max = 5000))]
    pub consent_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FormLocalizationResponse {
    pub id: Uuid,
    pub form_id: Uuid,
    pub locale_id: Uuid,
    pub name: Option<String>,
    pub description: Option<String>,
    pub consent_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FormFieldResponse {
    pub id: Uuid,
    pub label: String,
    pub field_type: FormFieldType,
    pub placeholder: Option<String>,
    pub help_text: Option<String>,
    pub validation: serde_json::Value,
    pub options: Option<serde_json::Value>,
    pub is_required: bool,
    pub display_order: i16,
    /// Per-locale text overrides. Empty when no translations exist.
    #[serde(default)]
    pub localizations: Vec<FormFieldLocalizationResponse>,
}

// ── Form request / response ─────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, ToSchema)]
pub struct CreateFormRequest {
    #[validate(length(min = 1, max = 200))]
    pub name: String,
    #[validate(length(min = 1, max = 100))]
    pub slug: String,
    #[validate(length(max = 2000))]
    pub description: Option<String>,
    #[serde(default = "default_true")]
    pub is_active: bool,
    #[serde(default)]
    pub consent_required: bool,
    #[validate(length(max = 5000))]
    pub consent_text: Option<String>,
    #[serde(default)]
    pub bot_protection: FormBotProtection,
    #[serde(default)]
    pub storage_mode: FormStorageMode,
    /// `None` or `Some(0)` → never auto-delete; positive integer → days.
    pub retention_days: Option<i32>,
    #[validate(nested)]
    #[serde(default)]
    pub fields: Vec<FormFieldInput>,
    /// Optional: clone fields from this template (copy-on-create).
    /// If set, `fields` array is merged with template's snapshot
    /// (caller-supplied fields take precedence).
    pub template_id: Option<Uuid>,
    /// Per-locale overrides for the form's top-level text.
    #[validate(nested)]
    #[serde(default)]
    pub localizations: Vec<FormLocalizationInput>,
}

#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, ToSchema)]
pub struct UpdateFormRequest {
    #[validate(length(min = 1, max = 200))]
    pub name: Option<String>,
    #[validate(length(min = 1, max = 100))]
    pub slug: Option<String>,
    #[validate(length(max = 2000))]
    pub description: Option<String>,
    pub is_active: Option<bool>,
    pub consent_required: Option<bool>,
    #[validate(length(max = 5000))]
    pub consent_text: Option<String>,
    pub bot_protection: Option<FormBotProtection>,
    pub storage_mode: Option<FormStorageMode>,
    pub retention_days: Option<i32>,
    /// If `Some`, the form's fields are replaced atomically with this array.
    /// `None` leaves existing fields untouched.
    #[validate(nested)]
    pub fields: Option<Vec<FormFieldInput>>,
    /// If `Some`, the form's per-locale overrides are replaced atomically
    /// with this array. `None` leaves existing localizations untouched.
    #[validate(nested)]
    pub localizations: Option<Vec<FormLocalizationInput>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FormDetailResponse {
    pub id: Uuid,
    pub site_id: Uuid,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub is_active: bool,
    pub consent_required: bool,
    pub consent_text: Option<String>,
    pub bot_protection: FormBotProtection,
    pub storage_mode: FormStorageMode,
    pub retention_days: Option<i32>,
    pub fields: Vec<FormFieldResponse>,
    /// Per-locale overrides for the form's top-level text. Empty when no
    /// translations exist.
    #[serde(default)]
    pub localizations: Vec<FormLocalizationResponse>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct FormListItem {
    pub id: Uuid,
    pub site_id: Uuid,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub is_active: bool,
    pub field_count: i64,
    pub submission_count: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub type PaginatedForms = Paginated<FormListItem>;

// ── Template request / response ─────────────────────────────────────────

#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, ToSchema)]
pub struct CreateFormTemplateRequest {
    #[validate(length(min = 1, max = 200))]
    pub name: String,
    #[validate(length(max = 2000))]
    pub description: Option<String>,
    #[validate(length(max = 50))]
    pub icon: Option<String>,
    /// Field snapshot — copied into the new form when the template is used.
    #[validate(nested)]
    #[serde(default)]
    pub fields: Vec<FormFieldInput>,
    #[serde(default)]
    pub consent_required: bool,
    #[validate(length(max = 5000))]
    pub consent_text: Option<String>,
    #[serde(default = "default_true")]
    pub is_active: bool,
}

#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, ToSchema)]
pub struct UpdateFormTemplateRequest {
    #[validate(length(min = 1, max = 200))]
    pub name: Option<String>,
    #[validate(length(max = 2000))]
    pub description: Option<String>,
    #[validate(length(max = 50))]
    pub icon: Option<String>,
    #[validate(nested)]
    pub fields: Option<Vec<FormFieldInput>>,
    pub consent_required: Option<bool>,
    #[validate(length(max = 5000))]
    pub consent_text: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FormTemplateResponse {
    pub id: Uuid,
    pub site_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub fields: serde_json::Value,
    pub consent_required: bool,
    pub consent_text: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub type PaginatedFormTemplates = Paginated<FormTemplateResponse>;

// ── Site bot-protection config DTOs (#608) ──────────────────────────────

/// Admin view of a site's bot-protection config. Returns the mode and
/// (in remote mode) the verify URL, but never the plaintext secret / HMAC
/// key — once written, it is only retrievable in encrypted form.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SiteBotProtectionResponse {
    pub site_id: Uuid,
    /// `altcha` (self-hosted, default) or `remote` (#608 vendor verifier).
    pub mode: BotProtectionMode,
    pub provider_label: String,
    /// Null in `altcha` mode; the vendor siteverify URL in `remote` mode.
    pub verify_url: Option<String>,
    /// ALTCHA PoW ceiling (null in remote mode).
    pub altcha_max_number: Option<i64>,
    /// ALTCHA challenge validity window in seconds (null in remote mode).
    pub altcha_expiry_seconds: Option<i32>,
    /// Always `true` when the row exists. Surfaced as an explicit flag so
    /// the admin UI doesn't have to reason about presence.
    pub configured: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Upsert request. The required fields depend on `mode`:
/// - `altcha` (default): no vendor fields needed; if `secret` (the HMAC key)
///   is omitted the server auto-generates a strong one, so enabling ALTCHA is
///   zero-config.
/// - `remote`: `verify_url` (https) and `secret` (vendor secret) are required.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct UpsertSiteBotProtectionRequest {
    /// Verification mode. Defaults to `altcha` (self-hosted, GDPR-clean).
    #[serde(default)]
    pub mode: BotProtectionMode,
    /// Free-text label shown in the admin UI. Defaults to a mode-appropriate
    /// label when omitted.
    #[serde(default)]
    pub provider_label: Option<String>,
    /// The vendor's server-side siteverify URL. Required in `remote` mode,
    /// ignored in `altcha` mode.
    #[serde(default)]
    pub verify_url: Option<String>,
    /// The vendor secret (`remote`) or ALTCHA HMAC key (`altcha`). Required in
    /// `remote` mode; auto-generated in `altcha` mode when omitted. Stored
    /// encrypted at rest.
    #[serde(default)]
    pub secret: Option<String>,
    /// Optional ALTCHA PoW ceiling override (`altcha` mode only).
    #[serde(default)]
    pub altcha_max_number: Option<i64>,
    /// Optional ALTCHA challenge-expiry override in seconds (`altcha` only).
    #[serde(default)]
    pub altcha_expiry_seconds: Option<i32>,
    /// `altcha` mode: rotate the HMAC key on this save. Without it, an existing
    /// key is preserved so incidental saves don't invalidate live challenges.
    #[serde(default)]
    pub regenerate_key: Option<bool>,
}

impl UpsertSiteBotProtectionRequest {
    /// Per-mode field validation. Mirrors the #608 length/URL limits for
    /// remote mode and enforces that vendor fields are present there.
    pub fn validate_for_mode(&self) -> Result<(), crate::errors::ApiError> {
        use crate::errors::{ApiError, codes};
        let fail =
            |msg: &str| ApiError::bad_request(msg.to_string()).with_code(codes::VALIDATION_ERROR);
        if let Some(label) = &self.provider_label
            && label.len() > 100
        {
            return Err(fail("provider_label must be ≤ 100 chars"));
        }
        match self.mode {
            BotProtectionMode::Remote => {
                let url = self.verify_url.as_deref().unwrap_or_default();
                if url.is_empty() || url.len() > 500 {
                    return Err(fail("verify_url is required in remote mode (≤ 500 chars)"));
                }
                if !(url.starts_with("http://") || url.starts_with("https://")) {
                    return Err(fail("verify_url must be an http(s) URL"));
                }
                let secret = self.secret.as_deref().unwrap_or_default();
                if secret.is_empty() || secret.len() > 500 {
                    return Err(fail("secret is required in remote mode (≤ 500 chars)"));
                }
            }
            BotProtectionMode::Altcha => {
                if let Some(secret) = &self.secret
                    && secret.len() > 500
                {
                    return Err(fail("secret must be ≤ 500 chars"));
                }
            }
        }
        Ok(())
    }
}

impl ValidatedDto for UpsertSiteBotProtectionRequest {
    type Context = ();

    async fn validate_all(self, _: &()) -> Result<Validated<Self>, crate::errors::ApiError> {
        self.validate_for_mode()?;
        Ok(Validated::seal(self))
    }
}

/// A fresh ALTCHA challenge for the widget to solve (#770). Mirrors the JSON
/// shape `altcha-lib-rs` emits and the ALTCHA widget consumes verbatim.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AltchaChallengeResponse {
    /// Hash algorithm, e.g. `SHA-256`.
    pub algorithm: String,
    /// The target hash the client brute-forces a preimage for.
    pub challenge: String,
    /// Upper bound of the proof-of-work search space.
    pub maxnumber: u64,
    /// Random per-challenge salt (carries the embedded expiry).
    pub salt: String,
    /// HMAC signature binding the challenge to the server's key.
    pub signature: String,
}

// ── Public submission DTOs (#582) ───────────────────────────────────────

/// What a public form-renderer needs to render a form. Excludes site-internal
/// flags (`storage_mode`, `retention_days`, `is_deleted`) that visitors
/// shouldn't see or depend on. The optional `?locale=` query on the public
/// endpoint pre-substitutes localized text into name / description /
/// consent_text and into each field's placeholder / help_text; field labels
/// stay as the canonical technical key (used as the submission JSONB key)
/// with `display_label` carrying the visitor-facing text.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PublicFormResponse {
    pub id: Uuid,
    pub site_id: Uuid,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub consent_required: bool,
    pub consent_text: Option<String>,
    pub bot_protection: FormBotProtection,
    pub fields: Vec<PublicFormFieldResponse>,
}

/// Public-facing field projection. `label` is the technical/JSONB key;
/// `display_label` is what the renderer shows to visitors (defaults to
/// `label` when no localization applies).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PublicFormFieldResponse {
    pub id: Uuid,
    pub label: String,
    pub display_label: String,
    pub field_type: FormFieldType,
    pub placeholder: Option<String>,
    pub help_text: Option<String>,
    pub validation: serde_json::Value,
    pub options: Option<serde_json::Value>,
    pub is_required: bool,
    pub display_order: i16,
}

#[derive(Debug, Clone, Deserialize, Validate, ToSchema)]
pub struct SubmitFormRequest {
    /// Field values keyed by field label. Form-aware validation runs in the
    /// service after the form is loaded — this seam only enforces
    /// struct-shape limits.
    pub data: serde_json::Value,
    #[serde(default)]
    pub consent_given: bool,
    /// Required when the form has `bot_protection = mandatory`; otherwise
    /// optional. Capped at 8 KiB to keep junk payloads from chewing memory
    /// before the captcha verifier can reject them.
    #[validate(length(max = 8192, message = "bot_protection_token must be ≤ 8192 chars"))]
    pub bot_protection_token: Option<String>,
}

impl crate::dto::validated::ValidatedDto for SubmitFormRequest {
    type Context = ();

    async fn validate_all(
        self,
        _ctx: &(),
    ) -> Result<crate::dto::validated::Validated<Self>, crate::errors::ApiError> {
        self.validate().map_err(crate::errors::ApiError::from)?;
        Ok(crate::dto::validated::Validated::seal(self))
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SubmitFormResponse {
    pub submission_id: Uuid,
    pub reference_code: String,
}

// ── Self-service DTOs (#584) ────────────────────────────────────────────

/// Minimal self-service lookup — confirms a submission exists and returns
/// its status/submitted-at without revealing the field data. Useful for
/// confirmation pages that only need to say "yes, your submission is on
/// file" without disclosing personally-identifying field values.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SelfServiceLookupResponse {
    pub status: String,
    pub created_at: DateTime<Utc>,
}

/// Full self-service view — visitor's own field data plus identification.
/// Excludes site-internal fields (`is_deleted`, `bot_protection_token`,
/// `consent_text_at_submission` is intentionally exposed for transparency).
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SelfServiceSubmissionResponse {
    pub reference_code: String,
    pub status: String,
    pub data: serde_json::Value,
    pub consent_given: bool,
    pub consent_text_at_submission: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct LookupSubmissionRequest {
    pub reference_code: String,
}

// ── Submission management DTOs (#583) ───────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, ToSchema)]
#[sqlx(type_name = "form_submission_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum FormSubmissionStatus {
    New,
    InReview,
    Resolved,
    Rejected,
    Archived,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct SubmissionListItem {
    pub id: Uuid,
    pub reference_code: String,
    pub status: FormSubmissionStatus,
    pub data: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

pub type PaginatedSubmissions = Paginated<SubmissionListItem>;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SubmissionStatusCounts {
    pub new: i64,
    pub in_review: i64,
    pub resolved: i64,
    pub rejected: i64,
    pub archived: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SubmissionDetailResponse {
    pub id: Uuid,
    pub form_id: Uuid,
    pub reference_code: String,
    pub status: FormSubmissionStatus,
    pub data: serde_json::Value,
    pub consent_given: bool,
    pub consent_text_at_submission: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub notes: Vec<SubmissionNoteResponse>,
    pub status_history: Vec<SubmissionStatusLogEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct SubmissionNoteResponse {
    pub id: Uuid,
    pub author_id: Option<String>,
    pub body: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct SubmissionStatusLogEntry {
    pub from_status: Option<FormSubmissionStatus>,
    pub to_status: FormSubmissionStatus,
    pub changed_by: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, ToSchema)]
pub struct UpdateSubmissionStatusRequest {
    pub status: FormSubmissionStatus,
}

#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, ToSchema)]
pub struct CreateSubmissionNoteRequest {
    #[validate(length(min = 1, max = 5000))]
    pub body: String,
}

fn default_true() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_form_request_validates_name_and_slug() {
        let mut req = CreateFormRequest {
            name: String::new(),
            slug: "ok".to_string(),
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
        assert!(req.validate().is_err(), "empty name should fail");

        req.name = "Contact".to_string();
        req.slug = String::new();
        assert!(req.validate().is_err(), "empty slug should fail");

        req.slug = "contact".to_string();
        assert!(req.validate().is_ok());
    }

    #[test]
    fn field_type_serializes_lowercase() {
        let v = serde_json::to_string(&FormFieldType::Email).unwrap();
        assert_eq!(v, "\"email\"");

        let parsed: FormFieldType = serde_json::from_str("\"textarea\"").unwrap();
        assert_eq!(parsed, FormFieldType::Textarea);
    }
}
