//! Usage aggregation worker fairing.
//!
//! Spawns a Tokio task on liftoff that periodically:
//! 1. Aggregates `api_key_usage` → `api_key_usage_daily`
//! 2. Prunes raw usage records older than the retention window
//! 3. Sends notifications for API keys expiring within 7 days

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::api_key::ApiKeyUsageDaily;
use crate::models::notification::Notification;
use crate::services::worker_lock;
use crate::services::worker_observability::TickReport;
use crate::AppState;

/// How often the worker runs (seconds).
const POLL_INTERVAL_SECS: u64 = 300;

/// How many days of raw usage to keep before pruning.
const RETENTION_DAYS: i64 = 7;

/// Days before expiry to start warning.
const EXPIRY_WARNING_DAYS: i32 = 7;

/// Rocket fairing that spawns the usage aggregation worker.
pub struct UsageAggregationWorker;

impl UsageAggregationWorker {
    pub fn spawn(state: AppState) {
        let pool = state.db.clone();
        tracing::info!(
            "Usage aggregation worker starting (poll={}s, retention={}d)",
            POLL_INTERVAL_SECS,
            RETENTION_DAYS,
        );
        tokio::spawn(async move {
            let mut interval =
                tokio::time::interval(std::time::Duration::from_secs(POLL_INTERVAL_SECS));
            loop {
                interval.tick().await;
                worker_lock::run_if_leader(&pool, "usage_aggregation", || run_cycle(&pool)).await;
            }
        });
    }
}

/// Execute one aggregation + prune + expiry-check cycle.
async fn run_cycle(pool: &PgPool) {
    // Step 1: Aggregate
    match ApiKeyUsageDaily::aggregate(pool).await {
        Ok(rows) if rows > 0 => {
            tracing::info!(
                rows_upserted = rows,
                "Usage aggregation: updated daily summaries"
            );
        }
        Ok(_) => {}
        Err(e) => {
            tracing::warn!(error = %e, "Usage aggregation: failed to aggregate");
            return;
        }
    }

    // Step 2: Prune old raw records
    match ApiKeyUsageDaily::prune_raw(pool, RETENTION_DAYS).await {
        Ok(rows) if rows > 0 => {
            tracing::info!(
                rows_deleted = rows,
                retention_days = RETENTION_DAYS,
                "Usage aggregation: pruned old raw records"
            );
        }
        Ok(_) => {}
        Err(e) => {
            tracing::warn!(error = %e, "Usage aggregation: failed to prune raw records");
        }
    }

    // Step 3: Check for expiring API keys and notify site admins
    notify_expiring_keys(pool).await;
}

/// Row shape for the expiring keys query.
#[derive(sqlx::FromRow)]
struct ExpiringKeyRow {
    id: Uuid,
    name: String,
    site_id: Uuid,
    days_until_expiry: i32,
}

/// Find API keys expiring within EXPIRY_WARNING_DAYS and create notifications
/// for site admins. Skips keys that already have a recent notification.
async fn notify_expiring_keys(pool: &PgPool) {
    let rows = match sqlx::query_as::<_, ExpiringKeyRow>(
        r#"
        SELECT ak.id, ak.name, ak.site_id,
               EXTRACT(DAY FROM ak.expires_at - NOW())::INTEGER AS days_until_expiry
        FROM api_keys ak
        WHERE ak.status = 'active'
          AND ak.expires_at IS NOT NULL
          AND ak.expires_at > NOW()
          AND ak.expires_at <= NOW() + make_interval(days => $1)
          AND NOT EXISTS (
              SELECT 1 FROM notifications n
              WHERE n.entity_type = 'api_key'
                AND n.entity_id = ak.id
                AND n.notification_type = 'api_key_expiring'
                AND n.created_at > NOW() - INTERVAL '1 day'
          )
        "#,
    )
    .bind(EXPIRY_WARNING_DAYS)
    .fetch_all(pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!(error = %e, "Usage aggregation: failed to query expiring keys");
            return;
        }
    };

    if rows.is_empty() {
        return;
    }

    tracing::info!(
        count = rows.len(),
        "Usage aggregation: found expiring API keys, notifying admins"
    );

    // One unit per (key, admin) notification; failures were silently swallowed
    // (`Err(_) => continue` / `let _ = create`), so a broken notification path
    // looked like a clean run.
    let mut report = TickReport::new("usage_aggregation_expiry_notify");

    for row in &rows {
        // Find admin+ members of the key's site
        let members: Vec<(String,)> = match sqlx::query_as(
            r#"
            SELECT sm.clerk_user_id
            FROM site_memberships sm
            WHERE sm.site_id = $1
              AND sm.role IN ('owner', 'admin')
            "#,
        )
        .bind(row.site_id)
        .fetch_all(pool)
        .await
        {
            Ok(m) => m,
            Err(e) => {
                tracing::warn!(site_id = %row.site_id, error = %e, "Usage aggregation: failed to load site admins for expiry notice");
                report.fail();
                continue;
            }
        };

        let title = format!(
            "API key \"{}\" expires in {} day{}",
            row.name,
            row.days_until_expiry,
            if row.days_until_expiry == 1 { "" } else { "s" }
        );

        for (clerk_id,) in &members {
            let outcome = Notification::create(
                pool,
                row.site_id,
                clerk_id,
                None, // system action
                "api_key_expiring",
                "api_key",
                row.id,
                &title,
                None,
            )
            .await;
            if let Err(e) = &outcome {
                tracing::warn!(site_id = %row.site_id, key_id = %row.id, error = %e, "Usage aggregation: failed to create expiry notification");
            }
            report.record(&outcome);
        }
    }

    report.finish();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants() {
        assert_eq!(POLL_INTERVAL_SECS, 300);
        assert_eq!(RETENTION_DAYS, 7);
        assert_eq!(EXPIRY_WARNING_DAYS, 7);
    }
}
