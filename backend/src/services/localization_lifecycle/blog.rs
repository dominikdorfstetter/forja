//! Blog localization marker + `LocalizationEntity` impl. See module
//! docstring on `super` for the seam this plugs into.

use crate::guards::module_guard::BlogModule;

use super::entity::LocalizationEntity;

/// Zero-sized marker selecting the blog-localization shape of the
/// generic lifecycle drivers. Use as the type parameter:
/// `localization_lifecycle::create::<BlogLocalization>(...)`.
pub struct BlogLocalization;

impl LocalizationEntity for BlogLocalization {
    type Module = BlogModule;

    fn audit_entity_type() -> &'static str {
        "blog_localization"
    }

    fn webhook_prefix() -> &'static str {
        "blog.localization"
    }

    fn permission_resource() -> &'static str {
        "blog"
    }
}
