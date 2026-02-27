//! Notification dispatch service
//!
//! Fire-and-forget notification creation for editorial workflow events.

use sqlx::PgPool;
use uuid::Uuid;

use crate::guards::auth_guard::CLERK_UUID_NAMESPACE;
use crate::models::notification::Notification;
use crate::models::site_membership::SiteMembership;

/// Notify reviewers that content was submitted for review (fire-and-forget).
pub fn notify_content_submitted(
    pool: PgPool,
    site_id: Uuid,
    entity_type: &str,
    entity_id: Uuid,
    slug: &str,
    actor_clerk_id: Option<String>,
) {
    let entity_type = entity_type.to_string();
    let slug = slug.to_string();
    let actor = actor_clerk_id.clone();
    tokio::spawn(async move {
        if let Err(e) = notify_submitted_inner(
            &pool,
            site_id,
            &entity_type,
            entity_id,
            &slug,
            actor.as_deref(),
        )
        .await
        {
            tracing::warn!("Notification dispatch (submitted) failed: {e}");
        }
    });
}

/// Notify content creator that their content was approved (fire-and-forget).
pub fn notify_content_approved(
    pool: PgPool,
    site_id: Uuid,
    entity_type: &str,
    entity_id: Uuid,
    slug: &str,
    creator_user_id: Option<Uuid>,
    actor_clerk_id: Option<String>,
) {
    let Some(creator_id) = creator_user_id else {
        return;
    };
    let entity_type = entity_type.to_string();
    let slug = slug.to_string();
    let actor = actor_clerk_id.clone();
    tokio::spawn(async move {
        if let Err(e) = notify_review_result_inner(
            &pool,
            site_id,
            &entity_type,
            entity_id,
            &slug,
            creator_id,
            actor.as_deref(),
            "content_approved",
            &format!("{} '{}' has been approved", capitalize(&entity_type), slug),
            None,
        )
        .await
        {
            tracing::warn!("Notification dispatch (approved) failed: {e}");
        }
    });
}

/// Notify content creator that changes were requested (fire-and-forget).
#[allow(clippy::too_many_arguments)]
pub fn notify_changes_requested(
    pool: PgPool,
    site_id: Uuid,
    entity_type: &str,
    entity_id: Uuid,
    slug: &str,
    creator_user_id: Option<Uuid>,
    actor_clerk_id: Option<String>,
    comment: Option<String>,
) {
    let Some(creator_id) = creator_user_id else {
        return;
    };
    let entity_type = entity_type.to_string();
    let slug = slug.to_string();
    let actor = actor_clerk_id.clone();
    tokio::spawn(async move {
        if let Err(e) = notify_review_result_inner(
            &pool,
            site_id,
            &entity_type,
            entity_id,
            &slug,
            creator_id,
            actor.as_deref(),
            "changes_requested",
            &format!("Changes requested on {} '{}'", &entity_type, slug),
            comment.as_deref(),
        )
        .await
        {
            tracing::warn!("Notification dispatch (changes_requested) failed: {e}");
        }
    });
}

async fn notify_submitted_inner(
    pool: &PgPool,
    site_id: Uuid,
    entity_type: &str,
    entity_id: Uuid,
    slug: &str,
    actor_clerk_id: Option<&str>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let reviewer_ids = find_reviewer_clerk_ids(pool, site_id).await?;
    let title = format!(
        "{} '{}' submitted for review",
        capitalize(entity_type),
        slug
    );

    for clerk_id in reviewer_ids {
        // Don't notify the actor themselves
        if actor_clerk_id == Some(clerk_id.as_str()) {
            continue;
        }
        let _ = Notification::create(
            pool,
            site_id,
            &clerk_id,
            actor_clerk_id,
            "content_submitted",
            entity_type,
            entity_id,
            &title,
            None,
        )
        .await;
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn notify_review_result_inner(
    pool: &PgPool,
    site_id: Uuid,
    entity_type: &str,
    entity_id: Uuid,
    _slug: &str,
    creator_user_id: Uuid,
    actor_clerk_id: Option<&str>,
    notification_type: &str,
    title: &str,
    message: Option<&str>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let recipient = resolve_clerk_user_id(pool, site_id, creator_user_id).await?;
    if let Some(clerk_id) = recipient {
        // Don't notify the actor themselves
        if actor_clerk_id != Some(clerk_id.as_str()) {
            let _ = Notification::create(
                pool,
                site_id,
                &clerk_id,
                actor_clerk_id,
                notification_type,
                entity_type,
                entity_id,
                title,
                message,
            )
            .await;
        }
    }
    Ok(())
}

/// Resolve a UUID v5 (derived from clerk_user_id) back to the original clerk_user_id
/// by iterating site members and matching the hash.
async fn resolve_clerk_user_id(
    pool: &PgPool,
    site_id: Uuid,
    user_uuid: Uuid,
) -> Result<Option<String>, Box<dyn std::error::Error + Send + Sync>> {
    let members = SiteMembership::find_all_for_site(pool, site_id).await?;
    for member in members {
        let derived = Uuid::new_v5(&CLERK_UUID_NAMESPACE, member.clerk_user_id.as_bytes());
        if derived == user_uuid {
            return Ok(Some(member.clerk_user_id));
        }
    }
    Ok(None)
}

/// Find clerk_user_ids of all site members who can review content.
async fn find_reviewer_clerk_ids(
    pool: &PgPool,
    site_id: Uuid,
) -> Result<Vec<String>, Box<dyn std::error::Error + Send + Sync>> {
    let members = SiteMembership::find_all_for_site(pool, site_id).await?;
    let ids: Vec<String> = members
        .into_iter()
        .filter(|m| m.role.can_review())
        .map(|m| m.clerk_user_id)
        .collect();
    Ok(ids)
}

fn capitalize(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().to_string() + c.as_str(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capitalize_lowercase() {
        assert_eq!(capitalize("blog"), "Blog");
    }

    #[test]
    fn capitalize_already_capitalized() {
        assert_eq!(capitalize("Blog"), "Blog");
    }

    #[test]
    fn capitalize_empty_string() {
        assert_eq!(capitalize(""), "");
    }

    #[test]
    fn capitalize_single_char() {
        assert_eq!(capitalize("x"), "X");
    }
}
