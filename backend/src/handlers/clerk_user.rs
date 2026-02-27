//! Clerk user management handlers
//!
//! Endpoints for listing and searching Clerk users (for member management).

use rocket::serde::json::Json;
use rocket::Route;

use rocket::http::Status;
use validator::Validate;

use crate::dto::clerk::{ClerkUserListResponse, ClerkUserResponse, UpdateClerkUserRoleRequest};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::{AdminKey, AuthenticatedKey};
use crate::models::site_membership::SiteMembership;
use crate::AppState;

/// Convert a Clerk API user to our response DTO
fn to_response(user: &crate::services::clerk_service::ClerkApiUser) -> ClerkUserResponse {
    ClerkUserResponse {
        id: user.id.clone(),
        email: user.primary_email(),
        name: user.display_name(),
        image_url: user.image_url.clone(),
        role: user.cms_role(),
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_sign_in_at: user.last_sign_in_at,
    }
}

/// List all Clerk users.
///
/// Requires system admin OR Admin+ role on at least one site.
#[utoipa::path(
    tag = "Clerk Users",
    operation_id = "list_clerk_users",
    description = "List all Clerk users (for member management)",
    security(("api_key" = []), ("bearer_auth" = [])),
    params(
        ("limit" = Option<i64>, Query, description = "Max users to return (default 20)"),
        ("offset" = Option<i64>, Query, description = "Offset for pagination (default 0)")
    ),
    responses(
        (status = 200, description = "List of Clerk users", body = ClerkUserListResponse),
        (status = 403, description = "Insufficient permissions"),
        (status = 500, description = "Clerk service not available")
    )
)]
#[get("/clerk/users?<limit>&<offset>")]
pub async fn list_clerk_users(
    auth: AuthenticatedKey,
    state: &rocket::State<AppState>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Json<ClerkUserListResponse>, ApiError> {
    // System admins or API keys with Admin+ can always list users
    let is_sys_admin = auth.is_system_admin(&state.db).await?;
    if !is_sys_admin {
        // Check if the caller has admin+ role on at least one site
        let clerk_user_id = auth.clerk_user_id().ok_or_else(|| {
            ApiError::Forbidden("Insufficient permissions to list users".to_string())
        })?;
        let has_admin = SiteMembership::has_admin_on_any_site(&state.db, clerk_user_id).await?;
        if !has_admin && !auth.can_manage_keys() {
            return Err(ApiError::Forbidden(
                "Requires Admin role on at least one site".to_string(),
            ));
        }
    }

    let clerk = state
        .clerk_service
        .as_ref()
        .ok_or_else(|| ApiError::Internal("Clerk service is not configured".to_string()))?;

    let limit = limit.unwrap_or(20).min(100);
    let offset = offset.unwrap_or(0);

    let (users, total_count) = clerk.list_users(limit, offset).await?;

    let data: Vec<ClerkUserResponse> = users.iter().map(to_response).collect();

    Ok(Json(ClerkUserListResponse { data, total_count }))
}

/// Get a single Clerk user by ID.
///
/// Requires system admin OR Admin+ role on at least one site.
#[utoipa::path(
    tag = "Clerk Users",
    operation_id = "get_clerk_user",
    description = "Get a single Clerk user by ID",
    security(("api_key" = []), ("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Clerk user ID")
    ),
    responses(
        (status = 200, description = "Clerk user details", body = ClerkUserResponse),
        (status = 403, description = "Insufficient permissions"),
        (status = 404, description = "User not found"),
        (status = 500, description = "Clerk service not available")
    )
)]
#[get("/clerk/users/<id>")]
pub async fn get_clerk_user(
    auth: AuthenticatedKey,
    state: &rocket::State<AppState>,
    id: &str,
) -> Result<Json<ClerkUserResponse>, ApiError> {
    // Same permission check as list
    let is_sys_admin = auth.is_system_admin(&state.db).await?;
    if !is_sys_admin {
        let clerk_user_id = auth
            .clerk_user_id()
            .ok_or_else(|| ApiError::Forbidden("Insufficient permissions".to_string()))?;
        let has_admin = SiteMembership::has_admin_on_any_site(&state.db, clerk_user_id).await?;
        if !has_admin && !auth.can_manage_keys() {
            return Err(ApiError::Forbidden(
                "Requires Admin role on at least one site".to_string(),
            ));
        }
    }

    let clerk = state
        .clerk_service
        .as_ref()
        .ok_or_else(|| ApiError::Internal("Clerk service is not configured".to_string()))?;

    let user = clerk.get_user(id).await?;

    Ok(Json(to_response(&user)))
}

/// Update a Clerk user's CMS role.
///
/// Requires Admin or Master permission.
#[utoipa::path(
    tag = "Clerk Users",
    operation_id = "update_clerk_user_role",
    description = "Update a Clerk user's CMS role",
    security(("api_key" = []), ("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Clerk user ID")
    ),
    request_body = UpdateClerkUserRoleRequest,
    responses(
        (status = 200, description = "Updated user", body = ClerkUserResponse),
        (status = 400, description = "Invalid role", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions"),
        (status = 404, description = "User not found"),
        (status = 500, description = "Clerk service not available")
    )
)]
#[put("/clerk/users/<id>/role", data = "<body>")]
pub async fn update_clerk_user_role(
    _auth: AdminKey,
    state: &rocket::State<AppState>,
    id: &str,
    body: Json<UpdateClerkUserRoleRequest>,
) -> Result<(Status, Json<ClerkUserResponse>), ApiError> {
    body.validate().map_err(ApiError::from)?;

    let valid_roles = ["read", "write", "admin", "master"];
    if !valid_roles.contains(&body.role.as_str()) {
        return Err(ApiError::Validation(format!(
            "Invalid role '{}'. Must be one of: {}",
            body.role,
            valid_roles.join(", ")
        )));
    }

    let clerk = state
        .clerk_service
        .as_ref()
        .ok_or_else(|| ApiError::Internal("Clerk service is not configured".to_string()))?;

    let user = clerk.update_user_role(id, &body.role).await?;

    Ok((Status::Ok, Json(to_response(&user))))
}

/// Collect Clerk user routes
pub fn routes() -> Vec<Route> {
    routes![list_clerk_users, get_clerk_user, update_clerk_user_role]
}
