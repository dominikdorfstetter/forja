//! ActivityPub protocol DTOs.
//!
//! These types represent the wire format for ActivityPub/ActivityStreams
//! objects. They are used for serialization/deserialization of JSON-LD
//! payloads exchanged between federation peers.
//!
//! These types intentionally do NOT derive `utoipa::ToSchema` because they
//! are protocol types, not admin API types.

use serde::{Deserialize, Serialize};

/// The ActivityStreams 2.0 JSON-LD context URI.
pub const ACTIVITY_STREAMS_CONTEXT: &str = "https://www.w3.org/ns/activitystreams";

/// The W3C Security Vocabulary context URI (for `publicKey`).
pub const SECURITY_CONTEXT: &str = "https://w3id.org/security/v1";

// ── Actor ───────────────────────────────────────────────────────────────

/// An ActivityPub Actor document (Person/Service/Application).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityPubActor {
    #[serde(rename = "@context")]
    pub context: serde_json::Value,

    pub id: String,

    #[serde(rename = "type")]
    pub actor_type: String,

    #[serde(rename = "preferredUsername")]
    pub preferred_username: String,

    pub name: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,

    pub inbox: String,
    pub outbox: String,
    pub followers: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub featured: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,

    #[serde(rename = "publicKey")]
    pub public_key: ActorPublicKey,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<ActivityPubMediaLink>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub image: Option<ActivityPubMediaLink>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub endpoints: Option<ActorEndpoints>,
}

/// A media link (icon, image, etc.) in ActivityPub format.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityPubMediaLink {
    #[serde(rename = "type")]
    pub media_type: String,

    #[serde(rename = "mediaType", skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,

    pub url: String,
}

/// The `publicKey` object embedded in an Actor document.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActorPublicKey {
    pub id: String,
    pub owner: String,

    #[serde(rename = "publicKeyPem")]
    pub public_key_pem: String,
}

/// Optional endpoints block on an Actor (e.g. shared inbox).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActorEndpoints {
    #[serde(rename = "sharedInbox", skip_serializing_if = "Option::is_none")]
    pub shared_inbox: Option<String>,
}

// ── Activity ────────────────────────────────────────────────────────────

/// A generic ActivityPub Activity (Create, Follow, Undo, Accept, etc.).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Activity {
    #[serde(rename = "@context")]
    pub context: serde_json::Value,

    pub id: String,

    #[serde(rename = "type")]
    pub activity_type: String,

    pub actor: String,

    /// The object of the activity. Can be an inline object or a URI string.
    pub object: serde_json::Value,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub to: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub cc: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub published: Option<String>,
}

// ── Tag ──────────────────────────────────────────────────────────────────

/// An ActivityPub tag (Hashtag, Mention, etc.).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityPubTag {
    #[serde(rename = "type")]
    pub tag_type: String, // "Hashtag"
    pub href: String, // URL to tag page
    pub name: String, // "#tagname"
}

// ── Article ─────────────────────────────────────────────────────────────

/// An ActivityPub Article object (used as the `object` of a Create activity).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Article {
    #[serde(rename = "@context", skip_serializing_if = "Option::is_none")]
    pub context: Option<serde_json::Value>,

    pub id: String,

    #[serde(rename = "type")]
    pub object_type: String,

    #[serde(rename = "attributedTo")]
    pub attributed_to: String,

    pub name: String,

    pub content: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,

    pub url: String,

    pub published: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub to: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub cc: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub tag: Option<Vec<ActivityPubTag>>,
}

// ── WebFinger ───────────────────────────────────────────────────────────

/// RFC 7033 WebFinger response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebFingerResponse {
    pub subject: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub aliases: Option<Vec<String>>,

    pub links: Vec<WebFingerLink>,
}

/// A single link in a WebFinger response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebFingerLink {
    pub rel: String,

    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub link_type: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub href: Option<String>,
}

// ── Collections ─────────────────────────────────────────────────────────

/// An ActivityPub OrderedCollection (e.g. outbox, followers).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderedCollection {
    #[serde(rename = "@context")]
    pub context: serde_json::Value,

    pub id: String,

    #[serde(rename = "type")]
    pub collection_type: String,

    #[serde(rename = "totalItems")]
    pub total_items: u64,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub first: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub last: Option<String>,
}

/// A page of an OrderedCollection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderedCollectionPage {
    #[serde(rename = "@context")]
    pub context: serde_json::Value,

    pub id: String,

    #[serde(rename = "type")]
    pub page_type: String,

    #[serde(rename = "partOf")]
    pub part_of: String,

    #[serde(rename = "totalItems", skip_serializing_if = "Option::is_none")]
    pub total_items: Option<u64>,

    #[serde(rename = "orderedItems")]
    pub ordered_items: Vec<serde_json::Value>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub next: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub prev: Option<String>,
}

// ── Helpers ─────────────────────────────────────────────────────────────

/// Build the standard ActivityPub context value (ActivityStreams + Security).
pub fn ap_context() -> serde_json::Value {
    serde_json::json!([ACTIVITY_STREAMS_CONTEXT, SECURITY_CONTEXT])
}

/// Build a context value with only the ActivityStreams namespace.
pub fn as_context() -> serde_json::Value {
    serde_json::json!(ACTIVITY_STREAMS_CONTEXT)
}

// ── Tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_activity_serializes_with_context() {
        let activity = Activity {
            context: ap_context(),
            id: "https://example.com/activities/1".to_string(),
            activity_type: "Create".to_string(),
            actor: "https://example.com/ap/blog/actor".to_string(),
            object: serde_json::json!("https://example.com/posts/1"),
            to: Some(vec![
                "https://www.w3.org/ns/activitystreams#Public".to_string()
            ]),
            cc: None,
            published: Some("2026-03-14T12:00:00Z".to_string()),
        };

        let json = serde_json::to_string(&activity).unwrap();
        assert!(json.contains("@context"));
        assert!(json.contains(ACTIVITY_STREAMS_CONTEXT));
        assert!(json.contains(SECURITY_CONTEXT));
        assert!(json.contains("\"type\":\"Create\""));
    }

    #[test]
    fn test_activity_roundtrip() {
        let activity = Activity {
            context: ap_context(),
            id: "https://example.com/activities/42".to_string(),
            activity_type: "Follow".to_string(),
            actor: "https://remote.example/users/alice".to_string(),
            object: serde_json::json!("https://example.com/ap/blog/actor"),
            to: None,
            cc: None,
            published: None,
        };

        let json = serde_json::to_string(&activity).unwrap();
        let parsed: Activity = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.id, activity.id);
        assert_eq!(parsed.activity_type, "Follow");
        assert_eq!(parsed.actor, activity.actor);
    }

    #[test]
    fn test_webfinger_response_format() {
        let response = WebFingerResponse {
            subject: "acct:blog@example.com".to_string(),
            aliases: Some(vec!["https://example.com/ap/blog/actor".to_string()]),
            links: vec![WebFingerLink {
                rel: "self".to_string(),
                link_type: Some("application/activity+json".to_string()),
                href: Some("https://example.com/ap/blog/actor".to_string()),
            }],
        };

        let json = serde_json::to_value(&response).unwrap();
        assert_eq!(json["subject"], "acct:blog@example.com");
        assert_eq!(json["links"][0]["rel"], "self");
        assert_eq!(json["links"][0]["type"], "application/activity+json");
    }

    #[test]
    fn test_webfinger_roundtrip() {
        let response = WebFingerResponse {
            subject: "acct:tech@blog.example.com".to_string(),
            aliases: None,
            links: vec![
                WebFingerLink {
                    rel: "self".to_string(),
                    link_type: Some("application/activity+json".to_string()),
                    href: Some("https://blog.example.com/ap/tech/actor".to_string()),
                },
                WebFingerLink {
                    rel: "http://webfinger.net/rel/profile-page".to_string(),
                    link_type: Some("text/html".to_string()),
                    href: Some("https://blog.example.com".to_string()),
                },
            ],
        };

        let json = serde_json::to_string(&response).unwrap();
        let parsed: WebFingerResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.subject, response.subject);
        assert_eq!(parsed.links.len(), 2);
    }

    #[test]
    fn test_actor_serialization() {
        let actor = ActivityPubActor {
            context: ap_context(),
            id: "https://example.com/ap/blog/actor".to_string(),
            actor_type: "Person".to_string(),
            preferred_username: "blog".to_string(),
            name: "My Blog".to_string(),
            summary: Some("A test blog".to_string()),
            inbox: "https://example.com/ap/blog/inbox".to_string(),
            outbox: "https://example.com/ap/blog/outbox".to_string(),
            followers: "https://example.com/ap/blog/followers".to_string(),
            featured: Some("https://example.com/ap/actor/blog/featured".to_string()),
            url: Some("https://example.com".to_string()),
            public_key: ActorPublicKey {
                id: "https://example.com/ap/blog/actor#main-key".to_string(),
                owner: "https://example.com/ap/blog/actor".to_string(),
                public_key_pem: "-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----"
                    .to_string(),
            },
            icon: None,
            image: None,
            endpoints: Some(ActorEndpoints {
                shared_inbox: Some("https://example.com/ap/inbox".to_string()),
            }),
        };

        let json = serde_json::to_value(&actor).unwrap();
        assert_eq!(json["preferredUsername"], "blog");
        assert_eq!(json["type"], "Person");
        assert!(json["publicKey"]["publicKeyPem"]
            .as_str()
            .unwrap()
            .contains("BEGIN PUBLIC KEY"));
        assert_eq!(
            json["endpoints"]["sharedInbox"],
            "https://example.com/ap/inbox"
        );
    }

    #[test]
    fn test_article_serialization() {
        let article = Article {
            context: Some(as_context()),
            id: "https://example.com/posts/hello-world".to_string(),
            object_type: "Article".to_string(),
            attributed_to: "https://example.com/ap/blog/actor".to_string(),
            name: "Hello World".to_string(),
            content: "<p>This is my first post.</p>".to_string(),
            summary: Some("A greeting".to_string()),
            url: "https://example.com/blog/hello-world".to_string(),
            published: "2026-03-14T12:00:00Z".to_string(),
            updated: None,
            to: Some(vec![
                "https://www.w3.org/ns/activitystreams#Public".to_string()
            ]),
            cc: None,
            tag: None,
        };

        let json = serde_json::to_value(&article).unwrap();
        assert_eq!(json["type"], "Article");
        assert_eq!(json["attributedTo"], "https://example.com/ap/blog/actor");
        assert_eq!(json["name"], "Hello World");
        assert!(json["content"].as_str().unwrap().contains("first post"));
    }

    #[test]
    fn test_ordered_collection_serialization() {
        let collection = OrderedCollection {
            context: as_context(),
            id: "https://example.com/ap/blog/outbox".to_string(),
            collection_type: "OrderedCollection".to_string(),
            total_items: 42,
            first: Some("https://example.com/ap/blog/outbox?page=1".to_string()),
            last: None,
        };

        let json = serde_json::to_value(&collection).unwrap();
        assert_eq!(json["type"], "OrderedCollection");
        assert_eq!(json["totalItems"], 42);
        assert!(json.get("last").is_none());
    }

    #[test]
    fn test_ordered_collection_page_serialization() {
        let page = OrderedCollectionPage {
            context: as_context(),
            id: "https://example.com/ap/blog/outbox?page=1".to_string(),
            page_type: "OrderedCollectionPage".to_string(),
            part_of: "https://example.com/ap/blog/outbox".to_string(),
            total_items: Some(42),
            ordered_items: vec![
                serde_json::json!({"type": "Create", "id": "https://example.com/activities/1"}),
            ],
            next: Some("https://example.com/ap/blog/outbox?page=2".to_string()),
            prev: None,
        };

        let json = serde_json::to_value(&page).unwrap();
        assert_eq!(json["type"], "OrderedCollectionPage");
        assert_eq!(json["partOf"], "https://example.com/ap/blog/outbox");
        assert_eq!(json["orderedItems"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn test_ap_context_helper() {
        let ctx = ap_context();
        let arr = ctx.as_array().unwrap();
        assert_eq!(arr.len(), 2);
        assert_eq!(arr[0], ACTIVITY_STREAMS_CONTEXT);
        assert_eq!(arr[1], SECURITY_CONTEXT);
    }

    #[test]
    fn test_as_context_helper() {
        let ctx = as_context();
        assert_eq!(ctx, ACTIVITY_STREAMS_CONTEXT);
    }

    #[test]
    fn test_activitypub_tag_serialization() {
        let tag = ActivityPubTag {
            tag_type: "Hashtag".to_string(),
            href: "https://example.com/tags/rust".to_string(),
            name: "#rust".to_string(),
        };

        let json = serde_json::to_value(&tag).unwrap();
        assert_eq!(json["type"], "Hashtag");
        assert_eq!(json["href"], "https://example.com/tags/rust");
        assert_eq!(json["name"], "#rust");
    }

    #[test]
    fn test_article_with_tags() {
        let article = Article {
            context: Some(as_context()),
            id: "https://example.com/posts/tagged".to_string(),
            object_type: "Article".to_string(),
            attributed_to: "https://example.com/ap/blog/actor".to_string(),
            name: "Tagged Post".to_string(),
            content: "<p>A post with tags.</p>".to_string(),
            summary: None,
            url: "https://example.com/blog/tagged".to_string(),
            published: "2026-03-14T12:00:00Z".to_string(),
            updated: None,
            to: None,
            cc: None,
            tag: Some(vec![
                ActivityPubTag {
                    tag_type: "Hashtag".to_string(),
                    href: "https://example.com/tags/rust".to_string(),
                    name: "#rust".to_string(),
                },
                ActivityPubTag {
                    tag_type: "Hashtag".to_string(),
                    href: "https://example.com/tags/webdev".to_string(),
                    name: "#webdev".to_string(),
                },
            ]),
        };

        let json = serde_json::to_value(&article).unwrap();
        let tags = json["tag"].as_array().unwrap();
        assert_eq!(tags.len(), 2);
        assert_eq!(tags[0]["type"], "Hashtag");
        assert_eq!(tags[0]["name"], "#rust");
        assert_eq!(tags[1]["name"], "#webdev");
    }

    #[test]
    fn test_media_link_serialization() {
        let icon = ActivityPubMediaLink {
            media_type: "Image".to_string(),
            mime_type: Some("image/png".to_string()),
            url: "https://example.com/avatar.png".to_string(),
        };

        let json = serde_json::to_value(&icon).unwrap();
        assert_eq!(json["type"], "Image");
        assert_eq!(json["mediaType"], "image/png");
    }
}
