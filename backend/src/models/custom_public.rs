//! Public (Consumer API) read model for custom-type entries (#795).
//!
//! Serves only **published** entries of types flagged `is_publicly_readable`;
//! anything else 404s (existence hidden). PII fields are stripped entirely —
//! privacy by default, never decrypted on the public path. The merged `data`
//! is shared values + the chosen locale's values, with the title injected
//! from `content_localizations.title`.

use std::collections::HashMap;

use serde_json::{Map, Value};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::dto::custom_entry::{PublicEntry, PublicSchema, PublicSchemaField};
use crate::dto::custom_type::CustomFieldResponse;
use crate::errors::{ApiError, codes};
use crate::models::custom_type::CustomType;

struct PublicType {
    entity_type_id: Uuid,
    fields: Vec<CustomFieldResponse>,
}

/// Load a publicly-readable type's schema, or 404. Data-only / unpublished
/// types are indistinguishable from non-existent ones to the public.
async fn load_public_type(
    pool: &PgPool,
    site_id: Uuid,
    type_key: &str,
) -> Result<PublicType, ApiError> {
    let row = sqlx::query(
        "SELECT entity_type_id FROM custom_types
          WHERE site_id = $1 AND key = $2 AND is_publicly_readable = TRUE",
    )
    .bind(site_id)
    .bind(type_key)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| {
        ApiError::not_found("collection not found").with_code(codes::ERR_CUSTOM_TYPE_NOT_FOUND)
    })?;
    let detail = CustomType::get(pool, site_id, type_key).await?;
    Ok(PublicType {
        entity_type_id: row.get("entity_type_id"),
        fields: detail.fields,
    })
}

/// Public, PII-free field schema for generic renderers.
pub async fn schema(
    pool: &PgPool,
    site_id: Uuid,
    type_key: &str,
) -> Result<PublicSchema, ApiError> {
    let detail = CustomType::get(pool, site_id, type_key).await?;
    if !detail.is_publicly_readable {
        return Err(
            ApiError::not_found("collection not found").with_code(codes::ERR_CUSTOM_TYPE_NOT_FOUND)
        );
    }
    Ok(PublicSchema {
        key: detail.key,
        name: detail.name,
        content_kind: detail.content_kind,
        fields: detail
            .fields
            .into_iter()
            .filter(|f| !f.is_pii) // never advertise PII fields publicly
            .map(|f| PublicSchemaField {
                key: f.key,
                label: f.label,
                field_type: f.field_type,
                localized: f.localized,
                is_title: f.is_title,
                enum_options: f.enum_options,
            })
            .collect(),
    })
}

/// Merge shared + localized values into the public `data` object: skip PII and
/// the (separately injected) title field, then add the title under its key.
fn merge_public_data(
    fields: &[CustomFieldResponse],
    shared: &Value,
    localized: &Value,
    title: &str,
) -> Map<String, Value> {
    let mut out = Map::new();
    let pii: std::collections::HashSet<&str> = fields
        .iter()
        .filter(|f| f.is_pii)
        .map(|f| f.key.as_str())
        .collect();
    let title_key = fields.iter().find(|f| f.is_title).map(|f| f.key.clone());

    for bucket in [shared, localized] {
        if let Some(map) = bucket.as_object() {
            for (k, v) in map {
                if pii.contains(k.as_str()) {
                    continue;
                }
                out.insert(k.clone(), v.clone());
            }
        }
    }
    if let Some(tk) = title_key {
        out.insert(tk, Value::from(title));
    }
    out
}

async fn resolve_locale_id(
    pool: &PgPool,
    site_id: Uuid,
    locale: Option<&str>,
) -> Result<(Uuid, String), ApiError> {
    if let Some(code) = locale
        && let Some(row) = sqlx::query("SELECT id, code FROM locales WHERE code = $1")
            .bind(code)
            .fetch_optional(pool)
            .await?
    {
        return Ok((row.get("id"), row.get("code")));
    }
    let row = sqlx::query(
        "SELECT l.id, l.code FROM locales l
          WHERE l.id = COALESCE(
              (SELECT default_locale_id FROM sites WHERE id = $1),
              (SELECT id FROM locales WHERE code = 'en'),
              (SELECT id FROM locales ORDER BY code LIMIT 1))",
    )
    .bind(site_id)
    .fetch_one(pool)
    .await?;
    Ok((row.get("id"), row.get("code")))
}

async fn build_entry(
    pool: &PgPool,
    fields: &[CustomFieldResponse],
    content_id: Uuid,
    slug: Option<String>,
    published_at: Option<chrono::DateTime<chrono::Utc>>,
    locale_id: Uuid,
    locale_code: &str,
) -> Result<PublicEntry, ApiError> {
    let shared: Value =
        sqlx::query_scalar("SELECT data FROM custom_entry_values WHERE content_id = $1")
            .bind(content_id)
            .fetch_optional(pool)
            .await?
            .unwrap_or_else(|| Value::Object(Map::new()));
    let localized: Value = sqlx::query_scalar(
        "SELECT data FROM custom_entry_localizations WHERE content_id = $1 AND locale_id = $2",
    )
    .bind(content_id)
    .bind(locale_id)
    .fetch_optional(pool)
    .await?
    .unwrap_or_else(|| Value::Object(Map::new()));
    let title: String = sqlx::query_scalar(
        "SELECT title FROM content_localizations WHERE content_id = $1 AND locale_id = $2",
    )
    .bind(content_id)
    .bind(locale_id)
    .fetch_optional(pool)
    .await?
    .unwrap_or_default();

    Ok(PublicEntry {
        slug,
        status: "published".to_string(),
        published_at,
        locale: Some(locale_code.to_string()),
        data: merge_public_data(fields, &shared, &localized, &title)
            .into_iter()
            .collect::<HashMap<_, _>>(),
    })
}

/// Paginated list of published entries.
pub async fn published_list(
    pool: &PgPool,
    site_id: Uuid,
    type_key: &str,
    locale: Option<&str>,
    page: i64,
    page_size: i64,
) -> Result<(Vec<PublicEntry>, i64), ApiError> {
    let t = load_public_type(pool, site_id, type_key).await?;
    let (locale_id, locale_code) = resolve_locale_id(pool, site_id, locale).await?;
    let offset = (page.max(1) - 1) * page_size;

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM contents c
         JOIN content_sites cs ON cs.content_id = c.id AND cs.site_id = $2
         WHERE c.entity_type_id = $1 AND c.is_deleted = FALSE AND c.status = 'published'",
    )
    .bind(t.entity_type_id)
    .bind(site_id)
    .fetch_one(pool)
    .await?;

    let rows = sqlx::query(
        "SELECT c.id, c.slug::text AS slug, c.published_at
           FROM contents c
           JOIN content_sites cs ON cs.content_id = c.id AND cs.site_id = $2
          WHERE c.entity_type_id = $1 AND c.is_deleted = FALSE AND c.status = 'published'
          ORDER BY c.published_at DESC NULLS LAST
          LIMIT $3 OFFSET $4",
    )
    .bind(t.entity_type_id)
    .bind(site_id)
    .bind(page_size)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    let mut entries = Vec::with_capacity(rows.len());
    for r in &rows {
        entries.push(
            build_entry(
                pool,
                &t.fields,
                r.get("id"),
                r.get("slug"),
                r.get("published_at"),
                locale_id,
                &locale_code,
            )
            .await?,
        );
    }
    Ok((entries, total))
}

/// A single published entry by slug, or 404.
pub async fn published_by_slug(
    pool: &PgPool,
    site_id: Uuid,
    type_key: &str,
    slug: &str,
    locale: Option<&str>,
) -> Result<PublicEntry, ApiError> {
    let t = load_public_type(pool, site_id, type_key).await?;
    let (locale_id, locale_code) = resolve_locale_id(pool, site_id, locale).await?;

    let row = sqlx::query(
        "SELECT c.id, c.slug::text AS slug, c.published_at
           FROM contents c
           JOIN content_sites cs ON cs.content_id = c.id AND cs.site_id = $2
          WHERE c.entity_type_id = $1 AND c.is_deleted = FALSE AND c.status = 'published'
            AND c.slug = $3
          LIMIT 1",
    )
    .bind(t.entity_type_id)
    .bind(site_id)
    .bind(slug)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| {
        ApiError::not_found("entry not found").with_code(codes::ERR_CUSTOM_TYPE_NOT_FOUND)
    })?;

    build_entry(
        pool,
        &t.fields,
        row.get("id"),
        row.get("slug"),
        row.get("published_at"),
        locale_id,
        &locale_code,
    )
    .await
}
