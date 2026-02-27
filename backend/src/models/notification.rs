//! Notification model
//!
//! In-app notifications for editorial workflow events.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;

/// A notification for a user.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Notification {
    pub id: Uuid,
    pub site_id: Uuid,
    pub recipient_clerk_id: String,
    pub actor_clerk_id: Option<String>,
    pub notification_type: String,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub title: String,
    pub message: Option<String>,
    pub is_read: bool,
    pub read_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

impl Notification {
    /// Create a new notification.
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        pool: &PgPool,
        site_id: Uuid,
        recipient_clerk_id: &str,
        actor_clerk_id: Option<&str>,
        notification_type: &str,
        entity_type: &str,
        entity_id: Uuid,
        title: &str,
        message: Option<&str>,
    ) -> Result<Notification, ApiError> {
        let row = sqlx::query_as::<_, Notification>(
            r#"INSERT INTO notifications (site_id, recipient_clerk_id, actor_clerk_id, notification_type, entity_type, entity_id, title, message)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               RETURNING *"#,
        )
        .bind(site_id)
        .bind(recipient_clerk_id)
        .bind(actor_clerk_id)
        .bind(notification_type)
        .bind(entity_type)
        .bind(entity_id)
        .bind(title)
        .bind(message)
        .fetch_one(pool)
        .await?;
        Ok(row)
    }

    /// Find notifications for a user in a site (paginated, newest first).
    pub async fn find_for_user(
        pool: &PgPool,
        clerk_id: &str,
        site_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Notification>, ApiError> {
        let rows = sqlx::query_as::<_, Notification>(
            r#"SELECT * FROM notifications
               WHERE recipient_clerk_id = $1 AND site_id = $2
               ORDER BY created_at DESC
               LIMIT $3 OFFSET $4"#,
        )
        .bind(clerk_id)
        .bind(site_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    /// Count total notifications for a user in a site.
    pub async fn count_for_user(
        pool: &PgPool,
        clerk_id: &str,
        site_id: Uuid,
    ) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM notifications WHERE recipient_clerk_id = $1 AND site_id = $2",
        )
        .bind(clerk_id)
        .bind(site_id)
        .fetch_one(pool)
        .await?;
        Ok(row.0)
    }

    /// Count unread notifications for a user in a site.
    pub async fn count_unread(
        pool: &PgPool,
        clerk_id: &str,
        site_id: Uuid,
    ) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM notifications WHERE recipient_clerk_id = $1 AND site_id = $2 AND is_read = FALSE",
        )
        .bind(clerk_id)
        .bind(site_id)
        .fetch_one(pool)
        .await?;
        Ok(row.0)
    }

    /// Mark a single notification as read.
    pub async fn mark_read(pool: &PgPool, id: Uuid) -> Result<Notification, ApiError> {
        sqlx::query_as::<_, Notification>(
            "UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = $1 RETURNING *",
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or(ApiError::NotFound("Notification not found".into()))
    }

    /// Mark all notifications as read for a user in a site. Returns count of updated rows.
    pub async fn mark_all_read(
        pool: &PgPool,
        clerk_id: &str,
        site_id: Uuid,
    ) -> Result<i64, ApiError> {
        let result = sqlx::query(
            "UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE recipient_clerk_id = $1 AND site_id = $2 AND is_read = FALSE",
        )
        .bind(clerk_id)
        .bind(site_id)
        .execute(pool)
        .await?;
        Ok(result.rows_affected() as i64)
    }

    /// Find a notification by ID.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Notification, ApiError> {
        sqlx::query_as::<_, Notification>("SELECT * FROM notifications WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .ok_or(ApiError::NotFound("Notification not found".into()))
    }
}
