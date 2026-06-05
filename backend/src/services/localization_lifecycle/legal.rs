//! Legal localization marker + `LocalizationEntity` impl.
//!
//! Mirrors `content_lifecycle::legal`'s naming divergence: the audit log
//! uses `"legal_document_localization"` (matching the parent's
//! `legal_document` audit type) while the public webhook namespace stays
//! `legal.*` (so events are `legal.localization.created` etc., not
//! `legal_document.localization.created`).

use crate::guards::module_guard::LegalModule;

use super::entity::LocalizationEntity;

/// Zero-sized marker selecting the legal-localization shape of the
/// generic lifecycle drivers. Use as the type parameter:
/// `localization_lifecycle::create::<LegalLocalization>(...)`.
pub struct LegalLocalization;

impl LocalizationEntity for LegalLocalization {
    type Module = LegalModule;

    fn audit_entity_type() -> &'static str {
        "legal_document_localization"
    }

    fn webhook_prefix() -> &'static str {
        "legal.localization"
    }

    fn permission_resource() -> &'static str {
        "legal"
    }
}
