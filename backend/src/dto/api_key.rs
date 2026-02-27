//! API Key DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::models::api_key::{ApiKey, ApiKeyPermission, ApiKeyStatus, ApiKeyUsage};
use crate::utils::pagination::Paginated;

/// Request to create a new API key
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Create a new API key")]
pub struct CreateApiKeyRequest {
    #[schema(example = "My API Key")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Name must be between 1 and 100 characters"
    ))]
    pub name: String,

    #[schema(example = "Key for frontend application")]
    #[validate(length(max = 500, message = "Description cannot exceed 500 characters"))]
    pub description: Option<String>,

    #[serde(default)]
    pub permission: ApiKeyPermission,

    /// Site scope (every API key must be scoped to a site)
    pub site_id: Uuid,

    /// Optional user assignment for IAM
    pub user_id: Option<Uuid>,

    /// Rate limits
    #[validate(range(
        min = 1,
        max = 1000,
        message = "Rate limit per second must be between 1 and 1000"
    ))]
    pub rate_limit_per_second: Option<i32>,

    #[validate(range(
        min = 1,
        max = 10000,
        message = "Rate limit per minute must be between 1 and 10000"
    ))]
    pub rate_limit_per_minute: Option<i32>,

    #[validate(range(
        min = 1,
        max = 100000,
        message = "Rate limit per hour must be between 1 and 100000"
    ))]
    pub rate_limit_per_hour: Option<i32>,

    #[validate(range(
        min = 1,
        max = 1000000,
        message = "Rate limit per day must be between 1 and 1000000"
    ))]
    pub rate_limit_per_day: Option<i32>,

    /// Optional expiration date
    pub expires_at: Option<DateTime<Utc>>,
}

/// Request to update an API key
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update an API key")]
pub struct UpdateApiKeyRequest {
    #[schema(example = "Updated API Key Name")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Name must be between 1 and 100 characters"
    ))]
    pub name: Option<String>,

    #[schema(example = "Updated description")]
    #[validate(length(max = 500, message = "Description cannot exceed 500 characters"))]
    pub description: Option<String>,

    pub permission: Option<ApiKeyPermission>,

    /// Site scope (every API key must be scoped to a site)
    pub site_id: Option<Uuid>,

    /// User assignment (use null to remove user)
    pub user_id: Option<Option<Uuid>>,

    #[validate(range(
        min = 1,
        max = 1000,
        message = "Rate limit per second must be between 1 and 1000"
    ))]
    pub rate_limit_per_second: Option<i32>,

    #[validate(range(
        min = 1,
        max = 10000,
        message = "Rate limit per minute must be between 1 and 10000"
    ))]
    pub rate_limit_per_minute: Option<i32>,

    #[validate(range(
        min = 1,
        max = 100000,
        message = "Rate limit per hour must be between 1 and 100000"
    ))]
    pub rate_limit_per_hour: Option<i32>,

    #[validate(range(
        min = 1,
        max = 1000000,
        message = "Rate limit per day must be between 1 and 1000000"
    ))]
    pub rate_limit_per_day: Option<i32>,

    /// Expiration date (use null to remove expiration)
    pub expires_at: Option<Option<DateTime<Utc>>>,
}

/// Request to block an API key
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Block an API key")]
pub struct BlockApiKeyRequest {
    #[schema(example = "Suspicious activity detected")]
    #[validate(length(
        min = 1,
        max = 500,
        message = "Reason must be between 1 and 500 characters"
    ))]
    pub reason: String,
}

/// Response for a newly created API key (includes plaintext key - shown only once!)
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
#[schema(description = "Newly created API key with plaintext key")]
pub struct CreateApiKeyResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "dk_live_a1b2c3d4e5f6g7h8i9j0")]
    pub key: String, // The actual API key - only shown at creation!
    #[schema(example = "dk_live_a1b2")]
    pub key_prefix: String,
    #[schema(example = "My API Key")]
    pub name: String,
    pub description: Option<String>,
    pub permission: ApiKeyPermission,
    pub site_id: Uuid,
    pub user_id: Option<Uuid>,
    pub status: ApiKeyStatus,
    pub rate_limit_per_second: Option<i32>,
    pub rate_limit_per_minute: Option<i32>,
    pub rate_limit_per_hour: Option<i32>,
    pub rate_limit_per_day: Option<i32>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Standard API key response (no plaintext key)
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "API key details")]
pub struct ApiKeyResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "dk_live_a1b2")]
    pub key_prefix: String,
    #[schema(example = "My API Key")]
    pub name: String,
    pub description: Option<String>,
    pub permission: ApiKeyPermission,
    pub site_id: Uuid,
    pub user_id: Option<Uuid>,
    pub status: ApiKeyStatus,
    pub rate_limit_per_second: Option<i32>,
    pub rate_limit_per_minute: Option<i32>,
    pub rate_limit_per_hour: Option<i32>,
    pub rate_limit_per_day: Option<i32>,
    pub total_requests: i64,
    pub last_used_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub blocked_at: Option<DateTime<Utc>>,
    pub blocked_reason: Option<String>,
}

impl From<ApiKey> for ApiKeyResponse {
    fn from(key: ApiKey) -> Self {
        Self {
            id: key.id,
            key_prefix: key.key_prefix,
            name: key.name,
            description: key.description,
            permission: key.permission,
            site_id: key.site_id,
            user_id: key.user_id,
            status: key.status,
            rate_limit_per_second: key.rate_limit_per_second,
            rate_limit_per_minute: key.rate_limit_per_minute,
            rate_limit_per_hour: key.rate_limit_per_hour,
            rate_limit_per_day: key.rate_limit_per_day,
            total_requests: key.total_requests,
            last_used_at: key.last_used_at,
            expires_at: key.expires_at,
            created_at: key.created_at,
            updated_at: key.updated_at,
            blocked_at: key.blocked_at,
            blocked_reason: key.blocked_reason,
        }
    }
}

/// API key list item (minimal info for lists)
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "API key summary for lists")]
pub struct ApiKeyListItem {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "dk_live_a1b2")]
    pub key_prefix: String,
    #[schema(example = "My API Key")]
    pub name: String,
    pub permission: ApiKeyPermission,
    pub site_id: Uuid,
    pub user_id: Option<Uuid>,
    pub status: ApiKeyStatus,
    pub total_requests: i64,
    pub last_used_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

impl From<ApiKey> for ApiKeyListItem {
    fn from(key: ApiKey) -> Self {
        Self {
            id: key.id,
            key_prefix: key.key_prefix,
            name: key.name,
            permission: key.permission,
            site_id: key.site_id,
            user_id: key.user_id,
            status: key.status,
            total_requests: key.total_requests,
            last_used_at: key.last_used_at,
            expires_at: key.expires_at,
            created_at: key.created_at,
        }
    }
}

/// API key usage record response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "API key usage record")]
pub struct ApiKeyUsageResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "/api/v1/blogs")]
    pub endpoint: String,
    #[schema(example = "GET")]
    pub method: String,
    pub status_code: i16,
    pub response_time_ms: i32,
    pub ip_address: Option<String>,
    pub request_size: Option<i32>,
    pub response_size: Option<i32>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl From<ApiKeyUsage> for ApiKeyUsageResponse {
    fn from(usage: ApiKeyUsage) -> Self {
        Self {
            id: usage.id,
            endpoint: usage.endpoint,
            method: usage.method,
            status_code: usage.status_code,
            response_time_ms: usage.response_time_ms,
            ip_address: usage.ip_address,
            request_size: usage.request_size,
            response_size: usage.response_size,
            error_message: usage.error_message,
            created_at: usage.created_at,
        }
    }
}

/// API key statistics
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "API key usage statistics")]
pub struct ApiKeyStats {
    #[schema(example = 15420)]
    pub total_requests: i64,
    pub requests_today: i64,
    pub requests_this_week: i64,
    pub requests_this_month: i64,
    pub avg_response_time_ms: Option<f64>,
    pub error_rate: f64,
}

/// Paginated API key list response
pub type PaginatedApiKeys = Paginated<ApiKeyListItem>;

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    fn test_site_id() -> Uuid {
        Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap()
    }

    #[test]
    fn test_create_api_key_request_valid() {
        let request = CreateApiKeyRequest {
            name: "Test API Key".to_string(),
            description: Some("For testing".to_string()),
            permission: ApiKeyPermission::Read,
            site_id: test_site_id(),
            user_id: None,
            rate_limit_per_second: Some(10),
            rate_limit_per_minute: Some(100),
            rate_limit_per_hour: Some(1000),
            rate_limit_per_day: Some(10000),
            expires_at: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_api_key_request_empty_name() {
        let request = CreateApiKeyRequest {
            name: "".to_string(),
            description: None,
            permission: ApiKeyPermission::Read,
            site_id: test_site_id(),
            user_id: None,
            rate_limit_per_second: None,
            rate_limit_per_minute: None,
            rate_limit_per_hour: None,
            rate_limit_per_day: None,
            expires_at: None,
        };
        let result = request.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_create_api_key_request_invalid_rate_limit() {
        let request = CreateApiKeyRequest {
            name: "Test".to_string(),
            description: None,
            permission: ApiKeyPermission::Read,
            site_id: test_site_id(),
            user_id: None,
            rate_limit_per_second: Some(0), // Invalid
            rate_limit_per_minute: None,
            rate_limit_per_hour: None,
            rate_limit_per_day: None,
            expires_at: None,
        };
        let result = request.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_update_api_key_request_valid() {
        let request = UpdateApiKeyRequest {
            name: Some("Updated Name".to_string()),
            description: None,
            permission: Some(ApiKeyPermission::Write),
            site_id: None,
            user_id: None,
            rate_limit_per_second: None,
            rate_limit_per_minute: None,
            rate_limit_per_hour: None,
            rate_limit_per_day: None,
            expires_at: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_block_api_key_request_valid() {
        let request = BlockApiKeyRequest {
            reason: "Suspicious activity detected".to_string(),
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_block_api_key_request_empty_reason() {
        let request = BlockApiKeyRequest {
            reason: "".to_string(),
        };
        let result = request.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_create_api_key_request_name_too_long() {
        let request = CreateApiKeyRequest {
            name: "a".repeat(101),
            description: None,
            permission: ApiKeyPermission::Read,
            site_id: test_site_id(),
            user_id: None,
            rate_limit_per_second: None,
            rate_limit_per_minute: None,
            rate_limit_per_hour: None,
            rate_limit_per_day: None,
            expires_at: None,
        };
        let result = request.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().field_errors().contains_key("name"));
    }

    #[test]
    fn test_create_api_key_request_description_too_long() {
        let request = CreateApiKeyRequest {
            name: "Test".to_string(),
            description: Some("a".repeat(501)),
            permission: ApiKeyPermission::Read,
            site_id: test_site_id(),
            user_id: None,
            rate_limit_per_second: None,
            rate_limit_per_minute: None,
            rate_limit_per_hour: None,
            rate_limit_per_day: None,
            expires_at: None,
        };
        let result = request.validate();
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .field_errors()
            .contains_key("description"));
    }

    #[test]
    fn test_create_api_key_request_rate_limits_at_max() {
        let request = CreateApiKeyRequest {
            name: "Test".to_string(),
            description: None,
            permission: ApiKeyPermission::Read,
            site_id: test_site_id(),
            user_id: None,
            rate_limit_per_second: Some(1000),
            rate_limit_per_minute: Some(10000),
            rate_limit_per_hour: Some(100000),
            rate_limit_per_day: Some(1000000),
            expires_at: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_api_key_request_rate_limit_per_day_too_high() {
        let request = CreateApiKeyRequest {
            name: "Test".to_string(),
            description: None,
            permission: ApiKeyPermission::Read,
            site_id: test_site_id(),
            user_id: None,
            rate_limit_per_second: None,
            rate_limit_per_minute: None,
            rate_limit_per_hour: None,
            rate_limit_per_day: Some(1000001),
            expires_at: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_update_api_key_request_name_too_long() {
        let request = UpdateApiKeyRequest {
            name: Some("a".repeat(101)),
            description: None,
            permission: None,
            site_id: None,
            user_id: None,
            rate_limit_per_second: None,
            rate_limit_per_minute: None,
            rate_limit_per_hour: None,
            rate_limit_per_day: None,
            expires_at: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_update_api_key_request_empty_name() {
        let request = UpdateApiKeyRequest {
            name: Some("".to_string()),
            description: None,
            permission: None,
            site_id: None,
            user_id: None,
            rate_limit_per_second: None,
            rate_limit_per_minute: None,
            rate_limit_per_hour: None,
            rate_limit_per_day: None,
            expires_at: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_block_api_key_request_reason_too_long() {
        let request = BlockApiKeyRequest {
            reason: "a".repeat(501),
        };
        assert!(request.validate().is_err());
    }
}
