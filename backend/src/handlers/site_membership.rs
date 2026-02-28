//! Site membership management handlers
//!
//! Endpoints for managing per-site member roles.

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::Route;
use uuid::Uuid;
use validator::Validate;

use crate::dto::site_membership::{
    AddSiteMemberRequest, MembershipSummary, MembershipWithSite, SiteMembershipResponse,
    TransferOwnershipRequest, UpdateMemberRoleRequest,
};
use crate::errors::ApiError;
use crate::guards::auth_guard::AuthenticatedKey;
use crate::models::audit::AuditAction;
use crate::models::site_membership::{SiteMembership, SiteRole};
use crate::services::audit_service;
use crate::AppState;

/// Enrich a SiteMembership with Clerk user data
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

/// List all members of a site.
///
/// Requires Viewer+ on the site.
#[utoipa::path(
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
#[get("/sites/<site_id>/members")]
pub async fn list_site_members(
    auth: AuthenticatedKey,
    state: &rocket::State<AppState>,
    site_id: Uuid,
) -> Result<Json<Vec<SiteMembershipResponse>>, ApiError> {
    auth.authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;

    let memberships = SiteMembership::find_all_for_site(&state.db, site_id).await?;
    let mut responses = Vec::with_capacity(memberships.len());
    for m in &memberships {
        responses.push(enrich_membership(m, state.inner()).await);
    }

    Ok(Json(responses))
}

/// Add a member to a site.
///
/// Requires Admin+ on the site.
#[utoipa::path(
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
#[post("/sites/<site_id>/members", data = "<body>")]
pub async fn add_site_member(
    auth: AuthenticatedKey,
    state: &rocket::State<AppState>,
    site_id: Uuid,
    body: Json<AddSiteMemberRequest>,
) -> Result<(Status, Json<SiteMembershipResponse>), ApiError> {
    let caller_role = auth
        .require_site_role(&state.db, site_id, &SiteRole::Admin)
        .await?;
    let req = body.into_inner();
    req.validate().map_err(ApiError::from)?;

    // Only Owner can assign Admin or Owner roles
    if matches!(req.role, SiteRole::Owner | SiteRole::Admin)
        && !caller_role.can_transfer_ownership()
        && !matches!(caller_role, SiteRole::Owner)
    {
        return Err(ApiError::Forbidden(
            "Only the site owner can assign Admin or Owner roles".into(),
        ));
    }

    // Check if already a member
    let existing =
        SiteMembership::find_by_clerk_user_and_site(&state.db, &req.clerk_user_id, site_id).await?;
    if existing.is_some() {
        return Err(ApiError::Conflict(
            "User is already a member of this site".into(),
        ));
    }

    let invited_by = auth.clerk_user_id().map(|s| s.to_string());
    let membership_result = SiteMembership::create(
        &state.db,
        &req.clerk_user_id,
        site_id,
        &req.role,
        invited_by.as_deref(),
    )
    .await;
    // Drop sensitive identifier before error propagation to prevent cleartext logging
    drop(invited_by);
    let membership = membership_result?;

    audit_service::log_action(
        &state.db,
        Some(site_id),
        Some(auth.id),
        AuditAction::Create,
        "member",
        membership.id,
        None,
    )
    .await;
    Ok((
        Status::Created,
        Json(enrich_membership(&membership, state.inner()).await),
    ))
}

/// Update a member's role.
///
/// Requires Admin+ on the site. Only Owner can set Admin/Owner roles.
#[utoipa::path(
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
#[put("/sites/<site_id>/members/<member_id>/role", data = "<body>")]
pub async fn update_member_role(
    auth: AuthenticatedKey,
    state: &rocket::State<AppState>,
    site_id: Uuid,
    member_id: Uuid,
    body: Json<UpdateMemberRoleRequest>,
) -> Result<Json<SiteMembershipResponse>, ApiError> {
    let caller_role = auth
        .require_site_role(&state.db, site_id, &SiteRole::Admin)
        .await?;
    let req = body.into_inner();

    // Only Owner can promote to Admin or Owner
    if matches!(req.role, SiteRole::Owner | SiteRole::Admin)
        && !matches!(caller_role, SiteRole::Owner)
    {
        return Err(ApiError::Forbidden(
            "Only the site owner can assign Admin or Owner roles".into(),
        ));
    }

    let membership = SiteMembership::update_role(&state.db, member_id, &req.role).await?;

    // Verify membership belongs to this site
    if membership.site_id != site_id {
        return Err(ApiError::NotFound(
            "Membership not found on this site".into(),
        ));
    }

    audit_service::log_action(
        &state.db,
        Some(site_id),
        Some(auth.id),
        AuditAction::Update,
        "member",
        member_id,
        Some(serde_json::json!({"new_role": format!("{:?}", req.role)})),
    )
    .await;
    Ok(Json(enrich_membership(&membership, state.inner()).await))
}

/// Remove a member from a site.
///
/// Requires Admin+ on the site. Cannot remove the Owner.
#[utoipa::path(
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
#[delete("/sites/<site_id>/members/<member_id>")]
pub async fn remove_site_member(
    auth: AuthenticatedKey,
    state: &rocket::State<AppState>,
    site_id: Uuid,
    member_id: Uuid,
) -> Result<Status, ApiError> {
    auth.require_site_role(&state.db, site_id, &SiteRole::Admin)
        .await?;

    // Look up the membership to check role
    let memberships = SiteMembership::find_all_for_site(&state.db, site_id).await?;
    let target = memberships
        .iter()
        .find(|m| m.id == member_id)
        .ok_or_else(|| ApiError::NotFound("Membership not found on this site".into()))?;

    if target.role == SiteRole::Owner {
        return Err(ApiError::Forbidden(
            "Cannot remove the site owner. Transfer ownership first.".into(),
        ));
    }

    SiteMembership::delete(&state.db, member_id).await?;
    audit_service::log_action(
        &state.db,
        Some(site_id),
        Some(auth.id),
        AuditAction::Delete,
        "member",
        member_id,
        None,
    )
    .await;
    Ok(Status::NoContent)
}

/// Transfer site ownership to another member.
///
/// Owner only. The current owner is demoted to Admin.
#[utoipa::path(
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
#[post("/sites/<site_id>/transfer-ownership", data = "<body>")]
pub async fn transfer_ownership(
    auth: AuthenticatedKey,
    state: &rocket::State<AppState>,
    site_id: Uuid,
    body: Json<TransferOwnershipRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    auth.require_site_role(&state.db, site_id, &SiteRole::Owner)
        .await?;
    let req = body.into_inner();
    req.validate().map_err(ApiError::from)?;

    let clerk_user_id = auth.clerk_user_id().ok_or_else(|| {
        ApiError::BadRequest("Ownership transfer requires Clerk authentication".into())
    })?;

    SiteMembership::transfer_ownership(
        &state.db,
        site_id,
        clerk_user_id,
        &req.new_owner_clerk_user_id,
    )
    .await?;

    Ok(Json(
        serde_json::json!({ "status": "ownership_transferred" }),
    ))
}

/// Get all site memberships for the currently authenticated Clerk user.
#[utoipa::path(
    tag = "Site Members",
    operation_id = "get_my_memberships",
    description = "Get all site memberships for the current Clerk user",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "List of memberships", body = Vec<MembershipSummary>),
        (status = 400, description = "Only available for Clerk users")
    )
)]
#[get("/my/memberships")]
pub async fn get_my_memberships(
    auth: AuthenticatedKey,
    state: &rocket::State<AppState>,
) -> Result<Json<Vec<MembershipSummary>>, ApiError> {
    let clerk_user_id = auth.clerk_user_id().ok_or_else(|| {
        ApiError::BadRequest("This endpoint is only available for Clerk-authenticated users".into())
    })?;

    let rows: Vec<MembershipWithSite> = sqlx::query_as(
        r#"
        SELECT sm.site_id, s.name AS site_name, s.slug AS site_slug, sm.role
        FROM site_memberships sm
        JOIN sites s ON s.id = sm.site_id AND s.is_deleted = FALSE
        WHERE sm.clerk_user_id = $1
        ORDER BY s.name ASC
        "#,
    )
    .bind(clerk_user_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(
        rows.into_iter().map(MembershipSummary::from).collect(),
    ))
}

/// Collect site membership routes
pub fn routes() -> Vec<Route> {
    routes![
        list_site_members,
        add_site_member,
        update_member_role,
        remove_site_member,
        transfer_ownership,
        get_my_memberships,
    ]
}
