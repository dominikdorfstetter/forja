//! Audit model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;

/// Audit action enum matching PostgreSQL
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, utoipa::ToSchema)]
#[sqlx(type_name = "audit_action", rename_all = "lowercase")]
pub enum AuditAction {
    Create,
    Read,
    Update,
    Delete,
    Publish,
    Unpublish,
    Archive,
    Restore,
    Login,
    Logout,
    #[sqlx(rename = "submit_review")]
    SubmitReview,
    #[sqlx(rename = "approve")]
    Approve,
    #[sqlx(rename = "request_changes")]
    RequestChanges,
}

/// Audit log entry
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AuditLog {
    pub id: Uuid,
    pub site_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    pub action: AuditAction,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

/// Change history entry
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ChangeHistory {
    pub id: Uuid,
    pub site_id: Option<Uuid>,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub field_name: Option<String>,
    pub old_value: Option<serde_json::Value>,
    pub new_value: Option<serde_json::Value>,
    pub changed_by: Option<Uuid>,
    pub changed_at: DateTime<Utc>,
}

impl AuditLog {
    /// Find audit logs for a site
    pub async fn find_for_site(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Self>, ApiError> {
        let logs = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, user_id, action, entity_type, entity_id,
                   ip_address::TEXT as ip_address, user_agent, metadata, created_at
            FROM audit_logs
            WHERE site_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(site_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok(logs)
    }

    /// Find audit logs for an entity
    pub async fn find_for_entity(
        pool: &PgPool,
        entity_type: &str,
        entity_id: Uuid,
    ) -> Result<Vec<Self>, ApiError> {
        let logs = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, user_id, action, entity_type, entity_id,
                   ip_address::TEXT as ip_address, user_agent, metadata, created_at
            FROM audit_logs
            WHERE entity_type = $1 AND entity_id = $2
            ORDER BY created_at DESC
            "#,
        )
        .bind(entity_type)
        .bind(entity_id)
        .fetch_all(pool)
        .await?;

        Ok(logs)
    }

    /// Find audit logs for a user
    pub async fn find_for_user(
        pool: &PgPool,
        user_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Self>, ApiError> {
        let logs = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, user_id, action, entity_type, entity_id,
                   ip_address::TEXT as ip_address, user_agent, metadata, created_at
            FROM audit_logs
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok(logs)
    }

    /// Create an audit log entry
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        pool: &PgPool,
        site_id: Option<Uuid>,
        user_id: Option<Uuid>,
        action: AuditAction,
        entity_type: &str,
        entity_id: Uuid,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
        metadata: Option<serde_json::Value>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            INSERT INTO audit_logs (site_id, user_id, action, entity_type, entity_id, ip_address, user_agent, metadata)
            VALUES ($1, $2, $3, $4, $5, $6::inet, $7, $8)
            "#,
        )
        .bind(site_id)
        .bind(user_id)
        .bind(action)
        .bind(entity_type)
        .bind(entity_id)
        .bind(ip_address)
        .bind(user_agent)
        .bind(metadata)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Count audit logs for a site
    pub async fn count_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*)
            FROM audit_logs
            WHERE site_id = $1
            "#,
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;

        Ok(row.0)
    }
}

impl ChangeHistory {
    /// Create a change history entry
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        pool: &PgPool,
        site_id: Option<Uuid>,
        entity_type: &str,
        entity_id: Uuid,
        field_name: &str,
        old_value: Option<serde_json::Value>,
        new_value: Option<serde_json::Value>,
        changed_by: Option<Uuid>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            INSERT INTO change_history (site_id, entity_type, entity_id, field_name, old_value, new_value, changed_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
        )
        .bind(site_id)
        .bind(entity_type)
        .bind(entity_id)
        .bind(field_name)
        .bind(old_value)
        .bind(new_value)
        .bind(changed_by)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Find change history entries by IDs
    pub async fn find_by_ids(pool: &PgPool, ids: &[Uuid]) -> Result<Vec<Self>, ApiError> {
        let history = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, entity_type, entity_id, field_name,
                   old_value, new_value, changed_by, changed_at
            FROM change_history
            WHERE id = ANY($1)
            ORDER BY changed_at DESC
            "#,
        )
        .bind(ids)
        .fetch_all(pool)
        .await?;

        Ok(history)
    }

    /// Find change history for an entity
    pub async fn find_for_entity(
        pool: &PgPool,
        entity_type: &str,
        entity_id: Uuid,
    ) -> Result<Vec<Self>, ApiError> {
        let history = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, entity_type, entity_id, field_name,
                   old_value, new_value, changed_by, changed_at
            FROM change_history
            WHERE entity_type = $1 AND entity_id = $2
            ORDER BY changed_at DESC
            "#,
        )
        .bind(entity_type)
        .bind(entity_id)
        .fetch_all(pool)
        .await?;

        Ok(history)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audit_action_serialization() {
        let action = AuditAction::Create;
        let json = serde_json::to_string(&action).unwrap();
        assert_eq!(json, "\"Create\"");
    }
}
