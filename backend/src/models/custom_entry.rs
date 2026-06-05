//! Custom-type entry storage with PII encryption-at-rest (#792).
//!
//! Validates a payload against the type schema (via [`custom_entry_validator`]),
//! then persists it on the `contents` spine: a `contents` row + `content_sites`
//! ownership, the designated title routed to `content_localizations.title`,
//! shared/localized values in the JSONB value tables, cross-entry unique-value
//! bookkeeping, and a v1 `content_versions` snapshot. Field values flagged
//! `is_pii` are wrapped as `{"__enc","__nonce"}` (AES-256-GCM, per-value nonce)
//! so they are ciphertext at rest, and decrypted only for authorized readers.
//!
//! HTTP wiring, publish actions, and the publish-pipeline gate are #793.
//!
//! [`custom_entry_validator`]: crate::models::custom_entry_validator

use std::collections::HashMap;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use serde_json::{json, Map, Value};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::dto::custom_entry::{CustomEntryRequest, CustomEntryResponse};
use crate::dto::custom_type::CustomFieldResponse;
use crate::errors::{codes, ApiError};
use crate::models::custom_entry_validator::validate_entry;
use crate::models::custom_type::CustomType;

/// Resolved schema for an entry operation: the type's id, its content
/// entity-type id, and the materialised field definitions. Public so the
/// request-boundary validation seam ([`crate::dto::custom_entry`]) can resolve
/// it once at the extractor and thread it into [`CustomEntry::create_with_schema`]
/// / [`CustomEntry::update`], avoiding a second fetch inside the model (#879).
pub struct ResolvedSchema {
    pub custom_type_id: Uuid,
    pub entity_type_id: Uuid,
    pub fields: Vec<CustomFieldResponse>,
}

/// Fetch the schema for a `(site, type_key)` pair. Exposed at crate scope so the
/// validation seam can resolve-and-cache it before the handler body runs.
pub(crate) async fn resolve_schema(
    pool: &PgPool,
    site_id: Uuid,
    type_key: &str,
) -> Result<ResolvedSchema, ApiError> {
    let row =
        sqlx::query("SELECT id, entity_type_id FROM custom_types WHERE site_id = $1 AND key = $2")
            .bind(site_id)
            .bind(type_key)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| {
                ApiError::not_found(format!("No custom type '{type_key}'"))
                    .with_code(codes::ERR_CUSTOM_TYPE_NOT_FOUND)
            })?;
    // Reuse the schema-builder read to materialise typed fields.
    let detail = CustomType::get(pool, site_id, type_key).await?;
    Ok(ResolvedSchema {
        custom_type_id: row.get("id"),
        entity_type_id: row.get("entity_type_id"),
        fields: detail.fields,
    })
}

/// Wrap a single value as an encrypted envelope.
fn encrypt_value(value: &Value, key: &[u8; 32]) -> Result<Value, ApiError> {
    let plaintext = serde_json::to_string(value)
        .map_err(|e| ApiError::internal(format!("serialise PII value: {e}")))?;
    let (ct, nonce) = crate::services::encryption::encrypt(&plaintext, key)?;
    Ok(json!({ "__enc": BASE64.encode(ct), "__nonce": BASE64.encode(nonce) }))
}

/// Reverse [`encrypt_value`]. Returns the original JSON value.
fn decrypt_value(envelope: &Value, key: &[u8; 32]) -> Result<Value, ApiError> {
    let ct = envelope
        .get("__enc")
        .and_then(Value::as_str)
        .and_then(|s| BASE64.decode(s).ok())
        .ok_or_else(|| ApiError::internal("missing __enc"))?;
    let nonce = envelope
        .get("__nonce")
        .and_then(Value::as_str)
        .and_then(|s| BASE64.decode(s).ok())
        .ok_or_else(|| ApiError::internal("missing __nonce"))?;
    let plaintext = crate::services::encryption::decrypt(&ct, &nonce, key)?;
    serde_json::from_str(&plaintext)
        .map_err(|e| ApiError::internal(format!("parse decrypted PII: {e}")))
}

/// Build the stored JSONB for one bucket: drop the title field (it routes to
/// `content_localizations.title`) and encrypt PII fields in place.
fn build_stored(
    values: &HashMap<String, Value>,
    fields_by_key: &HashMap<&str, &CustomFieldResponse>,
    title_key: &str,
    key: &[u8; 32],
) -> Result<Map<String, Value>, ApiError> {
    let mut out = Map::new();
    for (k, v) in values {
        if k == title_key || v.is_null() {
            continue;
        }
        let field = fields_by_key.get(k.as_str());
        let stored = match field {
            Some(f) if f.is_pii => encrypt_value(v, key)?,
            _ => v.clone(),
        };
        out.insert(k.clone(), stored);
    }
    Ok(out)
}

/// Reverse [`build_stored`]: decrypt PII (if `reveal`) or redact to null.
fn build_revealed(
    data: &Value,
    fields_by_key: &HashMap<&str, &CustomFieldResponse>,
    key: &[u8; 32],
    reveal: bool,
) -> Result<HashMap<String, Value>, ApiError> {
    let mut out = HashMap::new();
    if let Some(map) = data.as_object() {
        for (k, v) in map {
            let is_pii = fields_by_key
                .get(k.as_str())
                .map(|f| f.is_pii)
                .unwrap_or(false);
            let value = if is_pii {
                if reveal {
                    decrypt_value(v, key)?
                } else {
                    Value::Null // redacted for non-authorized readers
                }
            } else {
                v.clone()
            };
            out.insert(k.clone(), value);
        }
    }
    Ok(out)
}

pub struct CustomEntry;

impl CustomEntry {
    /// Create a draft entry, resolving the type schema first. Direct callers
    /// (tests, non-HTTP code) use this; the HTTP handler resolves the schema in
    /// the validation seam and calls [`Self::create_with_schema`] to fetch once.
    pub async fn create(
        pool: &PgPool,
        enc_key: &[u8; 32],
        site_id: Uuid,
        type_key: &str,
        actor_id: Uuid,
        req: CustomEntryRequest,
    ) -> Result<CustomEntryResponse, ApiError> {
        let schema = resolve_schema(pool, site_id, type_key).await?;
        Self::create_with_schema(pool, enc_key, site_id, type_key, &schema, actor_id, req).await
    }

    /// Create a draft entry against an already-resolved schema. Returns it as
    /// seen by an authorized (PII-revealing) reader. The `validate_entry` gate
    /// is retained as a defensive check for direct callers; the HTTP path has
    /// already validated at the `ValidatedJson` boundary (#879).
    #[allow(clippy::too_many_arguments)]
    pub async fn create_with_schema(
        pool: &PgPool,
        enc_key: &[u8; 32],
        site_id: Uuid,
        type_key: &str,
        schema: &ResolvedSchema,
        actor_id: Uuid,
        req: CustomEntryRequest,
    ) -> Result<CustomEntryResponse, ApiError> {
        validate_entry(&schema.fields, &req)?;

        let (default_locale, locale_ids, title_value) =
            Self::resolve_locales_title(pool, site_id, schema, &req).await?;

        let env_id: Uuid =
            sqlx::query_scalar("SELECT id FROM environments WHERE is_default = TRUE LIMIT 1")
                .fetch_one(pool)
                .await?;

        let mut tx = pool.begin().await?;

        let content_row = sqlx::query(
            "INSERT INTO contents (entity_type_id, environment_id, slug, status, created_by, updated_by)
             VALUES ($1, $2, $3, 'draft', $4, $4)
             RETURNING id, status, published_at, created_at, updated_at, slug::text AS slug",
        )
        .bind(schema.entity_type_id)
        .bind(env_id)
        .bind(req.slug.as_deref())
        .bind(actor_id.to_string())
        .fetch_one(&mut *tx)
        .await?;
        let content_id: Uuid = content_row.get("id");

        sqlx::query(
            "INSERT INTO content_sites (content_id, site_id, is_owner) VALUES ($1, $2, TRUE)",
        )
        .bind(content_id)
        .bind(site_id)
        .execute(&mut *tx)
        .await?;

        Self::write_payload(
            &mut tx,
            schema,
            content_id,
            &req,
            enc_key,
            default_locale,
            &locale_ids,
            &title_value,
            1,
            actor_id,
        )
        .await?;

        tx.commit().await?;

        Self::read(pool, enc_key, site_id, type_key, content_id, true).await
    }

    /// Resolve the default locale, the code→id map for provided locales, and
    /// the entry's title value. Shared by create and update.
    async fn resolve_locales_title(
        pool: &PgPool,
        site_id: Uuid,
        schema: &ResolvedSchema,
        req: &CustomEntryRequest,
    ) -> Result<(Uuid, HashMap<String, Uuid>, String), ApiError> {
        let title_field = schema.fields.iter().find(|f| f.is_title).ok_or_else(|| {
            ApiError::validation("type has no title field")
                .with_code(codes::ERR_CUSTOM_FIELD_TITLE_REQUIRED)
        })?;

        let default_locale: Uuid = sqlx::query_scalar(
            "SELECT COALESCE(
                 (SELECT default_locale_id FROM sites WHERE id = $1),
                 (SELECT id FROM locales WHERE code = 'en'),
                 (SELECT id FROM locales ORDER BY code LIMIT 1)
             )",
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;

        let codes: Vec<String> = req.localized.keys().cloned().collect();
        let locale_ids: HashMap<String, Uuid> =
            sqlx::query("SELECT id, code FROM locales WHERE code = ANY($1)")
                .bind(&codes)
                .fetch_all(pool)
                .await?
                .iter()
                .map(|r| (r.get::<String, _>("code"), r.get::<Uuid, _>("id")))
                .collect();

        let title_value = if title_field.localized {
            req.localized
                .iter()
                .find_map(|(code, vals)| {
                    if locale_ids.get(code) == Some(&default_locale) {
                        vals.get(&title_field.key).and_then(Value::as_str)
                    } else {
                        None
                    }
                })
                .or_else(|| {
                    req.localized
                        .values()
                        .find_map(|vals| vals.get(&title_field.key).and_then(Value::as_str))
                })
                .map(str::to_string)
        } else {
            req.shared
                .get(&title_field.key)
                .and_then(Value::as_str)
                .map(str::to_string)
        }
        .ok_or_else(|| {
            ApiError::validation(format!("title field '{}' is required", title_field.key))
                .with_code(codes::ERR_CUSTOM_ENTRY_REQUIRED_FIELD)
        })?;

        Ok((default_locale, locale_ids, title_value))
    }

    /// Write all value rows for an entry (shared + localized values, the
    /// per-locale title routed to content_localizations, cross-entry unique
    /// bookkeeping, and a version snapshot). Used by create and update.
    #[allow(clippy::too_many_arguments)]
    async fn write_payload(
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        schema: &ResolvedSchema,
        content_id: Uuid,
        req: &CustomEntryRequest,
        enc_key: &[u8; 32],
        default_locale: Uuid,
        locale_ids: &HashMap<String, Uuid>,
        title_value: &str,
        version_number: i16,
        actor_id: Uuid,
    ) -> Result<(), ApiError> {
        let fields_by_key: HashMap<&str, &CustomFieldResponse> =
            schema.fields.iter().map(|f| (f.key.as_str(), f)).collect();
        let title_field = schema
            .fields
            .iter()
            .find(|f| f.is_title)
            .expect("title field");

        // Upserts (not plain inserts) so update() can merge: shared values are
        // fully replaced, provided locales overwritten, untouched locales kept.
        let shared_stored = build_stored(&req.shared, &fields_by_key, &title_field.key, enc_key)?;
        sqlx::query(
            "INSERT INTO custom_entry_values (content_id, data) VALUES ($1, $2)
             ON CONFLICT (content_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()",
        )
        .bind(content_id)
        .bind(Value::Object(shared_stored.clone()))
        .execute(&mut **tx)
        .await?;

        let mut localized_stored: HashMap<String, Map<String, Value>> = HashMap::new();
        let mut locales_to_write: HashMap<Uuid, String> = HashMap::new();
        locales_to_write.insert(default_locale, title_value.to_string());
        for (code, vals) in &req.localized {
            if let Some(&lid) = locale_ids.get(code) {
                let stored = build_stored(vals, &fields_by_key, &title_field.key, enc_key)?;
                localized_stored.insert(code.clone(), stored);
                let loc_title = if title_field.localized {
                    vals.get(&title_field.key)
                        .and_then(Value::as_str)
                        .unwrap_or(title_value)
                        .to_string()
                } else {
                    title_value.to_string()
                };
                locales_to_write.insert(lid, loc_title);
            }
        }

        for (locale_id, title) in &locales_to_write {
            sqlx::query(
                "INSERT INTO content_localizations (content_id, locale_id, title)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (content_id, locale_id)
                 DO UPDATE SET title = EXCLUDED.title, updated_at = NOW()",
            )
            .bind(content_id)
            .bind(locale_id)
            .bind(title)
            .execute(&mut **tx)
            .await?;
        }
        for (code, stored) in &localized_stored {
            if let Some(&lid) = locale_ids.get(code) {
                sqlx::query(
                    "INSERT INTO custom_entry_localizations (content_id, locale_id, data)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (content_id, locale_id)
                     DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()",
                )
                .bind(content_id)
                .bind(lid)
                .bind(Value::Object(stored.clone()))
                .execute(&mut **tx)
                .await?;
            }
        }

        for field in schema.fields.iter().filter(|f| f.is_unique) {
            if field.localized {
                for (code, vals) in &req.localized {
                    if let (Some(&lid), Some(v)) = (locale_ids.get(code), vals.get(&field.key)) {
                        Self::insert_unique(
                            tx,
                            schema.custom_type_id,
                            &field.key,
                            Some(lid),
                            v,
                            content_id,
                        )
                        .await?;
                    }
                }
            } else if let Some(v) = req.shared.get(&field.key) {
                Self::insert_unique(tx, schema.custom_type_id, &field.key, None, v, content_id)
                    .await?;
            }
        }

        let snapshot = json!({
            "shared": Value::Object(shared_stored),
            "localized": localized_stored,
            "title": title_value,
        });
        // NB: content_versions.created_by is UUID (legacy), unlike
        // contents.created_by which is TEXT (Clerk id) — bind the Uuid directly.
        sqlx::query(
            "INSERT INTO content_versions (content_id, version_number, snapshot, created_by)
             VALUES ($1, $2, $3, $4)",
        )
        .bind(content_id)
        .bind(version_number)
        .bind(snapshot)
        .bind(actor_id)
        .execute(&mut **tx)
        .await?;
        Ok(())
    }

    /// Verify a content row is a live entry of `type_key` owned by `site_id`,
    /// returning the resolved schema. 404 otherwise.
    async fn resolve_entry(
        pool: &PgPool,
        site_id: Uuid,
        type_key: &str,
        content_id: Uuid,
    ) -> Result<ResolvedSchema, ApiError> {
        let schema = resolve_schema(pool, site_id, type_key).await?;
        Self::verify_entry_exists(pool, site_id, &schema, content_id).await?;
        Ok(schema)
    }

    /// Assert that `content_id` is a live entry of the given resolved schema's
    /// type, owned by `site_id`. 404 otherwise. Split from [`Self::resolve_entry`]
    /// so the validation seam can resolve the schema once and still run the
    /// ownership check against it (#879).
    async fn verify_entry_exists(
        pool: &PgPool,
        site_id: Uuid,
        schema: &ResolvedSchema,
        content_id: Uuid,
    ) -> Result<(), ApiError> {
        let ok: bool = sqlx::query_scalar(
            "SELECT EXISTS(
                 SELECT 1 FROM contents c
                 JOIN content_sites cs ON cs.content_id = c.id AND cs.site_id = $2
                 WHERE c.id = $1 AND c.entity_type_id = $3 AND c.is_deleted = FALSE
             )",
        )
        .bind(content_id)
        .bind(site_id)
        .bind(schema.entity_type_id)
        .fetch_one(pool)
        .await?;
        if !ok {
            return Err(
                ApiError::not_found("entry not found").with_code(codes::ERR_CUSTOM_TYPE_NOT_FOUND)
            );
        }
        Ok(())
    }

    /// Paginated list of entries for a type, newest first, optional status filter.
    pub async fn list(
        pool: &PgPool,
        site_id: Uuid,
        type_key: &str,
        status: Option<&str>,
        page: i64,
        page_size: i64,
    ) -> Result<(Vec<crate::dto::custom_entry::CustomEntrySummary>, i64), ApiError> {
        use crate::dto::custom_entry::CustomEntrySummary;
        let schema = resolve_schema(pool, site_id, type_key).await?;
        let offset = (page.max(1) - 1) * page_size;

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM contents c
             JOIN content_sites cs ON cs.content_id = c.id AND cs.site_id = $2
             WHERE c.entity_type_id = $1 AND c.is_deleted = FALSE
               AND ($3::text IS NULL OR c.status::text = $3)",
        )
        .bind(schema.entity_type_id)
        .bind(site_id)
        .bind(status)
        .fetch_one(pool)
        .await?;

        let rows = sqlx::query(
            "SELECT c.id, c.slug::text AS slug, c.status::text AS status, c.published_at, c.updated_at,
                    (SELECT cl.title FROM content_localizations cl
                       WHERE cl.content_id = c.id ORDER BY cl.created_at LIMIT 1) AS title
               FROM contents c
               JOIN content_sites cs ON cs.content_id = c.id AND cs.site_id = $2
              WHERE c.entity_type_id = $1 AND c.is_deleted = FALSE
                AND ($3::text IS NULL OR c.status::text = $3)
              ORDER BY c.updated_at DESC
              LIMIT $4 OFFSET $5",
        )
        .bind(schema.entity_type_id)
        .bind(site_id)
        .bind(status)
        .bind(page_size)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        let items = rows
            .iter()
            .map(|r| CustomEntrySummary {
                id: r.get("id"),
                slug: r.get("slug"),
                status: r.get("status"),
                title: r.get("title"),
                published_at: r.get("published_at"),
                updated_at: r.get("updated_at"),
            })
            .collect();
        Ok((items, total))
    }

    /// Replace an entry's values + localizations atomically, bumping the
    /// version. Other entries are untouched. The schema is resolved once in the
    /// validation seam and threaded in (#879); this method verifies the entry's
    /// existence against it rather than re-fetching. `validate_entry` is kept as
    /// a defensive gate — the HTTP path already validated at the boundary.
    #[allow(clippy::too_many_arguments)]
    pub async fn update(
        pool: &PgPool,
        enc_key: &[u8; 32],
        site_id: Uuid,
        type_key: &str,
        content_id: Uuid,
        schema: &ResolvedSchema,
        actor_id: Uuid,
        req: CustomEntryRequest,
    ) -> Result<CustomEntryResponse, ApiError> {
        Self::verify_entry_exists(pool, site_id, schema, content_id).await?;
        validate_entry(&schema.fields, &req)?;
        let (default_locale, locale_ids, title_value) =
            Self::resolve_locales_title(pool, site_id, schema, &req).await?;

        let next_version: i16 = sqlx::query_scalar(
            "SELECT (COALESCE(MAX(version_number), 0) + 1)::smallint FROM content_versions WHERE content_id = $1",
        )
        .bind(content_id)
        .fetch_one(pool)
        .await?;

        let mut tx = pool.begin().await?;
        // Merge semantics: write_payload upserts shared values (full replace)
        // and the provided locales, leaving untouched locales intact. Only the
        // unique-value bookkeeping is rebuilt for the supplied buckets.
        sqlx::query("DELETE FROM custom_entry_unique_values WHERE content_id = $1")
            .bind(content_id)
            .execute(&mut *tx)
            .await?;
        if let Some(slug) = &req.slug {
            sqlx::query("UPDATE contents SET slug = $2, updated_by = $3 WHERE id = $1")
                .bind(content_id)
                .bind(slug)
                .bind(actor_id.to_string())
                .execute(&mut *tx)
                .await?;
        }
        Self::write_payload(
            &mut tx,
            schema,
            content_id,
            &req,
            enc_key,
            default_locale,
            &locale_ids,
            &title_value,
            next_version,
            actor_id,
        )
        .await?;
        tx.commit().await?;
        Self::read(pool, enc_key, site_id, type_key, content_id, true).await
    }

    /// Publish an entry after the default-locale required-field gate passes.
    pub async fn publish(
        pool: &PgPool,
        enc_key: &[u8; 32],
        site_id: Uuid,
        type_key: &str,
        content_id: Uuid,
        actor_id: Uuid,
    ) -> Result<CustomEntryResponse, ApiError> {
        let schema = Self::resolve_entry(pool, site_id, type_key, content_id).await?;
        Self::ensure_publishable(pool, &schema, site_id, content_id).await?;
        sqlx::query(
            "UPDATE contents SET status = 'published', published_at = NOW(), updated_by = $2
             WHERE id = $1",
        )
        .bind(content_id)
        .bind(actor_id.to_string())
        .execute(pool)
        .await?;
        Self::read(pool, enc_key, site_id, type_key, content_id, true).await
    }

    /// Revert an entry to draft.
    pub async fn unpublish(
        pool: &PgPool,
        enc_key: &[u8; 32],
        site_id: Uuid,
        type_key: &str,
        content_id: Uuid,
        actor_id: Uuid,
    ) -> Result<CustomEntryResponse, ApiError> {
        Self::resolve_entry(pool, site_id, type_key, content_id).await?;
        sqlx::query(
            "UPDATE contents SET status = 'draft', published_at = NULL, updated_by = $2
             WHERE id = $1",
        )
        .bind(content_id)
        .bind(actor_id.to_string())
        .execute(pool)
        .await?;
        Self::read(pool, enc_key, site_id, type_key, content_id, true).await
    }

    /// Soft-delete an entry and release its unique-value reservations.
    pub async fn soft_delete(
        pool: &PgPool,
        site_id: Uuid,
        type_key: &str,
        content_id: Uuid,
        actor_id: Uuid,
    ) -> Result<(), ApiError> {
        Self::resolve_entry(pool, site_id, type_key, content_id).await?;
        let mut tx = pool.begin().await?;
        sqlx::query(
            "UPDATE contents SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $2
             WHERE id = $1",
        )
        .bind(content_id)
        .bind(actor_id.to_string())
        .execute(&mut *tx)
        .await?;
        sqlx::query("DELETE FROM custom_entry_unique_values WHERE content_id = $1")
            .bind(content_id)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        Ok(())
    }

    /// Default-locale required-field gate: every required field must have a
    /// value in the default locale (shared values, or the default-locale
    /// localization row). The designated title is always present.
    async fn ensure_publishable(
        pool: &PgPool,
        schema: &ResolvedSchema,
        site_id: Uuid,
        content_id: Uuid,
    ) -> Result<(), ApiError> {
        let default_locale: Uuid = sqlx::query_scalar(
            "SELECT COALESCE(
                 (SELECT default_locale_id FROM sites WHERE id = $1),
                 (SELECT id FROM locales WHERE code = 'en'),
                 (SELECT id FROM locales ORDER BY code LIMIT 1)
             )",
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;

        let shared: Value =
            sqlx::query_scalar("SELECT data FROM custom_entry_values WHERE content_id = $1")
                .bind(content_id)
                .fetch_optional(pool)
                .await?
                .unwrap_or_else(|| json!({}));
        let localized: Value = sqlx::query_scalar(
            "SELECT data FROM custom_entry_localizations WHERE content_id = $1 AND locale_id = $2",
        )
        .bind(content_id)
        .bind(default_locale)
        .fetch_optional(pool)
        .await?
        .unwrap_or_else(|| json!({}));

        for field in schema.fields.iter().filter(|f| f.required && !f.is_title) {
            let bucket = if field.localized { &localized } else { &shared };
            let present = bucket
                .get(&field.key)
                .map(|v| !v.is_null())
                .unwrap_or(false);
            if !present {
                return Err(ApiError::validation(format!(
                    "Required field '{}' is missing for the default locale",
                    field.key
                ))
                .with_code(codes::ERR_CUSTOM_ENTRY_REQUIRED_FIELD));
            }
        }
        Ok(())
    }

    async fn insert_unique(
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        custom_type_id: Uuid,
        field_key: &str,
        locale_id: Option<Uuid>,
        value: &Value,
        content_id: Uuid,
    ) -> Result<(), ApiError> {
        let norm = value
            .as_str()
            .map(str::to_string)
            .unwrap_or_else(|| value.to_string());
        let res = sqlx::query(
            "INSERT INTO custom_entry_unique_values
                (custom_type_id, field_key, locale_id, value_norm, content_id)
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(custom_type_id)
        .bind(field_key)
        .bind(locale_id)
        .bind(&norm)
        .bind(content_id)
        .execute(&mut **tx)
        .await;
        if let Err(e) = res {
            if e.as_database_error()
                .map(|d| d.is_unique_violation())
                .unwrap_or(false)
            {
                return Err(ApiError::conflict(format!(
                    "Another entry already uses '{norm}' for field '{field_key}'"
                ))
                .with_code(codes::ERR_CUSTOM_FIELD_UNIQUE_CONFLICT));
            }
            return Err(e.into());
        }
        Ok(())
    }

    /// Read one entry. `reveal` decrypts PII; otherwise PII fields are null.
    pub async fn read(
        pool: &PgPool,
        enc_key: &[u8; 32],
        site_id: Uuid,
        type_key: &str,
        content_id: Uuid,
        reveal: bool,
    ) -> Result<CustomEntryResponse, ApiError> {
        // Resolve (not just load_schema) so the content row is proven to belong
        // to this site + type before any data is read or PII is decrypted —
        // otherwise an entry_id from another tenant would leak across sites.
        let schema = Self::resolve_entry(pool, site_id, type_key, content_id).await?;
        let fields_by_key: HashMap<&str, &CustomFieldResponse> =
            schema.fields.iter().map(|f| (f.key.as_str(), f)).collect();
        let title_key = schema
            .fields
            .iter()
            .find(|f| f.is_title)
            .map(|f| f.key.clone());

        let content = sqlx::query(
            "SELECT status::text AS status, published_at, created_at, updated_at, slug::text AS slug
               FROM contents WHERE id = $1",
        )
        .bind(content_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found("entry not found").with_code(codes::ERR_CUSTOM_TYPE_NOT_FOUND)
        })?;

        let shared_data: Value =
            sqlx::query_scalar("SELECT data FROM custom_entry_values WHERE content_id = $1")
                .bind(content_id)
                .fetch_optional(pool)
                .await?
                .unwrap_or_else(|| json!({}));
        let mut shared = build_revealed(&shared_data, &fields_by_key, enc_key, reveal)?;

        // Re-inject the shared title from content_localizations (default locale).
        let mut localized: HashMap<String, HashMap<String, Value>> = HashMap::new();
        let loc_rows = sqlx::query(
            "SELECT l.code AS code, cl.title AS title, ev.data AS data
               FROM content_localizations cl
               JOIN locales l ON l.id = cl.locale_id
               LEFT JOIN custom_entry_localizations ev
                 ON ev.content_id = cl.content_id AND ev.locale_id = cl.locale_id
              WHERE cl.content_id = $1",
        )
        .bind(content_id)
        .fetch_all(pool)
        .await?;

        let title_localized = title_key
            .as_ref()
            .and_then(|k| fields_by_key.get(k.as_str()))
            .map(|f| f.localized)
            .unwrap_or(false);

        for row in &loc_rows {
            let code: String = row.get("code");
            let title: String = row.get("title");
            let data: Option<Value> = row.get("data");
            let mut vals = match data {
                Some(d) => build_revealed(&d, &fields_by_key, enc_key, reveal)?,
                None => HashMap::new(),
            };
            if title_localized {
                if let Some(k) = &title_key {
                    vals.insert(k.clone(), Value::from(title.clone()));
                }
            }
            if !vals.is_empty() {
                localized.insert(code, vals);
            }
        }
        // Shared title: pick any localization's title (they share it).
        if !title_localized {
            if let (Some(k), Some(row)) = (&title_key, loc_rows.first()) {
                shared.insert(k.clone(), Value::from(row.get::<String, _>("title")));
            }
        }

        Ok(CustomEntryResponse {
            id: content_id,
            type_key: type_key.to_string(),
            slug: content.get("slug"),
            status: content.get("status"),
            published_at: content.get("published_at"),
            shared,
            localized,
            created_at: content.get("created_at"),
            updated_at: content.get("updated_at"),
        })
    }

    /// GDPR retention purge (#794): hard-delete entries older than their type's
    /// `retention_days`. NULL/0 retention is never purged. Cascades remove the
    /// value/localization/unique rows. Returns the number purged.
    pub async fn purge_expired(pool: &PgPool) -> Result<u64, ApiError> {
        let res = sqlx::query(
            "DELETE FROM contents c
               USING custom_types ct
              WHERE ct.entity_type_id = c.entity_type_id
                AND ct.retention_days IS NOT NULL AND ct.retention_days > 0
                AND c.created_at < NOW() - (ct.retention_days * INTERVAL '1 day')",
        )
        .execute(pool)
        .await?;
        Ok(res.rows_affected())
    }

    /// GDPR erasure (#794): strip every PII field's value from an entry's
    /// shared + localized data and release its unique reservations, then write
    /// an audit record. Non-PII values are preserved.
    pub async fn erase_pii(
        pool: &PgPool,
        site_id: Uuid,
        type_key: &str,
        content_id: Uuid,
        actor_id: Uuid,
    ) -> Result<(), ApiError> {
        let schema = Self::resolve_entry(pool, site_id, type_key, content_id).await?;
        let pii_keys: Vec<String> = schema
            .fields
            .iter()
            .filter(|f| f.is_pii)
            .map(|f| f.key.clone())
            .collect();
        if pii_keys.is_empty() {
            return Ok(());
        }

        let mut tx = pool.begin().await?;
        // `data - text[]` removes each PII key from the JSONB object.
        sqlx::query(
            "UPDATE custom_entry_values SET data = data - $2::text[] WHERE content_id = $1",
        )
        .bind(content_id)
        .bind(&pii_keys)
        .execute(&mut *tx)
        .await?;
        sqlx::query(
            "UPDATE custom_entry_localizations SET data = data - $2::text[] WHERE content_id = $1",
        )
        .bind(content_id)
        .bind(&pii_keys)
        .execute(&mut *tx)
        .await?;
        sqlx::query(
            "DELETE FROM custom_entry_unique_values
              WHERE content_id = $1 AND field_key = ANY($2)",
        )
        .bind(content_id)
        .bind(&pii_keys)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;

        // Accountability: record who erased what (entity_type is dynamic TEXT).
        crate::models::audit::AuditLog::create_returning_id(
            pool,
            Some(site_id),
            Some(actor_id),
            crate::models::audit::AuditAction::Delete,
            "custom_entry_pii_erasure",
            content_id,
            Some(serde_json::json!({ "type_key": type_key, "fields": pii_keys })),
        )
        .await
        .map_err(ApiError::from)?;
        Ok(())
    }
}
