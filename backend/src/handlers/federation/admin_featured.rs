//! Federation featured/pinned posts admin endpoints

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;

use crate::dto::federation::requests::PinPostRequest;
use crate::dto::federation::responses::FeaturedPostResponse;
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::guards::federation_guard::can_manage_federation;
use crate::guards::module_guard::{FederationModule, ModuleGuard};
use crate::models::federation::actor::ApActor;
use crate::models::federation::featured::{ApFeaturedPost, MAX_FEATURED_POSTS};
use crate::models::site::Site;
use crate::models::site_membership::SiteRole;
use crate::AppState;

/// List pinned posts for a site's actor
#[utoipa::path(
    tag = "Federation",
    operation_id = "list_featured_posts",
    description = "List pinned/featured posts for a site's ActivityPub actor",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Featured posts list", body = Vec<FeaturedPostResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site or actor not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/federation/featured")]
pub async fn list_featured(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Json<Vec<FeaturedPostResponse>>, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Admin)
        .await?;
    if !can_manage_federation(&role) {
        return Err(ApiError::forbidden(
            "Insufficient role to manage featured posts",
        ));
    }

    Site::find_by_id(&state.db, site_id).await?;

    let actor = ApActor::find_by_site_id(&state.db, site_id)
        .await?
        .ok_or_else(|| ApiError::not_found("No ActivityPub actor for this site"))?;

    let posts = ApFeaturedPost::list_by_actor(&state.db, actor.id).await?;
    let items: Vec<FeaturedPostResponse> =
        posts.into_iter().map(FeaturedPostResponse::from).collect();

    Ok(Json(items))
}

/// Pin a blog post
#[utoipa::path(
    tag = "Federation",
    operation_id = "pin_featured_post",
    description = "Pin a blog post to the ActivityPub featured collection (max 3)",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = PinPostRequest, description = "Content to pin"),
    responses(
        (status = 201, description = "Post pinned", body = FeaturedPostResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site or actor not found", body = ProblemDetails),
        (status = 409, description = "Maximum pinned posts reached", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/sites/<site_id>/federation/featured", data = "<body>")]
pub async fn pin_post(
    state: &State<AppState>,
    site_id: Uuid,
    body: Json<PinPostRequest>,
    auth: ReadKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<(Status, Json<FeaturedPostResponse>), ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Admin)
        .await?;
    if !can_manage_federation(&role) {
        return Err(ApiError::forbidden(
            "Insufficient role to manage featured posts",
        ));
    }

    Site::find_by_id(&state.db, site_id).await?;

    let actor = ApActor::find_by_site_id(&state.db, site_id)
        .await?
        .ok_or_else(|| ApiError::not_found("No ActivityPub actor for this site"))?;

    // Check max limit
    let count = ApFeaturedPost::count_by_actor(&state.db, actor.id).await?;
    if count >= MAX_FEATURED_POSTS {
        return Err(ApiError::conflict(format!(
            "Maximum {} pinned posts reached",
            MAX_FEATURED_POSTS
        )));
    }

    let position = count as i32;
    let featured = ApFeaturedPost::add(&state.db, actor.id, body.content_id, position).await?;

    // Re-query with metadata
    let posts = ApFeaturedPost::list_by_actor(&state.db, actor.id).await?;
    let response = posts
        .into_iter()
        .find(|p| p.id == featured.id)
        .map(FeaturedPostResponse::from)
        .ok_or_else(|| ApiError::internal("Failed to retrieve pinned post"))?;

    Ok((Status::Created, Json(response)))
}

/// Unpin a blog post
#[utoipa::path(
    tag = "Federation",
    operation_id = "unpin_featured_post",
    description = "Remove a blog post from the ActivityPub featured collection",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("content_id" = Uuid, Path, description = "Content UUID to unpin")
    ),
    responses(
        (status = 204, description = "Post unpinned"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Post not found in featured", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/sites/<site_id>/federation/featured/<content_id>")]
pub async fn unpin_post(
    state: &State<AppState>,
    site_id: Uuid,
    content_id: Uuid,
    auth: ReadKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Status, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Admin)
        .await?;
    if !can_manage_federation(&role) {
        return Err(ApiError::forbidden(
            "Insufficient role to manage featured posts",
        ));
    }

    Site::find_by_id(&state.db, site_id).await?;

    let actor = ApActor::find_by_site_id(&state.db, site_id)
        .await?
        .ok_or_else(|| ApiError::not_found("No ActivityPub actor for this site"))?;

    let removed = ApFeaturedPost::remove(&state.db, actor.id, content_id).await?;
    if !removed {
        return Err(ApiError::not_found("Post not found in featured collection"));
    }

    Ok(Status::NoContent)
}

/// Collect admin featured posts routes
pub fn routes() -> Vec<Route> {
    routes![list_featured, pin_post, unpin_post]
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_routes_count() {
        let routes = super::routes();
        assert_eq!(routes.len(), 3, "Should have 3 admin featured routes");
    }
}
