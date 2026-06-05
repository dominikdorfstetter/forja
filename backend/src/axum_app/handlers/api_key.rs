//! Axum port of `crate::handlers::api_key`. 10 endpoints for API key
//! management (create/list/get/update/delete + block/unblock/revoke +
//! usage history/summary).
//!
//! Reuses the Rocket-side `pub(crate)` helpers
//! (`permission_rank`, `validate_permission_cap`, `require_key_access`,
//! `to_quota_response`) — pure logic, no framework coupling. The key-minting
//! ceiling lives in `crate::models::role_permission::creation_cap`.

use crate::dto::api_key::{
    ApiKeyListItem, ApiKeyResponse, ApiKeyUsageResponse, BlockApiKeyRequest, CreateApiKeyRequest,
    CreateApiKeyResponse, DailyUsageSummary, PaginatedApiKeys, QuotaWindowResponse,
    UpdateApiKeyRequest, UsageSummaryHistory, UsageSummaryQuota, UsageSummaryResponse,
    UsageSummaryTotals,
};
use crate::dto::validated::ValidatedJson;
use crate::errors::{codes, ApiError, ProblemDetails};
use crate::guards::actor::Actor;
use crate::middleware::rate_limit::{QuotaLimits, QuotaWindowInfo, RateLimiter};
use crate::models::api_key::{
    ApiKey, ApiKeyPermission, ApiKeyStatus, ApiKeyUsage, ApiKeyUsageDaily,
};
use crate::models::audit::AuditAction;
use crate::models::site_membership::SiteRole;
use crate::services::audited_mutation::AuditedEntity;
use crate::services::permission_service::{Permission, PermissionService};
use crate::utils::list_params::ListParams;
use crate::AppState;
use axum::extract::{Path, Query, State};
use axum::response::Json;
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

fn permission_rank(perm: &ApiKeyPermission) -> u8 {
    match perm {
        ApiKeyPermission::Master => 4,
        ApiKeyPermission::Admin => 3,
        ApiKeyPermission::Write => 2,
        ApiKeyPermission::Read => 1,
    }
}

fn validate_permission_cap(
    requested: &ApiKeyPermission,
    caller_role: &SiteRole,
    is_system_admin: bool,
) -> Result<(), ApiError> {
    if is_system_admin {
        return Ok(());
    }
    let max = crate::models::role_permission::creation_cap(caller_role);
    if permission_rank(requested) > permission_rank(&max) {
        return Err(ApiError::forbidden(format!(
            "Your role ({}) can create API keys with at most {:?} permission",
            caller_role, max
        ))
        .with_code(codes::API_KEY_PERMISSION_EXCEEDED));
    }
    Ok(())
}

async fn require_key_access(
    auth: &Actor,
    state: &AppState,
    key_site_id: Uuid,
) -> Result<(SiteRole, bool), ApiError> {
    let is_sys = auth.is_system_admin(&state.db).await.unwrap_or(false);
    if is_sys {
        return Ok((SiteRole::Owner, true));
    }
    PermissionService::require(
        &state.db,
        auth,
        key_site_id,
        &Permission::new("api_key", "manage"),
    )
    .await?;
    let role = auth
        .effective_site_role(&state.db, key_site_id)
        .await?
        .unwrap_or(SiteRole::Viewer);
    Ok((role, false))
}

fn to_quota_response(
    w: QuotaWindowInfo,
    now: chrono::DateTime<chrono::Utc>,
) -> QuotaWindowResponse {
    QuotaWindowResponse {
        limit: w.limit,
        used: w.used,
        remaining: w.remaining,
        resets_at: now + chrono::Duration::seconds(w.reset as i64),
    }
}

#[derive(Debug, Deserialize)]
struct ListApiKeysQuery {
    status: Option<String>,
    permission: Option<String>,
    site_id: Option<Uuid>,
    page: Option<i64>,
    page_size: Option<i64>,
    search: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UsageQuery {
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct SummaryQuery {
    days: Option<i64>,
}

#[utoipa::path(
    post,
    path = "/api-keys",
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
async fn create_api_key(
    State(state): State<AppState>,
    auth: Actor,
    ValidatedJson(body): ValidatedJson<CreateApiKeyRequest>,
) -> Result<Json<CreateApiKeyResponse>, ApiError> {
    let body = body.into_inner();
    let (role, is_sys) = require_key_access(&auth, &state, body.site_id).await?;
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
        body.quota_hourly,
        body.quota_daily,
        body.quota_monthly,
    )
    .await?;

    AuditedEntity::audit_only("api_key")
        .mutate(AuditAction::Create, result.api_key.id)
        .site(body.site_id)
        .actor(auth.id)
        .execute(&state.db)
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
        quota_hourly: result.api_key.quota_hourly,
        quota_daily: result.api_key.quota_daily,
        quota_monthly: result.api_key.quota_monthly,
        expires_at: result.api_key.expires_at,
        created_at: result.api_key.created_at,
    }))
}

#[utoipa::path(
    get,
    path = "/api-keys",
    tag = "API Keys",
    operation_id = "list_api_keys",
    description = "List API keys. System admins see all; site admins see their site's keys.",
    params(
        ("status" = Option<String>, Query, description = "Filter by status"),
        ("permission" = Option<String>, Query, description = "Filter by permission"),
        ("site_id" = Option<Uuid>, Query, description = "Filter by site ID"),
        ("page" = Option<i64>, Query, description = "Page number (default 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page (default 10, max 100)"),
        ("search" = Option<String>, Query, description = "Search by name or key prefix (ILIKE)"),
        ("sort_by" = Option<String>, Query, description = "Sort column: created_at (default), name"),
        ("sort_dir" = Option<String>, Query, description = "Sort direction: asc or desc")
    ),
    responses(
        (status = 200, description = "List of API keys", body = PaginatedApiKeys),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn list_api_keys(
    State(state): State<AppState>,
    Query(q): Query<ListApiKeysQuery>,
    auth: Actor,
) -> Result<Json<PaginatedApiKeys>, ApiError> {
    let is_sys = auth.is_system_admin(&state.db).await.unwrap_or(false);

    let effective_site_id = if is_sys {
        q.site_id
    } else if let Some(sid) = q.site_id {
        PermissionService::require(&state.db, &auth, sid, &Permission::new("api_key", "read"))
            .await?;
        Some(sid)
    } else {
        return Err(
            ApiError::forbidden("Site admins must specify a site_id filter")
                .with_code(codes::API_KEY_SITE_FILTER_REQUIRED),
        );
    };

    let status = q
        .status
        .map(|s| match s.to_lowercase().as_str() {
            "active" => Ok(ApiKeyStatus::Active),
            "blocked" => Ok(ApiKeyStatus::Blocked),
            "expired" => Ok(ApiKeyStatus::Expired),
            "revoked" => Ok(ApiKeyStatus::Revoked),
            _ => Err(ApiError::validation(format!("Invalid status: {}", s))
                .with_code(codes::API_KEY_INVALID_STATUS)),
        })
        .transpose()?;

    let permission = q
        .permission
        .map(|p| match p.to_lowercase().as_str() {
            "master" => Ok(ApiKeyPermission::Master),
            "admin" => Ok(ApiKeyPermission::Admin),
            "write" => Ok(ApiKeyPermission::Write),
            "read" => Ok(ApiKeyPermission::Read),
            _ => Err(ApiError::validation(format!("Invalid permission: {}", p))
                .with_code(codes::API_KEY_INVALID_PERMISSION)),
        })
        .transpose()?;

    let list_params = ListParams::new(q.page, q.page_size, q.search, q.sort_by, q.sort_dir);
    let (limit, offset) = list_params.limit_offset();

    let keys = ApiKey::list(
        &state.db,
        status,
        permission,
        effective_site_id,
        limit,
        offset,
        list_params.search_ref(),
        list_params.sort.sort_by.as_deref(),
        list_params.sort.sort_dir.as_deref(),
    )
    .await?;
    let total = ApiKey::count(
        &state.db,
        status,
        permission,
        effective_site_id,
        list_params.search_ref(),
    )
    .await?;
    let items: Vec<ApiKeyListItem> = keys.into_iter().map(ApiKeyListItem::from).collect();
    Ok(Json(list_params.paginate(items, total)))
}

#[utoipa::path(
    get,
    path = "/api-keys/{id}",
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
async fn get_api_key(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: Actor,
) -> Result<Json<ApiKeyResponse>, ApiError> {
    let key = ApiKey::find_by_id(&state.db, id).await?;
    require_key_access(&auth, &state, key.site_id).await?;
    Ok(Json(ApiKeyResponse::from(key)))
}

#[utoipa::path(
    put,
    path = "/api-keys/{id}",
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
async fn update_api_key(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: Actor,
    ValidatedJson(body): ValidatedJson<UpdateApiKeyRequest>,
) -> Result<Json<ApiKeyResponse>, ApiError> {
    let body = body.into_inner();
    let existing = ApiKey::find_by_id(&state.db, id).await?;
    let (role, is_sys) = require_key_access(&auth, &state, existing.site_id).await?;

    if let Some(ref new_perm) = body.permission {
        validate_permission_cap(new_perm, &role, is_sys)?;
    }

    if let Some(new_site_id) = body.site_id {
        require_key_access(&auth, &state, new_site_id).await?;
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
        body.quota_hourly,
        body.quota_daily,
        body.quota_monthly,
    )
    .await?;

    AuditedEntity::audit_only("api_key")
        .mutate(AuditAction::Update, id)
        .site(existing.site_id)
        .actor(auth.id)
        .execute(&state.db)
        .await;
    Ok(Json(ApiKeyResponse::from(key)))
}

#[utoipa::path(
    delete,
    path = "/api-keys/{id}",
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
async fn delete_api_key(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: Actor,
) -> Result<(), ApiError> {
    let key = ApiKey::find_by_id(&state.db, id).await?;
    require_key_access(&auth, &state, key.site_id).await?;
    ApiKey::delete(&state.db, id).await?;
    AuditedEntity::audit_only("api_key")
        .mutate(AuditAction::Delete, id)
        .site(key.site_id)
        .actor(auth.id)
        .execute(&state.db)
        .await;
    Ok(())
}

#[utoipa::path(
    post,
    path = "/api-keys/{id}/block",
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
async fn block_api_key(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: Actor,
    ValidatedJson(body): ValidatedJson<BlockApiKeyRequest>,
) -> Result<Json<ApiKeyResponse>, ApiError> {
    let body = body.into_inner();
    let existing = ApiKey::find_by_id(&state.db, id).await?;
    require_key_access(&auth, &state, existing.site_id).await?;

    let key = ApiKey::block(&state.db, id, &body.reason).await?;
    AuditedEntity::audit_only("api_key")
        .mutate(AuditAction::Update, id)
        .site(existing.site_id)
        .actor(auth.id)
        .metadata(serde_json::json!({"sub_action": "block", "reason": body.reason}))
        .execute(&state.db)
        .await;
    Ok(Json(ApiKeyResponse::from(key)))
}

#[utoipa::path(
    post,
    path = "/api-keys/{id}/unblock",
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
async fn unblock_api_key(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: Actor,
) -> Result<Json<ApiKeyResponse>, ApiError> {
    let existing = ApiKey::find_by_id(&state.db, id).await?;
    require_key_access(&auth, &state, existing.site_id).await?;

    let key = ApiKey::unblock(&state.db, id).await?;
    AuditedEntity::audit_only("api_key")
        .mutate(AuditAction::Update, id)
        .site(existing.site_id)
        .actor(auth.id)
        .metadata(serde_json::json!({"sub_action": "unblock"}))
        .execute(&state.db)
        .await;
    Ok(Json(ApiKeyResponse::from(key)))
}

#[utoipa::path(
    post,
    path = "/api-keys/{id}/revoke",
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
async fn revoke_api_key(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: Actor,
) -> Result<Json<ApiKeyResponse>, ApiError> {
    let existing = ApiKey::find_by_id(&state.db, id).await?;
    require_key_access(&auth, &state, existing.site_id).await?;

    let key = ApiKey::revoke(&state.db, id).await?;
    AuditedEntity::audit_only("api_key")
        .mutate(AuditAction::Update, id)
        .site(existing.site_id)
        .actor(auth.id)
        .metadata(serde_json::json!({"sub_action": "revoke"}))
        .execute(&state.db)
        .await;
    Ok(Json(ApiKeyResponse::from(key)))
}

#[utoipa::path(
    get,
    path = "/api-keys/{id}/usage",
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
async fn get_api_key_usage(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(q): Query<UsageQuery>,
    auth: Actor,
) -> Result<Json<Vec<ApiKeyUsageResponse>>, ApiError> {
    let existing = ApiKey::find_by_id(&state.db, id).await?;
    require_key_access(&auth, &state, existing.site_id).await?;

    let usage = ApiKeyUsage::get_history(
        &state.db,
        id,
        q.limit.unwrap_or(50).min(100),
        q.offset.unwrap_or(0),
    )
    .await?;

    Ok(Json(
        usage.into_iter().map(ApiKeyUsageResponse::from).collect(),
    ))
}

#[utoipa::path(
    get,
    path = "/api-keys/{id}/usage/summary",
    tag = "API Keys",
    operation_id = "get_api_key_usage_summary",
    description = "Get usage summary with quota status, daily history, and all-time totals",
    params(
        ("id" = Uuid, Path, description = "API key UUID"),
        ("days" = Option<i64>, Query, description = "Days of history (default 30, max 90)")
    ),
    responses(
        (status = 200, description = "Usage summary", body = UsageSummaryResponse),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "API key not found", body = ProblemDetails),
        (status = 422, description = "Invalid parameters", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn get_api_key_usage_summary(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(q): Query<SummaryQuery>,
    auth: Actor,
) -> Result<Json<UsageSummaryResponse>, ApiError> {
    let existing = ApiKey::find_by_id(&state.db, id).await?;
    require_key_access(&auth, &state, existing.site_id).await?;

    let days = q.days.unwrap_or(30);
    if !(1..=90).contains(&days) {
        return Err(
            ApiError::validation("days parameter must be between 1 and 90")
                .with_code(codes::API_KEY_INVALID_PARAMS),
        );
    }

    let quota = if let Some(ref redis) = state.redis {
        let mut redis_conn = redis.clone();
        let quotas = QuotaLimits {
            hourly: Some(existing.quota_hourly),
            daily: Some(existing.quota_daily),
            monthly: Some(existing.quota_monthly),
            created_at: existing.created_at,
        };
        let info = RateLimiter::read_quota(&mut redis_conn, &id.to_string(), &quotas).await;
        let now = chrono::Utc::now();
        UsageSummaryQuota {
            hourly: info.hourly.map(|w| to_quota_response(w, now)),
            daily: info.daily.map(|w| to_quota_response(w, now)),
            monthly: info.monthly.map(|w| to_quota_response(w, now)),
        }
    } else {
        UsageSummaryQuota {
            hourly: None,
            daily: None,
            monthly: None,
        }
    };

    let daily_records = ApiKeyUsageDaily::get_history(&state.db, id, days).await?;
    let history = UsageSummaryHistory {
        daily: daily_records
            .into_iter()
            .map(|r| DailyUsageSummary {
                date: r.date,
                total_requests: r.total_requests,
                successful: r.successful_requests,
                failed: r.failed_requests,
                rate_limit_hits: r.rate_limit_hits.unwrap_or(0),
            })
            .collect(),
    };

    let totals = UsageSummaryTotals {
        all_time_requests: existing.total_requests,
        last_used_at: existing.last_used_at,
    };

    Ok(Json(UsageSummaryResponse {
        quota,
        history,
        totals,
    }))
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(create_api_key, list_api_keys))
        .routes(routes!(get_api_key, update_api_key, delete_api_key))
        .routes(routes!(block_api_key))
        .routes(routes!(unblock_api_key))
        .routes(routes!(revoke_api_key))
        .routes(routes!(get_api_key_usage))
        .routes(routes!(get_api_key_usage_summary))
}
