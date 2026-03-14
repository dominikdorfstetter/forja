//! Block models — instance and actor blocklists

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use url::Url;
use uuid::Uuid;

use crate::errors::ApiError;

/// A blocked instance domain for a local actor.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ApBlockedInstance {
    pub id: Uuid,
    pub actor_id: Uuid,
    pub instance_domain: String,
    pub reason: Option<String>,
    pub blocked_at: DateTime<Utc>,
}

/// A blocked remote actor URI for a local actor.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ApBlockedActor {
    pub id: Uuid,
    pub actor_id: Uuid,
    pub blocked_actor_uri: String,
    pub reason: Option<String>,
    pub blocked_at: DateTime<Utc>,
}

/// Extract the domain (host) from an actor URI.
pub fn extract_domain(uri: &str) -> Option<String> {
    Url::parse(uri)
        .ok()
        .and_then(|u| u.host_str().map(|h| h.to_string()))
}

impl ApBlockedInstance {
    /// List all blocked instances for an actor.
    pub async fn find_by_actor(pool: &PgPool, actor_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let blocked = sqlx::query_as::<_, Self>(
            "SELECT * FROM ap_blocked_instances WHERE actor_id = $1 ORDER BY blocked_at DESC",
        )
        .bind(actor_id)
        .fetch_all(pool)
        .await?;

        Ok(blocked)
    }

    /// Block an instance domain.
    pub async fn create(
        pool: &PgPool,
        actor_id: Uuid,
        instance_domain: &str,
        reason: Option<&str>,
    ) -> Result<Self, ApiError> {
        let blocked = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO ap_blocked_instances (actor_id, instance_domain, reason)
            VALUES ($1, $2, $3)
            ON CONFLICT (actor_id, instance_domain) DO UPDATE SET
                reason = EXCLUDED.reason
            RETURNING *
            "#,
        )
        .bind(actor_id)
        .bind(instance_domain)
        .bind(reason)
        .fetch_one(pool)
        .await?;

        Ok(blocked)
    }

    /// Unblock an instance domain.
    pub async fn delete(
        pool: &PgPool,
        actor_id: Uuid,
        instance_domain: &str,
    ) -> Result<(), ApiError> {
        sqlx::query(
            "DELETE FROM ap_blocked_instances WHERE actor_id = $1 AND instance_domain = $2",
        )
        .bind(actor_id)
        .bind(instance_domain)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Bulk-block a list of instance domains. Skips duplicates via ON CONFLICT DO NOTHING.
    /// Returns the count of actually inserted rows.
    pub async fn bulk_block_instances(
        pool: &PgPool,
        actor_id: Uuid,
        domains: &[String],
    ) -> Result<usize, ApiError> {
        if domains.is_empty() {
            return Ok(0);
        }

        let result = sqlx::query(
            r#"
            INSERT INTO ap_blocked_instances (actor_id, instance_domain)
            SELECT $1, unnest($2::text[])
            ON CONFLICT (actor_id, instance_domain) DO NOTHING
            "#,
        )
        .bind(actor_id)
        .bind(domains)
        .execute(pool)
        .await?;

        Ok(result.rows_affected() as usize)
    }

    /// Check whether a given domain is blocked for an actor.
    pub async fn is_instance_blocked(
        pool: &PgPool,
        actor_id: Uuid,
        domain: &str,
    ) -> Result<bool, ApiError> {
        let exists: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM ap_blocked_instances
                WHERE actor_id = $1 AND instance_domain = $2
            )
            "#,
        )
        .bind(actor_id)
        .bind(domain)
        .fetch_one(pool)
        .await?;

        Ok(exists)
    }
}

impl ApBlockedActor {
    /// List all blocked actors for a local actor.
    pub async fn find_by_actor(pool: &PgPool, actor_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let blocked = sqlx::query_as::<_, Self>(
            "SELECT * FROM ap_blocked_actors WHERE actor_id = $1 ORDER BY blocked_at DESC",
        )
        .bind(actor_id)
        .fetch_all(pool)
        .await?;

        Ok(blocked)
    }

    /// Block a remote actor.
    pub async fn create(
        pool: &PgPool,
        actor_id: Uuid,
        blocked_actor_uri: &str,
        reason: Option<&str>,
    ) -> Result<Self, ApiError> {
        let blocked = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO ap_blocked_actors (actor_id, blocked_actor_uri, reason)
            VALUES ($1, $2, $3)
            ON CONFLICT (actor_id, blocked_actor_uri) DO UPDATE SET
                reason = EXCLUDED.reason
            RETURNING *
            "#,
        )
        .bind(actor_id)
        .bind(blocked_actor_uri)
        .bind(reason)
        .fetch_one(pool)
        .await?;

        Ok(blocked)
    }

    /// Unblock a remote actor.
    pub async fn delete(
        pool: &PgPool,
        actor_id: Uuid,
        blocked_actor_uri: &str,
    ) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM ap_blocked_actors WHERE actor_id = $1 AND blocked_actor_uri = $2")
            .bind(actor_id)
            .bind(blocked_actor_uri)
            .execute(pool)
            .await?;

        Ok(())
    }

    /// Check whether a given remote actor URI is blocked.
    pub async fn is_actor_blocked(
        pool: &PgPool,
        actor_id: Uuid,
        actor_uri: &str,
    ) -> Result<bool, ApiError> {
        let exists: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM ap_blocked_actors
                WHERE actor_id = $1 AND blocked_actor_uri = $2
            )
            "#,
        )
        .bind(actor_id)
        .bind(actor_uri)
        .fetch_one(pool)
        .await?;

        Ok(exists)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_domain() {
        assert_eq!(
            extract_domain("https://mastodon.social/users/alice"),
            Some("mastodon.social".to_string())
        );
        assert_eq!(
            extract_domain("https://example.com:8443/actor"),
            Some("example.com".to_string())
        );
        assert_eq!(extract_domain("not-a-url"), None);
    }

    #[test]
    fn test_extract_domain_ip_address() {
        assert_eq!(
            extract_domain("https://192.168.1.1/actor"),
            Some("192.168.1.1".to_string())
        );
    }

    #[test]
    fn test_extract_domain_subdomain() {
        assert_eq!(
            extract_domain("https://social.example.co.uk/users/bob"),
            Some("social.example.co.uk".to_string())
        );
    }
}
