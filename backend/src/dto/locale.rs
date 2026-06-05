//! Locale DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::dto::validated::ValidatedDto;
use crate::models::locale::{Locale, LocaleWithUsage, TextDirection};
use crate::utils::validation::validate_locale_code;

/// Request to create a new locale
#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, utoipa::ToSchema)]
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
#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, utoipa::ToSchema)]
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
    #[schema(example = 0)]
    pub site_count: i64,
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
            site_count: 0,
        }
    }
}

impl From<LocaleWithUsage> for LocaleResponse {
    fn from(locale: LocaleWithUsage) -> Self {
        Self {
            id: locale.id,
            code: locale.code,
            name: locale.name,
            native_name: locale.native_name,
            direction: locale.direction,
            is_active: locale.is_active,
            created_at: locale.created_at,
            site_count: locale.site_count,
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

    /// Tracer bullet for the validation seam (issue #611).
    ///
    /// Drives `ValidatedJson::<UpdateLocaleRequest>` against a synthetic
    /// request whose body fails the `length(max = 100)` constraint on `name`.
    /// The seam should reject with 422 and a structured field error — not the
    /// 400 the old inline `body.validate().map_err(bad_request)` produced.
    #[tokio::test]
    async fn validated_json_rejects_oversize_locale_name() {
        use crate::dto::validated::ValidatedJson;
        use axum::body::Body;
        use axum::extract::{FromRequest, Request};
        use std::sync::Arc;

        let state = crate::AppState {
            db: sqlx::PgPool::connect_lazy("postgres://localhost/forja_test_unused").unwrap(),
            settings: crate::config::Settings::default(),
            redis: None,
            clerk_service: None,
            storage: Arc::new(crate::services::storage::LocalStorage::new(
                "/tmp/forja-test-unused".to_string(),
                "/uploads".to_string(),
            )),
            clerk_jwks: None,
            dashboard_csp_template: Arc::from(""),
            demo_guest_key: std::sync::OnceLock::new(),
        };

        let oversized = "a".repeat(101);
        let body_json = serde_json::json!({ "name": oversized });
        let req = Request::builder()
            .method("PUT")
            .uri("/locales/00000000-0000-0000-0000-000000000000")
            .header("content-type", "application/json")
            .body(Body::from(body_json.to_string()))
            .unwrap();

        let result = ValidatedJson::<UpdateLocaleRequest>::from_request(req, &state).await;
        let Err(err) = result else {
            panic!("expected validation rejection for oversize name");
        };
        assert_eq!(
            err.status().as_u16(),
            422,
            "validation errors should surface as 422 Unprocessable Entity"
        );
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
            site_count: 0,
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"code\":\"en\""));
        assert!(json.contains("\"name\":\"English\""));
    }
}
