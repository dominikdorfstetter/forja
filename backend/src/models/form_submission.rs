//! Form-submission row type (#582).
//!
//! Submissions are stored in `form_submissions` with the visitor's data in
//! a JSONB blob keyed by field label. This file owns only the row struct —
//! see neighbours for the rest of the pipeline:
//!
//! - `repos::form_submission_repo` — every SQL query (insert / lookup / list /
//!   status / notes / soft-delete).
//! - `services::form_submission_service` — the public submit orchestrator
//!   (bot-protection gate, consent enforcement, validation, persistence,
//!   webhook + notification dispatch).
//! - `models::form_submission_validation` — the pure validation engine and
//!   `filter_to_declared_fields` helper.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;

/// One row in `form_submissions`.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct FormSubmissionRow {
    pub id: Uuid,
    pub form_id: Uuid,
    pub reference_code: String,
    pub data: JsonValue,
    pub consent_given: bool,
    pub consent_text_at_submission: Option<String>,
    pub bot_protection_token: Option<String>,
    pub status: String,
    pub is_deleted: bool,
    pub deleted_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
