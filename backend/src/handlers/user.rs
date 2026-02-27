//! User handlers

use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;
use validator::Validate;

use crate::dto::user::{CreateUserRequest, PaginatedUsers, UpdateUserRequest, UserResponse, UserSiteResponse};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::AdminKey;
use crate::models::user::{User, UserSite};
use crate::utils::pagination::PaginationParams;
use crate::AppState;

/// Get user by ID
#[utoipa::path(
    tag = "Users",
    operation_id = "get_user",
    description = "Get a user by ID",
    params(("id" = Uuid, Path, description = "User UUID")),
    responses(
        (status = 200, description = "User details", body = UserResponse),
        (status = 404, description = "User not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/users/<id>")]
pub async fn get_user(
    state: &State<AppState>,
    id: Uuid,
) -> Result<Json<UserResponse>, ApiError> {
    let user = User::find_by_id(&state.db, id).await?;
    Ok(Json(UserResponse::from(user)))
}

/// Get user by username
#[utoipa::path(
    tag = "Users",
    operation_id = "get_user_by_username",
    description = "Get a user by username",
    params(("username" = String, Path, description = "Username")),
    responses(
        (status = 200, description = "User details", body = UserResponse),
        (status = 404, description = "User not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/users/by-username/<username>", rank = 1)]
pub async fn get_user_by_username(
    state: &State<AppState>,
    username: &str,
) -> Result<Json<UserResponse>, ApiError> {
    let user = User::find_by_username(&state.db, username).await?;
    Ok(Json(UserResponse::from(user)))
}

/// List users for a site
#[utoipa::path(
    tag = "Users",
    operation_id = "list_site_users",
    description = "List all users with access to a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "List of users", body = Vec<UserResponse>)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/users")]
pub async fn list_site_users(
    state: &State<AppState>,
    site_id: Uuid,
) -> Result<Json<Vec<UserResponse>>, ApiError> {
    let users = User::find_for_site(&state.db, site_id).await?;
    let responses: Vec<UserResponse> = users.into_iter().map(UserResponse::from).collect();
    Ok(Json(responses))
}

/// Get user's site access
#[utoipa::path(
    tag = "Users",
    operation_id = "get_user_sites",
    description = "Get all site access for a user",
    params(("user_id" = Uuid, Path, description = "User UUID")),
    responses(
        (status = 200, description = "List of site access", body = Vec<UserSiteResponse>)
    ),
    security(("api_key" = []))
)]
#[get("/users/<user_id>/sites")]
pub async fn get_user_sites(
    state: &State<AppState>,
    user_id: Uuid,
) -> Result<Json<Vec<UserSiteResponse>>, ApiError> {
    let sites = UserSite::find_all_for_user(&state.db, user_id).await?;
    let responses: Vec<UserSiteResponse> = sites.into_iter().map(UserSiteResponse::from).collect();
    Ok(Json(responses))
}

/// List all users (admin)
#[utoipa::path(
    tag = "Users",
    operation_id = "list_users",
    description = "List all users with optional filters (requires admin key)",
    params(
        ("is_active" = Option<bool>, Query, description = "Filter by active status"),
        ("page" = Option<i64>, Query, description = "Page number (default 1)"),
        ("per_page" = Option<i64>, Query, description = "Items per page (default 10, max 100)")
    ),
    responses(
        (status = 200, description = "List of users", body = PaginatedUsers),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/users?<is_active>&<page>&<per_page>", rank = 2)]
pub async fn list_users(
    state: &State<AppState>,
    _auth: AdminKey,
    is_active: Option<bool>,
    page: Option<i64>,
    per_page: Option<i64>,
) -> Result<Json<PaginatedUsers>, ApiError> {
    let params = PaginationParams::new(page, per_page);
    let (limit, offset) = params.limit_offset();

    let users = User::list(
        &state.db,
        is_active,
        limit,
        offset,
    )
    .await?;

    let total = User::count(&state.db, is_active).await?;
    let items: Vec<UserResponse> = users.into_iter().map(UserResponse::from).collect();
    Ok(Json(params.paginate(items, total)))
}

/// Create a new user (admin)
#[utoipa::path(
    tag = "Users",
    operation_id = "create_user",
    description = "Create a new user (requires admin key)",
    request_body(content = CreateUserRequest, description = "User creation data"),
    responses(
        (status = 200, description = "User created", body = UserResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/users", data = "<body>")]
pub async fn create_user(
    state: &State<AppState>,
    _auth: AdminKey,
    body: Json<CreateUserRequest>,
) -> Result<Json<UserResponse>, ApiError> {
    body.validate()
        .map_err(|e| ApiError::Validation(e.to_string()))?;

    let user = User::create(
        &state.db,
        &body.username,
        &body.email,
        body.first_name.as_deref(),
        body.last_name.as_deref(),
        body.display_name.as_deref(),
        body.avatar_url.as_deref(),
        body.is_superadmin,
    )
    .await?;

    Ok(Json(UserResponse::from(user)))
}

/// Update a user (admin)
#[utoipa::path(
    tag = "Users",
    operation_id = "update_user",
    description = "Update a user (requires admin key)",
    params(("id" = Uuid, Path, description = "User UUID")),
    request_body(content = UpdateUserRequest, description = "User update data"),
    responses(
        (status = 200, description = "User updated", body = UserResponse),
        (status = 404, description = "User not found", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[put("/users/<id>", data = "<body>")]
pub async fn update_user(
    state: &State<AppState>,
    _auth: AdminKey,
    id: Uuid,
    body: Json<UpdateUserRequest>,
) -> Result<Json<UserResponse>, ApiError> {
    body.validate()
        .map_err(|e| ApiError::Validation(e.to_string()))?;

    let first_name = body.first_name.as_ref().map(|v| v.as_deref());
    let last_name = body.last_name.as_ref().map(|v| v.as_deref());
    let display_name = body.display_name.as_ref().map(|v| v.as_deref());
    let avatar_url = body.avatar_url.as_ref().map(|v| v.as_deref());

    let user = User::update(
        &state.db,
        id,
        body.username.as_deref(),
        body.email.as_deref(),
        first_name,
        last_name,
        display_name,
        avatar_url,
        body.is_active,
        body.is_superadmin,
    )
    .await?;

    Ok(Json(UserResponse::from(user)))
}

/// Delete a user (admin)
#[utoipa::path(
    tag = "Users",
    operation_id = "delete_user",
    description = "Delete a user (requires admin key)",
    params(("id" = Uuid, Path, description = "User UUID")),
    responses(
        (status = 200, description = "User deleted"),
        (status = 404, description = "User not found", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/users/<id>")]
pub async fn delete_user(
    state: &State<AppState>,
    _auth: AdminKey,
    id: Uuid,
) -> Result<(), ApiError> {
    User::delete(&state.db, id).await?;
    Ok(())
}

/// Collect user routes
pub fn routes() -> Vec<Route> {
    routes![
        get_user_by_username,
        get_user,
        list_site_users,
        get_user_sites,
        list_users,
        create_user,
        update_user,
        delete_user,
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 8, "Should have 8 user routes");
    }
}
