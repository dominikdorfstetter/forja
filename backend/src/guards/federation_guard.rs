//! Federation RBAC guard functions
//!
//! Role-based access control functions for federation features.
//! These are standalone functions (not request guards) so handlers
//! can call them after resolving the caller's `SiteRole`.

use crate::models::site_membership::SiteRole;

/// Can view federation status, followers, comments (read-only dashboards).
pub fn can_view_federation(role: &SiteRole) -> bool {
    matches!(
        role,
        SiteRole::Reviewer | SiteRole::Editor | SiteRole::Admin | SiteRole::Owner
    )
}

/// Can moderate federated comments (approve / reject / delete).
pub fn can_moderate_federation(role: &SiteRole) -> bool {
    matches!(
        role,
        SiteRole::Reviewer | SiteRole::Editor | SiteRole::Admin | SiteRole::Owner
    )
}

/// Can trigger "publish to fediverse" for a post.
pub fn can_publish_to_fediverse(role: &SiteRole) -> bool {
    matches!(role, SiteRole::Reviewer | SiteRole::Admin | SiteRole::Owner)
}

/// Can change federation settings (signature algo, moderation mode, etc.).
pub fn can_manage_federation(role: &SiteRole) -> bool {
    matches!(role, SiteRole::Admin | SiteRole::Owner)
}

/// Can enable/disable federation, rotate keys — destructive operations.
pub fn can_admin_federation(role: &SiteRole) -> bool {
    matches!(role, SiteRole::Owner)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_can_view_federation() {
        assert!(!can_view_federation(&SiteRole::Viewer));
        assert!(!can_view_federation(&SiteRole::Author));
        assert!(can_view_federation(&SiteRole::Reviewer));
        assert!(can_view_federation(&SiteRole::Editor));
        assert!(can_view_federation(&SiteRole::Admin));
        assert!(can_view_federation(&SiteRole::Owner));
    }

    #[test]
    fn test_can_moderate_federation() {
        assert!(!can_moderate_federation(&SiteRole::Viewer));
        assert!(!can_moderate_federation(&SiteRole::Author));
        assert!(can_moderate_federation(&SiteRole::Reviewer));
        assert!(can_moderate_federation(&SiteRole::Editor));
        assert!(can_moderate_federation(&SiteRole::Admin));
        assert!(can_moderate_federation(&SiteRole::Owner));
    }

    #[test]
    fn test_can_publish_to_fediverse() {
        assert!(!can_publish_to_fediverse(&SiteRole::Viewer));
        assert!(!can_publish_to_fediverse(&SiteRole::Author));
        assert!(can_publish_to_fediverse(&SiteRole::Reviewer));
        assert!(!can_publish_to_fediverse(&SiteRole::Editor));
        assert!(can_publish_to_fediverse(&SiteRole::Admin));
        assert!(can_publish_to_fediverse(&SiteRole::Owner));
    }

    #[test]
    fn test_can_manage_federation() {
        assert!(!can_manage_federation(&SiteRole::Viewer));
        assert!(!can_manage_federation(&SiteRole::Author));
        assert!(!can_manage_federation(&SiteRole::Reviewer));
        assert!(!can_manage_federation(&SiteRole::Editor));
        assert!(can_manage_federation(&SiteRole::Admin));
        assert!(can_manage_federation(&SiteRole::Owner));
    }

    #[test]
    fn test_can_admin_federation() {
        assert!(!can_admin_federation(&SiteRole::Viewer));
        assert!(!can_admin_federation(&SiteRole::Author));
        assert!(!can_admin_federation(&SiteRole::Reviewer));
        assert!(!can_admin_federation(&SiteRole::Editor));
        assert!(!can_admin_federation(&SiteRole::Admin));
        assert!(can_admin_federation(&SiteRole::Owner));
    }
}
