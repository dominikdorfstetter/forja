//! Locale DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::models::locale::{Locale, TextDirection};
use crate::utils::validation::validate_locale_code;

/// Request to create a new locale
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Create a locale")]
pub struct CreateLocaleRequest {
    #[schema(example = "en")]
    #[validate(length(
        min = 2,
        max = 10,
        message = "Code must be between 2 and 10 characters"
    ))]
    #[validate(custom(function = "validate_locale_code"))]
    pub code: String,

    #[schema(example = "English")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Name must be between 1 and 100 characters"
    ))]
    pub name: String,

    #[schema(example = "English")]
    #[validate(length(max = 100, message = "Native name cannot exceed 100 characters"))]
    pub native_name: Option<String>,

    #[schema(example = "Ltr")]
    #[serde(default = "default_direction")]
    pub direction: TextDirection,

    #[schema(example = true)]
    #[serde(default = "default_true")]
    pub is_active: bool,
}

fn default_direction() -> TextDirection {
    TextDirection::Ltr
}

fn default_true() -> bool {
    true
}

/// Request to update a locale
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update a locale")]
pub struct UpdateLocaleRequest {
    #[schema(example = "English (Updated)")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Name must be between 1 and 100 characters"
    ))]
    pub name: Option<String>,

    #[schema(example = "English")]
    #[validate(length(max = 100, message = "Native name cannot exceed 100 characters"))]
    pub native_name: Option<String>,

    #[schema(example = "Ltr")]
    pub direction: Option<TextDirection>,

    #[schema(example = true)]
    pub is_active: Option<bool>,
}

/// Locale response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Locale details")]
pub struct LocaleResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "en")]
    pub code: String,
    #[schema(example = "English")]
    pub name: String,
    #[schema(example = "English")]
    pub native_name: Option<String>,
    #[schema(example = "Ltr")]
    pub direction: TextDirection,
    #[schema(example = true)]
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

impl From<Locale> for LocaleResponse {
    fn from(locale: Locale) -> Self {
        Self {
            id: locale.id,
            code: locale.code,
            name: locale.name,
            native_name: locale.native_name,
            direction: locale.direction,
            is_active: locale.is_active,
            created_at: locale.created_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_create_locale_request_valid() {
        let request = CreateLocaleRequest {
            code: "en".to_string(),
            name: "English".to_string(),
            native_name: Some("English".to_string()),
            direction: TextDirection::Ltr,
            is_active: true,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_locale_request_with_region() {
        let request = CreateLocaleRequest {
            code: "en-US".to_string(),
            name: "English (US)".to_string(),
            native_name: None,
            direction: TextDirection::Ltr,
            is_active: true,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_locale_request_rtl() {
        let request = CreateLocaleRequest {
            code: "ar".to_string(),
            name: "Arabic".to_string(),
            native_name: Some("العربية".to_string()),
            direction: TextDirection::Rtl,
            is_active: true,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_locale_request_invalid_code() {
        let request = CreateLocaleRequest {
            code: "english".to_string(), // Should be 2-letter code
            name: "English".to_string(),
            native_name: None,
            direction: TextDirection::Ltr,
            is_active: true,
        };
        let result = request.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_create_locale_request_empty_name() {
        let request = CreateLocaleRequest {
            code: "en".to_string(),
            name: "".to_string(),
            native_name: None,
            direction: TextDirection::Ltr,
            is_active: true,
        };
        let result = request.validate();
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.field_errors().contains_key("name"));
    }

    #[test]
    fn test_update_locale_request_valid() {
        let request = UpdateLocaleRequest {
            name: Some("Updated English".to_string()),
            native_name: None,
            direction: Some(TextDirection::Ltr),
            is_active: Some(false),
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_update_locale_request_all_optional() {
        let request = UpdateLocaleRequest {
            name: None,
            native_name: None,
            direction: None,
            is_active: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_locale_response_serialization() {
        let response = LocaleResponse {
            id: Uuid::new_v4(),
            code: "en".to_string(),
            name: "English".to_string(),
            native_name: Some("English".to_string()),
            direction: TextDirection::Ltr,
            is_active: true,
            created_at: Utc::now(),
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"code\":\"en\""));
        assert!(json.contains("\"name\":\"English\""));
    }
}
