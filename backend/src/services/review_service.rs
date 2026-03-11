//! Shared review logic for editorial workflow
//!
//! Extracts the common approve/request-changes flow used by blog and page handlers.

use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::review::{ReviewAction, ReviewActionRequest, ReviewActionResponse};
use crate::errors::ApiError;
use crate::models::audit::AuditAction;
use crate::models::content::{Content, ContentStatus};
use crate::services::{
    audit_service, content_service::ContentService, notification_service, webhook_service,
};

pub struct ReviewService;

/// Parameters that vary between entity types (blog vs page).
pub struct ReviewContext<'a> {
    pub content_id: Uuid,
    pub entity_type: &'a str,
    pub entity_id: Uuid,
    pub entity_slug: &'a str,
    pub current_status: &'a ContentStatus,
    /// Whether the entity has a future publish_start date.
    pub has_future_publish_start: bool,
}

impl ReviewService {
    /// Perform a review action (approve or request changes) on a content entity.
    ///
    /// This encapsulates the shared logic between `review_blog` and `review_page`:
    /// 1. Verify content is InReview
    /// 2. Determine new status (Published/Scheduled/Draft)
    /// 3. Update content status
    /// 4. Audit log + webhook dispatch
    /// 5. Notify the content creator
    pub async fn review_content(
        pool: &PgPool,
        ctx: &ReviewContext<'_>,
        site_id: Option<Uuid>,
        request: ReviewActionRequest,
        user_id: Uuid,
    ) -> Result<ReviewActionResponse, ApiError> {
        // Content must be InReview
        if *ctx.current_status != ContentStatus::InReview {
            return Err(ApiError::BadRequest(
                "Content must be in 'InReview' status to perform a review action.".to_string(),
            ));
        }

        let is_approve = matches!(request.action, ReviewAction::Approve);
        let (new_status, audit_action, message) = if is_approve {
            let status = if ctx.has_future_publish_start {
                ContentStatus::Scheduled
            } else {
                ContentStatus::Published
            };
            (
                status,
                AuditAction::Approve,
                "Content approved and published.",
            )
        } else {
            (
                ContentStatus::Draft,
                AuditAction::RequestChanges,
                "Changes requested. Content moved back to Draft.",
            )
        };

        // Update content status
        ContentService::update_content(pool, ctx.content_id, None, Some(&new_status), None, None)
            .await?;

        // Log audit with optional comment in metadata
        let metadata = request
            .comment
            .as_ref()
            .map(|c| serde_json::json!({ "comment": c }));
        audit_service::log_action(
            pool,
            site_id,
            Some(user_id),
            audit_action,
            ctx.entity_type,
            ctx.entity_id,
            metadata,
        )
        .await;

        if let Some(sid) = site_id {
            let webhook_event = format!("{}.reviewed", ctx.entity_type);
            webhook_service::dispatch(
                pool.clone(),
                sid,
                &webhook_event,
                ctx.entity_id,
                serde_json::json!({
                    "status": new_status,
                    "message": message,
                }),
            );

            // Notify the content creator about the review result
            let content = Content::find_by_id(pool, ctx.content_id).await?;
            if is_approve {
                notification_service::notify_content_approved(
                    pool.clone(),
                    sid,
                    ctx.entity_type,
                    ctx.entity_id,
                    ctx.entity_slug,
                    content.created_by,
                    Some(user_id),
                );
            } else {
                notification_service::notify_changes_requested(
                    pool.clone(),
                    sid,
                    ctx.entity_type,
                    ctx.entity_id,
                    ctx.entity_slug,
                    content.created_by,
                    Some(user_id),
                    request.comment,
                );
            }
        }

        Ok(ReviewActionResponse {
            status: new_status,
            message: message.to_string(),
        })
    }
}
