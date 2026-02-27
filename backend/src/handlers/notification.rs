//! Notification handlers

use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;

use crate::dto::notification::{
    MarkAllReadResponse, NotificationResponse, PaginatedNotifications, UnreadCountResponse,
};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::models::notification::Notification;
use crate::utils::pagination::PaginationParams;
use crate::AppState;

/// Helper: extract clerk_user_id or return 403.
fn require_clerk_user_id(auth: &ReadKey) -> Result<&str, ApiError> {
    auth.0.clerk_user_id().ok_or_else(|| {
        ApiError::Forbidden("Notification endpoints require Clerk JWT authentication".into())
    })
}

/// List notifications for the current user in a site (paginated)
#[utoipa::path(
    tag = "Notifications",
    operation_id = "list_notifications",
    description = "List notifications for the current user in a site (paginated, newest first)",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default 1)"),
        ("per_page" = Option<i64>, Query, description = "Items per page (default 20, max 100)")
    ),
    responses(
        (status = 200, description = "Paginated notification list", body = PaginatedNotifications),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden — requires Clerk JWT", body = ProblemDetails)
    ),
    security(("bearer_auth" = []))
)]
#[get("/sites/<site_id>/notifications?<page>&<per_page>")]
pub async fn list_notifications(
    state: &State<AppState>,
    site_id: Uuid,
    page: Option<i64>,
    per_page: Option<i64>,
    auth: ReadKey,
) -> Result<Json<PaginatedNotifications>, ApiError> {
    let clerk_id = require_clerk_user_id(&auth)?;
    let params = PaginationParams::new(page, per_page.or(Some(20)));
    let (limit, offset) = params.limit_offset();

    let notifications =
        Notification::find_for_user(&state.db, clerk_id, site_id, limit, offset).await?;
    let total = Notification::count_for_user(&state.db, clerk_id, site_id).await?;

    let items: Vec<NotificationResponse> = notifications
        .into_iter()
        .map(NotificationResponse::from)
        .collect();
    let paginated = params.paginate(items, total);

    Ok(Json(paginated))
}

/// Get unread notification count for the current user in a site
#[utoipa::path(
    tag = "Notifications",
    operation_id = "get_unread_count",
    description = "Get the unread notification count for the current user in a site",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
    ),
    responses(
        (status = 200, description = "Unread count", body = UnreadCountResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden — requires Clerk JWT", body = ProblemDetails)
    ),
    security(("bearer_auth" = []))
)]
#[get("/sites/<site_id>/notifications/unread-count")]
pub async fn get_unread_count(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
) -> Result<Json<UnreadCountResponse>, ApiError> {
    let clerk_id = require_clerk_user_id(&auth)?;
    let unread_count = Notification::count_unread(&state.db, clerk_id, site_id).await?;
    Ok(Json(UnreadCountResponse { unread_count }))
}

/// Mark a single notification as read
#[utoipa::path(
    tag = "Notifications",
    operation_id = "mark_notification_read",
    description = "Mark a single notification as read (ownership check: must be the recipient)",
    params(
        ("id" = Uuid, Path, description = "Notification UUID"),
    ),
    responses(
        (status = 200, description = "Notification marked as read", body = NotificationResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Notification not found", body = ProblemDetails)
    ),
    security(("bearer_auth" = []))
)]
#[put("/notifications/<id>/read")]
pub async fn mark_notification_read(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Json<NotificationResponse>, ApiError> {
    let clerk_id = require_clerk_user_id(&auth)?;

    // Ownership check
    let notification = Notification::find_by_id(&state.db, id).await?;
    if notification.recipient_clerk_id != clerk_id {
        return Err(ApiError::Forbidden(
            "You can only mark your own notifications as read".into(),
        ));
    }

    let updated = Notification::mark_read(&state.db, id).await?;
    Ok(Json(NotificationResponse::from(updated)))
}

/// Mark all notifications as read for the current user in a site
#[utoipa::path(
    tag = "Notifications",
    operation_id = "mark_all_notifications_read",
    description = "Mark all notifications as read for the current user in a site",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
    ),
    responses(
        (status = 200, description = "All notifications marked as read", body = MarkAllReadResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden — requires Clerk JWT", body = ProblemDetails)
    ),
    security(("bearer_auth" = []))
)]
#[put("/sites/<site_id>/notifications/read-all")]
pub async fn mark_all_notifications_read(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
) -> Result<Json<MarkAllReadResponse>, ApiError> {
    let clerk_id = require_clerk_user_id(&auth)?;
    let updated = Notification::mark_all_read(&state.db, clerk_id, site_id).await?;
    Ok(Json(MarkAllReadResponse { updated }))
}

/// Collect notification routes
pub fn routes() -> Vec<Route> {
    routes![
        list_notifications,
        get_unread_count,
        mark_notification_read,
        mark_all_notifications_read
    ]
}
