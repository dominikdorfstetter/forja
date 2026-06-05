//! Audited site-membership mutations lifted out of their HTTP handlers so
//! the mutation and its audit are inseparable *and* directly testable.
//!
//! A membership mutation lands here when it can't be guarded any other way.
//! Two conditions put it in that bucket:
//!   1. The handler is **Clerk-gated** — it requires `auth.clerk_user_id()`,
//!      so the API-key-only integration harness can't drive it, and an audit
//!      regression on that path would be invisible to CI (this is the exact
//!      condition behind issue #830: the unaudited `transfer_ownership`
//!      shipped silently). `transfer_ownership` and `leave_site` are both
//!      Clerk-gated.
//!   2. The mutation spans **multiple rows** in one transaction, so it can't
//!      be expressed as a single inline `audited_mutation` call
//!      (`transfer_ownership` demotes one row and promotes another).
//!
//! Bundling the mutation with its audit here makes the two inseparable — the
//! only path to the mutation also writes the audit — and exposes a `pub` fn
//! the CI-run `integration_tests` binary can call directly.
//!
//! The HTTP-reachable membership mutations (`add_site_member`,
//! `update_member_role`, `remove_site_member`) deliberately stay INLINE in
//! their handlers: they already audit, are single-row, and are drivable by
//! the API-key harness, so an HTTP integration test asserting their audit
//! rows is the right guard — not a service extraction (which would relocate
//! handler bodies with no gain). See `integration_tests.rs`.

use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::{codes, ApiError};
use crate::models::audit::AuditAction;
use crate::models::site_membership::{SiteMembership, SiteRole};
use crate::services::audited_mutation::{self, MutationEvent};

/// Transfer site ownership and write the corresponding audit row.
///
/// `actor_id` is the stable principal id of the caller (the current owner
/// performing the transfer); it lands on the audit row's `user_id`. The
/// audit row is keyed to the `site` entity (the whole site's ownership
/// changed, not a single membership) with the dedicated
/// [`AuditAction::OwnershipTransfer`], and records both clerk ids in
/// metadata so the activity feed can show who handed off to whom.
///
/// [`AuditAction::OwnershipTransfer`]: crate::models::audit::AuditAction::OwnershipTransfer
pub async fn transfer_ownership(
    pool: &PgPool,
    site_id: Uuid,
    actor_id: Uuid,
    old_owner_clerk_id: &str,
    new_owner_clerk_id: &str,
) -> Result<(), ApiError> {
    SiteMembership::transfer_ownership(pool, site_id, old_owner_clerk_id, new_owner_clerk_id)
        .await?;

    // Audit only after the transfer commits. Fire-and-forget like the other
    // membership mutations: `execute` logs (never bubbles) a write failure.
    // No webhook — ownership transfer is an internal governance event.
    audited_mutation::execute(
        pool,
        MutationEvent {
            site_id: Some(site_id),
            user_id: Some(actor_id),
            action: AuditAction::OwnershipTransfer,
            entity_type: "site",
            entity_id: site_id,
            webhook_event: None,
            webhook_payload: serde_json::Value::Null,
            audit_metadata: Some(serde_json::json!({
                "previous_owner": old_owner_clerk_id,
                "new_owner": new_owner_clerk_id,
            })),
            change_diff: None,
        },
    )
    .await;

    Ok(())
}

/// Remove the caller's own membership on a site (self-leave) and audit it.
///
/// `clerk_user_id` is the caller's Clerk id (the membership to remove);
/// `actor_id` is their stable principal id, recorded as the audit actor.
/// Returns 404 if the caller isn't a member of the site, and 403 if they're
/// the Owner (owners must transfer ownership before leaving).
///
/// Runtime side effects that aren't part of the leave itself — demo-mode
/// opt-out and Redis permission-cache invalidation — stay in the handler
/// around this call; they depend on `AppState`/config, not the membership.
pub async fn leave_site(
    pool: &PgPool,
    site_id: Uuid,
    actor_id: Uuid,
    clerk_user_id: &str,
) -> Result<(), ApiError> {
    let membership = SiteMembership::find_by_clerk_user_and_site(pool, clerk_user_id, site_id)
        .await?
        .ok_or_else(|| {
            ApiError::not_found("Membership not found")
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("membership")
        })?;

    if membership.role == SiteRole::Owner {
        return Err(
            ApiError::forbidden("Site owners must transfer ownership before leaving")
                .with_code(codes::SITE_OWNER_CANNOT_LEAVE),
        );
    }

    SiteMembership::delete(pool, membership.id).await?;

    // Audit after the delete commits, keyed to the removed membership —
    // same shape as the inline `remove_site_member` audit, fire-and-forget.
    audited_mutation::execute(
        pool,
        MutationEvent {
            site_id: Some(site_id),
            user_id: Some(actor_id),
            action: AuditAction::Delete,
            entity_type: "member",
            entity_id: membership.id,
            webhook_event: None,
            webhook_payload: serde_json::Value::Null,
            audit_metadata: None,
            change_diff: None,
        },
    )
    .await;

    Ok(())
}
