//! Page localization marker + `LocalizationEntity` impl. See module
//! docstring on `super` for the seam this plugs into.

use crate::guards::module_guard::PagesModule;

use super::entity::LocalizationEntity;

/// Zero-sized marker selecting the page-localization shape of the
/// generic lifecycle drivers. Use as the type parameter:
/// `localization_lifecycle::create::<PageLocalization>(...)`.
pub struct PageLocalization;

impl LocalizationEntity for PageLocalization {
    type Module = PagesModule;

    fn audit_entity_type() -> &'static str {
        "page_localization"
    }

    fn webhook_prefix() -> &'static str {
        "page.localization"
    }

    fn permission_resource() -> &'static str {
        "page"
    }
}
