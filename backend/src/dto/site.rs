//! Site DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::dto::site_locale::SiteLocaleInput;
use crate::models::site::Site;

/// Request to create a new site
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Create a site")]
pub struct CreateSiteRequest {
    #[schema(example = "My Website")]
    #[validate(length(
        min = 1,
        max = 200,
        message = "Name must be between 1 and 200 characters"
    ))]
    pub name: String,

    #[schema(example = "my-website")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Slug must be between 1 and 100 characters"
    ))]
    #[validate(custom(function = "validate_slug"))]
    pub slug: String,

    #[schema(example = "A great website")]
    #[validate(length(max = 1000, message = "Description cannot exceed 1000 characters"))]
    pub description: Option<String>,

    #[schema(example = "https://example.com/logo.png")]
    #[validate(url(message = "Logo URL must be a valid URL"))]
    pub logo_url: Option<String>,

    #[schema(example = "https://example.com/favicon.ico")]
    #[validate(url(message = "Favicon URL must be a valid URL"))]
    pub favicon_url: Option<String>,

    #[validate(custom(function = "validate_theme_json"))]
    pub theme: Option<serde_json::Value>,

    #[schema(example = "Europe/Vienna")]
    #[validate(length(max = 50, message = "Timezone cannot exceed 50 characters"))]
    #[validate(custom(function = "validate_timezone_option"))]
    pub timezone: Option<String>,

    /// Initial locales to assign to the site (optional)
    #[serde(default)]
    pub locales: Option<Vec<SiteLocaleInput>>,
}

/// Request to update a site
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update a site")]
pub struct UpdateSiteRequest {
    #[schema(example = "Updated Website")]
    #[validate(length(
        min = 1,
        max = 200,
        message = "Name must be between 1 and 200 characters"
    ))]
    pub name: Option<String>,

    #[schema(example = "updated-website")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Slug must be between 1 and 100 characters"
    ))]
    #[validate(custom(function = "validate_slug_option"))]
    pub slug: Option<String>,

    #[schema(example = "Updated description")]
    #[validate(length(max = 1000, message = "Description cannot exceed 1000 characters"))]
    pub description: Option<String>,

    #[schema(example = "https://example.com/new-logo.png")]
    #[validate(url(message = "Logo URL must be a valid URL"))]
    pub logo_url: Option<String>,

    #[schema(example = "https://example.com/new-favicon.ico")]
    #[validate(url(message = "Favicon URL must be a valid URL"))]
    pub favicon_url: Option<String>,

    #[validate(custom(function = "validate_theme_json"))]
    pub theme: Option<serde_json::Value>,

    #[schema(example = "Europe/Vienna")]
    #[validate(length(max = 50, message = "Timezone cannot exceed 50 characters"))]
    #[validate(custom(function = "validate_timezone_option"))]
    pub timezone: Option<String>,

    #[schema(example = false)]
    pub is_active: Option<bool>,
}

/// Site response
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[schema(description = "Full site details")]
pub struct SiteResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "My Website")]
    pub name: String,
    #[schema(example = "my-website")]
    pub slug: String,
    #[schema(example = "A great website")]
    pub description: Option<String>,
    #[schema(example = "https://example.com/logo.png")]
    pub logo_url: Option<String>,
    #[schema(example = "https://example.com/favicon.ico")]
    pub favicon_url: Option<String>,
    pub theme: Option<serde_json::Value>,
    #[schema(example = "660e8400-e29b-41d4-a716-446655440000")]
    pub default_locale_id: Option<Uuid>,
    #[schema(example = "Europe/Vienna")]
    pub timezone: String,
    #[schema(example = true)]
    pub is_active: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by: Option<String>,
    #[schema(example = "2024-01-15T10:30:00Z")]
    pub created_at: DateTime<Utc>,
    #[schema(example = "2024-01-16T12:00:00Z")]
    pub updated_at: DateTime<Utc>,
}

impl From<Site> for SiteResponse {
    fn from(site: Site) -> Self {
        Self {
            id: site.id,
            name: site.name,
            slug: site.slug,
            description: site.description,
            logo_url: site.logo_url,
            favicon_url: site.favicon_url,
            theme: site.theme,
            default_locale_id: site.default_locale_id,
            timezone: site.timezone,
            is_active: site.is_active,
            created_by: site.created_by,
            created_at: site.created_at,
            updated_at: site.updated_at,
        }
    }
}

/// Import the validation module to use the slug validation function
use crate::utils::validation::{validate_json_depth, validate_slug, validate_timezone};

/// Validate a slug from a string reference
fn validate_slug_option(slug: &str) -> Result<(), validator::ValidationError> {
    validate_slug(slug)
}

/// Validate timezone format for Option<String> fields
fn validate_timezone_option(tz: &str) -> Result<(), validator::ValidationError> {
    validate_timezone(tz)
}

/// Validate theme JSON is not excessively nested
fn validate_theme_json(value: &serde_json::Value) -> Result<(), validator::ValidationError> {
    validate_json_depth(value, 10)
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_create_site_request_valid() {
        let request = CreateSiteRequest {
            name: "My Website".to_string(),
            slug: "my-website".to_string(),
            description: Some("A great website".to_string()),
            logo_url: None,
            favicon_url: None,
            theme: None,
            timezone: Some("Europe/Vienna".to_string()),
            locales: None,
        };

        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_site_request_empty_name() {
        let request = CreateSiteRequest {
            name: "".to_string(),
            slug: "my-website".to_string(),
            description: None,
            logo_url: None,
            favicon_url: None,
            theme: None,
            timezone: None,
            locales: None,
        };

        let result = request.validate();
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.field_errors().contains_key("name"));
    }

    #[test]
    fn test_create_site_request_empty_slug() {
        let request = CreateSiteRequest {
            name: "My Website".to_string(),
            slug: "".to_string(),
            description: None,
            logo_url: None,
            favicon_url: None,
            theme: None,
            timezone: None,
            locales: None,
        };

        let result = request.validate();
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.field_errors().contains_key("slug"));
    }

    #[test]
    fn test_create_site_request_name_too_long() {
        let request = CreateSiteRequest {
            name: "a".repeat(201),
            slug: "my-website".to_string(),
            description: None,
            logo_url: None,
            favicon_url: None,
            theme: None,
            timezone: None,
            locales: None,
        };

        let result = request.validate();
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.field_errors().contains_key("name"));
    }

    #[test]
    fn test_update_site_request_valid() {
        let request = UpdateSiteRequest {
            name: Some("Updated Website".to_string()),
            slug: None,
            description: Some("Updated description".to_string()),
            logo_url: None,
            favicon_url: None,
            theme: None,
            timezone: None,
            is_active: Some(false),
        };

        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_update_site_request_empty_allowed() {
        // All fields are optional in update
        let request = UpdateSiteRequest {
            name: None,
            slug: None,
            description: None,
            logo_url: None,
            favicon_url: None,
            theme: None,
            timezone: None,
            is_active: None,
        };

        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_site_response_serialization() {
        let site = Site {
            id: Uuid::new_v4(),
            name: "Test Site".to_string(),
            slug: "test-site".to_string(),
            description: Some("A test site".to_string()),
            logo_url: None,
            favicon_url: None,
            theme: None,
            default_locale_id: None,
            timezone: "UTC".to_string(),
            is_active: true,
            is_deleted: false,
            created_by: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let response = SiteResponse::from(site.clone());

        assert_eq!(response.id, site.id);
        assert_eq!(response.name, site.name);
        assert_eq!(response.slug, site.slug);
        assert_eq!(response.is_active, site.is_active);

        // Verify serialization works
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("test-site"));
        assert!(json.contains("Test Site"));
    }

    #[test]
    fn test_site_response_deserialization() {
        let json = r#"{
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "name": "Test Site",
            "slug": "test-site",
            "description": null,
            "logo_url": null,
            "favicon_url": null,
            "theme": null,
            "default_locale_id": null,
            "timezone": "UTC",
            "is_active": true,
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        }"#;

        let response: SiteResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.name, "Test Site");
        assert_eq!(response.slug, "test-site");
        assert!(response.is_active);
    }

    #[test]
    fn test_create_site_request_invalid_timezone() {
        let request = CreateSiteRequest {
            name: "My Website".to_string(),
            slug: "my-website".to_string(),
            description: None,
            logo_url: None,
            favicon_url: None,
            theme: None,
            timezone: Some("InvalidTimezone".to_string()),
            locales: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_site_request_theme_too_deep() {
        // Build deeply nested JSON (12 levels)
        let mut deep = serde_json::json!("value");
        for _ in 0..12 {
            deep = serde_json::json!({"nested": deep});
        }

        let request = CreateSiteRequest {
            name: "My Website".to_string(),
            slug: "my-website".to_string(),
            description: None,
            logo_url: None,
            favicon_url: None,
            theme: Some(deep),
            timezone: None,
            locales: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_site_request_invalid_slug_pattern() {
        let request = CreateSiteRequest {
            name: "My Website".to_string(),
            slug: "My Website!".to_string(),
            description: None,
            logo_url: None,
            favicon_url: None,
            theme: None,
            timezone: None,
            locales: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_site_request_description_too_long() {
        let request = CreateSiteRequest {
            name: "My Website".to_string(),
            slug: "my-website".to_string(),
            description: Some("a".repeat(1001)),
            logo_url: None,
            favicon_url: None,
            theme: None,
            timezone: None,
            locales: None,
        };
        let result = request.validate();
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .field_errors()
            .contains_key("description"));
    }

    #[test]
    fn test_update_site_request_invalid_timezone() {
        let request = UpdateSiteRequest {
            name: None,
            slug: None,
            description: None,
            logo_url: None,
            favicon_url: None,
            theme: None,
            timezone: Some("BadTimezone".to_string()),
            is_active: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_update_site_request_slug_with_uppercase() {
        let request = UpdateSiteRequest {
            name: None,
            slug: Some("My-Slug".to_string()),
            description: None,
            logo_url: None,
            favicon_url: None,
            theme: None,
            timezone: None,
            is_active: None,
        };
        assert!(request.validate().is_err());
    }
}
