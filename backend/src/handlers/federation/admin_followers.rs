//! Federation followers admin endpoints

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;

use crate::dto::federation::responses::FollowerResponse;
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::{AdminKey, ReadKey};
use crate::guards::federation_guard::{can_manage_federation, can_view_federation};
use crate::guards::module_guard::{FederationModule, ModuleGuard};
use crate::models::federation::actor::ApActor;
use crate::models::federation::follower::ApFollower;
use crate::models::site::Site;
use crate::models::site_membership::SiteRole;
use crate::utils::pagination::{Paginated, PaginationParams};
use crate::AppState;

/// Resolve the actor for a site, returning 404 if not found.
async fn require_actor(state: &AppState, site_id: Uuid) -> Result<ApActor, ApiError> {
    ApActor::find_by_site_id(&state.db, site_id)
        .await?
        .ok_or_else(|| ApiError::not_found("No ActivityPub actor for this site"))
}

/// List followers for a site (paginated)
#[utoipa::path(
    tag = "Federation",
    operation_id = "list_federation_followers",
    description = "List remote followers for a site (paginated)",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default: 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page (default: 10, max: 100)")
    ),
    responses(
        (status = 200, description = "Paginated follower list", body = Paginated<FollowerResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/federation/followers?<page>&<page_size>")]
pub async fn list_followers(
    state: &State<AppState>,
    site_id: Uuid,
    page: Option<i64>,
    page_size: Option<i64>,
    auth: ReadKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Json<Paginated<FollowerResponse>>, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Reviewer)
        .await?;
    if !can_view_federation(&role) {
        return Err(ApiError::forbidden("Insufficient role to view followers"));
    }

    Site::find_by_id(&state.db, site_id).await?;
    let actor = require_actor(state.inner(), site_id).await?;

    let params = PaginationParams::new(page, page_size);
    let (limit, offset) = params.limit_offset();

    // Paginated query
    let followers: Vec<ApFollower> = sqlx::query_as::<_, ApFollower>(
        r#"
        SELECT * FROM ap_followers
        WHERE actor_id = $1
        ORDER BY followed_at DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(actor.id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM ap_followers WHERE actor_id = $1")
        .bind(actor.id)
        .fetch_one(&state.db)
        .await?;
    let total = total.0;

    let items: Vec<FollowerResponse> = followers.into_iter().map(FollowerResponse::from).collect();
    let paginated = params.paginate(items, total);

    Ok(Json(paginated))
}

/// Remove a follower by ID
#[utoipa::path(
    tag = "Federation",
    operation_id = "remove_federation_follower",
    description = "Remove a remote follower",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("follower_id" = Uuid, Path, description = "Follower UUID")
    ),
    responses(
        (status = 204, description = "Follower removed"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Follower not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/sites/<site_id>/federation/followers/<follower_id>")]
pub async fn remove_follower(
    state: &State<AppState>,
    site_id: Uuid,
    follower_id: Uuid,
    auth: AdminKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Status, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Admin)
        .await?;
    if !can_manage_federation(&role) {
        return Err(ApiError::forbidden("Insufficient role to manage followers"));
    }

    Site::find_by_id(&state.db, site_id).await?;
    let actor = require_actor(state.inner(), site_id).await?;

    // Look up the follower to get their actor URI
    let follower: Option<ApFollower> =
        sqlx::query_as("SELECT * FROM ap_followers WHERE id = $1 AND actor_id = $2")
            .bind(follower_id)
            .bind(actor.id)
            .fetch_optional(&state.db)
            .await?;

    let follower = follower.ok_or_else(|| ApiError::not_found("Follower not found"))?;

    ApFollower::remove(&state.db, actor.id, &follower.follower_actor_uri).await?;

    tracing::info!(
        site_id = %site_id,
        follower_uri = %follower.follower_actor_uri,
        "Removed follower"
    );

    Ok(Status::NoContent)
}

/// Collect admin follower routes
pub fn routes() -> Vec<Route> {
    routes![list_followers, remove_follower]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 2);
    }
}
