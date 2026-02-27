//! Social DTOs

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::models::social::SocialLink;
use crate::utils::validation::{validate_icon, validate_url};

/// Request to create a social link
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Create a social link")]
pub struct CreateSocialLinkRequest {
    #[schema(example = "GitHub")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Title must be between 1 and 100 characters"
    ))]
    pub title: String,

    #[schema(example = "https://github.com/example")]
    #[validate(length(
        min = 1,
        max = 2000,
        message = "URL must be between 1 and 2000 characters"
    ))]
    #[validate(custom(function = "validate_url_required"))]
    pub url: String,

    #[schema(example = "github")]
    #[validate(length(
        min = 1,
        max = 50,
        message = "Icon must be between 1 and 50 characters"
    ))]
    #[validate(custom(function = "validate_icon"))]
    pub icon: String,

    #[schema(example = "GitHub Profile")]
    #[validate(length(max = 200, message = "Alt text cannot exceed 200 characters"))]
    pub alt_text: Option<String>,

    #[schema(example = 1)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: i16,

    /// Site ID to associate this social link with
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub site_id: Uuid,
}

/// Validate URL (required version)
fn validate_url_required(url: &str) -> Result<(), validator::ValidationError> {
    if url.is_empty() {
        let mut err = validator::ValidationError::new("invalid_url");
        err.message = Some("URL is required".into());
        return Err(err);
    }
    validate_url(url)
}

/// Request to update a social link
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update a social link")]
pub struct UpdateSocialLinkRequest {
    #[schema(example = "Updated GitHub")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Title must be between 1 and 100 characters"
    ))]
    pub title: Option<String>,

    #[schema(example = "https://github.com/updated-example")]
    #[validate(length(
        min = 1,
        max = 2000,
        message = "URL must be between 1 and 2000 characters"
    ))]
    #[validate(custom(function = "validate_url"))]
    pub url: Option<String>,

    #[schema(example = "github")]
    #[validate(length(
        min = 1,
        max = 50,
        message = "Icon must be between 1 and 50 characters"
    ))]
    #[validate(custom(function = "validate_icon"))]
    pub icon: Option<String>,

    #[schema(example = "GitHub Profile")]
    #[validate(length(max = 200, message = "Alt text cannot exceed 200 characters"))]
    pub alt_text: Option<String>,

    #[schema(example = 2)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: Option<i16>,
}

/// Social link response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Social link details")]
pub struct SocialLinkResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "GitHub")]
    pub title: String,
    #[schema(example = "https://github.com/example")]
    pub url: String,
    #[schema(example = "github")]
    pub icon: String,
    #[schema(example = "GitHub Profile")]
    pub alt_text: Option<String>,
    #[schema(example = 1)]
    pub display_order: i16,
}

impl From<SocialLink> for SocialLinkResponse {
    fn from(link: SocialLink) -> Self {
        Self {
            id: link.id,
            title: link.title,
            url: link.url,
            icon: link.icon,
            alt_text: link.alt_text,
            display_order: link.display_order,
        }
    }
}

/// Single item in a reorder request
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "A social link ID with its new display order")]
pub struct ReorderItem {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,

    #[schema(example = 0)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: i16,
}

/// Request to batch-reorder social links
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Batch reorder social links")]
pub struct ReorderSocialLinksRequest {
    #[validate(nested)]
    pub items: Vec<ReorderItem>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_create_social_link_request_valid() {
        let request = CreateSocialLinkRequest {
            title: "GitHub".to_string(),
            url: "https://github.com/example".to_string(),
            icon: "github".to_string(),
            alt_text: Some("GitHub Profile".to_string()),
            display_order: 1,
            site_id: Uuid::new_v4(),
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_social_link_request_empty_title() {
        let request = CreateSocialLinkRequest {
            title: "".to_string(),
            url: "https://github.com/example".to_string(),
            icon: "github".to_string(),
            alt_text: None,
            display_order: 0,
            site_id: Uuid::new_v4(),
        };
        let result = request.validate();
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.field_errors().contains_key("title"));
    }

    #[test]
    fn test_create_social_link_request_invalid_url() {
        let request = CreateSocialLinkRequest {
            title: "Bad Link".to_string(),
            url: "not-a-valid-url".to_string(),
            icon: "link".to_string(),
            alt_text: None,
            display_order: 0,
            site_id: Uuid::new_v4(),
        };
        let result = request.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_create_social_link_request_javascript_url() {
        let request = CreateSocialLinkRequest {
            title: "XSS Attempt".to_string(),
            url: "javascript:alert(1)".to_string(),
            icon: "danger".to_string(),
            alt_text: None,
            display_order: 0,
            site_id: Uuid::new_v4(),
        };
        let result = request.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_create_social_link_request_invalid_icon() {
        let request = CreateSocialLinkRequest {
            title: "Test".to_string(),
            url: "https://example.com".to_string(),
            icon: "Invalid Icon!".to_string(), // Invalid: spaces and special chars
            alt_text: None,
            display_order: 0,
            site_id: Uuid::new_v4(),
        };
        let result = request.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_update_social_link_request_valid() {
        let request = UpdateSocialLinkRequest {
            title: Some("Updated Title".to_string()),
            url: Some("https://updated.example.com".to_string()),
            icon: None,
            alt_text: None,
            display_order: Some(5),
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_update_social_link_request_all_optional() {
        let request = UpdateSocialLinkRequest {
            title: None,
            url: None,
            icon: None,
            alt_text: None,
            display_order: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_social_link_response_serialization() {
        let link = SocialLinkResponse {
            id: Uuid::new_v4(),
            title: "GitHub".to_string(),
            url: "https://github.com/example".to_string(),
            icon: "github".to_string(),
            alt_text: Some("GitHub Profile".to_string()),
            display_order: 1,
        };

        let json = serde_json::to_string(&link).unwrap();
        assert!(json.contains("\"title\":\"GitHub\""));
    }
}
