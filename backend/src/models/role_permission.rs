//! The one home for the site-role → API-key-permission vocabulary.
//!
//! Two questions look identical but are not, and were previously answered by
//! two divergent, unnamed `match` blocks (`site_membership::to_api_key_permission`
//! and `handlers::api_key::max_permission_for_role`):
//!
//! - [`effective`] — *what permission does this role grant its holder?* This is
//!   the permission a member with the role acts under. An [`SiteRole::Owner`]
//!   is effectively [`ApiKeyPermission::Master`]: full control of their site.
//!
//! - [`creation_cap`] — *what is the strongest key this role may mint?* This is
//!   the ceiling enforced when a member creates an API key. An
//!   [`SiteRole::Owner`] caps at [`ApiKeyPermission::Admin`], one tier below
//!   their effective level.
//!
//! The deliberate gap at `Owner` is the whole reason these are separate:
//! `Master` keys carry system/cross-site authority (see
//! [`ApiKeyPermission::can_manage_keys`]). A site owner wields Master-level
//! authority *within* their own site, but must not be able to mint a standalone
//! Master key — that privilege is reserved for system administrators. Collapsing
//! the two maps would either strip owners of control or let them escalate.
//!
//! [`SiteRole::Owner`]: crate::models::site_membership::SiteRole::Owner
//! [`ApiKeyPermission::Master`]: crate::models::api_key::ApiKeyPermission::Master
//! [`ApiKeyPermission::Admin`]: crate::models::api_key::ApiKeyPermission::Admin
//! [`ApiKeyPermission::can_manage_keys`]: crate::models::api_key::ApiKeyPermission::can_manage_keys

use crate::models::api_key::ApiKeyPermission;
use crate::models::site_membership::SiteRole;

/// The API-key permission a holder of `role` effectively acts under.
pub fn effective(role: &SiteRole) -> ApiKeyPermission {
    match role {
        SiteRole::Owner => ApiKeyPermission::Master,
        SiteRole::Admin => ApiKeyPermission::Admin,
        SiteRole::Editor | SiteRole::Author => ApiKeyPermission::Write,
        SiteRole::Reviewer | SiteRole::Viewer => ApiKeyPermission::Read,
    }
}

/// The strongest API-key permission a holder of `role` may mint.
///
/// One tier below [`effective`] at `Owner` (Admin, not Master) so site owners
/// cannot create the system-level Master keys reserved for administrators.
pub fn creation_cap(role: &SiteRole) -> ApiKeyPermission {
    match role {
        SiteRole::Owner => ApiKeyPermission::Admin,
        SiteRole::Admin => ApiKeyPermission::Write,
        _ => ApiKeyPermission::Read,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn owner_effective_exceeds_creation_cap() {
        // Tracer: the one role where the two answers diverge. An owner acts as
        // Master but may only mint up to Admin.
        assert_eq!(effective(&SiteRole::Owner), ApiKeyPermission::Master);
        assert_eq!(creation_cap(&SiteRole::Owner), ApiKeyPermission::Admin);
    }

    #[test]
    fn effective_maps_every_role() {
        assert_eq!(effective(&SiteRole::Owner), ApiKeyPermission::Master);
        assert_eq!(effective(&SiteRole::Admin), ApiKeyPermission::Admin);
        assert_eq!(effective(&SiteRole::Editor), ApiKeyPermission::Write);
        assert_eq!(effective(&SiteRole::Author), ApiKeyPermission::Write);
        assert_eq!(effective(&SiteRole::Reviewer), ApiKeyPermission::Read);
        assert_eq!(effective(&SiteRole::Viewer), ApiKeyPermission::Read);
    }

    #[test]
    fn creation_cap_maps_every_role() {
        assert_eq!(creation_cap(&SiteRole::Owner), ApiKeyPermission::Admin);
        assert_eq!(creation_cap(&SiteRole::Admin), ApiKeyPermission::Write);
        assert_eq!(creation_cap(&SiteRole::Editor), ApiKeyPermission::Read);
        assert_eq!(creation_cap(&SiteRole::Author), ApiKeyPermission::Read);
        assert_eq!(creation_cap(&SiteRole::Reviewer), ApiKeyPermission::Read);
        assert_eq!(creation_cap(&SiteRole::Viewer), ApiKeyPermission::Read);
    }
}
