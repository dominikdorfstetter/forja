//! Restore and permanent-delete of soft-deleted entities, by entity type.
//!
//! Both endpoints carried a per-entity `match` (media / document / legal /
//! social / menu / menu_item / project / cv_entry / skill / content) of
//! near-identical boilerplate — resolve the entity's site(s) → gate permission
//! → repo op (+ storage delete, for media permanent-delete) → audit. That
//! shared boilerplate now lives in two helpers ([`require_perm_all`] and
//! [`audit_trash`]); each handler is a thin call to [`restore`] or
//! [`permanent_delete`].
//!
//! The two paths are deliberately symmetric: `restore` gates `update` and
//! audits an `Update`; `permanent_delete` gates `delete` and audits a `Delete`.
//! Every content arm fails **closed** on a site-less (orphaned) row — there is
//! no site to authorize against, so the only safe answer is `404`, never a
//! silent op. This matters most on `permanent_delete`, which is irreversible
//! and erases encrypted documents from storage.

use std::sync::Arc;

use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::{ApiError, codes};
use crate::guards::actor::Actor;
use crate::models::audit::AuditAction;
use crate::models::content::Content;
use crate::models::media::{MediaFile, MediaVariant};
use crate::models::navigation::NavigationItem;
use crate::models::navigation_menu::NavigationMenu;
use crate::models::social::SocialLink;
use crate::repos::cv_repo::SkillRepo;
use crate::repos::document_repo::DocumentRepo;
use crate::repos::legal_repo::LegalDocumentRepo;
use crate::services::audited_mutation::{self, MutationEvent};
use crate::services::content_service::ContentService;
use crate::services::permission_service::{Permission, PermissionService};
use crate::services::storage::StorageBackend;

/// Require `action` on `resource` for every one of `sites`. Used so a
/// multi-site entity is authorized against each site it belongs to. `restore`
/// passes `"update"`; `permanent_delete` passes `"delete"`.
async fn require_perm_all(
    pool: &PgPool,
    actor: &Actor,
    sites: &[Uuid],
    resource: &str,
    action: &str,
) -> Result<(), ApiError> {
    for site_id in sites {
        PermissionService::require(pool, actor, *site_id, &Permission::new(resource, action))
            .await?;
    }
    Ok(())
}

/// Audit a trash mutation against the `trash` entity, recording the operation
/// (`restore` / `permanent_delete`) and — when present — the affected entity
/// type. `type_label` of `None` omits the `type` field (the legacy
/// default-branch shape for plain content).
async fn audit_trash(
    pool: &PgPool,
    actor_id: Uuid,
    id: Uuid,
    site_id: Option<Uuid>,
    action: AuditAction,
    op: &str,
    type_label: Option<&str>,
) {
    let metadata = match type_label {
        Some(t) => serde_json::json!({ "action": op, "type": t }),
        None => serde_json::json!({ "action": op }),
    };
    audited_mutation::execute(
        pool,
        MutationEvent {
            site_id,
            user_id: Some(actor_id),
            action,
            entity_type: "trash",
            entity_id: id,
            webhook_event: None,
            webhook_payload: serde_json::Value::Null,
            audit_metadata: Some(metadata),
            change_diff: None,
        },
    )
    .await;
}

/// Restore the soft-deleted entity `id` of the given `entity_type`, after
/// gating the actor's `update` permission on the entity's site(s).
pub async fn restore(
    pool: &PgPool,
    actor: &Actor,
    entity_type: &str,
    id: Uuid,
) -> Result<(), ApiError> {
    match entity_type {
        "media" => {
            let site_ids = MediaFile::find_site_ids(pool, id).await?;
            require_perm_all(pool, actor, &site_ids, "media", "update").await?;
            MediaFile::restore(pool, id).await?;
            audit_trash(
                pool,
                actor.id,
                id,
                site_ids.into_iter().next(),
                AuditAction::Update,
                "restore",
                Some("media"),
            )
            .await;
        }
        "document" => {
            let site_id = DocumentRepo::find_site_id(pool, id).await?.ok_or_else(|| {
                ApiError::not_found("Document not found").with_code(codes::RESOURCE_NOT_FOUND)
            })?;
            require_perm_all(pool, actor, &[site_id], "document", "update").await?;
            DocumentRepo::restore(pool, id).await?;
            audit_trash(
                pool,
                actor.id,
                id,
                Some(site_id),
                AuditAction::Update,
                "restore",
                Some("document"),
            )
            .await;
        }
        "legal" => {
            let site_id = LegalDocumentRepo::resolve_site_id_any(pool, id).await?;
            require_perm_all(pool, actor, &[site_id], "legal", "update").await?;
            LegalDocumentRepo::restore(pool, id).await?;
            audit_trash(
                pool,
                actor.id,
                id,
                Some(site_id),
                AuditAction::Update,
                "restore",
                Some("legal"),
            )
            .await;
        }
        "social" => {
            let link = SocialLink::find_deleted_by_id(pool, id).await?;
            require_perm_all(pool, actor, &[link.site_id], "social", "update").await?;
            SocialLink::restore(pool, id).await?;
            audit_trash(
                pool,
                actor.id,
                id,
                Some(link.site_id),
                AuditAction::Update,
                "restore",
                Some("social"),
            )
            .await;
        }
        "menu" => {
            let menu = NavigationMenu::find_deleted_by_id(pool, id).await?;
            require_perm_all(pool, actor, &[menu.site_id], "navigation", "update").await?;
            NavigationMenu::restore(pool, id).await?;
            audit_trash(
                pool,
                actor.id,
                id,
                Some(menu.site_id),
                AuditAction::Update,
                "restore",
                Some("menu"),
            )
            .await;
        }
        "menu_item" => {
            let item = NavigationItem::find_deleted_by_id(pool, id).await?;
            require_perm_all(pool, actor, &[item.site_id], "navigation", "update").await?;
            NavigationItem::restore(pool, id).await?;
            audit_trash(
                pool,
                actor.id,
                id,
                Some(item.site_id),
                AuditAction::Update,
                "restore",
                Some("menu_item"),
            )
            .await;
        }
        // Portfolio content & CV entries ride the content spine — same restore
        // path as blog/page, gated by their own permission resource.
        "project" | "cv_entry" => {
            let resource = if entity_type == "project" {
                "portfolio"
            } else {
                "cv"
            };
            let site_ids = Content::find_site_ids(pool, id).await?;
            // A site-less (orphaned) row has no site to authorize against — fail
            // closed rather than restoring it without a permission check.
            if site_ids.is_empty() {
                return Err(
                    ApiError::not_found(format!("{entity_type} not found in trash"))
                        .with_code(codes::RESOURCE_NOT_FOUND),
                );
            }
            require_perm_all(pool, actor, &site_ids, resource, "update").await?;
            ContentService::restore_content(pool, id).await?;
            audit_trash(
                pool,
                actor.id,
                id,
                site_ids.into_iter().next(),
                AuditAction::Update,
                "restore",
                Some(entity_type),
            )
            .await;
        }
        "skill" => {
            let site_ids = SkillRepo::find_site_ids(pool, id).await?;
            if site_ids.is_empty() {
                return Err(ApiError::not_found("Skill not found in trash")
                    .with_code(codes::RESOURCE_NOT_FOUND));
            }
            require_perm_all(pool, actor, &site_ids, "cv", "update").await?;
            SkillRepo::restore(pool, id).await?;
            audit_trash(
                pool,
                actor.id,
                id,
                site_ids.into_iter().next(),
                AuditAction::Update,
                "restore",
                Some("skill"),
            )
            .await;
        }
        _ => {
            let site_ids = Content::find_site_ids(pool, id).await?;
            require_perm_all(pool, actor, &site_ids, "blog", "update").await?;
            ContentService::restore_content(pool, id).await?;
            audit_trash(
                pool,
                actor.id,
                id,
                site_ids.into_iter().next(),
                AuditAction::Update,
                "restore",
                None,
            )
            .await;
        }
    }

    Ok(())
}

/// Permanently delete the soft-deleted entity `id` of the given `entity_type`,
/// after gating the actor's `delete` permission on the entity's site(s). The
/// mirror image of [`restore`]: irreversible, so every content arm fails
/// **closed** on a site-less (orphaned) row, and the `media` arm removes the
/// storage blobs (variants + original) before dropping the row.
pub async fn permanent_delete(
    pool: &PgPool,
    actor: &Actor,
    storage: &Arc<dyn StorageBackend>,
    entity_type: &str,
    id: Uuid,
) -> Result<(), ApiError> {
    match entity_type {
        "media" => {
            let site_ids = MediaFile::find_site_ids(pool, id).await?;
            require_perm_all(pool, actor, &site_ids, "media", "delete").await?;

            let media = MediaFile::find_deleted_by_id(pool, id).await?;
            let variants = MediaVariant::find_for_media(pool, id).await?;
            for variant in &variants {
                let _ = storage.delete(&variant.storage_path).await;
            }
            let _ = storage.delete(&media.storage_path).await;

            MediaFile::permanent_delete(pool, id).await?;
            audit_trash(
                pool,
                actor.id,
                id,
                site_ids.into_iter().next(),
                AuditAction::Delete,
                "permanent_delete",
                Some("media"),
            )
            .await;
        }
        "document" => {
            let site_id = DocumentRepo::find_trashed_site_id(pool, id)
                .await?
                .ok_or_else(|| {
                    ApiError::not_found("Document not found in trash")
                        .with_code(codes::RESOURCE_NOT_FOUND)
                })?;
            require_perm_all(pool, actor, &[site_id], "document", "delete").await?;
            DocumentRepo::permanent_delete(pool, id).await?;
            audit_trash(
                pool,
                actor.id,
                id,
                Some(site_id),
                AuditAction::Delete,
                "permanent_delete",
                Some("document"),
            )
            .await;
        }
        "legal" => {
            let site_id = LegalDocumentRepo::resolve_site_id_any(pool, id).await?;
            require_perm_all(pool, actor, &[site_id], "legal", "delete").await?;
            LegalDocumentRepo::permanent_delete(pool, id).await?;
            audit_trash(
                pool,
                actor.id,
                id,
                Some(site_id),
                AuditAction::Delete,
                "permanent_delete",
                Some("legal"),
            )
            .await;
        }
        "social" => {
            let link = SocialLink::find_deleted_by_id(pool, id).await?;
            require_perm_all(pool, actor, &[link.site_id], "social", "delete").await?;
            SocialLink::permanent_delete(pool, id).await?;
            audit_trash(
                pool,
                actor.id,
                id,
                Some(link.site_id),
                AuditAction::Delete,
                "permanent_delete",
                Some("social"),
            )
            .await;
        }
        "menu" => {
            let menu = NavigationMenu::find_deleted_by_id(pool, id).await?;
            require_perm_all(pool, actor, &[menu.site_id], "navigation", "delete").await?;
            NavigationMenu::permanent_delete(pool, id).await?;
            audit_trash(
                pool,
                actor.id,
                id,
                Some(menu.site_id),
                AuditAction::Delete,
                "permanent_delete",
                Some("menu"),
            )
            .await;
        }
        "menu_item" => {
            let item = NavigationItem::find_deleted_by_id(pool, id).await?;
            require_perm_all(pool, actor, &[item.site_id], "navigation", "delete").await?;
            NavigationItem::permanent_delete(pool, id).await?;
            audit_trash(
                pool,
                actor.id,
                id,
                Some(item.site_id),
                AuditAction::Delete,
                "permanent_delete",
                Some("menu_item"),
            )
            .await;
        }
        "project" | "cv_entry" => {
            let resource = if entity_type == "project" {
                "portfolio"
            } else {
                "cv"
            };
            let site_ids = Content::find_site_ids(pool, id).await?;
            if site_ids.is_empty() {
                return Err(
                    ApiError::not_found(format!("{entity_type} not found in trash"))
                        .with_code(codes::RESOURCE_NOT_FOUND),
                );
            }
            require_perm_all(pool, actor, &site_ids, resource, "delete").await?;
            ContentService::permanent_delete_content(pool, id).await?;
            audit_trash(
                pool,
                actor.id,
                id,
                site_ids.into_iter().next(),
                AuditAction::Delete,
                "permanent_delete",
                Some(entity_type),
            )
            .await;
        }
        "skill" => {
            let site_ids = SkillRepo::find_site_ids(pool, id).await?;
            if site_ids.is_empty() {
                return Err(ApiError::not_found("Skill not found in trash")
                    .with_code(codes::RESOURCE_NOT_FOUND));
            }
            require_perm_all(pool, actor, &site_ids, "cv", "delete").await?;
            SkillRepo::permanent_delete(pool, id).await?;
            audit_trash(
                pool,
                actor.id,
                id,
                site_ids.into_iter().next(),
                AuditAction::Delete,
                "permanent_delete",
                Some("skill"),
            )
            .await;
        }
        _ => {
            let site_ids = Content::find_site_ids(pool, id).await?;
            // Fail closed on a site-less (orphaned) content row. The old inline
            // handler looped over a possibly-empty `site_ids` (a no-op
            // permission check) and deleted anyway — a fail-open hole on the
            // irreversible path. Mirror the guarded content arms above.
            if site_ids.is_empty() {
                return Err(ApiError::not_found("Content not found in trash")
                    .with_code(codes::RESOURCE_NOT_FOUND));
            }
            require_perm_all(pool, actor, &site_ids, "blog", "delete").await?;
            ContentService::permanent_delete_content(pool, id).await?;
            audit_trash(
                pool,
                actor.id,
                id,
                site_ids.into_iter().next(),
                AuditAction::Delete,
                "permanent_delete",
                None,
            )
            .await;
        }
    }

    Ok(())
}
