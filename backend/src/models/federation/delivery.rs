//! ApDeliveryJob model — outbound delivery queue

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;

use super::types::ApDeliveryStatus;

/// A queued delivery job for an outbound activity.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ApDeliveryJob {
    pub id: Uuid,
    pub activity_id: Uuid,
    pub target_inbox_uri: String,
    pub status: ApDeliveryStatus,
    pub attempts: i32,
    pub max_attempts: i32,
    pub last_attempt_at: Option<DateTime<Utc>>,
    pub next_retry_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub queue_backend: String,
    pub created_at: DateTime<Utc>,
}

/// Compute the retry delay for a given attempt number.
///
/// Returns `None` when max attempts have been exhausted (attempt >= 6).
///
/// Schedule: 0s, 5m, 30m, 2h, 12h, 48h.
pub fn next_retry_delay(attempt: u32) -> Option<std::time::Duration> {
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

impl ApDeliveryJob {
    /// Insert a batch of delivery jobs.
    pub async fn create_batch(
        pool: &PgPool,
        activity_id: Uuid,
        target_inbox_uris: &[String],
    ) -> Result<Vec<Self>, ApiError> {
        let mut jobs = Vec::with_capacity(target_inbox_uris.len());

        for inbox_uri in target_inbox_uris {
            let job = sqlx::query_as::<_, Self>(
                r#"
                INSERT INTO ap_delivery_queue (activity_id, target_inbox_uri, next_retry_at)
                VALUES ($1, $2, NOW())
                RETURNING *
                "#,
            )
            .bind(activity_id)
            .bind(inbox_uri)
            .fetch_one(pool)
            .await?;

            jobs.push(job);
        }

        Ok(jobs)
    }

    /// Mark a delivery job as done.
    pub async fn mark_done(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        sqlx::query(
            r#"
            UPDATE ap_delivery_queue
            SET status = 'done', last_attempt_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Mark a delivery job as failed with an error message.
    pub async fn mark_failed(pool: &PgPool, id: Uuid, error_message: &str) -> Result<(), ApiError> {
        sqlx::query(
            r#"
            UPDATE ap_delivery_queue
            SET status = 'failed', last_attempt_at = NOW(), error_message = $2
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(error_message)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Mark a delivery job as dead (permanently failed).
    pub async fn mark_dead(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        sqlx::query(
            r#"
            UPDATE ap_delivery_queue
            SET status = 'dead', last_attempt_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Increment the attempt counter and schedule the next retry.
    /// If max attempts are exhausted, marks the job as dead instead.
    pub async fn schedule_retry(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        // Fetch current state
        let job = sqlx::query_as::<_, Self>("SELECT * FROM ap_delivery_queue WHERE id = $1")
            .bind(id)
            .fetch_one(pool)
            .await?;

        let new_attempts = job.attempts + 1;

        match next_retry_delay(new_attempts as u32) {
            Some(delay) => {
                let next_at = Utc::now() + chrono::Duration::seconds(delay.as_secs() as i64);
                sqlx::query(
                    r#"
                    UPDATE ap_delivery_queue
                    SET attempts = $2, next_retry_at = $3, status = 'pending'
                    WHERE id = $1
                    "#,
                )
                .bind(id)
                .bind(new_attempts)
                .bind(next_at)
                .execute(pool)
                .await?;
            }
            None => {
                sqlx::query(
                    r#"
                    UPDATE ap_delivery_queue
                    SET attempts = $2, status = 'dead', last_attempt_at = NOW()
                    WHERE id = $1
                    "#,
                )
                .bind(id)
                .bind(new_attempts)
                .execute(pool)
                .await?;
            }
        }

        Ok(())
    }

    /// Dequeue a batch of pending jobs that are ready for delivery.
    /// Uses SELECT FOR UPDATE SKIP LOCKED for safe concurrent processing.
    pub async fn dequeue_pending(pool: &PgPool, batch_size: i64) -> Result<Vec<Self>, ApiError> {
        let jobs = sqlx::query_as::<_, Self>(
            r#"
            SELECT * FROM ap_delivery_queue
            WHERE status IN ('pending', 'failed')
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

    /// Purge dead-letter jobs older than 30 days.
    pub async fn purge_old_dead_letters(pool: &PgPool) -> Result<u64, ApiError> {
        let result = sqlx::query(
            r#"
            DELETE FROM ap_delivery_queue
            WHERE status = 'dead'
              AND created_at < NOW() - INTERVAL '30 days'
            "#,
        )
        .execute(pool)
        .await?;

        Ok(result.rows_affected())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_next_retry_delay() {
        assert_eq!(next_retry_delay(0).unwrap().as_secs(), 0);
        assert_eq!(next_retry_delay(1).unwrap().as_secs(), 300);
        assert_eq!(next_retry_delay(2).unwrap().as_secs(), 1800);
        assert_eq!(next_retry_delay(3).unwrap().as_secs(), 7200);
        assert_eq!(next_retry_delay(4).unwrap().as_secs(), 43200);
        assert_eq!(next_retry_delay(5).unwrap().as_secs(), 172800);
        assert!(next_retry_delay(6).is_none());
    }

    #[test]
    fn test_next_retry_delay_beyond_max() {
        assert!(next_retry_delay(7).is_none());
        assert!(next_retry_delay(100).is_none());
    }
}
