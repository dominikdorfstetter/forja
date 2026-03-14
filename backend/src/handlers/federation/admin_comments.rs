//! Federation comment moderation admin endpoints

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;

use crate::dto::federation::responses::CommentResponse;
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::guards::federation_guard::{
    can_manage_federation, can_moderate_federation, can_view_federation,
};
use crate::guards::module_guard::{FederationModule, ModuleGuard};
use crate::models::federation::activity::ApActivity;
use crate::models::federation::comment::ApComment;
use crate::models::federation::types::{ApActivityStatus, ApCommentStatus};
use crate::models::site::Site;
use crate::models::site_membership::SiteRole;
use crate::utils::pagination::{Paginated, PaginationParams};
use crate::AppState;

/// Parse a comment status filter string into the enum.
fn parse_comment_status(s: &str) -> Option<ApCommentStatus> {
    match s {
        "pending" => Some(ApCommentStatus::Pending),
        "approved" => Some(ApCommentStatus::Approved),
        "rejected" => Some(ApCommentStatus::Rejected),
        "spam" => Some(ApCommentStatus::Spam),
        _ => None,
    }
}

/// List comments for a site (paginated, with optional status filter)
#[utoipa::path(
    tag = "Federation",
    operation_id = "list_federation_comments",
    description = "List federated comments for a site (paginated, with optional status filter)",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default: 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page (default: 10, max: 100)"),
        ("status" = Option<String>, Query, description = "Filter by status: pending, approved, rejected, spam")
    ),
    responses(
        (status = 200, description = "Paginated comment list", body = Paginated<CommentResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/federation/comments?<page>&<page_size>&<status>")]
pub async fn list_comments(
    state: &State<AppState>,
    site_id: Uuid,
    page: Option<i64>,
    page_size: Option<i64>,
    status: Option<String>,
    auth: ReadKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Json<Paginated<CommentResponse>>, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Reviewer)
        .await?;
    if !can_view_federation(&role) {
        return Err(ApiError::forbidden("Insufficient role to view comments"));
    }

    Site::find_by_id(&state.db, site_id).await?;

    let params = PaginationParams::new(page, page_size);
    let (limit, offset) = params.limit_offset();

    let status_filter = status.as_deref().and_then(parse_comment_status);

    let comments =
        ApComment::find_by_site(&state.db, site_id, status_filter, limit, offset).await?;

    // Count total with the same filter
    let total: (i64,) = if let Some(st) = status.as_deref().and_then(parse_comment_status) {
        sqlx::query_as("SELECT COUNT(*) FROM ap_comments WHERE site_id = $1 AND status = $2")
            .bind(site_id)
            .bind(st)
            .fetch_one(&state.db)
            .await?
    } else {
        sqlx::query_as("SELECT COUNT(*) FROM ap_comments WHERE site_id = $1")
            .bind(site_id)
            .fetch_one(&state.db)
            .await?
    };
    let total = total.0;

    let items: Vec<CommentResponse> = comments.into_iter().map(CommentResponse::from).collect();
    let paginated = params.paginate(items, total);

    Ok(Json(paginated))
}

/// Approve a federated comment
#[utoipa::path(
    tag = "Federation",
    operation_id = "approve_federation_comment",
    description = "Approve a pending federated comment",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("comment_id" = Uuid, Path, description = "Comment UUID")
    ),
    responses(
        (status = 200, description = "Comment approved", body = CommentResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Comment not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[put("/sites/<site_id>/federation/comments/<comment_id>/approve")]
pub async fn approve_comment(
    state: &State<AppState>,
    site_id: Uuid,
    comment_id: Uuid,
    auth: ReadKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Json<CommentResponse>, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Reviewer)
        .await?;
    if !can_moderate_federation(&role) {
        return Err(ApiError::forbidden(
            "Insufficient role to moderate comments",
        ));
    }

    Site::find_by_id(&state.db, site_id).await?;

    let comment = find_comment_for_site(&state.db, site_id, comment_id).await?;

    ApComment::update_status(&state.db, comment.id, ApCommentStatus::Approved, None).await?;

    // Reload the updated comment
    let updated = find_comment_for_site(&state.db, site_id, comment_id).await?;

    tracing::info!(
        site_id = %site_id,
        comment_id = %comment_id,
        "Approved federated comment"
    );

    Ok(Json(CommentResponse::from(updated)))
}

/// Reject a federated comment
#[utoipa::path(
    tag = "Federation",
    operation_id = "reject_federation_comment",
    description = "Reject a federated comment",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("comment_id" = Uuid, Path, description = "Comment UUID")
    ),
    responses(
        (status = 200, description = "Comment rejected", body = CommentResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Comment not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[put("/sites/<site_id>/federation/comments/<comment_id>/reject")]
pub async fn reject_comment(
    state: &State<AppState>,
    site_id: Uuid,
    comment_id: Uuid,
    auth: ReadKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Json<CommentResponse>, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Reviewer)
        .await?;
    if !can_moderate_federation(&role) {
        return Err(ApiError::forbidden(
            "Insufficient role to moderate comments",
        ));
    }

    Site::find_by_id(&state.db, site_id).await?;

    let comment = find_comment_for_site(&state.db, site_id, comment_id).await?;

    ApComment::update_status(&state.db, comment.id, ApCommentStatus::Rejected, None).await?;

    let updated = find_comment_for_site(&state.db, site_id, comment_id).await?;

    tracing::info!(
        site_id = %site_id,
        comment_id = %comment_id,
        "Rejected federated comment"
    );

    Ok(Json(CommentResponse::from(updated)))
}

/// Delete a federated comment and mark related activity as done
#[utoipa::path(
    tag = "Federation",
    operation_id = "delete_federation_comment",
    description = "Delete a federated comment and mark the related activity as done",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("comment_id" = Uuid, Path, description = "Comment UUID")
    ),
    responses(
        (status = 204, description = "Comment deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Comment not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/sites/<site_id>/federation/comments/<comment_id>")]
pub async fn delete_comment(
    state: &State<AppState>,
    site_id: Uuid,
    comment_id: Uuid,
    auth: ReadKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Status, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Admin)
        .await?;
    if !can_manage_federation(&role) {
        return Err(ApiError::forbidden("Insufficient role to delete comments"));
    }

    Site::find_by_id(&state.db, site_id).await?;

    let comment = find_comment_for_site(&state.db, site_id, comment_id).await?;

    // Try to mark the related inbound activity as done
    let activity: Option<ApActivity> = sqlx::query_as(
        r#"
        SELECT * FROM ap_activities
        WHERE site_id = $1
          AND direction = 'in'
          AND activity_type = 'Create'
          AND object_uri = $2
        LIMIT 1
        "#,
    )
    .bind(site_id)
    .bind(&comment.activity_uri)
    .fetch_optional(&state.db)
    .await?;

    if let Some(a) = activity {
        ApActivity::update_status(&state.db, a.id, ApActivityStatus::Done, None).await?;
    }

    // Hard-delete the comment
    sqlx::query("DELETE FROM ap_comments WHERE id = $1")
        .bind(comment_id)
        .execute(&state.db)
        .await?;

    tracing::info!(
        site_id = %site_id,
        comment_id = %comment_id,
        "Deleted federated comment"
    );

    Ok(Status::NoContent)
}

/// Look up a comment that belongs to a specific site, returning 404 if not found.
async fn find_comment_for_site(
    pool: &sqlx::PgPool,
    site_id: Uuid,
    comment_id: Uuid,
) -> Result<ApComment, ApiError> {
    let comment: Option<ApComment> =
        sqlx::query_as("SELECT * FROM ap_comments WHERE id = $1 AND site_id = $2")
            .bind(comment_id)
            .bind(site_id)
            .fetch_optional(pool)
            .await?;

    comment.ok_or_else(|| ApiError::not_found("Comment not found"))
}

/// Collect admin comment routes
pub fn routes() -> Vec<Route> {
    routes![
        list_comments,
        approve_comment,
        reject_comment,
        delete_comment
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_comment_status() {
        assert_eq!(
            parse_comment_status("pending"),
            Some(ApCommentStatus::Pending)
        );
        assert_eq!(
            parse_comment_status("approved"),
            Some(ApCommentStatus::Approved)
        );
        assert_eq!(
            parse_comment_status("rejected"),
            Some(ApCommentStatus::Rejected)
        );
        assert_eq!(parse_comment_status("spam"), Some(ApCommentStatus::Spam));
        assert_eq!(parse_comment_status("unknown"), None);
    }

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 4);
    }
}
