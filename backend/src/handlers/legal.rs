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
use crate::models::audit::AuditAction;
use crate::models::legal::{
    LegalDocType, LegalDocument, LegalDocumentLocalization, LegalGroup, LegalItem,
};
use crate::models::site_membership::SiteRole;
use crate::services::audit_service;
use crate::utils::pagination::PaginationParams;
use crate::AppState;

/// List all legal documents for a site
#[utoipa::path(
    tag = "Legal",
    operation_id = "list_legal_documents",
    description = "List all legal documents for a site",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default 1)"),
        ("per_page" = Option<i64>, Query, description = "Items per page (default 10, max 100)")
    ),
    responses(
        (status = 200, description = "List of legal documents", body = PaginatedLegalDocuments),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/legal?<page>&<per_page>")]
pub async fn list_legal_documents(
    state: &State<AppState>,
    site_id: Uuid,
    page: Option<i64>,
    per_page: Option<i64>,
    auth: ReadKey,
) -> Result<Json<PaginatedLegalDocuments>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let params = PaginationParams::new(page, per_page);
    let (limit, offset) = params.limit_offset();
    let documents = LegalDocument::find_all_for_site(&state.db, site_id, limit, offset).await?;
    let total = LegalDocument::count_for_site(&state.db, site_id).await?;
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
    params(("id" = Uuid, Path, description = "Legal document UUID")),
    responses(
        (status = 200, description = "Legal document details", body = LegalDocumentResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Document not found", body = ProblemDetails)
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
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Cookie consent structure", body = LegalDocumentWithGroups),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "No cookie consent document found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/legal/cookie-consent", rank = 1)]
pub async fn get_cookie_consent(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
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
    params(("document_id" = Uuid, Path, description = "Legal document UUID")),
    responses(
        (status = 200, description = "Legal groups", body = Vec<LegalGroupResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
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
    params(("group_id" = Uuid, Path, description = "Legal group UUID")),
    responses(
        (status = 200, description = "Legal items", body = Vec<LegalItemResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
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
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

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
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let document = LegalDocument::update(&state.db, id, req).await?;
    audit_service::log_action(
        &state.db,
        None,
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
    LegalDocument::soft_delete(&state.db, id).await?;
    audit_service::log_action(
        &state.db,
        None,
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
    _auth: ReadKey,
) -> Result<(Status, Json<LegalGroupResponse>), ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let group = LegalGroup::create(&state.db, doc_id, req).await?;
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
    _auth: ReadKey,
) -> Result<Json<LegalGroupResponse>, ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let group = LegalGroup::update(&state.db, id, req).await?;
    Ok(Json(LegalGroupResponse::from(group)))
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
    _auth: ReadKey,
) -> Result<Status, ApiError> {
    LegalGroup::delete(&state.db, id).await?;
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
    _auth: ReadKey,
) -> Result<(Status, Json<LegalItemResponse>), ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let item = LegalItem::create(&state.db, group_id, req).await?;
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
    _auth: ReadKey,
) -> Result<Json<LegalItemResponse>, ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let item = LegalItem::update(&state.db, id, req).await?;
    Ok(Json(LegalItemResponse::from(item)))
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
    _auth: ReadKey,
) -> Result<Status, ApiError> {
    LegalItem::delete(&state.db, id).await?;
    Ok(Status::NoContent)
}

/// Collect legal routes
/// Get legal document by content slug for a site (with localizations)
#[utoipa::path(
    tag = "Legal",
    operation_id = "get_legal_document_by_slug",
    description = "Get a legal document by content slug with localizations",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("slug" = String, Path, description = "Content slug (e.g. 'imprint', 'privacy-policy')")
    ),
    responses(
        (status = 200, description = "Legal document with localizations", body = LegalDocumentDetailResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Document not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/legal/by-slug/<slug>", rank = 2)]
pub async fn get_legal_document_by_slug(
    state: &State<AppState>,
    site_id: Uuid,
    slug: &str,
    auth: ReadKey,
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
