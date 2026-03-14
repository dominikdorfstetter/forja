//! Admin API request DTOs for federation management.

use serde::Deserialize;
use validator::Validate;

/// Request to update federation settings for a site.
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update federation settings for a site")]
pub struct UpdateFederationSettingsRequest {
    /// Enable or disable federation for this site.
    #[schema(example = true)]
    pub enabled: Option<bool>,

    /// Signature algorithm: "rsa-sha256" or "ed25519".
    #[schema(example = "rsa-sha256")]
    #[validate(custom(function = "validate_signature_algo"))]
    pub signature_algorithm: Option<String>,

    /// Comment moderation mode: "manual" or "auto_approve".
    #[schema(example = "manual")]
    #[validate(custom(function = "validate_moderation_mode"))]
    pub moderation_mode: Option<String>,

    /// Automatically publish new posts to the fediverse.
    #[schema(example = false)]
    pub auto_publish: Option<bool>,

    /// Actor bio/summary for Fediverse profiles (max 500 characters).
    #[schema(example = "A blog about web development and Rust")]
    #[validate(length(max = 500, message = "Summary cannot exceed 500 characters"))]
    pub summary: Option<String>,

    /// Avatar/profile picture URL for the Fediverse actor (max 500 characters).
    #[schema(example = "https://example.com/avatar.png")]
    #[validate(length(max = 500, message = "Avatar URL cannot exceed 500 characters"))]
    pub avatar_url: Option<String>,
}

/// Request to block a remote instance domain.
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Block a remote instance domain")]
pub struct BlockInstanceRequest {
    /// The domain to block (e.g. "spam.example.com").
    #[schema(example = "spam.example.com")]
    #[validate(length(
        min = 1,
        max = 253,
        message = "Domain must be between 1 and 253 characters"
    ))]
    pub domain: String,

    /// Optional reason for blocking.
    #[schema(example = "Known spam instance")]
    #[validate(length(max = 500, message = "Reason cannot exceed 500 characters"))]
    pub reason: Option<String>,
}

/// Request to block a remote actor.
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Block a remote actor")]
pub struct BlockActorRequest {
    /// The full ActivityPub actor URI to block.
    #[schema(example = "https://mastodon.social/users/spammer")]
    #[validate(url(message = "Actor URI must be a valid URL"))]
    pub actor_uri: String,

    /// Optional reason for blocking.
    #[schema(example = "Repeated harassment")]
    #[validate(length(max = 500, message = "Reason cannot exceed 500 characters"))]
    pub reason: Option<String>,
}

/// Request to create a quick-post Note on the Fediverse.
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Create a short-form Note to post to the Fediverse")]
pub struct CreateNoteRequest {
    /// The plain-text body of the note (1–500 characters).
    #[schema(example = "Hello from Forja!")]
    #[validate(length(
        min = 1,
        max = 500,
        message = "Body must be between 1 and 500 characters"
    ))]
    pub body: String,

    /// Optional ISO 8601 timestamp to schedule the note for future publication.
    #[schema(example = "2026-04-01T12:00:00Z")]
    pub scheduled_at: Option<String>,
}

/// Request to update a quick-post Note body.
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update the body of an existing Fediverse note")]
pub struct UpdateNoteRequest {
    /// The new plain-text body (1–500 characters).
    #[schema(example = "Updated: Hello from Forja!")]
    #[validate(length(
        min = 1,
        max = 500,
        message = "Body must be between 1 and 500 characters"
    ))]
    pub body: String,
}

/// Request to pin a blog post in the featured collection.
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Pin a blog post to the ActivityPub featured collection")]
pub struct PinPostRequest {
    /// The content UUID of the blog post to pin.
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub content_id: uuid::Uuid,
}

/// Request to moderate a federated comment.
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Moderate a federated comment")]
pub struct ModerateCommentRequest {
    /// New status: "approved", "rejected", or "spam".
    #[schema(example = "approved")]
    #[validate(custom(function = "validate_moderation_status"))]
    pub status: String,
}

// ── Validators ──────────────────────────────────────────────────────────

fn validate_signature_algo(algo: &str) -> Result<(), validator::ValidationError> {
    match algo {
        "rsa-sha256" | "ed25519" => Ok(()),
        _ => {
            let mut err = validator::ValidationError::new("invalid_signature_algorithm");
            err.message = Some("Must be 'rsa-sha256' or 'ed25519'".into());
            Err(err)
        }
    }
}

fn validate_moderation_mode(mode: &str) -> Result<(), validator::ValidationError> {
    match mode {
        "manual" | "auto_approve" => Ok(()),
        _ => {
            let mut err = validator::ValidationError::new("invalid_moderation_mode");
            err.message = Some("Must be 'manual' or 'auto_approve'".into());
            Err(err)
        }
    }
}

fn validate_moderation_status(status: &str) -> Result<(), validator::ValidationError> {
    match status {
        "approved" | "rejected" | "spam" => Ok(()),
        _ => {
            let mut err = validator::ValidationError::new("invalid_moderation_status");
            err.message = Some("Must be 'approved', 'rejected', or 'spam'".into());
            Err(err)
        }
    }
}

// ── Tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_update_federation_settings_valid() {
        let req = UpdateFederationSettingsRequest {
            enabled: Some(true),
            signature_algorithm: Some("rsa-sha256".to_string()),
            moderation_mode: Some("manual".to_string()),
            auto_publish: Some(false),
            summary: Some("A test blog".to_string()),
            avatar_url: Some("https://example.com/avatar.png".to_string()),
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_update_federation_settings_all_none() {
        let req = UpdateFederationSettingsRequest {
            enabled: None,
            signature_algorithm: None,
            moderation_mode: None,
            auto_publish: None,
            summary: None,
            avatar_url: None,
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_update_federation_settings_invalid_algo() {
        let req = UpdateFederationSettingsRequest {
            enabled: None,
            signature_algorithm: Some("hmac-sha512".to_string()),
            moderation_mode: None,
            auto_publish: None,
            summary: None,
            avatar_url: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_update_federation_settings_invalid_moderation() {
        let req = UpdateFederationSettingsRequest {
            enabled: None,
            signature_algorithm: None,
            moderation_mode: Some("yolo".to_string()),
            auto_publish: None,
            summary: None,
            avatar_url: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_update_federation_settings_summary_too_long() {
        let req = UpdateFederationSettingsRequest {
            enabled: None,
            signature_algorithm: None,
            moderation_mode: None,
            auto_publish: None,
            summary: Some("x".repeat(501)),
            avatar_url: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_update_federation_settings_avatar_url_too_long() {
        let req = UpdateFederationSettingsRequest {
            enabled: None,
            signature_algorithm: None,
            moderation_mode: None,
            auto_publish: None,
            summary: None,
            avatar_url: Some("x".repeat(501)),
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_block_instance_valid() {
        let req = BlockInstanceRequest {
            domain: "spam.example.com".to_string(),
            reason: Some("Known spam".to_string()),
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_block_instance_empty_domain() {
        let req = BlockInstanceRequest {
            domain: "".to_string(),
            reason: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_block_actor_valid() {
        let req = BlockActorRequest {
            actor_uri: "https://mastodon.social/users/spammer".to_string(),
            reason: None,
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_block_actor_invalid_uri() {
        let req = BlockActorRequest {
            actor_uri: "not-a-url".to_string(),
            reason: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_moderate_comment_valid() {
        for status in &["approved", "rejected", "spam"] {
            let req = ModerateCommentRequest {
                status: status.to_string(),
            };
            assert!(req.validate().is_ok(), "status '{status}' should be valid");
        }
    }

    #[test]
    fn test_moderate_comment_invalid_status() {
        let req = ModerateCommentRequest {
            status: "deleted".to_string(),
        };
        assert!(req.validate().is_err());
    }
}
