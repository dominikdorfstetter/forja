//! GDPR Art. 30 Records of Processing generation (#794).
//!
//! A concrete generator over a site's custom types (no speculative plugin
//! contract — Forms #579 folds in as a fast-follow when that second caller
//! exists). Output is canonical JSON; the admin UI renders it as a table.

use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::dto::ropa::{RopaFieldEntry, RopaReport, RopaTypeEntry};
use crate::errors::ApiError;

/// Build the RoPA for a site: every custom type that has at least one PII
/// field, with that field's data-protection contract + a live record count.
pub async fn generate(pool: &PgPool, site_id: Uuid) -> Result<RopaReport, ApiError> {
    let types = sqlx::query(
        "SELECT id, entity_type_id, key::text AS key, name, retention_days, is_publicly_readable
           FROM custom_types WHERE site_id = $1 ORDER BY name",
    )
    .bind(site_id)
    .fetch_all(pool)
    .await?;

    let mut activities = Vec::new();
    for t in &types {
        let custom_type_id: Uuid = t.get("id");
        let entity_type_id: Uuid = t.get("entity_type_id");

        let pii_rows = sqlx::query(
            "SELECT key::text AS key, label, data_category, processing_purpose, legal_basis
               FROM custom_type_fields
              WHERE custom_type_id = $1 AND is_pii = TRUE
              ORDER BY display_order, key",
        )
        .bind(custom_type_id)
        .fetch_all(pool)
        .await?;

        // A processing activity exists only where personal data is processed.
        if pii_rows.is_empty() {
            continue;
        }

        let record_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM contents WHERE entity_type_id = $1 AND is_deleted = FALSE",
        )
        .bind(entity_type_id)
        .fetch_one(pool)
        .await?;

        activities.push(RopaTypeEntry {
            key: t.get("key"),
            name: t.get("name"),
            retention_days: t.get("retention_days"),
            is_publicly_readable: t.get("is_publicly_readable"),
            record_count,
            pii_fields: pii_rows
                .iter()
                .map(|r| RopaFieldEntry {
                    key: r.get("key"),
                    label: r.get("label"),
                    data_category: r.get("data_category"),
                    processing_purpose: r.get("processing_purpose"),
                    legal_basis: r.get("legal_basis"),
                })
                .collect(),
        });
    }

    Ok(RopaReport {
        site_id,
        generated_at: chrono::Utc::now(),
        processing_activities: activities,
    })
}
