//! Custom-type entry DTOs (#792 / #793).
//!
//! An entry carries shared (non-localized) field values plus a per-locale map
//! of localized field values. Field *keys* address values; the validator
//! (#792) checks them against the stored type schema. The designated title
//! field's value is routed to `content_localizations.title`, not stored here.

use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::{FromRequestParts, RawPathParams};
use axum::http::request::Parts;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::AppState;
use crate::dto::validated::{Validated, ValidatedDto, ValidationContext};
use crate::errors::ApiError;
use crate::models::custom_entry::{ResolvedSchema, resolve_schema};
use crate::models::custom_entry_validator::validate_entry;

/// Request body for creating/updating an entry.
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
pub struct CustomEntryRequest {
    /// Optional URL slug (defaults to a generated one when omitted).
    pub slug: Option<String>,
    /// Non-localized field values, keyed by field key.
    #[serde(default)]
    pub shared: HashMap<String, Value>,
    /// Localized field values: locale code → (field key → value).
    #[serde(default)]
    pub localized: HashMap<String, HashMap<String, Value>>,
}

// ── Validation seam (#879) ──────────────────────────────────────────────
//
// `CustomEntryRequest` can't validate field-by-field: its rules live in the
// per-site type schema, resolved from the request path. So it joins the
// `ValidatedJson` seam via a context that fetches that schema. The schema is
// also needed by `CustomEntry::create_with_schema` / `update`, so we resolve it
// once and cache it in request extensions: the [`CustomTypeSchema`] extractor
// (a `FromRequestParts`, which Axum runs before the `ValidatedJson` body
// extractor) populates the cache and hands the schema to the handler; the
// context below reads the same cached value. One fetch feeds both.

/// Extract the `(site_id, type_key)` pair from the entry route's path.
async fn entry_path_params(parts: &mut Parts) -> Result<(Uuid, String), ApiError> {
    let err = || ApiError::bad_request("site_id and type_key path parameters are required");
    let params = RawPathParams::from_request_parts(parts, &())
        .await
        .map_err(|_| err())?;
    let mut site_id = None;
    let mut type_key = None;
    for (name, value) in params.iter() {
        match name {
            "site_id" => site_id = Uuid::parse_str(value).ok(),
            "type_key" => type_key = Some(value.to_string()),
            _ => {}
        }
    }
    match (site_id, type_key) {
        (Some(s), Some(t)) => Ok((s, t)),
        _ => Err(err()),
    }
}

/// Resolve the entry's type schema once per request, caching it in request
/// extensions. Whichever of the extractor / validation context runs first does
/// the single DB fetch; the other reads the cache.
async fn resolve_and_cache_schema(
    parts: &mut Parts,
    state: &AppState,
) -> Result<Arc<ResolvedSchema>, ApiError> {
    if let Some(cached) = parts.extensions.get::<Arc<ResolvedSchema>>() {
        return Ok(cached.clone());
    }
    let (site_id, type_key) = entry_path_params(parts).await?;
    let schema = Arc::new(resolve_schema(&state.db, site_id, &type_key).await?);
    parts.extensions.insert(schema.clone());
    Ok(schema)
}

/// Handler extractor yielding the request's resolved type schema (fetched once,
/// shared with the validation context). Pass its inner schema into
/// [`CustomEntry::create_with_schema`](crate::models::custom_entry::CustomEntry::create_with_schema)
/// / [`update`](crate::models::custom_entry::CustomEntry::update) so the model
/// doesn't refetch.
pub struct CustomTypeSchema(pub Arc<ResolvedSchema>);

impl FromRequestParts<AppState> for CustomTypeSchema {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, ApiError> {
        Ok(Self(resolve_and_cache_schema(parts, state).await?))
    }
}

/// Validation context for [`CustomEntryRequest`]: carries the resolved per-site
/// type schema so `validate_all` can run the pure [`validate_entry`] gate.
pub struct CustomEntryValidationCtx {
    schema: Arc<ResolvedSchema>,
}

impl ValidationContext for CustomEntryValidationCtx {
    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, ApiError> {
        Ok(Self {
            schema: resolve_and_cache_schema(parts, state).await?,
        })
    }
}

impl ValidatedDto for CustomEntryRequest {
    type Context = CustomEntryValidationCtx;

    async fn validate_all(
        self,
        ctx: &CustomEntryValidationCtx,
    ) -> Result<Validated<Self>, ApiError> {
        validate_entry(&ctx.schema.fields, &self)?;
        Ok(Validated::seal(self))
    }
}

/// A published entry as served on the public Consumer API. PII fields are
/// stripped entirely (privacy by default); `data` merges shared + the chosen
/// locale's values with the title injected under the title field key.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PublicEntry {
    pub slug: Option<String>,
    pub status: String,
    pub published_at: Option<DateTime<Utc>>,
    pub locale: Option<String>,
    pub data: HashMap<String, Value>,
}

/// A public, PII-free view of a type's field schema for generic renderers.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PublicSchemaField {
    pub key: String,
    pub label: String,
    pub field_type: crate::dto::custom_type::CustomFieldType,
    pub localized: bool,
    /// The designated title field — generic renderers use it as the heading.
    pub is_title: bool,
    pub enum_options: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PublicSchema {
    pub key: String,
    pub name: String,
    pub content_kind: crate::dto::custom_type::CustomContentKind,
    pub fields: Vec<PublicSchemaField>,
}

/// A row in the entry list view. The label is the designated title.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CustomEntrySummary {
    pub id: Uuid,
    pub slug: Option<String>,
    pub status: String,
    pub title: Option<String>,
    pub published_at: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
}

/// An entry as returned to admin readers. PII values are decrypted for
/// authorized roles and redacted (`null`) for everyone else (#794).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CustomEntryResponse {
    pub id: Uuid,
    pub type_key: String,
    pub slug: Option<String>,
    pub status: String,
    pub published_at: Option<DateTime<Utc>>,
    pub shared: HashMap<String, Value>,
    pub localized: HashMap<String, HashMap<String, Value>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
