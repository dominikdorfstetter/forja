//! Federation activities admin endpoints

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;

use crate::dto::federation::responses::ActivityResponse;
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::guards::federation_guard::{can_manage_federation, can_view_federation};
use crate::guards::module_guard::{FederationModule, ModuleGuard};
use crate::models::federation::activity::ApActivity;
use crate::models::federation::types::{ApActivityDirection, ApActivityStatus};
use crate::models::site::Site;
use crate::models::site_membership::SiteRole;
use crate::utils::pagination::{Paginated, PaginationParams};
use crate::AppState;

/// Convert an ApActivity model to an ActivityResponse DTO.
fn activity_to_response(a: ApActivity) -> ActivityResponse {
    ActivityResponse {
        id: a.id,
        activity_type: a.activity_type,
        activity_uri: a.activity_uri,
        actor_uri: a.actor_uri,
        object_uri: a.object_uri,
        direction: format!("{:?}", a.direction).to_lowercase(),
        status: format!("{:?}", a.status).to_lowercase(),
        error_message: a.error_message,
        created_at: a.created_at,
    }
}

/// Parse a direction filter string into the enum.
fn parse_direction(s: &str) -> Option<ApActivityDirection> {
    match s {
        "in" => Some(ApActivityDirection::In),
        "out" => Some(ApActivityDirection::Out),
        _ => None,
    }
}

/// Parse a status filter string into the enum.
fn parse_status(s: &str) -> Option<ApActivityStatus> {
    match s {
        "pending" => Some(ApActivityStatus::Pending),
        "done" => Some(ApActivityStatus::Done),
        "failed" => Some(ApActivityStatus::Failed),
        _ => None,
    }
}

/// List activities for a site (paginated, with optional filters)
#[utoipa::path(
    tag = "Federation",
    operation_id = "list_federation_activities",
    description = "List ActivityPub activities for a site (paginated, with optional direction/status filters)",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default: 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page (default: 10, max: 100)"),
        ("direction" = Option<String>, Query, description = "Filter by direction: in, out"),
        ("status" = Option<String>, Query, description = "Filter by status: pending, done, failed")
    ),
    responses(
        (status = 200, description = "Paginated activity list", body = Paginated<ActivityResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[allow(clippy::too_many_arguments)]
#[get("/sites/<site_id>/federation/activities?<page>&<page_size>&<direction>&<status>")]
pub async fn list_activities(
    state: &State<AppState>,
    site_id: Uuid,
    page: Option<i64>,
    page_size: Option<i64>,
    direction: Option<String>,
    status: Option<String>,
    auth: ReadKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Json<Paginated<ActivityResponse>>, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Reviewer)
        .await?;
    if !can_view_federation(&role) {
        return Err(ApiError::forbidden("Insufficient role to view activities"));
    }

    Site::find_by_id(&state.db, site_id).await?;

    let params = PaginationParams::new(page, page_size);
    let (limit, offset) = params.limit_offset();

    let dir_filter = direction.as_deref().and_then(parse_direction);
    let status_filter = status.as_deref().and_then(parse_status);

    let activities =
        ApActivity::find_by_site(&state.db, site_id, dir_filter, status_filter, limit, offset)
            .await?;

    // Count total (simplified — without filters for total)
    let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM ap_activities WHERE site_id = $1")
        .bind(site_id)
        .fetch_one(&state.db)
        .await?;
    let total = total.0;

    let items: Vec<ActivityResponse> = activities.into_iter().map(activity_to_response).collect();
    let paginated = params.paginate(items, total);

    Ok(Json(paginated))
}

/// Retry a failed activity delivery
#[utoipa::path(
    tag = "Federation",
    operation_id = "retry_federation_activity",
    description = "Retry delivery of a failed activity",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("activity_id" = Uuid, Path, description = "Activity UUID")
    ),
    responses(
        (status = 202, description = "Retry enqueued"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Activity not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/sites/<site_id>/federation/activities/<activity_id>/retry")]
pub async fn retry_activity(
    state: &State<AppState>,
    site_id: Uuid,
    activity_id: Uuid,
    auth: ReadKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Status, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Admin)
        .await?;
    if !can_manage_federation(&role) {
        return Err(ApiError::forbidden("Insufficient role to retry activities"));
    }

    Site::find_by_id(&state.db, site_id).await?;

    // Verify the activity belongs to this site and is failed
    let activity: Option<ApActivity> =
        sqlx::query_as("SELECT * FROM ap_activities WHERE id = $1 AND site_id = $2")
            .bind(activity_id)
            .bind(site_id)
            .fetch_optional(&state.db)
            .await?;

    let activity = activity.ok_or_else(|| ApiError::not_found("Activity not found"))?;

    if activity.status != ApActivityStatus::Failed {
        return Err(ApiError::bad_request(
            "Only failed activities can be retried",
        ));
    }

    // Reset status to pending
    ApActivity::update_status(&state.db, activity_id, ApActivityStatus::Pending, None).await?;

    tracing::info!(
        site_id = %site_id,
        activity_id = %activity_id,
        "Retry enqueued for failed activity"
    );

    Ok(Status::Accepted)
}

/// Collect admin activity routes
pub fn routes() -> Vec<Route> {
    routes![list_activities, retry_activity]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_direction() {
        assert_eq!(parse_direction("in"), Some(ApActivityDirection::In));
        assert_eq!(parse_direction("out"), Some(ApActivityDirection::Out));
        assert_eq!(parse_direction("both"), None);
    }

    #[test]
    fn test_parse_status() {
        assert_eq!(parse_status("pending"), Some(ApActivityStatus::Pending));
        assert_eq!(parse_status("done"), Some(ApActivityStatus::Done));
        assert_eq!(parse_status("failed"), Some(ApActivityStatus::Failed));
        assert_eq!(parse_status("unknown"), None);
    }

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 2);
    }
}
