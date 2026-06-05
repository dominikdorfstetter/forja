//! `LocalizationEntity` trait — the abstraction that lets one generic
//! `localization_lifecycle::create::<E>` function drive blog / page /
//! legal localizations without an `entity_type`-string switch.
//!
//! Mirrors the `ContentEntity` shape from `content_lifecycle::entity`,
//! but stays thinner: localization rows don't carry status or editorial
//! workflow, so the trait surface is three static accessors plus an
//! associated module marker.

use crate::guards::module_guard::ModuleMarker;

/// Marker for a Content entity type whose translations the lifecycle can
/// drive. Each implementor is a zero-sized marker (e.g. `BlogLocalization`)
/// — the type parameter encodes the entity kind at compile time, so the
/// generic drivers in [`super`] never branch on a string.
pub trait LocalizationEntity: Send + Sync + 'static {
    /// Module guard marker (e.g. `BlogModule`) used to enforce that the
    /// site has this Content module enabled before mutating its
    /// localizations.
    type Module: ModuleMarker;

    /// String written to `audit_logs.entity_type` for create / update /
    /// delete events on this localization. Convention: `"<entity>_localization"`
    /// (e.g. `"blog_localization"`).
    fn audit_entity_type() -> &'static str;

    /// Webhook event prefix. The lifecycle emits `{prefix}.{verb}` events
    /// where verb is `created` / `updated` / `deleted`
    /// (e.g. `blog.localization.created`).
    fn webhook_prefix() -> &'static str;

    /// Permission resource string. The lifecycle requires
    /// `{resource}:{action}` on each Site the parent Content belongs to
    /// before mutating — e.g. blog localizations require `blog:create`,
    /// matching the pre-lifecycle handler behaviour.
    fn permission_resource() -> &'static str;
}
