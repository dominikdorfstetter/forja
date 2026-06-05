//! Environment DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::models::environment::{Environment, EnvironmentType};

/// Request to create a new environment
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Create an environment")]
pub struct CreateEnvironmentRequest {
    #[schema(example = "Production")]
    pub name: EnvironmentType,

    #[schema(example = "Production Environment")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Display name must be between 1 and 100 characters"
    ))]
    pub display_name: String,

    #[schema(example = false)]
    #[serde(default)]
    pub is_default: bool,
}

/// Request to update an environment
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update an environment")]
pub struct UpdateEnvironmentRequest {
    #[schema(example = "Updated Environment Name")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Display name must be between 1 and 100 characters"
    ))]
    pub display_name: Option<String>,

    #[schema(example = true)]
    pub is_default: Option<bool>,
}

/// Environment response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Environment details")]
pub struct EnvironmentResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "Production")]
    pub name: EnvironmentType,
    #[schema(example = "Production Environment")]
    pub display_name: String,
    #[schema(example = true)]
    pub is_default: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Environment> for EnvironmentResponse {
    fn from(env: Environment) -> Self {
        Self {
            id: env.id,
            name: env.name,
            display_name: env.display_name,
            is_default: env.is_default,
            created_at: env.created_at,
            updated_at: env.updated_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_create_environment_request_valid() {
        let request = CreateEnvironmentRequest {
            name: EnvironmentType::Production,
            display_name: "Production Environment".to_string(),
            is_default: true,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_environment_request_empty_display_name() {
        let request = CreateEnvironmentRequest {
            name: EnvironmentType::Staging,
            display_name: "".to_string(),
            is_default: false,
        };
        let result = request.validate();
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.field_errors().contains_key("display_name"));
    }

    #[test]
    fn test_create_environment_request_display_name_too_long() {
        let request = CreateEnvironmentRequest {
            name: EnvironmentType::Development,
            display_name: "a".repeat(101),
            is_default: false,
        };
        let result = request.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_update_environment_request_valid() {
        let request = UpdateEnvironmentRequest {
            display_name: Some("Updated Name".to_string()),
            is_default: Some(false),
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_update_environment_request_all_optional() {
        let request = UpdateEnvironmentRequest {
            display_name: None,
            is_default: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_environment_response_serialization() {
        let response = EnvironmentResponse {
            id: Uuid::new_v4(),
            name: EnvironmentType::Production,
            display_name: "Production".to_string(),
            is_default: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"name\":\"Production\""));
        assert!(json.contains("\"is_default\":true"));
    }
}
