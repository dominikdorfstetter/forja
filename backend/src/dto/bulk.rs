//! Bulk action DTOs

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::models::content::ContentStatus;

/// Supported bulk actions
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub enum BulkAction {
    UpdateStatus,
    Delete,
}

/// Request to perform a bulk action on content items
#[derive(Debug, Clone, Deserialize, Validate, ToSchema)]
#[schema(description = "Bulk action request for content items")]
pub struct BulkContentRequest {
    /// IDs of the items to act on (1–100)
    #[validate(length(
        min = 1,
        max = 100,
        message = "ids must contain between 1 and 100 items"
    ))]
    pub ids: Vec<Uuid>,

    /// The action to perform
    pub action: BulkAction,

    /// Target status (required when action is UpdateStatus)
    pub status: Option<ContentStatus>,
}

/// Result for a single item in a bulk operation
#[derive(Debug, Clone, Serialize, ToSchema)]
#[schema(description = "Result for a single item in a bulk operation")]
pub struct BulkItemResult {
    pub id: Uuid,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Response from a bulk operation
#[derive(Debug, Clone, Serialize, ToSchema)]
#[schema(description = "Bulk operation response with per-item results")]
pub struct BulkContentResponse {
    pub total: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub results: Vec<BulkItemResult>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_valid_bulk_request() {
        let req = BulkContentRequest {
            ids: vec![Uuid::new_v4(), Uuid::new_v4()],
            action: BulkAction::UpdateStatus,
            status: Some(ContentStatus::Published),
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_empty_ids_rejected() {
        let req = BulkContentRequest {
            ids: vec![],
            action: BulkAction::Delete,
            status: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_over_100_ids_rejected() {
        let ids: Vec<Uuid> = (0..101).map(|_| Uuid::new_v4()).collect();
        let req = BulkContentRequest {
            ids,
            action: BulkAction::Delete,
            status: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_exactly_100_ids_accepted() {
        let ids: Vec<Uuid> = (0..100).map(|_| Uuid::new_v4()).collect();
        let req = BulkContentRequest {
            ids,
            action: BulkAction::UpdateStatus,
            status: Some(ContentStatus::Draft),
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_bulk_response_serialization() {
        let resp = BulkContentResponse {
            total: 2,
            succeeded: 1,
            failed: 1,
            results: vec![
                BulkItemResult {
                    id: Uuid::new_v4(),
                    success: true,
                    error: None,
                },
                BulkItemResult {
                    id: Uuid::new_v4(),
                    success: false,
                    error: Some("Not found".to_string()),
                },
            ],
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"succeeded\":1"));
        assert!(json.contains("\"failed\":1"));
        assert!(json.contains("\"Not found\""));
    }

    #[test]
    fn test_bulk_item_result_no_error_skips_field() {
        let result = BulkItemResult {
            id: Uuid::new_v4(),
            success: true,
            error: None,
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(!json.contains("error"));
    }

    #[test]
    fn test_delete_action_no_status_needed() {
        let req = BulkContentRequest {
            ids: vec![Uuid::new_v4()],
            action: BulkAction::Delete,
            status: None,
        };
        assert!(req.validate().is_ok());
    }
}
