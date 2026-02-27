//! Content localization DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::models::content::{ContentLocalization, TranslationStatus};
use crate::utils::validation::contains_dangerous_content;

/// Request to create a new localization
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Create content localization")]
pub struct CreateLocalizationRequest {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub locale_id: Uuid,

    #[schema(example = "My Blog Post Title")]
    #[validate(length(
        min = 1,
        max = 500,
        message = "Title must be between 1 and 500 characters"
    ))]
    #[validate(custom(function = "validate_no_xss"))]
    pub title: String,

    #[schema(example = "A brief subtitle")]
    #[validate(length(max = 500, message = "Subtitle cannot exceed 500 characters"))]
    #[validate(custom(function = "validate_no_xss"))]
    pub subtitle: Option<String>,

    #[validate(length(max = 2000, message = "Excerpt cannot exceed 2000 characters"))]
    #[validate(custom(function = "validate_no_xss"))]
    pub excerpt: Option<String>,

    #[validate(length(max = 200000, message = "Body cannot exceed 200000 characters"))]
    #[validate(custom(function = "validate_no_xss"))]
    pub body: Option<String>,

    #[validate(length(max = 200, message = "Meta title cannot exceed 200 characters"))]
    #[validate(custom(function = "validate_no_xss"))]
    pub meta_title: Option<String>,

    #[validate(length(max = 500, message = "Meta description cannot exceed 500 characters"))]
    #[validate(custom(function = "validate_no_xss"))]
    pub meta_description: Option<String>,
}

/// Request to update a localization
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update content localization")]
pub struct UpdateLocalizationRequest {
    #[schema(example = "Updated Blog Post Title")]
    #[validate(length(
        min = 1,
        max = 500,
        message = "Title must be between 1 and 500 characters"
    ))]
    #[validate(custom(function = "validate_no_xss"))]
    pub title: Option<String>,

    #[schema(example = "Updated subtitle")]
    #[validate(length(max = 500, message = "Subtitle cannot exceed 500 characters"))]
    #[validate(custom(function = "validate_no_xss"))]
    pub subtitle: Option<String>,

    #[validate(length(max = 2000, message = "Excerpt cannot exceed 2000 characters"))]
    #[validate(custom(function = "validate_no_xss"))]
    pub excerpt: Option<String>,

    #[validate(length(max = 200000, message = "Body cannot exceed 200000 characters"))]
    #[validate(custom(function = "validate_no_xss"))]
    pub body: Option<String>,

    #[validate(length(max = 200, message = "Meta title cannot exceed 200 characters"))]
    #[validate(custom(function = "validate_no_xss"))]
    pub meta_title: Option<String>,

    #[validate(length(max = 500, message = "Meta description cannot exceed 500 characters"))]
    #[validate(custom(function = "validate_no_xss"))]
    pub meta_description: Option<String>,

    pub translation_status: Option<TranslationStatus>,
}

/// Localization response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Content localization details")]
pub struct LocalizationResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "660e8400-e29b-41d4-a716-446655440000")]
    pub content_id: Uuid,
    #[schema(example = "770e8400-e29b-41d4-a716-446655440000")]
    pub locale_id: Uuid,
    #[schema(example = "My Blog Post Title")]
    pub title: String,
    pub subtitle: Option<String>,
    pub excerpt: Option<String>,
    pub body: Option<String>,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub translation_status: TranslationStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<ContentLocalization> for LocalizationResponse {
    fn from(loc: ContentLocalization) -> Self {
        Self {
            id: loc.id,
            content_id: loc.content_id,
            locale_id: loc.locale_id,
            title: loc.title,
            subtitle: loc.subtitle,
            excerpt: loc.excerpt,
            body: loc.body,
            meta_title: loc.meta_title,
            meta_description: loc.meta_description,
            translation_status: loc.translation_status,
            created_at: loc.created_at,
            updated_at: loc.updated_at,
        }
    }
}

/// Reject content containing dangerous HTML/JS patterns (XSS prevention)
fn validate_no_xss(text: &str) -> Result<(), validator::ValidationError> {
    if contains_dangerous_content(text) {
        let mut err = validator::ValidationError::new("dangerous_content");
        err.message = Some("Content contains potentially dangerous HTML or JavaScript".into());
        return Err(err);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_create_localization_request_valid() {
        let request = CreateLocalizationRequest {
            locale_id: Uuid::new_v4(),
            title: "My Blog Post".to_string(),
            subtitle: Some("A subtitle".to_string()),
            excerpt: None,
            body: Some("# Hello\n\nWorld".to_string()),
            meta_title: None,
            meta_description: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_localization_request_empty_title() {
        let request = CreateLocalizationRequest {
            locale_id: Uuid::new_v4(),
            title: "".to_string(),
            subtitle: None,
            excerpt: None,
            body: None,
            meta_title: None,
            meta_description: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_update_localization_request_all_optional() {
        let request = UpdateLocalizationRequest {
            title: None,
            subtitle: None,
            excerpt: None,
            body: None,
            meta_title: None,
            meta_description: None,
            translation_status: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_localization_request_title_too_long() {
        let request = CreateLocalizationRequest {
            locale_id: Uuid::new_v4(),
            title: "a".repeat(501),
            subtitle: None,
            excerpt: None,
            body: None,
            meta_title: None,
            meta_description: None,
        };
        let result = request.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().field_errors().contains_key("title"));
    }

    #[test]
    fn test_create_localization_request_subtitle_too_long() {
        let request = CreateLocalizationRequest {
            locale_id: Uuid::new_v4(),
            title: "Valid Title".to_string(),
            subtitle: Some("a".repeat(501)),
            excerpt: None,
            body: None,
            meta_title: None,
            meta_description: None,
        };
        let result = request.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().field_errors().contains_key("subtitle"));
    }

    #[test]
    fn test_create_localization_request_meta_title_too_long() {
        let request = CreateLocalizationRequest {
            locale_id: Uuid::new_v4(),
            title: "Valid Title".to_string(),
            subtitle: None,
            excerpt: None,
            body: None,
            meta_title: Some("a".repeat(201)),
            meta_description: None,
        };
        let result = request.validate();
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .field_errors()
            .contains_key("meta_title"));
    }

    #[test]
    fn test_create_localization_request_meta_description_too_long() {
        let request = CreateLocalizationRequest {
            locale_id: Uuid::new_v4(),
            title: "Valid Title".to_string(),
            subtitle: None,
            excerpt: None,
            body: None,
            meta_title: None,
            meta_description: Some("a".repeat(501)),
        };
        let result = request.validate();
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .field_errors()
            .contains_key("meta_description"));
    }

    #[test]
    fn test_create_localization_request_body_at_max() {
        let request = CreateLocalizationRequest {
            locale_id: Uuid::new_v4(),
            title: "Valid Title".to_string(),
            subtitle: None,
            excerpt: None,
            body: Some("a".repeat(200000)),
            meta_title: None,
            meta_description: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_localization_request_body_exceeds_max() {
        let request = CreateLocalizationRequest {
            locale_id: Uuid::new_v4(),
            title: "Valid Title".to_string(),
            subtitle: None,
            excerpt: None,
            body: Some("a".repeat(200001)),
            meta_title: None,
            meta_description: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_update_localization_request_title_too_long() {
        let request = UpdateLocalizationRequest {
            title: Some("a".repeat(501)),
            subtitle: None,
            excerpt: None,
            body: None,
            meta_title: None,
            meta_description: None,
            translation_status: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_update_localization_request_subtitle_too_long() {
        let request = UpdateLocalizationRequest {
            title: None,
            subtitle: Some("a".repeat(501)),
            excerpt: None,
            body: None,
            meta_title: None,
            meta_description: None,
            translation_status: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_localization_request_xss_in_title() {
        let request = CreateLocalizationRequest {
            locale_id: Uuid::new_v4(),
            title: "<script>alert('xss')</script>".to_string(),
            subtitle: None,
            excerpt: None,
            body: None,
            meta_title: None,
            meta_description: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_localization_request_xss_in_body() {
        let request = CreateLocalizationRequest {
            locale_id: Uuid::new_v4(),
            title: "Valid Title".to_string(),
            subtitle: None,
            excerpt: None,
            body: Some("Hello <script>alert(1)</script> world".to_string()),
            meta_title: None,
            meta_description: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_localization_request_xss_onclick() {
        let request = CreateLocalizationRequest {
            locale_id: Uuid::new_v4(),
            title: "Valid Title".to_string(),
            subtitle: None,
            excerpt: None,
            body: Some("<div onclick=alert(1)>click me</div>".to_string()),
            meta_title: None,
            meta_description: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_localization_request_xss_javascript_url() {
        let request = CreateLocalizationRequest {
            locale_id: Uuid::new_v4(),
            title: "Valid Title".to_string(),
            subtitle: None,
            excerpt: None,
            body: Some("Visit javascript:void(0) for more".to_string()),
            meta_title: None,
            meta_description: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_update_localization_request_xss_in_body() {
        let request = UpdateLocalizationRequest {
            title: None,
            subtitle: None,
            excerpt: None,
            body: Some("<script>document.cookie</script>".to_string()),
            meta_title: None,
            meta_description: None,
            translation_status: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_localization_safe_html_passes() {
        let request = CreateLocalizationRequest {
            locale_id: Uuid::new_v4(),
            title: "Valid Title".to_string(),
            subtitle: None,
            excerpt: None,
            body: Some("<h1>Hello</h1><p>This is <strong>safe</strong> HTML</p>".to_string()),
            meta_title: None,
            meta_description: None,
        };
        assert!(request.validate().is_ok());
    }
}
