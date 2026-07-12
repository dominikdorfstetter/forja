//! Rate limiting middleware using Redis-backed fixed-window counters
//!
//! Provides both per-API-key and per-IP rate limiting with configurable
//! behavior when Redis is unavailable (fail-open or fail-closed).
//!
//! ## Quota model
//!
//! Per-key enforcement uses calendar-based quotas (hourly / daily / monthly)
//! rather than sliding-window burst limits. An internal burst cap (default
//! 100 req/s, see `RATE_LIMIT_BURST_PER_SECOND`) protects against micro-abuse.

use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use chrono::{Datelike, Timelike, Utc};
use redis::AsyncCommands;

use crate::config::{RateLimitFailMode, SecurityConfig};
use crate::errors::{ApiError, codes};

// ── Burst / legacy rate limits ─────────────────────────────────────────

/// Default per-key burst cap (requests/second). Overridable via the
/// `RATE_LIMIT_BURST_PER_SECOND` env var — raise it for sites whose static
/// builds fan out into highly-parallel request storms.
const DEFAULT_BURST_PER_SECOND: u32 = 100;

/// Resolve the per-key burst cap, honoring `RATE_LIMIT_BURST_PER_SECOND`.
fn burst_per_second() -> u32 {
    std::env::var("RATE_LIMIT_BURST_PER_SECOND")
        .ok()
        .and_then(|s| s.parse::<u32>().ok())
        .filter(|&n| n > 0)
        .unwrap_or(DEFAULT_BURST_PER_SECOND)
}

/// Rate limit check result with info for response headers
#[derive(Debug, Clone)]
pub struct RateLimitInfo {
    pub limit: u32,
    pub remaining: u32,
    pub reset: u64,
}

/// Window definition for rate limit checks
struct Window {
    suffix: &'static str,
    duration: u64,
    limit: u32,
}

/// Request-local storage for rate limit info (used for response headers).
/// Uses atomics so the value can be updated after initial `local_cache` creation.
pub struct RateLimitHeaderInfo {
    pub limit: AtomicU32,
    pub remaining: AtomicU32,
    pub reset: AtomicU64,
}

impl Default for RateLimitHeaderInfo {
    fn default() -> Self {
        Self {
            limit: AtomicU32::new(0),
            remaining: AtomicU32::new(0),
            reset: AtomicU64::new(0),
        }
    }
}

impl RateLimitHeaderInfo {
    pub fn update(&self, info: &RateLimitInfo) {
        self.limit.store(info.limit, Ordering::Relaxed);
        self.remaining.store(info.remaining, Ordering::Relaxed);
        self.reset.store(info.reset, Ordering::Relaxed);
    }
}

// ── Quota types ────────────────────────────────────────────────────────

/// Per-key quotas: consumption budgets with per-key billing cycle.
#[derive(Debug, Clone)]
pub struct QuotaLimits {
    pub hourly: Option<i32>,
    pub daily: Option<i32>,
    pub monthly: Option<i32>,
    /// Key creation timestamp — monthly quota resets on the anniversary of this date.
    pub created_at: chrono::DateTime<Utc>,
}

/// Info for one quota window (used in response headers).
#[derive(Debug, Clone)]
pub struct QuotaWindowInfo {
    pub limit: u32,
    pub used: u32,
    pub remaining: u32,
    pub reset: u64,
}

/// Aggregated quota check result — one entry per active window.
#[derive(Debug, Clone, Default)]
pub struct QuotaInfo {
    pub hourly: Option<QuotaWindowInfo>,
    pub daily: Option<QuotaWindowInfo>,
    pub monthly: Option<QuotaWindowInfo>,
}

/// Request-local storage for quota header info. Uses atomics for interior
/// mutability through `local_cache`. Stores info for up to 3 windows
/// (hourly, daily, monthly) — 4 atomics each (flag, limit, remaining, reset).
pub struct QuotaHeaderInfo {
    // Each window: [flag (1=set), limit, remaining, reset]
    pub hourly_flag: AtomicU32,
    pub hourly_limit: AtomicU32,
    pub hourly_remaining: AtomicU32,
    pub hourly_reset: AtomicU64,

    pub daily_flag: AtomicU32,
    pub daily_limit: AtomicU32,
    pub daily_remaining: AtomicU32,
    pub daily_reset: AtomicU64,

    pub monthly_flag: AtomicU32,
    pub monthly_limit: AtomicU32,
    pub monthly_remaining: AtomicU32,
    pub monthly_reset: AtomicU64,
}

impl Default for QuotaHeaderInfo {
    fn default() -> Self {
        Self {
            hourly_flag: AtomicU32::new(0),
            hourly_limit: AtomicU32::new(0),
            hourly_remaining: AtomicU32::new(0),
            hourly_reset: AtomicU64::new(0),
            daily_flag: AtomicU32::new(0),
            daily_limit: AtomicU32::new(0),
            daily_remaining: AtomicU32::new(0),
            daily_reset: AtomicU64::new(0),
            monthly_flag: AtomicU32::new(0),
            monthly_limit: AtomicU32::new(0),
            monthly_remaining: AtomicU32::new(0),
            monthly_reset: AtomicU64::new(0),
        }
    }
}

impl QuotaHeaderInfo {
    pub fn update(&self, info: &QuotaInfo) {
        if let Some(ref h) = info.hourly {
            self.hourly_flag.store(1, Ordering::Relaxed);
            self.hourly_limit.store(h.limit, Ordering::Relaxed);
            self.hourly_remaining.store(h.remaining, Ordering::Relaxed);
            self.hourly_reset.store(h.reset, Ordering::Relaxed);
        }
        if let Some(ref d) = info.daily {
            self.daily_flag.store(1, Ordering::Relaxed);
            self.daily_limit.store(d.limit, Ordering::Relaxed);
            self.daily_remaining.store(d.remaining, Ordering::Relaxed);
            self.daily_reset.store(d.reset, Ordering::Relaxed);
        }
        if let Some(ref m) = info.monthly {
            self.monthly_flag.store(1, Ordering::Relaxed);
            self.monthly_limit.store(m.limit, Ordering::Relaxed);
            self.monthly_remaining.store(m.remaining, Ordering::Relaxed);
            self.monthly_reset.store(m.reset, Ordering::Relaxed);
        }
    }
}

/// Compute the monthly billing cycle window ID and seconds until next reset.
///
/// The billing cycle starts on the day-of-month the key was created.
/// E.g., a key created on March 15 resets on April 15, May 15, etc.
/// Returns `(window_id, seconds_until_reset)`.
fn monthly_billing_cycle(
    now: chrono::DateTime<Utc>,
    created_at: chrono::DateTime<Utc>,
) -> (String, u64) {
    let creation_day = created_at.day().min(28); // Cap at 28 to avoid issues with short months

    let (cycle_start, cycle_end) = if now.day() >= creation_day {
        // We're past the anniversary day this month — cycle is this month to next
        let start = chrono::NaiveDate::from_ymd_opt(now.year(), now.month(), creation_day)
            .and_then(|d| d.and_hms_opt(0, 0, 0))
            .map(|dt| dt.and_utc())
            .unwrap_or(now);
        let (next_year, next_mon) = if now.month() == 12 {
            (now.year() + 1, 1)
        } else {
            (now.year(), now.month() + 1)
        };
        let end = chrono::NaiveDate::from_ymd_opt(next_year, next_mon, creation_day)
            .and_then(|d| d.and_hms_opt(0, 0, 0))
            .map(|dt| dt.and_utc())
            .unwrap_or(now + chrono::Duration::days(30));
        (start, end)
    } else {
        // We're before the anniversary day — cycle started last month
        let (prev_year, prev_mon) = if now.month() == 1 {
            (now.year() - 1, 12)
        } else {
            (now.year(), now.month() - 1)
        };
        let start = chrono::NaiveDate::from_ymd_opt(prev_year, prev_mon, creation_day)
            .and_then(|d| d.and_hms_opt(0, 0, 0))
            .map(|dt| dt.and_utc())
            .unwrap_or(now);
        let end = chrono::NaiveDate::from_ymd_opt(now.year(), now.month(), creation_day)
            .and_then(|d| d.and_hms_opt(0, 0, 0))
            .map(|dt| dt.and_utc())
            .unwrap_or(now + chrono::Duration::days(30));
        (start, end)
    };

    // Window ID: YYYYMMDD of cycle start (stable across the billing period)
    let window_id = cycle_start.format("%Y%m%d").to_string();
    let reset_secs = (cycle_end - now).num_seconds().max(1) as u64;

    (window_id, reset_secs)
}

// ── Rate limiter implementation ────────────────────────────────────────

pub struct RateLimiter;

impl RateLimiter {
    // ── Quota enforcement ──────────────────────────────────────────────

    /// Check calendar-based quotas for an API key.
    ///
    /// Checks hourly, daily, and monthly windows. Returns quota info for
    /// all windows (for response headers) or an error if any quota is exceeded.
    pub async fn check_quota(
        redis: &mut redis::aio::ConnectionManager,
        key_id: &str,
        quotas: &QuotaLimits,
        fail_mode: &RateLimitFailMode,
    ) -> Result<QuotaInfo, ApiError> {
        let now = Utc::now();
        let mut result = QuotaInfo::default();

        // Hourly quota
        if let Some(limit) = quotas.hourly.filter(|&l| l > 0) {
            let limit = limit as u32;
            let window_key = format!("quota:{}:h:{}", key_id, now.format("%Y%m%d%H"));
            let next_hour = now
                .with_minute(0)
                .and_then(|t| t.with_second(0))
                .and_then(|t| t.with_nanosecond(0))
                .unwrap_or(now)
                + chrono::Duration::hours(1);
            let reset_secs = (next_hour - now).num_seconds().max(1) as u64;

            match Self::incr_quota(redis, &window_key, 7200, fail_mode).await {
                Ok(count) => {
                    let remaining = limit.saturating_sub(count);
                    result.hourly = Some(QuotaWindowInfo {
                        limit,
                        used: count,
                        remaining,
                        reset: reset_secs,
                    });
                    if count > limit {
                        return Err(ApiError::rate_limited(format!(
                            "Hourly quota exceeded: {} / {} requests used",
                            count, limit
                        ))
                        .with_code(codes::QUOTA_HOURLY_EXCEEDED));
                    }
                }
                Err(e) => return Err(e),
            }
        }

        // Daily quota
        if let Some(limit) = quotas.daily.filter(|&l| l > 0) {
            let limit = limit as u32;
            let window_key = format!("quota:{}:d:{}", key_id, now.format("%Y%m%d"));
            let tomorrow = (now.date_naive() + chrono::Duration::days(1))
                .and_hms_opt(0, 0, 0)
                .map(|dt| dt.and_utc())
                .unwrap_or(now);
            let reset_secs = (tomorrow - now).num_seconds().max(1) as u64;

            match Self::incr_quota(redis, &window_key, 172800, fail_mode).await {
                Ok(count) => {
                    let remaining = limit.saturating_sub(count);
                    result.daily = Some(QuotaWindowInfo {
                        limit,
                        used: count,
                        remaining,
                        reset: reset_secs,
                    });
                    if count > limit {
                        return Err(ApiError::rate_limited(format!(
                            "Daily quota exceeded: {} / {} requests used",
                            count, limit
                        ))
                        .with_code(codes::QUOTA_DAILY_EXCEEDED));
                    }
                }
                Err(e) => return Err(e),
            }
        }

        // Monthly quota (per-key billing cycle based on created_at)
        if let Some(limit) = quotas.monthly.filter(|&l| l > 0) {
            let limit = limit as u32;
            let (cycle_id, reset_secs) = monthly_billing_cycle(now, quotas.created_at);
            let window_key = format!("quota:{}:M:{}", key_id, cycle_id);

            // TTL: 32 days covers the longest month
            match Self::incr_quota(redis, &window_key, 2764800, fail_mode).await {
                Ok(count) => {
                    let remaining = limit.saturating_sub(count);
                    result.monthly = Some(QuotaWindowInfo {
                        limit,
                        used: count,
                        remaining,
                        reset: reset_secs,
                    });
                    if count > limit {
                        return Err(ApiError::rate_limited(format!(
                            "Monthly quota exceeded: {} / {} requests used",
                            count, limit
                        ))
                        .with_code(codes::QUOTA_MONTHLY_EXCEEDED));
                    }
                }
                Err(e) => return Err(e),
            }
        }

        Ok(result)
    }

    /// Read current quota counters from Redis without incrementing.
    /// Used by the usage summary endpoint. Returns `None` quotas if Redis
    /// is unavailable (graceful degradation).
    pub async fn read_quota(
        redis: &mut redis::aio::ConnectionManager,
        key_id: &str,
        quotas: &QuotaLimits,
    ) -> QuotaInfo {
        let now = Utc::now();
        let mut result = QuotaInfo::default();

        if let Some(limit) = quotas.hourly.filter(|&l| l > 0) {
            let limit = limit as u32;
            let window_key = format!("quota:{}:h:{}", key_id, now.format("%Y%m%d%H"));
            let next_hour = now
                .with_minute(0)
                .and_then(|t| t.with_second(0))
                .and_then(|t| t.with_nanosecond(0))
                .unwrap_or(now)
                + chrono::Duration::hours(1);
            let reset_secs = (next_hour - now).num_seconds().max(1) as u64;
            let used: u32 = redis.get(&window_key).await.unwrap_or(0);
            result.hourly = Some(QuotaWindowInfo {
                limit,
                used,
                remaining: limit.saturating_sub(used),
                reset: reset_secs,
            });
        }

        if let Some(limit) = quotas.daily.filter(|&l| l > 0) {
            let limit = limit as u32;
            let window_key = format!("quota:{}:d:{}", key_id, now.format("%Y%m%d"));
            let tomorrow = (now.date_naive() + chrono::Duration::days(1))
                .and_hms_opt(0, 0, 0)
                .map(|dt| dt.and_utc())
                .unwrap_or(now);
            let reset_secs = (tomorrow - now).num_seconds().max(1) as u64;
            let used: u32 = redis.get(&window_key).await.unwrap_or(0);
            result.daily = Some(QuotaWindowInfo {
                limit,
                used,
                remaining: limit.saturating_sub(used),
                reset: reset_secs,
            });
        }

        if let Some(limit) = quotas.monthly.filter(|&l| l > 0) {
            let limit = limit as u32;
            let (cycle_id, reset_secs) = monthly_billing_cycle(now, quotas.created_at);
            let window_key = format!("quota:{}:M:{}", key_id, cycle_id);
            let used: u32 = redis.get(&window_key).await.unwrap_or(0);
            result.monthly = Some(QuotaWindowInfo {
                limit,
                used,
                remaining: limit.saturating_sub(used),
                reset: reset_secs,
            });
        }

        result
    }

    /// Increment a quota counter in Redis. Returns the new count.
    async fn incr_quota(
        redis: &mut redis::aio::ConnectionManager,
        key: &str,
        ttl_secs: i64,
        fail_mode: &RateLimitFailMode,
    ) -> Result<u32, ApiError> {
        let count: u32 = match redis.incr(key, 1u32).await {
            Ok(c) => c,
            Err(e) => {
                return match fail_mode {
                    RateLimitFailMode::Open => {
                        tracing::warn!(error = %e, key = %key, "Redis quota INCR failed (fail-open)");
                        Ok(0) // Assume zero usage — allow the request
                    }
                    RateLimitFailMode::Closed => {
                        tracing::error!(error = %e, key = %key, "Redis quota INCR failed (fail-closed)");
                        Err(ApiError::rate_limited(
                            "Quota tracking unavailable — requests blocked (fail-closed mode)"
                                .to_string(),
                        ))
                    }
                };
            }
        };

        // Set TTL on first increment
        if count == 1
            && let Err(e) = redis::cmd("EXPIRE")
                .arg(key)
                .arg(ttl_secs)
                .query_async::<()>(redis)
                .await
        {
            tracing::warn!(error = %e, key = %key, "Redis quota EXPIRE failed");
        }

        Ok(count)
    }

    // ── Burst protection ───────────────────────────────────────────────

    /// Resolve the effective per-second burst cap: a positive per-key override
    /// when configured, else the global default (`RATE_LIMIT_BURST_PER_SECOND`,
    /// default 100). A non-positive override falls back to the global default.
    fn resolve_burst_cap(per_key: Option<u32>) -> u32 {
        per_key.filter(|&c| c > 0).unwrap_or_else(burst_per_second)
    }

    /// Internal burst protection: per-key requests/second cap. Defaults to the
    /// global `RATE_LIMIT_BURST_PER_SECOND` (100); `per_key_cap` raises or lowers
    /// it for a specific key (sourced from the key's `rate_limit_per_second`).
    ///
    /// **SSR fan-out:** a single server-side render that fans out to more than
    /// the cap's worth of API calls inside one second is rejected. Raise the
    /// owning key's per-second cap to cover the page's worst-case fan-out (the
    /// window is a fixed 1 second, so the cap must exceed the peak burst, not
    /// the average rate).
    pub async fn check_burst(
        redis: &mut redis::aio::ConnectionManager,
        key_id: &str,
        per_key_cap: Option<u32>,
        fail_mode: &RateLimitFailMode,
    ) -> Result<(), ApiError> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let window_id = now; // 1-second window
        let key = format!("rl:burst:{}:{}", key_id, window_id);

        let count: u32 = match redis.incr(&key, 1u32).await {
            Ok(c) => c,
            Err(e) => {
                return match fail_mode {
                    RateLimitFailMode::Open => {
                        tracing::warn!(error = %e, "Redis burst check failed (fail-open)");
                        Ok(())
                    }
                    RateLimitFailMode::Closed => {
                        tracing::error!(error = %e, "Redis burst check failed (fail-closed)");
                        Err(ApiError::rate_limited(
                            "Rate limiting unavailable — requests blocked".to_string(),
                        ))
                    }
                };
            }
        };

        if count == 1 {
            let _ = redis::cmd("EXPIRE")
                .arg(&key)
                .arg(2i64)
                .query_async::<()>(redis)
                .await;
        }

        let burst_cap = Self::resolve_burst_cap(per_key_cap);
        if count > burst_cap {
            return Err(ApiError::rate_limited(format!(
                "Burst limit exceeded: {} requests/second (limit: {})",
                count, burst_cap
            ))
            .with_code(codes::RATE_LIMIT_BURST_EXCEEDED));
        }

        Ok(())
    }

    // ── IP-based rate limiting ─────────────────────────────────────────

    /// Check global IP-based rate limit.
    pub async fn check_ip(
        redis: &mut redis::aio::ConnectionManager,
        ip: &str,
        config: &SecurityConfig,
    ) -> Result<RateLimitInfo, ApiError> {
        let identifier = format!("ip:{}", ip);
        let windows = vec![
            Window {
                suffix: "s",
                duration: 1,
                limit: config.rate_limit_per_second,
            },
            Window {
                suffix: "m",
                duration: 60,
                limit: config.rate_limit_per_minute,
            },
        ];

        Self::check_windows(redis, &identifier, &windows, &config.rate_limit_fail_mode).await
    }

    async fn check_windows(
        redis: &mut redis::aio::ConnectionManager,
        identifier: &str,
        windows: &[Window],
        fail_mode: &RateLimitFailMode,
    ) -> Result<RateLimitInfo, ApiError> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let mut most_restrictive = RateLimitInfo {
            limit: u32::MAX,
            remaining: u32::MAX,
            reset: 0,
        };

        for window in windows {
            let window_id = now / window.duration;
            let key = format!("rl:{}:{}:{}", identifier, window.suffix, window_id);
            let ttl = window.duration as i64;

            let count: u32 = match redis.incr(&key, 1u32).await {
                Ok(c) => c,
                Err(e) => {
                    return match fail_mode {
                        RateLimitFailMode::Open => {
                            tracing::warn!(error = %e, key = %key, "Redis rate limit INCR failed, allowing request (fail-open)");
                            Ok(RateLimitInfo {
                                limit: window.limit,
                                remaining: window.limit.saturating_sub(1),
                                reset: window.duration,
                            })
                        }
                        RateLimitFailMode::Closed => {
                            tracing::error!(error = %e, key = %key, "Redis rate limit INCR failed, rejecting request (fail-closed)");
                            Err(ApiError::rate_limited(
                                "Rate limiting unavailable — requests blocked (fail-closed mode)"
                                    .to_string(),
                            ))
                        }
                    };
                }
            };

            if count == 1
                && let Err(e) = redis::cmd("EXPIRE")
                    .arg(&key)
                    .arg(ttl)
                    .query_async::<()>(redis)
                    .await
            {
                tracing::warn!(error = %e, key = %key, "Redis EXPIRE failed");
            }

            let remaining = window.limit.saturating_sub(count);
            let seconds_into_window = now % window.duration;
            let reset = window.duration - seconds_into_window;

            if remaining < most_restrictive.remaining {
                most_restrictive = RateLimitInfo {
                    limit: window.limit,
                    remaining,
                    reset,
                };
            }

            if count > window.limit {
                return Err(ApiError::rate_limited(format!(
                    "Rate limit exceeded: {} requests per {} exceeded (limit: {})",
                    count,
                    match window.suffix {
                        "s" => "second",
                        "m" => "minute",
                        "h" => "hour",
                        "d" => "day",
                        _ => "window",
                    },
                    window.limit
                )));
            }
        }

        if most_restrictive.remaining == u32::MAX {
            most_restrictive = RateLimitInfo {
                limit: 0,
                remaining: 0,
                reset: 0,
            };
        }

        Ok(most_restrictive)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_burst_cap_prefers_positive_per_key_override() {
        // A raised per-key cap is honoured (SSR fan-out can be accommodated).
        assert_eq!(RateLimiter::resolve_burst_cap(Some(500)), 500);
    }

    #[test]
    #[serial_test::serial]
    fn resolve_burst_cap_falls_back_to_default() {
        // No override, or a non-positive one, uses the global default.
        // `#[serial]` so it never races `test_burst_per_second_env_override`,
        // which set_var's RATE_LIMIT_BURST_PER_SECOND process-wide.
        assert_eq!(
            RateLimiter::resolve_burst_cap(None),
            DEFAULT_BURST_PER_SECOND
        );
        assert_eq!(
            RateLimiter::resolve_burst_cap(Some(0)),
            DEFAULT_BURST_PER_SECOND
        );
    }

    #[test]
    fn test_rate_limit_info_defaults() {
        let info = RateLimitInfo {
            limit: 100,
            remaining: 95,
            reset: 30,
        };
        assert_eq!(info.limit, 100);
        assert_eq!(info.remaining, 95);
        assert_eq!(info.reset, 30);
    }

    #[test]
    fn test_quota_limits_default_values() {
        let quotas = QuotaLimits {
            hourly: Some(1000),
            daily: Some(10000),
            monthly: Some(100000),
            created_at: Utc::now(),
        };
        assert_eq!(quotas.hourly, Some(1000));
        assert_eq!(quotas.daily, Some(10000));
        assert_eq!(quotas.monthly, Some(100000));
    }

    #[test]
    fn test_quota_info_default_empty() {
        let info = QuotaInfo::default();
        assert!(info.hourly.is_none());
        assert!(info.daily.is_none());
        assert!(info.monthly.is_none());
    }

    #[test]
    fn test_quota_window_info_remaining() {
        let window = QuotaWindowInfo {
            limit: 1000,
            used: 342,
            remaining: 658,
            reset: 1800,
        };
        assert_eq!(window.limit - window.used, window.remaining);
    }

    #[test]
    fn test_quota_header_info_update() {
        let header = QuotaHeaderInfo::default();
        let info = QuotaInfo {
            hourly: Some(QuotaWindowInfo {
                limit: 1000,
                used: 500,
                remaining: 500,
                reset: 1800,
            }),
            daily: Some(QuotaWindowInfo {
                limit: 10000,
                used: 3000,
                remaining: 7000,
                reset: 43200,
            }),
            monthly: None,
        };
        header.update(&info);

        assert_eq!(header.hourly_flag.load(Ordering::Relaxed), 1);
        assert_eq!(header.hourly_limit.load(Ordering::Relaxed), 1000);
        assert_eq!(header.hourly_remaining.load(Ordering::Relaxed), 500);

        assert_eq!(header.daily_flag.load(Ordering::Relaxed), 1);
        assert_eq!(header.daily_limit.load(Ordering::Relaxed), 10000);

        assert_eq!(header.monthly_flag.load(Ordering::Relaxed), 0); // Not set
    }

    #[test]
    fn test_burst_per_second_default() {
        assert_eq!(DEFAULT_BURST_PER_SECOND, 100);
    }

    #[test]
    #[serial_test::serial]
    fn test_burst_per_second_env_override() {
        // SAFETY: #[serial] test — no concurrent env reads or writes.
        unsafe { std::env::set_var("RATE_LIMIT_BURST_PER_SECOND", "5000") };
        assert_eq!(burst_per_second(), 5000);
        // SAFETY: #[serial] test — no concurrent env reads or writes.
        unsafe { std::env::remove_var("RATE_LIMIT_BURST_PER_SECOND") };
        assert_eq!(burst_per_second(), DEFAULT_BURST_PER_SECOND);
    }

    #[test]
    fn test_monthly_billing_cycle_after_creation_day() {
        // Key created March 15, now is March 22 → cycle is Mar 15 to Apr 15
        let created = chrono::NaiveDate::from_ymd_opt(2026, 3, 15)
            .unwrap()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc();
        let now = chrono::NaiveDate::from_ymd_opt(2026, 3, 22)
            .unwrap()
            .and_hms_opt(12, 0, 0)
            .unwrap()
            .and_utc();
        let (window_id, reset_secs) = monthly_billing_cycle(now, created);
        assert_eq!(window_id, "20260315"); // Cycle started March 15
        // Reset should be ~23.5 days (Apr 15 - Mar 22 12:00)
        let days = reset_secs as f64 / 86400.0;
        assert!(days > 23.0 && days < 24.0, "Expected ~23.5d, got {days}");
    }

    #[test]
    fn test_monthly_billing_cycle_before_creation_day() {
        // Key created March 20, now is April 10 → cycle is Mar 20 to Apr 20
        let created = chrono::NaiveDate::from_ymd_opt(2026, 3, 20)
            .unwrap()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc();
        let now = chrono::NaiveDate::from_ymd_opt(2026, 4, 10)
            .unwrap()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc();
        let (window_id, reset_secs) = monthly_billing_cycle(now, created);
        assert_eq!(window_id, "20260320"); // Cycle started March 20
        let days = reset_secs as f64 / 86400.0;
        assert!(days > 9.0 && days < 11.0, "Expected ~10d, got {days}");
    }

    #[test]
    fn test_monthly_billing_cycle_december_boundary() {
        // Key created Dec 10, now is Dec 25 → cycle is Dec 10 to Jan 10
        let created = chrono::NaiveDate::from_ymd_opt(2025, 12, 10)
            .unwrap()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc();
        let now = chrono::NaiveDate::from_ymd_opt(2025, 12, 25)
            .unwrap()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc();
        let (window_id, reset_secs) = monthly_billing_cycle(now, created);
        assert_eq!(window_id, "20251210");
        let days = reset_secs as f64 / 86400.0;
        assert!(days > 15.0 && days < 17.0, "Expected ~16d, got {days}");
    }

    #[test]
    fn test_monthly_billing_cycle_creation_day_31_capped() {
        // Key created on 31st → capped to 28th to avoid short-month issues
        let created = chrono::NaiveDate::from_ymd_opt(2026, 1, 31)
            .unwrap()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc();
        let now = chrono::NaiveDate::from_ymd_opt(2026, 2, 15)
            .unwrap()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc();
        let (window_id, reset_secs) = monthly_billing_cycle(now, created);
        // Capped to 28th, so cycle is Jan 28 to Feb 28
        assert_eq!(window_id, "20260128");
        let days = reset_secs as f64 / 86400.0;
        assert!(days > 12.0 && days < 14.0, "Expected ~13d, got {days}");
    }
}
