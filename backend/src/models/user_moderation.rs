//! User moderation model
//!
//! Tracks suspension and ban status per Clerk user. Keyed by clerk_user_id
//! since Forja delegates user identity to Clerk.

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;

/// User moderation status
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "user_moderation_status", rename_all = "lowercase")]
pub enum UserModerationStatus {
    Active,
    Suspended,
    Banned,
}

/// User moderation record
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserModeration {
    pub id: Uuid,
    pub clerk_user_id: String,
    pub status: UserModerationStatus,
    pub status_reason: Option<String>,
    pub status_changed_at: Option<DateTime<Utc>>,
    pub status_changed_by: Option<String>,
    pub suspension_expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl UserModeration {
    /// Get or create a moderation record for a user.
    ///
    /// Returns existing record or creates a new one with `active` status.
    pub async fn get_or_create(pool: &PgPool, clerk_user_id: &str) -> Result<Self, ApiError> {
        let existing =
            sqlx::query_as::<_, Self>("SELECT * FROM user_moderation WHERE clerk_user_id = $1")
                .bind(clerk_user_id)
                .fetch_optional(pool)
                .await?;

        if let Some(record) = existing {
            return Ok(record);
        }

        let record = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO user_moderation (clerk_user_id, status)
            VALUES ($1, 'active')
            ON CONFLICT (clerk_user_id) DO UPDATE SET updated_at = NOW()
            RETURNING *
            "#,
        )
        .bind(clerk_user_id)
        .fetch_one(pool)
        .await?;

        Ok(record)
    }

    /// Suspend a user for a specified duration.
    pub async fn suspend(
        pool: &PgPool,
        clerk_user_id: &str,
        reason: &str,
        duration_hours: i64,
        changed_by: &str,
    ) -> Result<Self, ApiError> {
        let expires_at = Utc::now() + Duration::hours(duration_hours);

        // Ensure record exists
        Self::get_or_create(pool, clerk_user_id).await?;

        let record = sqlx::query_as::<_, Self>(
            r#"
            UPDATE user_moderation
            SET status = 'suspended',
                status_reason = $2,
                status_changed_at = NOW(),
                status_changed_by = $3,
                suspension_expires_at = $4,
                updated_at = NOW()
            WHERE clerk_user_id = $1
            RETURNING *
            "#,
        )
        .bind(clerk_user_id)
        .bind(reason)
        .bind(changed_by)
        .bind(expires_at)
        .fetch_one(pool)
        .await?;

        Ok(record)
    }

    /// Permanently ban a user.
    pub async fn ban(
        pool: &PgPool,
        clerk_user_id: &str,
        reason: &str,
        changed_by: &str,
    ) -> Result<Self, ApiError> {
        Self::get_or_create(pool, clerk_user_id).await?;

        let record = sqlx::query_as::<_, Self>(
            r#"
            UPDATE user_moderation
            SET status = 'banned',
                status_reason = $2,
                status_changed_at = NOW(),
                status_changed_by = $3,
                suspension_expires_at = NULL,
                updated_at = NOW()
            WHERE clerk_user_id = $1
            RETURNING *
            "#,
        )
        .bind(clerk_user_id)
        .bind(reason)
        .bind(changed_by)
        .fetch_one(pool)
        .await?;

        Ok(record)
    }

    /// Restore a user to active status (unsuspend or unban).
    pub async fn unsuspend(
        pool: &PgPool,
        clerk_user_id: &str,
        changed_by: &str,
    ) -> Result<Self, ApiError> {
        let record = sqlx::query_as::<_, Self>(
            r#"
            UPDATE user_moderation
            SET status = 'active',
                status_reason = NULL,
                status_changed_at = NOW(),
                status_changed_by = $2,
                suspension_expires_at = NULL,
                updated_at = NOW()
            WHERE clerk_user_id = $1
            RETURNING *
            "#,
        )
        .bind(clerk_user_id)
        .bind(changed_by)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("User moderation record not found"))?;

        Ok(record)
    }

    /// Find moderation records for multiple users at once.
    pub async fn find_by_user_ids(
        pool: &PgPool,
        clerk_user_ids: &[String],
    ) -> Result<Vec<Self>, ApiError> {
        if clerk_user_ids.is_empty() {
            return Ok(vec![]);
        }

        let records = sqlx::query_as::<_, Self>(
            "SELECT * FROM user_moderation WHERE clerk_user_id = ANY($1)",
        )
        .bind(clerk_user_ids)
        .fetch_all(pool)
        .await?;

        Ok(records)
    }

    /// Return the effective status label, accounting for expired suspensions.
    pub fn effective_status(&self) -> &str {
        match self.status {
            UserModerationStatus::Banned => "banned",
            UserModerationStatus::Suspended if self.is_suspended() => "suspended",
            _ => "active",
        }
    }

    /// Check if a user is currently suspended (not expired).
    pub fn is_suspended(&self) -> bool {
        self.status == UserModerationStatus::Suspended
            && self
                .suspension_expires_at
                .is_none_or(|exp| exp > Utc::now())
    }

    /// Check if a user is permanently banned.
    pub fn is_banned(&self) -> bool {
        self.status == UserModerationStatus::Banned
    }

    /// Check if a user is active (not suspended or banned).
    pub fn is_active(&self) -> bool {
        self.status == UserModerationStatus::Active
    }

    /// Find all suspended users whose suspension has expired.
    pub async fn find_expired_suspensions(pool: &PgPool) -> Result<Vec<Self>, ApiError> {
        let rows = sqlx::query_as::<_, Self>(
            r#"
            SELECT * FROM user_moderation
            WHERE status = 'suspended'
              AND suspension_expires_at IS NOT NULL
              AND suspension_expires_at <= NOW()
            "#,
        )
        .fetch_all(pool)
        .await?;

        Ok(rows)
    }

    /// Remove a user's moderation record entirely (banned-user purge).
    pub async fn delete_for_user(pool: &PgPool, clerk_user_id: &str) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM user_moderation WHERE clerk_user_id = $1")
            .bind(clerk_user_id)
            .execute(pool)
            .await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_record(
        status: UserModerationStatus,
        expires_at: Option<DateTime<Utc>>,
    ) -> UserModeration {
        UserModeration {
            id: Uuid::new_v4(),
            clerk_user_id: "user_test".to_string(),
            status,
            status_reason: None,
            status_changed_at: None,
            status_changed_by: None,
            suspension_expires_at: expires_at,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn test_active_user() {
        let user = make_record(UserModerationStatus::Active, None);
        assert!(user.is_active());
        assert!(!user.is_suspended());
        assert!(!user.is_banned());
    }

    #[test]
    fn test_suspended_user_not_expired() {
        let user = make_record(
            UserModerationStatus::Suspended,
            Some(Utc::now() + Duration::hours(24)),
        );
        assert!(!user.is_active());
        assert!(user.is_suspended());
        assert!(!user.is_banned());
    }

    #[test]
    fn test_suspended_user_expired() {
        let user = make_record(
            UserModerationStatus::Suspended,
            Some(Utc::now() - Duration::hours(1)),
        );
        // Expired suspension should NOT report as suspended
        assert!(!user.is_suspended());
    }

    #[test]
    fn test_suspended_no_expiry() {
        // Suspension with no expiry (indefinite)
        let user = make_record(UserModerationStatus::Suspended, None);
        assert!(user.is_suspended());
    }

    #[test]
    fn test_banned_user() {
        let user = make_record(UserModerationStatus::Banned, None);
        assert!(!user.is_active());
        assert!(!user.is_suspended());
        assert!(user.is_banned());
    }
}
