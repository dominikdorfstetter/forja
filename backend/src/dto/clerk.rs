//! Clerk user management DTOs

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
}

/// Response for listing Clerk users
#[derive(Debug, Serialize, ToSchema)]
pub struct ClerkUserListResponse {
    pub data: Vec<ClerkUserResponse>,
    #[schema(example = 42)]
    pub total_count: i64,
}

/// Request to update a Clerk user's CMS role
#[derive(Debug, Serialize, Deserialize, Validate, ToSchema)]
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
