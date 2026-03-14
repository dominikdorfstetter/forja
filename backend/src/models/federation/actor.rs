//! ApActor model — one ActivityPub actor per site

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;

use super::types::ApSignatureAlgorithm;

/// ActivityPub actor (one per site).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ApActor {
    pub id: Uuid,
    pub site_id: Uuid,
    pub preferred_username: String,
    pub display_name: String,
    pub summary: Option<String>,
    pub avatar_url: Option<String>,
    pub header_url: Option<String>,
    pub rsa_private_key: Vec<u8>,
    pub rsa_private_key_nonce: Vec<u8>,
    pub rsa_public_key: String,
    pub ed25519_private_key: Option<Vec<u8>>,
    pub ed25519_private_key_nonce: Option<Vec<u8>>,
    pub ed25519_public_key: Option<String>,
    pub signature_algorithm: ApSignatureAlgorithm,
    pub inbox_url: String,
    pub outbox_url: String,
    pub followers_url: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Generate the canonical inbox, outbox, and followers URLs for an actor.
pub fn generate_urls(domain: &str, site_slug: &str) -> (String, String, String) {
    let base = format!("https://{}/ap/{}", domain, site_slug);
    (
        format!("{}/inbox", base),
        format!("{}/outbox", base),
        format!("{}/followers", base),
    )
}

impl ApActor {
    /// The canonical ActivityPub actor URI for this actor.
    pub fn actor_uri(&self, domain: &str, site_slug: &str) -> String {
        format!("https://{}/ap/{}/actor", domain, site_slug)
    }

    /// Find the actor for a given site.
    pub async fn find_by_site_id(pool: &PgPool, site_id: Uuid) -> Result<Option<Self>, ApiError> {
        let actor = sqlx::query_as::<_, Self>("SELECT * FROM ap_actors WHERE site_id = $1")
            .bind(site_id)
            .fetch_optional(pool)
            .await?;

        Ok(actor)
    }

    /// Create a new actor record.
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        pool: &PgPool,
        site_id: Uuid,
        preferred_username: &str,
        display_name: &str,
        summary: Option<&str>,
        rsa_private_key: &[u8],
        rsa_private_key_nonce: &[u8],
        rsa_public_key: &str,
        signature_algorithm: ApSignatureAlgorithm,
        inbox_url: &str,
        outbox_url: &str,
        followers_url: &str,
    ) -> Result<Self, ApiError> {
        let actor = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO ap_actors (
                site_id, preferred_username, display_name, summary,
                rsa_private_key, rsa_private_key_nonce, rsa_public_key,
                signature_algorithm, inbox_url, outbox_url, followers_url
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
            "#,
        )
        .bind(site_id)
        .bind(preferred_username)
        .bind(display_name)
        .bind(summary)
        .bind(rsa_private_key)
        .bind(rsa_private_key_nonce)
        .bind(rsa_public_key)
        .bind(signature_algorithm)
        .bind(inbox_url)
        .bind(outbox_url)
        .bind(followers_url)
        .fetch_one(pool)
        .await?;

        Ok(actor)
    }

    /// Delete the actor for a given site.
    pub async fn delete_by_site_id(pool: &PgPool, site_id: Uuid) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM ap_actors WHERE site_id = $1")
            .bind(site_id)
            .execute(pool)
            .await?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_urls() {
        let (inbox, outbox, followers) = generate_urls("example.com", "my-blog");
        assert_eq!(inbox, "https://example.com/ap/my-blog/inbox");
        assert_eq!(outbox, "https://example.com/ap/my-blog/outbox");
        assert_eq!(followers, "https://example.com/ap/my-blog/followers");
    }

    #[test]
    fn test_generate_urls_with_subdomain() {
        let (inbox, outbox, followers) = generate_urls("blog.example.com", "tech");
        assert_eq!(inbox, "https://blog.example.com/ap/tech/inbox");
        assert_eq!(outbox, "https://blog.example.com/ap/tech/outbox");
        assert_eq!(followers, "https://blog.example.com/ap/tech/followers");
    }

    #[test]
    fn test_actor_uri() {
        let actor = ApActor {
            id: Uuid::new_v4(),
            site_id: Uuid::new_v4(),
            preferred_username: "myblog".to_string(),
            display_name: "My Blog".to_string(),
            summary: None,
            avatar_url: None,
            header_url: None,
            rsa_private_key: vec![],
            rsa_private_key_nonce: vec![],
            rsa_public_key: String::new(),
            ed25519_private_key: None,
            ed25519_private_key_nonce: None,
            ed25519_public_key: None,
            signature_algorithm: ApSignatureAlgorithm::RsaSha256,
            inbox_url: String::new(),
            outbox_url: String::new(),
            followers_url: String::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        assert_eq!(
            actor.actor_uri("example.com", "my-blog"),
            "https://example.com/ap/my-blog/actor"
        );
    }
}
