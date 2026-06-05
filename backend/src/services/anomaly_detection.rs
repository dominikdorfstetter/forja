//! Anomaly detection worker fairing.
//!
//! Spawns a Tokio task on liftoff that periodically checks active API keys
//! for abnormal usage patterns and auto-blocks compromised or abused keys.
//!
//! Detection strategies:
//! 1. Hourly spike: current hour > N× 7-day hourly average
//! 2. Daily spike: current day > N× 7-day daily average
//! 3. Error rate: >50% errors with minimum request threshold

use chrono::Utc;
use redis::AsyncCommands;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Semaphore;
use uuid::Uuid;

use crate::config::SecurityConfig;
use crate::models::api_key::{ApiKey, ApiKeyStatus, ApiKeyUsageDaily};
use crate::services::audit_service;
use crate::services::worker_lock;
use crate::AppState;

/// How often the worker runs (seconds).
const POLL_INTERVAL_SECS: u64 = 60;

/// Maximum concurrent DB queries per cycle.
const MAX_CONCURRENT_CHECKS: usize = 5;

/// Default thresholds for new keys (<7 days old) that have no baseline.
const NEW_KEY_HOURLY_THRESHOLD: u32 = 5000;
const NEW_KEY_DAILY_THRESHOLD: u32 = 50000;

/// Anomaly types stored in `blocked_reason`.
const ANOMALY_HOURLY_SPIKE: &str = "anomaly:hourly_spike";
const ANOMALY_DAILY_SPIKE: &str = "anomaly:daily_spike";
const ANOMALY_ERROR_RATE: &str = "anomaly:error_rate";

pub struct AnomalyDetectionWorker;

impl AnomalyDetectionWorker {
    pub fn spawn(state: AppState) {
        if !state.settings.security.anomaly_detection_enabled {
            tracing::info!(
                worker = "anomaly_detection",
                reason = "disabled_by_config",
                "worker disabled"
            );
            return;
        }

        let pool = state.db.clone();
        let redis = match state.redis {
            Some(ref r) => r.clone(),
            None => {
                tracing::warn!(
                    worker = "anomaly_detection",
                    reason = "redis_unavailable",
                    "worker disabled"
                );
                return;
            }
        };
        let config = state.settings.security.clone();

        tracing::info!(
            "Anomaly detection worker starting (poll={}s, hourly_mult={}, daily_mult={}, error_thresh={})",
            POLL_INTERVAL_SECS,
            config.anomaly_hourly_multiplier,
            config.anomaly_daily_multiplier,
            config.anomaly_error_rate_threshold,
        );

        tokio::spawn(async move {
            let mut interval =
                tokio::time::interval(std::time::Duration::from_secs(POLL_INTERVAL_SECS));
            loop {
                interval.tick().await;
                worker_lock::run_if_leader(&pool, "anomaly_detection", || {
                    run_cycle(&pool, &redis, &config)
                })
                .await;
            }
        });
    }
}

/// Execute one detection cycle.
#[tracing::instrument(name = "anomaly_detection_tick", skip_all)]
async fn run_cycle(pool: &PgPool, redis: &redis::aio::ConnectionManager, config: &SecurityConfig) {
    let now = Utc::now();
    let hourly_prefix = format!("quota:*:h:{}", now.format("%Y%m%d%H"));
    let daily_prefix = format!("quota:*:d:{}", now.format("%Y%m%d"));

    // Collect active key IDs from Redis quota keys
    let key_ids = match scan_active_keys(redis, &hourly_prefix, &daily_prefix).await {
        Ok(ids) => ids,
        Err(e) => {
            tracing::debug!(error = %e, "Anomaly detection: failed to scan Redis keys");
            return;
        }
    };

    if key_ids.is_empty() {
        return;
    }

    tracing::debug!(
        active_keys = key_ids.len(),
        "Anomaly detection: checking active keys"
    );

    let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_CHECKS));

    for key_id in key_ids {
        let permit = match semaphore.clone().acquire_owned().await {
            Ok(p) => p,
            Err(_) => return, // Semaphore closed
        };

        let pool = pool.clone();
        let mut redis_conn = redis.clone();
        let config = config.clone();

        tokio::spawn(async move {
            check_key(&pool, &mut redis_conn, &config, key_id, now).await;
            drop(permit);
        });
    }
}

/// Scan Redis for active quota keys and extract unique key UUIDs.
async fn scan_active_keys(
    redis: &redis::aio::ConnectionManager,
    hourly_pattern: &str,
    daily_pattern: &str,
) -> Result<Vec<Uuid>, redis::RedisError> {
    let mut ids = std::collections::HashSet::new();
    let mut conn = redis.clone();

    // Scan hourly keys: quota:{uuid}:h:{window}
    for pattern in [hourly_pattern, daily_pattern] {
        let keys: Vec<String> = redis::cmd("KEYS")
            .arg(pattern)
            .query_async(&mut conn)
            .await?;

        for key in keys {
            if let Some(uuid_str) = extract_key_id(&key) {
                if let Ok(uuid) = Uuid::parse_str(uuid_str) {
                    ids.insert(uuid);
                }
            }
        }
    }

    Ok(ids.into_iter().collect())
}

/// Extract the UUID from a Redis key like `quota:{uuid}:h:{window}`.
fn extract_key_id(redis_key: &str) -> Option<&str> {
    let parts: Vec<&str> = redis_key.split(':').collect();
    if parts.len() >= 2 {
        Some(parts[1])
    } else {
        None
    }
}

/// Check a single key for anomalies.
async fn check_key(
    pool: &PgPool,
    redis: &mut redis::aio::ConnectionManager,
    config: &SecurityConfig,
    key_id: Uuid,
    now: chrono::DateTime<Utc>,
) {
    // Verify key is still active (skip already-blocked keys)
    let key = match ApiKey::find_by_id(pool, key_id).await {
        Ok(k) => k,
        Err(_) => return,
    };

    if key.status != ApiKeyStatus::Active {
        return;
    }

    // Skip anomaly detection for demo guest keys — they may generate
    // many errors during evaluation and should not be auto-blocked.
    if key.key_prefix == "dk_guest" || key.name == "Demo Guest Key" {
        return;
    }

    let key_id_str = key_id.to_string();

    // Read current hourly counter
    let hourly_key = format!("quota:{}:h:{}", key_id_str, now.format("%Y%m%d%H"));
    let hourly_count: u32 = redis.get(&hourly_key).await.unwrap_or(0);

    // Read current daily counter
    let daily_key = format!("quota:{}:d:{}", key_id_str, now.format("%Y%m%d"));
    let daily_count: u32 = redis.get(&daily_key).await.unwrap_or(0);

    // Get 7-day baseline
    let avg_daily = ApiKeyUsageDaily::avg_daily_requests(pool, key_id)
        .await
        .unwrap_or(None);

    // Determine thresholds
    let (hourly_threshold, daily_threshold) = match avg_daily {
        Some(avg) if avg > 0.0 => {
            let hourly_avg = avg / 24.0;
            (
                (hourly_avg * config.anomaly_hourly_multiplier as f64) as u32,
                (avg * config.anomaly_daily_multiplier as f64) as u32,
            )
        }
        _ => {
            // New key or no data — use global defaults
            (NEW_KEY_HOURLY_THRESHOLD, NEW_KEY_DAILY_THRESHOLD)
        }
    };

    // Check 1: Hourly spike
    if hourly_count > hourly_threshold && hourly_threshold > 0 {
        block_key(
            pool,
            key_id,
            key.site_id,
            ANOMALY_HOURLY_SPIKE,
            &format!(
                "Hourly spike: {} requests (threshold: {})",
                hourly_count, hourly_threshold
            ),
        )
        .await;
        return;
    }

    // Check 2: Daily spike
    if daily_count > daily_threshold && daily_threshold > 0 {
        block_key(
            pool,
            key_id,
            key.site_id,
            ANOMALY_DAILY_SPIKE,
            &format!(
                "Daily spike: {} requests (threshold: {})",
                daily_count, daily_threshold
            ),
        )
        .await;
        return;
    }

    // Check 3: Error rate (only if enough requests in the current hour)
    if hourly_count >= config.anomaly_min_requests {
        // Read error count from the hourly error counter
        let error_key = format!("quota:{}:err_h:{}", key_id_str, now.format("%Y%m%d%H"));
        let error_count: u32 = redis.get(&error_key).await.unwrap_or(0);

        if hourly_count > 0 {
            let error_rate = error_count as f32 / hourly_count as f32;
            if error_rate > config.anomaly_error_rate_threshold {
                block_key(
                    pool,
                    key_id,
                    key.site_id,
                    ANOMALY_ERROR_RATE,
                    &format!(
                        "Error rate spike: {:.0}% ({}/{} requests)",
                        error_rate * 100.0,
                        error_count,
                        hourly_count
                    ),
                )
                .await;
            }
        }
    }
}

/// Block a key due to anomaly and log the event.
async fn block_key(pool: &PgPool, key_id: Uuid, site_id: Uuid, reason: &str, detail: &str) {
    tracing::warn!(
        key_id = %key_id,
        anomaly_type = reason,
        detail = detail,
        "Anomaly detection: auto-blocking API key"
    );

    if let Err(e) = ApiKey::block(pool, key_id, reason).await {
        tracing::error!(
            error = %e,
            key_id = %key_id,
            "Anomaly detection: failed to block key"
        );
        return;
    }

    audit_service::log_action(
        pool,
        Some(site_id),
        None, // system action
        crate::models::audit::AuditAction::Update,
        "api_key",
        key_id,
        Some(serde_json::json!({
            "sub_action": "anomaly_block",
            "reason": reason,
            "detail": detail,
        })),
    )
    .await;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_key_id() {
        assert_eq!(
            extract_key_id("quota:550e8400-e29b-41d4-a716-446655440000:h:2026032210"),
            Some("550e8400-e29b-41d4-a716-446655440000")
        );
        assert_eq!(extract_key_id("quota:abc-123:d:20260322"), Some("abc-123"));
        assert_eq!(extract_key_id("invalid"), None);
    }

    #[test]
    fn test_anomaly_reasons_are_prefixed() {
        assert!(ANOMALY_HOURLY_SPIKE.starts_with("anomaly:"));
        assert!(ANOMALY_DAILY_SPIKE.starts_with("anomaly:"));
        assert!(ANOMALY_ERROR_RATE.starts_with("anomaly:"));
    }

    #[test]
    fn test_constants() {
        assert_eq!(POLL_INTERVAL_SECS, 60);
        assert_eq!(MAX_CONCURRENT_CHECKS, 5);
        assert_eq!(NEW_KEY_HOURLY_THRESHOLD, 5000);
        assert_eq!(NEW_KEY_DAILY_THRESHOLD, 50000);
    }
}
