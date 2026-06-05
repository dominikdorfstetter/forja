//! Notification model
//!
//! In-app notifications for editorial workflow events.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::codes;
use crate::errors::ApiError;
use crate::utils::list_params::ListParams;

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

    /// Find notifications for a user in a site (filtered, paginated, sortable).
    /// No search support — notifications have no user-searchable text.
    pub async fn find_for_user_filtered(
        pool: &PgPool,
        clerk_id: &str,
        site_id: Uuid,
        params: &ListParams,
    ) -> Result<Vec<Notification>, ApiError> {
        let (limit, offset) = params.limit_offset();
        let order_col = "n.created_at";

        let sql = format!(
            "SELECT n.id, n.site_id, n.recipient_clerk_id, n.actor_clerk_id, \
                    n.notification_type, n.entity_type, n.entity_id, \
                    n.title, n.message, n.is_read, n.read_at, n.created_at \
             FROM notifications n \
             WHERE n.recipient_clerk_id = $1 AND n.site_id = $2 \
             ORDER BY {} \
             LIMIT $3 OFFSET $4",
            params.sort.order_clause(order_col)
        );

        let rows = sqlx::query_as::<_, Notification>(&sql)
            .bind(clerk_id)
            .bind(site_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?;
        Ok(rows)
    }

    /// Same as `find_for_user_filtered` but with an optional read-status
    /// narrow so the admin filter pills can ask the server for just the
    /// read bucket or just the unread bucket.
    pub async fn find_for_user_filtered_ext(
        pool: &PgPool,
        clerk_id: &str,
        site_id: Uuid,
        params: &ListParams,
        is_read: Option<bool>,
    ) -> Result<Vec<Notification>, ApiError> {
        let (limit, offset) = params.limit_offset();
        let order_col = "n.created_at";
        let read_clause = match is_read {
            Some(true) => " AND n.is_read = TRUE",
            Some(false) => " AND n.is_read = FALSE",
            None => "",
        };

        let sql = format!(
            "SELECT n.id, n.site_id, n.recipient_clerk_id, n.actor_clerk_id, \
                    n.notification_type, n.entity_type, n.entity_id, \
                    n.title, n.message, n.is_read, n.read_at, n.created_at \
             FROM notifications n \
             WHERE n.recipient_clerk_id = $1 AND n.site_id = $2{} \
             ORDER BY {} \
             LIMIT $3 OFFSET $4",
            read_clause,
            params.sort.order_clause(order_col)
        );

        let rows = sqlx::query_as::<_, Notification>(&sql)
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

    /// Count notifications for a user in a site, narrowed by read state.
    /// `None` = all. Drives the paginated total for the list endpoint
    /// when a filter pill is active.
    pub async fn count_for_user_filtered(
        pool: &PgPool,
        clerk_id: &str,
        site_id: Uuid,
        is_read: Option<bool>,
    ) -> Result<i64, ApiError> {
        let read_clause = match is_read {
            Some(true) => " AND is_read = TRUE",
            Some(false) => " AND is_read = FALSE",
            None => "",
        };
        let sql = format!(
            "SELECT COUNT(*) FROM notifications \
             WHERE recipient_clerk_id = $1 AND site_id = $2{}",
            read_clause
        );
        let row: (i64,) = sqlx::query_as(&sql)
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
        .ok_or_else(|| {
            ApiError::not_found("Notification not found")
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("notification")
        })
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

    /// Delete a single notification. Scoped by recipient so a user can
    /// only clear their own inbox — returns `false` when the row was
    /// owned by someone else or didn't exist (both 404 from the
    /// caller's perspective).
    pub async fn delete_for_user(
        pool: &PgPool,
        id: Uuid,
        clerk_id: &str,
    ) -> Result<bool, ApiError> {
        let result =
            sqlx::query("DELETE FROM notifications WHERE id = $1 AND recipient_clerk_id = $2")
                .bind(id)
                .bind(clerk_id)
                .execute(pool)
                .await?;
        Ok(result.rows_affected() > 0)
    }

    /// Bulk-delete notifications. Scoped by recipient so one user can't
    /// drop another's notifications even with valid IDs. Returns the
    /// number of rows actually deleted.
    pub async fn delete_many_for_user(
        pool: &PgPool,
        ids: &[Uuid],
        clerk_id: &str,
        site_id: Uuid,
    ) -> Result<i64, ApiError> {
        if ids.is_empty() {
            return Ok(0);
        }
        let result = sqlx::query(
            "DELETE FROM notifications \
             WHERE id = ANY($1) \
               AND recipient_clerk_id = $2 \
               AND site_id = $3",
        )
        .bind(ids)
        .bind(clerk_id)
        .bind(site_id)
        .execute(pool)
        .await?;
        Ok(result.rows_affected() as i64)
    }

    /// Delete every already-read notification in the user's inbox for
    /// this site — the "clear the pile" action exposed alongside
    /// "mark all read" on the notifications page.
    pub async fn delete_all_read_for_user(
        pool: &PgPool,
        clerk_id: &str,
        site_id: Uuid,
    ) -> Result<i64, ApiError> {
        let result = sqlx::query(
            "DELETE FROM notifications \
             WHERE recipient_clerk_id = $1 \
               AND site_id = $2 \
               AND is_read = TRUE",
        )
        .bind(clerk_id)
        .bind(site_id)
        .execute(pool)
        .await?;
        Ok(result.rows_affected() as i64)
    }

    /// Count notifications grouped by read status for a user in a
    /// site. Returns `(read, unread)` in one aggregate query so the
    /// admin filter pills can render both badges without a second
    /// request.
    pub async fn status_counts_for_user(
        pool: &PgPool,
        clerk_id: &str,
        site_id: Uuid,
    ) -> Result<(i64, i64), ApiError> {
        let row: (i64, i64) = sqlx::query_as(
            r#"
            SELECT
                COUNT(*) FILTER (WHERE is_read = TRUE),
                COUNT(*) FILTER (WHERE is_read = FALSE)
            FROM notifications
            WHERE recipient_clerk_id = $1 AND site_id = $2
            "#,
        )
        .bind(clerk_id)
        .bind(site_id)
        .fetch_one(pool)
        .await?;
        Ok(row)
    }

    /// Find a notification by ID.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Notification, ApiError> {
        sqlx::query_as::<_, Notification>("SELECT * FROM notifications WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| {
                ApiError::not_found("Notification not found")
                    .with_code(codes::ENTITY_NOT_FOUND)
                    .with_entity_type("notification")
            })
    }
}
