//! Content publish hooks — side effects triggered when content transitions to Published.
//!
//! This module centralizes all side effects that should fire when a content item
//! becomes published, whether triggered by the scheduler or by a manual status change.

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::audit::AuditAction;
use crate::services::{audit_service, webhook_service};

/// Run all side effects when content transitions to Published.
///
/// - Dispatches the supplied `webhook_event` (e.g. `"blog.published"`,
///   `"legal.published"`)
/// - Logs an audit entry under `audit_entity_type`
///
/// `webhook_event` is passed explicitly rather than derived from
/// `audit_entity_type` because some entities use distinct identifiers for
/// audit (`legal_document`) and webhook prefixes (`legal`).
#[allow(clippy::too_many_arguments)]
pub(crate) async fn on_content_published(
    pool: &PgPool,
    content_id: Uuid,
    site_id: Uuid,
    audit_entity_type: &str,
    webhook_event: &str,
    entity_id: Uuid,
    user_id: Option<Uuid>,
    metadata: Option<&str>,
) {
    // 1. Webhook dispatch
    let payload = serde_json::json!({
        "content_id": content_id,
        "entity_id": entity_id,
    });
    webhook_service::dispatch(pool, site_id, webhook_event, entity_id, &payload).await;

    // 2. Audit log
    let audit_metadata = metadata.map(|m| serde_json::json!(m));
    audit_service::log_action(
        pool,
        Some(site_id),
        user_id,
        AuditAction::Update,
        audit_entity_type,
        entity_id,
        audit_metadata,
    )
    .await;
}
