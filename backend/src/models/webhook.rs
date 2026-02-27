//! Webhook model
//!
//! Represents webhook subscriptions and their delivery logs.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;

/// A webhook subscription for a site.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Webhook {
    pub id: Uuid,
    pub site_id: Uuid,
    pub url: String,
    pub secret: String,
    pub description: Option<String>,
    pub events: Vec<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A single webhook delivery attempt.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct WebhookDelivery {
    pub id: Uuid,
    pub webhook_id: Uuid,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub status_code: Option<i16>,
    pub response_body: Option<String>,
    pub error_message: Option<String>,
    pub attempt_number: i16,
    pub delivered_at: DateTime<Utc>,
}

impl Webhook {
    /// Find all webhooks for a site (paginated).
    pub async fn find_all_for_site(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Webhook>, ApiError> {
        let rows = sqlx::query_as::<_, Webhook>(
            "SELECT * FROM webhooks WHERE site_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
        )
        .bind(site_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    /// Count webhooks for a site.
    pub async fn count_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM webhooks WHERE site_id = $1")
            .bind(site_id)
            .fetch_one(pool)
            .await?;
        Ok(row.0)
    }

    /// Find active webhooks for a site.
    pub async fn find_active_for_site(
        pool: &PgPool,
        site_id: Uuid,
    ) -> Result<Vec<Webhook>, ApiError> {
        let rows = sqlx::query_as::<_, Webhook>(
            "SELECT * FROM webhooks WHERE site_id = $1 AND is_active = true",
        )
        .bind(site_id)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    /// Find a webhook by ID.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Webhook, ApiError> {
        sqlx::query_as::<_, Webhook>("SELECT * FROM webhooks WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .ok_or(ApiError::NotFound("Webhook not found".into()))
    }

    /// Create a new webhook.
    pub async fn create(
        pool: &PgPool,
        site_id: Uuid,
        url: &str,
        secret: &str,
        description: Option<&str>,
        events: &[String],
    ) -> Result<Webhook, ApiError> {
        let row = sqlx::query_as::<_, Webhook>(
            r#"INSERT INTO webhooks (site_id, url, secret, description, events)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING *"#,
        )
        .bind(site_id)
        .bind(url)
        .bind(secret)
        .bind(description)
        .bind(events)
        .fetch_one(pool)
        .await?;
        Ok(row)
    }

    /// Update a webhook.
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        url: Option<&str>,
        description: Option<&str>,
        events: Option<&[String]>,
        is_active: Option<bool>,
    ) -> Result<Webhook, ApiError> {
        let row = sqlx::query_as::<_, Webhook>(
            r#"UPDATE webhooks SET
                url = COALESCE($2, url),
                description = COALESCE($3, description),
                events = COALESCE($4, events),
                is_active = COALESCE($5, is_active),
                updated_at = NOW()
               WHERE id = $1
               RETURNING *"#,
        )
        .bind(id)
        .bind(url)
        .bind(description)
        .bind(events)
        .bind(is_active)
        .fetch_optional(pool)
        .await?
        .ok_or(ApiError::NotFound("Webhook not found".into()))?;
        Ok(row)
    }

    /// Delete a webhook.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM webhooks WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;
        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound("Webhook not found".into()));
        }
        Ok(())
    }
}

impl WebhookDelivery {
    /// Create a delivery log entry.
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        pool: &PgPool,
        webhook_id: Uuid,
        event_type: &str,
        payload: &serde_json::Value,
        status_code: Option<i16>,
        response_body: Option<&str>,
        error_message: Option<&str>,
        attempt_number: i16,
    ) -> Result<WebhookDelivery, ApiError> {
        let row = sqlx::query_as::<_, WebhookDelivery>(
            r#"INSERT INTO webhook_deliveries
               (webhook_id, event_type, payload, status_code, response_body, error_message, attempt_number)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING *"#,
        )
        .bind(webhook_id)
        .bind(event_type)
        .bind(payload)
        .bind(status_code)
        .bind(response_body)
        .bind(error_message)
        .bind(attempt_number)
        .fetch_one(pool)
        .await?;
        Ok(row)
    }

    /// Find deliveries for a webhook (paginated, newest first).
    pub async fn find_for_webhook(
        pool: &PgPool,
        webhook_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<WebhookDelivery>, ApiError> {
        let rows = sqlx::query_as::<_, WebhookDelivery>(
            "SELECT * FROM webhook_deliveries WHERE webhook_id = $1 ORDER BY delivered_at DESC LIMIT $2 OFFSET $3",
        )
        .bind(webhook_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    /// Count deliveries for a webhook.
    pub async fn count_for_webhook(pool: &PgPool, webhook_id: Uuid) -> Result<i64, ApiError> {
        let row: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM webhook_deliveries WHERE webhook_id = $1")
                .bind(webhook_id)
                .fetch_one(pool)
                .await?;
        Ok(row.0)
    }
}
