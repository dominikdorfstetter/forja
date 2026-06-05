//! Publish pipeline orchestrator.
//!
//! Single entry point for the synchronous request-time pipeline that runs
//! when a content entity is created, updated, deleted, or transitions
//! status. The conceptual canonical order across a request is:
//!
//!   validate_status → validate_gate → log_audit → log_changes
//!   → dispatch_webhook → notify → run_publish_hooks
//!
//! In practice the first two steps are **pre-mutation** (so a failed
//! check leaves no orphan row) and the rest are **post-mutation** side
//! effects. Handlers call:
//!
//! * [`validate_status`] before mutating, when the request implies a
//!   status transition.
//! * [`ContentEntity::validate_publish_gate`](crate::services::content_lifecycle::ContentEntity::validate_publish_gate)
//!   before mutating, when the transition targets `Published` or
//!   `Scheduled`. The gate is dispatched per entity by the trait — the
//!   former `match entity_type` switch here was removed in #865.
//! * [`execute`] after a successful mutation, with a [`PublishEvent`]
//!   describing what changed.
//!
//! # Visibility
//!
//! `publish_gate`, `publish_hooks`, and `workflow_service` are
//! `pub(crate)` — handlers and external code must go through this
//! module. The following snippet must not compile:
//!
//! ```compile_fail
//! use forja::services::publish_gate;
//! use forja::services::publish_hooks;
//! use forja::services::workflow_service;
//! ```

use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::models::audit::AuditAction;
use crate::models::content::ContentStatus;
use crate::models::site_membership::SiteRole;
use crate::services::{
    audit_service, notification_service, publish_hooks, webhook_service, workflow_service,
};

/// A status transition request — drives validate_status, validate_gate,
/// notify-on-submit, and on_content_published.
#[derive(Debug, Clone)]
pub struct StatusTransition {
    pub from: ContentStatus,
    pub to: ContentStatus,
    pub user_role: SiteRole,
}

/// Everything the pipeline's post-mutation [`execute`] step needs.
///
/// `entity_type` is the audit-log identifier (e.g. `"legal_document"`,
/// `"skill"`); `webhook_event` is the explicit primary event name
/// (e.g. `"legal.updated"`, `"cv.created"`). When `webhook_published_event`
/// is `None`, the secondary `*.published` event fired by [`publish_hooks`]
/// is derived as `format!("{entity_type}.published")`. Set it explicitly
/// when the audit type and webhook prefix diverge (legal: `"legal_document"`
/// vs `"legal.published"`).
#[derive(Debug, Clone)]
pub struct PublishEvent {
    pub site_id: Uuid,
    pub entity_type: &'static str,
    pub entity_id: Uuid,
    pub content_id: Uuid,

    pub user_id: Option<Uuid>,
    pub clerk_actor_id: Option<String>,

    pub action: AuditAction,
    pub webhook_event: String,
    pub webhook_payload: serde_json::Value,
    pub audit_metadata: Option<serde_json::Value>,

    pub status_transition: Option<StatusTransition>,
    pub change_diff: Option<(serde_json::Value, serde_json::Value)>,
    pub slug: Option<String>,
    pub webhook_published_event: Option<String>,
}

/// Result of a successful pipeline run. Reserved for future signals
/// (e.g. webhook count); current callers ignore it.
#[derive(Debug, Clone)]
pub struct PublishResult {
    pub gate_blocked: bool,
}

/// Pre-mutation: validate that `role` may transition `from → to` under
/// the site's editorial workflow setting. Returns the canonical
/// `WORKFLOW_*` error code on failure so the handler can surface a clean
/// 403 without writing any rows.
pub async fn validate_status(
    pool: &PgPool,
    site_id: Uuid,
    role: &SiteRole,
    from: &ContentStatus,
    to: &ContentStatus,
) -> Result<(), ApiError> {
    workflow_service::validate_status_transition(pool, site_id, role, from, to).await
}

/// True only for a genuine transition *into* a publish-bearing status —
/// `to` is `Published`/`Scheduled` and differs from `from`.
///
/// Re-asserting an unchanged status (e.g. saving an already-`Published`
/// blog) is a no-op and must NOT re-run [`validate_publish_gate`].
/// Otherwise content published before a Site gained locales — or before
/// the coverage gate landed (#678) — becomes permanently un-saveable, since
/// every edit resends `status: Published` and trips the all-or-nothing
/// coverage check. See #781/#782.
pub fn is_publish_transition(from: &ContentStatus, to: &ContentStatus) -> bool {
    from != to && matches!(to, ContentStatus::Published | ContentStatus::Scheduled)
}

/// Run the post-mutation half of the canonical pipeline:
///
///   log_audit → log_changes? → dispatch_webhook → notify? → run_hooks?
///
/// Each conditional step depends on what the event carries — a plain
/// `Create` runs only audit + webhook; a `Draft → Published` transition
/// also fires `publish_hooks::on_content_published` (which itself emits a
/// second `*.published` webhook + audit, preserved for #531's
/// no-behaviour-change constraint).
pub async fn execute(pool: &PgPool, event: PublishEvent) -> Result<PublishResult, ApiError> {
    audit_service::log_action(
        pool,
        Some(event.site_id),
        event.user_id,
        event.action.clone(),
        event.entity_type,
        event.entity_id,
        event.audit_metadata.clone(),
    )
    .await;

    if let Some((old, new)) = &event.change_diff {
        audit_service::log_changes(
            pool,
            Some(event.site_id),
            event.entity_type,
            event.entity_id,
            event.user_id,
            old,
            new,
        )
        .await;
    }

    webhook_service::dispatch(
        pool,
        event.site_id,
        &event.webhook_event,
        event.entity_id,
        &event.webhook_payload,
    )
    .await;

    if let Some(transition) = &event.status_transition {
        if transition.to == ContentStatus::InReview && transition.from != ContentStatus::InReview {
            let slug = event
                .slug
                .clone()
                .unwrap_or_else(|| event.entity_id.to_string());
            notification_service::notify_content_submitted(
                pool,
                event.site_id,
                event.entity_type,
                event.entity_id,
                &slug,
                event.clerk_actor_id.as_deref(),
            )
            .await;
        }
    }

    if let Some(transition) = &event.status_transition {
        if transition.to == ContentStatus::Published && transition.from != ContentStatus::Published
        {
            let published_event = event
                .webhook_published_event
                .clone()
                .unwrap_or_else(|| format!("{}.published", event.entity_type));
            publish_hooks::on_content_published(
                pool,
                event.content_id,
                event.site_id,
                event.entity_type,
                &published_event,
                event.entity_id,
                event.user_id,
                None,
            )
            .await;
        }
    }

    // Drop the site's cached public reads so edits show immediately rather
    // than waiting out the response-cache TTL.
    super::response_cache::invalidate_site(event.site_id).await;

    Ok(PublishResult {
        gate_blocked: false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Tracer bullet for #782: re-asserting the current status must not be
    // treated as a publish transition, so the publish gate is skipped on a
    // plain re-save of already-published content.
    #[test]
    fn published_to_published_is_not_a_transition() {
        assert!(!is_publish_transition(
            &ContentStatus::Published,
            &ContentStatus::Published,
        ));
    }

    #[test]
    fn scheduled_to_scheduled_is_not_a_transition() {
        assert!(!is_publish_transition(
            &ContentStatus::Scheduled,
            &ContentStatus::Scheduled,
        ));
    }

    // The gate's intent is preserved: a real first publish still gates.
    #[test]
    fn draft_to_published_is_a_transition() {
        assert!(is_publish_transition(
            &ContentStatus::Draft,
            &ContentStatus::Published,
        ));
    }

    #[test]
    fn in_review_to_scheduled_is_a_transition() {
        assert!(is_publish_transition(
            &ContentStatus::InReview,
            &ContentStatus::Scheduled,
        ));
    }

    // Transitions away from / between non-publish statuses never gate.
    #[test]
    fn published_to_draft_is_not_a_publish_transition() {
        assert!(!is_publish_transition(
            &ContentStatus::Published,
            &ContentStatus::Draft,
        ));
    }
}
