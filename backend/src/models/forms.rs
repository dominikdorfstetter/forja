//! Forms module model.
//!
//! Owns the SQL for `forms`, `form_fields`, and `form_templates`. Creating
//! and updating a form replaces its fields atomically inside a transaction
//! — callers see either the old field set or the new set, never a partial
//! state. Templates are independent: a form created from a template gets a
//! copy of the template fields, with no ongoing link to the template row.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::{PgPool, Postgres, Transaction};
use std::collections::HashSet;
use uuid::Uuid;

use crate::dto::forms::{
    CreateFormRequest, CreateFormTemplateRequest, FormBotProtection, FormDetailResponse,
    FormFieldInput, FormFieldLocalizationResponse, FormFieldResponse, FormFieldType, FormListItem,
    FormLocalizationInput, FormLocalizationResponse, FormStorageMode, FormTemplateResponse,
    UpdateFormRequest, UpdateFormTemplateRequest,
};
use crate::errors::codes;
use crate::errors::ApiError;
use crate::utils::list_params::ListParams;

/// One row in the `forms` table.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Form {
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
    pub is_deleted: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// One row in the `form_fields` table.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct FormField {
    pub id: Uuid,
    pub form_id: Uuid,
    pub label: String,
    pub field_type: FormFieldType,
    pub placeholder: Option<String>,
    pub help_text: Option<String>,
    pub validation: JsonValue,
    pub options: Option<JsonValue>,
    pub is_required: bool,
    pub display_order: i16,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// One row in the `form_templates` table.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct FormTemplate {
    pub id: Uuid,
    pub site_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub fields: JsonValue,
    pub consent_required: bool,
    pub consent_text: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Form {
    // ── Form CRUD ───────────────────────────────────────────────────────

    pub async fn create(
        pool: &PgPool,
        site_id: Uuid,
        req: CreateFormRequest,
    ) -> Result<FormDetailResponse, ApiError> {
        let mut tx = pool.begin().await?;

        // Resolve the field set: caller-supplied takes precedence over template.
        let fields = resolve_create_fields(&mut tx, site_id, &req).await?;
        ensure_unique_labels(&fields)?;

        let form = sqlx::query_as::<_, Form>(
            r#"
            INSERT INTO forms
                (site_id, name, slug, description, is_active, consent_required,
                 consent_text, bot_protection, storage_mode, retention_days)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, site_id, name, slug, description, is_active, consent_required,
                      consent_text, bot_protection, storage_mode, retention_days,
                      is_deleted, created_at, updated_at
            "#,
        )
        .bind(site_id)
        .bind(&req.name)
        .bind(&req.slug)
        .bind(&req.description)
        .bind(req.is_active)
        .bind(req.consent_required)
        .bind(&req.consent_text)
        .bind(req.bot_protection)
        .bind(req.storage_mode)
        .bind(req.retention_days)
        .fetch_one(&mut *tx)
        .await
        .map_err(map_slug_conflict)?;

        let inserted_fields = insert_fields(&mut tx, form.id, &fields).await?;
        // Field localizations come from the original FormFieldInput entries —
        // we match them back to the inserted rows by label (labels are unique
        // within a form, enforced by ensure_unique_labels above).
        replace_field_localizations(&mut tx, &inserted_fields, &fields).await?;
        replace_form_localizations(&mut tx, form.id, &req.localizations).await?;
        let field_locs = fetch_all_field_localizations(&mut *tx, form.id).await?;
        let form_locs = fetch_form_localizations(&mut *tx, form.id).await?;
        tx.commit().await?;

        Ok(detail_from(form, inserted_fields, field_locs, form_locs))
    }

    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<FormDetailResponse, ApiError> {
        let form = fetch_form_row(pool, id).await?;
        let fields = fetch_fields(pool, id).await?;
        let mut conn = pool.acquire().await?;
        let field_locs = fetch_all_field_localizations(&mut *conn, id).await?;
        let form_locs = fetch_form_localizations(&mut *conn, id).await?;
        Ok(detail_from(form, fields, field_locs, form_locs))
    }

    pub async fn find_by_slug(
        pool: &PgPool,
        site_id: Uuid,
        slug: &str,
    ) -> Result<FormDetailResponse, ApiError> {
        let form = sqlx::query_as::<_, Form>(
            r#"
            SELECT id, site_id, name, slug, description, is_active, consent_required,
                   consent_text, bot_protection, storage_mode, retention_days,
                   is_deleted, created_at, updated_at
              FROM forms
             WHERE site_id = $1 AND slug = $2 AND NOT is_deleted
            "#,
        )
        .bind(site_id)
        .bind(slug)
        .fetch_optional(pool)
        .await?
        .ok_or_else(form_not_found)?;

        let fields = fetch_fields(pool, form.id).await?;
        let mut conn = pool.acquire().await?;
        let field_locs = fetch_all_field_localizations(&mut *conn, form.id).await?;
        let form_locs = fetch_form_localizations(&mut *conn, form.id).await?;
        Ok(detail_from(form, fields, field_locs, form_locs))
    }

    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdateFormRequest,
    ) -> Result<FormDetailResponse, ApiError> {
        let mut tx = pool.begin().await?;
        let existing = fetch_form_row_tx(&mut tx, id).await?;

        let form = sqlx::query_as::<_, Form>(
            r#"
            UPDATE forms SET
                name             = COALESCE($2, name),
                slug             = COALESCE($3, slug),
                description      = COALESCE($4, description),
                is_active        = COALESCE($5, is_active),
                consent_required = COALESCE($6, consent_required),
                consent_text     = COALESCE($7, consent_text),
                bot_protection   = COALESCE($8, bot_protection),
                storage_mode     = COALESCE($9, storage_mode),
                retention_days   = COALESCE($10, retention_days),
                updated_at       = NOW()
              WHERE id = $1 AND NOT is_deleted
            RETURNING id, site_id, name, slug, description, is_active, consent_required,
                      consent_text, bot_protection, storage_mode, retention_days,
                      is_deleted, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&req.name)
        .bind(&req.slug)
        .bind(&req.description)
        .bind(req.is_active)
        .bind(req.consent_required)
        .bind(&req.consent_text)
        .bind(req.bot_protection)
        .bind(req.storage_mode)
        .bind(req.retention_days)
        .fetch_optional(&mut *tx)
        .await
        .map_err(map_slug_conflict)?
        .ok_or_else(form_not_found)?;

        let (fields, replaced_fields) = if let Some(new_fields) = req.fields {
            ensure_unique_labels(&new_fields)?;
            sqlx::query("DELETE FROM form_fields WHERE form_id = $1")
                .bind(id)
                .execute(&mut *tx)
                .await?;
            let rows = insert_fields(&mut tx, id, &new_fields).await?;
            // Field localizations are tied to field IDs; the old IDs are gone
            // after the DELETE above, so any pre-existing field_localizations
            // rows were dropped by the FK cascade. Re-seed them from the
            // incoming input.
            replace_field_localizations(&mut tx, &rows, &new_fields).await?;
            (rows, true)
        } else {
            // Refetch existing fields inside tx so we return a consistent snapshot.
            let rows = sqlx::query_as::<_, FormField>(
                r#"
                SELECT id, form_id, label, field_type, placeholder, help_text,
                       validation, options, is_required, display_order,
                       created_at, updated_at
                  FROM form_fields
                 WHERE form_id = $1
                 ORDER BY display_order, label
                "#,
            )
            .bind(id)
            .fetch_all(&mut *tx)
            .await?;
            (rows, false)
        };
        let _ = replaced_fields;

        if let Some(form_locs) = req.localizations.as_ref() {
            replace_form_localizations(&mut tx, id, form_locs).await?;
        }

        let field_locs = fetch_all_field_localizations(&mut *tx, id).await?;
        let form_locs = fetch_form_localizations(&mut *tx, id).await?;

        let _ = existing;
        tx.commit().await?;
        Ok(detail_from(form, fields, field_locs, form_locs))
    }

    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("UPDATE forms SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1 AND NOT is_deleted")
            .bind(id)
            .execute(pool)
            .await?;
        if result.rows_affected() == 0 {
            return Err(form_not_found());
        }
        Ok(())
    }

    pub async fn list_for_site(
        pool: &PgPool,
        site_id: Uuid,
        params: &ListParams,
    ) -> Result<(Vec<FormListItem>, i64), ApiError> {
        let (limit, offset) = params.limit_offset();

        let total: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*) FROM forms WHERE site_id = $1 AND NOT is_deleted"#,
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;

        let rows = sqlx::query_as::<_, FormListItem>(
            r#"
            SELECT f.id, f.site_id, f.name, f.slug, f.description, f.is_active,
                   COALESCE(fc.field_count, 0) AS field_count,
                   COALESCE(sc.submission_count, 0) AS submission_count,
                   f.created_at, f.updated_at
              FROM forms f
              LEFT JOIN LATERAL (
                  SELECT COUNT(*)::BIGINT AS field_count
                    FROM form_fields ff WHERE ff.form_id = f.id
              ) fc ON TRUE
              LEFT JOIN LATERAL (
                  SELECT COUNT(*)::BIGINT AS submission_count
                    FROM form_submissions fs
                   WHERE fs.form_id = f.id AND NOT fs.is_deleted
              ) sc ON TRUE
             WHERE f.site_id = $1 AND NOT f.is_deleted
             ORDER BY f.created_at DESC
             LIMIT $2 OFFSET $3
            "#,
        )
        .bind(site_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok((rows, total))
    }
}

impl FormTemplate {
    pub async fn create(
        pool: &PgPool,
        site_id: Uuid,
        req: CreateFormTemplateRequest,
    ) -> Result<FormTemplateResponse, ApiError> {
        let fields_json = serde_json::to_value(&req.fields).map_err(|e| {
            ApiError::bad_request(format!("Invalid fields JSON: {}", e))
                .with_code(codes::FORM_DUPLICATE_FIELD_LABELS)
        })?;
        ensure_unique_labels(&req.fields)?;

        let tmpl = sqlx::query_as::<_, FormTemplate>(
            r#"
            INSERT INTO form_templates
                (site_id, name, description, icon, fields, consent_required,
                 consent_text, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, site_id, name, description, icon, fields, consent_required,
                      consent_text, is_active, created_at, updated_at
            "#,
        )
        .bind(site_id)
        .bind(&req.name)
        .bind(&req.description)
        .bind(&req.icon)
        .bind(&fields_json)
        .bind(req.consent_required)
        .bind(&req.consent_text)
        .bind(req.is_active)
        .fetch_one(pool)
        .await
        .map_err(map_template_name_conflict)?;

        Ok(template_response_from(tmpl))
    }

    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<FormTemplateResponse, ApiError> {
        let tmpl = fetch_template_row(pool, id).await?;
        Ok(template_response_from(tmpl))
    }

    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdateFormTemplateRequest,
    ) -> Result<FormTemplateResponse, ApiError> {
        let fields_json =
            match req.fields.as_ref() {
                Some(fields) => {
                    ensure_unique_labels(fields)?;
                    Some(serde_json::to_value(fields).map_err(|e| {
                        ApiError::bad_request(format!("Invalid fields JSON: {}", e))
                    })?)
                }
                None => None,
            };

        let tmpl = sqlx::query_as::<_, FormTemplate>(
            r#"
            UPDATE form_templates SET
                name             = COALESCE($2, name),
                description      = COALESCE($3, description),
                icon             = COALESCE($4, icon),
                fields           = COALESCE($5, fields),
                consent_required = COALESCE($6, consent_required),
                consent_text     = COALESCE($7, consent_text),
                is_active        = COALESCE($8, is_active),
                updated_at       = NOW()
              WHERE id = $1
            RETURNING id, site_id, name, description, icon, fields, consent_required,
                      consent_text, is_active, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&req.name)
        .bind(&req.description)
        .bind(&req.icon)
        .bind(fields_json)
        .bind(req.consent_required)
        .bind(&req.consent_text)
        .bind(req.is_active)
        .fetch_optional(pool)
        .await
        .map_err(map_template_name_conflict)?
        .ok_or_else(template_not_found)?;

        Ok(template_response_from(tmpl))
    }

    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM form_templates WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;
        if result.rows_affected() == 0 {
            return Err(template_not_found());
        }
        Ok(())
    }

    pub async fn list_for_site(
        pool: &PgPool,
        site_id: Uuid,
        params: &ListParams,
    ) -> Result<(Vec<FormTemplateResponse>, i64), ApiError> {
        let (limit, offset) = params.limit_offset();
        let total: i64 =
            sqlx::query_scalar(r#"SELECT COUNT(*) FROM form_templates WHERE site_id = $1"#)
                .bind(site_id)
                .fetch_one(pool)
                .await?;

        let rows = sqlx::query_as::<_, FormTemplate>(
            r#"
            SELECT id, site_id, name, description, icon, fields, consent_required,
                   consent_text, is_active, created_at, updated_at
              FROM form_templates
             WHERE site_id = $1
             ORDER BY name ASC
             LIMIT $2 OFFSET $3
            "#,
        )
        .bind(site_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        let items = rows.into_iter().map(template_response_from).collect();
        Ok((items, total))
    }
}

// ── Helpers ─────────────────────────────────────────────────────────────

async fn fetch_form_row(pool: &PgPool, id: Uuid) -> Result<Form, ApiError> {
    sqlx::query_as::<_, Form>(
        r#"
        SELECT id, site_id, name, slug, description, is_active, consent_required,
               consent_text, bot_protection, storage_mode, retention_days,
               is_deleted, created_at, updated_at
          FROM forms
         WHERE id = $1 AND NOT is_deleted
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(form_not_found)
}

async fn fetch_form_row_tx(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> Result<Form, ApiError> {
    sqlx::query_as::<_, Form>(
        r#"
        SELECT id, site_id, name, slug, description, is_active, consent_required,
               consent_text, bot_protection, storage_mode, retention_days,
               is_deleted, created_at, updated_at
          FROM forms
         WHERE id = $1 AND NOT is_deleted
         FOR UPDATE
        "#,
    )
    .bind(id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(form_not_found)
}

async fn fetch_template_row(pool: &PgPool, id: Uuid) -> Result<FormTemplate, ApiError> {
    sqlx::query_as::<_, FormTemplate>(
        r#"
        SELECT id, site_id, name, description, icon, fields, consent_required,
               consent_text, is_active, created_at, updated_at
          FROM form_templates
         WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(template_not_found)
}

async fn fetch_fields(pool: &PgPool, form_id: Uuid) -> Result<Vec<FormField>, ApiError> {
    let fields = sqlx::query_as::<_, FormField>(
        r#"
        SELECT id, form_id, label, field_type, placeholder, help_text,
               validation, options, is_required, display_order, created_at, updated_at
          FROM form_fields
         WHERE form_id = $1
         ORDER BY display_order, label
        "#,
    )
    .bind(form_id)
    .fetch_all(pool)
    .await?;
    Ok(fields)
}

async fn insert_fields(
    tx: &mut Transaction<'_, Postgres>,
    form_id: Uuid,
    fields: &[FormFieldInput],
) -> Result<Vec<FormField>, ApiError> {
    let mut out = Vec::with_capacity(fields.len());
    for f in fields {
        let row = sqlx::query_as::<_, FormField>(
            r#"
            INSERT INTO form_fields
                (form_id, label, field_type, placeholder, help_text, validation,
                 options, is_required, display_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, form_id, label, field_type, placeholder, help_text,
                      validation, options, is_required, display_order,
                      created_at, updated_at
            "#,
        )
        .bind(form_id)
        .bind(&f.label)
        .bind(f.field_type)
        .bind(&f.placeholder)
        .bind(&f.help_text)
        .bind(&f.validation)
        .bind(&f.options)
        .bind(f.is_required)
        .bind(f.display_order)
        .fetch_one(&mut **tx)
        .await?;
        out.push(row);
    }
    Ok(out)
}

async fn resolve_create_fields(
    tx: &mut Transaction<'_, Postgres>,
    site_id: Uuid,
    req: &CreateFormRequest,
) -> Result<Vec<FormFieldInput>, ApiError> {
    // Template fields are the base; explicit `fields` array overrides per-label.
    let template_fields: Vec<FormFieldInput> = match req.template_id {
        Some(tid) => {
            let template_fields_json: JsonValue = sqlx::query_scalar(
                "SELECT fields FROM form_templates WHERE id = $1 AND site_id = $2",
            )
            .bind(tid)
            .bind(site_id)
            .fetch_optional(&mut **tx)
            .await?
            .ok_or_else(template_not_found)?;
            serde_json::from_value(template_fields_json).map_err(|e| {
                ApiError::bad_request(format!("Template field snapshot is corrupt: {}", e))
            })?
        }
        None => Vec::new(),
    };

    if template_fields.is_empty() {
        return Ok(req.fields.clone());
    }
    if req.fields.is_empty() {
        return Ok(template_fields);
    }

    // Per-label merge: callers can override individual template fields by
    // including the same label in their request.
    let mut by_label: std::collections::BTreeMap<String, FormFieldInput> = template_fields
        .into_iter()
        .map(|f| (f.label.clone(), f))
        .collect();
    for f in &req.fields {
        by_label.insert(f.label.clone(), f.clone());
    }
    Ok(by_label.into_values().collect())
}

fn ensure_unique_labels(fields: &[FormFieldInput]) -> Result<(), ApiError> {
    let mut seen: HashSet<&str> = HashSet::new();
    for f in fields {
        if !seen.insert(f.label.as_str()) {
            return Err(
                ApiError::bad_request(format!("Duplicate field label: {}", f.label))
                    .with_code(codes::FORM_DUPLICATE_FIELD_LABELS),
            );
        }
    }
    Ok(())
}

fn detail_from(
    form: Form,
    fields: Vec<FormField>,
    mut field_locs_by_field: std::collections::HashMap<Uuid, Vec<FormFieldLocalizationResponse>>,
    form_locs: Vec<FormLocalizationResponse>,
) -> FormDetailResponse {
    let field_responses = fields
        .into_iter()
        .map(|f| {
            let locs = field_locs_by_field.remove(&f.id).unwrap_or_default();
            field_response_from(f, locs)
        })
        .collect();
    FormDetailResponse {
        id: form.id,
        site_id: form.site_id,
        name: form.name,
        slug: form.slug,
        description: form.description,
        is_active: form.is_active,
        consent_required: form.consent_required,
        consent_text: form.consent_text,
        bot_protection: form.bot_protection,
        storage_mode: form.storage_mode,
        retention_days: form.retention_days,
        fields: field_responses,
        localizations: form_locs,
        created_at: form.created_at,
        updated_at: form.updated_at,
    }
}

fn field_response_from(
    f: FormField,
    localizations: Vec<FormFieldLocalizationResponse>,
) -> FormFieldResponse {
    FormFieldResponse {
        id: f.id,
        label: f.label,
        field_type: f.field_type,
        placeholder: f.placeholder,
        help_text: f.help_text,
        validation: f.validation,
        options: f.options,
        is_required: f.is_required,
        display_order: f.display_order,
        localizations,
    }
}

/// Replace all form-level localizations for a form atomically inside an
/// open transaction. The wipe-and-rewrite shape mirrors the field-replace
/// pattern: callers always send the full set, so we don't need a diff.
async fn replace_form_localizations(
    tx: &mut Transaction<'_, Postgres>,
    form_id: Uuid,
    locs: &[FormLocalizationInput],
) -> Result<(), ApiError> {
    sqlx::query("DELETE FROM form_localizations WHERE form_id = $1")
        .bind(form_id)
        .execute(&mut **tx)
        .await?;
    for l in locs {
        sqlx::query(
            r#"
            INSERT INTO form_localizations
                (form_id, locale_id, name, description, consent_text)
            VALUES ($1, $2, $3, $4, $5)
            "#,
        )
        .bind(form_id)
        .bind(l.locale_id)
        .bind(&l.name)
        .bind(&l.description)
        .bind(&l.consent_text)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

/// Insert per-field localizations after the field rows themselves have been
/// inserted. Matches each `FormFieldInput`'s `localizations` array to the
/// freshly-inserted `FormField` row by label (labels are unique per form).
async fn replace_field_localizations(
    tx: &mut Transaction<'_, Postgres>,
    inserted: &[FormField],
    inputs: &[FormFieldInput],
) -> Result<(), ApiError> {
    use std::collections::HashMap;
    let id_by_label: HashMap<&str, Uuid> =
        inserted.iter().map(|f| (f.label.as_str(), f.id)).collect();
    for input in inputs {
        let Some(&field_id) = id_by_label.get(input.label.as_str()) else {
            continue;
        };
        for l in &input.localizations {
            sqlx::query(
                r#"
                INSERT INTO form_field_localizations
                    (form_field_id, locale_id, display_label, placeholder, help_text)
                VALUES ($1, $2, $3, $4, $5)
                "#,
            )
            .bind(field_id)
            .bind(l.locale_id)
            .bind(&l.display_label)
            .bind(&l.placeholder)
            .bind(&l.help_text)
            .execute(&mut **tx)
            .await?;
        }
    }
    Ok(())
}

async fn fetch_form_localizations<'e, E>(
    conn: E,
    form_id: Uuid,
) -> Result<Vec<FormLocalizationResponse>, ApiError>
where
    E: sqlx::Executor<'e, Database = Postgres>,
{
    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            Uuid,
            Uuid,
            Option<String>,
            Option<String>,
            Option<String>,
        ),
    >(
        r#"
        SELECT id, form_id, locale_id, name, description, consent_text
          FROM form_localizations
         WHERE form_id = $1
        "#,
    )
    .bind(form_id)
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(
            |(id, form_id, locale_id, name, description, consent_text)| FormLocalizationResponse {
                id,
                form_id,
                locale_id,
                name,
                description,
                consent_text,
            },
        )
        .collect())
}

async fn fetch_all_field_localizations<'e, E>(
    conn: E,
    form_id: Uuid,
) -> Result<std::collections::HashMap<Uuid, Vec<FormFieldLocalizationResponse>>, ApiError>
where
    E: sqlx::Executor<'e, Database = Postgres>,
{
    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            Uuid,
            Uuid,
            Option<String>,
            Option<String>,
            Option<String>,
        ),
    >(
        r#"
        SELECT ffl.id, ffl.form_field_id, ffl.locale_id,
               ffl.display_label, ffl.placeholder, ffl.help_text
          FROM form_field_localizations ffl
          JOIN form_fields ff ON ff.id = ffl.form_field_id
         WHERE ff.form_id = $1
        "#,
    )
    .bind(form_id)
    .fetch_all(conn)
    .await?;
    let mut by_field: std::collections::HashMap<Uuid, Vec<FormFieldLocalizationResponse>> =
        std::collections::HashMap::new();
    for (id, field_id, locale_id, display_label, placeholder, help_text) in rows {
        by_field
            .entry(field_id)
            .or_default()
            .push(FormFieldLocalizationResponse {
                id,
                form_field_id: field_id,
                locale_id,
                display_label,
                placeholder,
                help_text,
            });
    }
    Ok(by_field)
}

fn template_response_from(t: FormTemplate) -> FormTemplateResponse {
    FormTemplateResponse {
        id: t.id,
        site_id: t.site_id,
        name: t.name,
        description: t.description,
        icon: t.icon,
        fields: t.fields,
        consent_required: t.consent_required,
        consent_text: t.consent_text,
        is_active: t.is_active,
        created_at: t.created_at,
        updated_at: t.updated_at,
    }
}

fn form_not_found() -> ApiError {
    ApiError::not_found("Form not found")
        .with_code(codes::ENTITY_NOT_FOUND)
        .with_entity_type("form")
}

fn template_not_found() -> ApiError {
    ApiError::not_found("Form template not found")
        .with_code(codes::ENTITY_NOT_FOUND)
        .with_entity_type("form_template")
}

fn map_slug_conflict(e: sqlx::Error) -> ApiError {
    if is_unique_violation(&e, "idx_forms_site_slug") {
        return ApiError::conflict("A form with this slug already exists on this site")
            .with_code(codes::ENTITY_SLUG_TAKEN)
            .with_entity_type("form");
    }
    e.into()
}

fn map_template_name_conflict(e: sqlx::Error) -> ApiError {
    if is_unique_violation(&e, "idx_form_templates_site_name") {
        return ApiError::conflict("A form template with this name already exists on this site")
            .with_code(codes::FORM_TEMPLATE_NAME_EXISTS);
    }
    e.into()
}

fn is_unique_violation(e: &sqlx::Error, constraint: &str) -> bool {
    matches!(
        e,
        sqlx::Error::Database(db) if db.code().as_deref() == Some("23505")
            && db.constraint() == Some(constraint)
    )
}
