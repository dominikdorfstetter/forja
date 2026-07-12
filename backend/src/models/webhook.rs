//! Webhook model
//!
//! Represents webhook subscriptions and their delivery logs.

use base64::Engine as _;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::errors::codes;
use crate::utils::list_params::ListParams;

/// A webhook subscription for a site.
///
/// The `secret` field stores the HMAC signing key. When `secret_nonce` is
/// `None`, the secret is plaintext (legacy webhooks created before encryption
/// was added). When `secret_nonce` is `Some`, the secret is AES-256-GCM
/// ciphertext and must be decrypted with `decrypt_secret()`. The per-row nonce
/// ensures identical plaintext secrets produce different ciphertexts.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Webhook {
    pub id: Uuid,
    pub site_id: Uuid,
    pub url: String,
    pub secret: String,
    pub secret_nonce: Option<Vec<u8>>,
    pub description: Option<String>,
    pub events: Vec<String>,
    pub is_active: bool,
    pub debounce_seconds: i32,
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

    /// Find all webhooks for a site with optional search and sort.
    pub async fn find_all_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        params: &ListParams,
    ) -> Result<Vec<Webhook>, ApiError> {
        let (limit, offset) = params.limit_offset();

        let mut where_clauses = vec!["w.site_id = $1".to_string()];
        let mut bind_idx = 4u32; // $1=site_id, $2=limit, $3=offset

        if params.search_ref().is_some() {
            where_clauses.push(format!(
                "(w.url ILIKE '%' || ${bind_idx} || '%' OR w.description ILIKE '%' || ${bind_idx} || '%')"
            ));
            bind_idx += 1;
        }
        let _ = bind_idx;

        let order_col = match params.sort.field_or("created_at") {
            "url" => "w.url",
            "created_at" => "w.created_at",
            _ => "w.created_at",
        };

        let sql = format!(
            "SELECT w.* FROM webhooks w WHERE {} ORDER BY {} LIMIT $2 OFFSET $3",
            where_clauses.join(" AND "),
            params.sort.order_clause(order_col),
        );

        let mut query = sqlx::query_as::<_, Webhook>(sqlx::AssertSqlSafe(sql))
            .bind(site_id)
            .bind(limit)
            .bind(offset);

        if let Some(s) = params.search_ref() {
            query = query.bind(s);
        }

        let rows = query.fetch_all(pool).await?;
        Ok(rows)
    }

    /// Count webhooks for a site with optional search filter.
    pub async fn count_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        search: Option<&str>,
    ) -> Result<i64, ApiError> {
        let mut where_clauses = vec!["w.site_id = $1".to_string()];
        let mut bind_idx = 2u32;

        if search.is_some() {
            where_clauses.push(format!(
                "(w.url ILIKE '%' || ${bind_idx} || '%' OR w.description ILIKE '%' || ${bind_idx} || '%')"
            ));
            bind_idx += 1;
        }
        let _ = bind_idx;

        let sql = format!(
            "SELECT COUNT(*) FROM webhooks w WHERE {}",
            where_clauses.join(" AND "),
        );

        let mut query = sqlx::query_as::<_, (i64,)>(sqlx::AssertSqlSafe(sql)).bind(site_id);

        if let Some(s) = search {
            query = query.bind(s);
        }

        let row = query.fetch_one(pool).await?;
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
            .ok_or_else(|| {
                ApiError::not_found("Webhook not found")
                    .with_code(codes::ENTITY_NOT_FOUND)
                    .with_entity_type("webhook")
            })
    }

    /// Create a new webhook.
    ///
    /// When `encryption_key` is `Some`, the secret is encrypted with AES-256-GCM
    /// before storage. When `None`, the secret is stored in plaintext (development
    /// fallback — never happens in production because the key is required).
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        pool: &PgPool,
        site_id: Uuid,
        url: &str,
        secret: &str,
        description: Option<&str>,
        events: &[String],
        debounce_seconds: i32,
        encryption_key: Option<&[u8; 32]>,
    ) -> Result<Webhook, ApiError> {
        let (stored_secret, stored_nonce) = if let Some(key) = encryption_key {
            let (ciphertext, nonce) = crate::services::encryption::encrypt(secret, key)?;
            // Store ciphertext + nonce as hex for readability in DB dumps.
            let hex_ct =
                base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &ciphertext);
            (hex_ct, Some(nonce))
        } else {
            (secret.to_string(), None)
        };

        let row = sqlx::query_as::<_, Webhook>(
            r#"INSERT INTO webhooks (site_id, url, secret, secret_nonce, description, events, debounce_seconds)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING *"#,
        )
        .bind(site_id)
        .bind(url)
        .bind(&stored_secret)
        .bind(&stored_nonce)
        .bind(description)
        .bind(events)
        .bind(debounce_seconds)
        .fetch_one(pool)
        .await?;
        Ok(row)
    }

    /// Decrypt the webhook secret for HMAC signing.
    ///
    /// When `secret_nonce` is `None` (legacy plaintext storage), returns the
    /// secret as-is. When `secret_nonce` is `Some`, decrypts with the provided
    /// AES-256-GCM key. Returns `Err` only on decryption failure (wrong key,
    /// corrupted data) — never panics.
    pub fn decrypt_secret(&self, key: &[u8; 32]) -> Result<String, ApiError> {
        let nonce = match &self.secret_nonce {
            Some(n) => n,
            None => return Ok(self.secret.clone()), // legacy plaintext
        };
        let ciphertext = base64::engine::general_purpose::STANDARD
            .decode(self.secret.as_bytes())
            .map_err(|e| ApiError::internal(format!("Webhook secret corrupted: {e}")))?;
        crate::services::encryption::decrypt(&ciphertext, nonce, key)
    }

    /// Update a webhook.
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        url: Option<&str>,
        description: Option<&str>,
        events: Option<&[String]>,
        is_active: Option<bool>,
        debounce_seconds: Option<i32>,
    ) -> Result<Webhook, ApiError> {
        let row = sqlx::query_as::<_, Webhook>(
            r#"UPDATE webhooks SET
                url = COALESCE($2, url),
                description = COALESCE($3, description),
                events = COALESCE($4, events),
                is_active = COALESCE($5, is_active),
                debounce_seconds = COALESCE($6, debounce_seconds),
                updated_at = NOW()
               WHERE id = $1
               RETURNING *"#,
        )
        .bind(id)
        .bind(url)
        .bind(description)
        .bind(events)
        .bind(is_active)
        .bind(debounce_seconds)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found("Webhook not found")
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("webhook")
        })?;
        Ok(row)
    }

    /// Delete a webhook.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM webhooks WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;
        if result.rows_affected() == 0 {
            return Err(ApiError::not_found("Webhook not found")
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("webhook"));
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

    /// Find deliveries for a webhook with sort support (paginated).
    pub async fn find_for_webhook_filtered(
        pool: &PgPool,
        webhook_id: Uuid,
        params: &ListParams,
    ) -> Result<Vec<WebhookDelivery>, ApiError> {
        let (limit, offset) = params.limit_offset();

        let order_col = match params.sort.field_or("created_at") {
            "created_at" => "d.delivered_at",
            _ => "d.delivered_at",
        };

        let sql = format!(
            "SELECT d.* FROM webhook_deliveries d WHERE d.webhook_id = $1 ORDER BY {} LIMIT $2 OFFSET $3",
            params.sort.order_clause(order_col),
        );

        let rows = sqlx::query_as::<_, WebhookDelivery>(sqlx::AssertSqlSafe(sql))
            .bind(webhook_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?;
        Ok(rows)
    }

    /// Count deliveries for a webhook (filtered variant for consistency).
    pub async fn count_for_webhook_filtered(
        pool: &PgPool,
        webhook_id: Uuid,
    ) -> Result<i64, ApiError> {
        Self::count_for_webhook(pool, webhook_id).await
    }

    /// Aggregate delivery stats for a webhook within a time window (in hours).
    pub async fn stats(
        pool: &PgPool,
        webhook_id: Uuid,
        window_hours: i64,
    ) -> Result<(i64, i64, i64, Option<DateTime<Utc>>), ApiError> {
        let row: (i64, i64, i64, Option<DateTime<Utc>>) = sqlx::query_as(
            r#"SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status_code BETWEEN 200 AND 299) AS successful,
                COUNT(*) FILTER (WHERE status_code IS NULL OR status_code < 200 OR status_code >= 300) AS failed,
                MAX(delivered_at) AS last_delivery_at
               FROM webhook_deliveries
               WHERE webhook_id = $1 AND delivered_at >= NOW() - ($2 || ' hours')::interval"#,
        )
        .bind(webhook_id)
        .bind(window_hours.to_string())
        .fetch_one(pool)
        .await?;
        Ok(row)
    }

    /// Per-event breakdown of delivery stats.
    pub async fn stats_by_event(
        pool: &PgPool,
        webhook_id: Uuid,
        window_hours: i64,
    ) -> Result<Vec<(String, i64, i64, i64)>, ApiError> {
        let rows: Vec<(String, i64, i64, i64)> = sqlx::query_as(
            r#"SELECT
                event_type,
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status_code BETWEEN 200 AND 299) AS successful,
                COUNT(*) FILTER (WHERE status_code IS NULL OR status_code < 200 OR status_code >= 300) AS failed
               FROM webhook_deliveries
               WHERE webhook_id = $1 AND delivered_at >= NOW() - ($2 || ' hours')::interval
               GROUP BY event_type
               ORDER BY total DESC"#,
        )
        .bind(webhook_id)
        .bind(window_hours.to_string())
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    /// Deliveries currently waiting in the retry queue for a webhook.
    pub async fn pending_retry_count(pool: &PgPool, webhook_id: Uuid) -> Result<i64, ApiError> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM webhook_retry_queue WHERE webhook_id = $1 AND status IN ('pending', 'retrying')",
        )
        .bind(webhook_id)
        .fetch_one(pool)
        .await?;
        Ok(count)
    }
}

// ---------------------------------------------------------------------------
// Webhook retry queue
// ---------------------------------------------------------------------------

/// Retry status for queued webhook deliveries
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "webhook_retry_status", rename_all = "lowercase")]
pub enum WebhookRetryStatus {
    Pending,
    Retrying,
    Done,
    Dead,
}

/// A queued webhook delivery with retry state
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct WebhookRetryJob {
    pub id: Uuid,
    pub webhook_id: Uuid,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub first_delivery_id: Option<Uuid>,
    pub status: WebhookRetryStatus,
    pub attempts: i32,
    pub max_attempts: i32,
    pub last_attempt_at: Option<DateTime<Utc>>,
    pub next_retry_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Compute retry delay for a given attempt number.
/// Schedule: 0s, 5m, 30m, 2h, 12h, 48h.
/// Returns None when max attempts exhausted (attempt >= 6).
pub fn next_webhook_retry_delay(attempt: u32) -> Option<std::time::Duration> {
    match attempt {
        0 => Some(std::time::Duration::from_secs(0)),
        1 => Some(std::time::Duration::from_secs(300)),
        2 => Some(std::time::Duration::from_secs(1800)),
        3 => Some(std::time::Duration::from_secs(7200)),
        4 => Some(std::time::Duration::from_secs(43200)),
        5 => Some(std::time::Duration::from_secs(172800)),
        _ => None,
    }
}

impl WebhookRetryJob {
    /// Enqueue a fresh webhook dispatch for queue-based delivery.
    /// The retry worker picks these up within its poll interval (15s)
    /// and handles delivery + retry on failure.
    pub async fn enqueue_dispatch(
        pool: &PgPool,
        webhook_id: Uuid,
        event_type: &str,
        payload: &serde_json::Value,
    ) -> Result<Self, ApiError> {
        let job = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO webhook_retry_queue
                (webhook_id, event_type, payload, status, attempts, next_retry_at)
            VALUES ($1, $2, $3, 'pending', 0, NOW())
            RETURNING *
            "#,
        )
        .bind(webhook_id)
        .bind(event_type)
        .bind(payload)
        .fetch_one(pool)
        .await?;

        Ok(job)
    }

    /// Enqueue a failed delivery for retry.
    pub async fn enqueue(
        pool: &PgPool,
        webhook_id: Uuid,
        event_type: &str,
        payload: &serde_json::Value,
        first_delivery_id: Option<Uuid>,
        error_message: &str,
    ) -> Result<Self, ApiError> {
        let delay =
            next_webhook_retry_delay(1).unwrap_or_else(|| std::time::Duration::from_secs(300));
        let next_retry = Utc::now() + chrono::Duration::seconds(delay.as_secs() as i64);

        let job = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO webhook_retry_queue
                (webhook_id, event_type, payload, first_delivery_id, status, attempts, next_retry_at, error_message)
            VALUES ($1, $2, $3, $4, 'pending', 1, $5, $6)
            RETURNING *
            "#,
        )
        .bind(webhook_id)
        .bind(event_type)
        .bind(payload)
        .bind(first_delivery_id)
        .bind(next_retry)
        .bind(error_message)
        .fetch_one(pool)
        .await?;

        Ok(job)
    }

    /// Dequeue pending jobs ready for retry.
    pub async fn dequeue_pending(pool: &PgPool, batch_size: i64) -> Result<Vec<Self>, ApiError> {
        let jobs = sqlx::query_as::<_, Self>(
            r#"
            SELECT * FROM webhook_retry_queue
            WHERE status IN ('pending', 'retrying')
              AND (next_retry_at IS NULL OR next_retry_at <= NOW())
            ORDER BY created_at ASC
            LIMIT $1
            FOR UPDATE SKIP LOCKED
            "#,
        )
        .bind(batch_size)
        .fetch_all(pool)
        .await?;

        Ok(jobs)
    }

    /// Schedule next retry or mark as dead if exhausted.
    pub async fn schedule_retry(pool: &PgPool, id: Uuid, error: &str) -> Result<(), ApiError> {
        let job = sqlx::query_as::<_, Self>("SELECT * FROM webhook_retry_queue WHERE id = $1")
            .bind(id)
            .fetch_one(pool)
            .await?;

        let new_attempts = job.attempts + 1;

        match next_webhook_retry_delay(new_attempts as u32) {
            Some(delay) => {
                let next_at = Utc::now() + chrono::Duration::seconds(delay.as_secs() as i64);
                sqlx::query(
                    r#"
                    UPDATE webhook_retry_queue
                    SET attempts = $2, next_retry_at = $3, status = 'pending',
                        last_attempt_at = NOW(), error_message = $4
                    WHERE id = $1
                    "#,
                )
                .bind(id)
                .bind(new_attempts)
                .bind(next_at)
                .bind(error)
                .execute(pool)
                .await?;
            }
            None => {
                sqlx::query(
                    r#"
                    UPDATE webhook_retry_queue
                    SET attempts = $2, status = 'dead',
                        last_attempt_at = NOW(), error_message = $3
                    WHERE id = $1
                    "#,
                )
                .bind(id)
                .bind(new_attempts)
                .bind(error)
                .execute(pool)
                .await?;
            }
        }

        Ok(())
    }

    /// Mark a job as successfully delivered.
    pub async fn mark_done(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        sqlx::query(
            r#"
            UPDATE webhook_retry_queue
            SET status = 'done', last_attempt_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Re-enqueue a dead delivery for manual retry.
    pub async fn manual_retry(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        sqlx::query(
            r#"
            UPDATE webhook_retry_queue
            SET status = 'pending', next_retry_at = NOW(), error_message = NULL
            WHERE id = $1 AND status = 'dead'
            "#,
        )
        .bind(id)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Purge dead retry rows older than `older_than_days`, mirroring the
    /// flushed-buffer cleanup. Permanently-failing endpoints accumulate `dead`
    /// rows indefinitely otherwise; manual retries (which flip a row back to
    /// `pending`) reset `last_attempt_at`, so a row only ages out once it has
    /// truly been abandoned. Returns the number of rows deleted.
    pub async fn purge_dead(pool: &PgPool, older_than_days: i64) -> Result<u64, ApiError> {
        let result = sqlx::query(
            "DELETE FROM webhook_retry_queue \
             WHERE status = 'dead' AND last_attempt_at < NOW() - ($1 || ' days')::interval",
        )
        .bind(older_than_days.to_string())
        .execute(pool)
        .await?;
        Ok(result.rows_affected())
    }
}

/// A buffered batch of webhook events awaiting debounced delivery.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct WebhookDispatchBuffer {
    pub id: Uuid,
    pub webhook_id: Uuid,
    pub site_id: Uuid,
    pub events: serde_json::Value,
    pub flush_at: DateTime<Utc>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl WebhookDispatchBuffer {
    /// Upsert: if a buffering row exists for this webhook, extend it; otherwise create one.
    pub async fn upsert(
        pool: &PgPool,
        webhook_id: Uuid,
        site_id: Uuid,
        event_payload: &serde_json::Value,
        debounce_seconds: i32,
    ) -> Result<WebhookDispatchBuffer, ApiError> {
        let row = sqlx::query_as::<_, WebhookDispatchBuffer>(
            r#"INSERT INTO webhook_dispatch_buffer (webhook_id, site_id, events, flush_at)
               VALUES ($1, $2, jsonb_build_array($3), NOW() + ($4 || ' seconds')::interval)
               ON CONFLICT (webhook_id) WHERE status = 'buffering'
               DO UPDATE SET
                   events = webhook_dispatch_buffer.events || jsonb_build_array($3),
                   flush_at = NOW() + ($4 || ' seconds')::interval,
                   updated_at = NOW()
               RETURNING *"#,
        )
        .bind(webhook_id)
        .bind(site_id)
        .bind(event_payload)
        .bind(debounce_seconds.to_string())
        .fetch_one(pool)
        .await?;
        Ok(row)
    }

    /// Dequeue buffers ready to flush.
    pub async fn dequeue_pending(
        pool: &PgPool,
        batch_size: i64,
    ) -> Result<Vec<WebhookDispatchBuffer>, ApiError> {
        let rows = sqlx::query_as::<_, WebhookDispatchBuffer>(
            r#"UPDATE webhook_dispatch_buffer
               SET status = 'flushing', updated_at = NOW()
               WHERE id IN (
                   SELECT id FROM webhook_dispatch_buffer
                   WHERE status = 'buffering' AND flush_at <= NOW()
                   ORDER BY flush_at
                   LIMIT $1
                   FOR UPDATE SKIP LOCKED
               )
               RETURNING *"#,
        )
        .bind(batch_size)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    /// Mark a buffer as flushed after successful delivery.
    pub async fn mark_flushed(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        sqlx::query(
            "UPDATE webhook_dispatch_buffer SET status = 'flushed', updated_at = NOW() WHERE id = $1",
        )
        .bind(id)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Delete old flushed buffers (cleanup).
    pub async fn cleanup_flushed(pool: &PgPool, older_than_hours: i64) -> Result<u64, ApiError> {
        let result = sqlx::query(
            "DELETE FROM webhook_dispatch_buffer WHERE status = 'flushed' AND updated_at < NOW() - ($1 || ' hours')::interval",
        )
        .bind(older_than_hours.to_string())
        .execute(pool)
        .await?;
        Ok(result.rows_affected())
    }
}

#[cfg(test)]
mod decrypt_secret_tests {
    use super::*;
    use crate::services::encryption;

    fn dev_key() -> [u8; 32] {
        encryption::resolve_key("").expect("dev key resolves")
    }

    fn make_webhook(secret: &str, nonce: Option<Vec<u8>>) -> Webhook {
        Webhook {
            id: Uuid::new_v4(),
            site_id: Uuid::new_v4(),
            url: "https://example.com/hook".to_string(),
            secret: secret.to_string(),
            secret_nonce: nonce,
            description: None,
            events: vec![],
            is_active: true,
            debounce_seconds: 0,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn legacy_plaintext_returns_as_is() {
        // Legacy webhooks have secret_nonce = None (plaintext).
        let wh = make_webhook("whsec_plaintext_legacy_key", None);
        let decrypted = wh.decrypt_secret(&dev_key()).expect("decrypts");
        assert_eq!(decrypted, "whsec_plaintext_legacy_key");
    }

    #[test]
    fn encrypted_secret_roundtrips() {
        let plaintext = "whsec_abc123_test_secret_key";
        let key = dev_key();
        let (ciphertext, nonce) = encryption::encrypt(plaintext, &key).expect("encrypts");
        let encoded_ct =
            base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &ciphertext);
        // Stored ciphertext must differ from plaintext.
        assert_ne!(encoded_ct, plaintext);

        let wh = make_webhook(&encoded_ct, Some(nonce));
        let decrypted = wh.decrypt_secret(&key).expect("decrypts");
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn encrypted_secret_wrong_key_fails() {
        let plaintext = "whsec_test_value";
        let key = dev_key();
        let (ciphertext, nonce) = encryption::encrypt(plaintext, &key).expect("encrypts");
        let encoded_ct =
            base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &ciphertext);
        let wh = make_webhook(&encoded_ct, Some(nonce));

        let wrong_key: [u8; 32] = [0xAB; 32];
        let result = wh.decrypt_secret(&wrong_key);
        assert!(result.is_err(), "decryption with wrong key must fail");
    }

    #[test]
    fn corrupted_ciphertext_errors() {
        let wh = make_webhook(
            "not-valid-base64!!!",
            Some(vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
        );
        let result = wh.decrypt_secret(&dev_key());
        assert!(result.is_err(), "corrupted ciphertext must error");
    }
}

#[cfg(test)]
mod retry_tests {
    use super::*;

    #[test]
    fn test_retry_schedule() {
        assert_eq!(next_webhook_retry_delay(0).unwrap().as_secs(), 0);
        assert_eq!(next_webhook_retry_delay(1).unwrap().as_secs(), 300);
        assert_eq!(next_webhook_retry_delay(2).unwrap().as_secs(), 1800);
        assert_eq!(next_webhook_retry_delay(3).unwrap().as_secs(), 7200);
        assert_eq!(next_webhook_retry_delay(4).unwrap().as_secs(), 43200);
        assert_eq!(next_webhook_retry_delay(5).unwrap().as_secs(), 172800);
        assert!(next_webhook_retry_delay(6).is_none());
    }

    #[test]
    fn test_retry_schedule_labels() {
        // Verify human-readable schedule: 0s, 5m, 30m, 2h, 12h, 48h
        assert_eq!(next_webhook_retry_delay(1).unwrap().as_secs() / 60, 5);
        assert_eq!(next_webhook_retry_delay(2).unwrap().as_secs() / 60, 30);
        assert_eq!(next_webhook_retry_delay(3).unwrap().as_secs() / 3600, 2);
        assert_eq!(next_webhook_retry_delay(4).unwrap().as_secs() / 3600, 12);
        assert_eq!(next_webhook_retry_delay(5).unwrap().as_secs() / 3600, 48);
    }

    #[test]
    fn test_max_attempts_exhausted() {
        for i in 6..=10 {
            assert!(next_webhook_retry_delay(i).is_none());
        }
    }
}

#[cfg(test)]
mod stats_tests {
    #[test]
    fn test_success_rate_calculation() {
        let total = 10i64;
        let successful = 9i64;
        let rate = if total > 0 {
            (successful as f64 / total as f64) * 100.0
        } else {
            0.0
        };
        assert!((rate - 90.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_success_rate_zero_deliveries() {
        let total = 0i64;
        let successful = 0i64;
        let rate = if total > 0 {
            (successful as f64 / total as f64) * 100.0
        } else {
            0.0
        };
        assert!((rate - 0.0).abs() < f64::EPSILON);
    }
}
