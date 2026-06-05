//! CV-entry lifecycle: `ContentEntity` impl so cv_entry creates flow
//! through the generic [`create`](super::create) (#864).
//!
//! CV entries are spine content (they carry a `content_id`) but, like
//! legal, diverge from the blog/page default in two ways:
//!
//! * **Audit type vs webhook prefix**: `audit_logs.entity_type` is
//!   `"cv_entry"` while the public webhook namespace is `cv.*`. The trait's
//!   `webhook_prefix` is overridden; the generic `create` derives
//!   `cv.created` from it.
//! * **No editorial workflow**: cv-entry status transitions are not gated
//!   by `workflow_service` (`runs_editorial_workflow` returns `false`), so
//!   no `validate_status` call is made on create.
//!
//! Update and delete stay as flat handler-side flows for now — only the
//! create path is unified onto the trait (matching the issue scope).

use sqlx::PgConnection;
use uuid::Uuid;

use crate::dto::cv::{CreateCvEntryRequest, UpdateCvEntryRequest};
use crate::errors::ApiError;
use crate::models::content::ContentStatus;
use crate::models::cv::CvEntry;
use crate::repos::cv_repo::CvEntryRepo;

use super::entity::{ContentEntity, ContentUpdate};

const ENTITY_TYPE: &str = "cv_entry";
const WEBHOOK_PREFIX: &str = "cv";

impl ContentEntity for CvEntry {
    type CreatePayload = CreateCvEntryRequest;

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
        CvEntryRepo::create(conn, payload, user_id).await
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
        serde_json::json!({ "type": ENTITY_TYPE })
    }
}

impl ContentUpdate for CvEntry {
    type UpdatePayload = UpdateCvEntryRequest;

    async fn update(
        conn: &mut PgConnection,
        id: Uuid,
        payload: Self::UpdatePayload,
    ) -> Result<Self, ApiError> {
        CvEntryRepo::update(conn, id, payload).await
    }

    /// The bespoke cv handler emitted NO pipeline status transition
    /// (status_transition: None) even though the payload carries a status;
    /// the spine status is still updated by the repo. Report no requested
    /// status so the driver preserves that (no transition emitted).
    fn update_requested_status(_payload: &Self::UpdatePayload) -> Option<ContentStatus> {
        None
    }
}
