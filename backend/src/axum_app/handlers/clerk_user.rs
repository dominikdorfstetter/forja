//! Axum port of `crate::handlers::clerk_user`. Seven endpoints for
//! Clerk user listing/lookup plus moderation actions (suspend/ban/
//! unsuspend/delete). Mounted under `/api/v1`.
//!
//! Reuses `crate::handlers::clerk_user::{ModerationInfo, to_response}`
//! via `pub(crate)` to avoid duplicating the response-building logic.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::Json;
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

use crate::AppState;
use crate::dto::clerk::{
    BanUserRequest, ClerkUserListResponse, ClerkUserResponse, ModerationActionResponse,
    SuspendUserRequest, UpdateClerkUserRoleRequest,
};
use crate::dto::validated::ValidatedJson;
use crate::errors::{ApiError, ProblemDetails, codes};
use crate::guards::actor::Actor;
use crate::guards::auth_guard::AdminKey;
use crate::models::audit::AuditAction;
use crate::models::site_membership::SiteMembership;
use crate::models::user_moderation::UserModeration;
use crate::services::audited_mutation::AuditedEntity;

/// Moderation status snapshot extracted from a `UserModeration` record.
struct ModerationInfo {
    status: String,
    reason: Option<String>,
}

impl ModerationInfo {
    fn active() -> Self {
        Self {
            status: "active".to_string(),
            reason: None,
        }
    }

    fn from_record(record: &UserModeration) -> Self {
        let status = record.effective_status().to_string();
        let reason = if status != "active" {
            record.status_reason.clone()
        } else {
            None
        };
        Self { status, reason }
    }
}

fn to_response(
    user: &crate::services::clerk_service::ClerkApiUser,
    moderation: &ModerationInfo,
) -> ClerkUserResponse {
    ClerkUserResponse {
        id: user.id.clone(),
        email: user.primary_email(),
        name: user.display_name(),
        image_url: user.image_url.clone(),
        role: user.cms_role(),
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_sign_in_at: user.last_sign_in_at,
        moderation_status: moderation.status.clone(),
        moderation_reason: moderation.reason.clone(),
    }
}

#[derive(Debug, Deserialize)]
struct ListClerkUsersQuery {
    limit: Option<i64>,
    offset: Option<i64>,
}

/// Caller must be a system admin OR have Admin+ on at least one site OR
/// hold a master/admin API key. Shared between list/get because both
/// surfaces have identical access policies.
async fn require_user_listing_access(state: &AppState, auth: &Actor) -> Result<(), ApiError> {
    let is_sys_admin = auth.is_system_admin(&state.db).await?;
    if is_sys_admin {
        return Ok(());
    }
    let clerk_user_id = auth.clerk_user_id().ok_or_else(|| {
        ApiError::forbidden("Insufficient permissions to list users")
            .with_code(codes::AUTH_INSUFFICIENT_ROLE)
    })?;
    let has_admin = SiteMembership::has_admin_on_any_site(&state.db, clerk_user_id).await?;
    if !has_admin && !auth.can_manage_keys() {
        return Err(
            ApiError::forbidden("Requires Admin role on at least one site")
                .with_code(codes::AUTH_INSUFFICIENT_ROLE),
        );
    }
    Ok(())
}

/// Resolve the configured Clerk service or return a 500 with a typed
/// error code (the moderation/listing endpoints all need it).
fn require_clerk(
    state: &AppState,
) -> Result<&crate::services::clerk_service::ClerkService, ApiError> {
    state
        .clerk_service
        .as_ref()
        .map(std::convert::AsRef::as_ref)
        .ok_or_else(|| {
            ApiError::internal("Clerk service is not configured")
                .with_code(codes::CLERK_NOT_CONFIGURED)
        })
}

/// Require system admin via SiteMembership lookup — the moderation
/// endpoints share this exact check, so factor it out.
async fn require_system_admin(state: &AppState, auth: &Actor) -> Result<(), ApiError> {
    if SiteMembership::is_system_admin(&state.db, auth.user_identifier().unwrap_or(""))
        .await
        .unwrap_or(false)
    {
        Ok(())
    } else {
        Err(ApiError::forbidden("System admin required").with_code(codes::AUTH_INSUFFICIENT_ROLE))
    }
}

#[utoipa::path(
    get,
    path = "/clerk/users",
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
async fn list_clerk_users(
    State(state): State<AppState>,
    Query(q): Query<ListClerkUsersQuery>,
    auth: Actor,
) -> Result<Json<ClerkUserListResponse>, ApiError> {
    require_user_listing_access(&state, &auth).await?;
    let clerk = require_clerk(&state)?;

    let limit = q.limit.unwrap_or(20).min(100);
    let offset = q.offset.unwrap_or(0);

    let (users, total_count) = clerk.list_users(limit, offset).await?;

    let user_ids: Vec<String> = users.iter().map(|u| u.id.clone()).collect();
    let moderation_records = UserModeration::find_by_user_ids(&state.db, &user_ids).await?;
    let moderation_map: std::collections::HashMap<String, ModerationInfo> = moderation_records
        .iter()
        .map(|r| (r.clerk_user_id.clone(), ModerationInfo::from_record(r)))
        .collect();

    let active = ModerationInfo::active();
    let data: Vec<ClerkUserResponse> = users
        .iter()
        .map(|u| {
            let info = moderation_map.get(&u.id).unwrap_or(&active);
            to_response(u, info)
        })
        .collect();

    Ok(Json(ClerkUserListResponse { data, total_count }))
}

#[utoipa::path(
    get,
    path = "/clerk/users/{id}",
    tag = "Clerk Users",
    operation_id = "get_clerk_user",
    description = "Get a single Clerk user by ID",
    security(("api_key" = []), ("bearer_auth" = [])),
    params(("id" = String, Path, description = "Clerk user ID")),
    responses(
        (status = 200, description = "Clerk user details", body = ClerkUserResponse),
        (status = 403, description = "Insufficient permissions"),
        (status = 404, description = "User not found"),
        (status = 500, description = "Clerk service not available")
    )
)]
async fn get_clerk_user(
    State(state): State<AppState>,
    Path(id): Path<String>,
    auth: Actor,
) -> Result<Json<ClerkUserResponse>, ApiError> {
    require_user_listing_access(&state, &auth).await?;
    let clerk = require_clerk(&state)?;

    let user = clerk.get_user(&id).await?;

    let moderation_records =
        UserModeration::find_by_user_ids(&state.db, std::slice::from_ref(&id)).await?;
    let info = moderation_records
        .first()
        .map(ModerationInfo::from_record)
        .unwrap_or_else(ModerationInfo::active);

    Ok(Json(to_response(&user, &info)))
}

#[utoipa::path(
    put,
    path = "/clerk/users/{id}/role",
    tag = "Clerk Users",
    operation_id = "update_clerk_user_role",
    description = "Update a Clerk user's CMS role",
    security(("api_key" = []), ("bearer_auth" = [])),
    params(("id" = String, Path, description = "Clerk user ID")),
    request_body = UpdateClerkUserRoleRequest,
    responses(
        (status = 200, description = "Updated user", body = ClerkUserResponse),
        (status = 400, description = "Invalid role", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions"),
        (status = 404, description = "User not found"),
        (status = 500, description = "Clerk service not available")
    )
)]
async fn update_clerk_user_role(
    State(state): State<AppState>,
    Path(id): Path<String>,
    _auth: AdminKey,
    ValidatedJson(body): ValidatedJson<UpdateClerkUserRoleRequest>,
) -> Result<(StatusCode, Json<ClerkUserResponse>), ApiError> {
    let valid_roles = ["read", "write", "admin", "master"];
    if !valid_roles.contains(&body.role.as_str()) {
        return Err(ApiError::validation(format!(
            "Invalid role '{}'. Must be one of: {}",
            body.role,
            valid_roles.join(", ")
        ))
        .with_code(codes::CLERK_INVALID_ROLE));
    }

    let clerk = require_clerk(&state)?;

    let user = clerk.update_user_role(&id, &body.role).await?;

    let moderation_records =
        UserModeration::find_by_user_ids(&state.db, std::slice::from_ref(&id)).await?;
    let info = moderation_records
        .first()
        .map(ModerationInfo::from_record)
        .unwrap_or_else(ModerationInfo::active);

    Ok((StatusCode::OK, Json(to_response(&user, &info))))
}

#[utoipa::path(
    post,
    path = "/admin/users/{clerk_user_id}/suspend",
    tag = "Clerk Users",
    operation_id = "suspend_user",
    description = "Suspend a user for a specified duration. Requires system admin.",
    params(("clerk_user_id" = String, Path, description = "Clerk user ID")),
    request_body = SuspendUserRequest,
    responses(
        (status = 200, description = "User suspended", body = ModerationActionResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden")
    ),
    security(("bearer_auth" = []))
)]
async fn suspend_user(
    State(state): State<AppState>,
    Path(clerk_user_id): Path<String>,
    auth: AdminKey,
    ValidatedJson(body): ValidatedJson<SuspendUserRequest>,
) -> Result<Json<ModerationActionResponse>, ApiError> {
    require_system_admin(&state, &auth.0).await?;

    let body = body.into_inner();
    let admin_id = auth.0.user_identifier().unwrap_or("system").to_string();
    let record = UserModeration::suspend(
        &state.db,
        &clerk_user_id,
        &body.reason,
        body.duration_hours,
        &admin_id,
    )
    .await?;

    AuditedEntity::audit_only("user_moderation")
        .mutate(AuditAction::Update, record.id)
        .actor(auth.0.id)
        .metadata(serde_json::json!({
            "action": "suspend",
            "target": clerk_user_id,
            "reason": body.reason,
            "duration_hours": body.duration_hours
        }))
        .execute(&state.db)
        .await;

    Ok(Json(ModerationActionResponse {
        clerk_user_id,
        status: "suspended".to_string(),
        reason: Some(body.reason),
        expires_at: record.suspension_expires_at.map(|d| d.to_rfc3339()),
    }))
}

#[utoipa::path(
    post,
    path = "/admin/users/{clerk_user_id}/ban",
    tag = "Clerk Users",
    operation_id = "ban_user",
    description = "Permanently ban a user. Requires system admin.",
    params(("clerk_user_id" = String, Path, description = "Clerk user ID")),
    request_body = BanUserRequest,
    responses(
        (status = 200, description = "User banned", body = ModerationActionResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden")
    ),
    security(("bearer_auth" = []))
)]
async fn ban_user(
    State(state): State<AppState>,
    Path(clerk_user_id): Path<String>,
    auth: AdminKey,
    ValidatedJson(body): ValidatedJson<BanUserRequest>,
) -> Result<Json<ModerationActionResponse>, ApiError> {
    require_system_admin(&state, &auth.0).await?;

    let body = body.into_inner();
    let admin_id = auth.0.user_identifier().unwrap_or("system").to_string();
    let record = UserModeration::ban(&state.db, &clerk_user_id, &body.reason, &admin_id).await?;

    AuditedEntity::audit_only("user_moderation")
        .mutate(AuditAction::Update, record.id)
        .actor(auth.0.id)
        .metadata(serde_json::json!({
            "action": "ban",
            "target": clerk_user_id,
            "reason": body.reason
        }))
        .execute(&state.db)
        .await;

    Ok(Json(ModerationActionResponse {
        clerk_user_id,
        status: "banned".to_string(),
        reason: Some(body.reason),
        expires_at: None,
    }))
}

#[utoipa::path(
    post,
    path = "/admin/users/{clerk_user_id}/unsuspend",
    tag = "Clerk Users",
    operation_id = "unsuspend_user",
    description = "Lift a suspension or ban, restoring the user to active status. Requires system admin.",
    params(("clerk_user_id" = String, Path, description = "Clerk user ID")),
    responses(
        (status = 200, description = "User unsuspended", body = ModerationActionResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Moderation record not found", body = ProblemDetails)
    ),
    security(("bearer_auth" = []))
)]
async fn unsuspend_user(
    State(state): State<AppState>,
    Path(clerk_user_id): Path<String>,
    auth: AdminKey,
) -> Result<Json<ModerationActionResponse>, ApiError> {
    require_system_admin(&state, &auth.0).await?;

    let moderation_records =
        UserModeration::find_by_user_ids(&state.db, std::slice::from_ref(&clerk_user_id)).await?;
    if let Some(record) = moderation_records.first()
        && record.is_banned()
    {
        return Err(
            ApiError::bad_request("Cannot unsuspend a banned user. Use delete instead.")
                .with_code(codes::BAD_REQUEST),
        );
    }

    let admin_id = auth.0.user_identifier().unwrap_or("system").to_string();
    let _record = UserModeration::unsuspend(&state.db, &clerk_user_id, &admin_id).await?;

    AuditedEntity::audit_only("user_moderation")
        .mutate(AuditAction::Update, uuid::Uuid::nil())
        .actor(auth.0.id)
        .metadata(serde_json::json!({
            "action": "unsuspend",
            "target": clerk_user_id
        }))
        .execute(&state.db)
        .await;

    Ok(Json(ModerationActionResponse {
        clerk_user_id,
        status: "active".to_string(),
        reason: None,
        expires_at: None,
    }))
}

#[utoipa::path(
    delete,
    path = "/admin/users/{clerk_user_id}",
    tag = "Clerk Users",
    operation_id = "delete_banned_user",
    description = "Permanently delete a banned user, removing all associated data. Requires system admin.",
    params(("clerk_user_id" = String, Path, description = "Clerk user ID")),
    responses(
        (status = 200, description = "User deleted", body = ModerationActionResponse),
        (status = 400, description = "User is not banned"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "User not found", body = ProblemDetails)
    ),
    security(("bearer_auth" = []))
)]
async fn delete_banned_user(
    State(state): State<AppState>,
    Path(clerk_user_id): Path<String>,
    auth: AdminKey,
) -> Result<Json<ModerationActionResponse>, ApiError> {
    require_system_admin(&state, &auth.0).await?;

    let moderation_records =
        UserModeration::find_by_user_ids(&state.db, std::slice::from_ref(&clerk_user_id)).await?;
    let record = moderation_records.first().ok_or_else(|| {
        ApiError::not_found("No moderation record found for this user")
            .with_code(codes::RESOURCE_NOT_FOUND)
    })?;
    if !record.is_banned() {
        return Err(
            ApiError::bad_request("Only banned users can be deleted. Ban the user first.")
                .with_code(codes::BAD_REQUEST),
        );
    }

    // Same full erasure as self-service deletion — the banned-user purge
    // must not leave more identity behind than a voluntary one (#3).
    let actor_uuid = uuid::Uuid::new_v5(
        &crate::guards::auth_guard::CLERK_UUID_NAMESPACE,
        clerk_user_id.as_bytes(),
    );
    crate::repos::user_data_repo::erase_user_records(&state.db, &clerk_user_id, actor_uuid).await?;

    if let Some(clerk) = state.clerk_service.as_ref() {
        clerk.delete_user(&clerk_user_id).await?;
    }

    AuditedEntity::audit_only("user")
        .mutate(AuditAction::Delete, uuid::Uuid::nil())
        .actor(auth.0.id)
        .metadata(serde_json::json!({
            "action": "delete_banned_user",
            "target": clerk_user_id
        }))
        .execute(&state.db)
        .await;

    Ok(Json(ModerationActionResponse {
        clerk_user_id,
        status: "deleted".to_string(),
        reason: None,
        expires_at: None,
    }))
}

/// System-admin gate for DSR fulfilment. Unlike `require_system_admin`
/// (Clerk lookup only), this accepts a master API key too — the canonical
/// `Actor::is_system_admin` seam — so headless operators can fulfil DSRs.
async fn require_dsr_admin(state: &AppState, auth: &Actor) -> Result<(), ApiError> {
    if auth.is_system_admin(&state.db).await? {
        Ok(())
    } else {
        Err(ApiError::forbidden("System admin required").with_code(codes::AUTH_INSUFFICIENT_ROLE))
    }
}

#[utoipa::path(
    get,
    path = "/admin/users/{clerk_user_id}/export",
    tag = "Clerk Users",
    operation_id = "export_user_data_on_behalf",
    description = "Export all data associated with a user (GDPR Art. 20), fulfilled by a system admin on the user's behalf. Every call is audit-logged with actor and target.",
    params(("clerk_user_id" = String, Path, description = "Clerk user ID of the data subject")),
    responses(
        (status = 200, description = "User data export", body = crate::dto::auth::UserDataExportResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — system admin required")
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn export_user_data_on_behalf(
    State(state): State<AppState>,
    Path(clerk_user_id): Path<String>,
    auth: Actor,
) -> Result<Json<crate::dto::auth::UserDataExportResponse>, ApiError> {
    require_dsr_admin(&state, &auth).await?;

    let export =
        crate::services::user_export::build_clerk_user_export(&state, &clerk_user_id).await?;

    AuditedEntity::audit_only("user")
        .mutate(AuditAction::Read, uuid::Uuid::nil())
        .actor(auth.id)
        .metadata(serde_json::json!({
            "action": "dsr_export",
            "target": clerk_user_id,
            "on_behalf": true
        }))
        .execute(&state.db)
        .await;

    Ok(Json(export))
}

#[utoipa::path(
    delete,
    path = "/admin/users/{clerk_user_id}/account",
    tag = "Clerk Users",
    operation_id = "delete_user_account_on_behalf",
    description = "Delete a user's account (GDPR Art. 17), fulfilled by a system admin on the user's behalf — same erasure as self-service deletion, no ban required. Refused while the user is the sole owner of a site. Audit-logged with actor and target.",
    params(("clerk_user_id" = String, Path, description = "Clerk user ID of the data subject")),
    responses(
        (status = 204, description = "Account deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — system admin required"),
        (status = 409, description = "User is sole owner of one or more sites")
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn delete_user_account_on_behalf(
    State(state): State<AppState>,
    Path(clerk_user_id): Path<String>,
    auth: Actor,
) -> Result<StatusCode, ApiError> {
    require_dsr_admin(&state, &auth).await?;

    if let Some(site_id) = SiteMembership::find_solely_owned_sites(&state.db, &clerk_user_id)
        .await?
        .first()
    {
        return Err(ApiError::conflict(format!(
            "User is the sole owner of site {site_id}. Transfer ownership before deleting the account.",
        ))
        .with_code(codes::AUTH_ACCOUNT_SOLE_OWNER));
    }

    if let Some(clerk) = state.clerk_service.as_ref() {
        clerk.delete_user(&clerk_user_id).await?;
    }

    let target_uuid = uuid::Uuid::new_v5(
        &crate::guards::auth_guard::CLERK_UUID_NAMESPACE,
        clerk_user_id.as_bytes(),
    );
    crate::repos::user_data_repo::erase_user_records(&state.db, &clerk_user_id, target_uuid)
        .await?;

    AuditedEntity::audit_only("user")
        .mutate(AuditAction::Delete, uuid::Uuid::nil())
        .actor(auth.id)
        .metadata(serde_json::json!({
            "action": "dsr_delete",
            "target": clerk_user_id,
            "on_behalf": true
        }))
        .execute(&state.db)
        .await;

    Ok(StatusCode::NO_CONTENT)
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_clerk_users))
        .routes(routes!(get_clerk_user))
        .routes(routes!(update_clerk_user_role))
        .routes(routes!(suspend_user))
        .routes(routes!(ban_user))
        .routes(routes!(unsuspend_user))
        .routes(routes!(delete_banned_user))
        .routes(routes!(export_user_data_on_behalf))
        .routes(routes!(delete_user_account_on_behalf))
}
