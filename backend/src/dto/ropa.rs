//! Records of Processing Activities (GDPR Art. 30) DTOs (#794).
//!
//! Derived entirely from the custom-type schema metadata a site owner already
//! declared (per-field is_pii + data_category + processing_purpose +
//! legal_basis, per-type retention) plus live record counts. "Define a
//! collection and your RoPA falls out of it."

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RopaFieldEntry {
    pub key: String,
    pub label: String,
    pub data_category: Option<String>,
    pub processing_purpose: Option<String>,
    pub legal_basis: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RopaTypeEntry {
    pub key: String,
    pub name: String,
    /// NULL = retained indefinitely.
    pub retention_days: Option<i32>,
    pub is_publicly_readable: bool,
    /// Live (non-deleted) record count for this type.
    pub record_count: i64,
    /// The personal-data fields whose processing this RoPA documents.
    pub pii_fields: Vec<RopaFieldEntry>,
}

/// One identity-bearing column on a built-in table (#19).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RopaBuiltinField {
    pub field: String,
    /// Purpose of processing (RoPA wording).
    pub purpose: String,
    /// GDPR Art. 6(1) lawful basis.
    pub legal_basis: String,
    /// `anonymize_on_erasure` or `retention_purged`.
    #[schema(example = "anonymize_on_erasure")]
    pub retention_behavior: String,
}

/// A built-in Forja table that processes personal data (#19). Rendered from
/// the static registry in `models::builtin_pii` — built-ins meet the same
/// classification bar as custom types.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RopaBuiltinEntity {
    pub table: String,
    pub description: String,
    pub fields: Vec<RopaBuiltinField>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RopaReport {
    pub site_id: Uuid,
    pub generated_at: DateTime<Utc>,
    /// One entry per custom type that processes personal data.
    pub processing_activities: Vec<RopaTypeEntry>,
    /// Built-in entities' identity-bearing fields (#19).
    pub builtin_entities: Vec<RopaBuiltinEntity>,
    /// The site's `data_retention_days` setting governing the audit-log /
    /// change-history purge. NULL = retention purge disabled for this site.
    pub data_retention_days: Option<i32>,
}
