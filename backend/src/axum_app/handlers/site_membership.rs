//! Axum port of `crate::handlers::site_membership`. Seven endpoints
//! covering member CRUD, ownership transfer, the caller's own
//! membership list, and self-leave.

use crate::dto::site_membership::{
    AddSiteMemberRequest, MembershipSummary, SiteMembershipResponse, TransferOwnershipRequest,
    UpdateMemberRoleRequest,
};
use crate::dto::validated::ValidatedJson;
use crate::errors::{codes, ApiError};
use crate::guards::actor::Actor;
use crate::models::audit::AuditAction;
use crate::models::site_membership::{SiteMembership, SiteRole};
use crate::services::audited_mutation::AuditedEntity;
use crate::services::permission_cache;
use crate::services::permission_service::{Permission, PermissionService};
use crate::services::site_membership_service;
use crate::AppState;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::Json;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

/// Hydrate a `SiteMembership` row with Clerk user info (name/email/avatar).
/// Falls back to nones if the Clerk service is unconfigured or rejects the
/// lookup — same lossy semantics as the Rocket handler.
async fn enrich_membership(
    membership: &SiteMembership,
    state: &AppState,
) -> SiteMembershipResponse {
    let (name, email, image_url) = if let Some(ref clerk) = state.clerk_service {
        match clerk.get_user(&membership.clerk_user_id).await {
            Ok(user) => (
                Some(user.display_name()),
                user.primary_email(),
                user.image_url.clone(),
            ),
            Err(_) => (None, None, None),
        }
    } else {
        (None, None, None)
    };

    SiteMembershipResponse {
        id: membership.id,
        clerk_user_id: membership.clerk_user_id.clone(),
        site_id: membership.site_id,
        role: membership.role.clone(),
        name,
        email,
        image_url,
        invited_by: membership.invited_by.clone(),
        created_at: membership.created_at,
        updated_at: membership.updated_at,
    }
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/members",
    tag = "Site Members",
    operation_id = "list_site_members",
    description = "List all members of a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    security(("api_key" = []), ("bearer_auth" = [])),
    responses(
        (status = 200, description = "List of members", body = Vec<SiteMembershipResponse>),
        (status = 403, description = "Insufficient permissions"),
        (status = 404, description = "Site not found")
    )
)]
async fn list_site_members(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: Actor,
) -> Result<Json<Vec<SiteMembershipResponse>>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth,
        site_id,
        &Permission::new("member", "read"),
    )
    .await?;

    let memberships = SiteMembership::find_all_for_site(&state.db, site_id).await?;
    let mut responses = Vec::with_capacity(memberships.len());
    for m in &memberships {
        responses.push(enrich_membership(m, &state).await);
    }

    Ok(Json(responses))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/members",
    tag = "Site Members",
    operation_id = "add_site_member",
    description = "Add a member to a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body = AddSiteMemberRequest,
    security(("api_key" = []), ("bearer_auth" = [])),
    responses(
        (status = 201, description = "Member added", body = SiteMembershipResponse),
        (status = 400, description = "Validation error"),
        (status = 403, description = "Insufficient permissions"),
        (status = 409, description = "User already a member")
    )
)]
async fn add_site_member(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: Actor,
    ValidatedJson(req): ValidatedJson<AddSiteMemberRequest>,
) -> Result<(StatusCode, Json<SiteMembershipResponse>), ApiError> {
    PermissionService::require(
        &state.db,
        &auth,
        site_id,
        &Permission::new("member", "invite"),
    )
    .await?;
    let caller_role = auth
        .effective_site_role(&state.db, site_id)
        .await?
        .unwrap_or(SiteRole::Viewer);

    if matches!(req.role, SiteRole::Owner | SiteRole::Admin)
        && !caller_role.can_transfer_ownership()
        && !matches!(caller_role, SiteRole::Owner)
    {
        return Err(
            ApiError::forbidden("Only the site owner can assign Admin or Owner roles")
                .with_code(codes::MEMBER_ROLE_OWNER_REQUIRED),
        );
    }

    let existing =
        SiteMembership::find_by_clerk_user_and_site(&state.db, &req.clerk_user_id, site_id).await?;
    if existing.is_some() {
        return Err(ApiError::conflict("User is already a member of this site")
            .with_code(codes::MEMBER_ALREADY_EXISTS));
    }

    let invited_by = auth.id.to_string();
    let membership = SiteMembership::create(
        &state.db,
        &req.clerk_user_id,
        site_id,
        &req.role,
        Some(&invited_by),
    )
    .await?;

    AuditedEntity::audit_only("member")
        .mutate(AuditAction::Create, membership.id)
        .site(site_id)
        .actor(auth.id)
        .execute(&state.db)
        .await;

    if let Some(ref mut redis) = state.redis.clone() {
        permission_cache::invalidate(redis, &req.clerk_user_id, site_id).await;
    }
    Ok((
        StatusCode::CREATED,
        Json(enrich_membership(&membership, &state).await),
    ))
}

#[utoipa::path(
    put,
    path = "/sites/{site_id}/members/{member_id}/role",
    tag = "Site Members",
    operation_id = "update_member_role",
    description = "Update a member's role on a site",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("member_id" = Uuid, Path, description = "Membership UUID")
    ),
    request_body = UpdateMemberRoleRequest,
    security(("api_key" = []), ("bearer_auth" = [])),
    responses(
        (status = 200, description = "Role updated", body = SiteMembershipResponse),
        (status = 403, description = "Insufficient permissions"),
        (status = 404, description = "Membership not found")
    )
)]
async fn update_member_role(
    State(state): State<AppState>,
    Path((site_id, member_id)): Path<(Uuid, Uuid)>,
    auth: Actor,
    Json(req): Json<UpdateMemberRoleRequest>,
) -> Result<Json<SiteMembershipResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth,
        site_id,
        &Permission::new("member", "update_role"),
    )
    .await?;
    let caller_role = auth
        .effective_site_role(&state.db, site_id)
        .await?
        .unwrap_or(SiteRole::Viewer);

    if matches!(req.role, SiteRole::Owner | SiteRole::Admin)
        && !matches!(caller_role, SiteRole::Owner)
    {
        return Err(
            ApiError::forbidden("Only the site owner can assign Admin or Owner roles")
                .with_code(codes::MEMBER_ROLE_OWNER_REQUIRED),
        );
    }

    // `update_role` scopes the write to `site_id`, so a `member_id` belonging
    // to another site is rejected (404) before any mutation — no late check.
    let membership = SiteMembership::update_role(&state.db, member_id, site_id, &req.role).await?;

    AuditedEntity::audit_only("member")
        .mutate(AuditAction::Update, member_id)
        .site(site_id)
        .actor(auth.id)
        .metadata(serde_json::json!({"new_role": format!("{:?}", req.role)}))
        .execute(&state.db)
        .await;

    if let Some(ref mut redis) = state.redis.clone() {
        permission_cache::invalidate(redis, &membership.clerk_user_id, site_id).await;
    }

    Ok(Json(enrich_membership(&membership, &state).await))
}

#[utoipa::path(
    delete,
    path = "/sites/{site_id}/members/{member_id}",
    tag = "Site Members",
    operation_id = "remove_site_member",
    description = "Remove a member from a site",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("member_id" = Uuid, Path, description = "Membership UUID")
    ),
    security(("api_key" = []), ("bearer_auth" = [])),
    responses(
        (status = 204, description = "Member removed"),
        (status = 403, description = "Insufficient permissions or cannot remove owner"),
        (status = 404, description = "Membership not found")
    )
)]
async fn remove_site_member(
    State(state): State<AppState>,
    Path((site_id, member_id)): Path<(Uuid, Uuid)>,
    auth: Actor,
) -> Result<StatusCode, ApiError> {
    PermissionService::require(
        &state.db,
        &auth,
        site_id,
        &Permission::new("member", "remove"),
    )
    .await?;

    let target = SiteMembership::find_by_id_and_site(&state.db, member_id, site_id)
        .await?
        .ok_or_else(|| {
            ApiError::not_found("Membership not found on this site")
                .with_code(codes::RESOURCE_NOT_FOUND)
        })?;

    if target.role == SiteRole::Owner {
        return Err(
            ApiError::forbidden("Cannot remove the site owner. Transfer ownership first.")
                .with_code(codes::MEMBER_CANNOT_REMOVE_OWNER),
        );
    }

    let removed_user_id = target.clerk_user_id.clone();
    SiteMembership::delete(&state.db, member_id).await?;
    AuditedEntity::audit_only("member")
        .mutate(AuditAction::Delete, member_id)
        .site(site_id)
        .actor(auth.id)
        .execute(&state.db)
        .await;

    if let Some(ref mut redis) = state.redis.clone() {
        permission_cache::invalidate(redis, &removed_user_id, site_id).await;
    }

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/transfer-ownership",
    tag = "Site Members",
    operation_id = "transfer_site_ownership",
    description = "Transfer ownership of a site to another user",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body = TransferOwnershipRequest,
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Ownership transferred"),
        (status = 403, description = "Only the owner can transfer ownership"),
        (status = 404, description = "Site not found")
    )
)]
async fn transfer_ownership(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: Actor,
    ValidatedJson(req): ValidatedJson<TransferOwnershipRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth,
        site_id,
        &Permission::new("member", "transfer"),
    )
    .await?;

    let clerk_user_id = auth.clerk_user_id().ok_or_else(|| {
        ApiError::bad_request("Ownership transfer requires Clerk authentication")
            .with_code(codes::MEMBER_REQUIRES_CLERK_AUTH)
    })?;

    // Transfer + audit are bundled in the service so the audit can't be
    // omitted from the mutation (issue #830).
    site_membership_service::transfer_ownership(
        &state.db,
        site_id,
        auth.id,
        clerk_user_id,
        &req.new_owner_clerk_user_id,
    )
    .await?;

    Ok(Json(
        serde_json::json!({ "status": "ownership_transferred" }),
    ))
}

#[utoipa::path(
    get,
    path = "/my/memberships",
    tag = "Site Members",
    operation_id = "get_my_memberships",
    description = "Get all site memberships for the current Clerk user",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "List of memberships", body = Vec<MembershipSummary>),
        (status = 400, description = "Only available for Clerk users")
    )
)]
async fn get_my_memberships(
    State(state): State<AppState>,
    auth: Actor,
) -> Result<Json<Vec<MembershipSummary>>, ApiError> {
    let clerk_user_id = auth.clerk_user_id().ok_or_else(|| {
        ApiError::bad_request("This endpoint is only available for Clerk-authenticated users")
            .with_code(codes::BAD_REQUEST)
    })?;

    let rows = SiteMembership::find_summaries_for_user(&state.db, clerk_user_id).await?;

    Ok(Json(
        rows.into_iter().map(MembershipSummary::from).collect(),
    ))
}

#[utoipa::path(
    delete,
    path = "/sites/{site_id}/leave",
    tag = "Site Members",
    operation_id = "leave_site",
    description = "Leave a site by removing your own membership",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 204, description = "Successfully left the site"),
        (status = 403, description = "Site owners cannot leave"),
        (status = 404, description = "Membership not found")
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn leave_site(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: Actor,
) -> Result<StatusCode, ApiError> {
    let clerk_user_id = auth.clerk_user_id().ok_or_else(|| {
        ApiError::forbidden("Clerk authentication required")
            .with_code(codes::MEMBER_REQUIRES_CLERK_AUTH)
    })?;

    // Lookup + owner-self-leave guard + delete + audit live in the service so
    // the audit is inseparable from the delete and assertable in CI (the
    // Clerk gate keeps this handler off the API-key integration harness).
    site_membership_service::leave_site(&state.db, site_id, auth.id, clerk_user_id).await?;

    // If this is the demo site, mark the user as opted out so they
    // won't be re-joined on the next /auth/me call. Runtime/config concern —
    // stays in the handler, around (not inside) the audited mutation.
    if state.settings.demo_mode {
        if let Ok(demo_site) =
            crate::models::site::Site::find_by_slug(&state.db, "john-forja").await
        {
            if demo_site.id == site_id {
                let _ = crate::models::user_preferences::UserPreferences::upsert(
                    &state.db,
                    clerk_user_id,
                    serde_json::json!({
                        crate::models::user_preferences::KEY_DEMO_SITE_OPTED_IN: false
                    }),
                )
                .await;
            }
        }
    }

    if let Some(ref mut redis) = state.redis.clone() {
        permission_cache::invalidate(redis, clerk_user_id, site_id).await;
    }

    Ok(StatusCode::NO_CONTENT)
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_site_members, add_site_member))
        .routes(routes!(update_member_role))
        .routes(routes!(remove_site_member))
        .routes(routes!(transfer_ownership))
        .routes(routes!(get_my_memberships))
        .routes(routes!(leave_site))
}
