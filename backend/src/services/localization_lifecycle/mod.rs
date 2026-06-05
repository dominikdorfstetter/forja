//! Localization lifecycle orchestrator.
//!
//! Owns the per-locale create / update / delete / list pipeline for a
//! Content entity translation. Mirrors `services::content_lifecycle`,
//! but folds authorization (per-Site `PermissionService::require` +
//! `ModuleGuard` check) into the lifecycle itself so handlers shrink to
//! `extract → call lifecycle → return DTO`.
//!
//! ## Seam
//!
//! Handlers keep DTO validation and response mapping. The lifecycle owns
//! site-resolution, permission + module gating, the model mutation, and
//! the post-mutation [`publish_pipeline::execute`] event (audit +
//! webhook). Localization events never carry a status transition, so the
//! pipeline's `notify` / `publish_hooks` legs are inert here — `execute`
//! degenerates to audit + webhook.
//!
//! ## Authorization seam (#662)
//!
//! Today's `PermissionService::require` + `ModuleGuard::check` prelude
//! lives inside [`enforce_access`]. When the authorized-content-entity
//! extractor from #662 lands, that one function becomes the single edit
//! site for the migration — handlers won't move twice.

pub mod blog;
pub mod entity;
pub mod legal;
pub mod page;

pub use entity::LocalizationEntity;

use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::dto::content::{
    CreateLocalizationRequest, LocalizationResponse, UpdateLocalizationRequest,
};
use crate::errors::{codes, ApiError};
use crate::guards::actor::Actor;
use crate::guards::module_guard::ModuleGuard;
use crate::models::audit::AuditAction;
use crate::models::content::{Content, ContentLocalization};
use crate::services::permission_service::{Permission, PermissionService};
use crate::services::publish_pipeline::{self, PublishEvent};

/// The default locale of a Site the Content belongs to.
#[derive(Debug, Clone)]
pub struct DefaultLocale {
    pub locale_id: Uuid,
    pub code: String,
}

/// The default `site_locale` (`is_default = TRUE`) of every Site the
/// Content belongs to, deduped by locale. Empty when the Content has no
/// Site, or no Site has a default configured (edge case).
///
/// Publish requires only these default locales to be filled out — other
/// locales are optional, since readers fall back to the default per
/// ADR 0002 (`utils::locale_resolver`). The rule is owned here so it is
/// applied uniformly across blog / page / legal.
pub async fn default_locale_ids(
    pool: &PgPool,
    content_id: Uuid,
) -> Result<Vec<DefaultLocale>, ApiError> {
    let rows = sqlx::query(
        r#"SELECT DISTINCT l.id, l.code
           FROM site_locales sl
           JOIN locales l ON l.id = sl.locale_id
           JOIN content_sites cs ON cs.site_id = sl.site_id
           WHERE cs.content_id = $1 AND sl.is_default = TRUE"#,
    )
    .bind(content_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| DefaultLocale {
            locale_id: row.get(0),
            code: row.get(1),
        })
        .collect())
}

/// List all localizations for a Content entity. Enforces
/// `{resource}:read` + module-enabled, then returns the rows. No audit
/// or webhook side effects — reads are not audited.
pub async fn list<E: LocalizationEntity>(
    pool: &PgPool,
    content_id: Uuid,
    auth: &Actor,
) -> Result<Vec<ContentLocalization>, ApiError> {
    let site_ids = Content::find_site_ids(pool, content_id).await?;
    enforce_access::<E>(pool, &site_ids, auth, "read").await?;
    ContentLocalization::find_all_for_content(pool, content_id).await
}

/// Create a localization for a Content entity. Resolves the parent's
/// Sites, enforces `{resource}:create` + module-enabled on each, rejects
/// duplicates on the requested locale, inserts the row, then emits a
/// `{prefix}.created` event through `publish_pipeline::execute` (audit +
/// webhook).
pub async fn create<E: LocalizationEntity>(
    pool: &PgPool,
    content_id: Uuid,
    payload: CreateLocalizationRequest,
    auth: &Actor,
) -> Result<ContentLocalization, ApiError> {
    let site_ids = Content::find_site_ids(pool, content_id).await?;
    enforce_access::<E>(pool, &site_ids, auth, "create").await?;

    let existing = ContentLocalization::find_all_for_content(pool, content_id).await?;
    if existing.iter().any(|l| l.locale_id == payload.locale_id) {
        return Err(ApiError::bad_request(format!(
            "Localization for locale {} already exists",
            payload.locale_id
        ))
        .with_code(codes::ENTITY_LOCALIZATION_EXISTS)
        .with_entity_type(E::permission_resource()));
    }

    let loc = ContentLocalization::create(
        pool,
        content_id,
        payload.locale_id,
        &payload.title,
        payload.subtitle.as_deref(),
        payload.excerpt.as_deref(),
        payload.body.as_deref(),
        payload.meta_title.as_deref(),
        payload.meta_description.as_deref(),
    )
    .await?;

    fire_event::<E>(
        pool,
        &site_ids,
        content_id,
        &loc,
        auth,
        AuditAction::Create,
        "created",
    )
    .await?;

    Ok(loc)
}

/// Update an existing localization. Resolves the parent Content from
/// the localization row, enforces `{resource}:update` + module-enabled,
/// updates the row, then emits a `{prefix}.updated` event.
pub async fn update<E: LocalizationEntity>(
    pool: &PgPool,
    id: Uuid,
    payload: UpdateLocalizationRequest,
    auth: &Actor,
) -> Result<ContentLocalization, ApiError> {
    let existing = ContentLocalization::find_by_id(pool, id).await?;
    let site_ids = Content::find_site_ids(pool, existing.content_id).await?;
    enforce_access::<E>(pool, &site_ids, auth, "update").await?;

    let loc = ContentLocalization::update(
        pool,
        id,
        payload.title.as_deref(),
        payload.subtitle.as_deref(),
        payload.excerpt.as_deref(),
        payload.body.as_deref(),
        payload.meta_title.as_deref(),
        payload.meta_description.as_deref(),
        payload.translation_status.as_ref(),
    )
    .await?;

    fire_event::<E>(
        pool,
        &site_ids,
        existing.content_id,
        &loc,
        auth,
        AuditAction::Update,
        "updated",
    )
    .await?;

    Ok(loc)
}

/// Delete an existing localization. Resolves the parent Content from
/// the localization row, enforces `{resource}:delete` + module-enabled,
/// deletes the row, then emits a `{prefix}.deleted` event (with the
/// pre-delete row as the webhook payload so subscribers can identify
/// what was removed).
pub async fn delete<E: LocalizationEntity>(
    pool: &PgPool,
    id: Uuid,
    auth: &Actor,
) -> Result<(), ApiError> {
    let existing = ContentLocalization::find_by_id(pool, id).await?;
    let site_ids = Content::find_site_ids(pool, existing.content_id).await?;
    enforce_access::<E>(pool, &site_ids, auth, "delete").await?;

    ContentLocalization::delete(pool, id).await?;

    fire_event::<E>(
        pool,
        &site_ids,
        existing.content_id,
        &existing,
        auth,
        AuditAction::Delete,
        "deleted",
    )
    .await?;

    Ok(())
}

/// Enforce `{resource}:{action}` on every Site the parent Content belongs
/// to, then verify the entity's module is enabled on the first Site.
/// This is the single seam #662 will replace.
async fn enforce_access<E: LocalizationEntity>(
    pool: &PgPool,
    site_ids: &[Uuid],
    auth: &Actor,
    action: &str,
) -> Result<(), ApiError> {
    for site_id in site_ids {
        PermissionService::require(
            pool,
            auth,
            *site_id,
            &Permission::new(E::permission_resource(), action),
        )
        .await?;
    }
    if let Some(&site_id) = site_ids.first() {
        ModuleGuard::<E::Module>::check(pool, site_id).await?;
    }
    Ok(())
}

/// Emit a `{prefix}.{verb}` event through `publish_pipeline::execute`.
/// Skips silently if the parent Content has no Sites — matches the
/// pre-lifecycle handler behaviour where audit/webhook required a
/// resolved Site.
async fn fire_event<E: LocalizationEntity>(
    pool: &PgPool,
    site_ids: &[Uuid],
    content_id: Uuid,
    loc: &ContentLocalization,
    auth: &Actor,
    action: AuditAction,
    verb: &str,
) -> Result<(), ApiError> {
    let Some(&site_id) = site_ids.first() else {
        return Ok(());
    };

    let webhook_payload =
        serde_json::to_value(LocalizationResponse::from(loc.clone())).unwrap_or_default();

    publish_pipeline::execute(
        pool,
        PublishEvent {
            site_id,
            entity_type: E::audit_entity_type(),
            entity_id: loc.id,
            content_id,
            user_id: Some(auth.id),
            clerk_actor_id: auth.user_identifier().map(str::to_string),
            action,
            webhook_event: format!("{}.{}", E::webhook_prefix(), verb),
            webhook_payload,
            audit_metadata: None,
            status_transition: None,
            change_diff: None,
            slug: None,
            webhook_published_event: None,
        },
    )
    .await?;

    Ok(())
}
