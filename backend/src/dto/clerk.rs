//! Clerk user management DTOs

use crate::dto::validated::ValidatedDto;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

/// Response for a Clerk user
#[derive(Debug, Serialize, ToSchema)]
pub struct ClerkUserResponse {
    #[schema(example = "user_2abc123def456")]
    pub id: String,
    #[schema(example = "jane@example.com")]
    pub email: Option<String>,
    #[schema(example = "Jane Doe")]
    pub name: String,
    #[schema(example = "https://img.clerk.com/abc123")]
    pub image_url: Option<String>,
    #[schema(example = "admin")]
    pub role: String,
    #[schema(example = 1704067200)]
    pub created_at: i64,
    #[schema(example = 1717200000)]
    pub updated_at: i64,
    #[schema(example = 1717200000)]
    pub last_sign_in_at: Option<i64>,
    /// User moderation status: "active", "suspended", or "banned"
    #[schema(example = "active")]
    pub moderation_status: String,
    /// Reason for suspension or ban (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub moderation_reason: Option<String>,
}

/// Response for listing Clerk users
#[derive(Debug, Serialize, ToSchema)]
pub struct ClerkUserListResponse {
    pub data: Vec<ClerkUserResponse>,
    #[schema(example = 42)]
    pub total_count: i64,
}

/// Request to update a Clerk user's CMS role
#[derive(Debug, Serialize, Deserialize, Validate, ValidatedDto, ToSchema)]
pub struct UpdateClerkUserRoleRequest {
    #[validate(length(min = 1, max = 20))]
    #[schema(example = "editor")]
    pub role: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn update_role_valid() {
        let req = UpdateClerkUserRoleRequest {
            role: "admin".to_string(),
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn update_role_empty_fails() {
        let req = UpdateClerkUserRoleRequest {
            role: "".to_string(),
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn update_role_too_long_fails() {
        let req = UpdateClerkUserRoleRequest {
            role: "a".repeat(21),
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn update_role_serialization_roundtrip() {
        let req = UpdateClerkUserRoleRequest {
            role: "write".to_string(),
        };
        let json = serde_json::to_string(&req).unwrap();
        let deserialized: UpdateClerkUserRoleRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.role, "write");
    }
}

/// Request to suspend a user
#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, ToSchema)]
pub struct SuspendUserRequest {
    /// Reason for suspension
    #[validate(length(min = 1, max = 500))]
    pub reason: String,
    /// Duration in hours
    #[validate(range(min = 1, max = 8760))]
    pub duration_hours: i64,
}

/// Request to ban a user
#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, ToSchema)]
pub struct BanUserRequest {
    /// Reason for ban
    #[validate(length(min = 1, max = 500))]
    pub reason: String,
}

/// Response for moderation actions
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ModerationActionResponse {
    pub clerk_user_id: String,
    pub status: String,
    pub reason: Option<String>,
    pub expires_at: Option<String>,
}
