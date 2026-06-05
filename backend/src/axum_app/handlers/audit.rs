//! Axum port of `crate::handlers::audit`. Six endpoints for per-site
//! audit log reads + change-history revert + per-user log lookup. Mounted
//! under `/api/v1`.

use axum::extract::{Path, Query, State};
use axum::response::Json;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::dto::audit::{
    AiUsageCount, AuditLogResponse, ChangeHistoryResponse, PaginatedAuditLogs,
    RevertChangesRequest, RevertChangesResponse,
};
use crate::dto::blog::UpdateBlogRequest;
use crate::dto::legal::UpdateLegalDocumentRequest;
use crate::dto::page::UpdatePageRequest;
use crate::dto::site::UpdateSiteRequest;
use crate::dto::social::UpdateSocialLinkRequest;
use crate::dto::validated::ValidatedJson;
use crate::errors::codes;
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::{AdminKey, ReadKey};
use crate::models::audit::{AuditAction, AuditListFilters, AuditLog, ChangeHistory};
use crate::models::site::Site;
use crate::models::social::SocialLink;
use crate::repos::blog_repo::BlogRepo;
use crate::repos::legal_repo::LegalDocumentRepo;
use crate::repos::page_repo::PageRepo;
use crate::services::audit_service;
use crate::services::audited_mutation::AuditedEntity;
use crate::services::permission_service::{Permission, PermissionService};
use crate::utils::list_params::ListParams;
use crate::AppState;

#[derive(Debug, Deserialize)]
struct ListAuditQuery {
    page: Option<i64>,
    page_size: Option<i64>,
    search: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
    action: Option<String>,
    entity_type: Option<String>,
    from_date: Option<String>,
    to_date: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UserAuditQuery {
    page: Option<i64>,
    page_size: Option<i64>,
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/audit",
    tag = "Audit",
    operation_id = "list_audit_logs",
    description = "List audit logs for a site (paginated, with optional filters/sort)",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page (default 10, max 100)"),
        ("search" = Option<String>, Query, description = "Search by entity_type or action (ILIKE)"),
        ("sort_by" = Option<String>, Query, description = "Sort column: created_at, action"),
        ("sort_dir" = Option<String>, Query, description = "Sort direction: asc or desc"),
        ("action" = Option<String>, Query, description = "Filter by audit action (e.g. create, update, delete)"),
        ("entity_type" = Option<String>, Query, description = "Filter by entity type (e.g. blog, page, site)"),
        ("from_date" = Option<String>, Query, description = "ISO-8601 lower bound for created_at (inclusive)"),
        ("to_date" = Option<String>, Query, description = "ISO-8601 upper bound for created_at (inclusive)")
    ),
    responses(
        (status = 200, description = "Paginated audit logs", body = PaginatedAuditLogs),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_audit_logs(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<ListAuditQuery>,
    auth: ReadKey,
) -> Result<Json<PaginatedAuditLogs>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("audit", "read"),
    )
    .await?;

    let params = ListParams::new(q.page, q.page_size, q.search, q.sort_by, q.sort_dir);

    let parse_dt = |raw: &Option<String>| -> Result<Option<DateTime<Utc>>, ApiError> {
        match raw.as_deref() {
            None => Ok(None),
            Some(s) => DateTime::parse_from_rfc3339(s)
                .map(|dt| Some(dt.with_timezone(&Utc)))
                .map_err(|e| {
                    ApiError::bad_request(format!("Invalid ISO-8601 date: {}", e))
                        .with_code(codes::BAD_REQUEST)
                }),
        }
    };

    let from_dt = parse_dt(&q.from_date)?;
    let to_dt = parse_dt(&q.to_date)?;
    let filters = AuditListFilters {
        action: q.action.as_deref(),
        entity_type: q.entity_type.as_deref(),
        from_date: from_dt,
        to_date: to_dt,
    };

    let logs = AuditLog::find_for_site_filtered_ext(&state.db, site_id, &params, &filters).await?;
    let total =
        AuditLog::count_for_site_filtered_ext(&state.db, site_id, params.search_ref(), &filters)
            .await?;

    let display_map = AuditLog::resolve_entity_displays(&state.db, &logs).await;
    let items: Vec<AuditLogResponse> = logs
        .into_iter()
        .map(|log| {
            let key = (log.entity_type.clone(), log.entity_id);
            let display = display_map.get(&key).cloned();
            let mut resp: AuditLogResponse = log.into();
            resp.entity_display = display;
            resp
        })
        .collect();
    let paginated = params.paginate(items, total);

    Ok(Json(paginated))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/audit/ai-usage",
    tag = "Audit",
    operation_id = "ai_usage_count",
    description = "Return AI generation counts (total and last 30 days) for the site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "AI usage counts", body = AiUsageCount),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn ai_usage_count(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<AiUsageCount>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("audit", "read"),
    )
    .await?;

    let (total, last_30_days) = AuditLog::ai_usage_counts_for_site(&state.db, site_id).await?;
    Ok(Json(AiUsageCount {
        total,
        last_30_days,
    }))
}

#[utoipa::path(
    get,
    path = "/audit/entity/{entity_type}/{entity_id}",
    tag = "Audit",
    operation_id = "get_entity_audit_logs",
    description = "Get audit logs for a specific entity",
    params(
        ("entity_type" = String, Path, description = "Entity type (e.g., 'blog', 'page')"),
        ("entity_id" = Uuid, Path, description = "Entity UUID")
    ),
    responses(
        (status = 200, description = "Entity audit logs", body = Vec<AuditLogResponse>),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_entity_audit_logs(
    State(state): State<AppState>,
    Path((entity_type, entity_id)): Path<(String, Uuid)>,
    auth: ReadKey,
) -> Result<Json<Vec<AuditLogResponse>>, ApiError> {
    let logs = AuditLog::find_for_entity(&state.db, &entity_type, entity_id).await?;

    let site_ids: std::collections::BTreeSet<Uuid> =
        logs.iter().filter_map(|log| log.site_id).collect();
    for site_id in &site_ids {
        PermissionService::require(
            &state.db,
            &auth.0,
            *site_id,
            &Permission::new("audit", "read"),
        )
        .await?;
    }

    let responses: Vec<AuditLogResponse> = logs.into_iter().map(AuditLogResponse::from).collect();
    Ok(Json(responses))
}

#[utoipa::path(
    get,
    path = "/audit/history/{entity_type}/{entity_id}",
    tag = "Audit",
    operation_id = "get_entity_history",
    description = "Get change history for a specific entity",
    params(
        ("entity_type" = String, Path, description = "Entity type (e.g., 'blog', 'page')"),
        ("entity_id" = Uuid, Path, description = "Entity UUID")
    ),
    responses(
        (status = 200, description = "Entity change history", body = Vec<ChangeHistoryResponse>),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_entity_history(
    State(state): State<AppState>,
    Path((entity_type, entity_id)): Path<(String, Uuid)>,
    auth: ReadKey,
) -> Result<Json<Vec<ChangeHistoryResponse>>, ApiError> {
    let history = ChangeHistory::find_for_entity(&state.db, &entity_type, entity_id).await?;

    let site_ids: std::collections::BTreeSet<Uuid> =
        history.iter().filter_map(|ch| ch.site_id).collect();
    for site_id in &site_ids {
        PermissionService::require(
            &state.db,
            &auth.0,
            *site_id,
            &Permission::new("audit", "read"),
        )
        .await?;
    }

    let responses: Vec<ChangeHistoryResponse> = history
        .into_iter()
        .map(ChangeHistoryResponse::from)
        .collect();
    Ok(Json(responses))
}

#[utoipa::path(
    post,
    path = "/audit/history/revert",
    tag = "Audit",
    operation_id = "revert_changes",
    description = "Revert specific change history entries (Admin+ only)",
    request_body = RevertChangesRequest,
    responses(
        (status = 200, description = "Changes reverted successfully", body = RevertChangesResponse),
        (status = 400, description = "Invalid request (mixed entities or unsupported type)"),
        (status = 403, description = "Admin permission required"),
        (status = 404, description = "Change history entries not found")
    ),
    security(("api_key" = []))
)]
async fn revert_changes(
    State(state): State<AppState>,
    admin: AdminKey,
    ValidatedJson(body): ValidatedJson<RevertChangesRequest>,
) -> Result<Json<RevertChangesResponse>, ApiError> {
    let changes = ChangeHistory::find_by_ids(&state.db, &body.change_ids).await?;

    if changes.is_empty() {
        return Err(
            ApiError::not_found("No change history entries found for the given IDs")
                .with_code(codes::RESOURCE_NOT_FOUND),
        );
    }

    let entity_type = &changes[0].entity_type;
    let entity_id = changes[0].entity_id;

    for ch in &changes {
        if ch.entity_type != *entity_type || ch.entity_id != entity_id {
            return Err(ApiError::validation(
                "All change_ids must belong to the same entity_type and entity_id".to_string(),
            ));
        }
    }

    const SYSTEM_FIELDS: &[&str] = &[
        "id",
        "content_id",
        "site_id",
        "created_at",
        "updated_at",
        "created_by",
        "is_deleted",
        "published_at",
    ];

    let mut revert_fields = serde_json::Map::new();
    let mut field_names = Vec::new();

    for ch in &changes {
        if let Some(ref field_name) = ch.field_name {
            if SYSTEM_FIELDS.contains(&field_name.as_str()) {
                continue;
            }
            let value = ch.old_value.clone().unwrap_or(serde_json::Value::Null);
            revert_fields.insert(field_name.clone(), value);
            field_names.push(field_name.clone());
        }
    }

    if field_names.is_empty() {
        return Err(ApiError::validation(
            "No revertable fields found in the selected changes".to_string(),
        ));
    }

    let revert_json = serde_json::Value::Object(revert_fields);
    let site_id = changes[0].site_id;
    let user_id = Some(admin.0.id);

    macro_rules! apply_revert {
        ($Model:ty, $UpdateReq:ty) => {{
            let old = <$Model>::find_by_id(&state.db, entity_id).await?;
            let old_json = serde_json::to_value(&old)?;
            let update_req: $UpdateReq = serde_json::from_value(revert_json)?;
            let updated = <$Model>::update(&state.db, entity_id, update_req).await?;
            let new_json = serde_json::to_value(&updated)?;
            (old_json, new_json)
        }};
    }

    // Spine repos take a `&mut PgConnection` so the spine + entity rows update
    // atomically (#863); open a one-shot tx around the revert update.
    macro_rules! apply_revert_tx {
        ($Model:ty, $UpdateReq:ty) => {{
            let old = <$Model>::find_by_id(&state.db, entity_id).await?;
            let old_json = serde_json::to_value(&old)?;
            let update_req: $UpdateReq = serde_json::from_value(revert_json)?;
            let mut tx = state.db.begin().await?;
            let updated = <$Model>::update(&mut tx, entity_id, update_req).await?;
            tx.commit().await?;
            let new_json = serde_json::to_value(&updated)?;
            (old_json, new_json)
        }};
    }

    let (old_json, new_json, entity_type_static): (_, _, &'static str) = match entity_type.as_str()
    {
        "blog" => {
            let (o, n) = apply_revert_tx!(BlogRepo, UpdateBlogRequest);
            (o, n, "blog")
        }
        "page" => {
            let (o, n) = apply_revert_tx!(PageRepo, UpdatePageRequest);
            (o, n, "page")
        }
        "site" => {
            let (o, n) = apply_revert!(Site, UpdateSiteRequest);
            (o, n, "site")
        }
        "legal_document" => {
            let (o, n) = apply_revert_tx!(LegalDocumentRepo, UpdateLegalDocumentRequest);
            (o, n, "legal_document")
        }
        "social_link" => {
            let (o, n) = apply_revert!(SocialLink, UpdateSocialLinkRequest);
            (o, n, "social_link")
        }
        _ => {
            return Err(ApiError::validation(format!(
                "Revert not supported for entity type '{entity_type}'"
            )));
        }
    };

    AuditedEntity::audit_only(entity_type_static)
        .mutate(AuditAction::Restore, entity_id)
        .maybe_site(site_id)
        .maybe_actor(user_id)
        .metadata(serde_json::json!({ "reverted_fields": field_names }))
        .execute(&state.db)
        .await;
    audit_service::log_changes(
        &state.db,
        site_id,
        entity_type,
        entity_id,
        user_id,
        &old_json,
        &new_json,
    )
    .await;

    Ok(Json(RevertChangesResponse {
        entity_type: entity_type.clone(),
        entity_id,
        fields_reverted: field_names,
    }))
}

#[utoipa::path(
    get,
    path = "/audit/user/{clerk_user_id}",
    tag = "Audit",
    operation_id = "get_user_audit_logs",
    description = "List audit log entries for a specific user. Requires Admin auth.",
    params(
        ("clerk_user_id" = String, Path, description = "Clerk user ID"),
        ("page" = Option<i64>, Query, description = "Page number"),
        ("page_size" = Option<i64>, Query, description = "Items per page")
    ),
    responses(
        (status = 200, description = "User audit logs", body = PaginatedAuditLogs),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden")
    ),
    security(("bearer_auth" = []))
)]
async fn get_user_audit_logs(
    State(state): State<AppState>,
    Path(clerk_user_id): Path<String>,
    Query(q): Query<UserAuditQuery>,
    _auth: AdminKey,
) -> Result<Json<PaginatedAuditLogs>, ApiError> {
    use crate::guards::auth_guard::CLERK_UUID_NAMESPACE;
    use crate::utils::pagination::PaginationParams;

    let user_uuid = Uuid::new_v5(&CLERK_UUID_NAMESPACE, clerk_user_id.as_bytes());
    let params = PaginationParams::new(q.page, q.page_size);
    let (limit, offset) = params.limit_offset();

    let logs = AuditLog::find_for_user(&state.db, user_uuid, limit, offset).await?;
    let total = AuditLog::count_for_user(&state.db, user_uuid)
        .await
        .unwrap_or(0);

    let items: Vec<AuditLogResponse> = logs.into_iter().map(AuditLogResponse::from).collect();
    let paginated = params.paginate(items, total);

    Ok(Json(paginated))
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_audit_logs))
        .routes(routes!(ai_usage_count))
        .routes(routes!(get_entity_audit_logs))
        .routes(routes!(get_entity_history))
        .routes(routes!(revert_changes))
        .routes(routes!(get_user_audit_logs))
}
