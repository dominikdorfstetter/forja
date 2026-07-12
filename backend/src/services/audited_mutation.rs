//! Audit + webhook ordering seam for non-content sibling entities.
//!
//! Narrower sibling to [`super::publish_pipeline`]. The publish pipeline
//! owns the canonical order for the six Content entities
//! (Blog/Page/Legal/Document/CV/Project), including workflow gates,
//! notifications, and `publish_hooks`. Everything else — legal groups,
//! legal items, document folders, navigation, taxonomies, sites,
//! webhooks — runs through this module after a successful mutation.
//!
//! The single guarantee: `audit → webhook` in that order, with the
//! audit row's id surfaced on the webhook payload as `audit_id` so
//! downstream consumers can correlate. Handlers used to inline these
//! two calls; concentrating them here removes the ordering risk and
//! gives us one seam for the CI lint gate (issue #621).

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::audit::{AuditAction, AuditLog};
use crate::services::{audit_service, webhook_service};

/// One mutation's worth of audit + webhook context.
///
/// `change_diff` is the optional `(old, new)` JSON pair passed through
/// to [`audit_service::log_changes`] for field-level history; pass
/// `None` for creates and deletes.
///
/// `webhook_event` is `None` for entities that audit without firing a
/// webhook (e.g. document folders today). When `Some`, the audit row's
/// id is injected into `webhook_payload` under `audit_id` before
/// dispatch so consumers can join back to the audit log.
#[derive(Debug, Clone)]
pub struct MutationEvent {
    /// `None` for global entities (e.g. site-less taxonomy tags) — both
    /// the audit row and the webhook dispatch tolerate a missing
    /// `site_id`; webhooks are site-scoped, so dispatch becomes a no-op
    /// when this is `None`.
    pub site_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    pub action: AuditAction,
    pub entity_type: &'static str,
    pub entity_id: Uuid,
    pub webhook_event: Option<String>,
    pub webhook_payload: serde_json::Value,
    pub audit_metadata: Option<serde_json::Value>,
    pub change_diff: Option<(serde_json::Value, serde_json::Value)>,
}

/// Run audit → optional change-diff → webhook in canonical order.
///
/// Returns the audit row's id when the insert succeeded so callers can
/// correlate downstream. Returns `None` if the audit write itself
/// failed — the failure is logged at `warn` level but never bubbled,
/// matching the fire-and-forget semantics that handlers inlined
/// previously. The webhook is dispatched regardless: a missing audit
/// row is observable in logs and worse than a missing webhook from a
/// caller's perspective.
///
/// When the audit id is available it is injected into
/// `webhook_payload` under the key `audit_id` (as a string) before
/// dispatch, so webhook consumers can join back to the audit log.
pub async fn execute(pool: &PgPool, mut event: MutationEvent) -> Option<Uuid> {
    let audit_id = match AuditLog::create_returning_id(
        pool,
        event.site_id,
        event.user_id,
        event.action.clone(),
        event.entity_type,
        event.entity_id,
        event.audit_metadata.clone(),
    )
    .await
    {
        Ok(id) => Some(id),
        Err(e) => {
            tracing::warn!(
                entity_type = event.entity_type,
                entity_id = %event.entity_id,
                "AuditedMutation: failed to write audit log: {e}"
            );
            None
        }
    };

    if let Some((old, new)) = &event.change_diff {
        audit_service::log_changes(
            pool,
            event.site_id,
            event.entity_type,
            event.entity_id,
            event.user_id,
            old,
            new,
        )
        .await;
    }

    if let (Some(webhook_event), Some(site_id)) = (event.webhook_event.take(), event.site_id) {
        if let Some(id) = audit_id
            && let Some(map) = event.webhook_payload.as_object_mut()
        {
            map.insert("audit_id".to_string(), serde_json::json!(id.to_string()));
        }

        webhook_service::dispatch(
            pool,
            site_id,
            &webhook_event,
            event.entity_id,
            &event.webhook_payload,
        )
        .await;
    }

    audit_id
}

/// A non-content entity whose mutations are audited (and optionally
/// dispatched as webhooks). Pairs the audit-log `entity_type` with the
/// webhook event namespace; the per-action event name (`<prefix>.created`
/// etc.) is derived from the action, so audit and webhook naming cannot
/// drift apart.
///
/// This is deliberately *not* a trait like `ContentEntity` — non-content
/// mutations are simple enough that a descriptor + builder is the right
/// depth. Build one inline at the call site:
///
/// ```ignore
/// AuditedEntity::audit_only("redirect")
///     .mutate(AuditAction::Create, redirect.id)
///     .site(site_id)
///     .actor(actor_id)
///     .execute(&db)
///     .await;
/// ```
#[derive(Debug, Clone, Copy)]
pub struct AuditedEntity {
    /// Value written to the audit log's `entity_type` column.
    pub audit_entity_type: &'static str,
    /// Webhook event namespace, e.g. `"legal"` → `"legal.created"`. `None`
    /// for entities that audit without dispatching a webhook.
    pub webhook_prefix: Option<&'static str>,
}

impl AuditedEntity {
    /// An entity that writes an audit row but never dispatches a webhook.
    pub const fn audit_only(audit_entity_type: &'static str) -> Self {
        Self {
            audit_entity_type,
            webhook_prefix: None,
        }
    }

    /// An entity that audits *and* dispatches `<webhook_prefix>.<action>`
    /// webhooks for create/update/delete.
    pub const fn with_webhooks(
        audit_entity_type: &'static str,
        webhook_prefix: &'static str,
    ) -> Self {
        Self {
            audit_entity_type,
            webhook_prefix: Some(webhook_prefix),
        }
    }

    /// Begin describing one mutation of this entity.
    pub fn mutate(self, action: AuditAction, entity_id: Uuid) -> Mutation {
        Mutation {
            entity: self,
            action,
            entity_id,
            site_id: None,
            user_id: None,
            payload: serde_json::Value::Null,
            audit_metadata: None,
            change_diff: None,
            webhook_override: None,
        }
    }

    /// The webhook event for `action`, or `None` when this entity has no
    /// webhook prefix or the action is not a create/update/delete.
    fn webhook_event(&self, action: &AuditAction) -> Option<String> {
        let prefix = self.webhook_prefix?;
        let suffix = match action {
            AuditAction::Create => "created",
            AuditAction::Update => "updated",
            AuditAction::Delete => "deleted",
            _ => return None,
        };
        Some(format!("{prefix}.{suffix}"))
    }
}

/// Builder over [`audited_mutation::execute`] that lets handlers pass intent
/// instead of hand-wiring a [`MutationEvent`]. Created via
/// [`AuditedEntity::mutate`].
///
/// [`audited_mutation::execute`]: execute
#[derive(Debug, Clone)]
pub struct Mutation {
    entity: AuditedEntity,
    action: AuditAction,
    entity_id: Uuid,
    site_id: Option<Uuid>,
    user_id: Option<Uuid>,
    payload: serde_json::Value,
    audit_metadata: Option<serde_json::Value>,
    change_diff: Option<(serde_json::Value, serde_json::Value)>,
    webhook_override: Option<String>,
}

impl Mutation {
    /// Scope the mutation to a site (drives webhook dispatch + audit `site_id`).
    pub fn site(mut self, site_id: Uuid) -> Self {
        self.site_id = Some(site_id);
        self
    }

    /// Scope to an optional site — `None` for global entities.
    pub fn maybe_site(mut self, site_id: Option<Uuid>) -> Self {
        self.site_id = site_id;
        self
    }

    /// Attribute the mutation to an actor (audit `user_id`).
    pub fn actor(mut self, user_id: Uuid) -> Self {
        self.user_id = Some(user_id);
        self
    }

    /// Attribute to an optional actor.
    pub fn maybe_actor(mut self, user_id: Option<Uuid>) -> Self {
        self.user_id = user_id;
        self
    }

    /// Webhook payload body. The `audit_id` is injected automatically by
    /// [`execute`] before dispatch.
    pub fn payload(mut self, payload: serde_json::Value) -> Self {
        self.payload = payload;
        self
    }

    /// Extra audit-log metadata.
    pub fn metadata(mut self, metadata: serde_json::Value) -> Self {
        self.audit_metadata = Some(metadata);
        self
    }

    /// Optional audit-log metadata.
    pub fn maybe_metadata(mut self, metadata: Option<serde_json::Value>) -> Self {
        self.audit_metadata = metadata;
        self
    }

    /// Field-level `(old, new)` diff for change history.
    pub fn diff(mut self, old: serde_json::Value, new: serde_json::Value) -> Self {
        self.change_diff = Some((old, new));
        self
    }

    /// Optional field-level `(old, new)` diff — `None` skips change history.
    pub fn maybe_diff(mut self, diff: Option<(serde_json::Value, serde_json::Value)>) -> Self {
        self.change_diff = diff;
        self
    }

    /// Override the webhook event derived from the descriptor + action. Use
    /// for entities whose audit action and webhook suffix legitimately diverge
    /// (e.g. a soft-delete recorded as `Update` that fires `<prefix>.deleted`).
    pub fn webhook(mut self, event: impl Into<String>) -> Self {
        self.webhook_override = Some(event.into());
        self
    }

    /// Lower the builder into a [`MutationEvent`].
    fn into_event(self) -> MutationEvent {
        let webhook_event = match self.webhook_override {
            Some(event) => Some(event),
            None => self.entity.webhook_event(&self.action),
        };
        MutationEvent {
            site_id: self.site_id,
            user_id: self.user_id,
            action: self.action,
            entity_type: self.entity.audit_entity_type,
            entity_id: self.entity_id,
            webhook_event,
            webhook_payload: self.payload,
            audit_metadata: self.audit_metadata,
            change_diff: self.change_diff,
        }
    }

    /// Run audit → optional change-diff → webhook in canonical order,
    /// returning the audit row id (see [`execute`]).
    pub async fn execute(self, pool: &PgPool) -> Option<Uuid> {
        execute(pool, self.into_event()).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn webhook_event_derives_from_prefix_and_action() {
        let legal = AuditedEntity::with_webhooks("legal_group", "legal");
        assert_eq!(
            legal.webhook_event(&AuditAction::Create).as_deref(),
            Some("legal.created")
        );
        assert_eq!(
            legal.webhook_event(&AuditAction::Update).as_deref(),
            Some("legal.updated")
        );
        assert_eq!(
            legal.webhook_event(&AuditAction::Delete).as_deref(),
            Some("legal.deleted")
        );
        // Non-CRUD actions never carry a webhook.
        assert_eq!(legal.webhook_event(&AuditAction::Restore), None);
    }

    #[test]
    fn audit_only_entity_never_webhooks() {
        let redirect = AuditedEntity::audit_only("redirect");
        assert_eq!(redirect.webhook_event(&AuditAction::Create), None);
    }

    #[test]
    fn builder_lowers_into_expected_event() {
        let site = Uuid::new_v4();
        let actor = Uuid::new_v4();
        let entity = Uuid::new_v4();
        let event = AuditedEntity::with_webhooks("legal_group", "legal")
            .mutate(AuditAction::Create, entity)
            .site(site)
            .actor(actor)
            .payload(serde_json::json!({"type": "legal_group"}))
            .into_event();

        assert_eq!(event.site_id, Some(site));
        assert_eq!(event.user_id, Some(actor));
        assert_eq!(event.entity_type, "legal_group");
        assert_eq!(event.entity_id, entity);
        assert_eq!(event.webhook_event.as_deref(), Some("legal.created"));
        assert_eq!(
            event.webhook_payload,
            serde_json::json!({"type": "legal_group"})
        );
        assert!(event.audit_metadata.is_none());
        assert!(event.change_diff.is_none());
    }
}
