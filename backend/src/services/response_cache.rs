//! Server-side response cache for high-frequency, actor-independent public
//! reads (per-site "chrome" like social links, locales, menus).
//!
//! Sits **inside** handlers, after the auth/permission check — so the API
//! key is still validated and its quota still counts. The cache only skips
//! the database/render work on a hit, cutting load during site build/crawl
//! storms that re-fetch the same per-site content on every page.
//!
//! Only cache responses that are identical for every caller of a site.
//! Anything that varies by actor/role (e.g. site context) must NOT use this.
//!
//! Freshness: a short TTL backstop plus explicit invalidation of the whole
//! `rcache:v1:{site_id}:*` namespace on any content mutation (wired into
//! `publish_pipeline::execute`). No-op when Redis is unavailable.

use std::sync::OnceLock;

use redis::AsyncCommands;
use serde::{Serialize, de::DeserializeOwned};
use uuid::Uuid;

/// Redis key prefix (versioned so the format can change without stale reads).
const CACHE_PREFIX: &str = "rcache:v1";

/// Default TTL for cached responses (60s). Backstop behind explicit
/// invalidation — short enough that a missed invalidation self-heals quickly.
const DEFAULT_TTL_SECS: u64 = 60;

/// Redis handle used for invalidation from the publish pipeline, which only
/// has a `PgPool`. Set once at startup via [`init`].
static INVALIDATION_REDIS: OnceLock<redis::aio::ConnectionManager> = OnceLock::new();

/// Register the Redis connection used for cache invalidation. Call once at
/// startup. A `None` connection (Redis unavailable) leaves invalidation as a
/// no-op, matching the rest of the stack's fail-open behavior.
pub fn init(conn: Option<redis::aio::ConnectionManager>) {
    if let Some(conn) = conn {
        let _ = INVALIDATION_REDIS.set(conn);
    }
}

/// Build the cache key for a per-site resource. `suffix` distinguishes
/// resources within a site (e.g. `"social"`, `"locales"`, `"skills"`).
pub fn key(site_id: Uuid, suffix: &str) -> String {
    format!("{CACHE_PREFIX}:{site_id}:{suffix}")
}

fn ttl_secs() -> u64 {
    std::env::var("RESPONSE_CACHE_TTL_SECS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(DEFAULT_TTL_SECS)
}

/// Return the cached value for `cache_key`, or compute it via `compute`,
/// store it with a TTL, and return it. Redis errors degrade to always
/// computing — never an error path of its own.
///
/// `T` must round-trip through JSON (serialize to store, deserialize on hit).
pub async fn cached<T, F, Fut>(
    redis: &Option<redis::aio::ConnectionManager>,
    cache_key: &str,
    compute: F,
) -> Result<T, crate::errors::ApiError>
where
    T: Serialize + DeserializeOwned,
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<T, crate::errors::ApiError>>,
{
    if let Some(conn) = redis {
        let mut conn = conn.clone();
        if let Ok(Some(json)) = conn.get::<_, Option<String>>(cache_key).await
            && let Ok(value) = serde_json::from_str::<T>(&json)
        {
            return Ok(value);
        }
    }

    let value = compute().await?;

    if let Some(conn) = redis
        && let Ok(json) = serde_json::to_string(&value)
    {
        let mut conn = conn.clone();
        let _: Result<(), _> = conn.set_ex(cache_key, json, ttl_secs()).await;
    }

    Ok(value)
}

/// Collect every cache key matching `pattern` via non-blocking `SCAN`.
/// Returns an empty vec when Redis is unavailable or on error.
async fn scan_keys(conn: &mut redis::aio::ConnectionManager, pattern: &str) -> Vec<String> {
    let mut keys = Vec::new();
    let mut cursor: u64 = 0;
    loop {
        let scan: redis::RedisResult<(u64, Vec<String>)> = redis::cmd("SCAN")
            .arg(cursor)
            .arg("MATCH")
            .arg(pattern)
            .arg("COUNT")
            .arg(200)
            .query_async(conn)
            .await;
        let Ok((next, batch)) = scan else {
            break;
        };
        keys.extend(batch);
        if next == 0 {
            break;
        }
        cursor = next;
    }
    keys
}

/// Drop every cached response for a site, returning the count removed.
pub async fn invalidate_site_counted(
    redis: &Option<redis::aio::ConnectionManager>,
    site_id: Uuid,
) -> u64 {
    let Some(conn) = redis else { return 0 };
    let mut conn = conn.clone();
    let keys = scan_keys(&mut conn, &format!("{CACHE_PREFIX}:{site_id}:*")).await;
    let count = keys.len() as u64;
    for k in keys {
        let _: redis::RedisResult<()> = conn.del(&k).await;
    }
    count
}

/// Drop every cached response for a site. Called on any content mutation so
/// edits are reflected immediately rather than waiting out the TTL.
/// Best-effort: silent on error / when Redis is down. Uses the process-global
/// Redis handle so the publish pipeline (which only has a `PgPool`) can call it.
pub async fn invalidate_site(site_id: Uuid) {
    let conn = INVALIDATION_REDIS.get().cloned();
    let _ = invalidate_site_counted(&conn, site_id).await;
}

/// Drop the entire response cache (all sites). Sysadmin-only operation.
/// Returns the number of entries removed.
pub async fn invalidate_all(redis: &Option<redis::aio::ConnectionManager>) -> u64 {
    let Some(conn) = redis else { return 0 };
    let mut conn = conn.clone();
    let keys = scan_keys(&mut conn, &format!("{CACHE_PREFIX}:*")).await;
    let count = keys.len() as u64;
    for k in keys {
        let _: redis::RedisResult<()> = conn.del(&k).await;
    }
    count
}

/// Cached resources for one site: the entry count and the resource suffixes
/// (the key part after `rcache:v1:{site_id}:`).
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct SiteCacheStats {
    pub site_id: Uuid,
    pub entry_count: u64,
    pub entries: Vec<String>,
}

/// Inspect the cache for a single site (suffixes + count).
pub async fn stats_for_site(
    redis: &Option<redis::aio::ConnectionManager>,
    site_id: Uuid,
) -> SiteCacheStats {
    let prefix = format!("{CACHE_PREFIX}:{site_id}:");
    let mut entries = match redis {
        Some(conn) => {
            let mut conn = conn.clone();
            scan_keys(&mut conn, &format!("{prefix}*"))
                .await
                .into_iter()
                .map(|k| k.strip_prefix(&prefix).unwrap_or(&k).to_string())
                .collect::<Vec<_>>()
        }
        None => Vec::new(),
    };
    entries.sort();
    SiteCacheStats {
        site_id,
        entry_count: entries.len() as u64,
        entries,
    }
}

/// Global cache summary: total entries plus a per-site count breakdown.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct GlobalCacheStats {
    pub redis_available: bool,
    pub total_entries: u64,
    /// `(site_id, entry_count)` for every site with cached entries.
    pub per_site: Vec<SiteEntryCount>,
}

#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct SiteEntryCount {
    pub site_id: String,
    pub entry_count: u64,
}

/// Inspect the whole cache, grouped by site (sysadmin view).
pub async fn stats_global(redis: &Option<redis::aio::ConnectionManager>) -> GlobalCacheStats {
    let Some(conn) = redis else {
        return GlobalCacheStats {
            redis_available: false,
            total_entries: 0,
            per_site: Vec::new(),
        };
    };
    let mut conn = conn.clone();
    let keys = scan_keys(&mut conn, &format!("{CACHE_PREFIX}:*")).await;

    let mut counts: std::collections::HashMap<String, u64> = std::collections::HashMap::new();
    for k in &keys {
        // key shape: rcache:v1:{site_id}:{suffix}
        if let Some(rest) = k.strip_prefix(&format!("{CACHE_PREFIX}:"))
            && let Some((site, _)) = rest.split_once(':')
        {
            *counts.entry(site.to_string()).or_insert(0) += 1;
        }
    }
    let mut per_site: Vec<SiteEntryCount> = counts
        .into_iter()
        .map(|(site_id, entry_count)| SiteEntryCount {
            site_id,
            entry_count,
        })
        .collect();
    per_site.sort_by_key(|s| std::cmp::Reverse(s.entry_count));

    GlobalCacheStats {
        redis_available: true,
        total_entries: keys.len() as u64,
        per_site,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_is_namespaced_by_site_and_suffix() {
        let site = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").expect("uuid");
        assert_eq!(
            key(site, "social"),
            "rcache:v1:550e8400-e29b-41d4-a716-446655440000:social"
        );
    }

    #[test]
    fn keys_differ_by_site_and_suffix() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        assert_ne!(key(a, "social"), key(b, "social"));
        assert_ne!(key(a, "social"), key(a, "locales"));
    }

    #[tokio::test]
    async fn cached_computes_when_redis_absent() {
        // No Redis configured → always computes, never caches.
        let computed = cached::<i32, _, _>(&None, "rcache:v1:test:n", || async { Ok(42) })
            .await
            .expect("compute");
        assert_eq!(computed, 42);
    }

    #[tokio::test]
    async fn stats_and_invalidate_degrade_when_redis_absent() {
        assert_eq!(invalidate_all(&None).await, 0);
        assert_eq!(invalidate_site_counted(&None, Uuid::new_v4()).await, 0);

        let site = stats_for_site(&None, Uuid::new_v4()).await;
        assert_eq!(site.entry_count, 0);
        assert!(site.entries.is_empty());

        let global = stats_global(&None).await;
        assert!(!global.redis_available);
        assert_eq!(global.total_entries, 0);
    }

    #[tokio::test]
    async fn cached_propagates_compute_error() {
        let result = cached::<i32, _, _>(&None, "rcache:v1:test:err", || async {
            Err(crate::errors::ApiError::not_found("nope"))
        })
        .await;
        assert!(result.is_err());
    }
}
