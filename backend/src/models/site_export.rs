//! Site export job (issue #716, epic #708).
//!
//! A DB-backed job row mirroring [`crate::models::webhook::WebhookRetryJob`]:
//! `POST /sites/{id}/export` enqueues a `queued` row; the
//! [`crate::services::site_export_worker`] (#717) flips it
//! `running` → `ready` (with a stored ZIP + signed download token) or
//! `failed`. One active job per site at a time.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::{ApiError, codes};

/// Lifecycle of an export job. Stored as the PG `site_export_status`
/// enum (migration …068); see that migration for the value set.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "site_export_status", rename_all = "lowercase")]
pub enum SiteExportStatus {
    Queued,
    Running,
    Ready,
    Failed,
}

impl SiteExportStatus {
    /// Lowercase wire form used in the HTTP response body. Kept explicit
    /// rather than relying on serde so the API contract is not coupled to
    /// the Rust variant spelling.
    pub fn as_str(&self) -> &'static str {
        match self {
            SiteExportStatus::Queued => "queued",
            SiteExportStatus::Running => "running",
            SiteExportStatus::Ready => "ready",
            SiteExportStatus::Failed => "failed",
        }
    }
}

/// One queued/running/ready/failed export of a single site.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SiteExportJob {
    pub id: Uuid,
    pub site_id: Uuid,
    pub status: SiteExportStatus,
    /// Actor (`auth.id`) that requested the export; no FK, mirroring the
    /// nullable `audit_logs.user_id` convention.
    pub requested_by: Option<Uuid>,
    /// Storage key of the built ZIP — `None` until the worker finishes.
    pub storage_path: Option<String>,
    /// Unguessable bearer the signed download link carries — `None` until
    /// the worker finishes.
    pub download_token: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl SiteExportJob {
    /// Enqueue a fresh export for `site_id`. The worker picks `queued`
    /// rows up within its poll interval. Callers must first ensure no
    /// active job exists via [`Self::find_active_for_site`].
    pub async fn enqueue(
        pool: &PgPool,
        site_id: Uuid,
        requested_by: Option<Uuid>,
    ) -> Result<Self, ApiError> {
        let job = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO site_export_jobs (site_id, status, requested_by)
            VALUES ($1, 'queued', $2)
            RETURNING *
            "#,
        )
        .bind(site_id)
        .bind(requested_by)
        .fetch_one(pool)
        .await?;
        Ok(job)
    }

    /// Fetch a job scoped to its site. A job id that belongs to another
    /// site (or does not exist) is a 404 `SITE_EXPORT_JOB_NOT_FOUND` —
    /// the site scoping prevents cross-site job enumeration.
    pub async fn find_for_site(
        pool: &PgPool,
        site_id: Uuid,
        job_id: Uuid,
    ) -> Result<Self, ApiError> {
        sqlx::query_as::<_, Self>("SELECT * FROM site_export_jobs WHERE id = $1 AND site_id = $2")
            .bind(job_id)
            .bind(site_id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| {
                ApiError::not_found("Site export job not found")
                    .with_code(codes::SITE_EXPORT_JOB_NOT_FOUND)
            })
    }

    /// The site's currently `queued` or `running` job, if any. Drives
    /// the single-active-job guard on enqueue.
    pub async fn find_active_for_site(
        pool: &PgPool,
        site_id: Uuid,
    ) -> Result<Option<Self>, ApiError> {
        let job = sqlx::query_as::<_, Self>(
            r#"
            SELECT * FROM site_export_jobs
            WHERE site_id = $1 AND status IN ('queued', 'running')
            ORDER BY created_at ASC
            LIMIT 1
            "#,
        )
        .bind(site_id)
        .fetch_optional(pool)
        .await?;
        Ok(job)
    }

    /// Claim up to `batch` `queued` jobs for processing. `FOR UPDATE SKIP
    /// LOCKED` keeps concurrent worker ticks from grabbing the same row.
    pub async fn dequeue_queued(pool: &PgPool, batch: i64) -> Result<Vec<Self>, ApiError> {
        let jobs = sqlx::query_as::<_, Self>(
            r#"
            SELECT * FROM site_export_jobs
            WHERE status = 'queued'
            ORDER BY created_at ASC
            LIMIT $1
            FOR UPDATE SKIP LOCKED
            "#,
        )
        .bind(batch)
        .fetch_all(pool)
        .await?;
        Ok(jobs)
    }

    /// Flip `queued` → `running`. Idempotent: a row already past `queued`
    /// is left untouched.
    pub async fn mark_running(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        sqlx::query(
            "UPDATE site_export_jobs SET status = 'running', updated_at = NOW() \
             WHERE id = $1 AND status = 'queued'",
        )
        .bind(id)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Mark the job `ready` with its stored artifact + signed-link fields.
    pub async fn mark_ready(
        pool: &PgPool,
        id: Uuid,
        storage_path: &str,
        download_token: &str,
        expires_at: DateTime<Utc>,
    ) -> Result<(), ApiError> {
        sqlx::query(
            "UPDATE site_export_jobs \
             SET status = 'ready', storage_path = $2, download_token = $3, \
                 expires_at = $4, error = NULL, updated_at = NOW() \
             WHERE id = $1",
        )
        .bind(id)
        .bind(storage_path)
        .bind(download_token)
        .bind(expires_at)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Mark the job `failed`, recording the error for the status endpoint.
    pub async fn mark_failed(pool: &PgPool, id: Uuid, error: &str) -> Result<(), ApiError> {
        sqlx::query(
            "UPDATE site_export_jobs SET status = 'failed', error = $2, updated_at = NOW() \
             WHERE id = $1",
        )
        .bind(id)
        .bind(error)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// `ready` jobs whose download window has lapsed — the retention
    /// sweep deletes their stored ZIP and then the row.
    pub async fn find_ready_expired(pool: &PgPool) -> Result<Vec<Self>, ApiError> {
        let jobs = sqlx::query_as::<_, Self>(
            "SELECT * FROM site_export_jobs \
             WHERE status = 'ready' AND expires_at IS NOT NULL AND expires_at < NOW()",
        )
        .fetch_all(pool)
        .await?;
        Ok(jobs)
    }

    /// Hard-delete a job row (used by retention once its artifact is gone).
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM site_export_jobs WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }
}
