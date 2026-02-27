//! Document handlers

use base64::Engine;
use rocket::http::{ContentType, Header, Status};
use rocket::response::{self, Responder, Response};
use rocket::serde::json::Json;
use rocket::{Request, Route, State};
use std::io::Cursor;
use uuid::Uuid;
use validator::Validate;

use crate::dto::document::{
    AssignBlogDocumentRequest, BlogDocumentResponse, CreateDocumentFolderRequest,
    CreateDocumentLocalizationRequest, CreateDocumentRequest, DocumentFolderResponse,
    DocumentListItem, DocumentLocalizationResponse, DocumentResponse, PaginatedDocuments,
    UpdateDocumentFolderRequest, UpdateDocumentLocalizationRequest, UpdateDocumentRequest,
};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::models::audit::AuditAction;
use crate::models::document::{BlogDocument, Document, DocumentFolder, DocumentLocalization};
use crate::models::site_membership::SiteRole;
use crate::services::{audit_service, webhook_service};
use crate::utils::pagination::PaginationParams;
use crate::AppState;

/// Response struct for file downloads
pub struct FileDownloadResponse {
    pub data: Vec<u8>,
    pub file_name: String,
    pub mime_type: String,
}

impl<'r> Responder<'r, 'static> for FileDownloadResponse {
    fn respond_to(self, _req: &'r Request<'_>) -> response::Result<'static> {
        let content_type =
            ContentType::parse_flexible(&self.mime_type).unwrap_or(ContentType::Binary);
        let disposition = format!("attachment; filename=\"{}\"", self.file_name);

        Response::build()
            .status(Status::Ok)
            .header(content_type)
            .header(Header::new("Content-Disposition", disposition))
            .sized_body(self.data.len(), Cursor::new(self.data))
            .ok()
    }
}

// ============================================
// FOLDER ENDPOINTS
// ============================================

/// List document folders for a site
#[utoipa::path(
    tag = "Documents",
    operation_id = "list_document_folders",
    description = "List all document folders for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "List of document folders", body = Vec<DocumentFolderResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/document-folders")]
pub async fn list_document_folders(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
) -> Result<Json<Vec<DocumentFolderResponse>>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let folders = DocumentFolder::find_all_for_site(&state.db, site_id).await?;
    let responses: Vec<DocumentFolderResponse> = folders
        .into_iter()
        .map(DocumentFolderResponse::from)
        .collect();
    Ok(Json(responses))
}

/// Create a document folder
#[utoipa::path(
    tag = "Documents",
    operation_id = "create_document_folder",
    description = "Create a document folder",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = CreateDocumentFolderRequest, description = "Folder data"),
    responses(
        (status = 201, description = "Folder created", body = DocumentFolderResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/sites/<site_id>/document-folders", data = "<body>")]
pub async fn create_document_folder(
    state: &State<AppState>,
    site_id: Uuid,
    body: Json<CreateDocumentFolderRequest>,
    auth: ReadKey,
) -> Result<(Status, Json<DocumentFolderResponse>), ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Author)
        .await?;
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let folder = DocumentFolder::create(&state.db, site_id, req).await?;
    audit_service::log_action(
        &state.db,
        Some(site_id),
        Some(auth.0.id),
        AuditAction::Create,
        "document_folder",
        folder.id,
        None,
    )
    .await;
    Ok((Status::Created, Json(DocumentFolderResponse::from(folder))))
}

/// Update a document folder
#[utoipa::path(
    tag = "Documents",
    operation_id = "update_document_folder",
    description = "Update a document folder",
    params(("id" = Uuid, Path, description = "Folder UUID")),
    request_body(content = UpdateDocumentFolderRequest, description = "Folder update data"),
    responses(
        (status = 200, description = "Folder updated", body = DocumentFolderResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[put("/document-folders/<id>", data = "<body>")]
pub async fn update_document_folder(
    state: &State<AppState>,
    id: Uuid,
    body: Json<UpdateDocumentFolderRequest>,
    auth: ReadKey,
) -> Result<Json<DocumentFolderResponse>, ApiError> {
    let existing = DocumentFolder::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, existing.site_id, &SiteRole::Author)
        .await?;

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let folder = DocumentFolder::update(&state.db, id, req).await?;
    audit_service::log_action(
        &state.db,
        Some(existing.site_id),
        Some(auth.0.id),
        AuditAction::Update,
        "document_folder",
        id,
        None,
    )
    .await;
    Ok(Json(DocumentFolderResponse::from(folder)))
}

/// Delete a document folder
#[utoipa::path(
    tag = "Documents",
    operation_id = "delete_document_folder",
    description = "Delete a document folder",
    params(("id" = Uuid, Path, description = "Folder UUID")),
    responses(
        (status = 204, description = "Folder deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/document-folders/<id>")]
pub async fn delete_document_folder(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    let existing = DocumentFolder::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, existing.site_id, &SiteRole::Editor)
        .await?;

    DocumentFolder::delete(&state.db, id).await?;
    audit_service::log_action(
        &state.db,
        Some(existing.site_id),
        Some(auth.0.id),
        AuditAction::Delete,
        "document_folder",
        id,
        None,
    )
    .await;
    Ok(Status::NoContent)
}

// ============================================
// DOCUMENT ENDPOINTS
// ============================================

/// List documents for a site
#[utoipa::path(
    tag = "Documents",
    operation_id = "list_documents",
    description = "List documents for a site, optionally filtered by folder",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("folder_id" = Option<Uuid>, Query, description = "Filter by folder ID"),
        ("page" = Option<i64>, Query, description = "Page number (default 1)"),
        ("per_page" = Option<i64>, Query, description = "Items per page (default 10, max 100)")
    ),
    responses(
        (status = 200, description = "List of documents", body = PaginatedDocuments),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/documents?<folder_id>&<page>&<per_page>")]
pub async fn list_documents(
    state: &State<AppState>,
    site_id: Uuid,
    folder_id: Option<Uuid>,
    page: Option<i64>,
    per_page: Option<i64>,
    auth: ReadKey,
) -> Result<Json<PaginatedDocuments>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let params = PaginationParams::new(page, per_page);
    let (limit, offset) = params.limit_offset();
    let docs = Document::find_all_for_site(&state.db, site_id, folder_id, limit, offset).await?;
    let total = Document::count_for_site(&state.db, site_id, folder_id).await?;
    let items: Vec<DocumentListItem> = docs.into_iter().map(DocumentListItem::from).collect();
    Ok(Json(params.paginate(items, total)))
}

/// Create a document
#[utoipa::path(
    tag = "Documents",
    operation_id = "create_document",
    description = "Create a document in the site library",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = CreateDocumentRequest, description = "Document data"),
    responses(
        (status = 201, description = "Document created", body = DocumentListItem),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/sites/<site_id>/documents", data = "<body>")]
pub async fn create_document(
    state: &State<AppState>,
    site_id: Uuid,
    body: Json<CreateDocumentRequest>,
    auth: ReadKey,
) -> Result<(Status, Json<DocumentListItem>), ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Author)
        .await?;
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let max_file_size = Document::get_max_file_size(&state.db, site_id).await?;
    req.validate_source(max_file_size)
        .map_err(ApiError::BadRequest)?;

    // Decode base64 file data if present
    let file_data = if let Some(ref b64) = req.file_data {
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(b64)
            .map_err(|e| ApiError::BadRequest(format!("Invalid base64 file_data: {}", e)))?;
        Some(decoded)
    } else {
        None
    };

    let doc = Document::create(&state.db, site_id, &req, file_data).await?;
    audit_service::log_action(
        &state.db,
        Some(site_id),
        Some(auth.0.id),
        AuditAction::Create,
        "document",
        doc.id,
        None,
    )
    .await;
    webhook_service::dispatch(
        state.db.clone(),
        site_id,
        "document.created",
        doc.id,
        serde_json::to_value(DocumentListItem::from(doc.clone())).unwrap_or_default(),
    );
    Ok((Status::Created, Json(DocumentListItem::from(doc))))
}

/// Get document with localizations
#[utoipa::path(
    tag = "Documents",
    operation_id = "get_document",
    description = "Get a document with its localizations",
    params(("id" = Uuid, Path, description = "Document UUID")),
    responses(
        (status = 200, description = "Document details", body = DocumentResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/documents/<id>")]
pub async fn get_document(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Json<DocumentResponse>, ApiError> {
    let doc = Document::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, doc.site_id, &SiteRole::Viewer)
        .await?;
    let locs = DocumentLocalization::find_all_for_document(&state.db, id).await?;
    Ok(Json(DocumentResponse::from_parts(doc, locs)))
}

/// Update a document
#[utoipa::path(
    tag = "Documents",
    operation_id = "update_document",
    description = "Update a document",
    params(("id" = Uuid, Path, description = "Document UUID")),
    request_body(content = UpdateDocumentRequest, description = "Document update data"),
    responses(
        (status = 200, description = "Document updated", body = DocumentListItem),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[put("/documents/<id>", data = "<body>")]
pub async fn update_document(
    state: &State<AppState>,
    id: Uuid,
    body: Json<UpdateDocumentRequest>,
    auth: ReadKey,
) -> Result<Json<DocumentListItem>, ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    // Look up the document to get its site_id for the configurable max file size
    let existing = Document::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, existing.site_id, &SiteRole::Author)
        .await?;
    let old = serde_json::to_value(&existing).ok();
    let max_file_size = Document::get_max_file_size(&state.db, existing.site_id).await?;
    req.validate_source(max_file_size)
        .map_err(ApiError::BadRequest)?;

    // Decode base64 file data if present
    let file_data = if let Some(ref b64) = req.file_data {
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(b64)
            .map_err(|e| ApiError::BadRequest(format!("Invalid base64 file_data: {}", e)))?;
        Some(decoded)
    } else {
        None
    };

    // Determine if we need to clear file data (switching from file to URL)
    let clear_file = req.url.is_some() && req.file_data.is_none();

    let doc = Document::update(&state.db, id, &req, file_data, clear_file).await?;
    audit_service::log_action(
        &state.db,
        Some(existing.site_id),
        Some(auth.0.id),
        AuditAction::Update,
        "document",
        id,
        None,
    )
    .await;
    if let (Some(old), Ok(new)) = (old, serde_json::to_value(&doc)) {
        audit_service::log_changes(
            &state.db,
            Some(existing.site_id),
            "document",
            id,
            Some(auth.0.id),
            &old,
            &new,
        )
        .await;
    }
    webhook_service::dispatch(
        state.db.clone(),
        existing.site_id,
        "document.updated",
        id,
        serde_json::to_value(DocumentListItem::from(doc.clone())).unwrap_or_default(),
    );
    Ok(Json(DocumentListItem::from(doc)))
}

/// Delete a document
#[utoipa::path(
    tag = "Documents",
    operation_id = "delete_document",
    description = "Delete a document",
    params(("id" = Uuid, Path, description = "Document UUID")),
    responses(
        (status = 204, description = "Document deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/documents/<id>")]
pub async fn delete_document(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    let existing = Document::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, existing.site_id, &SiteRole::Editor)
        .await?;

    Document::delete(&state.db, id).await?;
    audit_service::log_action(
        &state.db,
        Some(existing.site_id),
        Some(auth.0.id),
        AuditAction::Delete,
        "document",
        id,
        None,
    )
    .await;
    webhook_service::dispatch(
        state.db.clone(),
        existing.site_id,
        "document.deleted",
        id,
        serde_json::json!({"id": id}),
    );
    Ok(Status::NoContent)
}

/// Download a document's uploaded file (public, no auth required)
#[utoipa::path(
    tag = "Documents",
    operation_id = "download_document",
    description = "Download the uploaded file for a document (public endpoint)",
    params(("id" = Uuid, Path, description = "Document UUID")),
    responses(
        (status = 200, description = "File download"),
        (status = 404, description = "Not found or no file uploaded", body = ProblemDetails)
    )
)]
#[get("/documents/<id>/download")]
pub async fn download_document(
    state: &State<AppState>,
    id: Uuid,
) -> Result<FileDownloadResponse, ApiError> {
    let (data, file_name, mime_type) = Document::find_file_data(&state.db, id).await?;
    Ok(FileDownloadResponse {
        data,
        file_name,
        mime_type,
    })
}

// ============================================
// LOCALIZATION ENDPOINTS
// ============================================

/// Create a document localization
#[utoipa::path(
    tag = "Documents",
    operation_id = "create_document_localization",
    description = "Create a localization for a document",
    params(("id" = Uuid, Path, description = "Document UUID")),
    request_body(content = CreateDocumentLocalizationRequest, description = "Localization data"),
    responses(
        (status = 201, description = "Localization created", body = DocumentLocalizationResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/documents/<id>/localizations", data = "<body>")]
pub async fn create_document_localization(
    state: &State<AppState>,
    id: Uuid,
    body: Json<CreateDocumentLocalizationRequest>,
    auth: ReadKey,
) -> Result<(Status, Json<DocumentLocalizationResponse>), ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    // Verify document exists and authorize against its site
    let doc = Document::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, doc.site_id, &SiteRole::Author)
        .await?;

    let loc = DocumentLocalization::create(&state.db, id, req).await?;
    Ok((
        Status::Created,
        Json(DocumentLocalizationResponse::from(loc)),
    ))
}

/// Update a document localization
#[utoipa::path(
    tag = "Documents",
    operation_id = "update_document_localization",
    description = "Update a document localization",
    params(("loc_id" = Uuid, Path, description = "Localization UUID")),
    request_body(content = UpdateDocumentLocalizationRequest, description = "Localization update data"),
    responses(
        (status = 200, description = "Localization updated", body = DocumentLocalizationResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[put("/documents/localizations/<loc_id>", data = "<body>")]
pub async fn update_document_localization(
    state: &State<AppState>,
    loc_id: Uuid,
    body: Json<UpdateDocumentLocalizationRequest>,
    _auth: ReadKey,
) -> Result<Json<DocumentLocalizationResponse>, ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let loc = DocumentLocalization::update(&state.db, loc_id, req).await?;
    Ok(Json(DocumentLocalizationResponse::from(loc)))
}

/// Delete a document localization
#[utoipa::path(
    tag = "Documents",
    operation_id = "delete_document_localization",
    description = "Delete a document localization",
    params(("loc_id" = Uuid, Path, description = "Localization UUID")),
    responses(
        (status = 204, description = "Localization deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/documents/localizations/<loc_id>")]
pub async fn delete_document_localization(
    state: &State<AppState>,
    loc_id: Uuid,
    _auth: ReadKey,
) -> Result<Status, ApiError> {
    DocumentLocalization::delete(&state.db, loc_id).await?;
    Ok(Status::NoContent)
}

// ============================================
// BLOG-DOCUMENT ENDPOINTS
// ============================================

/// List documents attached to a blog
#[utoipa::path(
    tag = "Documents",
    operation_id = "list_blog_documents",
    description = "List documents attached to a blog post",
    params(("blog_id" = Uuid, Path, description = "Blog UUID")),
    responses(
        (status = 200, description = "List of attached documents", body = Vec<BlogDocumentResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/blogs/<blog_id>/documents")]
pub async fn list_blog_documents(
    state: &State<AppState>,
    blog_id: Uuid,
    _auth: ReadKey,
) -> Result<Json<Vec<BlogDocumentResponse>>, ApiError> {
    let details = BlogDocument::find_all_for_blog(&state.db, blog_id).await?;
    let mut responses = Vec::new();
    for detail in details {
        let locs =
            DocumentLocalization::find_all_for_document(&state.db, detail.document_id).await?;
        responses.push(BlogDocumentResponse::from_parts(detail, locs));
    }
    Ok(Json(responses))
}

/// Attach a document to a blog
#[utoipa::path(
    tag = "Documents",
    operation_id = "assign_blog_document",
    description = "Attach a document to a blog post",
    params(("blog_id" = Uuid, Path, description = "Blog UUID")),
    request_body(content = AssignBlogDocumentRequest, description = "Document assignment"),
    responses(
        (status = 201, description = "Document attached", body = BlogDocumentResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/blogs/<blog_id>/documents", data = "<body>")]
pub async fn assign_blog_document(
    state: &State<AppState>,
    blog_id: Uuid,
    body: Json<AssignBlogDocumentRequest>,
    _auth: ReadKey,
) -> Result<(Status, Json<BlogDocumentResponse>), ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let bd = BlogDocument::assign(&state.db, blog_id, req.document_id, req.display_order).await?;

    // Fetch full details for response
    let doc = Document::find_by_id(&state.db, req.document_id).await?;
    let locs = DocumentLocalization::find_all_for_document(&state.db, req.document_id).await?;

    let has_file = doc.file_name.is_some();
    let response = BlogDocumentResponse {
        id: bd.id,
        blog_id: bd.blog_id,
        document_id: bd.document_id,
        display_order: bd.display_order,
        url: doc.url,
        document_type: doc.document_type,
        file_name: doc.file_name,
        has_file,
        localizations: locs
            .into_iter()
            .map(DocumentLocalizationResponse::from)
            .collect(),
        created_at: bd.created_at,
    };

    Ok((Status::Created, Json(response)))
}

/// Detach a document from a blog
#[utoipa::path(
    tag = "Documents",
    operation_id = "unassign_blog_document",
    description = "Detach a document from a blog post",
    params(
        ("blog_id" = Uuid, Path, description = "Blog UUID"),
        ("doc_id" = Uuid, Path, description = "Document UUID")
    ),
    responses(
        (status = 204, description = "Document detached"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/blogs/<blog_id>/documents/<doc_id>")]
pub async fn unassign_blog_document(
    state: &State<AppState>,
    blog_id: Uuid,
    doc_id: Uuid,
    _auth: ReadKey,
) -> Result<Status, ApiError> {
    BlogDocument::unassign(&state.db, blog_id, doc_id).await?;
    Ok(Status::NoContent)
}

/// Collect document routes
pub fn routes() -> Vec<Route> {
    routes![
        list_document_folders,
        create_document_folder,
        update_document_folder,
        delete_document_folder,
        list_documents,
        create_document,
        get_document,
        update_document,
        delete_document,
        download_document,
        create_document_localization,
        update_document_localization,
        delete_document_localization,
        list_blog_documents,
        assign_blog_document,
        unassign_blog_document
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 16, "Should have 16 document routes");
    }
}
