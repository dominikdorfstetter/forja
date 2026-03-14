//! ApActivity model — inbound and outbound ActivityPub activities

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;

use super::types::{ApActivityDirection, ApActivityStatus};

/// A logged ActivityPub activity (inbound or outbound).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ApActivity {
    pub id: Uuid,
    pub site_id: Uuid,
    pub activity_type: String,
    pub activity_uri: String,
    pub actor_uri: String,
    pub object_uri: Option<String>,
    pub object_type: Option<String>,
    pub payload: serde_json::Value,
    pub direction: ApActivityDirection,
    pub status: ApActivityStatus,
    pub content_id: Option<Uuid>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Aggregate stats for a site's federation activity.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApActivityStats {
    pub outbound_count: i64,
    pub inbound_count: i64,
    pub failed_count: i64,
    pub pending_comments: i64,
}

impl ApActivity {
    /// Create a new activity record.
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        pool: &PgPool,
        site_id: Uuid,
        activity_type: &str,
        activity_uri: &str,
        actor_uri: &str,
        object_uri: Option<&str>,
        object_type: Option<&str>,
        payload: &serde_json::Value,
        direction: ApActivityDirection,
        status: ApActivityStatus,
        content_id: Option<Uuid>,
    ) -> Result<Self, ApiError> {
        let activity = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO ap_activities (
                site_id, activity_type, activity_uri, actor_uri,
                object_uri, object_type, payload, direction, status, content_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
            "#,
        )
        .bind(site_id)
        .bind(activity_type)
        .bind(activity_uri)
        .bind(actor_uri)
        .bind(object_uri)
        .bind(object_type)
        .bind(payload)
        .bind(direction)
        .bind(status)
        .bind(content_id)
        .fetch_one(pool)
        .await?;

        Ok(activity)
    }

    /// Find activities for a site, filtered by direction and status, with pagination.
    pub async fn find_by_site(
        pool: &PgPool,
        site_id: Uuid,
        direction: Option<ApActivityDirection>,
        status: Option<ApActivityStatus>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Self>, ApiError> {
        let mut where_clauses = vec!["site_id = $1".to_string()];
        let mut bind_idx = 4u32; // $1=site_id, $2=limit, $3=offset

        if direction.is_some() {
            where_clauses.push(format!("direction = ${bind_idx}"));
            bind_idx += 1;
        }
        if status.is_some() {
            where_clauses.push(format!("status = ${bind_idx}"));
            bind_idx += 1;
        }
        let _ = bind_idx;

        let sql = format!(
            r#"
            SELECT * FROM ap_activities
            WHERE {}
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
            where_clauses.join(" AND ")
        );

        let mut query = sqlx::query_as::<_, Self>(&sql)
            .bind(site_id)
            .bind(limit)
            .bind(offset);

        if let Some(dir) = direction {
            query = query.bind(dir);
        }
        if let Some(st) = status {
            query = query.bind(st);
        }

        let activities = query.fetch_all(pool).await?;
        Ok(activities)
    }

    /// Update the status (and optional error message) of an activity.
    pub async fn update_status(
        pool: &PgPool,
        id: Uuid,
        status: ApActivityStatus,
        error_message: Option<&str>,
    ) -> Result<(), ApiError> {
        sqlx::query(
            r#"
            UPDATE ap_activities
            SET status = $2, error_message = $3
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(status)
        .bind(error_message)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Get aggregate stats for a site's federation activity.
    pub async fn stats_for_site(pool: &PgPool, site_id: Uuid) -> Result<ApActivityStats, ApiError> {
        let row: (i64, i64, i64, i64) = sqlx::query_as(
            r#"
            SELECT
                COALESCE((SELECT COUNT(*) FROM ap_activities WHERE site_id = $1 AND direction = 'out'), 0),
                COALESCE((SELECT COUNT(*) FROM ap_activities WHERE site_id = $1 AND direction = 'in'), 0),
                COALESCE((SELECT COUNT(*) FROM ap_activities WHERE site_id = $1 AND status = 'failed'), 0),
                COALESCE((SELECT COUNT(*) FROM ap_comments WHERE site_id = $1 AND status = 'pending'), 0)
            "#,
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;

        Ok(ApActivityStats {
            outbound_count: row.0,
            inbound_count: row.1,
            failed_count: row.2,
            pending_comments: row.3,
        })
    }

    /// Find the outbound Create activity for a content item (blog post).
    pub async fn find_outbound_for_content(
        pool: &PgPool,
        content_id: Uuid,
    ) -> Result<Option<Self>, ApiError> {
        let activity = sqlx::query_as::<_, Self>(
            r#"
            SELECT * FROM ap_activities
            WHERE content_id = $1
              AND direction = 'out'
              AND activity_type = 'Create'
            ORDER BY created_at DESC
            LIMIT 1
            "#,
        )
        .bind(content_id)
        .fetch_optional(pool)
        .await?;

        Ok(activity)
    }
}
