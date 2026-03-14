//! ApComment model — federated comments received via ActivityPub

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;

use super::types::ApCommentStatus;

/// A comment received from a remote ActivityPub actor.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ApComment {
    pub id: Uuid,
    pub site_id: Uuid,
    pub content_id: Uuid,
    pub author_actor_uri: String,
    pub author_name: Option<String>,
    pub author_avatar_url: Option<String>,
    pub activity_uri: String,
    pub in_reply_to_uri: Option<String>,
    pub body_html: String,
    pub status: ApCommentStatus,
    pub created_at: DateTime<Utc>,
    pub moderated_at: Option<DateTime<Utc>>,
    pub moderated_by: Option<Uuid>,
}

impl ApComment {
    /// Create a new federated comment.
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        pool: &PgPool,
        site_id: Uuid,
        content_id: Uuid,
        author_actor_uri: &str,
        author_name: Option<&str>,
        author_avatar_url: Option<&str>,
        activity_uri: &str,
        in_reply_to_uri: Option<&str>,
        body_html: &str,
    ) -> Result<Self, ApiError> {
        let comment = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO ap_comments (
                site_id, content_id, author_actor_uri, author_name,
                author_avatar_url, activity_uri, in_reply_to_uri, body_html
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
        )
        .bind(site_id)
        .bind(content_id)
        .bind(author_actor_uri)
        .bind(author_name)
        .bind(author_avatar_url)
        .bind(activity_uri)
        .bind(in_reply_to_uri)
        .bind(body_html)
        .fetch_one(pool)
        .await?;

        Ok(comment)
    }

    /// Find comments for a site, filtered by status, with pagination.
    pub async fn find_by_site(
        pool: &PgPool,
        site_id: Uuid,
        status: Option<ApCommentStatus>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Self>, ApiError> {
        if let Some(st) = status {
            let comments = sqlx::query_as::<_, Self>(
                r#"
                SELECT * FROM ap_comments
                WHERE site_id = $1 AND status = $4
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
                "#,
            )
            .bind(site_id)
            .bind(limit)
            .bind(offset)
            .bind(st)
            .fetch_all(pool)
            .await?;

            Ok(comments)
        } else {
            let comments = sqlx::query_as::<_, Self>(
                r#"
                SELECT * FROM ap_comments
                WHERE site_id = $1
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
                "#,
            )
            .bind(site_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?;

            Ok(comments)
        }
    }

    /// Find all comments for a specific content item (blog post).
    pub async fn find_by_content(pool: &PgPool, content_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let comments = sqlx::query_as::<_, Self>(
            r#"
            SELECT * FROM ap_comments
            WHERE content_id = $1
            ORDER BY created_at ASC
            "#,
        )
        .bind(content_id)
        .fetch_all(pool)
        .await?;

        Ok(comments)
    }

    /// Update the moderation status of a comment.
    pub async fn update_status(
        pool: &PgPool,
        id: Uuid,
        status: ApCommentStatus,
        moderated_by: Option<Uuid>,
    ) -> Result<(), ApiError> {
        sqlx::query(
            r#"
            UPDATE ap_comments
            SET status = $2, moderated_at = NOW(), moderated_by = $3
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(status)
        .bind(moderated_by)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Find a comment by its activity URI (for Update/Delete handling).
    pub async fn find_by_activity_uri(
        pool: &PgPool,
        activity_uri: &str,
    ) -> Result<Option<Self>, ApiError> {
        let comment =
            sqlx::query_as::<_, Self>("SELECT * FROM ap_comments WHERE activity_uri = $1")
                .bind(activity_uri)
                .fetch_optional(pool)
                .await?;

        Ok(comment)
    }

    /// Count pending comments for a site (for dashboard stats).
    pub async fn pending_count(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM ap_comments WHERE site_id = $1 AND status = 'pending'",
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;

        Ok(row.0)
    }
}
