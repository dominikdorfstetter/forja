//! Inbox processor — business logic for handling inbound ActivityPub activities.
//!
//! The inbox handler (`handlers::federation::inbox`) stores activities as pending
//! and returns 202 Accepted. This module processes them asynchronously, dispatching
//! to type-specific handlers (Follow, Undo, Create, etc.).

use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::models::federation::activity::ApActivity;
use crate::models::federation::comment::ApComment;
use crate::models::federation::follower::ApFollower;
use crate::models::federation::types::{ApCommentStatus, ApFollowerStatus};
use crate::services::federation::sanitizer::sanitize_html;
use crate::services::notification_service;

/// Process a stored inbound activity by dispatching to the appropriate handler.
pub async fn process_activity(
    pool: &PgPool,
    activity: &ApActivity,
    moderation_mode: &str,
) -> Result<(), ApiError> {
    match activity.activity_type.as_str() {
        "Follow" => handle_follow(pool, activity).await,
        "Undo" => handle_undo(pool, activity).await,
        "Create" => handle_create(pool, activity, moderation_mode).await,
        "Update" => handle_update(pool, activity).await,
        "Like" => {
            tracing::debug!(
                activity_type = activity.activity_type,
                activity_uri = activity.activity_uri,
                "Inbox processor: logged Like"
            );
            notification_service::notify_federation_event(
                pool.clone(),
                activity.site_id,
                "federation_like",
                "activity",
                activity.id,
                "Your post was liked on the Fediverse",
                None,
            );
            Ok(())
        }
        "Announce" => {
            tracing::debug!(
                activity_type = activity.activity_type,
                activity_uri = activity.activity_uri,
                "Inbox processor: logged Announce"
            );
            notification_service::notify_federation_event(
                pool.clone(),
                activity.site_id,
                "federation_boost",
                "activity",
                activity.id,
                "Your post was boosted on the Fediverse",
                None,
            );
            Ok(())
        }
        "Delete" => handle_delete(pool, activity).await,
        "Accept" => handle_accept_reject(pool, activity, "Accept").await,
        "Reject" => handle_accept_reject(pool, activity, "Reject").await,
        _ => {
            tracing::warn!(
                activity_type = activity.activity_type,
                "Inbox processor: unknown activity type, skipping"
            );
            Ok(())
        }
    }
}

/// Determine the moderation status for a new comment based on site policy.
pub fn determine_comment_status(mode: &str, is_follower: bool) -> ApCommentStatus {
    match mode {
        "auto_all" => ApCommentStatus::Approved,
        "auto_followers" => {
            if is_follower {
                ApCommentStatus::Approved
            } else {
                ApCommentStatus::Pending
            }
        }
        // "queue_all" or any unknown mode defaults to pending
        _ => ApCommentStatus::Pending,
    }
}

// ── Follow ──────────────────────────────────────────────────────────────

/// Store the remote actor as a follower (auto-accept for now).
async fn handle_follow(pool: &PgPool, activity: &ApActivity) -> Result<(), ApiError> {
    let follower_actor_uri = &activity.actor_uri;

    // Extract follower metadata from the payload if available
    let payload = &activity.payload;
    let display_name = payload
        .get("actor")
        .and_then(|a| a.get("name"))
        .and_then(|n| n.as_str());
    let username = payload
        .get("actor")
        .and_then(|a| a.get("preferredUsername"))
        .and_then(|u| u.as_str());
    let avatar_url = payload
        .get("actor")
        .and_then(|a| a.get("icon"))
        .and_then(|i| i.get("url"))
        .and_then(|u| u.as_str());

    // Derive the inbox URI from the actor URI (best-effort)
    let follower_inbox = payload
        .get("actor")
        .and_then(|a| a.get("inbox"))
        .and_then(|i| i.as_str())
        .unwrap_or_else(|| {
            // Fallback: construct inbox from actor URI
            // This is a rough heuristic; real implementations would fetch the actor document
            follower_actor_uri
        });

    // Resolve the local actor_id from the activity's site_id
    let actor = crate::models::federation::actor::ApActor::find_by_site_id(pool, activity.site_id)
        .await?
        .ok_or_else(|| ApiError::internal("No actor found for site during Follow processing"))?;

    ApFollower::upsert(
        pool,
        actor.id,
        follower_actor_uri,
        follower_inbox,
        None, // shared inbox — would need actor document fetch
        display_name,
        username,
        avatar_url,
        ApFollowerStatus::Accepted, // Auto-accept for now
    )
    .await?;

    tracing::info!(
        follower = follower_actor_uri,
        site_id = %activity.site_id,
        "Inbox processor: accepted Follow from remote actor"
    );

    // Notify site admins about the new follower
    let display = username
        .map(|u| format!("@{}", u))
        .or(display_name.map(|n| n.to_string()))
        .unwrap_or_else(|| follower_actor_uri.to_string());
    notification_service::notify_federation_event(
        pool.clone(),
        activity.site_id,
        "federation_follow",
        "follower",
        activity.id,
        &format!("New follower: {}", display),
        None,
    );

    // TODO: Send Accept activity back via delivery service
    Ok(())
}

// ── Undo ────────────────────────────────────────────────────────────────

/// Parse the inner object of an Undo activity and dispatch accordingly.
async fn handle_undo(pool: &PgPool, activity: &ApActivity) -> Result<(), ApiError> {
    let inner_type = extract_inner_type(&activity.payload);

    match inner_type.as_deref() {
        Some("Follow") => {
            // Remove the follower
            let actor =
                crate::models::federation::actor::ApActor::find_by_site_id(pool, activity.site_id)
                    .await?
                    .ok_or_else(|| {
                        ApiError::internal("No actor found for site during Undo processing")
                    })?;

            ApFollower::remove(pool, actor.id, &activity.actor_uri).await?;

            tracing::info!(
                follower = activity.actor_uri,
                "Inbox processor: processed Undo(Follow)"
            );
        }
        Some("Like") => {
            tracing::debug!(
                actor = activity.actor_uri,
                "Inbox processor: processed Undo(Like) — no counter to decrement"
            );
        }
        Some("Announce") => {
            tracing::debug!(
                actor = activity.actor_uri,
                "Inbox processor: processed Undo(Announce) — logged"
            );
        }
        Some(other) => {
            tracing::warn!(
                inner_type = other,
                "Inbox processor: Undo of unsupported type"
            );
        }
        None => {
            tracing::warn!("Inbox processor: Undo with unparseable inner object");
        }
    }

    Ok(())
}

/// Extract the `type` of the inner object from an Undo/other wrapping activity.
fn extract_inner_type(payload: &serde_json::Value) -> Option<String> {
    let obj = payload.get("object")?;

    // If the object is a string URI, we can't determine the type
    if obj.is_string() {
        return None;
    }

    obj.get("type")
        .and_then(|t| t.as_str())
        .map(|s| s.to_string())
}

// ── Create ──────────────────────────────────────────────────────────────

/// Handle a Create activity — typically a Note replying to one of our Articles.
async fn handle_create(
    pool: &PgPool,
    activity: &ApActivity,
    moderation_mode: &str,
) -> Result<(), ApiError> {
    let payload = &activity.payload;
    let object = match payload.get("object") {
        Some(obj) if obj.is_object() => obj,
        _ => {
            tracing::debug!(
                activity_uri = activity.activity_uri,
                "Inbox processor: Create with non-object payload, skipping"
            );
            return Ok(());
        }
    };

    let object_type = object.get("type").and_then(|t| t.as_str()).unwrap_or("");
    if object_type != "Note" {
        tracing::debug!(
            object_type = object_type,
            "Inbox processor: Create of non-Note object, skipping"
        );
        return Ok(());
    }

    // Check if this Note is a reply to one of our Articles
    let in_reply_to = object.get("inReplyTo").and_then(|r| r.as_str());
    let in_reply_to = match in_reply_to {
        Some(uri) => uri,
        None => {
            tracing::debug!(
                activity_uri = activity.activity_uri,
                "Inbox processor: Create(Note) without inReplyTo, skipping"
            );
            return Ok(());
        }
    };

    // Look up the parent activity by object_uri to find the content_id
    let parent_activity: Option<ApActivity> = sqlx::query_as(
        r#"
        SELECT * FROM ap_activities
        WHERE object_uri = $1
          AND direction = 'out'
          AND activity_type = 'Create'
        ORDER BY created_at DESC
        LIMIT 1
        "#,
    )
    .bind(in_reply_to)
    .fetch_optional(pool)
    .await?;

    let content_id = match parent_activity.and_then(|a| a.content_id) {
        Some(id) => id,
        None => {
            tracing::debug!(
                in_reply_to = in_reply_to,
                "Inbox processor: Create(Note) replies to unknown content, skipping"
            );
            return Ok(());
        }
    };

    // Extract comment fields
    let body_html = object.get("content").and_then(|c| c.as_str()).unwrap_or("");
    let sanitized_body = sanitize_html(body_html);

    let author_name = object
        .get("attributedTo")
        .and_then(|a| {
            if a.is_object() {
                a.get("name").and_then(|n| n.as_str())
            } else {
                None
            }
        })
        .or_else(|| {
            payload
                .get("actor")
                .and_then(|a| a.get("name"))
                .and_then(|n| n.as_str())
        });

    let author_avatar = payload
        .get("actor")
        .and_then(|a| a.get("icon"))
        .and_then(|i| i.get("url"))
        .and_then(|u| u.as_str());

    let note_id = object
        .get("id")
        .and_then(|i| i.as_str())
        .unwrap_or(&activity.activity_uri);

    // Determine if the author is a follower (for moderation policy)
    let actor = crate::models::federation::actor::ApActor::find_by_site_id(pool, activity.site_id)
        .await?
        .ok_or_else(|| ApiError::internal("No actor found for site during Create processing"))?;

    let is_follower = is_actor_follower(pool, actor.id, &activity.actor_uri).await?;
    let status = determine_comment_status(moderation_mode, is_follower);

    // Create the comment
    let comment = ApComment::create(
        pool,
        activity.site_id,
        content_id,
        &activity.actor_uri,
        author_name,
        author_avatar,
        note_id,
        Some(in_reply_to),
        &sanitized_body,
    )
    .await?;

    // If the determined status differs from the DB default, update it
    if status != ApCommentStatus::Pending {
        ApComment::update_status(pool, comment.id, status.clone(), None).await?;
    }

    tracing::info!(
        comment_id = %comment.id,
        status = ?status,
        author = activity.actor_uri,
        "Inbox processor: created comment from Create(Note)"
    );

    // Notify site admins about the new comment
    let author_label = author_name.unwrap_or(&activity.actor_uri);
    notification_service::notify_federation_event(
        pool.clone(),
        activity.site_id,
        "federation_comment",
        "comment",
        comment.id,
        &format!("New Fediverse comment from {}", author_label),
        None,
    );

    Ok(())
}

// ── Update ──────────────────────────────────────────────────────────────

/// Handle an Update activity — find and update the body of an existing comment.
async fn handle_update(pool: &PgPool, activity: &ApActivity) -> Result<(), ApiError> {
    let payload = &activity.payload;
    let object = match payload.get("object") {
        Some(obj) if obj.is_object() => obj,
        _ => {
            tracing::debug!(
                activity_uri = activity.activity_uri,
                "Inbox processor: Update with non-object payload, skipping"
            );
            return Ok(());
        }
    };

    let note_id = object.get("id").and_then(|i| i.as_str());
    let note_id = match note_id {
        Some(id) => id,
        None => {
            tracing::debug!("Inbox processor: Update object has no id, skipping");
            return Ok(());
        }
    };

    // Find existing comment by activity_uri (which maps to the Note's id)
    let existing = ApComment::find_by_activity_uri(pool, note_id).await?;
    let existing = match existing {
        Some(c) => c,
        None => {
            tracing::debug!(
                note_id = note_id,
                "Inbox processor: Update references unknown comment, skipping"
            );
            return Ok(());
        }
    };

    // Re-sanitize the updated content
    let new_body = object.get("content").and_then(|c| c.as_str()).unwrap_or("");
    let sanitized_body = sanitize_html(new_body);

    // Update body_html but preserve moderation status
    sqlx::query(
        r#"
        UPDATE ap_comments
        SET body_html = $2
        WHERE id = $1
        "#,
    )
    .bind(existing.id)
    .bind(&sanitized_body)
    .execute(pool)
    .await?;

    tracing::info!(
        comment_id = %existing.id,
        "Inbox processor: updated comment body from Update activity"
    );

    Ok(())
}

// ── Delete ──────────────────────────────────────────────────────────────

/// Handle a Delete activity — soft-delete a comment or remove a follower.
async fn handle_delete(pool: &PgPool, activity: &ApActivity) -> Result<(), ApiError> {
    let object_uri = activity.object_uri.as_deref().unwrap_or("");

    if object_uri.is_empty() {
        tracing::debug!("Inbox processor: Delete with no object URI, skipping");
        return Ok(());
    }

    // Try to find a comment matching this object URI
    let comment = ApComment::find_by_activity_uri(pool, object_uri).await?;
    if let Some(c) = comment {
        // Soft-delete: mark as rejected
        ApComment::update_status(pool, c.id, ApCommentStatus::Rejected, None).await?;

        tracing::info!(
            comment_id = %c.id,
            "Inbox processor: soft-deleted comment via Delete activity"
        );
        return Ok(());
    }

    // Try to remove as a follower (actor deleting their Follow)
    let actor =
        crate::models::federation::actor::ApActor::find_by_site_id(pool, activity.site_id).await?;
    if let Some(actor) = actor {
        ApFollower::remove(pool, actor.id, &activity.actor_uri).await?;
        tracing::debug!(
            actor_uri = activity.actor_uri,
            "Inbox processor: removed follower via Delete activity"
        );
    }

    Ok(())
}

// ── Accept / Reject ─────────────────────────────────────────────────────

/// Handle Accept or Reject activities (for outbound Follows we may have sent).
async fn handle_accept_reject(
    pool: &PgPool,
    activity: &ApActivity,
    kind: &str,
) -> Result<(), ApiError> {
    // For now, just log. In the future, if we send Follow requests to other
    // servers (relay subscriptions, etc.), we'd update our outbound Follow status.
    tracing::debug!(
        kind = kind,
        actor = activity.actor_uri,
        "Inbox processor: received {} for outbound activity (future use)",
        kind
    );

    let _ = pool; // Silence unused warning
    Ok(())
}

// ── Helpers ─────────────────────────────────────────────────────────────

/// Check whether a given remote actor URI is a follower of our local actor.
async fn is_actor_follower(
    pool: &PgPool,
    actor_id: Uuid,
    follower_actor_uri: &str,
) -> Result<bool, ApiError> {
    let exists: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM ap_followers
            WHERE actor_id = $1
              AND follower_actor_uri = $2
              AND status = 'accepted'
        )
        "#,
    )
    .bind(actor_id)
    .bind(follower_actor_uri)
    .fetch_one(pool)
    .await?;

    Ok(exists)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_determine_comment_status_queue_all() {
        assert_eq!(
            determine_comment_status("queue_all", false),
            ApCommentStatus::Pending
        );
    }

    #[test]
    fn test_determine_comment_status_queue_all_follower() {
        assert_eq!(
            determine_comment_status("queue_all", true),
            ApCommentStatus::Pending
        );
    }

    #[test]
    fn test_determine_comment_status_auto_all() {
        assert_eq!(
            determine_comment_status("auto_all", false),
            ApCommentStatus::Approved
        );
    }

    #[test]
    fn test_determine_comment_status_auto_all_follower() {
        assert_eq!(
            determine_comment_status("auto_all", true),
            ApCommentStatus::Approved
        );
    }

    #[test]
    fn test_determine_comment_status_auto_followers_is_follower() {
        assert_eq!(
            determine_comment_status("auto_followers", true),
            ApCommentStatus::Approved
        );
    }

    #[test]
    fn test_determine_comment_status_auto_followers_not_follower() {
        assert_eq!(
            determine_comment_status("auto_followers", false),
            ApCommentStatus::Pending
        );
    }

    #[test]
    fn test_determine_comment_status_unknown_mode() {
        assert_eq!(
            determine_comment_status("something_weird", false),
            ApCommentStatus::Pending
        );
    }

    #[test]
    fn test_extract_inner_type_object() {
        let payload = serde_json::json!({
            "type": "Undo",
            "object": {
                "type": "Follow",
                "actor": "https://remote.example/users/alice"
            }
        });
        assert_eq!(extract_inner_type(&payload), Some("Follow".to_string()));
    }

    #[test]
    fn test_extract_inner_type_string_uri() {
        let payload = serde_json::json!({
            "type": "Undo",
            "object": "https://remote.example/activities/123"
        });
        assert_eq!(extract_inner_type(&payload), None);
    }

    #[test]
    fn test_extract_inner_type_missing_object() {
        let payload = serde_json::json!({
            "type": "Undo"
        });
        assert_eq!(extract_inner_type(&payload), None);
    }

    #[test]
    fn test_extract_inner_type_like() {
        let payload = serde_json::json!({
            "type": "Undo",
            "object": {
                "type": "Like",
                "object": "https://example.com/posts/1"
            }
        });
        assert_eq!(extract_inner_type(&payload), Some("Like".to_string()));
    }

    #[test]
    fn test_extract_inner_type_announce() {
        let payload = serde_json::json!({
            "type": "Undo",
            "object": {
                "type": "Announce",
                "object": "https://example.com/posts/1"
            }
        });
        assert_eq!(extract_inner_type(&payload), Some("Announce".to_string()));
    }
}
