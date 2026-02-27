//! Site membership DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::models::site_membership::SiteRole;

/// Response for a site membership (enriched with Clerk user data)
#[derive(Debug, Serialize, ToSchema)]
pub struct SiteMembershipResponse {
    pub id: Uuid,
    pub clerk_user_id: String,
    pub site_id: Uuid,
    pub role: SiteRole,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub invited_by: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to add a member to a site
#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct AddSiteMemberRequest {
    #[validate(length(min = 1, max = 255, message = "clerk_user_id is required"))]
    pub clerk_user_id: String,
    pub role: SiteRole,
}

/// Request to update a member's role
#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateMemberRoleRequest {
    pub role: SiteRole,
}

/// Request to transfer ownership
#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct TransferOwnershipRequest {
    #[validate(length(min = 1, max = 255, message = "new_owner_clerk_user_id is required"))]
    pub new_owner_clerk_user_id: String,
}

/// Summary of a user's membership in a site (for /auth/me, /auth/profile)
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct MembershipSummary {
    pub site_id: Uuid,
    pub site_name: String,
    pub site_slug: String,
    pub role: SiteRole,
}

/// Row type for joining site_memberships with sites
#[derive(Debug, sqlx::FromRow)]
pub struct MembershipWithSite {
    pub site_id: Uuid,
    pub site_name: String,
    pub site_slug: String,
    pub role: SiteRole,
}

impl From<MembershipWithSite> for MembershipSummary {
    fn from(row: MembershipWithSite) -> Self {
        Self {
            site_id: row.site_id,
            site_name: row.site_name,
            site_slug: row.site_slug,
            role: row.role,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_add_site_member_request_valid() {
        let req = AddSiteMemberRequest {
            clerk_user_id: "user_abc123".to_string(),
            role: SiteRole::Editor,
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_add_site_member_request_empty_clerk_id() {
        let req = AddSiteMemberRequest {
            clerk_user_id: "".to_string(),
            role: SiteRole::Viewer,
        };
        let result = req.validate();
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .field_errors()
            .contains_key("clerk_user_id"));
    }

    #[test]
    fn test_add_site_member_request_clerk_id_too_long() {
        let req = AddSiteMemberRequest {
            clerk_user_id: "a".repeat(256),
            role: SiteRole::Admin,
        };
        let result = req.validate();
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .field_errors()
            .contains_key("clerk_user_id"));
    }

    #[test]
    fn test_add_site_member_request_max_length_clerk_id() {
        let req = AddSiteMemberRequest {
            clerk_user_id: "a".repeat(255),
            role: SiteRole::Author,
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_transfer_ownership_request_valid() {
        let req = TransferOwnershipRequest {
            new_owner_clerk_user_id: "user_xyz789".to_string(),
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_transfer_ownership_request_empty() {
        let req = TransferOwnershipRequest {
            new_owner_clerk_user_id: "".to_string(),
        };
        let result = req.validate();
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .field_errors()
            .contains_key("new_owner_clerk_user_id"));
    }

    #[test]
    fn test_transfer_ownership_request_too_long() {
        let req = TransferOwnershipRequest {
            new_owner_clerk_user_id: "a".repeat(256),
        };
        let result = req.validate();
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .field_errors()
            .contains_key("new_owner_clerk_user_id"));
    }

    #[test]
    fn test_add_site_member_deserialization() {
        let json = r#"{"clerk_user_id": "user_123", "role": "editor"}"#;
        let req: AddSiteMemberRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.clerk_user_id, "user_123");
        assert_eq!(req.role, SiteRole::Editor);
    }

    #[test]
    fn test_add_site_member_deserialization_all_roles() {
        for (role_str, expected) in [
            ("owner", SiteRole::Owner),
            ("admin", SiteRole::Admin),
            ("editor", SiteRole::Editor),
            ("author", SiteRole::Author),
            ("reviewer", SiteRole::Reviewer),
            ("viewer", SiteRole::Viewer),
        ] {
            let json = format!(r#"{{"clerk_user_id": "u1", "role": "{}"}}"#, role_str);
            let req: AddSiteMemberRequest = serde_json::from_str(&json).unwrap();
            assert_eq!(req.role, expected);
        }
    }

    #[test]
    fn test_add_site_member_deserialization_invalid_role() {
        let json = r#"{"clerk_user_id": "user_123", "role": "superadmin"}"#;
        let result: Result<AddSiteMemberRequest, _> = serde_json::from_str(json);
        assert!(result.is_err());
    }

    #[test]
    fn test_update_member_role_deserialization() {
        let json = r#"{"role": "admin"}"#;
        let req: UpdateMemberRoleRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.role, SiteRole::Admin);
    }

    #[test]
    fn test_transfer_ownership_deserialization() {
        let json = r#"{"new_owner_clerk_user_id": "user_new_owner"}"#;
        let req: TransferOwnershipRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.new_owner_clerk_user_id, "user_new_owner");
    }

    #[test]
    fn test_membership_response_serialization_skip_none() {
        let resp = SiteMembershipResponse {
            id: Uuid::new_v4(),
            clerk_user_id: "user_123".to_string(),
            site_id: Uuid::new_v4(),
            role: SiteRole::Editor,
            name: None,
            email: None,
            image_url: None,
            invited_by: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        let json = serde_json::to_string(&resp).unwrap();
        // skip_serializing_if = "Option::is_none" should omit these
        assert!(!json.contains("\"name\""));
        assert!(!json.contains("\"email\""));
        assert!(!json.contains("\"image_url\""));
        assert!(!json.contains("\"invited_by\""));
    }

    #[test]
    fn test_membership_response_serialization_with_values() {
        let resp = SiteMembershipResponse {
            id: Uuid::new_v4(),
            clerk_user_id: "user_123".to_string(),
            site_id: Uuid::new_v4(),
            role: SiteRole::Admin,
            name: Some("John Doe".to_string()),
            email: Some("john@example.com".to_string()),
            image_url: Some("https://img.example.com/john.png".to_string()),
            invited_by: Some("user_owner".to_string()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"name\":\"John Doe\""));
        assert!(json.contains("\"email\":\"john@example.com\""));
        assert!(json.contains("\"invited_by\":\"user_owner\""));
    }

    #[test]
    fn test_membership_summary_from_membership_with_site() {
        let site_id = Uuid::new_v4();
        let row = MembershipWithSite {
            site_id,
            site_name: "My Site".to_string(),
            site_slug: "my-site".to_string(),
            role: SiteRole::Owner,
        };
        let summary = MembershipSummary::from(row);
        assert_eq!(summary.site_id, site_id);
        assert_eq!(summary.site_name, "My Site");
        assert_eq!(summary.site_slug, "my-site");
        assert_eq!(summary.role, SiteRole::Owner);
    }
}
