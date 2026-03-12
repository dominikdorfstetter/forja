//! Legal/Consent handlers

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;
use validator::Validate;

use crate::dto::legal::{
    CreateLegalDocumentRequest, CreateLegalGroupRequest, CreateLegalItemRequest,
    LegalDocLocalizationResponse, LegalDocumentDetailResponse, LegalDocumentResponse,
    LegalDocumentWithGroups, LegalGroupResponse, LegalGroupWithItems, LegalItemResponse,
    PaginatedLegalDocuments, UpdateLegalDocumentRequest, UpdateLegalGroupRequest,
    UpdateLegalItemRequest,
};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::guards::module_guard::{LegalModule, ModuleGuard};
use crate::models::audit::AuditAction;
use crate::models::legal::{
    LegalDocType, LegalDocument, LegalDocumentLocalization, LegalGroup, LegalItem,
};
use crate::models::site_membership::SiteRole;
use crate::services::audit_service;
use crate::utils::list_params::ListParams;
use crate::AppState;

/// List all legal documents for a site
#[utoipa::path(
    tag = "Legal",
    operation_id = "list_legal_documents",
    description = "List all legal documents for a site",
    params(
        ("site_id" = Uuid, Path, description = "The UUID of the site"),
        ("page" = Option<i64>, Query, description = "Page number, 1-indexed (default: 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page, 1–100 (default: 10)"),
        ("search" = Option<String>, Query, description = "Search by cookie name (case-insensitive partial match)"),
        ("sort_by" = Option<String>, Query, description = "Sort field: created_at, updated_at, document_type (default: created_at)"),
        ("sort_dir" = Option<String>, Query, description = "Sort direction: asc or desc (default: asc)")
    ),
    responses(
        (status = 200, description = "List of legal documents", body = PaginatedLegalDocuments),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/legal?<page>&<page_size>&<search>&<sort_by>&<sort_dir>")]
#[allow(clippy::too_many_arguments)]
pub async fn list_legal_documents(
    state: &State<AppState>,
    site_id: Uuid,
    page: Option<i64>,
    page_size: Option<i64>,
    search: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
    auth: ReadKey,
    _module: ModuleGuard<LegalModule>,
) -> Result<Json<PaginatedLegalDocuments>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let params = ListParams::new(page, page_size, search, sort_by, sort_dir);
    let documents = LegalDocument::find_all_for_site_filtered(&state.db, site_id, &params).await?;
    let total =
        LegalDocument::count_for_site_filtered(&state.db, site_id, params.search_ref()).await?;
    let items: Vec<LegalDocumentResponse> = documents
        .into_iter()
        .map(LegalDocumentResponse::from)
        .collect();
    Ok(Json(params.paginate(items, total)))
}

/// Get legal document by ID
#[utoipa::path(
    tag = "Legal",
    operation_id = "get_legal_document",
    description = "Get a legal document by ID",
    params(("id" = Uuid, Path, description = "The UUID of the legal document")),
    responses(
        (status = 200, description = "Legal document details", body = LegalDocumentResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 404, description = "Legal document not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/legal/<id>")]
pub async fn get_legal_document(
    state: &State<AppState>,
    id: Uuid,
    _auth: ReadKey,
) -> Result<Json<LegalDocumentResponse>, ApiError> {
    let document = LegalDocument::find_by_id(&state.db, id).await?;
    Ok(Json(LegalDocumentResponse::from(document)))
}

/// Get cookie consent document with full structure
#[utoipa::path(
    tag = "Legal",
    operation_id = "get_cookie_consent",
    description = "Get cookie consent document with full structure (groups and items)",
    params(("site_id" = Uuid, Path, description = "The UUID of the site")),
    responses(
        (status = 200, description = "Cookie consent structure", body = LegalDocumentWithGroups),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails),
        (status = 404, description = "Cookie consent document not found for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/legal/cookie-consent", rank = 1)]
pub async fn get_cookie_consent(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
    _module: ModuleGuard<LegalModule>,
) -> Result<Json<LegalDocumentWithGroups>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let document =
        LegalDocument::find_by_type_for_site(&state.db, site_id, LegalDocType::CookieConsent)
            .await?;
    let groups = LegalGroup::find_for_document(&state.db, document.id).await?;

    let mut groups_with_items = Vec::new();
    for group in groups {
        let items = LegalItem::find_for_group(&state.db, group.id).await?;
        groups_with_items.push(LegalGroupWithItems {
            id: group.id,
            cookie_name: group.cookie_name,
            display_order: group.display_order,
            is_required: group.is_required,
            default_enabled: group.default_enabled,
            items: items.into_iter().map(LegalItemResponse::from).collect(),
        });
    }

    Ok(Json(LegalDocumentWithGroups {
        id: document.id,
        cookie_name: document.cookie_name,
        document_type: document.document_type,
        groups: groups_with_items,
    }))
}

/// Get groups for a legal document
#[utoipa::path(
    tag = "Legal",
    operation_id = "get_legal_groups",
    description = "Get groups for a legal document",
    params(("document_id" = Uuid, Path, description = "The UUID of the legal document")),
    responses(
        (status = 200, description = "Legal groups", body = Vec<LegalGroupResponse>),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 404, description = "Legal document not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/legal/<document_id>/groups", rank = 1)]
pub async fn get_legal_groups(
    state: &State<AppState>,
    document_id: Uuid,
    _auth: ReadKey,
) -> Result<Json<Vec<LegalGroupResponse>>, ApiError> {
    let groups = LegalGroup::find_for_document(&state.db, document_id).await?;
    let responses: Vec<LegalGroupResponse> =
        groups.into_iter().map(LegalGroupResponse::from).collect();
    Ok(Json(responses))
}

/// Get items for a legal group
#[utoipa::path(
    tag = "Legal",
    operation_id = "get_legal_items",
    description = "Get items for a legal group",
    params(("group_id" = Uuid, Path, description = "The UUID of the legal group")),
    responses(
        (status = 200, description = "Legal items", body = Vec<LegalItemResponse>),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 404, description = "Legal group not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/legal/groups/<group_id>/items")]
pub async fn get_legal_items(
    state: &State<AppState>,
    group_id: Uuid,
    _auth: ReadKey,
) -> Result<Json<Vec<LegalItemResponse>>, ApiError> {
    let items = LegalItem::find_for_group(&state.db, group_id).await?;
    let responses: Vec<LegalItemResponse> =
        items.into_iter().map(LegalItemResponse::from).collect();
    Ok(Json(responses))
}

/// Create a legal document
#[utoipa::path(
    tag = "Legal",
    operation_id = "create_legal_document",
    description = "Create a legal document for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = CreateLegalDocumentRequest, description = "Legal document data"),
    responses(
        (status = 201, description = "Document created", body = LegalDocumentResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/sites/<site_id>/legal", data = "<body>")]
pub async fn create_legal_document(
    state: &State<AppState>,
    site_id: Uuid,
    body: Json<CreateLegalDocumentRequest>,
    auth: ReadKey,
    _module: ModuleGuard<LegalModule>,
) -> Result<(Status, Json<LegalDocumentResponse>), ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Author)
        .await?;
    let mut req = body.into_inner();
    // Ensure the site_id from the URL is included
    if !req.site_ids.contains(&site_id) {
        req.site_ids.push(site_id);
    }
    req.validate()
        .map_err(|e| ApiError::bad_request(format!("Validation error: {}", e)))?;

    let document = LegalDocument::create(&state.db, req).await?;
    audit_service::log_action(
        &state.db,
        Some(site_id),
        Some(auth.0.id),
        AuditAction::Create,
        "legal_document",
        document.id,
        None,
    )
    .await;
    Ok((Status::Created, Json(LegalDocumentResponse::from(document))))
}

/// Update a legal document
#[utoipa::path(
    tag = "Legal",
    operation_id = "update_legal_document",
    description = "Update a legal document",
    params(("id" = Uuid, Path, description = "Legal document UUID")),
    request_body(content = UpdateLegalDocumentRequest, description = "Document update data"),
    responses(
        (status = 200, description = "Document updated", body = LegalDocumentResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Document not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[put("/legal/<id>", data = "<body>")]
pub async fn update_legal_document(
    state: &State<AppState>,
    id: Uuid,
    body: Json<UpdateLegalDocumentRequest>,
    auth: ReadKey,
) -> Result<Json<LegalDocumentResponse>, ApiError> {
    let site_id = LegalDocument::resolve_site_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Author)
        .await?;
    ModuleGuard::<LegalModule>::check(&state.db, site_id).await?;
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::bad_request(format!("Validation error: {}", e)))?;

    let document = LegalDocument::update(&state.db, id, req).await?;
    audit_service::log_action(
        &state.db,
        Some(site_id),
        Some(auth.0.id),
        AuditAction::Update,
        "legal_document",
        id,
        None,
    )
    .await;
    Ok(Json(LegalDocumentResponse::from(document)))
}

/// Delete a legal document (soft delete)
#[utoipa::path(
    tag = "Legal",
    operation_id = "delete_legal_document",
    description = "Soft delete a legal document",
    params(("id" = Uuid, Path, description = "Legal document UUID")),
    responses(
        (status = 204, description = "Document deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Document not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/legal/<id>")]
pub async fn delete_legal_document(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    let site_id = LegalDocument::resolve_site_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Editor)
        .await?;
    ModuleGuard::<LegalModule>::check(&state.db, site_id).await?;
    LegalDocument::soft_delete(&state.db, id).await?;
    audit_service::log_action(
        &state.db,
        Some(site_id),
        Some(auth.0.id),
        AuditAction::Delete,
        "legal_document",
        id,
        None,
    )
    .await;
    Ok(Status::NoContent)
}

/// Create a legal group
#[utoipa::path(
    tag = "Legal",
    operation_id = "create_legal_group",
    description = "Create a consent group for a legal document",
    params(("doc_id" = Uuid, Path, description = "Legal document UUID")),
    request_body(content = CreateLegalGroupRequest, description = "Group data"),
    responses(
        (status = 201, description = "Group created", body = LegalGroupResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/legal/<doc_id>/groups", data = "<body>")]
pub async fn create_legal_group(
    state: &State<AppState>,
    doc_id: Uuid,
    body: Json<CreateLegalGroupRequest>,
    auth: ReadKey,
) -> Result<(Status, Json<LegalGroupResponse>), ApiError> {
    let site_id = LegalDocument::resolve_site_id(&state.db, doc_id).await?;
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Author)
        .await?;
    ModuleGuard::<LegalModule>::check(&state.db, site_id).await?;
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::bad_request(format!("Validation error: {}", e)))?;

    let group = LegalGroup::create(&state.db, doc_id, req).await?;
    audit_service::log_action(
        &state.db,
        Some(site_id),
        Some(auth.0.id),
        AuditAction::Create,
        "legal_group",
        group.id,
        None,
    )
    .await;
    Ok((Status::Created, Json(LegalGroupResponse::from(group))))
}

/// Update a legal group
#[utoipa::path(
    tag = "Legal",
    operation_id = "update_legal_group",
    description = "Update a legal consent group",
    params(("id" = Uuid, Path, description = "Legal group UUID")),
    request_body(content = UpdateLegalGroupRequest, description = "Group update data"),
    responses(
        (status = 200, description = "Group updated", body = LegalGroupResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Group not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[put("/legal/groups/<id>", data = "<body>")]
pub async fn update_legal_group(
    state: &State<AppState>,
    id: Uuid,
    body: Json<UpdateLegalGroupRequest>,
    auth: ReadKey,
) -> Result<Json<LegalGroupResponse>, ApiError> {
    let group = LegalGroup::find_by_id(&state.db, id).await?;
    let site_id = LegalDocument::resolve_site_id(&state.db, group.legal_document_id).await?;
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Author)
        .await?;
    ModuleGuard::<LegalModule>::check(&state.db, site_id).await?;
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::bad_request(format!("Validation error: {}", e)))?;

    let updated = LegalGroup::update(&state.db, id, req).await?;
    audit_service::log_action(
        &state.db,
        Some(site_id),
        Some(auth.0.id),
        AuditAction::Update,
        "legal_group",
        id,
        None,
    )
    .await;
    Ok(Json(LegalGroupResponse::from(updated)))
}

/// Delete a legal group
#[utoipa::path(
    tag = "Legal",
    operation_id = "delete_legal_group",
    description = "Delete a legal consent group",
    params(("id" = Uuid, Path, description = "Legal group UUID")),
    responses(
        (status = 204, description = "Group deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Group not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/legal/groups/<id>")]
pub async fn delete_legal_group(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    let group = LegalGroup::find_by_id(&state.db, id).await?;
    let site_id = LegalDocument::resolve_site_id(&state.db, group.legal_document_id).await?;
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Editor)
        .await?;
    ModuleGuard::<LegalModule>::check(&state.db, site_id).await?;
    LegalGroup::delete(&state.db, id).await?;
    audit_service::log_action(
        &state.db,
        Some(site_id),
        Some(auth.0.id),
        AuditAction::Delete,
        "legal_group",
        id,
        None,
    )
    .await;
    Ok(Status::NoContent)
}

/// Create a legal item
#[utoipa::path(
    tag = "Legal",
    operation_id = "create_legal_item",
    description = "Create a consent item in a group",
    params(("group_id" = Uuid, Path, description = "Legal group UUID")),
    request_body(content = CreateLegalItemRequest, description = "Item data"),
    responses(
        (status = 201, description = "Item created", body = LegalItemResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/legal/groups/<group_id>/items", data = "<body>")]
pub async fn create_legal_item(
    state: &State<AppState>,
    group_id: Uuid,
    body: Json<CreateLegalItemRequest>,
    auth: ReadKey,
) -> Result<(Status, Json<LegalItemResponse>), ApiError> {
    let group = LegalGroup::find_by_id(&state.db, group_id).await?;
    let site_id = LegalDocument::resolve_site_id(&state.db, group.legal_document_id).await?;
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Author)
        .await?;
    ModuleGuard::<LegalModule>::check(&state.db, site_id).await?;
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::bad_request(format!("Validation error: {}", e)))?;

    let item = LegalItem::create(&state.db, group_id, req).await?;
    audit_service::log_action(
        &state.db,
        Some(site_id),
        Some(auth.0.id),
        AuditAction::Create,
        "legal_item",
        item.id,
        None,
    )
    .await;
    Ok((Status::Created, Json(LegalItemResponse::from(item))))
}

/// Update a legal item
#[utoipa::path(
    tag = "Legal",
    operation_id = "update_legal_item",
    description = "Update a legal consent item",
    params(("id" = Uuid, Path, description = "Legal item UUID")),
    request_body(content = UpdateLegalItemRequest, description = "Item update data"),
    responses(
        (status = 200, description = "Item updated", body = LegalItemResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Item not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[put("/legal/items/<id>", data = "<body>")]
pub async fn update_legal_item(
    state: &State<AppState>,
    id: Uuid,
    body: Json<UpdateLegalItemRequest>,
    auth: ReadKey,
) -> Result<Json<LegalItemResponse>, ApiError> {
    let item = LegalItem::find_by_id(&state.db, id).await?;
    let group = LegalGroup::find_by_id(&state.db, item.legal_group_id).await?;
    let site_id = LegalDocument::resolve_site_id(&state.db, group.legal_document_id).await?;
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Author)
        .await?;
    ModuleGuard::<LegalModule>::check(&state.db, site_id).await?;
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::bad_request(format!("Validation error: {}", e)))?;

    let updated = LegalItem::update(&state.db, id, req).await?;
    audit_service::log_action(
        &state.db,
        Some(site_id),
        Some(auth.0.id),
        AuditAction::Update,
        "legal_item",
        id,
        None,
    )
    .await;
    Ok(Json(LegalItemResponse::from(updated)))
}

/// Delete a legal item
#[utoipa::path(
    tag = "Legal",
    operation_id = "delete_legal_item",
    description = "Delete a legal consent item",
    params(("id" = Uuid, Path, description = "Legal item UUID")),
    responses(
        (status = 204, description = "Item deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Item not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/legal/items/<id>")]
pub async fn delete_legal_item(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    let item = LegalItem::find_by_id(&state.db, id).await?;
    let group = LegalGroup::find_by_id(&state.db, item.legal_group_id).await?;
    let site_id = LegalDocument::resolve_site_id(&state.db, group.legal_document_id).await?;
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Editor)
        .await?;
    ModuleGuard::<LegalModule>::check(&state.db, site_id).await?;
    LegalItem::delete(&state.db, id).await?;
    audit_service::log_action(
        &state.db,
        Some(site_id),
        Some(auth.0.id),
        AuditAction::Delete,
        "legal_item",
        id,
        None,
    )
    .await;
    Ok(Status::NoContent)
}

/// Collect legal routes
/// Get legal document by content slug for a site (with localizations)
#[utoipa::path(
    tag = "Legal",
    operation_id = "get_legal_document_by_slug",
    description = "Get a legal document by content slug with localizations",
    params(
        ("site_id" = Uuid, Path, description = "The UUID of the site"),
        ("slug" = String, Path, description = "URL-friendly identifier (lowercase, hyphens only)")
    ),
    responses(
        (status = 200, description = "Legal document with localizations", body = LegalDocumentDetailResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails),
        (status = 404, description = "Legal document not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/legal/by-slug/<slug>", rank = 2)]
pub async fn get_legal_document_by_slug(
    state: &State<AppState>,
    site_id: Uuid,
    slug: &str,
    auth: ReadKey,
    _module: ModuleGuard<LegalModule>,
) -> Result<Json<LegalDocumentDetailResponse>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let document = LegalDocument::find_by_slug_for_site(&state.db, site_id, slug).await?;
    let localizations =
        LegalDocumentLocalization::find_for_document(&state.db, document.id).await?;

    Ok(Json(LegalDocumentDetailResponse {
        id: document.id,
        cookie_name: document.cookie_name,
        document_type: document.document_type,
        localizations: localizations
            .into_iter()
            .map(|l| LegalDocLocalizationResponse {
                id: l.id,
                locale_id: l.locale_id,
                title: l.title,
                intro: l.intro,
            })
            .collect(),
        created_at: document.created_at,
        updated_at: document.updated_at,
    }))
}

pub fn routes() -> Vec<Route> {
    routes![
        list_legal_documents,
        get_cookie_consent,
        get_legal_document_by_slug,
        get_legal_groups,
        get_legal_items,
        get_legal_document,
        create_legal_document,
        update_legal_document,
        delete_legal_document,
        create_legal_group,
        update_legal_group,
        delete_legal_group,
        create_legal_item,
        update_legal_item,
        delete_legal_item
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 15, "Should have 15 legal routes");
    }
}
