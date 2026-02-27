//! Rate limiting middleware using Redis-backed fixed-window counters
//!
//! Provides both per-API-key and per-IP rate limiting with graceful degradation
//! when Redis is unavailable.

use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use redis::AsyncCommands;

use crate::config::SecurityConfig;
use crate::errors::ApiError;

/// Per-key rate limits extracted from API key fields
#[derive(Debug, Clone)]
pub struct RateLimits {
    pub per_second: Option<i32>,
    pub per_minute: Option<i32>,
    pub per_hour: Option<i32>,
    pub per_day: Option<i32>,
}

/// Rate limit check result with info for response headers
#[derive(Debug, Clone)]
pub struct RateLimitInfo {
    /// The limit for the most restrictive window that was close to being hit
    pub limit: u32,
    /// Remaining requests in that window
    pub remaining: u32,
    /// Seconds until that window resets
    pub reset: u64,
}

/// Window definition for rate limit checks
struct Window {
    /// Name suffix for the Redis key (s, m, h, d)
    suffix: &'static str,
    /// Duration of the window in seconds
    duration: u64,
    /// Maximum requests allowed in this window
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

pub struct RateLimiter;

impl RateLimiter {
    /// Check rate limit for an API key.
    ///
    /// Returns Ok(RateLimitInfo) if the request is allowed,
    /// or Err(ApiError::RateLimited) if the limit is exceeded.
    /// On Redis errors, logs a warning and allows the request (fail-open).
    pub async fn check_key(
        redis: &mut redis::aio::ConnectionManager,
        key_id: &str,
        limits: &RateLimits,
    ) -> Result<RateLimitInfo, ApiError> {
        let identifier = format!("key:{}", key_id);
        let windows = Self::build_key_windows(limits);

        if windows.is_empty() {
            return Ok(RateLimitInfo {
                limit: 0,
                remaining: 0,
                reset: 0,
            });
        }

        Self::check_windows(redis, &identifier, &windows).await
    }

    /// Check global IP-based rate limit.
    ///
    /// Uses the per-second and per-minute limits from SecurityConfig.
    /// On Redis errors, logs a warning and allows the request (fail-open).
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

        Self::check_windows(redis, &identifier, &windows).await
    }

    /// Build window definitions from per-key rate limits
    fn build_key_windows(limits: &RateLimits) -> Vec<Window> {
        let mut windows = Vec::new();

        if let Some(limit) = limits.per_second {
            if limit > 0 {
                windows.push(Window {
                    suffix: "s",
                    duration: 1,
                    limit: limit as u32,
                });
            }
        }
        if let Some(limit) = limits.per_minute {
            if limit > 0 {
                windows.push(Window {
                    suffix: "m",
                    duration: 60,
                    limit: limit as u32,
                });
            }
        }
        if let Some(limit) = limits.per_hour {
            if limit > 0 {
                windows.push(Window {
                    suffix: "h",
                    duration: 3600,
                    limit: limit as u32,
                });
            }
        }
        if let Some(limit) = limits.per_day {
            if limit > 0 {
                windows.push(Window {
                    suffix: "d",
                    duration: 86400,
                    limit: limit as u32,
                });
            }
        }

        windows
    }

    /// Check all windows for a given identifier.
    ///
    /// Uses Redis INCR + EXPIRE (atomic, race-free fixed-window counters).
    /// Returns the most restrictive window info for response headers.
    async fn check_windows(
        redis: &mut redis::aio::ConnectionManager,
        identifier: &str,
        windows: &[Window],
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

            // INCR + conditional EXPIRE — atomic per command, race-safe
            let count: u32 = match redis.incr(&key, 1u32).await {
                Ok(c) => c,
                Err(e) => {
                    tracing::warn!(error = %e, key = %key, "Redis rate limit INCR failed, allowing request (fail-open)");
                    return Ok(RateLimitInfo {
                        limit: window.limit,
                        remaining: window.limit.saturating_sub(1),
                        reset: window.duration,
                    });
                }
            };

            // Set expiry on first increment
            if count == 1 {
                if let Err(e) = redis::cmd("EXPIRE")
                    .arg(&key)
                    .arg(ttl)
                    .query_async::<()>(redis)
                    .await
                {
                    tracing::warn!(error = %e, key = %key, "Redis EXPIRE failed");
                }
            }

            let remaining = window.limit.saturating_sub(count);
            let seconds_into_window = now % window.duration;
            let reset = window.duration - seconds_into_window;

            // Track the most restrictive (lowest remaining ratio) window
            if remaining < most_restrictive.remaining {
                most_restrictive = RateLimitInfo {
                    limit: window.limit,
                    remaining,
                    reset,
                };
            }

            // If limit exceeded, return 429 immediately
            if count > window.limit {
                return Err(ApiError::RateLimited(format!(
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

        // Normalize the edge case where no windows matched
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
    fn test_build_key_windows_all_set() {
        let limits = RateLimits {
            per_second: Some(10),
            per_minute: Some(100),
            per_hour: Some(1000),
            per_day: Some(10000),
        };
        let windows = RateLimiter::build_key_windows(&limits);
        assert_eq!(windows.len(), 4);
        assert_eq!(windows[0].suffix, "s");
        assert_eq!(windows[0].limit, 10);
        assert_eq!(windows[1].suffix, "m");
        assert_eq!(windows[1].limit, 100);
        assert_eq!(windows[2].suffix, "h");
        assert_eq!(windows[2].limit, 1000);
        assert_eq!(windows[3].suffix, "d");
        assert_eq!(windows[3].limit, 10000);
    }

    #[test]
    fn test_build_key_windows_none() {
        let limits = RateLimits {
            per_second: None,
            per_minute: None,
            per_hour: None,
            per_day: None,
        };
        let windows = RateLimiter::build_key_windows(&limits);
        assert!(windows.is_empty());
    }

    #[test]
    fn test_build_key_windows_skip_zero() {
        let limits = RateLimits {
            per_second: Some(0),
            per_minute: Some(100),
            per_hour: None,
            per_day: Some(0),
        };
        let windows = RateLimiter::build_key_windows(&limits);
        assert_eq!(windows.len(), 1);
        assert_eq!(windows[0].suffix, "m");
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
}
