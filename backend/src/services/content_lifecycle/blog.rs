//! Blog-specific lifecycle: `ContentEntity` + `ContentUpdate` impls plus
//! flat helpers for delete / clone / sample seeding. The generic
//! [`create`](super::create) and [`update`](super::update) drivers run
//! `Blog` via the trait impls below; delete / clone keep entity-specific
//! shapes (cloned_from metadata, audit-only sample seeding).

use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

use crate::dto::blog::{BlogResponse, CreateBlogRequest, UpdateBlogRequest};
use crate::errors::ApiError;
use crate::guards::actor::Actor;
use crate::models::audit::AuditAction;
use crate::models::blog::BlogWithContent;
use crate::models::content::ContentStatus;
use crate::repos::blog_repo::BlogRepo;
use crate::services::audit_service;
use crate::services::publish_gate;
use crate::services::publish_pipeline::{self, PublishEvent};

use super::entity::{ContentEntity, ContentUpdate};

const ENTITY_TYPE: &str = "blog";

impl ContentEntity for BlogWithContent {
    type CreatePayload = CreateBlogRequest;

    fn audit_entity_type() -> &'static str {
        ENTITY_TYPE
    }

    async fn insert(
        conn: &mut PgConnection,
        payload: Self::CreatePayload,
        user_id: Option<&str>,
    ) -> Result<Self, ApiError> {
        BlogRepo::create(conn, payload, user_id).await
    }

    fn id(&self) -> Uuid {
        self.id
    }

    fn content_id(&self) -> Option<Uuid> {
        Some(self.content_id)
    }

    fn slug(&self) -> Option<String> {
        self.slug.clone()
    }

    fn requested_status(payload: &Self::CreatePayload) -> ContentStatus {
        payload.status.clone()
    }

    fn payload_site_ids(payload: &Self::CreatePayload) -> Vec<Uuid> {
        payload.site_ids.clone()
    }

    fn webhook_payload(&self) -> serde_json::Value {
        serde_json::to_value(BlogResponse::from(self.clone())).unwrap_or_default()
    }

    async fn validate_publish_gate(&self, pool: &PgPool) -> Result<(), ApiError> {
        publish_gate::enforce(publish_gate::validate_blog_for_publish(pool, self.content_id).await?)
    }
}

impl ContentUpdate for BlogWithContent {
    type UpdatePayload = UpdateBlogRequest;

    async fn update(
        conn: &mut PgConnection,
        id: Uuid,
        payload: Self::UpdatePayload,
    ) -> Result<Self, ApiError> {
        BlogRepo::update(conn, id, payload).await
    }

    fn update_requested_status(payload: &Self::UpdatePayload) -> Option<ContentStatus> {
        payload.status.clone()
    }

    fn current_status(&self) -> Option<ContentStatus> {
        Some(self.status.clone())
    }

    fn change_diff_value(&self) -> Option<serde_json::Value> {
        serde_json::to_value(self).ok()
    }
}

/// Soft-delete a blog and emit `blog.deleted`. `blog` is passed in so the
/// caller's earlier `BlogRepo::find_by_id` (used for permission checks) is
/// reused.
pub async fn delete(
    pool: &PgPool,
    id: Uuid,
    blog: BlogWithContent,
    site_ids: Vec<Uuid>,
    auth: &Actor,
) -> Result<(), ApiError> {
    BlogRepo::soft_delete(pool, id).await?;

    let Some(site_id) = site_ids.into_iter().next() else {
        return Ok(());
    };

    publish_pipeline::execute(
        pool,
        PublishEvent {
            site_id,
            entity_type: ENTITY_TYPE,
            entity_id: id,
            content_id: blog.content_id,
            user_id: Some(auth.id),
            clerk_actor_id: auth.user_identifier().map(str::to_string),
            action: AuditAction::Delete,
            webhook_event: format!("{ENTITY_TYPE}.deleted"),
            webhook_payload: serde_json::json!({ "id": id }),
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

/// Clone an existing blog as a new Draft and emit `blog.created` with
/// `cloned_from` audit metadata.
pub async fn clone(
    pool: &PgPool,
    source_id: Uuid,
    site_ids: Vec<Uuid>,
    auth: &Actor,
) -> Result<BlogWithContent, ApiError> {
    let blog =
        BlogRepo::clone_blog(pool, source_id, site_ids.clone(), auth.user_identifier()).await?;

    let Some(site_id) = site_ids.into_iter().next() else {
        return Ok(blog);
    };

    let webhook_payload =
        serde_json::to_value(BlogResponse::from(blog.clone())).unwrap_or_default();

    publish_pipeline::execute(
        pool,
        PublishEvent {
            site_id,
            entity_type: ENTITY_TYPE,
            entity_id: blog.id,
            content_id: blog.content_id,
            user_id: Some(auth.id),
            clerk_actor_id: auth.user_identifier().map(str::to_string),
            action: AuditAction::Create,
            webhook_event: format!("{ENTITY_TYPE}.created"),
            webhook_payload,
            audit_metadata: Some(serde_json::json!({ "cloned_from": source_id.to_string() })),
            status_transition: None,
            change_diff: None,
            slug: blog.slug.clone(),
            webhook_published_event: None,
        },
    )
    .await?;

    Ok(blog)
}

/// Seed sample blog posts for a new site (admin tool — not part of the
/// publish pipeline). Returns the seeded blogs and writes a single
/// site-scoped audit row recording the bulk operation.
pub async fn seed_samples(
    pool: &PgPool,
    site_id: Uuid,
    locale_id: Uuid,
    locale_code: &str,
    author: &str,
    auth: &Actor,
) -> Result<Vec<BlogWithContent>, ApiError> {
    let blogs =
        BlogRepo::seed_sample_content(pool, site_id, locale_id, author, locale_code).await?;

    audit_service::log_action(
        pool,
        Some(site_id),
        Some(auth.id),
        AuditAction::Create,
        ENTITY_TYPE,
        site_id,
        Some(serde_json::json!({
            "action": "seed_sample_content",
            "count": blogs.len(),
        })),
    )
    .await;

    Ok(blogs)
}

/// Delete all sample blog posts for a site (admin tool — counterpart to
/// [`seed_samples`]). Returns the deletion count and writes a single
/// site-scoped audit row.
pub async fn delete_samples(pool: &PgPool, site_id: Uuid, auth: &Actor) -> Result<i64, ApiError> {
    let deleted = BlogRepo::delete_sample_content(pool, site_id).await?;

    audit_service::log_action(
        pool,
        Some(site_id),
        Some(auth.id),
        AuditAction::Delete,
        ENTITY_TYPE,
        site_id,
        Some(serde_json::json!({
            "action": "delete_sample_content",
            "count": deleted,
        })),
    )
    .await;

    Ok(deleted)
}
