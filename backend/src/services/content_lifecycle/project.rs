//! Project lifecycle: `ContentEntity` + `ContentUpdate` impls plus a flat
//! `delete` helper. The generic [`create`](super::create) and
//! [`update`](super::update) drivers run `Project` via the trait impls below.
//!
//! Project differs from blog/page in two ways:
//!
//! * No editorial workflow gating — `runs_editorial_workflow` returns
//!   `false`. Status transitions don't go through `workflow_service`.
//! * No publish gate — project inherits the default
//!   `ContentEntity::validate_publish_gate` (allow), so update doesn't gate
//!   on body completeness.
//!
//! Project also has no clone path.

use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

use crate::dto::project::{CreateProjectRequest, ProjectResponse, UpdateProjectRequest};
use crate::errors::ApiError;
use crate::guards::actor::Actor;
use crate::models::audit::AuditAction;
use crate::models::content::ContentStatus;
use crate::models::project::ProjectWithContent;
use crate::repos::project_repo::ProjectRepo;
use crate::services::publish_pipeline::{self, PublishEvent};

use super::entity::{ContentEntity, ContentUpdate};

const ENTITY_TYPE: &str = "project";

impl ContentEntity for ProjectWithContent {
    type CreatePayload = CreateProjectRequest;

    fn audit_entity_type() -> &'static str {
        ENTITY_TYPE
    }

    fn runs_editorial_workflow() -> bool {
        false
    }

    async fn insert(
        conn: &mut PgConnection,
        payload: Self::CreatePayload,
        user_id: Option<&str>,
    ) -> Result<Self, ApiError> {
        ProjectRepo::create(conn, payload, user_id).await
    }

    fn id(&self) -> Uuid {
        self.id
    }

    fn content_id(&self) -> Option<Uuid> {
        Some(self.content_id)
    }

    fn slug(&self) -> Option<String> {
        Some(self.slug.clone())
    }

    fn requested_status(payload: &Self::CreatePayload) -> ContentStatus {
        payload.status.clone()
    }

    fn payload_site_ids(payload: &Self::CreatePayload) -> Vec<Uuid> {
        payload.site_ids.clone()
    }

    fn webhook_payload(&self) -> serde_json::Value {
        serde_json::to_value(ProjectResponse::from(self.clone())).unwrap_or_default()
    }
}

impl ContentUpdate for ProjectWithContent {
    type UpdatePayload = UpdateProjectRequest;

    async fn update(
        conn: &mut PgConnection,
        id: Uuid,
        payload: Self::UpdatePayload,
    ) -> Result<Self, ApiError> {
        ProjectRepo::update(conn, id, payload).await
    }

    /// Project's bespoke update emits NO status transition — preserve that by
    /// reporting no requested status, so the driver skips the transition block.
    fn update_requested_status(_payload: &Self::UpdatePayload) -> Option<ContentStatus> {
        None
    }

    fn current_status(&self) -> Option<ContentStatus> {
        Some(self.status.clone())
    }

    /// Project's bespoke update passed `slug: None` to the PublishEvent even
    /// though `slug()` is `Some` — preserve that exactly.
    fn update_event_slug(&self) -> Option<String> {
        None
    }
}

pub async fn delete(
    pool: &PgPool,
    id: Uuid,
    project: ProjectWithContent,
    site_ids: Vec<Uuid>,
    auth: &Actor,
) -> Result<(), ApiError> {
    ProjectRepo::soft_delete(pool, id).await?;

    let Some(site_id) = site_ids.into_iter().next() else {
        return Ok(());
    };

    publish_pipeline::execute(
        pool,
        PublishEvent {
            site_id,
            entity_type: ENTITY_TYPE,
            entity_id: id,
            content_id: project.content_id,
            user_id: Some(auth.id),
            clerk_actor_id: auth.user_identifier().map(str::to_string),
            action: AuditAction::Delete,
            webhook_event: format!("{ENTITY_TYPE}.deleted"),
            webhook_payload: serde_json::json!({ "type": ENTITY_TYPE }),
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
