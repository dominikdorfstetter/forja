//! API Key model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use std::fmt::Write;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::middleware::rate_limit::RateLimits;

/// API Key permission levels
#[derive(
    Debug, Clone, Copy, Serialize, Deserialize, sqlx::Type, PartialEq, Eq, utoipa::ToSchema,
)]
#[sqlx(type_name = "api_key_permission", rename_all = "lowercase")]
#[derive(Default)]
pub enum ApiKeyPermission {
    Master,
    Admin,
    Write,
    #[default]
    Read,
}

impl ApiKeyPermission {
    /// Check if this permission level can manage API keys
    pub fn can_manage_keys(&self) -> bool {
        matches!(self, ApiKeyPermission::Master)
    }

    /// Check if this permission can write content
    pub fn can_write(&self) -> bool {
        matches!(
            self,
            ApiKeyPermission::Master | ApiKeyPermission::Admin | ApiKeyPermission::Write
        )
    }

    /// Check if this permission can read content
    pub fn can_read(&self) -> bool {
        true // All permissions can read
    }

    /// Check if this permission has admin access
    pub fn is_admin(&self) -> bool {
        matches!(self, ApiKeyPermission::Master | ApiKeyPermission::Admin)
    }
}

/// API Key status
#[derive(
    Debug, Clone, Copy, Serialize, Deserialize, sqlx::Type, PartialEq, Eq, utoipa::ToSchema,
)]
#[sqlx(type_name = "api_key_status", rename_all = "lowercase")]
#[derive(Default)]
pub enum ApiKeyStatus {
    #[default]
    Active,
    Blocked,
    Expired,
    Revoked,
}

/// API Key entity
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ApiKey {
    pub id: Uuid,
    pub key_hash: String,
    pub key_prefix: String,
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
    pub last_used_ip: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub metadata: Option<serde_json::Value>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub blocked_at: Option<DateTime<Utc>>,
    pub blocked_reason: Option<String>,
}

/// Result of creating a new API key (includes plaintext key)
pub struct CreateApiKeyResult {
    pub api_key: ApiKey,
    pub plaintext_key: String,
}

/// API key validation result
#[derive(Debug, Clone)]
pub struct ApiKeyValidation {
    pub id: Uuid,
    pub permission: ApiKeyPermission,
    pub site_id: Uuid,
    pub is_valid: bool,
    pub reason: Option<String>,
    pub rate_limits: RateLimits,
}

impl ApiKey {
    /// Generate a new API key with prefix
    pub fn generate_key() -> (String, String, String) {
        let key_id = Uuid::new_v4().to_string().replace("-", "");
        let random_part = Uuid::new_v4().to_string().replace("-", "");
        let plaintext = format!("dk_{}_{}", &key_id[..8], random_part);
        let prefix = format!("dk_{}", &key_id[..8]);
        let hash = Self::hash_key(&plaintext);
        (plaintext, prefix, hash)
    }

    /// Hash an API key using SHA-256
    pub fn hash_key(key: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(key.as_bytes());
        // Convert digest to hex string manually
        let result = hasher.finalize();
        let bytes = result.as_slice();
        let mut hex = String::with_capacity(bytes.len() * 2);
        for byte in bytes {
            write!(hex, "{:02x}", byte).expect("Writing to a string never fails");
        }
        hex
    }

    /// Create a new API key
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        pool: &PgPool,
        name: &str,
        description: Option<&str>,
        permission: ApiKeyPermission,
        site_id: Uuid,
        user_id: Option<Uuid>,
        rate_limit_per_second: Option<i32>,
        rate_limit_per_minute: Option<i32>,
        rate_limit_per_hour: Option<i32>,
        rate_limit_per_day: Option<i32>,
        expires_at: Option<DateTime<Utc>>,
        created_by: Option<Uuid>,
    ) -> Result<CreateApiKeyResult, ApiError> {
        let (plaintext_key, prefix, hash) = Self::generate_key();

        let api_key = sqlx::query_as::<_, ApiKey>(
            r#"
            INSERT INTO api_keys (
                key_hash, key_prefix, name, description, permission, site_id, user_id,
                rate_limit_per_second, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
                expires_at, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id, key_hash, key_prefix, name, description, permission, site_id, user_id, status,
                      rate_limit_per_second, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
                      total_requests, last_used_at, last_used_ip::TEXT as last_used_ip, expires_at, metadata,
                      created_by, created_at, updated_at, blocked_at, blocked_reason
            "#,
        )
        .bind(&hash)
        .bind(&prefix)
        .bind(name)
        .bind(description)
        .bind(permission)
        .bind(site_id)
        .bind(user_id)
        .bind(rate_limit_per_second.unwrap_or(10))
        .bind(rate_limit_per_minute.unwrap_or(100))
        .bind(rate_limit_per_hour.unwrap_or(1000))
        .bind(rate_limit_per_day.unwrap_or(10000))
        .bind(expires_at)
        .bind(created_by)
        .fetch_one(pool)
        .await?;

        Ok(CreateApiKeyResult {
            api_key,
            plaintext_key,
        })
    }

    /// Find API key by hash
    pub async fn find_by_hash(pool: &PgPool, key_hash: &str) -> Result<Self, ApiError> {
        let key = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, key_hash, key_prefix, name, description, permission, site_id, user_id, status,
                   rate_limit_per_second, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
                   total_requests, last_used_at, last_used_ip::TEXT as last_used_ip, expires_at, metadata,
                   created_by, created_at, updated_at, blocked_at, blocked_reason
            FROM api_keys
            WHERE key_hash = $1
            "#,
        )
        .bind(key_hash)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::Unauthorized("Invalid API key".to_string()))?;

        Ok(key)
    }

    /// Find API key by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let key = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, key_hash, key_prefix, name, description, permission, site_id, user_id, status,
                   rate_limit_per_second, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
                   total_requests, last_used_at, last_used_ip::TEXT as last_used_ip, expires_at, metadata,
                   created_by, created_at, updated_at, blocked_at, blocked_reason
            FROM api_keys
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("API key with ID {} not found", id)))?;

        Ok(key)
    }

    /// List all API keys (with optional filters)
    pub async fn list(
        pool: &PgPool,
        status: Option<ApiKeyStatus>,
        permission: Option<ApiKeyPermission>,
        site_id: Option<Uuid>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Self>, ApiError> {
        let keys = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, key_hash, key_prefix, name, description, permission, site_id, user_id, status,
                   rate_limit_per_second, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
                   total_requests, last_used_at, last_used_ip::TEXT as last_used_ip, expires_at, metadata,
                   created_by, created_at, updated_at, blocked_at, blocked_reason
            FROM api_keys
            WHERE ($1::api_key_status IS NULL OR status = $1)
              AND ($2::api_key_permission IS NULL OR permission = $2)
              AND ($3::UUID IS NULL OR site_id = $3)
            ORDER BY created_at DESC
            LIMIT $4 OFFSET $5
            "#,
        )
        .bind(status)
        .bind(permission)
        .bind(site_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok(keys)
    }

    /// Count API keys
    pub async fn count(
        pool: &PgPool,
        status: Option<ApiKeyStatus>,
        permission: Option<ApiKeyPermission>,
        site_id: Option<Uuid>,
    ) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*)
            FROM api_keys
            WHERE ($1::api_key_status IS NULL OR status = $1)
              AND ($2::api_key_permission IS NULL OR permission = $2)
              AND ($3::UUID IS NULL OR site_id = $3)
            "#,
        )
        .bind(status)
        .bind(permission)
        .bind(site_id)
        .fetch_one(pool)
        .await?;

        Ok(row.0)
    }

    /// Validate an API key
    pub async fn validate(
        pool: &PgPool,
        plaintext_key: &str,
    ) -> Result<ApiKeyValidation, ApiError> {
        let hash = Self::hash_key(plaintext_key);

        let no_limits = RateLimits {
            per_second: None,
            per_minute: None,
            per_hour: None,
            per_day: None,
        };

        let key = match Self::find_by_hash(pool, &hash).await {
            Ok(k) => k,
            Err(_) => {
                return Ok(ApiKeyValidation {
                    id: Uuid::nil(),
                    permission: ApiKeyPermission::Read,
                    site_id: Uuid::nil(),
                    is_valid: false,
                    reason: Some("Invalid API key".to_string()),
                    rate_limits: no_limits,
                });
            }
        };

        let key_rate_limits = RateLimits {
            per_second: key.rate_limit_per_second,
            per_minute: key.rate_limit_per_minute,
            per_hour: key.rate_limit_per_hour,
            per_day: key.rate_limit_per_day,
        };

        // Check status
        if key.status != ApiKeyStatus::Active {
            return Ok(ApiKeyValidation {
                id: key.id,
                permission: key.permission,
                site_id: key.site_id,
                is_valid: false,
                reason: Some(format!("API key is {:?}", key.status)),
                rate_limits: key_rate_limits,
            });
        }

        // Check expiration
        if let Some(expires_at) = key.expires_at {
            if expires_at < Utc::now() {
                // Update status to expired
                let _ = sqlx::query("UPDATE api_keys SET status = 'expired' WHERE id = $1")
                    .bind(key.id)
                    .execute(pool)
                    .await;

                return Ok(ApiKeyValidation {
                    id: key.id,
                    permission: key.permission,
                    site_id: key.site_id,
                    is_valid: false,
                    reason: Some("API key has expired".to_string()),
                    rate_limits: key_rate_limits,
                });
            }
        }

        Ok(ApiKeyValidation {
            id: key.id,
            permission: key.permission,
            site_id: key.site_id,
            is_valid: true,
            reason: None,
            rate_limits: key_rate_limits,
        })
    }

    /// Update API key usage
    pub async fn record_usage(
        pool: &PgPool,
        id: Uuid,
        ip_address: Option<&str>,
    ) -> Result<(), ApiError> {
        sqlx::query(
            r#"
            UPDATE api_keys
            SET total_requests = total_requests + 1,
                last_used_at = NOW(),
                last_used_ip = $2::INET
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(ip_address)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Block an API key
    pub async fn block(pool: &PgPool, id: Uuid, reason: &str) -> Result<Self, ApiError> {
        let key = sqlx::query_as::<_, Self>(
            r#"
            UPDATE api_keys
            SET status = 'blocked',
                blocked_at = NOW(),
                blocked_reason = $2,
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, key_hash, key_prefix, name, description, permission, site_id, user_id, status,
                      rate_limit_per_second, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
                      total_requests, last_used_at, last_used_ip::TEXT as last_used_ip, expires_at, metadata,
                      created_by, created_at, updated_at, blocked_at, blocked_reason
            "#,
        )
        .bind(id)
        .bind(reason)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("API key with ID {} not found", id)))?;

        Ok(key)
    }

    /// Unblock an API key
    pub async fn unblock(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let key = sqlx::query_as::<_, Self>(
            r#"
            UPDATE api_keys
            SET status = 'active',
                blocked_at = NULL,
                blocked_reason = NULL,
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, key_hash, key_prefix, name, description, permission, site_id, user_id, status,
                      rate_limit_per_second, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
                      total_requests, last_used_at, last_used_ip::TEXT as last_used_ip, expires_at, metadata,
                      created_by, created_at, updated_at, blocked_at, blocked_reason
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("API key with ID {} not found", id)))?;

        Ok(key)
    }

    /// Revoke an API key (permanent)
    pub async fn revoke(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let key = sqlx::query_as::<_, Self>(
            r#"
            UPDATE api_keys
            SET status = 'revoked',
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, key_hash, key_prefix, name, description, permission, site_id, user_id, status,
                      rate_limit_per_second, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
                      total_requests, last_used_at, last_used_ip::TEXT as last_used_ip, expires_at, metadata,
                      created_by, created_at, updated_at, blocked_at, blocked_reason
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("API key with ID {} not found", id)))?;

        Ok(key)
    }

    /// Update API key settings
    #[allow(clippy::too_many_arguments)]
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        name: Option<&str>,
        description: Option<&str>,
        permission: Option<ApiKeyPermission>,
        site_id: Option<Uuid>,
        user_id: Option<Option<Uuid>>,
        rate_limit_per_second: Option<i32>,
        rate_limit_per_minute: Option<i32>,
        rate_limit_per_hour: Option<i32>,
        rate_limit_per_day: Option<i32>,
        expires_at: Option<Option<DateTime<Utc>>>,
    ) -> Result<Self, ApiError> {
        let key = sqlx::query_as::<_, Self>(
            r#"
            UPDATE api_keys
            SET name = COALESCE($2, name),
                description = COALESCE($3, description),
                permission = COALESCE($4, permission),
                site_id = COALESCE($5, site_id),
                user_id = CASE WHEN $6 THEN $7 ELSE user_id END,
                rate_limit_per_second = COALESCE($8, rate_limit_per_second),
                rate_limit_per_minute = COALESCE($9, rate_limit_per_minute),
                rate_limit_per_hour = COALESCE($10, rate_limit_per_hour),
                rate_limit_per_day = COALESCE($11, rate_limit_per_day),
                expires_at = CASE WHEN $12 THEN $13 ELSE expires_at END,
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, key_hash, key_prefix, name, description, permission, site_id, user_id, status,
                      rate_limit_per_second, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
                      total_requests, last_used_at, last_used_ip::TEXT as last_used_ip, expires_at, metadata,
                      created_by, created_at, updated_at, blocked_at, blocked_reason
            "#,
        )
        .bind(id)
        .bind(name)
        .bind(description)
        .bind(permission)
        .bind(site_id)
        .bind(user_id.is_some())
        .bind(user_id.flatten())
        .bind(rate_limit_per_second)
        .bind(rate_limit_per_minute)
        .bind(rate_limit_per_hour)
        .bind(rate_limit_per_day)
        .bind(expires_at.is_some())
        .bind(expires_at.flatten())
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("API key with ID {} not found", id)))?;

        Ok(key)
    }

    /// Delete an API key permanently
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM api_keys WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!(
                "API key with ID {} not found",
                id
            )));
        }

        Ok(())
    }
}

/// API key usage record
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ApiKeyUsage {
    pub id: Uuid,
    pub api_key_id: Uuid,
    pub endpoint: String,
    pub method: String,
    pub status_code: i16,
    pub response_time_ms: i32,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub request_size: Option<i32>,
    pub response_size: Option<i32>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl ApiKeyUsage {
    /// Record API usage
    #[allow(clippy::too_many_arguments)]
    pub async fn record(
        pool: &PgPool,
        api_key_id: Uuid,
        endpoint: &str,
        method: &str,
        status_code: i16,
        response_time_ms: i32,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
        request_size: Option<i32>,
        response_size: Option<i32>,
        error_message: Option<&str>,
    ) -> Result<(), ApiError> {
        sqlx::query(
            r#"
            INSERT INTO api_key_usage (
                api_key_id, endpoint, method, status_code, response_time_ms,
                ip_address, user_agent, request_size, response_size, error_message
            )
            VALUES ($1, $2, $3, $4, $5, $6::INET, $7, $8, $9, $10)
            "#,
        )
        .bind(api_key_id)
        .bind(endpoint)
        .bind(method)
        .bind(status_code)
        .bind(response_time_ms)
        .bind(ip_address)
        .bind(user_agent)
        .bind(request_size)
        .bind(response_size)
        .bind(error_message)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Get usage history for an API key
    pub async fn get_history(
        pool: &PgPool,
        api_key_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Self>, ApiError> {
        let records = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, api_key_id, endpoint, method, status_code, response_time_ms,
                   ip_address::TEXT as ip_address, user_agent, request_size, response_size,
                   error_message, created_at
            FROM api_key_usage
            WHERE api_key_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(api_key_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok(records)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_key() {
        let (plaintext, prefix, hash) = ApiKey::generate_key();
        assert!(plaintext.starts_with("dk_"));
        assert!(prefix.starts_with("dk_"));
        assert_eq!(hash.len(), 64); // SHA-256 hex
    }

    #[test]
    fn test_hash_key() {
        let key = "dk_test_abc123";
        let hash1 = ApiKey::hash_key(key);
        let hash2 = ApiKey::hash_key(key);
        assert_eq!(hash1, hash2);
        assert_eq!(hash1.len(), 64);
    }

    #[test]
    fn test_permission_can_manage_keys() {
        assert!(ApiKeyPermission::Master.can_manage_keys());
        assert!(!ApiKeyPermission::Admin.can_manage_keys());
        assert!(!ApiKeyPermission::Write.can_manage_keys());
        assert!(!ApiKeyPermission::Read.can_manage_keys());
    }

    #[test]
    fn test_permission_can_write() {
        assert!(ApiKeyPermission::Master.can_write());
        assert!(ApiKeyPermission::Admin.can_write());
        assert!(ApiKeyPermission::Write.can_write());
        assert!(!ApiKeyPermission::Read.can_write());
    }

    #[test]
    fn test_permission_serialization() {
        let perm = ApiKeyPermission::Admin;
        let json = serde_json::to_string(&perm).unwrap();
        assert!(json.contains("Admin") || json.contains("admin"));
    }

    #[test]
    fn test_status_serialization() {
        let status = ApiKeyStatus::Active;
        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("Active") || json.contains("active"));
    }
}
