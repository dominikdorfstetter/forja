//! Page-specific lifecycle: `ContentEntity` + `ContentUpdate` impls plus
//! flat helpers for delete / clone. The generic [`create`](super::create)
//! and [`update`](super::update) drivers run `Page` via the trait impls
//! below.

use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

use crate::dto::page::{CreatePageRequest, PageResponse, UpdatePageRequest};
use crate::errors::ApiError;
use crate::guards::actor::Actor;
use crate::models::audit::AuditAction;
use crate::models::content::ContentStatus;
use crate::models::page::PageWithContent;
use crate::repos::page_repo::PageRepo;
use crate::services::publish_gate;
use crate::services::publish_pipeline::{self, PublishEvent};

use super::entity::{ContentEntity, ContentUpdate};

const ENTITY_TYPE: &str = "page";

impl ContentEntity for PageWithContent {
    type CreatePayload = CreatePageRequest;

    fn audit_entity_type() -> &'static str {
        ENTITY_TYPE
    }

    async fn insert(
        conn: &mut PgConnection,
        payload: Self::CreatePayload,
        user_id: Option<&str>,
    ) -> Result<Self, ApiError> {
        PageRepo::create(conn, payload, user_id).await
    }

    fn id(&self) -> Uuid {
        self.id
    }

    fn content_id(&self) -> Option<Uuid> {
        Some(self.content_id)
    }

    fn slug(&self) -> Option<String> {
        Some(self.slug.clone().unwrap_or_else(|| self.route.clone()))
    }

    fn requested_status(payload: &Self::CreatePayload) -> ContentStatus {
        payload.status.clone()
    }

    fn payload_site_ids(payload: &Self::CreatePayload) -> Vec<Uuid> {
        payload.site_ids.clone()
    }

    fn webhook_payload(&self) -> serde_json::Value {
        serde_json::to_value(PageResponse::from(self.clone())).unwrap_or_default()
    }

    async fn validate_publish_gate(&self, pool: &PgPool) -> Result<(), ApiError> {
        publish_gate::enforce(
            publish_gate::validate_page_for_publish(pool, self.content_id, self.id).await?,
        )
    }
}

impl ContentUpdate for PageWithContent {
    type UpdatePayload = UpdatePageRequest;

    async fn update(
        conn: &mut PgConnection,
        id: Uuid,
        payload: Self::UpdatePayload,
    ) -> Result<Self, ApiError> {
        PageRepo::update(conn, id, payload).await
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

pub async fn delete(
    pool: &PgPool,
    id: Uuid,
    page: PageWithContent,
    site_ids: Vec<Uuid>,
    auth: &Actor,
) -> Result<(), ApiError> {
    PageRepo::soft_delete(pool, id).await?;

    let Some(site_id) = site_ids.into_iter().next() else {
        return Ok(());
    };

    publish_pipeline::execute(
        pool,
        PublishEvent {
            site_id,
            entity_type: ENTITY_TYPE,
            entity_id: id,
            content_id: page.content_id,
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

pub async fn clone(
    pool: &PgPool,
    source_id: Uuid,
    site_ids: Vec<Uuid>,
    auth: &Actor,
) -> Result<PageWithContent, ApiError> {
    let page =
        PageRepo::clone_page(pool, source_id, site_ids.clone(), auth.user_identifier()).await?;

    let Some(site_id) = site_ids.into_iter().next() else {
        return Ok(page);
    };

    let webhook_payload =
        serde_json::to_value(PageResponse::from(page.clone())).unwrap_or_default();

    publish_pipeline::execute(
        pool,
        PublishEvent {
            site_id,
            entity_type: ENTITY_TYPE,
            entity_id: page.id,
            content_id: page.content_id,
            user_id: Some(auth.id),
            clerk_actor_id: auth.user_identifier().map(str::to_string),
            action: AuditAction::Create,
            webhook_event: format!("{ENTITY_TYPE}.created"),
            webhook_payload,
            audit_metadata: Some(serde_json::json!({ "cloned_from": source_id.to_string() })),
            status_transition: None,
            change_diff: None,
            slug: page.slug.clone(),
            webhook_published_event: None,
        },
    )
    .await?;

    Ok(page)
}
