//! Content lifecycle orchestrator.
//!
//! Wraps the [`publish_pipeline`](crate::services::publish_pipeline) for
//! the six content entities. Two layers of abstraction live here:
//!
//! * [`create`] — generic over [`ContentEntity`]: blog / page / legal /
//!   project / cv_entry all flow through this single function. The trait
//!   abstracts the entity-specific bits (audit type, webhook prefix, model
//!   insert, payload accessors) so there is no `match entity_type` switch.
//! * [`update`] — generic over [`ContentUpdate`]: blog / page / legal /
//!   project all drive their update through this single function. The trait
//!   abstracts the entity-specific bits (requested-status accessor, current
//!   status, change_diff value, event slug) so update is no longer
//!   hand-rolled per entity.
//! * Per-entity [`blog`] / [`page`] / [`legal`] / [`project`] / [`cv`]
//!   modules — the `ContentEntity` / `ContentUpdate` trait impls plus flat
//!   helpers for `delete`, `clone` (where applicable), and `seed_samples` /
//!   `delete_samples` for blog. These keep entity-specific shapes (legal's
//!   static webhook payload, page's slug-fallback-to-route) without forcing
//!   them into the trait surface. `cv` carries only the `ContentEntity` /
//!   `ContentUpdate` impls — its delete remains a handler-side flow.
//!
//! ## Seam
//!
//! The handler keeps HTTP-layer concerns (DTO validation, permission
//! checks, module guards, response mapping). The lifecycle owns
//! pre-mutation validators, the model mutation, and the post-mutation
//! [`publish_pipeline::execute`] event.
//!
//! ## "publish_blog" et al.
//!
//! There is no separate `publish_*` function: the public API has no
//! `POST /{entity}/:id/publish` route. The publish path lives inside the
//! generic [`update`] — when the requested `status` is `Published` or
//! `Scheduled`, the gate validator runs pre-mutation and
//! `publish_hooks::on_content_published` fires inside `execute` after a
//! successful `Draft → Published` transition.

pub mod blog;
pub mod cv;
pub mod entity;
pub mod legal;
pub mod page;
pub mod project;

pub use entity::ContentEntity;
pub use entity::ContentUpdate;

use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::guards::actor::Actor;
use crate::models::audit::AuditAction;
use crate::models::content::{Content, ContentStatus};
use crate::models::site_membership::SiteRole;
use crate::services::publish_pipeline::{self, PublishEvent, StatusTransition};

/// Generic create driver. Resolves the actor's site role (when the
/// entity opts into editorial workflow), validates the requested status
/// transition, runs the entity's `insert`, then fires the post-mutation
/// pipeline event with the trait-supplied audit type, webhook event
/// name, and payload.
///
/// `webhook_published_event` is set automatically when `webhook_prefix`
/// diverges from `audit_entity_type` (i.e., legal); other entities let
/// `publish_hooks` derive `{audit_entity_type}.published`.
pub async fn create<E: ContentEntity>(
    pool: &PgPool,
    payload: E::CreatePayload,
    auth: &Actor,
) -> Result<E, ApiError> {
    let payload_site_ids = E::payload_site_ids(&payload);
    let initial_site_id = payload_site_ids.first().copied();
    let requested_status = E::requested_status(&payload);

    let actor_role = if E::runs_editorial_workflow() {
        if let Some(site_id) = initial_site_id {
            let role = auth
                .effective_site_role(pool, site_id)
                .await?
                .unwrap_or(SiteRole::Viewer);
            publish_pipeline::validate_status(
                pool,
                site_id,
                &role,
                &ContentStatus::Draft,
                &requested_status,
            )
            .await?;
            Some(role)
        } else {
            None
        }
    } else {
        None
    };

    // Own the unit of work: the spine `contents` row and the entity row
    // commit together. A failure in `E::insert` rolls the spine row back
    // rather than orphaning it (the pre-#863 bug).
    let mut tx = pool.begin().await?;
    let entity = E::insert(&mut tx, payload, auth.user_identifier()).await?;
    tx.commit().await?;

    let entity_id = entity.id();
    let entity_content_id = entity.content_id();

    if requested_status == ContentStatus::Published {
        E::on_published(pool, entity_id).await?;
    }

    let resolved_site_id = match entity_content_id {
        Some(cid) => Content::find_site_ids(pool, cid)
            .await?
            .into_iter()
            .next()
            .or(initial_site_id),
        None => initial_site_id,
    };
    let Some(site_id) = resolved_site_id else {
        return Ok(entity);
    };

    let webhook_payload = entity.webhook_payload();
    let slug = entity.slug();
    let webhook_event = format!("{}.created", E::webhook_prefix());
    let webhook_published_event = if E::webhook_prefix() != E::audit_entity_type() {
        Some(format!("{}.published", E::webhook_prefix()))
    } else {
        None
    };
    let transition = actor_role.map(|role| StatusTransition {
        from: ContentStatus::Draft,
        to: requested_status,
        user_role: role,
    });

    publish_pipeline::execute(
        pool,
        PublishEvent {
            site_id,
            entity_type: E::audit_entity_type(),
            entity_id,
            content_id: entity_content_id.unwrap_or_default(),
            user_id: Some(auth.id),
            clerk_actor_id: auth.user_identifier().map(str::to_string),
            action: AuditAction::Create,
            webhook_event,
            webhook_payload,
            audit_metadata: None,
            status_transition: transition,
            change_diff: None,
            slug,
            webhook_published_event,
        },
    )
    .await?;

    Ok(entity)
}

/// Generic update driver mirroring [`create`]. Validates the requested
/// status transition (editorial workflow), runs the entity's `update`
/// inside one transaction, captures `change_diff`, and fires the
/// post-mutation pipeline event exactly once.
///
/// `webhook_published_event` is set automatically when `webhook_prefix`
/// diverges from `audit_entity_type` (i.e., legal); other entities let
/// `publish_hooks` derive `{audit_entity_type}.published`.
pub async fn update<E: ContentUpdate>(
    pool: &PgPool,
    id: Uuid,
    payload: E::UpdatePayload,
    existing: E,
    site_ids: Vec<Uuid>,
    auth: &Actor,
) -> Result<E, ApiError> {
    let requested_status = E::update_requested_status(&payload);
    let old_diff = existing.change_diff_value();

    // Pre-mutation: validate the requested transition and run the publish
    // gate on a genuine publish transition. Skipped entirely when no status
    // change is requested (project/cv always land here).
    let mut transition: Option<StatusTransition> = None;
    if let Some(ref requested) = requested_status {
        let previous_status = match existing.current_status() {
            Some(s) => s,
            None => match existing.content_id() {
                Some(cid) => Content::find_by_id(pool, cid).await?.status,
                None => ContentStatus::Draft,
            },
        };
        let role = if let Some(&site_id) = site_ids.first() {
            if E::runs_editorial_workflow() {
                let role = auth
                    .effective_site_role(pool, site_id)
                    .await?
                    .unwrap_or(SiteRole::Viewer);
                publish_pipeline::validate_status(
                    pool,
                    site_id,
                    &role,
                    &previous_status,
                    requested,
                )
                .await?;
                Some(role)
            } else {
                // Non-editorial entities (legal) record a deterministic
                // placeholder role; execute() does not consult it.
                Some(SiteRole::Editor)
            }
        } else {
            None
        };
        if publish_pipeline::is_publish_transition(&previous_status, requested) {
            existing.validate_publish_gate(pool).await?;
        }
        transition = role.map(|user_role| StatusTransition {
            from: previous_status,
            to: requested.clone(),
            user_role,
        });
    }

    // Own the unit of work: spine `contents` row + entity row commit together.
    let mut tx = pool.begin().await?;
    let updated = E::update(&mut tx, id, payload).await?;
    tx.commit().await?;

    if transition
        .as_ref()
        .is_some_and(|t| t.to == ContentStatus::Published)
    {
        E::on_published(pool, id).await?;
    }

    let Some(site_id) = site_ids.into_iter().next() else {
        return Ok(updated);
    };

    let change_diff = match (old_diff, updated.change_diff_value()) {
        (Some(old), Some(new)) => Some((old, new)),
        _ => None,
    };
    let webhook_published_event = if E::webhook_prefix() != E::audit_entity_type() {
        Some(format!("{}.published", E::webhook_prefix()))
    } else {
        None
    };

    publish_pipeline::execute(
        pool,
        PublishEvent {
            site_id,
            entity_type: E::audit_entity_type(),
            entity_id: id,
            content_id: updated.content_id().unwrap_or_default(),
            user_id: Some(auth.id),
            clerk_actor_id: auth.user_identifier().map(str::to_string),
            action: AuditAction::Update,
            webhook_event: format!("{}.updated", E::webhook_prefix()),
            webhook_payload: updated.webhook_payload(),
            audit_metadata: None,
            status_transition: transition,
            change_diff,
            slug: updated.update_event_slug(),
            webhook_published_event,
        },
    )
    .await?;

    Ok(updated)
}
