//! Custom-type schema model (#791).
//!
//! Business logic for defining and editing user content types. Validation
//! that needs no database (duplicate keys, exactly-one-title, enum options,
//! PII legal basis, regex compilation, structural caps) lives in the pure
//! [`validate_fields`] function so it can be unit-tested without a pool.
//! Database-bound checks (reserved names, per-site key uniqueness, type
//! count) live in the create/update flows.

use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::dto::custom_type::{
    CreateCustomTypeRequest, CustomContentKind, CustomFieldInput, CustomFieldResponse,
    CustomFieldType, CustomTypeResponse, CustomTypeSummary, UpdateCustomTypeRequest,
};
use crate::errors::{codes, ApiError};

/// Structural caps (#791). Hard limits, not per-site configurable.
pub const MAX_TYPES_PER_SITE: i64 = 100;
pub const MAX_FIELDS_PER_TYPE: usize = 100;
pub const MAX_ENUM_OPTIONS: usize = 100;

/// Pure schema validation: everything checkable without touching the DB.
/// Returns the first violation as a 4xx `ApiError` with the documented code.
pub fn validate_fields(fields: &[CustomFieldInput]) -> Result<(), ApiError> {
    if fields.len() > MAX_FIELDS_PER_TYPE {
        return Err(ApiError::validation(format!(
            "A type may have at most {MAX_FIELDS_PER_TYPE} fields"
        ))
        .with_code(codes::ERR_CUSTOM_FIELD_LIMIT));
    }

    // Duplicate field keys (case-insensitive, matching the CITEXT column).
    let mut seen = std::collections::HashSet::new();
    for f in fields {
        if !seen.insert(f.key.to_lowercase()) {
            return Err(
                ApiError::validation(format!("Duplicate field key '{}'", f.key))
                    .with_code(codes::ERR_CUSTOM_FIELD_DUPLICATE_KEY),
            );
        }
    }

    // Exactly one designated title field.
    let title_count = fields.iter().filter(|f| f.is_title).count();
    if title_count != 1 {
        return Err(
            ApiError::validation("A type must designate exactly one title field")
                .with_code(codes::ERR_CUSTOM_FIELD_TITLE_REQUIRED),
        );
    }

    for f in fields {
        // Enum fields must declare at least one (and at most MAX) option.
        if f.field_type == CustomFieldType::Enum {
            match &f.enum_options {
                Some(opts) if !opts.is_empty() => {
                    if opts.len() > MAX_ENUM_OPTIONS {
                        return Err(ApiError::validation(format!(
                            "Field '{}' has more than {MAX_ENUM_OPTIONS} enum options",
                            f.key
                        ))
                        .with_code(codes::ERR_CUSTOM_FIELD_LIMIT));
                    }
                }
                _ => {
                    return Err(ApiError::validation(format!(
                        "Enum field '{}' must declare at least one option",
                        f.key
                    ))
                    .with_code(codes::ERR_CUSTOM_FIELD_ENUM_OPTIONS_MISSING));
                }
            }
        }

        // PII fields need a legal basis (GDPR Art. 6).
        if f.is_pii && f.legal_basis.as_deref().unwrap_or("").trim().is_empty() {
            return Err(ApiError::validation(format!(
                "PII field '{}' must declare a legal basis",
                f.key
            ))
            .with_code(codes::ERR_CUSTOM_FIELD_LEGAL_BASIS_MISSING));
        }

        // Patterns must compile with the linear-time `regex` crate.
        if let Some(pattern) = &f.pattern {
            if regex::Regex::new(pattern).is_err() {
                return Err(ApiError::validation(format!(
                    "Field '{}' has an invalid regex pattern",
                    f.key
                ))
                .with_code(codes::ERR_CUSTOM_FIELD_INVALID_PATTERN));
            }
        }
    }

    Ok(())
}

/// The built-in entity-type names a custom key may not collide with. Read
/// from the registry (site_id IS NULL) so it stays correct if built-ins grow.
async fn reserved_names(pool: &PgPool) -> Result<Vec<String>, ApiError> {
    let rows = sqlx::query("SELECT name::text AS name FROM entity_types WHERE site_id IS NULL")
        .fetch_all(pool)
        .await?;
    Ok(rows.iter().map(|r| r.get::<String, _>("name")).collect())
}

/// Insert all field rows for a type inside an existing transaction.
async fn insert_fields(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    custom_type_id: Uuid,
    fields: &[CustomFieldInput],
) -> Result<(), ApiError> {
    for f in fields {
        let enum_options = f.enum_options.as_ref().map(|o| serde_json::json!(o));
        sqlx::query(
            "INSERT INTO custom_type_fields
                (custom_type_id, key, label, labels, field_type, required, localized,
                 is_title, is_pii, data_category, processing_purpose, legal_basis,
                 enum_options, min_value, max_value, min_length, max_length, pattern,
                 is_unique, display_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)",
        )
        .bind(custom_type_id)
        .bind(&f.key)
        .bind(&f.label)
        .bind(&f.labels)
        .bind(f.field_type)
        .bind(f.required)
        .bind(f.localized)
        .bind(f.is_title)
        .bind(f.is_pii)
        .bind(&f.data_category)
        .bind(&f.processing_purpose)
        .bind(&f.legal_basis)
        .bind(enum_options)
        .bind(f.min)
        .bind(f.max)
        .bind(f.min_length)
        .bind(f.max_length)
        .bind(&f.pattern)
        .bind(f.is_unique)
        .bind(f.display_order)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

/// Normalise a stored enum-options JSON array to the `Option<Vec<String>>`
/// shape the field input uses, so the two can be compared structurally.
fn enum_options_vec(v: &Option<serde_json::Value>) -> Option<Vec<String>> {
    v.as_ref().and_then(|val| {
        val.as_array().map(|a| {
            a.iter()
                .filter_map(|x| x.as_str().map(String::from))
                .collect()
        })
    })
}

/// True when `input` changes the data/validation contract of `prior` —
/// i.e. anything except presentation (display_order, label, labels). Drives
/// the schema_version bump: reordering or relabelling fields must not bump it.
fn field_shape_changed(prior: &CustomFieldResponse, input: &CustomFieldInput) -> bool {
    prior.key != input.key
        || prior.field_type != input.field_type
        || prior.required != input.required
        || prior.localized != input.localized
        || prior.is_title != input.is_title
        || prior.is_pii != input.is_pii
        || prior.is_unique != input.is_unique
        || enum_options_vec(&prior.enum_options) != input.enum_options
        || prior.min != input.min
        || prior.max != input.max
        || prior.min_length != input.min_length
        || prior.max_length != input.max_length
        || prior.pattern != input.pattern
        || prior.data_category != input.data_category
        || prior.legal_basis != input.legal_basis
        || prior.processing_purpose != input.processing_purpose
}

fn field_type_str(ft: CustomFieldType) -> &'static str {
    match ft {
        CustomFieldType::Text => "text",
        CustomFieldType::Richtext => "richtext",
        CustomFieldType::Number => "number",
        CustomFieldType::Boolean => "boolean",
        CustomFieldType::Date => "date",
        CustomFieldType::Enum => "enum",
        CustomFieldType::Media => "media",
    }
}

/// Can a stored JSON value coerce to the target field type? Drives the
/// retype-compatibility gate. Text accepts anything; the rest must parse.
fn value_coerces(
    v: &serde_json::Value,
    target: CustomFieldType,
    enum_options: Option<&[String]>,
) -> bool {
    match target {
        CustomFieldType::Text | CustomFieldType::Richtext => true,
        CustomFieldType::Number => {
            v.is_number()
                || v.as_str()
                    .map(|s| s.parse::<f64>().is_ok())
                    .unwrap_or(false)
        }
        CustomFieldType::Boolean => {
            v.is_boolean() || matches!(v.as_str(), Some("true") | Some("false"))
        }
        CustomFieldType::Date => v
            .as_str()
            .map(|s| {
                chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok()
                    || chrono::DateTime::parse_from_rfc3339(s).is_ok()
            })
            .unwrap_or(false),
        CustomFieldType::Enum => v
            .as_str()
            .map(|s| {
                enum_options
                    .map(|o| o.iter().any(|x| x == s))
                    .unwrap_or(false)
            })
            .unwrap_or(false),
        CustomFieldType::Media => v
            .as_str()
            .map(|s| Uuid::parse_str(s).is_ok())
            .unwrap_or(false),
    }
}

/// Apply one field's evolution in place: rename (migrate stored JSONB keys),
/// retype (only if live values coerce), optional→required (only if no entry
/// lacks the value), then update the row.
async fn evolve_field(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    entity_type_id: Uuid,
    custom_type_id: Uuid,
    field_id: Uuid,
    prior: &CustomFieldResponse,
    input: &CustomFieldInput,
) -> Result<(), ApiError> {
    // Stored values for this field live in the localization table iff the
    // field was localized; localized-flag changes don't migrate tables (MVP).
    let table = if prior.localized {
        "custom_entry_localizations"
    } else {
        "custom_entry_values"
    };
    let new_type = field_type_str(input.field_type);

    // optional → required: reject if any live entry lacks the value.
    if input.required && !prior.required {
        let missing: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM contents c
              WHERE c.entity_type_id = $1 AND c.is_deleted = FALSE
                AND NOT EXISTS (SELECT 1 FROM {table} t WHERE t.content_id = c.id AND t.data ? $2)"
        ))
        .bind(entity_type_id)
        .bind(&prior.key)
        .fetch_one(&mut **tx)
        .await?;
        if missing > 0 {
            return Err(ApiError::validation(format!(
                "Cannot make '{}' required: {missing} entries lack a value",
                prior.key
            ))
            .with_code(codes::ERR_CUSTOM_FIELD_REQUIRED_CONFLICT));
        }
    }

    // Retype: allow only when every existing value coerces (PII is encrypted
    // and not inspectable — allowed without a coercion check).
    if input.field_type != prior.field_type && !input.is_pii {
        let values: Vec<serde_json::Value> = sqlx::query_scalar(&format!(
            "SELECT DISTINCT t.data -> $2 FROM {table} t
               JOIN contents c ON c.id = t.content_id
              WHERE c.entity_type_id = $1 AND t.data ? $2"
        ))
        .bind(entity_type_id)
        .bind(&prior.key)
        .fetch_all(&mut **tx)
        .await?;
        let enum_opts = input.enum_options.clone();
        let opts_ref = enum_opts.as_deref();
        if !values
            .iter()
            .all(|v| value_coerces(v, input.field_type, opts_ref))
        {
            return Err(ApiError::validation(format!(
                "Cannot retype '{}' to {new_type}: existing values are not coercible",
                prior.key
            ))
            .with_code(codes::ERR_CUSTOM_FIELD_RETYPE_INCOMPATIBLE));
        }
    }

    // Rename: migrate stored JSONB keys + unique bookkeeping.
    if input.key != prior.key {
        sqlx::query(&format!(
            "UPDATE {table} t
                SET data = (t.data - $2) || jsonb_build_object($3, t.data -> $2)
              WHERE t.data ? $2
                AND t.content_id IN (SELECT id FROM contents WHERE entity_type_id = $1)"
        ))
        .bind(entity_type_id)
        .bind(&prior.key)
        .bind(&input.key)
        .execute(&mut **tx)
        .await?;
        sqlx::query(
            "UPDATE custom_entry_unique_values SET field_key = $3
              WHERE custom_type_id = $1 AND field_key = $2",
        )
        .bind(custom_type_id)
        .bind(&prior.key)
        .bind(&input.key)
        .execute(&mut **tx)
        .await?;
    }

    // Update the field definition row.
    let enum_options = input.enum_options.as_ref().map(|o| serde_json::json!(o));
    sqlx::query(
        "UPDATE custom_type_fields SET
            key = $2, label = $3, labels = $4, field_type = $5, required = $6,
            localized = $7, is_title = $8, is_pii = $9, data_category = $10,
            processing_purpose = $11, legal_basis = $12, enum_options = $13,
            min_value = $14, max_value = $15, min_length = $16, max_length = $17,
            pattern = $18, is_unique = $19, display_order = $20
         WHERE id = $1",
    )
    .bind(field_id)
    .bind(&input.key)
    .bind(&input.label)
    .bind(&input.labels)
    .bind(input.field_type)
    .bind(input.required)
    .bind(input.localized)
    .bind(input.is_title)
    .bind(input.is_pii)
    .bind(&input.data_category)
    .bind(&input.processing_purpose)
    .bind(&input.legal_basis)
    .bind(enum_options)
    .bind(input.min)
    .bind(input.max)
    .bind(input.min_length)
    .bind(input.max_length)
    .bind(&input.pattern)
    .bind(input.is_unique)
    .bind(input.display_order)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

fn field_from_row(row: &sqlx::postgres::PgRow) -> CustomFieldResponse {
    CustomFieldResponse {
        id: row.get("id"),
        key: row.get("key"),
        label: row.get("label"),
        labels: row.get("labels"),
        field_type: row.get("field_type"),
        required: row.get("required"),
        localized: row.get("localized"),
        is_title: row.get("is_title"),
        is_pii: row.get("is_pii"),
        data_category: row.get("data_category"),
        processing_purpose: row.get("processing_purpose"),
        legal_basis: row.get("legal_basis"),
        enum_options: row.get("enum_options"),
        min: row.get("min"),
        max: row.get("max"),
        min_length: row.get("min_length"),
        max_length: row.get("max_length"),
        pattern: row.get("pattern"),
        is_unique: row.get("is_unique"),
        display_order: row.get("display_order"),
        deprecated_at: row.get("deprecated_at"),
    }
}

/// Custom-type schema operations. Stateless namespace (mirrors `Form`).
pub struct CustomType;

impl CustomType {
    /// Create a new type and its fields. Registers a per-site `entity_types`
    /// row so entries become first-class `contents`.
    pub async fn create(
        pool: &PgPool,
        site_id: Uuid,
        actor_id: Uuid,
        req: CreateCustomTypeRequest,
    ) -> Result<CustomTypeResponse, ApiError> {
        validate_fields(&req.fields)?;

        let key = req.key.trim().to_string();
        if reserved_names(pool)
            .await?
            .iter()
            .any(|n| n.eq_ignore_ascii_case(&key))
        {
            return Err(
                ApiError::validation(format!("'{key}' is a reserved built-in type name"))
                    .with_code(codes::ERR_CUSTOM_TYPE_RESERVED_NAME),
            );
        }

        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM custom_types WHERE site_id = $1")
            .bind(site_id)
            .fetch_one(pool)
            .await?;
        if count >= MAX_TYPES_PER_SITE {
            return Err(ApiError::validation(format!(
                "A site may have at most {MAX_TYPES_PER_SITE} custom types"
            ))
            .with_code(codes::ERR_CUSTOM_TYPE_LIMIT));
        }

        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM custom_types WHERE site_id = $1 AND key = $2)",
        )
        .bind(site_id)
        .bind(&key)
        .fetch_one(pool)
        .await?;
        if exists {
            return Err(ApiError::conflict(format!(
                "A custom type with key '{key}' already exists"
            ))
            .with_code(codes::ERR_CUSTOM_TYPE_KEY_TAKEN));
        }

        let mut tx = pool.begin().await?;

        let entity_type_id: Uuid = sqlx::query_scalar(
            "INSERT INTO entity_types (name, table_name, site_id, is_versionable, is_localizable, is_site_specific)
             VALUES ($1, 'custom_entry_values', $2, TRUE, TRUE, TRUE) RETURNING id",
        )
        .bind(&key)
        .bind(site_id)
        .fetch_one(&mut *tx)
        .await?;

        let custom_type_id: Uuid = sqlx::query_scalar(
            "INSERT INTO custom_types
                (entity_type_id, site_id, key, name, retention_days,
                 is_publicly_readable, content_kind, created_by, updated_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING id",
        )
        .bind(entity_type_id)
        .bind(site_id)
        .bind(&key)
        .bind(req.name.trim())
        .bind(req.retention_days)
        .bind(req.is_publicly_readable)
        .bind(req.content_kind)
        .bind(actor_id.to_string())
        .fetch_one(&mut *tx)
        .await?;

        insert_fields(&mut tx, custom_type_id, &req.fields).await?;
        tx.commit().await?;

        Self::get(pool, site_id, &key).await
    }

    pub async fn list(pool: &PgPool, site_id: Uuid) -> Result<Vec<CustomTypeSummary>, ApiError> {
        let rows = sqlx::query(
            "SELECT t.id, t.key::text AS key, t.name, t.content_kind,
                    t.is_publicly_readable, t.schema_version, t.created_at, t.updated_at,
                    (SELECT COUNT(*) FROM custom_type_fields f WHERE f.custom_type_id = t.id) AS field_count
               FROM custom_types t
              WHERE t.site_id = $1
              ORDER BY t.name",
        )
        .bind(site_id)
        .fetch_all(pool)
        .await?;

        Ok(rows
            .iter()
            .map(|r| CustomTypeSummary {
                id: r.get("id"),
                key: r.get("key"),
                name: r.get("name"),
                content_kind: r.get("content_kind"),
                is_publicly_readable: r.get("is_publicly_readable"),
                schema_version: r.get("schema_version"),
                field_count: r.get("field_count"),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            })
            .collect())
    }

    pub async fn get(
        pool: &PgPool,
        site_id: Uuid,
        key: &str,
    ) -> Result<CustomTypeResponse, ApiError> {
        let row = sqlx::query(
            "SELECT id, key::text AS key, name, retention_days, is_publicly_readable,
                    content_kind, schema_version, created_at, updated_at
               FROM custom_types WHERE site_id = $1 AND key = $2",
        )
        .bind(site_id)
        .bind(key)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("No custom type '{key}'"))
                .with_code(codes::ERR_CUSTOM_TYPE_NOT_FOUND)
        })?;

        let custom_type_id: Uuid = row.get("id");
        let field_rows = sqlx::query(
            "SELECT id, key::text AS key, label, labels, field_type, required, localized,
                    is_title, is_pii, data_category, processing_purpose, legal_basis,
                    enum_options, min_value AS min, max_value AS max, min_length, max_length,
                    pattern, is_unique, display_order, deprecated_at
               FROM custom_type_fields WHERE custom_type_id = $1 ORDER BY display_order, key",
        )
        .bind(custom_type_id)
        .fetch_all(pool)
        .await?;

        Ok(CustomTypeResponse {
            id: custom_type_id,
            site_id,
            key: row.get("key"),
            name: row.get("name"),
            retention_days: row.get("retention_days"),
            is_publicly_readable: row.get("is_publicly_readable"),
            content_kind: row.get("content_kind"),
            schema_version: row.get("schema_version"),
            fields: field_rows.iter().map(field_from_row).collect(),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    /// Safely evolve a type's header + field set (#800). Fields are diffed by
    /// id: existing ids are updated in place (rename migrates stored JSONB
    /// keys; retype is allowed only when live values coerce; optional→required
    /// is rejected when any entry lacks the value); fields without an id are
    /// added; existing fields absent from the request are soft-deprecated
    /// (deprecated_at), never hard-deleted — orphaned values stay readable.
    /// schema_version is bumped.
    pub async fn update(
        pool: &PgPool,
        site_id: Uuid,
        actor_id: Uuid,
        key: &str,
        req: UpdateCustomTypeRequest,
    ) -> Result<CustomTypeResponse, ApiError> {
        validate_fields(&req.fields)?;

        let type_row = sqlx::query(
            "SELECT id, entity_type_id, retention_days, is_publicly_readable, content_kind
               FROM custom_types WHERE site_id = $1 AND key = $2",
        )
        .bind(site_id)
        .bind(key)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("No custom type '{key}'"))
                .with_code(codes::ERR_CUSTOM_TYPE_NOT_FOUND)
        })?;
        let custom_type_id: Uuid = type_row.get("id");
        let entity_type_id: Uuid = type_row.get("entity_type_id");

        // Existing (non-deprecated) fields, by id — full rows so we can diff
        // the data contract (not just presentation) to decide the version bump.
        let field_rows = sqlx::query(
            "SELECT id, key::text AS key, label, labels, field_type, required, localized,
                    is_title, is_pii, data_category, processing_purpose, legal_basis,
                    enum_options, min_value AS min, max_value AS max, min_length, max_length,
                    pattern, is_unique, display_order, deprecated_at
               FROM custom_type_fields
              WHERE custom_type_id = $1 AND deprecated_at IS NULL
              ORDER BY display_order, key",
        )
        .bind(custom_type_id)
        .fetch_all(pool)
        .await?;
        let existing: Vec<CustomFieldResponse> = field_rows.iter().map(field_from_row).collect();
        let existing_by_id: std::collections::HashMap<Uuid, &CustomFieldResponse> =
            existing.iter().map(|f| (f.id, f)).collect();

        // A structural change is anything beyond reordering / relabelling:
        // a header-attribute change, a field added/removed, or a field whose
        // data contract changed. Only then does schema_version bump.
        let header_changed = type_row.get::<Option<i32>, _>("retention_days") != req.retention_days
            || type_row.get::<bool, _>("is_publicly_readable") != req.is_publicly_readable
            || type_row.get::<CustomContentKind, _>("content_kind") != req.content_kind;
        let req_ids: std::collections::HashSet<Uuid> =
            req.fields.iter().filter_map(|f| f.id).collect();
        let added_or_changed = req.fields.iter().any(|f| match f.id {
            Some(id) => existing_by_id
                .get(&id)
                .map(|prior| field_shape_changed(prior, f))
                .unwrap_or(true),
            None => true,
        });
        let removed = existing.iter().any(|e| !req_ids.contains(&e.id));
        let structural_change = header_changed || added_or_changed || removed;

        let mut tx = pool.begin().await?;
        sqlx::query(
            "UPDATE custom_types
                SET name = $2, retention_days = $3, is_publicly_readable = $4,
                    content_kind = $5, schema_version = schema_version + $7,
                    updated_by = $6
              WHERE id = $1",
        )
        .bind(custom_type_id)
        .bind(req.name.trim())
        .bind(req.retention_days)
        .bind(req.is_publicly_readable)
        .bind(req.content_kind)
        .bind(actor_id.to_string())
        .bind(i32::from(structural_change))
        .execute(&mut *tx)
        .await?;

        // Clear all title flags first so moving the title between fields can't
        // transiently trip the one-title-per-type partial unique index.
        sqlx::query("UPDATE custom_type_fields SET is_title = FALSE WHERE custom_type_id = $1")
            .bind(custom_type_id)
            .execute(&mut *tx)
            .await?;

        let mut kept_ids = std::collections::HashSet::new();
        for f in &req.fields {
            match f
                .id
                .and_then(|id| existing_by_id.get(&id).map(|e| (id, *e)))
            {
                Some((id, prior)) => {
                    kept_ids.insert(id);
                    evolve_field(&mut tx, entity_type_id, custom_type_id, id, prior, f).await?;
                }
                None => insert_fields(&mut tx, custom_type_id, std::slice::from_ref(f)).await?,
            }
        }
        // Fields no longer present → soft-deprecate (values remain readable).
        for prior in &existing {
            if !kept_ids.contains(&prior.id) {
                sqlx::query("UPDATE custom_type_fields SET deprecated_at = NOW() WHERE id = $1")
                    .bind(prior.id)
                    .execute(&mut *tx)
                    .await?;
            }
        }
        tx.commit().await?;

        Self::get(pool, site_id, key).await
    }

    /// Delete a type. Refuses (409) when entries exist unless `force`.
    pub async fn delete(
        pool: &PgPool,
        site_id: Uuid,
        key: &str,
        force: bool,
    ) -> Result<(), ApiError> {
        let row = sqlx::query(
            "SELECT id, entity_type_id FROM custom_types WHERE site_id = $1 AND key = $2",
        )
        .bind(site_id)
        .bind(key)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("No custom type '{key}'"))
                .with_code(codes::ERR_CUSTOM_TYPE_NOT_FOUND)
        })?;
        let entity_type_id: Uuid = row.get("entity_type_id");

        if !force {
            let entries: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM contents WHERE entity_type_id = $1 AND is_deleted = FALSE",
            )
            .bind(entity_type_id)
            .fetch_one(pool)
            .await?;
            if entries > 0 {
                return Err(ApiError::conflict(format!(
                    "Custom type '{key}' still has {entries} entries"
                ))
                .with_code(codes::ERR_CUSTOM_TYPE_IN_USE));
            }
        }

        // Cascades to custom_type_fields and the entity_types row (FK ON DELETE
        // CASCADE), and to any entries' contents via the entity_types cascade.
        sqlx::query("DELETE FROM custom_types WHERE id = $1")
            .bind(row.get::<Uuid, _>("id"))
            .execute(pool)
            .await?;
        sqlx::query("DELETE FROM entity_types WHERE id = $1")
            .bind(entity_type_id)
            .execute(pool)
            .await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn field(key: &str, ft: CustomFieldType, is_title: bool) -> CustomFieldInput {
        CustomFieldInput {
            id: None,
            key: key.to_string(),
            label: key.to_string(),
            labels: None,
            field_type: ft,
            required: false,
            localized: false,
            is_title,
            is_pii: false,
            data_category: None,
            processing_purpose: None,
            legal_basis: None,
            enum_options: None,
            min: None,
            max: None,
            min_length: None,
            max_length: None,
            pattern: None,
            is_unique: false,
            display_order: 0,
        }
    }

    #[test]
    fn accepts_a_minimal_valid_schema() {
        let fields = vec![field("title", CustomFieldType::Text, true)];
        assert!(validate_fields(&fields).is_ok());
    }

    #[test]
    fn rejects_duplicate_field_keys() {
        let fields = vec![
            field("title", CustomFieldType::Text, true),
            field("Title", CustomFieldType::Text, false),
        ];
        let err = validate_fields(&fields).unwrap_err();
        assert_eq!(err.code(), codes::ERR_CUSTOM_FIELD_DUPLICATE_KEY);
    }

    #[test]
    fn requires_exactly_one_title() {
        let none = vec![field("a", CustomFieldType::Text, false)];
        assert_eq!(
            validate_fields(&none).unwrap_err().code(),
            codes::ERR_CUSTOM_FIELD_TITLE_REQUIRED
        );
        let two = vec![
            field("a", CustomFieldType::Text, true),
            field("b", CustomFieldType::Text, true),
        ];
        assert_eq!(
            validate_fields(&two).unwrap_err().code(),
            codes::ERR_CUSTOM_FIELD_TITLE_REQUIRED
        );
    }

    #[test]
    fn enum_field_needs_options() {
        let fields = vec![field("kind", CustomFieldType::Enum, true)];
        assert_eq!(
            validate_fields(&fields).unwrap_err().code(),
            codes::ERR_CUSTOM_FIELD_ENUM_OPTIONS_MISSING
        );
    }

    #[test]
    fn pii_field_needs_legal_basis() {
        let mut f = field("email", CustomFieldType::Text, true);
        f.is_pii = true;
        let err = validate_fields(&[f]).unwrap_err();
        assert_eq!(err.code(), codes::ERR_CUSTOM_FIELD_LEGAL_BASIS_MISSING);
    }

    #[test]
    fn rejects_uncompilable_pattern() {
        let mut f = field("code", CustomFieldType::Text, true);
        f.pattern = Some("(".to_string());
        let err = validate_fields(&[f]).unwrap_err();
        assert_eq!(err.code(), codes::ERR_CUSTOM_FIELD_INVALID_PATTERN);
    }
}
