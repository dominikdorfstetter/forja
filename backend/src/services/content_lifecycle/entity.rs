//! `ContentEntity` trait — the abstraction that lets one generic
//! `content_lifecycle::create::<E>` function drive blog, page, legal,
//! and project creates without an `entity_type`-string switch.
//!
//! ## Surface
//!
//! Eight methods, three with sensible defaults:
//!
//! * [`audit_entity_type`](ContentEntity::audit_entity_type) — string
//!   written to `audit_logs.entity_type` (e.g. `"blog"`, `"legal_document"`).
//! * [`webhook_prefix`](ContentEntity::webhook_prefix) — defaults to the
//!   audit type; legal overrides because its public webhook namespace is
//!   `legal.*` while its audit type is `legal_document`.
//! * [`runs_editorial_workflow`](ContentEntity::runs_editorial_workflow)
//!   — defaults to `true`; legal and project return `false` because their
//!   handlers don't gate status transitions through the editorial
//!   workflow service.
//! * [`insert`](ContentEntity::insert) — model-level INSERT.
//! * [`id`](ContentEntity::id), [`content_id`](ContentEntity::content_id),
//!   [`slug`](ContentEntity::slug) — read accessors used to populate the
//!   post-mutation [`PublishEvent`](crate::services::publish_pipeline::PublishEvent).
//!   `content_id` returns `Option` so legal documents (whose content_id
//!   column is nullable) can opt in / out cleanly.
//! * [`requested_status`](ContentEntity::requested_status),
//!   [`payload_site_ids`](ContentEntity::payload_site_ids) — extract
//!   create-payload fields the lifecycle needs for the StatusTransition
//!   and the audit site_id.
//! * [`webhook_payload`](ContentEntity::webhook_payload) — JSON shape sent
//!   on `{prefix}.created`. Defaults to the entity's own JSON
//!   serialization; legal overrides to a static `{"type": "legal_document"}`
//!   payload (matching the pre-refactor shape).
//!
//! Each implementor lives in its own file (`blog.rs`, `page.rs`, etc.) to
//! co-locate the trait impl with the entity-specific helpers
//! (update / delete / clone) the lifecycle module exposes.

use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

use crate::errors::ApiError;
use crate::models::content::ContentStatus;

/// Marker for a content entity that the publish pipeline can drive.
/// See module docstring for trait surface intent.
pub trait ContentEntity: Sized + Send + Sync + 'static {
    /// The DTO type describing a create request for this entity.
    type CreatePayload: Send;

    fn audit_entity_type() -> &'static str;

    fn webhook_prefix() -> &'static str {
        Self::audit_entity_type()
    }

    fn runs_editorial_workflow() -> bool {
        true
    }

    /// Insert the entity's spine `contents` row **and** its own table row on
    /// the supplied transaction connection. The generic
    /// [`create`](super::create) owns the `tx`, threads `&mut *tx` here, and
    /// commits once — so a failure mid-insert rolls back the spine row too.
    fn insert(
        conn: &mut PgConnection,
        payload: Self::CreatePayload,
        user_id: Option<&str>,
    ) -> impl std::future::Future<Output = Result<Self, ApiError>> + Send;

    fn id(&self) -> Uuid;
    fn content_id(&self) -> Option<Uuid>;
    fn slug(&self) -> Option<String>;

    fn requested_status(payload: &Self::CreatePayload) -> ContentStatus;
    fn payload_site_ids(payload: &Self::CreatePayload) -> Vec<Uuid>;

    fn webhook_payload(&self) -> serde_json::Value;

    /// Pre-mutation publish gate: validate that this entity's body is complete
    /// enough to publish. The default **allows** publish — entity types with no
    /// body-completeness rules (project, cv_entry) inherit it. blog / page /
    /// legal override to run their `publish_gate` validators and surface a
    /// `VALIDATION_ERROR` 400 when blocked. This trait method replaces the
    /// former `match entity_type` dispatch in `publish_pipeline` (#865), so an
    /// unwired entity type is a compile-time gap, not a runtime internal error.
    fn validate_publish_gate(
        &self,
        pool: &PgPool,
    ) -> impl std::future::Future<Output = Result<(), ApiError>> + Send {
        let _ = pool;
        async { Ok(()) }
    }

    /// Post-commit hook fired by the generic [`create`](super::create) /
    /// [`update`](super::update) drivers whenever the entity lands in
    /// `Published`. The default is a no-op; legal overrides it to supersede
    /// its chain siblings so exactly one version of a document is ever live —
    /// owning the rule here means EVERY publish entry point that flows
    /// through the lifecycle upholds it, not just one handler.
    fn on_published(
        pool: &PgPool,
        entity_id: Uuid,
    ) -> impl std::future::Future<Output = Result<(), ApiError>> + Send {
        let _ = (pool, entity_id);
        async { Ok(()) }
    }
}

/// Capability a [`ContentEntity`] gains to flow through the generic
/// [`update`](super::update) driver. A supertrait (not methods on
/// `ContentEntity`) so entities onboard one slice at a time —
/// associated-type defaults are unstable, so adding `UpdatePayload`
/// to `ContentEntity` itself would force every impl to change at once.
pub trait ContentUpdate: ContentEntity {
    /// DTO describing an update request for this entity.
    type UpdatePayload: Send;

    /// Apply the update to the entity + spine rows on the supplied tx
    /// connection. Mirrors [`ContentEntity::insert`]; the generic
    /// [`update`](super::update) owns the `tx` and commits once, so a
    /// failure here rolls the spine change back too.
    fn update(
        conn: &mut PgConnection,
        id: Uuid,
        payload: Self::UpdatePayload,
    ) -> impl std::future::Future<Output = Result<Self, ApiError>> + Send;

    /// Status requested by an update payload. `None` means "no transition
    /// for this update" — either the payload carries no status, or the
    /// entity opts out of status transitions entirely (project, cv_entry).
    fn update_requested_status(payload: &Self::UpdatePayload) -> Option<ContentStatus>;

    /// The entity's current persisted status when carried on the struct
    /// (blog/page/project return `Some`). legal/cv carry status only on the
    /// spine `contents` row, so they return `None` and the driver reads it
    /// from `content_id`.
    fn current_status(&self) -> Option<ContentStatus> {
        None
    }

    /// JSON snapshot for the `change_diff` audit field. `None` (default)
    /// captures no diff (legal/project/cv parity). blog/page return
    /// `Some(self serialized)` so the driver records old→new.
    fn change_diff_value(&self) -> Option<serde_json::Value> {
        None
    }

    /// Slug recorded on the post-update `PublishEvent`. Defaults to
    /// [`ContentEntity::slug`]; project overrides to `None` (its update
    /// never recorded a slug).
    fn update_event_slug(&self) -> Option<String> {
        self.slug()
    }
}
