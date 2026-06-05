//! Auth brute-force rate limiting: per-IP failure tracking for auth endpoints.
//!
//! The general rate limiter (`rate_limit.rs`) applies global IP-based windows
//! (50 req/s, 500 req/min) regardless of path. This module adds a dedicated
//! failure-aware counter on auth routes (`/api/v1/auth/*`) so that repeated
//! 401/403 responses from the same IP trigger progressive backpressure before
//! the global limits kick in.
//!
//! ## Operation
//!
//! - **Pre-check** (before handler): if the Redis counter for this IP is at or
//!   above `auth_rate_limit_max_failures`, the middleware short-circuits with
//!   429 (Too Many Requests).
//! - **Post-check** (after handler): if the response status is 401 or 403, the
//!   counter is incremented with a TTL of `auth_rate_limit_window_seconds`.
//!   Successful requests (2xx) do not affect the counter.
//! - **No Redis**: fail-open — all requests pass through. This matches the
//!   behaviour of the other rate-limiting middleware when Redis is unavailable.

use redis::AsyncCommands;

use crate::config::SecurityConfig;
use crate::errors::ApiError;

/// Classify a path as an auth endpoint subject to brute-force rate limiting.
///
/// Single source of truth — add new auth paths here when the auth router grows.
pub fn is_auth_path(path: &str) -> bool {
    path.starts_with("/api/v1/auth/")
}

pub struct AuthRateLimiter;

impl AuthRateLimiter {
    /// Pre-handler check: returns `Err` if the IP has exceeded either the
    /// primary failure threshold or the ban threshold. Call before delegating
    /// to the handler.
    pub async fn check_auth_limit(
        redis: &mut redis::aio::ConnectionManager,
        ip: &str,
        config: &SecurityConfig,
    ) -> Result<(), ApiError> {
        // Primary tier: N failures in the auth window
        let key = auth_failures_key(ip);
        let count: u32 = redis.get(&key).await.unwrap_or(0);

        if count >= config.auth_rate_limit_max_failures {
            return Err(ApiError::rate_limited(format!(
                "Too many failed authentication attempts from your IP — wait {} seconds before retrying",
                config.auth_rate_limit_window_seconds,
            ))
            .with_code(crate::errors::codes::AUTH_RATE_LIMITED));
        }

        // Ban tier (longer window, higher threshold) — only if enabled
        if config.auth_rate_limit_ban_max_failures > 0 {
            let ban_key = auth_failures_ban_key(ip);
            let ban_count: u32 = redis.get(&ban_key).await.unwrap_or(0);

            if ban_count >= config.auth_rate_limit_ban_max_failures {
                return Err(ApiError::rate_limited(format!(
                    "Too many failed authentication attempts — your IP is temporarily blocked for {} seconds",
                    config.auth_rate_limit_ban_window_seconds,
                ))
                .with_code(crate::errors::codes::AUTH_RATE_LIMITED));
            }
        }

        Ok(())
    }

    /// Post-handler: record a failure if the handler responded 401 or 403.
    /// Increments both the primary counter and the ban-tier counter.
    /// Call after `next.run(req).await`.
    pub async fn record_failure(
        redis: &mut redis::aio::ConnectionManager,
        ip: &str,
        config: &SecurityConfig,
        status: u16,
    ) {
        if status != 401 && status != 403 {
            return;
        }

        let key = auth_failures_key(ip);
        let ttl = config.auth_rate_limit_window_seconds as i64;

        // Primary counter: INCR + EXPIRE
        let _: Result<(), redis::RedisError> = redis::pipe()
            .cmd("INCR")
            .arg(&key)
            .ignore()
            .cmd("EXPIRE")
            .arg(&key)
            .arg(ttl)
            .ignore()
            .query_async(redis)
            .await;

        // Ban-tier counter (only if enabled)
        if config.auth_rate_limit_ban_max_failures > 0 {
            let ban_key = auth_failures_ban_key(ip);
            let ban_ttl = config.auth_rate_limit_ban_window_seconds as i64;

            let _: Result<(), redis::RedisError> = redis::pipe()
                .cmd("INCR")
                .arg(&ban_key)
                .ignore()
                .cmd("EXPIRE")
                .arg(&ban_key)
                .arg(ban_ttl)
                .ignore()
                .query_async(redis)
                .await;
        }
    }
}

fn auth_failures_key(ip: &str) -> String {
    format!("auth_fail:{}", ip)
}

fn auth_failures_ban_key(ip: &str) -> String {
    format!("auth_fail_ban:{}", ip)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auth_path_prefix_match() {
        assert!(is_auth_path("/api/v1/auth/me"));
        assert!(is_auth_path("/api/v1/auth/guest"));
        assert!(is_auth_path("/api/v1/auth/profile"));
        assert!(is_auth_path("/api/v1/auth/account"));
        assert!(is_auth_path("/api/v1/auth/help-state/reset"));
    }

    #[test]
    fn non_auth_paths_excluded() {
        assert!(!is_auth_path("/api/v1/sites"));
        assert!(!is_auth_path("/api/v1/blogs"));
        assert!(!is_auth_path("/health"));
        assert!(!is_auth_path("/api/v1/auth")); // exact match (no trailing /)
        assert!(!is_auth_path("/api/v1/author"));
    }

    #[test]
    fn auth_failures_key_format() {
        assert_eq!(auth_failures_key("192.168.1.1"), "auth_fail:192.168.1.1");
        assert_eq!(auth_failures_key("::1"), "auth_fail:::1");
    }

    #[test]
    fn auth_failures_ban_key_format() {
        assert_eq!(auth_failures_ban_key("10.0.0.1"), "auth_fail_ban:10.0.0.1");
    }
}
