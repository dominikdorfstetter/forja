//! Anomaly detection worker fairing.
//!
//! Spawns a Tokio task on liftoff that periodically checks active API keys
//! for abnormal usage patterns.
//!
//! Detection strategies:
//! 1. Hourly spike: current hour > N× 7-day hourly average (floored)
//! 2. Daily spike: current day > N× 7-day daily average (floored)
//! 3. Error rate: >50% errors with minimum request threshold
//!
//! Only the error-rate rule auto-blocks by default — a high error rate is a
//! genuine compromise/scanning signal. Volume spikes are alert-only (audit
//! entry + warn log) unless `anomaly_block_on_volume_spike` is enabled:
//! volume is already capped by the quota system (429 when exhausted), so a
//! key physically cannot exceed its quota and blocking on a spike adds no
//! protection while destroying availability. A normal SSR build/deploy fans
//! out hundreds of requests in seconds and looks exactly like a spike
//! against a low-traffic baseline; blocking is permanent (only a human can
//! clear it), and the blocked days then drag the baseline further down,
//! making the next deploy trip even sooner. The relative thresholds are
//! additionally floored (`anomaly_min_hourly_threshold` /
//! `anomaly_min_daily_threshold`) so a multiplier over a tiny baseline can
//! never produce a threshold an ordinary build burst would cross.

use chrono::Utc;
use redis::AsyncCommands;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Semaphore;
use uuid::Uuid;

use crate::AppState;
use crate::config::SecurityConfig;
use crate::models::api_key::{ApiKey, ApiKeyStatus, ApiKeyUsageDaily};
use crate::services::audit_service;
use crate::services::notification_service;
use crate::services::worker_lock;

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

/// Alert-dedup marker TTLs — outlive their window so a spike alerts once
/// per hour/day instead of once per 60s poll.
const ALERT_MARKER_HOURLY_TTL_SECS: u64 = 2 * 3600;
const ALERT_MARKER_DAILY_TTL_SECS: u64 = 25 * 3600;

/// A detected usage anomaly on an active API key.
#[derive(Debug, Clone, PartialEq)]
pub enum Anomaly {
    HourlySpike { count: u32, threshold: u32 },
    DailySpike { count: u32, threshold: u32 },
    ErrorRate { errors: u32, requests: u32 },
}

impl Anomaly {
    pub fn reason(&self) -> &'static str {
        match self {
            Anomaly::HourlySpike { .. } => ANOMALY_HOURLY_SPIKE,
            Anomaly::DailySpike { .. } => ANOMALY_DAILY_SPIKE,
            Anomaly::ErrorRate { .. } => ANOMALY_ERROR_RATE,
        }
    }

    pub fn detail(&self) -> String {
        match self {
            Anomaly::HourlySpike { count, threshold } => {
                format!(
                    "Hourly spike: {} requests (threshold: {})",
                    count, threshold
                )
            }
            Anomaly::DailySpike { count, threshold } => {
                format!("Daily spike: {} requests (threshold: {})", count, threshold)
            }
            Anomaly::ErrorRate { errors, requests } => {
                let rate = *errors as f32 / *requests as f32;
                format!(
                    "Error rate spike: {:.0}% ({}/{} requests)",
                    rate * 100.0,
                    errors,
                    requests
                )
            }
        }
    }
}

/// How the worker responds to a volume anomaly.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VolumeAction {
    /// Log + audit only; the quota system already caps actual volume.
    Alert,
    /// Operator opted in to hard-blocking via `anomaly_block_on_volume_spike`.
    Block,
}

pub fn volume_action(config: &SecurityConfig) -> VolumeAction {
    if config.anomaly_block_on_volume_spike {
        VolumeAction::Block
    } else {
        VolumeAction::Alert
    }
}

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
            "Anomaly detection worker starting (poll={}s, hourly_mult={}, daily_mult={}, error_thresh={}, block_on_volume_spike={})",
            POLL_INTERVAL_SECS,
            config.anomaly_hourly_multiplier,
            config.anomaly_daily_multiplier,
            config.anomaly_error_rate_threshold,
            config.anomaly_block_on_volume_spike,
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
            if let Some(uuid_str) = extract_key_id(&key)
                && let Ok(uuid) = Uuid::parse_str(uuid_str)
            {
                ids.insert(uuid);
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

/// Effective volume thresholds for a key: `max(relative, floor)`.
///
/// Keys without an active-day baseline get the generous new-key defaults;
/// established keys get `avg × multiplier`, floored so a multiplier over a
/// tiny baseline (avg 50/day → naive hourly threshold 10) can never produce
/// a threshold that a routine build/deploy burst would cross.
pub fn volume_thresholds(config: &SecurityConfig, avg_daily: Option<f64>) -> (u32, u32) {
    match avg_daily {
        Some(avg) if avg > 0.0 => {
            let hourly_avg = avg / 24.0;
            (
                ((hourly_avg * config.anomaly_hourly_multiplier as f64) as u32)
                    .max(config.anomaly_min_hourly_threshold),
                ((avg * config.anomaly_daily_multiplier as f64) as u32)
                    .max(config.anomaly_min_daily_threshold),
            )
        }
        _ => (NEW_KEY_HOURLY_THRESHOLD, NEW_KEY_DAILY_THRESHOLD),
    }
}

/// Detect an hourly or daily volume spike against the floored thresholds.
pub fn detect_volume_anomaly(
    config: &SecurityConfig,
    avg_daily: Option<f64>,
    hourly_count: u32,
    daily_count: u32,
) -> Option<Anomaly> {
    let (hourly_threshold, daily_threshold) = volume_thresholds(config, avg_daily);

    if hourly_count > hourly_threshold && hourly_threshold > 0 {
        return Some(Anomaly::HourlySpike {
            count: hourly_count,
            threshold: hourly_threshold,
        });
    }

    if daily_count > daily_threshold && daily_threshold > 0 {
        return Some(Anomaly::DailySpike {
            count: daily_count,
            threshold: daily_threshold,
        });
    }

    None
}

/// Detect an error-rate anomaly once the hour has enough traffic to judge.
pub fn detect_error_anomaly(
    config: &SecurityConfig,
    hourly_count: u32,
    error_count: u32,
) -> Option<Anomaly> {
    if hourly_count < config.anomaly_min_requests || hourly_count == 0 {
        return None;
    }

    let error_rate = error_count as f32 / hourly_count as f32;
    if error_rate > config.anomaly_error_rate_threshold {
        return Some(Anomaly::ErrorRate {
            errors: error_count,
            requests: hourly_count,
        });
    }

    None
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

    // Get 7-day baseline (active days only — see avg_daily_requests)
    let avg_daily = ApiKeyUsageDaily::avg_daily_requests(pool, key_id)
        .await
        .unwrap_or(None);

    if let Some(anomaly) = detect_volume_anomaly(config, avg_daily, hourly_count, daily_count) {
        match volume_action(config) {
            VolumeAction::Block => {
                block_for_anomaly(pool, &key, &anomaly).await;
                return;
            }
            VolumeAction::Alert => {
                if claim_alert_marker(redis, &key_id_str, &anomaly, now).await {
                    alert_volume_anomaly(pool, &key, &anomaly).await;
                }
                // Fall through: a spiking key can still trip the error-rate
                // rule below — the actual compromise signal.
            }
        }
    }

    if hourly_count >= config.anomaly_min_requests {
        // Read error count from the hourly error counter
        let error_key = format!("quota:{}:err_h:{}", key_id_str, now.format("%Y%m%d%H"));
        let error_count: u32 = redis.get(&error_key).await.unwrap_or(0);

        if let Some(anomaly) = detect_error_anomaly(config, hourly_count, error_count) {
            block_for_anomaly(pool, &key, &anomaly).await;
        }
    }
}

/// Claim the once-per-window alert marker for a volume anomaly.
///
/// Without this, an over-threshold hour would re-alert on every 60s poll.
/// Returns `true` when this cycle owns the alert; fails open (alerts) on
/// Redis errors so a broken marker never silences the signal.
async fn claim_alert_marker(
    redis: &mut redis::aio::ConnectionManager,
    key_id: &str,
    anomaly: &Anomaly,
    now: chrono::DateTime<Utc>,
) -> bool {
    let (marker, ttl) = match anomaly {
        Anomaly::HourlySpike { .. } => (
            format!("anomaly:alerted:{}:h:{}", key_id, now.format("%Y%m%d%H")),
            ALERT_MARKER_HOURLY_TTL_SECS,
        ),
        Anomaly::DailySpike { .. } => (
            format!("anomaly:alerted:{}:d:{}", key_id, now.format("%Y%m%d")),
            ALERT_MARKER_DAILY_TTL_SECS,
        ),
        Anomaly::ErrorRate { .. } => return true,
    };

    let claimed: Result<Option<String>, redis::RedisError> = redis::cmd("SET")
        .arg(&marker)
        .arg(1)
        .arg("NX")
        .arg("EX")
        .arg(ttl)
        .query_async(redis)
        .await;

    match claimed {
        Ok(reply) => reply.is_some(),
        Err(_) => true,
    }
}

/// Record a volume anomaly without touching the key: warn log + audit entry.
pub async fn alert_volume_anomaly(pool: &PgPool, key: &ApiKey, anomaly: &Anomaly) {
    tracing::warn!(
        key_id = %key.id,
        anomaly_type = anomaly.reason(),
        detail = %anomaly.detail(),
        "Anomaly detection: volume spike (alert-only, key stays active)"
    );

    audit_service::log_action(
        pool,
        Some(key.site_id),
        None, // system action
        crate::models::audit::AuditAction::Update,
        "api_key",
        key.id,
        Some(serde_json::json!({
            "sub_action": "anomaly_volume_alert",
            "reason": anomaly.reason(),
            "detail": anomaly.detail(),
        })),
    )
    .await;
}

/// Block a key due to anomaly, log the event, and notify site admins.
pub async fn block_for_anomaly(pool: &PgPool, key: &ApiKey, anomaly: &Anomaly) {
    let reason = anomaly.reason();
    let detail = anomaly.detail();

    tracing::warn!(
        key_id = %key.id,
        anomaly_type = reason,
        detail = %detail,
        "Anomaly detection: auto-blocking API key"
    );

    if let Err(e) = ApiKey::block(pool, key.id, reason).await {
        tracing::error!(
            error = %e,
            key_id = %key.id,
            "Anomaly detection: failed to block key"
        );
        return;
    }

    audit_service::log_action(
        pool,
        Some(key.site_id),
        None, // system action
        crate::models::audit::AuditAction::Update,
        "api_key",
        key.id,
        Some(serde_json::json!({
            "sub_action": "anomaly_block",
            "reason": reason,
            "detail": detail,
        })),
    )
    .await;

    notification_service::notify_api_key_auto_blocked(
        pool,
        key.site_id,
        key.id,
        &key.name,
        &detail,
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

    #[test]
    fn thresholds_floored_for_50_per_day_baseline() {
        let config = SecurityConfig::default();
        // Naive: hourly (50/24)*5 ≈ 10, daily 50*3 = 150 — both meaningless.
        let (hourly, daily) = volume_thresholds(&config, Some(50.0));
        assert_eq!(hourly, 1000);
        assert_eq!(daily, 10000);
    }

    #[test]
    fn thresholds_floored_for_300_per_day_baseline() {
        let config = SecurityConfig::default();
        // Naive: hourly (300/24)*5 = 62, daily 300*3 = 900.
        let (hourly, daily) = volume_thresholds(&config, Some(300.0));
        assert_eq!(hourly, 1000);
        assert_eq!(daily, 10000);
    }

    #[test]
    fn thresholds_relative_wins_above_floor() {
        let config = SecurityConfig::default();
        let (hourly, daily) = volume_thresholds(&config, Some(24000.0));
        assert_eq!(hourly, 5000); // (24000/24)*5
        assert_eq!(daily, 72000); // 24000*3
    }

    #[test]
    fn thresholds_new_key_defaults_without_baseline() {
        let config = SecurityConfig::default();
        assert_eq!(
            volume_thresholds(&config, None),
            (NEW_KEY_HOURLY_THRESHOLD, NEW_KEY_DAILY_THRESHOLD)
        );
        assert_eq!(
            volume_thresholds(&config, Some(0.0)),
            (NEW_KEY_HOURLY_THRESHOLD, NEW_KEY_DAILY_THRESHOLD)
        );
    }

    #[test]
    fn low_baseline_build_burst_is_not_an_anomaly() {
        let config = SecurityConfig::default();
        // avg 50/day → naive hourly threshold 10. A few hundred requests from
        // an SSR build/deploy must not trip detection once the floor applies.
        assert_eq!(detect_volume_anomaly(&config, Some(50.0), 300, 300), None);
    }

    #[test]
    fn hourly_spike_detected_above_floor() {
        let config = SecurityConfig::default();
        assert_eq!(
            detect_volume_anomaly(&config, Some(50.0), 1500, 1500),
            Some(Anomaly::HourlySpike {
                count: 1500,
                threshold: 1000
            })
        );
    }

    #[test]
    fn daily_spike_detected_above_floor() {
        let config = SecurityConfig::default();
        assert_eq!(
            detect_volume_anomaly(&config, Some(50.0), 500, 12000),
            Some(Anomaly::DailySpike {
                count: 12000,
                threshold: 10000
            })
        );
    }

    #[test]
    fn volume_action_defaults_to_alert_only() {
        let config = SecurityConfig::default();
        assert_eq!(volume_action(&config), VolumeAction::Alert);
    }

    #[test]
    fn volume_action_blocks_when_operator_opts_in() {
        let config = SecurityConfig {
            anomaly_block_on_volume_spike: true,
            ..SecurityConfig::default()
        };
        assert_eq!(volume_action(&config), VolumeAction::Block);
    }

    #[test]
    fn error_anomaly_requires_min_requests() {
        let config = SecurityConfig::default();
        assert_eq!(detect_error_anomaly(&config, 19, 19), None);
    }

    #[test]
    fn error_anomaly_detected_above_threshold() {
        let config = SecurityConfig::default();
        assert_eq!(
            detect_error_anomaly(&config, 100, 60),
            Some(Anomaly::ErrorRate {
                errors: 60,
                requests: 100
            })
        );
    }

    #[test]
    fn error_anomaly_not_detected_at_exact_threshold() {
        let config = SecurityConfig::default();
        assert_eq!(detect_error_anomaly(&config, 100, 50), None);
    }

    #[test]
    fn anomaly_reason_and_detail_mapping() {
        let spike = Anomaly::HourlySpike {
            count: 1500,
            threshold: 1000,
        };
        assert_eq!(spike.reason(), ANOMALY_HOURLY_SPIKE);
        assert_eq!(
            spike.detail(),
            "Hourly spike: 1500 requests (threshold: 1000)"
        );

        let errors = Anomaly::ErrorRate {
            errors: 60,
            requests: 100,
        };
        assert_eq!(errors.reason(), ANOMALY_ERROR_RATE);
        assert_eq!(errors.detail(), "Error rate spike: 60% (60/100 requests)");
    }
}
