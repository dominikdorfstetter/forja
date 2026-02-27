//! Site locale DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::models::locale::TextDirection;
use crate::models::site_locale::SiteLocaleWithDetails;

/// Request to add a locale to a site
#[derive(Debug, Clone, Deserialize, Validate, ToSchema)]
#[schema(description = "Add a locale to a site")]
pub struct AddSiteLocaleRequest {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub locale_id: Uuid,

    #[schema(example = false)]
    pub is_default: bool,

    #[schema(example = "en")]
    #[validate(length(max = 10, message = "URL prefix cannot exceed 10 characters"))]
    pub url_prefix: Option<String>,
}

/// Request to update a site locale assignment
#[derive(Debug, Clone, Deserialize, Validate, ToSchema)]
#[schema(description = "Update a site locale assignment")]
pub struct UpdateSiteLocaleRequest {
    #[schema(example = true)]
    pub is_default: Option<bool>,

    #[schema(example = true)]
    pub is_active: Option<bool>,

    #[schema(example = "en")]
    #[validate(length(max = 10, message = "URL prefix cannot exceed 10 characters"))]
    pub url_prefix: Option<String>,
}

/// Locale input for bulk assignment during site creation
#[derive(Debug, Clone, Deserialize, Validate, ToSchema)]
#[schema(description = "Locale input for site creation")]
pub struct SiteLocaleInput {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub locale_id: Uuid,

    #[schema(example = true)]
    pub is_default: bool,

    #[schema(example = "en")]
    #[validate(length(max = 10, message = "URL prefix cannot exceed 10 characters"))]
    pub url_prefix: Option<String>,
}

/// Site locale response (with locale details)
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(description = "Site locale with full locale details")]
pub struct SiteLocaleResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub site_id: Uuid,

    #[schema(example = "660e8400-e29b-41d4-a716-446655440000")]
    pub locale_id: Uuid,

    #[schema(example = true)]
    pub is_default: bool,

    #[schema(example = true)]
    pub is_active: bool,

    #[schema(example = "en")]
    pub url_prefix: Option<String>,

    #[schema(example = "2024-01-15T10:30:00Z")]
    pub created_at: DateTime<Utc>,

    #[schema(example = "en")]
    pub code: String,

    #[schema(example = "English")]
    pub name: String,

    #[schema(example = "English")]
    pub native_name: Option<String>,

    pub direction: TextDirection,
}

impl From<SiteLocaleWithDetails> for SiteLocaleResponse {
    fn from(sld: SiteLocaleWithDetails) -> Self {
        Self {
            site_id: sld.site_id,
            locale_id: sld.locale_id,
            is_default: sld.is_default,
            is_active: sld.is_active,
            url_prefix: sld.url_prefix,
            created_at: sld.created_at,
            code: sld.code,
            name: sld.name,
            native_name: sld.native_name,
            direction: sld.direction,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use validator::Validate;

    #[test]
    fn test_add_site_locale_request_valid() {
        let req = AddSiteLocaleRequest {
            locale_id: Uuid::new_v4(),
            is_default: false,
            url_prefix: Some("en".to_string()),
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_add_site_locale_request_prefix_too_long() {
        let req = AddSiteLocaleRequest {
            locale_id: Uuid::new_v4(),
            is_default: false,
            url_prefix: Some("a".repeat(11)),
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_update_site_locale_request_valid() {
        let req = UpdateSiteLocaleRequest {
            is_default: Some(true),
            is_active: None,
            url_prefix: None,
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_site_locale_input_valid() {
        let input = SiteLocaleInput {
            locale_id: Uuid::new_v4(),
            is_default: true,
            url_prefix: Some("de".to_string()),
        };
        assert!(input.validate().is_ok());
    }

    #[test]
    fn test_site_locale_response_from_with_details() {
        let details = SiteLocaleWithDetails {
            site_id: Uuid::new_v4(),
            locale_id: Uuid::new_v4(),
            is_default: true,
            is_active: true,
            url_prefix: Some("en".to_string()),
            created_at: Utc::now(),
            code: "en".to_string(),
            name: "English".to_string(),
            native_name: Some("English".to_string()),
            direction: TextDirection::Ltr,
        };

        let response = SiteLocaleResponse::from(details.clone());
        assert_eq!(response.code, "en");
        assert_eq!(response.name, "English");
        assert!(response.is_default);
    }
}
