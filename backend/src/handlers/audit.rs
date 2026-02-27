//! Audit log handlers

use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;

use crate::dto::audit::{
    AuditLogResponse, ChangeHistoryResponse, PaginatedAuditLogs, RevertChangesRequest,
    RevertChangesResponse,
};
use crate::dto::blog::UpdateBlogRequest;
use crate::dto::legal::UpdateLegalDocumentRequest;
use crate::dto::page::UpdatePageRequest;
use crate::dto::site::UpdateSiteRequest;
use crate::dto::social::UpdateSocialLinkRequest;
use crate::errors::ApiError;
use crate::guards::auth_guard::AdminKey;
use crate::models::audit::{AuditAction, AuditLog, ChangeHistory};
use crate::models::blog::Blog;
use crate::models::legal::LegalDocument;
use crate::models::page::Page;
use crate::models::site::Site;
use crate::models::social::SocialLink;
use crate::services::audit_service;
use crate::utils::pagination::PaginationParams;
use crate::AppState;

/// List audit logs for a site (paginated)
#[utoipa::path(
    tag = "Audit",
    operation_id = "list_audit_logs",
    description = "List audit logs for a site (paginated)",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default 1)"),
        ("per_page" = Option<i64>, Query, description = "Items per page (default 10, max 100)")
    ),
    responses(
        (status = 200, description = "Paginated audit logs", body = PaginatedAuditLogs)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/audit?<page>&<per_page>")]
pub async fn list_audit_logs(
    state: &State<AppState>,
    site_id: Uuid,
    page: Option<i64>,
    per_page: Option<i64>,
) -> Result<Json<PaginatedAuditLogs>, ApiError> {
    let params = PaginationParams::new(page, per_page);
    let (limit, offset) = params.limit_offset();

    let logs = AuditLog::find_for_site(&state.db, site_id, limit, offset).await?;
    let total = AuditLog::count_for_site(&state.db, site_id).await?;

    let items: Vec<AuditLogResponse> = logs.into_iter().map(AuditLogResponse::from).collect();
    let paginated = params.paginate(items, total);

    Ok(Json(paginated))
}

/// Get audit logs for an entity
#[utoipa::path(
    tag = "Audit",
    operation_id = "get_entity_audit_logs",
    description = "Get audit logs for a specific entity",
    params(
        ("entity_type" = String, Path, description = "Entity type (e.g., 'blog', 'page')"),
        ("entity_id" = Uuid, Path, description = "Entity UUID")
    ),
    responses(
        (status = 200, description = "Entity audit logs", body = Vec<AuditLogResponse>)
    ),
    security(("api_key" = []))
)]
#[get("/audit/entity/<entity_type>/<entity_id>")]
pub async fn get_entity_audit_logs(
    state: &State<AppState>,
    entity_type: &str,
    entity_id: Uuid,
) -> Result<Json<Vec<AuditLogResponse>>, ApiError> {
    let logs = AuditLog::find_for_entity(&state.db, entity_type, entity_id).await?;
    let responses: Vec<AuditLogResponse> = logs.into_iter().map(AuditLogResponse::from).collect();
    Ok(Json(responses))
}

/// Get change history for an entity
#[utoipa::path(
    tag = "Audit",
    operation_id = "get_entity_history",
    description = "Get change history for a specific entity",
    params(
        ("entity_type" = String, Path, description = "Entity type (e.g., 'blog', 'page')"),
        ("entity_id" = Uuid, Path, description = "Entity UUID")
    ),
    responses(
        (status = 200, description = "Entity change history", body = Vec<ChangeHistoryResponse>)
    ),
    security(("api_key" = []))
)]
#[get("/audit/history/<entity_type>/<entity_id>")]
pub async fn get_entity_history(
    state: &State<AppState>,
    entity_type: &str,
    entity_id: Uuid,
) -> Result<Json<Vec<ChangeHistoryResponse>>, ApiError> {
    let history = ChangeHistory::find_for_entity(&state.db, entity_type, entity_id).await?;
    let responses: Vec<ChangeHistoryResponse> = history
        .into_iter()
        .map(ChangeHistoryResponse::from)
        .collect();
    Ok(Json(responses))
}

/// Revert specific change history entries by restoring old field values
#[utoipa::path(
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
#[post("/audit/history/revert", data = "<body>")]
pub async fn revert_changes(
    state: &State<AppState>,
    _admin: AdminKey,
    body: Json<RevertChangesRequest>,
) -> Result<Json<RevertChangesResponse>, ApiError> {
    let req = body.into_inner();

    if req.change_ids.is_empty() {
        return Err(ApiError::Validation(
            "change_ids must not be empty".to_string(),
        ));
    }

    // Fetch all requested change history rows
    let changes = ChangeHistory::find_by_ids(&state.db, &req.change_ids).await?;

    if changes.is_empty() {
        return Err(ApiError::NotFound(
            "No change history entries found for the given IDs".to_string(),
        ));
    }

    // Validate all changes belong to the same entity
    let entity_type = &changes[0].entity_type;
    let entity_id = changes[0].entity_id;

    for ch in &changes {
        if ch.entity_type != *entity_type || ch.entity_id != entity_id {
            return Err(ApiError::Validation(
                "All change_ids must belong to the same entity_type and entity_id".to_string(),
            ));
        }
    }

    // System fields that must not be reverted
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

    // Build a JSON object from old_values: { field_name: old_value, ... }
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
        return Err(ApiError::Validation(
            "No revertable fields found in the selected changes".to_string(),
        ));
    }

    let revert_json = serde_json::Value::Object(revert_fields);
    let site_id = changes[0].site_id;
    let user_id = Some(_admin.0.id);

    // Snapshot old state, apply update, snapshot new state for audit
    match entity_type.as_str() {
        "blog" => {
            let old = Blog::find_by_id(&state.db, entity_id).await?;
            let old_json = serde_json::to_value(&old)?;
            let update_req: UpdateBlogRequest = serde_json::from_value(revert_json)?;
            let updated = Blog::update(&state.db, entity_id, update_req).await?;
            let new_json = serde_json::to_value(&updated)?;
            audit_service::log_action(
                &state.db,
                site_id,
                user_id,
                AuditAction::Restore,
                entity_type,
                entity_id,
                Some(serde_json::json!({ "reverted_fields": field_names })),
            )
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
        }
        "page" => {
            let old = Page::find_by_id(&state.db, entity_id).await?;
            let old_json = serde_json::to_value(&old)?;
            let update_req: UpdatePageRequest = serde_json::from_value(revert_json)?;
            let updated = Page::update(&state.db, entity_id, update_req).await?;
            let new_json = serde_json::to_value(&updated)?;
            audit_service::log_action(
                &state.db,
                site_id,
                user_id,
                AuditAction::Restore,
                entity_type,
                entity_id,
                Some(serde_json::json!({ "reverted_fields": field_names })),
            )
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
        }
        "site" => {
            let old = Site::find_by_id(&state.db, entity_id).await?;
            let old_json = serde_json::to_value(&old)?;
            let update_req: UpdateSiteRequest = serde_json::from_value(revert_json)?;
            let updated = Site::update(&state.db, entity_id, update_req).await?;
            let new_json = serde_json::to_value(&updated)?;
            audit_service::log_action(
                &state.db,
                site_id,
                user_id,
                AuditAction::Restore,
                entity_type,
                entity_id,
                Some(serde_json::json!({ "reverted_fields": field_names })),
            )
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
        }
        "legal_document" => {
            let old = LegalDocument::find_by_id(&state.db, entity_id).await?;
            let old_json = serde_json::to_value(&old)?;
            let update_req: UpdateLegalDocumentRequest = serde_json::from_value(revert_json)?;
            let updated = LegalDocument::update(&state.db, entity_id, update_req).await?;
            let new_json = serde_json::to_value(&updated)?;
            audit_service::log_action(
                &state.db,
                site_id,
                user_id,
                AuditAction::Restore,
                entity_type,
                entity_id,
                Some(serde_json::json!({ "reverted_fields": field_names })),
            )
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
        }
        "social_link" => {
            let old = SocialLink::find_by_id(&state.db, entity_id).await?;
            let old_json = serde_json::to_value(&old)?;
            let update_req: UpdateSocialLinkRequest = serde_json::from_value(revert_json)?;
            let updated = SocialLink::update(&state.db, entity_id, update_req).await?;
            let new_json = serde_json::to_value(&updated)?;
            audit_service::log_action(
                &state.db,
                site_id,
                user_id,
                AuditAction::Restore,
                entity_type,
                entity_id,
                Some(serde_json::json!({ "reverted_fields": field_names })),
            )
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
        }
        _ => {
            return Err(ApiError::Validation(format!(
                "Revert not supported for entity type '{entity_type}'"
            )));
        }
    }

    Ok(Json(RevertChangesResponse {
        entity_type: entity_type.clone(),
        entity_id,
        fields_reverted: field_names,
    }))
}

/// Collect audit routes
pub fn routes() -> Vec<Route> {
    routes![
        list_audit_logs,
        get_entity_audit_logs,
        get_entity_history,
        revert_changes
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 4, "Should have 4 audit routes");
    }
}
