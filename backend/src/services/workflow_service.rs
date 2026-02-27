//! Editorial workflow service
//!
//! Validates content status transitions based on site settings and user role.

use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::models::content::ContentStatus;
use crate::models::site_membership::SiteRole;
use crate::models::site_settings::{SiteSetting, KEY_EDITORIAL_WORKFLOW_ENABLED};

/// Validate a content status transition against editorial workflow rules.
///
/// When workflow is disabled (default), all transitions are allowed.
/// When enabled:
/// - Editors/Admins/Owners bypass all restrictions
/// - Authors: can set Draft, Draft→InReview, InReview→Draft (withdraw)
/// - Reviewers: can transition InReview→Published/Scheduled/Draft
pub async fn validate_status_transition(
    pool: &PgPool,
    site_id: Uuid,
    user_role: &SiteRole,
    current_status: &ContentStatus,
    requested_status: &ContentStatus,
) -> Result<(), ApiError> {
    // No change = always ok
    if current_status == requested_status {
        return Ok(());
    }

    // Check if workflow is enabled
    let val = SiteSetting::get_value(pool, site_id, KEY_EDITORIAL_WORKFLOW_ENABLED).await?;
    let workflow_enabled = val.as_bool().unwrap_or(false);
    if !workflow_enabled {
        return Ok(());
    }

    // Editors, Admins, Owners bypass workflow
    if user_role.can_edit_all_content() {
        return Ok(());
    }

    // Author rules
    if user_role.has_at_least(&SiteRole::Author) && !user_role.has_at_least(&SiteRole::Editor) {
        match (current_status, requested_status) {
            // Any → Draft (always allowed for authors)
            (_, ContentStatus::Draft) => return Ok(()),
            // Draft → InReview (submit for review)
            (ContentStatus::Draft, ContentStatus::InReview) => return Ok(()),
            // Everything else is blocked for authors
            _ => {
                return Err(ApiError::Forbidden(
                    "Editorial workflow is enabled. Authors must submit content for review before publishing.".to_string(),
                ));
            }
        }
    }

    // Reviewer rules
    if user_role.has_at_least(&SiteRole::Reviewer) && !user_role.has_at_least(&SiteRole::Author) {
        match (current_status, requested_status) {
            // InReview → Published, Scheduled, Draft
            (ContentStatus::InReview, ContentStatus::Published) => return Ok(()),
            (ContentStatus::InReview, ContentStatus::Scheduled) => return Ok(()),
            (ContentStatus::InReview, ContentStatus::Draft) => return Ok(()),
            _ => {
                return Err(ApiError::Forbidden(
                    "Reviewers can only transition content that is InReview.".to_string(),
                ));
            }
        }
    }

    // Viewers should have been blocked earlier by auth guards, but just in case
    Err(ApiError::Forbidden(
        "You do not have permission to change content status.".to_string(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_status_equality() {
        assert_eq!(ContentStatus::Draft, ContentStatus::Draft);
        assert_eq!(ContentStatus::InReview, ContentStatus::InReview);
        assert_eq!(ContentStatus::Published, ContentStatus::Published);
        assert_eq!(ContentStatus::Scheduled, ContentStatus::Scheduled);
        assert_eq!(ContentStatus::Archived, ContentStatus::Archived);
    }

    #[test]
    fn different_statuses_not_equal() {
        assert_ne!(ContentStatus::Draft, ContentStatus::Published);
        assert_ne!(ContentStatus::InReview, ContentStatus::Scheduled);
        assert_ne!(ContentStatus::Published, ContentStatus::Archived);
    }
}
