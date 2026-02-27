//! Audit service
//!
//! Lightweight helpers that handlers call after mutations to log actions
//! and record field-level change history.

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::audit::{AuditAction, AuditLog, ChangeHistory};

/// System-managed fields that should never appear in change history.
/// These are auto-set by the database or framework and not user-editable.
const IGNORED_FIELDS: &[&str] = &[
    "id",
    "content_id",
    "site_id",
    "created_at",
    "updated_at",
    "created_by",
    "is_deleted",
    "published_at",
];

/// Log an audit action (fire-and-forget: logs errors but never fails the request).
pub async fn log_action(
    pool: &PgPool,
    site_id: Option<Uuid>,
    user_id: Option<Uuid>,
    action: AuditAction,
    entity_type: &str,
    entity_id: Uuid,
    metadata: Option<serde_json::Value>,
) {
    if let Err(e) = AuditLog::create(
        pool,
        site_id,
        user_id,
        action,
        entity_type,
        entity_id,
        None,
        None,
        metadata,
    )
    .await
    {
        tracing::warn!("Failed to write audit log: {e}");
    }
}

/// Diff two JSON values field-by-field, inserting a change_history row per changed field.
pub async fn log_changes(
    pool: &PgPool,
    site_id: Option<Uuid>,
    entity_type: &str,
    entity_id: Uuid,
    changed_by: Option<Uuid>,
    old: &serde_json::Value,
    new: &serde_json::Value,
) {
    let (Some(old_obj), Some(new_obj)) = (old.as_object(), new.as_object()) else {
        return;
    };

    for (key, new_val) in new_obj {
        if IGNORED_FIELDS.contains(&key.as_str()) {
            continue;
        }
        let old_val = old_obj.get(key);
        if old_val != Some(new_val) {
            if let Err(e) = ChangeHistory::create(
                pool,
                site_id,
                entity_type,
                entity_id,
                key,
                old_val.cloned(),
                Some(new_val.clone()),
                changed_by,
            )
            .await
            {
                tracing::warn!("Failed to write change history for field '{key}': {e}");
            }
        }
    }
}
