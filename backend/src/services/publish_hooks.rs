//! Content publish hooks — side effects triggered when content transitions to Published.
//!
//! This module centralizes all side effects that should fire when a content item
//! becomes published, whether triggered by the scheduler or by a manual status change.

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::audit::AuditAction;
use crate::models::site_membership::SiteRole;
use crate::models::site_settings::SiteSetting;
use crate::services::{audit_service, webhook_service};

/// Run all side effects when content transitions to Published.
///
/// - Dispatches a `{entity_type}.published` webhook
/// - Federates the post (if blog, federation enabled, and auto_publish is on)
/// - Logs an audit entry
#[allow(clippy::too_many_arguments)]
pub async fn on_content_published(
    pool: &PgPool,
    content_id: Uuid,
    site_id: Uuid,
    entity_type: &str,
    entity_id: Uuid,
    user_id: Option<Uuid>,
    metadata: Option<&str>,
    public_domain: &str,
) {
    // 1. Webhook dispatch
    let event = format!("{}.published", entity_type);
    let payload = serde_json::json!({
        "content_id": content_id,
        "entity_id": entity_id,
    });
    webhook_service::dispatch(pool.clone(), site_id, &event, entity_id, payload);

    // 2. Federation: only for blogs, only if federation + auto_publish enabled
    if entity_type == "blog" {
        federate_if_enabled(pool, site_id, content_id, public_domain).await;
    }

    // 3. Audit log
    let audit_metadata = metadata.map(|m| serde_json::json!(m));
    audit_service::log_action(
        pool,
        Some(site_id),
        user_id,
        AuditAction::Update,
        entity_type,
        entity_id,
        audit_metadata,
    )
    .await;
}

/// Federate a blog post if federation is enabled and auto_publish is on.
///
/// Uses `SiteRole::Owner` for the RBAC check since this is a system action
/// (either from the scheduler or from an explicit publish by an authorized user).
async fn federate_if_enabled(pool: &PgPool, site_id: Uuid, content_id: Uuid, domain: &str) {
    use crate::models::site_settings::KEY_FEDERATION_AUTO_PUBLISH;
    use crate::services::federation::delivery;
    use crate::services::federation::queue::CompositeQueue;

    // Check auto_publish setting
    let auto_publish =
        match SiteSetting::get_value(pool, site_id, KEY_FEDERATION_AUTO_PUBLISH).await {
            Ok(val) => val.as_bool().unwrap_or(false),
            Err(e) => {
                tracing::debug!("Publish hooks: could not read auto_publish setting: {e}");
                return;
            }
        };

    if !auto_publish {
        tracing::debug!(
            content_id = %content_id,
            "Publish hooks: auto_publish disabled, skipping federation"
        );
        return;
    }

    // Build a queue (same pattern used in admin_notes handler)
    let queue = CompositeQueue::new(pool.clone(), None);

    if let Err(e) =
        delivery::handle_post_published(pool, &queue, site_id, content_id, &SiteRole::Owner, domain)
            .await
    {
        tracing::warn!(
            content_id = %content_id,
            site_id = %site_id,
            "Publish hooks: federation delivery failed: {e}"
        );
    }
}
