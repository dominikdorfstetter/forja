//! Notification dispatch service
//!
//! Synchronous notification creation for editorial workflow events.
//! Notifications are written to the database before returning, ensuring
//! no events are lost on server restart.

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::notification::Notification;
use crate::models::site_membership::SiteMembership;

/// Notify reviewers that content was submitted for review.
pub(crate) async fn notify_content_submitted(
    pool: &PgPool,
    site_id: Uuid,
    entity_type: &str,
    entity_id: Uuid,
    slug: &str,
    actor_clerk_id: Option<&str>,
) {
    if let Err(e) =
        notify_submitted_inner(pool, site_id, entity_type, entity_id, slug, actor_clerk_id).await
    {
        tracing::warn!("Notification dispatch (submitted) failed: {e}");
    }
}

/// Notify content creator that their content was approved.
pub(crate) async fn notify_content_approved(
    pool: &PgPool,
    site_id: Uuid,
    entity_type: &str,
    entity_id: Uuid,
    slug: &str,
    creator_clerk_id: Option<&str>,
    actor_clerk_id: Option<&str>,
) {
    let Some(creator_id) = creator_clerk_id else {
        return;
    };

    let title = format!("{} '{}' has been approved", capitalize(entity_type), slug);
    if let Err(e) = notify_review_result_inner(
        pool,
        site_id,
        entity_type,
        entity_id,
        creator_id,
        actor_clerk_id,
        "content_approved",
        &title,
        None,
    )
    .await
    {
        tracing::warn!("Notification dispatch (approved) failed: {e}");
    }
}

/// Notify content creator that changes were requested.
#[allow(clippy::too_many_arguments)]
pub(crate) async fn notify_changes_requested(
    pool: &PgPool,
    site_id: Uuid,
    entity_type: &str,
    entity_id: Uuid,
    slug: &str,
    creator_clerk_id: Option<&str>,
    actor_clerk_id: Option<&str>,
    comment: Option<&str>,
) {
    let Some(creator_id) = creator_clerk_id else {
        return;
    };

    let title = format!("Changes requested on {} '{}'", entity_type, slug);
    if let Err(e) = notify_review_result_inner(
        pool,
        site_id,
        entity_type,
        entity_id,
        creator_id,
        actor_clerk_id,
        "changes_requested",
        &title,
        comment,
    )
    .await
    {
        tracing::warn!("Notification dispatch (changes_requested) failed: {e}");
    }
}

/// Notify Editor+ site members that a public form submission was received.
///
/// The notification payload intentionally omits the submission's field data
/// — for privacy and so the notification surface doesn't drift from the
/// admin inbox. The `entity_id` points at the submission row so the admin
/// UI can deep-link into the submission detail view.
pub(crate) async fn notify_form_submission_received(
    pool: &PgPool,
    site_id: Uuid,
    submission_id: Uuid,
    form_name: &str,
    reference_code: &str,
) {
    if let Err(e) =
        notify_form_submission_inner(pool, site_id, submission_id, form_name, reference_code).await
    {
        tracing::warn!("Notification dispatch (form_submission) failed: {e}");
    }
}

/// Notify site Owners/Admins that an API key was auto-blocked by anomaly
/// detection, so they learn about it from the notification bell instead of
/// a failed deploy.
pub(crate) async fn notify_api_key_auto_blocked(
    pool: &PgPool,
    site_id: Uuid,
    api_key_id: Uuid,
    key_name: &str,
    detail: &str,
) {
    if let Err(e) =
        notify_api_key_auto_blocked_inner(pool, site_id, api_key_id, key_name, detail).await
    {
        tracing::warn!("Notification dispatch (api_key_auto_blocked) failed: {e}");
    }
}

async fn notify_api_key_auto_blocked_inner(
    pool: &PgPool,
    site_id: Uuid,
    api_key_id: Uuid,
    key_name: &str,
    detail: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let members = SiteMembership::find_all_for_site(pool, site_id).await?;
    let title = format!("API key '{}' was auto-blocked", key_name);

    for member in &members {
        if !member.role.can_manage_members() {
            continue;
        }
        let _ = Notification::create(
            pool,
            site_id,
            &member.clerk_user_id,
            None, // No actor — blocked by the anomaly detection worker.
            "api_key_blocked",
            "api_key",
            api_key_id,
            &title,
            Some(detail),
        )
        .await;
    }
    Ok(())
}

async fn notify_form_submission_inner(
    pool: &PgPool,
    site_id: Uuid,
    submission_id: Uuid,
    form_name: &str,
    reference_code: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let members = SiteMembership::find_all_for_site(pool, site_id).await?;
    let title = format!(
        "New submission on '{}' — reference {}",
        form_name, reference_code
    );

    for member in &members {
        // Editor+ only — Authors only see their own forms' submissions through
        // the inbox UI, not via push notifications.
        if !member.role.can_edit_all_content() {
            continue;
        }
        let _ = Notification::create(
            pool,
            site_id,
            &member.clerk_user_id,
            None, // No actor — submission came from an unauthenticated visitor.
            "form_submission_received",
            "form_submission",
            submission_id,
            &title,
            None,
        )
        .await;
    }
    Ok(())
}

async fn notify_submitted_inner(
    pool: &PgPool,
    site_id: Uuid,
    entity_type: &str,
    entity_id: Uuid,
    slug: &str,
    actor_clerk_id: Option<&str>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let members = SiteMembership::find_all_for_site(pool, site_id).await?;

    let title = format!(
        "{} '{}' submitted for review",
        capitalize(entity_type),
        slug
    );

    for member in &members {
        if !member.role.can_review() {
            continue;
        }
        if actor_clerk_id == Some(member.clerk_user_id.as_str()) {
            continue;
        }
        let _ = Notification::create(
            pool,
            site_id,
            &member.clerk_user_id,
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
    creator_clerk_id: &str,
    actor_clerk_id: Option<&str>,
    notification_type: &str,
    title: &str,
    message: Option<&str>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if actor_clerk_id == Some(creator_clerk_id) {
        return Ok(());
    }

    let _ = Notification::create(
        pool,
        site_id,
        creator_clerk_id,
        actor_clerk_id,
        notification_type,
        entity_type,
        entity_id,
        title,
        message,
    )
    .await;

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
