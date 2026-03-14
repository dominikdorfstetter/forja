//! SQLx-compatible enum types for the federation module

use serde::{Deserialize, Serialize};

/// Signature algorithm used by an ActivityPub actor's key pair.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "ap_signature_algorithm", rename_all = "kebab-case")]
pub enum ApSignatureAlgorithm {
    #[sqlx(rename = "rsa-sha256")]
    RsaSha256,
    #[sqlx(rename = "ed25519")]
    Ed25519,
}

/// Status of a remote follower relationship.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "ap_follower_status", rename_all = "lowercase")]
pub enum ApFollowerStatus {
    Pending,
    Accepted,
    Rejected,
}

/// Whether an activity was received (inbound) or sent (outbound).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "ap_activity_direction", rename_all = "lowercase")]
pub enum ApActivityDirection {
    In,
    Out,
}

/// Processing status of an activity.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "ap_activity_status", rename_all = "lowercase")]
pub enum ApActivityStatus {
    Pending,
    Done,
    Failed,
}

/// Delivery status for a queued outbound activity.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "ap_delivery_status", rename_all = "lowercase")]
pub enum ApDeliveryStatus {
    Pending,
    Done,
    Failed,
    Dead,
}

/// Moderation status of a federated comment.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "ap_comment_status", rename_all = "lowercase")]
pub enum ApCommentStatus {
    Pending,
    Approved,
    Rejected,
    Spam,
}
