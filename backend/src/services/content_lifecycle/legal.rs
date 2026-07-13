//! Legal-document lifecycle: `ContentEntity` + `ContentUpdate` impls plus
//! flat helpers for delete / clone. The generic
//! [`create`](super::create) and [`update`](super::update) drivers run
//! `LegalDocument` via the trait impls below.
//!
//! Legal diverges from the other entities in two ways:
//!
//! * **Audit type vs webhook prefix**: `audit_logs.entity_type` is
//!   `"legal_document"` but the public webhook namespace is `legal.*`.
//!   The trait's `webhook_prefix` is overridden; the generic [`create`]
//!   detects the divergence and sets `webhook_published_event` to
//!   `"legal.published"` automatically.
//! * **No editorial workflow**: legal status transitions are not gated
//!   by `workflow_service` (`runs_editorial_workflow` returns `false`),
//!   so no `validate_status` call is made on create.

use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

use crate::dto::legal::{CreateLegalDocumentRequest, UpdateLegalDocumentRequest};
use crate::errors::ApiError;
use crate::guards::actor::Actor;
use crate::models::audit::AuditAction;
use crate::models::content::ContentStatus;
use crate::models::legal::LegalDocument;
use crate::repos::legal_repo::LegalDocumentRepo;
use crate::services::publish_gate;
use crate::services::publish_pipeline::{self, PublishEvent};

use super::entity::{ContentEntity, ContentUpdate};

const ENTITY_TYPE: &str = "legal_document";
const WEBHOOK_PREFIX: &str = "legal";
const WEBHOOK_PAYLOAD_TYPE: &str = "legal_document";

impl ContentEntity for LegalDocument {
    type CreatePayload = CreateLegalDocumentRequest;

    fn audit_entity_type() -> &'static str {
        ENTITY_TYPE
    }

    fn webhook_prefix() -> &'static str {
        WEBHOOK_PREFIX
    }

    fn runs_editorial_workflow() -> bool {
        false
    }

    async fn insert(
        conn: &mut PgConnection,
        payload: Self::CreatePayload,
        user_id: Option<&str>,
    ) -> Result<Self, ApiError> {
        LegalDocumentRepo::create(conn, payload, user_id).await
    }

    fn id(&self) -> Uuid {
        self.id
    }

    fn content_id(&self) -> Option<Uuid> {
        self.content_id
    }

    fn slug(&self) -> Option<String> {
        None
    }

    fn requested_status(payload: &Self::CreatePayload) -> ContentStatus {
        payload.status.clone()
    }

    fn payload_site_ids(payload: &Self::CreatePayload) -> Vec<Uuid> {
        payload.site_ids.clone()
    }

    fn webhook_payload(&self) -> serde_json::Value {
        serde_json::json!({ "type": WEBHOOK_PAYLOAD_TYPE })
    }

    async fn validate_publish_gate(&self, pool: &PgPool) -> Result<(), ApiError> {
        // content_id is nullable for legal; a document with no spine row has
        // no body-completeness rules to enforce.
        match self.content_id {
            Some(cid) => {
                publish_gate::enforce(publish_gate::validate_legal_for_publish(pool, cid).await?)
            }
            None => Ok(()),
        }
    }

    /// Exactly one version of a chain is ever live: publishing this version
    /// supersedes (archives) any previously-published version, so publishing
    /// an older version rolls back to it (#140 follow-up).
    async fn on_published(pool: &PgPool, entity_id: Uuid) -> Result<(), ApiError> {
        LegalDocumentRepo::supersede_other_published_versions(pool, entity_id).await?;
        Ok(())
    }
}

impl ContentUpdate for LegalDocument {
    type UpdatePayload = UpdateLegalDocumentRequest;

    async fn update(
        conn: &mut PgConnection,
        id: Uuid,
        payload: Self::UpdatePayload,
    ) -> Result<Self, ApiError> {
        LegalDocumentRepo::update(conn, id, payload).await
    }

    fn update_requested_status(payload: &Self::UpdatePayload) -> Option<ContentStatus> {
        payload.status.clone()
    }
}

pub async fn delete(pool: &PgPool, id: Uuid, auth: &Actor) -> Result<(), ApiError> {
    let site_id = LegalDocumentRepo::resolve_site_id(pool, id).await?;
    let existing = LegalDocumentRepo::find_by_id(pool, id).await?;
    LegalDocumentRepo::soft_delete(pool, id).await?;

    publish_pipeline::execute(
        pool,
        PublishEvent {
            site_id,
            entity_type: ENTITY_TYPE,
            entity_id: id,
            content_id: existing.content_id.unwrap_or_default(),
            user_id: Some(auth.id),
            clerk_actor_id: auth.user_identifier().map(str::to_string),
            action: AuditAction::Delete,
            webhook_event: format!("{WEBHOOK_PREFIX}.deleted"),
            webhook_payload: serde_json::json!({ "type": WEBHOOK_PAYLOAD_TYPE }),
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
    auth: &Actor,
) -> Result<LegalDocument, ApiError> {
    let site_id = LegalDocumentRepo::resolve_site_id_any(pool, source_id).await?;
    let document =
        LegalDocumentRepo::clone_document(pool, source_id, vec![site_id], auth.user_identifier())
            .await?;

    publish_pipeline::execute(
        pool,
        PublishEvent {
            site_id,
            entity_type: ENTITY_TYPE,
            entity_id: document.id,
            content_id: document.content_id.unwrap_or_default(),
            user_id: Some(auth.id),
            clerk_actor_id: auth.user_identifier().map(str::to_string),
            action: AuditAction::Create,
            webhook_event: format!("{WEBHOOK_PREFIX}.created"),
            webhook_payload: serde_json::json!({ "type": WEBHOOK_PAYLOAD_TYPE }),
            audit_metadata: Some(serde_json::json!({ "cloned_from": source_id.to_string() })),
            status_transition: None,
            change_diff: None,
            slug: None,
            webhook_published_event: Some(format!("{WEBHOOK_PREFIX}.published")),
        },
    )
    .await?;

    Ok(document)
}
