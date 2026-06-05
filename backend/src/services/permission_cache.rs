//! Permission caching with Redis
//!
//! Caches resolved permission sets in Redis with configurable TTL.
//! Falls through to database query when Redis is unavailable.

use std::collections::HashSet;

use redis::AsyncCommands;
use uuid::Uuid;

use crate::services::permission_service::Permission;

/// Default TTL for permission cache entries (5 minutes).
const DEFAULT_CACHE_TTL_SECS: u64 = 300;

/// Redis key prefix for permission cache.
const CACHE_PREFIX: &str = "permissions";

/// Build the Redis key for a user's permissions on a site.
pub fn cache_key(user_id: &str, site_id: Uuid) -> String {
    format!("{}:{}:{}", CACHE_PREFIX, user_id, site_id)
}

/// Get cached permissions from Redis.
///
/// Returns `None` on cache miss or Redis error (graceful degradation).
pub async fn get(
    redis: &mut redis::aio::ConnectionManager,
    user_id: &str,
    site_id: Uuid,
) -> Option<HashSet<Permission>> {
    let key = cache_key(user_id, site_id);
    let result: Result<Option<String>, _> = redis.get(&key).await;

    match result {
        Ok(Some(json)) => serde_json::from_str::<Vec<String>>(&json)
            .ok()
            .map(|perms| {
                perms
                    .into_iter()
                    .filter_map(|s| Permission::parse(&s))
                    .collect()
            }),
        _ => None,
    }
}

/// Store permissions in Redis with TTL.
///
/// Silently fails on Redis error (fire-and-forget).
pub async fn set(
    redis: &mut redis::aio::ConnectionManager,
    user_id: &str,
    site_id: Uuid,
    permissions: &HashSet<Permission>,
) {
    let key = cache_key(user_id, site_id);
    let ttl = std::env::var("PERMISSION_CACHE_TTL_SECS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(DEFAULT_CACHE_TTL_SECS);

    let perm_strings: Vec<String> = permissions.iter().map(|p| p.as_str()).collect();
    let json = serde_json::to_string(&perm_strings).unwrap_or_default();

    let _: Result<(), _> = redis.set_ex(&key, &json, ttl).await;
}

/// Invalidate cached permissions for a user on a specific site.
pub async fn invalidate(redis: &mut redis::aio::ConnectionManager, user_id: &str, site_id: Uuid) {
    let key = cache_key(user_id, site_id);
    let _: Result<(), _> = redis.del(&key).await;
}

/// Invalidate all cached permissions for a user (all sites).
///
/// Used when system admin status changes.
pub async fn invalidate_all_for_user(redis: &mut redis::aio::ConnectionManager, user_id: &str) {
    let pattern = format!("{}:{}:*", CACHE_PREFIX, user_id);
    let keys: Result<Vec<String>, _> = redis::cmd("KEYS").arg(&pattern).query_async(redis).await;

    if let Ok(keys) = keys {
        for key in keys {
            let _: Result<(), _> = redis.del(&key).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_key_format() {
        let site_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").expect("valid uuid");
        let key = cache_key("user_2abc", site_id);
        assert_eq!(
            key,
            "permissions:user_2abc:550e8400-e29b-41d4-a716-446655440000"
        );
    }

    #[test]
    fn test_cache_key_different_users() {
        let site_id = Uuid::new_v4();
        let key1 = cache_key("user_a", site_id);
        let key2 = cache_key("user_b", site_id);
        assert_ne!(key1, key2);
    }

    #[test]
    fn test_cache_key_different_sites() {
        let site1 = Uuid::new_v4();
        let site2 = Uuid::new_v4();
        let key1 = cache_key("user_a", site1);
        let key2 = cache_key("user_a", site2);
        assert_ne!(key1, key2);
    }

    #[test]
    fn test_permission_serialization_roundtrip() {
        let mut perms = HashSet::new();
        perms.insert(Permission::new("blog", "create"));
        perms.insert(Permission::scoped("blog", "update", "own"));

        let strings: Vec<String> = perms.iter().map(|p| p.as_str()).collect();
        let json = serde_json::to_string(&strings).expect("serialize");
        let parsed: Vec<String> = serde_json::from_str(&json).expect("deserialize");
        let restored: HashSet<Permission> = parsed
            .into_iter()
            .filter_map(|s| Permission::parse(&s))
            .collect();

        assert_eq!(perms, restored);
    }
}
