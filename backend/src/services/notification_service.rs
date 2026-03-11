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
    actor_id: Option<Uuid>,
) {
    let entity_type = entity_type.to_string();
    let slug = slug.to_string();
    tokio::spawn(async move {
        let result =
            notify_submitted_inner(&pool, site_id, &entity_type, entity_id, &slug, actor_id).await;
        if let Err(e) = result {
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
    actor_id: Option<Uuid>,
) {
    let Some(creator_id) = creator_user_id else {
        return;
    };
    let entity_type = entity_type.to_string();
    let slug = slug.to_string();
    tokio::spawn(async move {
        let title = format!("{} '{}' has been approved", capitalize(&entity_type), slug);
        let result = notify_review_result_inner(
            &pool,
            site_id,
            &entity_type,
            entity_id,
            &slug,
            creator_id,
            actor_id,
            "content_approved",
            &title,
            None,
        )
        .await;
        if let Err(e) = result {
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
    actor_id: Option<Uuid>,
    comment: Option<String>,
) {
    let Some(creator_id) = creator_user_id else {
        return;
    };
    let entity_type = entity_type.to_string();
    let slug = slug.to_string();
    tokio::spawn(async move {
        let title = format!("Changes requested on {} '{}'", &entity_type, slug);
        let result = notify_review_result_inner(
            &pool,
            site_id,
            &entity_type,
            entity_id,
            &slug,
            creator_id,
            actor_id,
            "changes_requested",
            &title,
            comment.as_deref(),
        )
        .await;
        if let Err(e) = result {
            tracing::warn!("Notification dispatch (changes_requested) failed: {e}");
        }
    });
}

/// Resolve a user UUID (v5 hash of clerk_user_id) back to the original clerk_user_id
/// by matching against the provided member list.
fn resolve_actor(members: &[SiteMembership], actor_id: Option<Uuid>) -> Option<String> {
    actor_id.and_then(|uuid| {
        members.iter().find_map(|m| {
            let derived = Uuid::new_v5(&CLERK_UUID_NAMESPACE, m.clerk_user_id.as_bytes());
            (derived == uuid).then(|| m.clerk_user_id.clone())
        })
    })
}

async fn notify_submitted_inner(
    pool: &PgPool,
    site_id: Uuid,
    entity_type: &str,
    entity_id: Uuid,
    slug: &str,
    actor_id: Option<Uuid>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let members = SiteMembership::find_all_for_site(pool, site_id).await?;
    let actor_clerk_id = resolve_actor(&members, actor_id);

    let title = format!(
        "{} '{}' submitted for review",
        capitalize(entity_type),
        slug
    );

    for member in &members {
        if !member.role.can_review() {
            continue;
        }
        // Don't notify the actor themselves
        if actor_clerk_id.as_deref() == Some(member.clerk_user_id.as_str()) {
            continue;
        }
        let _ = Notification::create(
            pool,
            site_id,
            &member.clerk_user_id,
            actor_clerk_id.as_deref(),
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
    actor_id: Option<Uuid>,
    notification_type: &str,
    title: &str,
    message: Option<&str>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let members = SiteMembership::find_all_for_site(pool, site_id).await?;

    // Resolve both UUIDs to clerk_user_ids from the member list
    let resolve = |uuid: Uuid| -> Option<String> {
        members.iter().find_map(|m| {
            let derived = Uuid::new_v5(&CLERK_UUID_NAMESPACE, m.clerk_user_id.as_bytes());
            (derived == uuid).then(|| m.clerk_user_id.clone())
        })
    };

    let recipient = resolve(creator_user_id);
    let actor_clerk_id = actor_id.and_then(&resolve);

    if let Some(clerk_id) = recipient {
        // Don't notify the actor themselves
        if actor_clerk_id.as_deref() != Some(clerk_id.as_str()) {
            let _ = Notification::create(
                pool,
                site_id,
                &clerk_id,
                actor_clerk_id.as_deref(),
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
