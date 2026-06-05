//! Axum port of `crate::handlers::notification`. Eight endpoints for
//! per-user-per-site notification CRUD plus bulk operations. Mounted
//! under `/api/v1`.
//!
//! Every endpoint requires Clerk JWT auth (rejects API-key callers via
//! `require_clerk_user_id`) — notifications are user-scoped, so an
//! API-key identity has no recipient to filter by.

use axum::extract::{Path, Query, State};
use axum::response::Json;
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::dto::notification::{
    BulkDeleteNotificationsRequest, MarkAllReadResponse, NotificationDeleteResponse,
    NotificationResponse, NotificationStatusCounts, PaginatedNotifications, UnreadCountResponse,
};
use crate::errors::{codes, ApiError, ProblemDetails};
use crate::guards::actor::Actor;
use crate::guards::auth_guard::{ReadKey, WriteKey};
use crate::models::notification::Notification;
use crate::utils::list_params::ListParams;
use crate::AppState;

/// Reject API-key identities — notification endpoints are user-scoped.
fn require_clerk_user_id(auth: &Actor) -> Result<&str, ApiError> {
    auth.clerk_user_id().ok_or_else(|| {
        ApiError::forbidden("Notification endpoints require Clerk JWT authentication")
            .with_code(codes::NOTIFICATION_REQUIRES_CLERK)
    })
}

#[derive(Debug, Deserialize)]
struct ListNotificationsQuery {
    page: Option<i64>,
    page_size: Option<i64>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
    is_read: Option<bool>,
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/notifications",
    tag = "Notifications",
    operation_id = "list_notifications",
    description = "List notifications for the current user in a site (paginated, with optional sort and read-status filter)",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page (default 20, max 100)"),
        ("sort_by" = Option<String>, Query, description = "Sort column: created_at"),
        ("sort_dir" = Option<String>, Query, description = "Sort direction: asc or desc"),
        ("is_read" = Option<bool>, Query, description = "Filter by read status (true=read, false=unread). Omit for all.")
    ),
    responses(
        (status = 200, description = "Paginated notification list", body = PaginatedNotifications),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden — requires Clerk JWT", body = ProblemDetails)
    ),
    security(("bearer_auth" = []))
)]
async fn list_notifications(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<ListNotificationsQuery>,
    auth: ReadKey,
) -> Result<Json<PaginatedNotifications>, ApiError> {
    let clerk_id = require_clerk_user_id(&auth.0)?;
    let params = ListParams::new(
        q.page,
        q.page_size.or(Some(20)),
        None,
        q.sort_by,
        q.sort_dir,
    );

    let notifications =
        Notification::find_for_user_filtered_ext(&state.db, clerk_id, site_id, &params, q.is_read)
            .await?;
    let total =
        Notification::count_for_user_filtered(&state.db, clerk_id, site_id, q.is_read).await?;

    let items: Vec<NotificationResponse> = notifications
        .into_iter()
        .map(NotificationResponse::from)
        .collect();
    let paginated = params.paginate(items, total);

    Ok(Json(paginated))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/notifications/unread-count",
    tag = "Notifications",
    operation_id = "get_unread_count",
    description = "Get the unread notification count for the current user in a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Unread count", body = UnreadCountResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden — requires Clerk JWT", body = ProblemDetails)
    ),
    security(("bearer_auth" = []))
)]
async fn get_unread_count(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<UnreadCountResponse>, ApiError> {
    let clerk_id = require_clerk_user_id(&auth.0)?;
    let unread_count = Notification::count_unread(&state.db, clerk_id, site_id).await?;
    Ok(Json(UnreadCountResponse { unread_count }))
}

#[utoipa::path(
    put,
    path = "/notifications/{id}/read",
    tag = "Notifications",
    operation_id = "mark_notification_read",
    description = "Mark a single notification as read (ownership check: must be the recipient)",
    params(("id" = Uuid, Path, description = "Notification UUID")),
    responses(
        (status = 200, description = "Notification marked as read", body = NotificationResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Notification not found", body = ProblemDetails)
    ),
    security(("bearer_auth" = []))
)]
async fn mark_notification_read(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
) -> Result<Json<NotificationResponse>, ApiError> {
    let clerk_id = require_clerk_user_id(&auth.0)?;

    let notification = Notification::find_by_id(&state.db, id).await?;
    if notification.recipient_clerk_id != clerk_id {
        return Err(
            ApiError::forbidden("You can only mark your own notifications as read")
                .with_code(codes::NOTIFICATION_ACCESS_DENIED),
        );
    }

    let updated = Notification::mark_read(&state.db, id).await?;
    Ok(Json(NotificationResponse::from(updated)))
}

#[utoipa::path(
    put,
    path = "/sites/{site_id}/notifications/read-all",
    tag = "Notifications",
    operation_id = "mark_all_notifications_read",
    description = "Mark all notifications as read for the current user in a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "All notifications marked as read", body = MarkAllReadResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden — requires Clerk JWT", body = ProblemDetails)
    ),
    security(("bearer_auth" = []))
)]
async fn mark_all_notifications_read(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
) -> Result<Json<MarkAllReadResponse>, ApiError> {
    let clerk_id = require_clerk_user_id(&auth.0)?;
    let updated = Notification::mark_all_read(&state.db, clerk_id, site_id).await?;
    Ok(Json(MarkAllReadResponse { updated }))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/notifications/status-counts",
    tag = "Notifications",
    operation_id = "notification_status_counts",
    description = "Counts of read vs unread notifications for the current user in a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Status counts", body = NotificationStatusCounts),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden — requires Clerk JWT", body = ProblemDetails)
    ),
    security(("bearer_auth" = []))
)]
async fn notification_status_counts(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<NotificationStatusCounts>, ApiError> {
    let clerk_id = require_clerk_user_id(&auth.0)?;
    let (read, unread) = Notification::status_counts_for_user(&state.db, clerk_id, site_id).await?;
    Ok(Json(NotificationStatusCounts { read, unread }))
}

#[utoipa::path(
    delete,
    path = "/notifications/{id}",
    tag = "Notifications",
    operation_id = "delete_notification",
    description = "Delete a single notification; scoped to the caller's Clerk ID so a user can only remove their own rows.",
    params(("id" = Uuid, Path, description = "Notification UUID")),
    responses(
        (status = 200, description = "Notification deleted", body = NotificationDeleteResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Notification not found or not owned by caller", body = ProblemDetails)
    ),
    security(("bearer_auth" = []))
)]
async fn delete_notification(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
) -> Result<Json<NotificationDeleteResponse>, ApiError> {
    let clerk_id = require_clerk_user_id(&auth.0)?;
    let deleted = Notification::delete_for_user(&state.db, id, clerk_id).await?;
    if !deleted {
        return Err(ApiError::not_found("Notification not found")
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type("notification"));
    }
    Ok(Json(NotificationDeleteResponse { deleted: 1 }))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/notifications/bulk-delete",
    tag = "Notifications",
    operation_id = "bulk_delete_notifications",
    description = "Delete many notifications at once; scoped to the caller's Clerk ID and the site path parameter.",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body = BulkDeleteNotificationsRequest,
    responses(
        (status = 200, description = "Notifications deleted", body = NotificationDeleteResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden — requires Clerk JWT", body = ProblemDetails)
    ),
    security(("bearer_auth" = []))
)]
async fn bulk_delete_notifications(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
    Json(body): Json<BulkDeleteNotificationsRequest>,
) -> Result<Json<NotificationDeleteResponse>, ApiError> {
    let clerk_id = require_clerk_user_id(&auth.0)?;
    let deleted =
        Notification::delete_many_for_user(&state.db, &body.ids, clerk_id, site_id).await?;
    Ok(Json(NotificationDeleteResponse { deleted }))
}

#[utoipa::path(
    delete,
    path = "/sites/{site_id}/notifications/read",
    tag = "Notifications",
    operation_id = "delete_read_notifications",
    description = "Clear every already-read notification in the user's inbox for this site.",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Read notifications cleared", body = NotificationDeleteResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden — requires Clerk JWT", body = ProblemDetails)
    ),
    security(("bearer_auth" = []))
)]
async fn delete_read_notifications(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
) -> Result<Json<NotificationDeleteResponse>, ApiError> {
    let clerk_id = require_clerk_user_id(&auth.0)?;
    let deleted = Notification::delete_all_read_for_user(&state.db, clerk_id, site_id).await?;
    Ok(Json(NotificationDeleteResponse { deleted }))
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_notifications))
        .routes(routes!(get_unread_count))
        .routes(routes!(notification_status_counts))
        .routes(routes!(mark_all_notifications_read))
        .routes(routes!(delete_read_notifications))
        .routes(routes!(bulk_delete_notifications))
        .routes(routes!(mark_notification_read))
        .routes(routes!(delete_notification))
}
