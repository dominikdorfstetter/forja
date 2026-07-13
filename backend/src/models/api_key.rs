//! API Key model

use argon2::password_hash::{SaltString, rand_core::OsRng};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use std::fmt::Write;
use subtle::ConstantTimeEq;
use uuid::Uuid;

use chrono::NaiveDate;

use crate::errors::ApiError;
use crate::errors::codes;
use crate::middleware::rate_limit::QuotaLimits;
use crate::utils::list_params::order_clause;

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
    /// Per-key burst cap (requests/second). When set (>0) it overrides the
    /// global `RATE_LIMIT_BURST_PER_SECOND` for this key — raise it to cover an
    /// SSR page's worst-case fan-out within one second. `None`/0 ⇒ global default.
    pub rate_limit_per_second: Option<i32>,
    pub rate_limit_per_minute: Option<i32>,
    pub rate_limit_per_hour: Option<i32>,
    pub rate_limit_per_day: Option<i32>,
    pub quota_hourly: i32,
    pub quota_daily: i32,
    pub quota_monthly: i32,
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
    pub hash_version: i16,
}

/// Hash algorithm version constants.
const HASH_VERSION_SHA256: i16 = 1;
const HASH_VERSION_ARGON2: i16 = 2;

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
    pub quota_limits: QuotaLimits,
    /// Per-key burst cap (requests/second), sourced from the key's
    /// `rate_limit_per_second` column. `None` ⇒ use the global default.
    pub burst_limit: Option<i32>,
}

impl ApiKey {
    /// Generate a new API key with prefix.
    /// Returns (plaintext, prefix, argon2_hash, hash_version).
    pub fn generate_key() -> (String, String, String, i16) {
        let key_id = Uuid::new_v4().to_string().replace("-", "");
        let random_part = Uuid::new_v4().to_string().replace("-", "");
        let plaintext = format!("dk_{}_{}", &key_id[..8], random_part);
        let prefix = format!("dk_{}", &key_id[..8]);
        let hash = Self::hash_key(&plaintext);
        (plaintext, prefix, hash, HASH_VERSION_ARGON2)
    }

    /// Hash an API key using Argon2id (current algorithm).
    pub fn hash_key(key: &str) -> String {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        argon2
            .hash_password(key.as_bytes(), &salt)
            .expect("Argon2 hashing should not fail")
            .to_string()
    }

    /// Idempotently register the demo-mode guest key (read-only, demo site).
    /// No-op when a key with the same hash already exists.
    pub async fn upsert_demo_guest_key(
        pool: &PgPool,
        key_hash: &str,
        key_prefix: &str,
        site_id: Uuid,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO api_keys (key_hash, key_prefix, name, description, permission, site_id, status,
                rate_limit_per_second, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day, hash_version)
            VALUES ($1, $2, $3, $4, 'read', $5, 'active', 10, 100, 1000, 10000, $6)
            ON CONFLICT (key_hash) DO NOTHING"#,
        )
        .bind(key_hash)
        .bind(key_prefix)
        .bind("Demo Guest Key")
        .bind("Read-only guest access for demo site — auto-created by demo mode")
        .bind(site_id)
        .bind(HASH_VERSION_ARGON2)
        .execute(pool)
        .await
        .map(|_| ())
    }

    /// Hash an API key using SHA-256 (legacy, for backward-compatible verification only).
    fn hash_key_sha256(key: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(key.as_bytes());
        let result = hasher.finalize();
        let bytes = result.as_slice();
        let mut hex = String::with_capacity(bytes.len() * 2);
        for byte in bytes {
            write!(hex, "{:02x}", byte).expect("Writing to a string never fails");
        }
        hex
    }

    /// Verify a plaintext key against a stored hash, dispatching by hash version.
    fn verify_key(plaintext: &str, stored_hash: &str, hash_version: i16) -> bool {
        match hash_version {
            HASH_VERSION_ARGON2 => {
                let Ok(parsed) = PasswordHash::new(stored_hash) else {
                    return false;
                };
                Argon2::default()
                    .verify_password(plaintext.as_bytes(), &parsed)
                    .is_ok()
            }
            _ => {
                // Legacy SHA-256: constant-time comparison to prevent timing attacks
                let computed = Self::hash_key_sha256(plaintext);
                let computed_bytes = computed.as_bytes();
                let stored_bytes = stored_hash.as_bytes();
                computed_bytes.len() == stored_bytes.len()
                    && computed_bytes.ct_eq(stored_bytes).into()
            }
        }
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
        quota_hourly: Option<i32>,
        quota_daily: Option<i32>,
        quota_monthly: Option<i32>,
    ) -> Result<CreateApiKeyResult, ApiError> {
        let (plaintext_key, prefix, hash, hash_ver) = Self::generate_key();

        let api_key = sqlx::query_as::<_, ApiKey>(
            r#"
            INSERT INTO api_keys (
                key_hash, key_prefix, name, description, permission, site_id, user_id,
                rate_limit_per_second, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
                expires_at, created_by, hash_version,
                quota_hourly, quota_daily, quota_monthly
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING id, key_hash, key_prefix, name, description, permission, site_id, user_id, status,
                      rate_limit_per_second, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
                      quota_hourly, quota_daily, quota_monthly,
                      total_requests, last_used_at, last_used_ip::TEXT as last_used_ip, expires_at, metadata,
                      created_by, created_at, updated_at, blocked_at, blocked_reason, hash_version
            "#,
        )
        .bind(&hash)
        .bind(&prefix)
        .bind(name)
        .bind(description)
        .bind(permission)
        .bind(site_id)
        .bind(user_id)
        .bind(rate_limit_per_second.unwrap_or(100))
        .bind(rate_limit_per_minute.unwrap_or(1000))
        .bind(rate_limit_per_hour.unwrap_or(10000))
        .bind(rate_limit_per_day.unwrap_or(100000))
        .bind(expires_at)
        .bind(created_by)
        .bind(hash_ver)
        .bind(quota_hourly.unwrap_or(1000))
        .bind(quota_daily.unwrap_or(10000))
        .bind(quota_monthly.unwrap_or(100000))
        .fetch_one(pool)
        .await?;

        Ok(CreateApiKeyResult {
            api_key,
            plaintext_key,
        })
    }

    /// Find API key candidates by prefix (for Argon2 verification).
    async fn find_by_prefix(pool: &PgPool, prefix: &str) -> Result<Vec<Self>, ApiError> {
        let keys = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, key_hash, key_prefix, name, description, permission, site_id, user_id, status,
                   rate_limit_per_second, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
                   quota_hourly, quota_daily, quota_monthly,
                   total_requests, last_used_at, last_used_ip::TEXT as last_used_ip, expires_at, metadata,
                   created_by, created_at, updated_at, blocked_at, blocked_reason, hash_version
            FROM api_keys
            WHERE key_prefix = $1
            "#,
        )
        .bind(prefix)
        .fetch_all(pool)
        .await?;

        Ok(keys)
    }

    /// Transparently upgrade a legacy SHA-256 hash to Argon2.
    async fn upgrade_hash(pool: &PgPool, id: Uuid, plaintext: &str) {
        let new_hash = Self::hash_key(plaintext);
        let _ = sqlx::query(
            "UPDATE api_keys SET key_hash = $2, hash_version = $3, updated_at = NOW() WHERE id = $1",
        )
        .bind(id)
        .bind(&new_hash)
        .bind(HASH_VERSION_ARGON2)
        .execute(pool)
        .await;
    }

    /// Find API key by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let key = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, key_hash, key_prefix, name, description, permission, site_id, user_id, status,
                   rate_limit_per_second, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
                   quota_hourly, quota_daily, quota_monthly,
                   total_requests, last_used_at, last_used_ip::TEXT as last_used_ip, expires_at, metadata,
                   created_by, created_at, updated_at, blocked_at, blocked_reason, hash_version
            FROM api_keys
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found(format!("API key with ID {} not found", id)).with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("api_key"))?;

        Ok(key)
    }

    /// List all API keys (with optional filters, search, and sort)
    #[allow(clippy::too_many_arguments)]
    pub async fn list(
        pool: &PgPool,
        status: Option<ApiKeyStatus>,
        permission: Option<ApiKeyPermission>,
        site_id: Option<Uuid>,
        limit: i64,
        offset: i64,
        search: Option<&str>,
        sort_by: Option<&str>,
        sort_dir: Option<&str>,
    ) -> Result<Vec<Self>, ApiError> {
        let search_pattern = search.map(|s| format!("%{}%", s));
        let order_col = match sort_by {
            Some("name") => "ak.name",
            _ => "ak.created_at",
        };
        let query = format!(
            r#"
            SELECT ak.id, ak.key_hash, ak.key_prefix, ak.name, ak.description, ak.permission, ak.site_id, ak.user_id, ak.status,
                   ak.rate_limit_per_second, ak.rate_limit_per_minute, ak.rate_limit_per_hour, ak.rate_limit_per_day,
                   ak.quota_hourly, ak.quota_daily, ak.quota_monthly,
                   ak.total_requests, ak.last_used_at, ak.last_used_ip::TEXT as last_used_ip, ak.expires_at, ak.metadata,
                   ak.created_by, ak.created_at, ak.updated_at, ak.blocked_at, ak.blocked_reason, ak.hash_version
            FROM api_keys ak
            WHERE ($1::api_key_status IS NULL OR ak.status = $1)
              AND ($2::api_key_permission IS NULL OR ak.permission = $2)
              AND ($3::UUID IS NULL OR ak.site_id = $3)
              AND ($4::TEXT IS NULL OR ak.name ILIKE $4 OR ak.key_prefix ILIKE $4)
            ORDER BY {}
            LIMIT $5 OFFSET $6
            "#,
            order_clause(order_col, sort_dir)
        );
        let keys = sqlx::query_as::<_, Self>(sqlx::AssertSqlSafe(query))
            .bind(status)
            .bind(permission)
            .bind(site_id)
            .bind(&search_pattern)
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
        search: Option<&str>,
    ) -> Result<i64, ApiError> {
        let search_pattern = search.map(|s| format!("%{}%", s));
        let row: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*)
            FROM api_keys ak
            WHERE ($1::api_key_status IS NULL OR ak.status = $1)
              AND ($2::api_key_permission IS NULL OR ak.permission = $2)
              AND ($3::UUID IS NULL OR ak.site_id = $3)
              AND ($4::TEXT IS NULL OR ak.name ILIKE $4 OR ak.key_prefix ILIKE $4)
            "#,
        )
        .bind(status)
        .bind(permission)
        .bind(site_id)
        .bind(&search_pattern)
        .fetch_one(pool)
        .await?;

        Ok(row.0)
    }

    /// Extract the prefix from a plaintext key (e.g. "dk_abcd1234" from "dk_abcd1234_...").
    fn extract_prefix(plaintext_key: &str) -> Option<&str> {
        // Format: dk_{8-char-id}_{random} → prefix is dk_{8-char-id}
        let parts: Vec<&str> = plaintext_key.splitn(3, '_').collect();
        if parts.len() >= 2 {
            // prefix = "dk_" + parts[1] (the 8-char id)
            let prefix_end = 3 + parts[1].len(); // "dk_" = 3 chars
            if plaintext_key.len() >= prefix_end {
                return Some(&plaintext_key[..prefix_end]);
            }
        }
        None
    }

    /// Validate an API key
    pub async fn validate(
        pool: &PgPool,
        plaintext_key: &str,
    ) -> Result<ApiKeyValidation, ApiError> {
        let no_quotas = QuotaLimits {
            hourly: None,
            daily: None,
            monthly: None,
            created_at: Utc::now(),
        };

        let prefix = match Self::extract_prefix(plaintext_key) {
            Some(p) => p,
            None => {
                return Ok(ApiKeyValidation {
                    id: Uuid::nil(),
                    permission: ApiKeyPermission::Read,
                    site_id: Uuid::nil(),
                    is_valid: false,
                    reason: Some("Invalid API key format".to_string()),
                    quota_limits: no_quotas,
                    burst_limit: None,
                });
            }
        };

        let candidates = Self::find_by_prefix(pool, prefix).await?;
        let key = match candidates
            .into_iter()
            .find(|k| Self::verify_key(plaintext_key, &k.key_hash, k.hash_version))
        {
            Some(k) => k,
            None => {
                return Ok(ApiKeyValidation {
                    id: Uuid::nil(),
                    permission: ApiKeyPermission::Read,
                    site_id: Uuid::nil(),
                    is_valid: false,
                    reason: Some("Invalid API key".to_string()),
                    quota_limits: no_quotas,
                    burst_limit: None,
                });
            }
        };

        // Transparently upgrade legacy SHA-256 hashes to Argon2
        if key.hash_version == HASH_VERSION_SHA256 {
            Self::upgrade_hash(pool, key.id, plaintext_key).await;
        }

        let key_quotas = QuotaLimits {
            hourly: Some(key.quota_hourly),
            daily: Some(key.quota_daily),
            monthly: Some(key.quota_monthly),
            created_at: key.created_at,
        };

        // Check status
        if key.status != ApiKeyStatus::Active {
            return Ok(ApiKeyValidation {
                id: key.id,
                permission: key.permission,
                site_id: key.site_id,
                is_valid: false,
                reason: Some(format!("API key is {:?}", key.status)),
                quota_limits: key_quotas,
                burst_limit: key.rate_limit_per_second,
            });
        }

        // Check expiration
        if let Some(expires_at) = key.expires_at
            && expires_at < Utc::now()
        {
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
                quota_limits: key_quotas,
                burst_limit: key.rate_limit_per_second,
            });
        }

        Ok(ApiKeyValidation {
            id: key.id,
            permission: key.permission,
            site_id: key.site_id,
            is_valid: true,
            reason: None,
            quota_limits: key_quotas,
            burst_limit: key.rate_limit_per_second,
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
                      quota_hourly, quota_daily, quota_monthly,
                      total_requests, last_used_at, last_used_ip::TEXT as last_used_ip, expires_at, metadata,
                      created_by, created_at, updated_at, blocked_at, blocked_reason, hash_version
            "#,
        )
        .bind(id)
        .bind(reason)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found(format!("API key with ID {} not found", id)).with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("api_key"))?;

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
                      quota_hourly, quota_daily, quota_monthly,
                      total_requests, last_used_at, last_used_ip::TEXT as last_used_ip, expires_at, metadata,
                      created_by, created_at, updated_at, blocked_at, blocked_reason, hash_version
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found(format!("API key with ID {} not found", id)).with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("api_key"))?;

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
                      quota_hourly, quota_daily, quota_monthly,
                      total_requests, last_used_at, last_used_ip::TEXT as last_used_ip, expires_at, metadata,
                      created_by, created_at, updated_at, blocked_at, blocked_reason, hash_version
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found(format!("API key with ID {} not found", id)).with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("api_key"))?;

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
        quota_hourly: Option<i32>,
        quota_daily: Option<i32>,
        quota_monthly: Option<i32>,
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
                quota_hourly = COALESCE($14, quota_hourly),
                quota_daily = COALESCE($15, quota_daily),
                quota_monthly = COALESCE($16, quota_monthly),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, key_hash, key_prefix, name, description, permission, site_id, user_id, status,
                      rate_limit_per_second, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
                      quota_hourly, quota_daily, quota_monthly,
                      total_requests, last_used_at, last_used_ip::TEXT as last_used_ip, expires_at, metadata,
                      created_by, created_at, updated_at, blocked_at, blocked_reason, hash_version
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
        .bind(quota_hourly)
        .bind(quota_daily)
        .bind(quota_monthly)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found(format!("API key with ID {} not found", id)).with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("api_key"))?;

        Ok(key)
    }

    /// Delete an API key permanently
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM api_keys WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(
                ApiError::not_found(format!("API key with ID {} not found", id))
                    .with_code(codes::ENTITY_NOT_FOUND)
                    .with_entity_type("api_key"),
            );
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

/// Daily aggregated usage record.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ApiKeyUsageDaily {
    pub id: Uuid,
    pub api_key_id: Uuid,
    pub date: NaiveDate,
    pub total_requests: i64,
    pub successful_requests: i64,
    pub failed_requests: i64,
    pub avg_response_time: Option<i32>,
    pub min_response_time: Option<i32>,
    pub max_response_time: Option<i32>,
    pub total_request_bytes: Option<i64>,
    pub total_response_bytes: Option<i64>,
    pub rate_limit_hits: Option<i32>,
    pub unique_ips: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl ApiKeyUsageDaily {
    /// Aggregate raw `api_key_usage` rows into `api_key_usage_daily`.
    ///
    /// Uses INSERT … ON CONFLICT to upsert. Returns the number of
    /// daily rows created or updated.
    pub async fn aggregate(pool: &PgPool) -> Result<u64, sqlx::Error> {
        let result = sqlx::query(
            r#"
            INSERT INTO api_key_usage_daily (
                api_key_id, date,
                total_requests, successful_requests, failed_requests,
                avg_response_time, min_response_time, max_response_time,
                total_request_bytes, total_response_bytes,
                unique_ips
            )
            SELECT
                u.api_key_id,
                u.created_at::date AS date,
                COUNT(*)                                         AS total_requests,
                COUNT(*) FILTER (WHERE u.status_code < 400)      AS successful_requests,
                COUNT(*) FILTER (WHERE u.status_code >= 400)     AS failed_requests,
                AVG(u.response_time_ms)::INTEGER                 AS avg_response_time,
                MIN(u.response_time_ms)                          AS min_response_time,
                MAX(u.response_time_ms)                          AS max_response_time,
                COALESCE(SUM(u.request_size), 0)                 AS total_request_bytes,
                COALESCE(SUM(u.response_size), 0)                AS total_response_bytes,
                COUNT(DISTINCT u.ip_address)::INTEGER            AS unique_ips
            FROM api_key_usage u
            GROUP BY u.api_key_id, u.created_at::date
            ON CONFLICT (api_key_id, date) DO UPDATE SET
                total_requests    = EXCLUDED.total_requests,
                successful_requests = EXCLUDED.successful_requests,
                failed_requests   = EXCLUDED.failed_requests,
                avg_response_time = EXCLUDED.avg_response_time,
                min_response_time = EXCLUDED.min_response_time,
                max_response_time = EXCLUDED.max_response_time,
                total_request_bytes  = EXCLUDED.total_request_bytes,
                total_response_bytes = EXCLUDED.total_response_bytes,
                unique_ips        = EXCLUDED.unique_ips
            "#,
        )
        .execute(pool)
        .await?;

        Ok(result.rows_affected())
    }

    /// Delete raw usage records older than `retention_days`.
    ///
    /// Only prunes rows whose date has been aggregated (i.e., a matching
    /// `api_key_usage_daily` row exists). Returns rows deleted.
    pub async fn prune_raw(pool: &PgPool, retention_days: i64) -> Result<u64, sqlx::Error> {
        let result = sqlx::query(
            r#"
            DELETE FROM api_key_usage
            WHERE created_at < NOW() - make_interval(days => $1::INTEGER)
              AND EXISTS (
                  SELECT 1
                  FROM api_key_usage_daily d
                  WHERE d.api_key_id = api_key_usage.api_key_id
                    AND d.date = api_key_usage.created_at::date
              )
            "#,
        )
        .bind(retention_days)
        .execute(pool)
        .await?;

        Ok(result.rows_affected())
    }

    /// Get daily usage history for an API key, ordered by date descending.
    pub async fn get_history(
        pool: &PgPool,
        api_key_id: Uuid,
        days: i64,
    ) -> Result<Vec<Self>, ApiError> {
        let records = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, api_key_id, date,
                   total_requests, successful_requests, failed_requests,
                   avg_response_time, min_response_time, max_response_time,
                   total_request_bytes, total_response_bytes,
                   rate_limit_hits, unique_ips,
                   created_at, updated_at
            FROM api_key_usage_daily
            WHERE api_key_id = $1
              AND date >= (CURRENT_DATE - make_interval(days => $2::INTEGER))
            ORDER BY date DESC
            "#,
        )
        .bind(api_key_id)
        .bind(days)
        .fetch_all(pool)
        .await?;

        Ok(records)
    }

    /// Get the 7-day average daily request count for a key, counting only
    /// days with actual usage. Days at zero (key blocked or idle) would drag
    /// the baseline down, making anomaly thresholds ever more sensitive after
    /// a block — a death spiral where every unblock re-blocks sooner.
    /// Returns `None` if no active day exists in the window (new key).
    pub async fn avg_daily_requests(
        pool: &PgPool,
        api_key_id: Uuid,
    ) -> Result<Option<f64>, sqlx::Error> {
        let row: (Option<f64>,) = sqlx::query_as(
            r#"
            SELECT (AVG(total_requests) FILTER (WHERE total_requests > 0))::FLOAT8
            FROM api_key_usage_daily
            WHERE api_key_id = $1
              AND date >= CURRENT_DATE - INTERVAL '7 days'
              AND date < CURRENT_DATE
            "#,
        )
        .bind(api_key_id)
        .fetch_one(pool)
        .await?;

        Ok(row.0)
    }

    /// Get the 7-day average error rate for a key.
    /// Returns `None` if no history or zero requests.
    pub async fn avg_daily_error_rate(
        pool: &PgPool,
        api_key_id: Uuid,
    ) -> Result<Option<f64>, sqlx::Error> {
        let row: (Option<f64>,) = sqlx::query_as(
            r#"
            SELECT
                CASE WHEN SUM(total_requests) > 0
                     THEN SUM(failed_requests)::FLOAT8 / SUM(total_requests)::FLOAT8
                     ELSE NULL
                END
            FROM api_key_usage_daily
            WHERE api_key_id = $1
              AND date >= CURRENT_DATE - INTERVAL '7 days'
              AND date < CURRENT_DATE
            "#,
        )
        .bind(api_key_id)
        .fetch_one(pool)
        .await?;

        Ok(row.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_key() {
        let (plaintext, prefix, hash, hash_ver) = ApiKey::generate_key();
        assert!(plaintext.starts_with("dk_"));
        assert!(prefix.starts_with("dk_"));
        assert!(hash.starts_with("$argon2")); // Argon2 PHC format
        assert_eq!(hash_ver, HASH_VERSION_ARGON2);
    }

    #[test]
    fn test_hash_key_argon2() {
        let key = "dk_test_abc123";
        let hash1 = ApiKey::hash_key(key);
        let hash2 = ApiKey::hash_key(key);
        // Argon2 hashes include random salt, so different each time
        assert_ne!(hash1, hash2);
        assert!(hash1.starts_with("$argon2"));
    }

    #[test]
    fn test_verify_key_argon2() {
        let key = "dk_test_abc123";
        let hash = ApiKey::hash_key(key);
        assert!(ApiKey::verify_key(key, &hash, HASH_VERSION_ARGON2));
        assert!(!ApiKey::verify_key("wrong_key", &hash, HASH_VERSION_ARGON2));
    }

    #[test]
    fn test_verify_key_sha256_backward_compat() {
        let key = "dk_test_abc123";
        let hash = ApiKey::hash_key_sha256(key);
        assert!(ApiKey::verify_key(key, &hash, HASH_VERSION_SHA256));
        assert!(!ApiKey::verify_key("wrong_key", &hash, HASH_VERSION_SHA256));
    }

    #[test]
    fn test_extract_prefix() {
        assert_eq!(
            ApiKey::extract_prefix("dk_abcd1234_randomsuffix"),
            Some("dk_abcd1234")
        );
        assert_eq!(ApiKey::extract_prefix("dk_ab"), Some("dk_ab"));
        assert_eq!(ApiKey::extract_prefix("invalid"), None);
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
