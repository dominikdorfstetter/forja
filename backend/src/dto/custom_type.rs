//! Custom-type schema DTOs (#791).
//!
//! A custom type ("Collection") has a header (key/name/retention/exposure)
//! and an ordered list of typed, translatable fields. Create/Update carry the
//! full field array; the model layer applies it atomically in a transaction
//! (mirrors the Forms Module's atomic field replace). Field-level evolution
//! semantics (rename/retype/soft-delete with live data) layer on in #800.

use crate::dto::validated::ValidatedDto;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

// ── Enums (mirror the Postgres enum types from migration 072) ────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, ToSchema)]
#[sqlx(type_name = "custom_field_type", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum CustomFieldType {
    Text,
    Richtext,
    Number,
    Boolean,
    Date,
    Enum,
    Media,
}

#[derive(
    Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, ToSchema,
)]
#[sqlx(type_name = "custom_content_kind", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum CustomContentKind {
    /// API-only collection (internal/CRM-style); never routed publicly.
    #[default]
    Data,
    /// Gets a public URL + rendered page (#801).
    Page,
}

// ── Field input ──────────────────────────────────────────────────────────

/// A field definition supplied by an admin when creating/editing a type.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, ToSchema)]
pub struct CustomFieldInput {
    /// Existing field id on update. Present id + changed key = rename (#800);
    /// absent id = new field. Omitted entirely on create.
    #[serde(default)]
    pub id: Option<Uuid>,
    #[validate(length(min = 1, max = 64))]
    pub key: String,
    #[validate(length(min = 1, max = 200))]
    pub label: String,
    /// Optional per-locale label overrides ({ "de": "...", ... }).
    pub labels: Option<serde_json::Value>,
    pub field_type: CustomFieldType,
    #[serde(default)]
    pub required: bool,
    #[serde(default)]
    pub localized: bool,
    /// Exactly one field per type must be the designated title.
    #[serde(default)]
    pub is_title: bool,
    #[serde(default)]
    pub is_pii: bool,
    pub data_category: Option<String>,
    pub processing_purpose: Option<String>,
    /// Required when `is_pii` is true (GDPR Art. 6 basis).
    pub legal_basis: Option<String>,
    /// Allowed values for `field_type = enum`.
    pub enum_options: Option<Vec<String>>,
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub min_length: Option<i32>,
    pub max_length: Option<i32>,
    /// Regex constraint (text); compile-checked with the Rust `regex` crate.
    pub pattern: Option<String>,
    #[serde(default)]
    pub is_unique: bool,
    #[serde(default)]
    pub display_order: i16,
}

// ── Type create / update requests ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Validate, ValidatedDto, ToSchema)]
pub struct CreateCustomTypeRequest {
    #[validate(length(min = 1, max = 64))]
    pub key: String,
    #[validate(length(min = 1, max = 200))]
    pub name: String,
    /// NULL → keep entries forever; >= 0 → purge entries older than N days.
    pub retention_days: Option<i32>,
    #[serde(default)]
    pub is_publicly_readable: bool,
    #[serde(default)]
    pub content_kind: CustomContentKind,
    #[validate(nested, length(min = 1))]
    pub fields: Vec<CustomFieldInput>,
}

/// Update carries the full desired field set; the model diffs by field key.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, ValidatedDto, ToSchema)]
pub struct UpdateCustomTypeRequest {
    #[validate(length(min = 1, max = 200))]
    pub name: String,
    pub retention_days: Option<i32>,
    #[serde(default)]
    pub is_publicly_readable: bool,
    #[serde(default)]
    pub content_kind: CustomContentKind,
    #[validate(nested, length(min = 1))]
    pub fields: Vec<CustomFieldInput>,
}

// ── Responses ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CustomFieldResponse {
    pub id: Uuid,
    pub key: String,
    pub label: String,
    pub labels: Option<serde_json::Value>,
    pub field_type: CustomFieldType,
    pub required: bool,
    pub localized: bool,
    pub is_title: bool,
    pub is_pii: bool,
    pub data_category: Option<String>,
    pub processing_purpose: Option<String>,
    pub legal_basis: Option<String>,
    pub enum_options: Option<serde_json::Value>,
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub min_length: Option<i32>,
    pub max_length: Option<i32>,
    pub pattern: Option<String>,
    pub is_unique: bool,
    pub display_order: i16,
    pub deprecated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CustomTypeResponse {
    pub id: Uuid,
    pub site_id: Uuid,
    pub key: String,
    pub name: String,
    pub retention_days: Option<i32>,
    pub is_publicly_readable: bool,
    pub content_kind: CustomContentKind,
    pub schema_version: i32,
    pub fields: Vec<CustomFieldResponse>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Lightweight list row — no fields, just a field count.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CustomTypeSummary {
    pub id: Uuid,
    pub key: String,
    pub name: String,
    pub content_kind: CustomContentKind,
    pub is_publicly_readable: bool,
    pub schema_version: i32,
    pub field_count: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
