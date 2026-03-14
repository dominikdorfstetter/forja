//! ApFollower model — remote followers of a local actor

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;

use super::types::ApFollowerStatus;

/// A remote follower of a local ActivityPub actor.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ApFollower {
    pub id: Uuid,
    pub actor_id: Uuid,
    pub follower_actor_uri: String,
    pub follower_inbox_uri: String,
    pub follower_shared_inbox_uri: Option<String>,
    pub display_name: Option<String>,
    pub username: Option<String>,
    pub avatar_url: Option<String>,
    pub status: ApFollowerStatus,
    pub followed_at: DateTime<Utc>,
}

/// A delivery target inbox, possibly shared across multiple followers.
#[derive(Debug, Clone, PartialEq)]
pub struct DeliveryTarget {
    pub inbox_uri: String,
    pub is_shared: bool,
}

/// Deduplicate followers into delivery targets. Shared inboxes are used when
/// available; followers without a shared inbox fall back to their individual inbox.
pub fn delivery_targets(followers: &[ApFollower]) -> Vec<DeliveryTarget> {
    use std::collections::HashSet;

    let mut seen = HashSet::new();
    let mut targets = Vec::new();

    // First pass: collect unique shared inboxes
    for f in followers {
        if let Some(shared) = &f.follower_shared_inbox_uri {
            if seen.insert(shared.clone()) {
                targets.push(DeliveryTarget {
                    inbox_uri: shared.clone(),
                    is_shared: true,
                });
            }
        }
    }

    // Second pass: add individual inboxes for followers without a shared inbox
    for f in followers {
        if f.follower_shared_inbox_uri.is_none() && seen.insert(f.follower_inbox_uri.clone()) {
            targets.push(DeliveryTarget {
                inbox_uri: f.follower_inbox_uri.clone(),
                is_shared: false,
            });
        }
    }

    targets
}

impl ApFollower {
    /// Find all accepted followers for an actor.
    pub async fn find_by_actor(pool: &PgPool, actor_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let followers = sqlx::query_as::<_, Self>(
            r#"
            SELECT * FROM ap_followers
            WHERE actor_id = $1 AND status = 'accepted'
            ORDER BY followed_at DESC
            "#,
        )
        .bind(actor_id)
        .fetch_all(pool)
        .await?;

        Ok(followers)
    }

    /// Count accepted followers for an actor.
    pub async fn count_by_actor(pool: &PgPool, actor_id: Uuid) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM ap_followers WHERE actor_id = $1 AND status = 'accepted'",
        )
        .bind(actor_id)
        .fetch_one(pool)
        .await?;

        Ok(row.0)
    }

    /// Upsert a follower: insert or update on conflict.
    #[allow(clippy::too_many_arguments)]
    pub async fn upsert(
        pool: &PgPool,
        actor_id: Uuid,
        follower_actor_uri: &str,
        follower_inbox_uri: &str,
        follower_shared_inbox_uri: Option<&str>,
        display_name: Option<&str>,
        username: Option<&str>,
        avatar_url: Option<&str>,
        status: ApFollowerStatus,
    ) -> Result<Self, ApiError> {
        let follower = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO ap_followers (
                actor_id, follower_actor_uri, follower_inbox_uri,
                follower_shared_inbox_uri, display_name, username, avatar_url, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (actor_id, follower_actor_uri) DO UPDATE SET
                follower_inbox_uri = EXCLUDED.follower_inbox_uri,
                follower_shared_inbox_uri = EXCLUDED.follower_shared_inbox_uri,
                display_name = EXCLUDED.display_name,
                username = EXCLUDED.username,
                avatar_url = EXCLUDED.avatar_url,
                status = EXCLUDED.status
            RETURNING *
            "#,
        )
        .bind(actor_id)
        .bind(follower_actor_uri)
        .bind(follower_inbox_uri)
        .bind(follower_shared_inbox_uri)
        .bind(display_name)
        .bind(username)
        .bind(avatar_url)
        .bind(status)
        .fetch_one(pool)
        .await?;

        Ok(follower)
    }

    /// Remove a follower by actor URI.
    pub async fn remove(
        pool: &PgPool,
        actor_id: Uuid,
        follower_actor_uri: &str,
    ) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM ap_followers WHERE actor_id = $1 AND follower_actor_uri = $2")
            .bind(actor_id)
            .bind(follower_actor_uri)
            .execute(pool)
            .await?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_follower(actor_uri: &str, inbox: &str, shared_inbox: Option<&str>) -> ApFollower {
        ApFollower {
            id: Uuid::new_v4(),
            actor_id: Uuid::new_v4(),
            follower_actor_uri: actor_uri.to_string(),
            follower_inbox_uri: inbox.to_string(),
            follower_shared_inbox_uri: shared_inbox.map(|s| s.to_string()),
            display_name: None,
            username: None,
            avatar_url: None,
            status: ApFollowerStatus::Accepted,
            followed_at: Utc::now(),
        }
    }

    #[test]
    fn test_delivery_targets_dedup_shared_inbox() {
        let followers = vec![
            make_follower(
                "https://mastodon.social/users/alice",
                "https://mastodon.social/users/alice/inbox",
                Some("https://mastodon.social/inbox"),
            ),
            make_follower(
                "https://mastodon.social/users/bob",
                "https://mastodon.social/users/bob/inbox",
                Some("https://mastodon.social/inbox"),
            ),
        ];

        let targets = delivery_targets(&followers);
        assert_eq!(targets.len(), 1);
        assert_eq!(targets[0].inbox_uri, "https://mastodon.social/inbox");
        assert!(targets[0].is_shared);
    }

    #[test]
    fn test_delivery_targets_fallback_to_individual() {
        let followers = vec![make_follower(
            "https://solo.example/users/carol",
            "https://solo.example/users/carol/inbox",
            None,
        )];

        let targets = delivery_targets(&followers);
        assert_eq!(targets.len(), 1);
        assert_eq!(
            targets[0].inbox_uri,
            "https://solo.example/users/carol/inbox"
        );
        assert!(!targets[0].is_shared);
    }

    #[test]
    fn test_delivery_targets_mixed() {
        let followers = vec![
            make_follower(
                "https://mastodon.social/users/alice",
                "https://mastodon.social/users/alice/inbox",
                Some("https://mastodon.social/inbox"),
            ),
            make_follower(
                "https://mastodon.social/users/bob",
                "https://mastodon.social/users/bob/inbox",
                Some("https://mastodon.social/inbox"),
            ),
            make_follower(
                "https://solo.example/users/carol",
                "https://solo.example/users/carol/inbox",
                None,
            ),
            make_follower(
                "https://pleroma.example/users/dave",
                "https://pleroma.example/users/dave/inbox",
                Some("https://pleroma.example/inbox"),
            ),
        ];

        let targets = delivery_targets(&followers);
        assert_eq!(targets.len(), 3);

        let shared: Vec<_> = targets.iter().filter(|t| t.is_shared).collect();
        let individual: Vec<_> = targets.iter().filter(|t| !t.is_shared).collect();

        assert_eq!(shared.len(), 2);
        assert_eq!(individual.len(), 1);
        assert_eq!(
            individual[0].inbox_uri,
            "https://solo.example/users/carol/inbox"
        );
    }

    #[test]
    fn test_delivery_targets_empty() {
        let targets = delivery_targets(&[]);
        assert!(targets.is_empty());
    }
}
