//! Review action DTOs for editorial workflow

use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::models::content::ContentStatus;

/// Review action type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ReviewAction {
    Approve,
    RequestChanges,
}

/// Request to perform a review action on content
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
pub struct ReviewActionRequest {
    pub action: ReviewAction,
    #[validate(length(max = 2000, message = "Comment cannot exceed 2000 characters"))]
    #[schema(example = "Please fix the introduction paragraph.")]
    pub comment: Option<String>,
}

/// Response after performing a review action
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct ReviewActionResponse {
    pub status: ContentStatus,
    pub message: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_review_action_request_approve_valid() {
        let req = ReviewActionRequest {
            action: ReviewAction::Approve,
            comment: None,
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_review_action_request_with_comment() {
        let req = ReviewActionRequest {
            action: ReviewAction::RequestChanges,
            comment: Some("Please fix the introduction paragraph.".to_string()),
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_review_action_request_comment_too_long() {
        let req = ReviewActionRequest {
            action: ReviewAction::RequestChanges,
            comment: Some("a".repeat(2001)),
        };
        let result = req.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().field_errors().contains_key("comment"));
    }

    #[test]
    fn test_review_action_request_empty_comment_valid() {
        let req = ReviewActionRequest {
            action: ReviewAction::Approve,
            comment: Some("".to_string()),
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_review_action_deserialization_approve() {
        let json = r#"{"action": "approve"}"#;
        let req: ReviewActionRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.action, ReviewAction::Approve);
        assert!(req.comment.is_none());
    }

    #[test]
    fn test_review_action_deserialization_request_changes() {
        let json = r#"{"action": "request_changes", "comment": "Fix this"}"#;
        let req: ReviewActionRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.action, ReviewAction::RequestChanges);
        assert_eq!(req.comment, Some("Fix this".to_string()));
    }

    #[test]
    fn test_review_action_deserialization_invalid_action() {
        let json = r#"{"action": "invalid_action"}"#;
        let result: Result<ReviewActionRequest, _> = serde_json::from_str(json);
        assert!(result.is_err());
    }

    #[test]
    fn test_review_action_response_serialization() {
        let resp = ReviewActionResponse {
            status: ContentStatus::Published,
            message: "Content approved and published".to_string(),
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"status\":\"Published\""));
        assert!(json.contains("\"message\":\"Content approved and published\""));
    }
}
