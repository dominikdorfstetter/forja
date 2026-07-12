//! Audit log cleanup worker.
//!
//! Spawns a Tokio task on liftoff that runs once per day and deletes
//! audit log + change history entries older than each site's configured
//! retention period.
//!
//! Two settings govern a site's effective retention (#19):
//! - `audit_log_retention_days` — operational override of the system default.
//! - `data_retention_days` — the GDPR retention policy (null = not configured).
//!   When set, it caps the effective retention: identity-bearing audit rows
//!   must not outlive the declared retention period, so the *shorter* of the
//!   two windows wins.
//!
//! Uses the same fairing pattern as `PublishScheduler`.

use chrono::{Duration, Utc};
use sqlx::PgPool;

use crate::AppState;
use crate::models::audit::{AuditLog, ChangeHistory};
use crate::models::site::Site;
use crate::models::site_settings::{KEY_AUDIT_LOG_RETENTION_DAYS, SiteSetting};
use crate::services::worker_lock;
use crate::services::worker_observability::TickReport;

/// How often the cleanup runs (seconds). Default: 24 hours.
const POLL_INTERVAL_SECS: u64 = 86_400;

/// Rocket fairing that spawns the audit cleanup worker on liftoff.
pub struct AuditCleanupWorker;

impl AuditCleanupWorker {
    pub fn spawn(state: AppState) {
        let pool = state.db.clone();
        let system_default_days = state.settings.audit.retention_days;
        tracing::info!(
            worker = "audit_cleanup",
            interval_hours = POLL_INTERVAL_SECS / 3600,
            system_default_days,
            "worker starting"
        );
        tokio::spawn(async move {
            let mut interval =
                tokio::time::interval(std::time::Duration::from_secs(POLL_INTERVAL_SECS));
            loop {
                interval.tick().await;
                worker_lock::run_if_leader(&pool, "audit_cleanup", || {
                    run_cleanup(&pool, system_default_days)
                })
                .await;
            }
        });
    }
}

/// Run cleanup for all sites and system-level entries.
///
/// Public so the retention tracer test (`tests/gdpr_builtin_pii_test.rs`)
/// can drive a tick directly instead of waiting on the daily interval.
#[tracing::instrument(name = "audit_cleanup_tick", skip_all)]
pub async fn run_cleanup(pool: &PgPool, system_default_days: u32) {
    tracing::info!(worker = "audit_cleanup", "run starting");

    let sites = match Site::find_all(pool).await {
        Ok(s) => s,
        Err(e) => {
            tracing::error!(worker = "audit_cleanup", error = %e, "site list failed");
            return;
        }
    };

    let mut total_audit = 0u64;
    let mut total_history = 0u64;
    // One unit per site + the system scope; a unit fails if either prune errors,
    // so a partial sweep no longer reads as a clean "run complete".
    let mut report = TickReport::new("audit_cleanup");

    for site in &sites {
        let retention_days = get_retention_days(pool, site.id, system_default_days).await;
        let cutoff = Utc::now() - Duration::days(i64::from(retention_days));

        let mut site_failed = false;
        match AuditLog::prune_for_site(pool, site.id, cutoff).await {
            Ok(n) => total_audit += n,
            Err(e) => {
                tracing::error!(worker = "audit_cleanup", site_id = %site.id, table = "audit_logs", error = %e, "site prune failed");
                site_failed = true;
            }
        }

        match ChangeHistory::prune_for_site(pool, site.id, cutoff).await {
            Ok(n) => total_history += n,
            Err(e) => {
                tracing::error!(worker = "audit_cleanup", site_id = %site.id, table = "change_history", error = %e, "site prune failed");
                site_failed = true;
            }
        }

        if site_failed {
            report.fail();
        } else {
            report.ok();
        }
    }

    // Prune system-level entries (NULL site_id) using the system default
    let system_cutoff = Utc::now() - Duration::days(i64::from(system_default_days));
    match AuditLog::prune_system(pool, system_cutoff).await {
        Ok(n) => {
            total_audit += n;
            report.ok();
        }
        Err(e) => {
            tracing::error!(worker = "audit_cleanup", scope = "system", table = "audit_logs", error = %e, "prune failed");
            report.fail();
        }
    }
    match ChangeHistory::prune_system(pool, system_cutoff).await {
        Ok(n) => {
            total_history += n;
            report.ok();
        }
        Err(e) => {
            tracing::error!(worker = "audit_cleanup", scope = "system", table = "change_history", error = %e, "prune failed");
            report.fail();
        }
    }

    tracing::info!(
        worker = "audit_cleanup",
        audit_deleted = total_audit,
        history_deleted = total_history,
        "run complete"
    );
    report.finish();
}

/// Get the effective retention period for a site.
///
/// Starts from `audit_log_retention_days` (falling back to the system
/// default) and, when the site has a GDPR `data_retention_days` policy (#19),
/// caps the window to it — retention rows must not outlive the declared
/// policy, while a policy longer than the audit window never extends it.
async fn get_retention_days(pool: &PgPool, site_id: uuid::Uuid, system_default: u32) -> u32 {
    let audit_days = match SiteSetting::get_value(pool, site_id, KEY_AUDIT_LOG_RETENTION_DAYS).await
    {
        Ok(val) => val
            .as_u64()
            .map(|v| v.max(1) as u32)
            .unwrap_or(system_default),
        Err(_) => system_default,
    };

    let policy_days = SiteSetting::data_retention_days(pool, site_id)
        .await
        .ok()
        .flatten()
        .and_then(|days| u32::try_from(days).ok());

    match policy_days {
        Some(policy_days) => audit_days.min(policy_days.max(1)),
        None => audit_days,
    }
}
