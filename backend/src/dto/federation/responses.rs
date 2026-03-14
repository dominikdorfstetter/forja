//! Admin API response DTOs for federation management.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Settings ────────────────────────────────────────────────────────────

/// Federation settings response for the admin dashboard.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Federation settings for a site")]
pub struct FederationSettingsResponse {
    #[schema(example = true)]
    pub enabled: bool,

    #[schema(example = "rsa-sha256")]
    pub signature_algorithm: String,

    #[schema(example = "manual")]
    pub moderation_mode: String,

    #[schema(example = false)]
    pub auto_publish: bool,

    /// The actor URI for this site (populated when federation is enabled).
    #[schema(example = "https://example.com/ap/blog/actor")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actor_uri: Option<String>,

    /// The WebFinger address (e.g. "blog@example.com").
    #[schema(example = "blog@example.com")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webfinger_address: Option<String>,

    /// The actor's bio/summary for Fediverse profiles.
    #[schema(example = "A blog about web development")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
}

// ── Stats ───────────────────────────────────────────────────────────────

/// Aggregate federation statistics for the admin dashboard.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Federation activity statistics")]
pub struct FederationStatsResponse {
    #[schema(example = 150)]
    pub outbound_activities: i64,

    #[schema(example = 42)]
    pub inbound_activities: i64,

    #[schema(example = 3)]
    pub failed_activities: i64,

    #[schema(example = 7)]
    pub pending_comments: i64,

    #[schema(example = 89)]
    pub follower_count: i64,

    #[schema(example = 2)]
    pub blocked_instances: i64,

    #[schema(example = 1)]
    pub blocked_actors: i64,
}

// ── Followers ───────────────────────────────────────────────────────────

/// A remote follower as returned by the admin API.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "A remote follower")]
pub struct FollowerResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,

    #[schema(example = "https://mastodon.social/users/alice")]
    pub actor_uri: String,

    #[schema(example = "https://mastodon.social/users/alice/inbox")]
    pub inbox_uri: String,

    #[schema(example = "alice")]
    pub username: Option<String>,

    #[schema(example = "Alice")]
    pub display_name: Option<String>,

    #[schema(example = "https://mastodon.social/avatars/alice.png")]
    pub avatar_url: Option<String>,

    #[schema(example = "accepted")]
    pub status: String,

    pub followed_at: DateTime<Utc>,
}

// ── Activities ──────────────────────────────────────────────────────────

/// An ActivityPub activity as returned by the admin API.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "A logged ActivityPub activity")]
pub struct ActivityResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,

    #[schema(example = "Create")]
    pub activity_type: String,

    #[schema(example = "https://example.com/activities/1")]
    pub activity_uri: String,

    #[schema(example = "https://example.com/ap/blog/actor")]
    pub actor_uri: String,

    #[schema(example = "https://example.com/posts/1")]
    pub object_uri: Option<String>,

    #[schema(example = "out")]
    pub direction: String,

    #[schema(example = "done")]
    pub status: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,

    pub created_at: DateTime<Utc>,
}

// ── Comments ────────────────────────────────────────────────────────────

/// A federated comment as returned by the admin API.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "A federated comment")]
pub struct CommentResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,

    #[schema(example = "550e8400-e29b-41d4-a716-446655440001")]
    pub content_id: Uuid,

    #[schema(example = "https://mastodon.social/users/alice")]
    pub author_actor_uri: String,

    #[schema(example = "Alice")]
    pub author_name: Option<String>,

    #[schema(example = "https://mastodon.social/avatars/alice.png")]
    pub author_avatar_url: Option<String>,

    pub body_html: String,

    #[schema(example = "pending")]
    pub status: String,

    pub created_at: DateTime<Utc>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub moderated_at: Option<DateTime<Utc>>,
}

// ── Blocks ──────────────────────────────────────────────────────────────

/// A blocked instance domain as returned by the admin API.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "A blocked instance domain")]
pub struct BlockedInstanceResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,

    #[schema(example = "spam.example.com")]
    pub domain: String,

    #[schema(example = "Known spam instance")]
    pub reason: Option<String>,

    pub blocked_at: DateTime<Utc>,
}

/// A blocked remote actor as returned by the admin API.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "A blocked remote actor")]
pub struct BlockedActorResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,

    #[schema(example = "https://mastodon.social/users/spammer")]
    pub actor_uri: String,

    #[schema(example = "Repeated harassment")]
    pub reason: Option<String>,

    pub blocked_at: DateTime<Utc>,
}

// ── Conversions from models ─────────────────────────────────────────────

use crate::models::federation::block::{ApBlockedActor, ApBlockedInstance};
use crate::models::federation::comment::ApComment;
use crate::models::federation::follower::ApFollower;

impl From<ApFollower> for FollowerResponse {
    fn from(f: ApFollower) -> Self {
        Self {
            id: f.id,
            actor_uri: f.follower_actor_uri,
            inbox_uri: f.follower_inbox_uri,
            username: f.username,
            display_name: f.display_name,
            avatar_url: f.avatar_url,
            status: format!("{:?}", f.status).to_lowercase(),
            followed_at: f.followed_at,
        }
    }
}

impl From<ApComment> for CommentResponse {
    fn from(c: ApComment) -> Self {
        Self {
            id: c.id,
            content_id: c.content_id,
            author_actor_uri: c.author_actor_uri,
            author_name: c.author_name,
            author_avatar_url: c.author_avatar_url,
            body_html: c.body_html,
            status: format!("{:?}", c.status).to_lowercase(),
            created_at: c.created_at,
            moderated_at: c.moderated_at,
        }
    }
}

impl From<ApBlockedInstance> for BlockedInstanceResponse {
    fn from(b: ApBlockedInstance) -> Self {
        Self {
            id: b.id,
            domain: b.instance_domain,
            reason: b.reason,
            blocked_at: b.blocked_at,
        }
    }
}

impl From<ApBlockedActor> for BlockedActorResponse {
    fn from(b: ApBlockedActor) -> Self {
        Self {
            id: b.id,
            actor_uri: b.blocked_actor_uri,
            reason: b.reason,
            blocked_at: b.blocked_at,
        }
    }
}

// ── Tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_federation_settings_serialization() {
        let settings = FederationSettingsResponse {
            enabled: true,
            signature_algorithm: "rsa-sha256".to_string(),
            moderation_mode: "manual".to_string(),
            auto_publish: false,
            actor_uri: Some("https://example.com/ap/blog/actor".to_string()),
            webfinger_address: Some("blog@example.com".to_string()),
            summary: Some("A test blog".to_string()),
        };

        let json = serde_json::to_value(&settings).unwrap();
        assert_eq!(json["enabled"], true);
        assert_eq!(json["signature_algorithm"], "rsa-sha256");
        assert_eq!(json["actor_uri"], "https://example.com/ap/blog/actor");
        assert_eq!(json["summary"], "A test blog");
    }

    #[test]
    fn test_federation_settings_omits_none_fields() {
        let settings = FederationSettingsResponse {
            enabled: false,
            signature_algorithm: "rsa-sha256".to_string(),
            moderation_mode: "manual".to_string(),
            auto_publish: false,
            actor_uri: None,
            webfinger_address: None,
            summary: None,
        };

        let json = serde_json::to_string(&settings).unwrap();
        assert!(!json.contains("actor_uri"));
        assert!(!json.contains("webfinger_address"));
        assert!(!json.contains("summary"));
    }

    #[test]
    fn test_stats_response_serialization() {
        let stats = FederationStatsResponse {
            outbound_activities: 150,
            inbound_activities: 42,
            failed_activities: 3,
            pending_comments: 7,
            follower_count: 89,
            blocked_instances: 2,
            blocked_actors: 1,
        };

        let json = serde_json::to_value(&stats).unwrap();
        assert_eq!(json["outbound_activities"], 150);
        assert_eq!(json["follower_count"], 89);
    }

    #[test]
    fn test_follower_response_serialization() {
        let follower = FollowerResponse {
            id: Uuid::new_v4(),
            actor_uri: "https://mastodon.social/users/alice".to_string(),
            inbox_uri: "https://mastodon.social/users/alice/inbox".to_string(),
            username: Some("alice".to_string()),
            display_name: Some("Alice".to_string()),
            avatar_url: None,
            status: "accepted".to_string(),
            followed_at: Utc::now(),
        };

        let json = serde_json::to_value(&follower).unwrap();
        assert_eq!(json["status"], "accepted");
        assert_eq!(json["username"], "alice");
    }

    #[test]
    fn test_blocked_instance_response_roundtrip() {
        let blocked = BlockedInstanceResponse {
            id: Uuid::new_v4(),
            domain: "spam.example.com".to_string(),
            reason: Some("Known spam".to_string()),
            blocked_at: Utc::now(),
        };

        let json = serde_json::to_string(&blocked).unwrap();
        let parsed: BlockedInstanceResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.domain, "spam.example.com");
        assert_eq!(parsed.reason, Some("Known spam".to_string()));
    }

    #[test]
    fn test_comment_response_serialization() {
        let comment = CommentResponse {
            id: Uuid::new_v4(),
            content_id: Uuid::new_v4(),
            author_actor_uri: "https://mastodon.social/users/bob".to_string(),
            author_name: Some("Bob".to_string()),
            author_avatar_url: None,
            body_html: "<p>Great post!</p>".to_string(),
            status: "pending".to_string(),
            created_at: Utc::now(),
            moderated_at: None,
        };

        let json = serde_json::to_string(&comment).unwrap();
        assert!(json.contains("pending"));
        assert!(!json.contains("moderated_at")); // skip_serializing_if = None
    }
}
