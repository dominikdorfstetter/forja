//! ApFeaturedPost model — pinned posts for the ActivityPub featured collection

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;

/// Maximum number of pinned posts per actor.
pub const MAX_FEATURED_POSTS: i64 = 3;

/// A pinned/featured post linked to an ActivityPub actor.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ApFeaturedPost {
    pub id: Uuid,
    pub actor_id: Uuid,
    pub content_id: Uuid,
    pub position: i32,
    pub created_at: DateTime<Utc>,
}

/// Extended row for listing featured posts with blog metadata.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ApFeaturedPostWithMeta {
    pub id: Uuid,
    pub actor_id: Uuid,
    pub content_id: Uuid,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub title: Option<String>,
    pub slug: Option<String>,
}

impl ApFeaturedPost {
    /// List featured posts for an actor, ordered by position.
    pub async fn list_by_actor(
        pool: &PgPool,
        actor_id: Uuid,
    ) -> Result<Vec<ApFeaturedPostWithMeta>, ApiError> {
        let rows = sqlx::query_as::<_, ApFeaturedPostWithMeta>(
            r#"
            SELECT
                fp.id,
                fp.actor_id,
                fp.content_id,
                fp.position,
                fp.created_at,
                cl.title,
                b.slug
            FROM ap_featured_posts fp
            LEFT JOIN contents c ON fp.content_id = c.id
            LEFT JOIN blogs b ON b.content_id = c.id
            LEFT JOIN content_localizations cl
                ON cl.content_id = c.id
                AND cl.is_primary = TRUE
            WHERE fp.actor_id = $1
            ORDER BY fp.position ASC
            "#,
        )
        .bind(actor_id)
        .fetch_all(pool)
        .await?;

        Ok(rows)
    }

    /// Add a post to the featured collection.
    pub async fn add(
        pool: &PgPool,
        actor_id: Uuid,
        content_id: Uuid,
        position: i32,
    ) -> Result<Self, ApiError> {
        let row = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO ap_featured_posts (actor_id, content_id, position)
            VALUES ($1, $2, $3)
            RETURNING *
            "#,
        )
        .bind(actor_id)
        .bind(content_id)
        .bind(position)
        .fetch_one(pool)
        .await?;

        Ok(row)
    }

    /// Remove a post from the featured collection.
    pub async fn remove(pool: &PgPool, actor_id: Uuid, content_id: Uuid) -> Result<bool, ApiError> {
        let result =
            sqlx::query("DELETE FROM ap_featured_posts WHERE actor_id = $1 AND content_id = $2")
                .bind(actor_id)
                .bind(content_id)
                .execute(pool)
                .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Count how many posts are pinned for an actor.
    pub async fn count_by_actor(pool: &PgPool, actor_id: Uuid) -> Result<i64, ApiError> {
        let row: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM ap_featured_posts WHERE actor_id = $1")
                .bind(actor_id)
                .fetch_one(pool)
                .await?;

        Ok(row.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_max_featured_posts() {
        assert_eq!(MAX_FEATURED_POSTS, 3);
    }

    #[test]
    fn test_featured_post_struct_fields() {
        let post = ApFeaturedPost {
            id: Uuid::new_v4(),
            actor_id: Uuid::new_v4(),
            content_id: Uuid::new_v4(),
            position: 0,
            created_at: Utc::now(),
        };

        assert_eq!(post.position, 0);
        assert!(post.created_at <= Utc::now());
    }

    #[test]
    fn test_featured_post_with_meta_serialization() {
        let post = ApFeaturedPostWithMeta {
            id: Uuid::new_v4(),
            actor_id: Uuid::new_v4(),
            content_id: Uuid::new_v4(),
            position: 1,
            created_at: Utc::now(),
            title: Some("Hello World".to_string()),
            slug: Some("hello-world".to_string()),
        };

        let json = serde_json::to_value(&post).unwrap();
        assert_eq!(json["title"], "Hello World");
        assert_eq!(json["slug"], "hello-world");
        assert_eq!(json["position"], 1);
    }
}
