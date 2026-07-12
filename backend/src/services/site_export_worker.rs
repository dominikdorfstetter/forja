//! Site export worker (issue #717, epic #708).
//!
//! Picks up `queued` [`SiteExportJob`]s, builds a ZIP of the JSON
//! archive ([`super::site_archive`]) plus the site-owned media bytes,
//! stores it, stamps a signed expiring download token, and marks the
//! job `ready` — or `failed` with an error on any problem. A periodic
//! retention sweep deletes artifacts whose download window has lapsed.
//!
//! Structure mirrors [`super::webhook_retry_worker`]; [`run_once`] and
//! [`purge_expired`] are public so integration tests can drive a single
//! tick deterministically (the [`super::forms_retention_cleanup`]
//! pattern).

use chrono::{Duration, Utc};
use sqlx::PgPool;

use crate::AppState;
use crate::errors::{ApiError, codes};
use crate::models::audit::AuditAction;
use crate::models::site_export::SiteExportJob;
use crate::services::audited_mutation::{self, MutationEvent};
use crate::services::site_archive::{self, OwnedMedia};
use crate::services::storage::StorageBackend;
use crate::services::worker_lock;

/// Poll cadence. Export is heavier than webhook delivery, so it polls
/// less often than the 15s retry worker.
const POLL_INTERVAL_SECS: u64 = 30;
/// Jobs claimed per tick.
const BATCH_SIZE: i64 = 5;
/// How long a built artifact (and its signed link) stays downloadable.
const EXPORT_TTL_DAYS: i64 = 7;
/// Run the retention sweep every Nth tick (~hourly at the poll cadence
/// above) rather than every tick.
const PURGE_EVERY_TICKS: u64 = 120;

pub struct SiteExportWorker;

impl SiteExportWorker {
    pub fn spawn(state: AppState) {
        let pool = state.db.clone();
        let storage = state.storage.clone();
        tracing::info!(
            worker = "site_export",
            poll_seconds = POLL_INTERVAL_SECS,
            ttl_days = EXPORT_TTL_DAYS,
            "worker starting"
        );
        tokio::spawn(async move {
            let mut interval =
                tokio::time::interval(std::time::Duration::from_secs(POLL_INTERVAL_SECS));
            let mut ticks: u64 = 0;
            loop {
                interval.tick().await;
                worker_lock::run_if_leader(&pool, "site_export", || async {
                    ticks = ticks.wrapping_add(1);
                    if let Err(e) = run_once(&pool, storage.as_ref()).await {
                        tracing::warn!(worker = "site_export", error = %e, "tick failed");
                    }
                    if ticks.is_multiple_of(PURGE_EVERY_TICKS) {
                        match purge_expired(&pool, storage.as_ref()).await {
                            Ok(n) if n > 0 => tracing::info!(
                                worker = "site_export",
                                purged = n,
                                "expired export artifacts reclaimed"
                            ),
                            Ok(_) => {}
                            Err(e) => tracing::warn!(
                                worker = "site_export",
                                error = %e,
                                "retention sweep failed"
                            ),
                        }
                    }
                })
                .await;
            }
        });
    }
}

/// Process every currently-`queued` job once. Per-job failures are
/// recorded on the job (status `failed`) and never abort the batch; only
/// a dequeue error propagates.
pub async fn run_once(pool: &PgPool, storage: &dyn StorageBackend) -> Result<(), ApiError> {
    let jobs = SiteExportJob::dequeue_queued(pool, BATCH_SIZE).await?;
    for job in jobs {
        process_job(pool, storage, &job).await;
    }
    Ok(())
}

async fn process_job(pool: &PgPool, storage: &dyn StorageBackend, job: &SiteExportJob) {
    if let Err(e) = SiteExportJob::mark_running(pool, job.id).await {
        tracing::warn!(worker = "site_export", job_id = %job.id, error = %e, "mark_running failed");
        return;
    }

    match build_and_store(pool, storage, job).await {
        Ok((storage_path, token, expires_at)) => {
            if let Err(e) =
                SiteExportJob::mark_ready(pool, job.id, &storage_path, &token, expires_at).await
            {
                tracing::warn!(worker = "site_export", job_id = %job.id, error = %e, "mark_ready failed");
                return;
            }
            audited_mutation::execute(
                pool,
                MutationEvent {
                    site_id: Some(job.site_id),
                    user_id: job.requested_by,
                    action: AuditAction::Export,
                    entity_type: "site",
                    entity_id: job.site_id,
                    webhook_event: None,
                    webhook_payload: serde_json::Value::Null,
                    audit_metadata: Some(serde_json::json!({
                        "reason": "site_export_completed",
                        "job_id": job.id,
                    })),
                    change_diff: None,
                },
            )
            .await;
        }
        Err(e) => {
            // AC #717: failed jobs carry an ERR_SITE_EXPORT_FAILED message.
            let msg = format!("{}: {e}", codes::SITE_EXPORT_FAILED);
            if let Err(e2) = SiteExportJob::mark_failed(pool, job.id, &msg).await {
                tracing::warn!(worker = "site_export", job_id = %job.id, error = %e2, "mark_failed failed");
            }
        }
    }
}

/// Build the ZIP (archive.json + media bytes), store it, and return the
/// `(storage_path, download_token, expires_at)` triple for the job row.
async fn build_and_store(
    pool: &PgPool,
    storage: &dyn StorageBackend,
    job: &SiteExportJob,
) -> Result<(String, String, chrono::DateTime<Utc>), ApiError> {
    let media = site_archive::gather_owned_media(pool, job.site_id).await?;
    let archive = site_archive::build_archive(pool, job.site_id, &media).await?;
    let archive_bytes = serde_json::to_vec_pretty(&archive)
        .map_err(|e| ApiError::internal(format!("archive serialization failed: {e}")))?;

    // Build the ZIP on disk (a temp file), then stream it to storage. Peak
    // memory is bounded by the largest single media file, not the whole archive
    // — a site with GBs of media no longer holds the full ZIP in RAM.
    let zip_file = build_zip_to_temp(storage, &archive_bytes, &media).await?;

    let storage_path = format!("exports/{}/{}.zip", job.site_id, job.id);
    storage
        .store_file(&storage_path, zip_file.path(), "application/zip")
        .await?;
    // `zip_file` (NamedTempFile) is removed when it drops at end of scope.

    let token = generate_token();
    let expires_at = Utc::now() + Duration::days(EXPORT_TTL_DAYS);
    Ok((storage_path, token, expires_at))
}

/// Assemble the ZIP into a temp file: one `archive.json` plus `media/<file>`
/// per owned media file, fetched one at a time. The archive is written to disk
/// (not an in-memory buffer), so peak memory is bounded by the largest single
/// media file rather than the total archive size.
async fn build_zip_to_temp(
    storage: &dyn StorageBackend,
    archive_bytes: &[u8],
    media: &[OwnedMedia],
) -> Result<tempfile::NamedTempFile, ApiError> {
    let tmp = tempfile::Builder::new()
        .prefix("forja-export-")
        .suffix(".zip")
        .tempfile()
        .map_err(|e| ApiError::internal(format!("export temp file: {e}")))?;
    // An independent owned handle to the same temp file for the zip writer;
    // `tmp` retains the path for the subsequent streamed upload.
    let file = tmp
        .reopen()
        .map_err(|e| ApiError::internal(format!("export temp reopen: {e}")))?;

    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    zip.start_file("archive.json", options)
        .map_err(|e| ApiError::internal(format!("zip error: {e}")))?;
    std::io::Write::write_all(&mut zip, archive_bytes)
        .map_err(|e| ApiError::internal(format!("zip write error: {e}")))?;

    for m in media {
        let (data, _ct) = storage.fetch(&m.storage_path).await?;
        zip.start_file(format!("media/{}", m.filename), options)
            .map_err(|e| ApiError::internal(format!("zip error: {e}")))?;
        std::io::Write::write_all(&mut zip, &data)
            .map_err(|e| ApiError::internal(format!("zip write error: {e}")))?;
    }

    let mut file = zip
        .finish()
        .map_err(|e| ApiError::internal(format!("zip finalize error: {e}")))?;
    std::io::Write::flush(&mut file)
        .map_err(|e| ApiError::internal(format!("zip flush error: {e}")))?;

    Ok(tmp)
}

/// 32 bytes of OS randomness, URL-safe base64 (no padding) so it drops
/// straight into the `?token=` of the signed download link.
fn generate_token() -> String {
    use base64::Engine;
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use rand::RngExt;
    let buf: [u8; 32] = rand::rng().random();
    URL_SAFE_NO_PAD.encode(buf)
}

/// Delete the stored ZIP and then the row for every `ready` job past its
/// expiry. Reuses the model's expiry query; mirrors the trash-cleanup
/// "find expired → delete artifact → drop row" shape.
pub async fn purge_expired(pool: &PgPool, storage: &dyn StorageBackend) -> Result<u64, ApiError> {
    let expired = SiteExportJob::find_ready_expired(pool).await?;
    let mut purged = 0u64;
    for job in expired {
        if let Some(path) = job.storage_path.as_deref() {
            // A missing object is fine — the goal state is "gone".
            if let Err(e) = storage.delete(path).await {
                tracing::debug!(
                    worker = "site_export",
                    job_id = %job.id,
                    error = %e,
                    "artifact already absent during purge"
                );
            }
        }
        SiteExportJob::delete(pool, job.id).await?;
        purged += 1;
    }
    Ok(purged)
}
