//! User DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::models::user::{User, UserRole, UserSite};
use crate::utils::pagination::Paginated;
use crate::utils::validation::validate_url;

lazy_static::lazy_static! {
    /// Valid username pattern: letters, numbers, underscores, dots, hyphens
    static ref USERNAME_REGEX: regex::Regex = regex::Regex::new(r"^[a-zA-Z0-9_.\-]+$").unwrap();
}

/// Validate username matches allowed pattern
fn validate_username(username: &str) -> Result<(), validator::ValidationError> {
    if !USERNAME_REGEX.is_match(username) {
        let mut err = validator::ValidationError::new("invalid_username");
        err.message = Some("Username must contain only letters, numbers, underscores, dots, and hyphens".into());
        return Err(err);
    }
    Ok(())
}

/// Validate avatar URL for CreateUserRequest (Option<String>)
fn validate_avatar_url_option(url: &str) -> Result<(), validator::ValidationError> {
    validate_url(url)
}

/// User response (full info for admin)
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "User info")]
pub struct UserResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "johndoe")]
    pub username: String,
    #[schema(example = "john@example.com")]
    pub email: String,
    #[schema(example = "John")]
    pub first_name: Option<String>,
    #[schema(example = "Doe")]
    pub last_name: Option<String>,
    #[schema(example = "John Doe")]
    pub display_name: Option<String>,
    #[schema(example = "https://example.com/avatar.png")]
    pub avatar_url: Option<String>,
    #[schema(example = true)]
    pub is_active: bool,
    #[schema(example = false)]
    pub is_superadmin: bool,
    #[schema(example = "2024-01-15T10:30:00Z")]
    pub created_at: DateTime<Utc>,
    #[schema(example = "2024-01-15T10:30:00Z")]
    pub updated_at: DateTime<Utc>,
}

impl From<User> for UserResponse {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            username: user.username,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            is_active: user.is_active,
            is_superadmin: user.is_superadmin,
            created_at: user.created_at,
            updated_at: user.updated_at,
        }
    }
}

/// Create user request
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Create a new user")]
pub struct CreateUserRequest {
    #[schema(example = "johndoe")]
    #[validate(length(min = 1, max = 100, message = "Username must be between 1 and 100 characters"))]
    #[validate(custom(function = "validate_username"))]
    pub username: String,

    #[schema(example = "john@example.com")]
    #[validate(email(message = "Must be a valid email address"))]
    pub email: String,

    #[schema(example = "John")]
    #[validate(length(max = 100, message = "First name cannot exceed 100 characters"))]
    pub first_name: Option<String>,

    #[schema(example = "Doe")]
    #[validate(length(max = 100, message = "Last name cannot exceed 100 characters"))]
    pub last_name: Option<String>,

    #[schema(example = "John Doe")]
    #[validate(length(max = 200, message = "Display name cannot exceed 200 characters"))]
    pub display_name: Option<String>,

    #[schema(example = "https://example.com/avatar.png")]
    #[validate(length(max = 500, message = "Avatar URL cannot exceed 500 characters"))]
    #[validate(custom(function = "validate_avatar_url_option"))]
    pub avatar_url: Option<String>,

    #[serde(default)]
    pub is_superadmin: bool,
}

/// Update user request
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update a user")]
pub struct UpdateUserRequest {
    #[schema(example = "johndoe")]
    #[validate(length(min = 1, max = 100, message = "Username must be between 1 and 100 characters"))]
    #[validate(custom(function = "validate_username"))]
    pub username: Option<String>,

    #[schema(example = "john@example.com")]
    #[validate(email(message = "Must be a valid email address"))]
    pub email: Option<String>,

    #[validate(length(max = 100, message = "First name cannot exceed 100 characters"))]
    pub first_name: Option<Option<String>>,

    #[validate(length(max = 100, message = "Last name cannot exceed 100 characters"))]
    pub last_name: Option<Option<String>>,

    #[validate(length(max = 200, message = "Display name cannot exceed 200 characters"))]
    pub display_name: Option<Option<String>>,

    #[validate(length(max = 500, message = "Avatar URL cannot exceed 500 characters"))]
    pub avatar_url: Option<Option<String>>,

    pub is_active: Option<bool>,

    pub is_superadmin: Option<bool>,
}

/// User site access response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "User site access")]
pub struct UserSiteResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub site_id: Uuid,
    pub role: UserRole,
    #[schema(example = "2024-01-15T10:30:00Z")]
    pub created_at: DateTime<Utc>,
}

impl From<UserSite> for UserSiteResponse {
    fn from(access: UserSite) -> Self {
        Self {
            site_id: access.site_id,
            role: access.role,
            created_at: access.created_at,
        }
    }
}

/// User with their site access
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "User with site role")]
pub struct UserWithAccess {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "johndoe")]
    pub username: String,
    #[schema(example = "John Doe")]
    pub display_name: Option<String>,
    #[schema(example = "https://example.com/avatar.png")]
    pub avatar_url: Option<String>,
    pub role: UserRole,
}

/// Paginated user list response
pub type PaginatedUsers = Paginated<UserResponse>;

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_user_response_serialization() {
        let user = UserResponse {
            id: Uuid::new_v4(),
            username: "johndoe".to_string(),
            email: "john@example.com".to_string(),
            first_name: Some("John".to_string()),
            last_name: Some("Doe".to_string()),
            display_name: Some("John Doe".to_string()),
            avatar_url: None,
            is_active: true,
            is_superadmin: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&user).unwrap();
        assert!(json.contains("\"username\":\"johndoe\""));
    }

    #[test]
    fn test_create_user_request_valid() {
        let request = CreateUserRequest {
            username: "johndoe".to_string(),
            email: "john@example.com".to_string(),
            first_name: Some("John".to_string()),
            last_name: Some("Doe".to_string()),
            display_name: Some("John Doe".to_string()),
            avatar_url: None,
            is_superadmin: false,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_user_request_empty_username() {
        let request = CreateUserRequest {
            username: "".to_string(),
            email: "john@example.com".to_string(),
            first_name: None,
            last_name: None,
            display_name: None,
            avatar_url: None,
            is_superadmin: false,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_user_request_invalid_email() {
        let request = CreateUserRequest {
            username: "johndoe".to_string(),
            email: "not-an-email".to_string(),
            first_name: None,
            last_name: None,
            display_name: None,
            avatar_url: None,
            is_superadmin: false,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_user_request_username_too_long() {
        let request = CreateUserRequest {
            username: "a".repeat(101),
            email: "john@example.com".to_string(),
            first_name: None,
            last_name: None,
            display_name: None,
            avatar_url: None,
            is_superadmin: false,
        };
        let result = request.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().field_errors().contains_key("username"));
    }

    #[test]
    fn test_create_user_request_invalid_username_with_spaces() {
        let request = CreateUserRequest {
            username: "john doe".to_string(),
            email: "john@example.com".to_string(),
            first_name: None,
            last_name: None,
            display_name: None,
            avatar_url: None,
            is_superadmin: false,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_user_request_invalid_username_special_chars() {
        let request = CreateUserRequest {
            username: "john@doe!".to_string(),
            email: "john@example.com".to_string(),
            first_name: None,
            last_name: None,
            display_name: None,
            avatar_url: None,
            is_superadmin: false,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_user_request_valid_username_patterns() {
        // Dots, underscores, hyphens are allowed
        for username in &["john.doe", "john_doe", "john-doe", "JohnDoe123"] {
            let request = CreateUserRequest {
                username: username.to_string(),
                email: "john@example.com".to_string(),
                first_name: None,
                last_name: None,
                display_name: None,
                avatar_url: None,
                is_superadmin: false,
            };
            assert!(request.validate().is_ok(), "Username '{}' should be valid", username);
        }
    }

    #[test]
    fn test_create_user_request_invalid_avatar_url() {
        let request = CreateUserRequest {
            username: "johndoe".to_string(),
            email: "john@example.com".to_string(),
            first_name: None,
            last_name: None,
            display_name: None,
            avatar_url: Some("not-a-valid-url".to_string()),
            is_superadmin: false,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_user_request_first_name_too_long() {
        let request = CreateUserRequest {
            username: "johndoe".to_string(),
            email: "john@example.com".to_string(),
            first_name: Some("a".repeat(101)),
            last_name: None,
            display_name: None,
            avatar_url: None,
            is_superadmin: false,
        };
        let result = request.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().field_errors().contains_key("first_name"));
    }

    // --- UpdateUserRequest validation tests ---

    #[test]
    fn test_update_user_request_valid_partial() {
        let request = UpdateUserRequest {
            username: Some("newname".to_string()),
            email: None,
            first_name: None,
            last_name: None,
            display_name: None,
            avatar_url: None,
            is_active: Some(true),
            is_superadmin: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_update_user_request_all_none() {
        let request = UpdateUserRequest {
            username: None,
            email: None,
            first_name: None,
            last_name: None,
            display_name: None,
            avatar_url: None,
            is_active: None,
            is_superadmin: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_update_user_request_invalid_email() {
        let request = UpdateUserRequest {
            username: None,
            email: Some("bad-email".to_string()),
            first_name: None,
            last_name: None,
            display_name: None,
            avatar_url: None,
            is_active: None,
            is_superadmin: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_update_user_request_username_too_long() {
        let request = UpdateUserRequest {
            username: Some("a".repeat(101)),
            email: None,
            first_name: None,
            last_name: None,
            display_name: None,
            avatar_url: None,
            is_active: None,
            is_superadmin: None,
        };
        assert!(request.validate().is_err());
    }
}
