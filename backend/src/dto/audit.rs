//! Audit DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::dto::validated::ValidatedDto;
use crate::models::audit::{AuditAction, AuditLog, ChangeHistory};
use crate::utils::pagination::Paginated;

/// Audit log response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Audit log entry")]
pub struct AuditLogResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub action: AuditAction,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub ip_address: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    /// Human-readable reference resolved at list time (blog slug, page
    /// route, legal-doc title, site name, etc.). `None` when the
    /// referenced row has been hard-deleted or the entity type does not
    /// expose a display-worthy column.
    pub entity_display: Option<String>,
}

impl From<AuditLog> for AuditLogResponse {
    fn from(log: AuditLog) -> Self {
        Self {
            id: log.id,
            user_id: log.user_id,
            action: log.action,
            entity_type: log.entity_type,
            entity_id: log.entity_id,
            ip_address: log.ip_address,
            metadata: log.metadata,
            created_at: log.created_at,
            entity_display: None,
        }
    }
}

/// AI usage count for a site — drives the "AI used N times" stat the
/// admin renders next to the activity list. AI generation audit rows
/// are hidden from the regular feed so they don't drown out real
/// user actions, but they still contribute to this counter.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "AI usage counts for a site")]
pub struct AiUsageCount {
    pub total: i64,
    pub last_30_days: i64,
}

/// Change history response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Change history entry")]
pub struct ChangeHistoryResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "blog")]
    pub entity_type: String,
    #[schema(example = "660e8400-e29b-41d4-a716-446655440000")]
    pub entity_id: Uuid,
    pub field_name: Option<String>,
    pub old_value: Option<serde_json::Value>,
    pub new_value: Option<serde_json::Value>,
    pub changed_by: Option<Uuid>,
    pub changed_at: DateTime<Utc>,
}

impl From<ChangeHistory> for ChangeHistoryResponse {
    fn from(history: ChangeHistory) -> Self {
        Self {
            id: history.id,
            entity_type: history.entity_type,
            entity_id: history.entity_id,
            field_name: history.field_name,
            old_value: history.old_value,
            new_value: history.new_value,
            changed_by: history.changed_by,
            changed_at: history.changed_at,
        }
    }
}

/// Request to revert specific change history entries
#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, utoipa::ToSchema)]
#[schema(description = "Revert changes by restoring old field values")]
pub struct RevertChangesRequest {
    /// IDs of change_history rows to revert
    #[validate(length(min = 1, message = "change_ids must not be empty"))]
    pub change_ids: Vec<Uuid>,
}

/// Response after a successful revert
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Result of a revert operation")]
pub struct RevertChangesResponse {
    pub entity_type: String,
    pub entity_id: Uuid,
    pub fields_reverted: Vec<String>,
}

/// Paginated audit logs
pub type PaginatedAuditLogs = Paginated<AuditLogResponse>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audit_log_response_serialization() {
        let log = AuditLogResponse {
            id: Uuid::new_v4(),
            user_id: Some(Uuid::new_v4()),
            action: AuditAction::Create,
            entity_type: "blog".to_string(),
            entity_id: Uuid::new_v4(),
            ip_address: None,
            metadata: None,
            created_at: Utc::now(),
            entity_display: None,
        };

        let json = serde_json::to_string(&log).unwrap();
        assert!(json.contains("\"action\":\"Create\""));
    }
}
