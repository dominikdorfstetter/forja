//! API Key management handlers
//!
//! Site admins+ can manage API keys scoped to their site.
//! System admins can manage all API keys.
//! Permission levels are capped by the caller's role.

use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;
use validator::Validate;

use crate::dto::api_key::{
    ApiKeyListItem, ApiKeyResponse, ApiKeyUsageResponse, BlockApiKeyRequest, CreateApiKeyRequest,
    CreateApiKeyResponse, PaginatedApiKeys, UpdateApiKeyRequest,
};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::AuthenticatedKey;
use crate::models::api_key::{ApiKey, ApiKeyPermission, ApiKeyStatus, ApiKeyUsage};
use crate::models::audit::AuditAction;
use crate::models::site_membership::SiteRole;
use crate::services::audit_service;
use crate::utils::pagination::PaginationParams;
use crate::AppState;

/// Maximum API key permission a given site role can create
fn max_permission_for_role(role: &SiteRole) -> ApiKeyPermission {
    match role {
        SiteRole::Owner => ApiKeyPermission::Admin,
        SiteRole::Admin => ApiKeyPermission::Write,
        _ => ApiKeyPermission::Read,
    }
}

/// Numeric rank for permission comparison
fn permission_rank(perm: &ApiKeyPermission) -> u8 {
    match perm {
        ApiKeyPermission::Master => 4,
        ApiKeyPermission::Admin => 3,
        ApiKeyPermission::Write => 2,
        ApiKeyPermission::Read => 1,
    }
}

/// Validate that the requested permission doesn't exceed the caller's cap.
/// System admins can create any permission level.
fn validate_permission_cap(
    requested: &ApiKeyPermission,
    caller_role: &SiteRole,
    is_system_admin: bool,
) -> Result<(), ApiError> {
    if is_system_admin {
        return Ok(());
    }
    let max = max_permission_for_role(caller_role);
    if permission_rank(requested) > permission_rank(&max) {
        return Err(ApiError::Forbidden(format!(
            "Your role ({}) can create API keys with at most {:?} permission",
            caller_role, max
        )));
    }
    Ok(())
}

/// Require Admin+ on the key's site, returning (role, is_system_admin).
async fn require_key_access(
    auth: &AuthenticatedKey,
    state: &AppState,
    key_site_id: Uuid,
) -> Result<(SiteRole, bool), ApiError> {
    let is_sys = auth.is_system_admin(&state.db).await.unwrap_or(false);
    if is_sys {
        return Ok((SiteRole::Owner, true));
    }
    let role = auth
        .require_site_role(&state.db, key_site_id, &SiteRole::Admin)
        .await?;
    Ok((role, false))
}

/// Create a new API key
///
/// Requires Admin+ on the target site. Permission is capped by role.
#[utoipa::path(
    tag = "API Keys",
    operation_id = "create_api_key",
    description = "Create a new API key scoped to a site. Permission level is capped by your role.",
    request_body(content = CreateApiKeyRequest, description = "API key creation data"),
    responses(
        (status = 200, description = "API key created", body = CreateApiKeyResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
#[post("/api-keys", data = "<body>")]
pub async fn create_api_key(
    state: &State<AppState>,
    auth: AuthenticatedKey,
    body: Json<CreateApiKeyRequest>,
) -> Result<Json<CreateApiKeyResponse>, ApiError> {
    body.validate()
        .map_err(|e| ApiError::Validation(e.to_string()))?;

    let (role, is_sys) = require_key_access(&auth, state.inner(), body.site_id).await?;
    validate_permission_cap(&body.permission, &role, is_sys)?;

    let result = ApiKey::create(
        &state.db,
        &body.name,
        body.description.as_deref(),
        body.permission,
        body.site_id,
        body.user_id,
        body.rate_limit_per_second,
        body.rate_limit_per_minute,
        body.rate_limit_per_hour,
        body.rate_limit_per_day,
        body.expires_at,
        Some(auth.id),
    )
    .await?;

    audit_service::log_action(
        &state.db,
        Some(body.site_id),
        Some(auth.id),
        AuditAction::Create,
        "api_key",
        result.api_key.id,
        None,
    )
    .await;
    Ok(Json(CreateApiKeyResponse {
        id: result.api_key.id,
        key: result.plaintext_key,
        key_prefix: result.api_key.key_prefix,
        name: result.api_key.name,
        description: result.api_key.description,
        permission: result.api_key.permission,
        site_id: result.api_key.site_id,
        user_id: result.api_key.user_id,
        status: result.api_key.status,
        rate_limit_per_second: result.api_key.rate_limit_per_second,
        rate_limit_per_minute: result.api_key.rate_limit_per_minute,
        rate_limit_per_hour: result.api_key.rate_limit_per_hour,
        rate_limit_per_day: result.api_key.rate_limit_per_day,
        expires_at: result.api_key.expires_at,
        created_at: result.api_key.created_at,
    }))
}

/// List API keys
///
/// System admins see all keys. Site admins see keys for their sites.
#[utoipa::path(
    tag = "API Keys",
    operation_id = "list_api_keys",
    description = "List API keys. System admins see all; site admins see their site's keys.",
    params(
        ("status" = Option<String>, Query, description = "Filter by status"),
        ("permission" = Option<String>, Query, description = "Filter by permission"),
        ("site_id" = Option<Uuid>, Query, description = "Filter by site ID"),
        ("page" = Option<i64>, Query, description = "Page number (default 1)"),
        ("per_page" = Option<i64>, Query, description = "Items per page (default 10, max 100)")
    ),
    responses(
        (status = 200, description = "List of API keys", body = PaginatedApiKeys),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
#[get("/api-keys?<status>&<permission>&<site_id>&<page>&<per_page>")]
pub async fn list_api_keys(
    state: &State<AppState>,
    auth: AuthenticatedKey,
    status: Option<String>,
    permission: Option<String>,
    site_id: Option<Uuid>,
    page: Option<i64>,
    per_page: Option<i64>,
) -> Result<Json<PaginatedApiKeys>, ApiError> {
    let is_sys = auth.is_system_admin(&state.db).await.unwrap_or(false);

    // Determine effective site filter
    let effective_site_id = if is_sys {
        // System admins can see all, optionally filtered
        site_id
    } else if let Some(sid) = site_id {
        // Verify caller has Admin+ on the requested site
        auth.require_site_role(&state.db, sid, &SiteRole::Admin)
            .await?;
        Some(sid)
    } else {
        // Non-system-admin without site_id filter: forbidden (must specify a site)
        return Err(ApiError::Forbidden(
            "Site admins must specify a site_id filter".into(),
        ));
    };

    let status = status
        .map(|s| match s.to_lowercase().as_str() {
            "active" => Ok(ApiKeyStatus::Active),
            "blocked" => Ok(ApiKeyStatus::Blocked),
            "expired" => Ok(ApiKeyStatus::Expired),
            "revoked" => Ok(ApiKeyStatus::Revoked),
            _ => Err(ApiError::Validation(format!("Invalid status: {}", s))),
        })
        .transpose()?;

    let permission = permission
        .map(|p| match p.to_lowercase().as_str() {
            "master" => Ok(ApiKeyPermission::Master),
            "admin" => Ok(ApiKeyPermission::Admin),
            "write" => Ok(ApiKeyPermission::Write),
            "read" => Ok(ApiKeyPermission::Read),
            _ => Err(ApiError::Validation(format!("Invalid permission: {}", p))),
        })
        .transpose()?;

    let params = PaginationParams::new(page, per_page);
    let (limit, offset) = params.limit_offset();

    let keys = ApiKey::list(
        &state.db,
        status,
        permission,
        effective_site_id,
        limit,
        offset,
    )
    .await?;
    let total = ApiKey::count(&state.db, status, permission, effective_site_id).await?;
    let items: Vec<ApiKeyListItem> = keys.into_iter().map(ApiKeyListItem::from).collect();
    Ok(Json(params.paginate(items, total)))
}

/// Get an API key by ID
#[utoipa::path(
    tag = "API Keys",
    operation_id = "get_api_key",
    description = "Get an API key by its ID",
    params(("id" = Uuid, Path, description = "API key UUID")),
    responses(
        (status = 200, description = "API key details", body = ApiKeyResponse),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "API key not found", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
#[get("/api-keys/<id>")]
pub async fn get_api_key(
    state: &State<AppState>,
    auth: AuthenticatedKey,
    id: Uuid,
) -> Result<Json<ApiKeyResponse>, ApiError> {
    let key = ApiKey::find_by_id(&state.db, id).await?;
    require_key_access(&auth, state.inner(), key.site_id).await?;
    Ok(Json(ApiKeyResponse::from(key)))
}

/// Update an API key
#[utoipa::path(
    tag = "API Keys",
    operation_id = "update_api_key",
    description = "Update an API key",
    params(("id" = Uuid, Path, description = "API key UUID")),
    request_body(content = UpdateApiKeyRequest, description = "API key update data"),
    responses(
        (status = 200, description = "API key updated", body = ApiKeyResponse),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "API key not found", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
#[put("/api-keys/<id>", data = "<body>")]
pub async fn update_api_key(
    state: &State<AppState>,
    auth: AuthenticatedKey,
    id: Uuid,
    body: Json<UpdateApiKeyRequest>,
) -> Result<Json<ApiKeyResponse>, ApiError> {
    body.validate()
        .map_err(|e| ApiError::Validation(e.to_string()))?;

    let existing = ApiKey::find_by_id(&state.db, id).await?;
    let (role, is_sys) = require_key_access(&auth, state.inner(), existing.site_id).await?;

    // If changing permission, validate cap
    if let Some(ref new_perm) = body.permission {
        validate_permission_cap(new_perm, &role, is_sys)?;
    }

    // If changing site, validate access to new site too
    if let Some(new_site_id) = body.site_id {
        require_key_access(&auth, state.inner(), new_site_id).await?;
    }

    let key = ApiKey::update(
        &state.db,
        id,
        body.name.as_deref(),
        body.description.as_deref(),
        body.permission,
        body.site_id,
        body.user_id,
        body.rate_limit_per_second,
        body.rate_limit_per_minute,
        body.rate_limit_per_hour,
        body.rate_limit_per_day,
        body.expires_at,
    )
    .await?;

    audit_service::log_action(
        &state.db,
        Some(existing.site_id),
        Some(auth.id),
        AuditAction::Update,
        "api_key",
        id,
        None,
    )
    .await;
    Ok(Json(ApiKeyResponse::from(key)))
}

/// Delete an API key permanently
#[utoipa::path(
    tag = "API Keys",
    operation_id = "delete_api_key",
    description = "Permanently delete an API key",
    params(("id" = Uuid, Path, description = "API key UUID")),
    responses(
        (status = 200, description = "API key deleted"),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "API key not found", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
#[delete("/api-keys/<id>")]
pub async fn delete_api_key(
    state: &State<AppState>,
    auth: AuthenticatedKey,
    id: Uuid,
) -> Result<(), ApiError> {
    let key = ApiKey::find_by_id(&state.db, id).await?;
    require_key_access(&auth, state.inner(), key.site_id).await?;
    ApiKey::delete(&state.db, id).await?;
    audit_service::log_action(
        &state.db,
        Some(key.site_id),
        Some(auth.id),
        AuditAction::Delete,
        "api_key",
        id,
        None,
    )
    .await;
    Ok(())
}

/// Block an API key
#[utoipa::path(
    tag = "API Keys",
    operation_id = "block_api_key",
    description = "Block an API key with a reason",
    params(("id" = Uuid, Path, description = "API key UUID")),
    request_body(content = BlockApiKeyRequest, description = "Block reason"),
    responses(
        (status = 200, description = "API key blocked", body = ApiKeyResponse),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "API key not found", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
#[post("/api-keys/<id>/block", data = "<body>")]
pub async fn block_api_key(
    state: &State<AppState>,
    auth: AuthenticatedKey,
    id: Uuid,
    body: Json<BlockApiKeyRequest>,
) -> Result<Json<ApiKeyResponse>, ApiError> {
    body.validate()
        .map_err(|e| ApiError::Validation(e.to_string()))?;

    let existing = ApiKey::find_by_id(&state.db, id).await?;
    require_key_access(&auth, state.inner(), existing.site_id).await?;

    let key = ApiKey::block(&state.db, id, &body.reason).await?;
    audit_service::log_action(
        &state.db,
        Some(existing.site_id),
        Some(auth.id),
        AuditAction::Update,
        "api_key",
        id,
        Some(serde_json::json!({"sub_action": "block", "reason": body.reason})),
    )
    .await;
    Ok(Json(ApiKeyResponse::from(key)))
}

/// Unblock an API key
#[utoipa::path(
    tag = "API Keys",
    operation_id = "unblock_api_key",
    description = "Unblock a previously blocked API key",
    params(("id" = Uuid, Path, description = "API key UUID")),
    responses(
        (status = 200, description = "API key unblocked", body = ApiKeyResponse),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "API key not found", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
#[post("/api-keys/<id>/unblock")]
pub async fn unblock_api_key(
    state: &State<AppState>,
    auth: AuthenticatedKey,
    id: Uuid,
) -> Result<Json<ApiKeyResponse>, ApiError> {
    let existing = ApiKey::find_by_id(&state.db, id).await?;
    require_key_access(&auth, state.inner(), existing.site_id).await?;

    let key = ApiKey::unblock(&state.db, id).await?;
    audit_service::log_action(
        &state.db,
        Some(existing.site_id),
        Some(auth.id),
        AuditAction::Update,
        "api_key",
        id,
        Some(serde_json::json!({"sub_action": "unblock"})),
    )
    .await;
    Ok(Json(ApiKeyResponse::from(key)))
}

/// Revoke an API key permanently (cannot be unblocked)
#[utoipa::path(
    tag = "API Keys",
    operation_id = "revoke_api_key",
    description = "Permanently revoke an API key (cannot be undone)",
    params(("id" = Uuid, Path, description = "API key UUID")),
    responses(
        (status = 200, description = "API key revoked", body = ApiKeyResponse),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "API key not found", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
#[post("/api-keys/<id>/revoke")]
pub async fn revoke_api_key(
    state: &State<AppState>,
    auth: AuthenticatedKey,
    id: Uuid,
) -> Result<Json<ApiKeyResponse>, ApiError> {
    let existing = ApiKey::find_by_id(&state.db, id).await?;
    require_key_access(&auth, state.inner(), existing.site_id).await?;

    let key = ApiKey::revoke(&state.db, id).await?;
    audit_service::log_action(
        &state.db,
        Some(existing.site_id),
        Some(auth.id),
        AuditAction::Update,
        "api_key",
        id,
        Some(serde_json::json!({"sub_action": "revoke"})),
    )
    .await;
    Ok(Json(ApiKeyResponse::from(key)))
}

/// Get API key usage history
#[utoipa::path(
    tag = "API Keys",
    operation_id = "get_api_key_usage",
    description = "Get usage history for an API key",
    params(
        ("id" = Uuid, Path, description = "API key UUID"),
        ("limit" = Option<i64>, Query, description = "Max results (default 50, max 100)"),
        ("offset" = Option<i64>, Query, description = "Offset for pagination")
    ),
    responses(
        (status = 200, description = "Usage history", body = Vec<ApiKeyUsageResponse>),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "API key not found", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
#[get("/api-keys/<id>/usage?<limit>&<offset>")]
pub async fn get_api_key_usage(
    state: &State<AppState>,
    auth: AuthenticatedKey,
    id: Uuid,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Json<Vec<ApiKeyUsageResponse>>, ApiError> {
    let existing = ApiKey::find_by_id(&state.db, id).await?;
    require_key_access(&auth, state.inner(), existing.site_id).await?;

    let usage = ApiKeyUsage::get_history(
        &state.db,
        id,
        limit.unwrap_or(50).min(100),
        offset.unwrap_or(0),
    )
    .await?;

    Ok(Json(
        usage.into_iter().map(ApiKeyUsageResponse::from).collect(),
    ))
}

/// Collect API key routes
pub fn routes() -> Vec<Route> {
    routes![
        create_api_key,
        list_api_keys,
        get_api_key,
        update_api_key,
        delete_api_key,
        block_api_key,
        unblock_api_key,
        revoke_api_key,
        get_api_key_usage,
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_created() {
        let routes = routes();
        assert!(!routes.is_empty());
    }

    #[test]
    fn test_max_permission_for_role() {
        assert_eq!(
            permission_rank(&max_permission_for_role(&SiteRole::Owner)),
            permission_rank(&ApiKeyPermission::Admin)
        );
        assert_eq!(
            permission_rank(&max_permission_for_role(&SiteRole::Admin)),
            permission_rank(&ApiKeyPermission::Write)
        );
        assert_eq!(
            permission_rank(&max_permission_for_role(&SiteRole::Editor)),
            permission_rank(&ApiKeyPermission::Read)
        );
    }

    #[test]
    fn test_permission_cap_system_admin() {
        // System admin can create any permission
        assert!(
            validate_permission_cap(&ApiKeyPermission::Master, &SiteRole::Viewer, true).is_ok()
        );
    }

    #[test]
    fn test_permission_cap_owner() {
        assert!(validate_permission_cap(&ApiKeyPermission::Admin, &SiteRole::Owner, false).is_ok());
        assert!(validate_permission_cap(&ApiKeyPermission::Write, &SiteRole::Owner, false).is_ok());
        assert!(validate_permission_cap(&ApiKeyPermission::Read, &SiteRole::Owner, false).is_ok());
        assert!(
            validate_permission_cap(&ApiKeyPermission::Master, &SiteRole::Owner, false).is_err()
        );
    }

    #[test]
    fn test_permission_cap_admin() {
        assert!(validate_permission_cap(&ApiKeyPermission::Write, &SiteRole::Admin, false).is_ok());
        assert!(validate_permission_cap(&ApiKeyPermission::Read, &SiteRole::Admin, false).is_ok());
        assert!(
            validate_permission_cap(&ApiKeyPermission::Admin, &SiteRole::Admin, false).is_err()
        );
        assert!(
            validate_permission_cap(&ApiKeyPermission::Master, &SiteRole::Admin, false).is_err()
        );
    }
}
