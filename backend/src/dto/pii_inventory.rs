//! User-facing PII inventory DTOs (GDPR Art. 15 transparency).
//!
//! Renders the builtin PII registry (`models::builtin_pii`) together with the
//! calling user's live record count per identity-bearing field — the Profile
//! page's "what Forja stores about you" view. Site-agnostic by design: it
//! describes the person's data across the instance, unlike the per-site RoPA.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PiiInventoryField {
    pub field: String,
    /// Why the identity is processed.
    pub purpose: String,
    /// GDPR Art. 6(1) lawful basis.
    pub legal_basis: String,
    /// `anonymize_on_erasure` or `retention_purged`.
    #[schema(example = "anonymize_on_erasure")]
    pub retention_behavior: String,
    /// Rows currently carrying the caller's identity in this field.
    /// NULL for non-Clerk actors (API keys are not a person on record).
    pub record_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PiiInventoryEntity {
    pub table: String,
    pub description: String,
    pub fields: Vec<PiiInventoryField>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PiiInventoryResponse {
    pub generated_at: DateTime<Utc>,
    pub entities: Vec<PiiInventoryEntity>,
}
