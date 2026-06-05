//! Document handlers: 19 endpoints for document folders, document CRUD
//! (with optional encryption), download with a per-document password gate
//! (HTML page + token-based file delivery), localizations, and
//! blog-document attachments.
//!
//! Private-document access is built on a few helpers
//! (`validate_document_password`, `hmac_secret_for_state`). The server-key
//! recovery, token-DEK decryption, and lazy DEK-rotation decisions live in
//! the `DocumentCrypto` seam (`services::document_crypto`).
//!
//! Custom `IntoResponse` impls for `FileDownloadResponse`,
//! `PasswordPageResponse`, and `DownloadResult` build the file-download,
//! password-page, and unified-download responses. The CSP nonce on the
//! password page is generated inline (single-handler concern, not a
//! middleware concern).

use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::{header, HeaderMap, HeaderValue, Response, StatusCode};
use axum::response::{IntoResponse, Json};
use base64::Engine;
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::axum_app::authorized_content::{
    AuthorizedContent, AuthorizedSite, Create, Delete, Read, Update,
};
use crate::dto::document::{
    AssignBlogDocumentRequest, BlogDocumentResponse, CreateDocumentFolderRequest,
    CreateDocumentLocalizationRequest, CreateDocumentRequest, DocumentFolderResponse,
    DocumentListItem, DocumentLocalizationResponse, DocumentResponse, PaginatedDocuments,
    RemoveDocumentPrivacyRequest, SetDocumentPrivacyRequest, UpdateDocumentFolderRequest,
    UpdateDocumentLocalizationRequest, UpdateDocumentRequest, VerifyDocumentAccessRequest,
    VerifyDocumentAccessResponse,
};
use crate::dto::validated::ValidatedJson;
use crate::errors::{codes, ApiError, ProblemDetails};
use crate::guards::auth_guard::{ReadKey, WriteKey};
use crate::guards::module_guard::{DocumentsModule, ModuleGuard};
use crate::models::audit::AuditAction;
use crate::models::content::Content;
use crate::models::document::Document;
use crate::models::document::{DocumentFolder, DocumentLocalization};
use crate::models::site_settings::SiteSetting;
use crate::repos::blog_repo::BlogRepo;
use crate::repos::document_repo::{
    BlogDocumentRepo, DocumentFolderRepo, DocumentLocalizationRepo, DocumentRepo,
};
use crate::services::audited_mutation::AuditedEntity;
use crate::services::document_crypto::DocumentCrypto;
use crate::services::document_encryption;
use crate::services::password_page_i18n;
use crate::services::permission_service::{Permission, PermissionService};
use crate::services::publish_pipeline::{self, PublishEvent};

async fn validate_document_password(
    pool: &sqlx::PgPool,
    site_id: uuid::Uuid,
    password: &str,
) -> Result<(), ApiError> {
    let settings = SiteSetting::get_effective_settings(pool, site_id).await?;
    let min_length = settings
        .get("document_password_min_length")
        .and_then(|v| v.as_i64())
        .unwrap_or(8) as usize;
    let regex_pattern = settings
        .get("document_password_regex")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if password.len() < min_length {
        return Err(ApiError::bad_request(format!(
            "Password must be at least {} characters",
            min_length
        ))
        .with_code(codes::BAD_REQUEST));
    }

    if !regex_pattern.is_empty() {
        let pattern = if regex_pattern.starts_with('^')
            && regex_pattern.ends_with('$')
            && !regex_pattern.ends_with(".+$")
            && !regex_pattern.ends_with(".*$")
        {
            format!("{}.+$", &regex_pattern[..regex_pattern.len() - 1])
        } else {
            regex_pattern.to_string()
        };
        let re = fancy_regex::Regex::new(&pattern).map_err(|_| {
            ApiError::internal("Invalid password regex pattern in site settings")
                .with_code(codes::INTERNAL_ERROR)
        })?;
        let is_match = re.is_match(password).unwrap_or(false);
        if !is_match {
            return Err(ApiError::bad_request(
                "Password does not meet the site's password policy requirements",
            )
            .with_code(codes::BAD_REQUEST));
        }
    }

    Ok(())
}

fn resolve_hmac_secret(document_key: &str, ai_key: &str) -> Option<Vec<u8>> {
    if !document_key.is_empty() {
        Some(document_key.as_bytes().to_vec())
    } else if !ai_key.is_empty() {
        Some(ai_key.as_bytes().to_vec())
    } else {
        None
    }
}

fn hmac_secret_for_state(state: &AppState) -> Result<Vec<u8>, ApiError> {
    resolve_hmac_secret(
        &state.settings.security.document_encryption_key,
        &state.settings.security.ai_encryption_key,
    )
    .ok_or_else(|| {
        ApiError::internal(
            "Document signing key is not configured. \
             Set DOCUMENT_ENCRYPTION_KEY to enable private-document access tokens.",
        )
        .with_code(codes::INTERNAL_ERROR)
    })
}

/// Persist a lazily-rotated DEK, logging but never bubbling failures — rotation
/// is best-effort and must not fail the request that triggered it.
async fn persist_rotation(state: &AppState, document_id: uuid::Uuid, rewrapped: &[u8]) {
    match DocumentRepo::update_encrypted_dek(&state.db, document_id, rewrapped, 1).await {
        Ok(_) => tracing::info!(document_id = %document_id, "Lazy DEK rotation completed"),
        Err(e) => {
            tracing::warn!(document_id = %document_id, error = %e, "Lazy DEK rotation failed")
        }
    }
}
use crate::utils::csp::generate_nonce;
use crate::utils::list_params::ListParams;
use crate::AppState;

#[derive(Debug, Deserialize)]
struct ListDocumentsQuery {
    folder_id: Option<Uuid>,
    page: Option<i64>,
    page_size: Option<i64>,
    search: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DownloadQuery {
    token: Option<String>,
}

/// Force-attachment file download response. Its `IntoResponse` impl sets
/// `Content-Disposition: attachment` so browsers download rather than render.
pub struct FileDownloadResponse {
    pub data: Vec<u8>,
    pub file_name: String,
    pub mime_type: String,
}

impl IntoResponse for FileDownloadResponse {
    fn into_response(self) -> Response<Body> {
        let content_type = HeaderValue::from_str(&self.mime_type)
            .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream"));
        let disposition = HeaderValue::from_str(&format!(
            "attachment; filename=\"{}\"",
            self.file_name.replace('"', "_")
        ))
        .unwrap_or_else(|_| HeaderValue::from_static("attachment"));

        Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, content_type)
            .header(header::CONTENT_DISPOSITION, disposition)
            .body(Body::from(self.data))
            .expect("static headers + body never fail")
    }
}

/// Banner state to render server-side on the password page when the
/// document is in a non-recoverable state — recipient sees the reason
/// inline instead of having to submit the form first.
#[derive(Debug, Clone, Copy)]
pub enum PasswordPageBanner {
    Expired,
    Locked,
}

/// HTML password-prompt page returned for protected documents without a
/// valid token. Generates its own per-request CSP nonce — the
/// `<script nonce="X">` tag and `Content-Security-Policy` header use
/// the same value. Single-handler concern; no middleware needed.
pub struct PasswordPageResponse {
    pub document_id: Uuid,
    pub document_name: String,
    pub file_size: Option<i64>,
    pub document_type: String,
    /// Raw error string to render inline (legacy path — kept so callers
    /// outside the i18n flow keep working).
    pub error: Option<String>,
    /// Negotiated locale for rendering. `None` falls back to English.
    pub locale: Option<&'static str>,
    /// Server-side banner state (expired/locked) — translated using
    /// the negotiated locale.
    pub banner: Option<PasswordPageBanner>,
}

impl IntoResponse for PasswordPageResponse {
    fn into_response(self) -> Response<Body> {
        let nonce = generate_nonce();
        let locale = password_page_i18n::resolve(self.locale.unwrap_or("en"));
        let t = &locale.translations;

        let banner_html = match self.banner {
            Some(PasswordPageBanner::Expired) => Some(t.expired.clone()),
            Some(PasswordPageBanner::Locked) => Some(t.locked.clone()),
            None => None,
        };
        let error_text = self.error.or(banner_html);
        let error_html = error_text
            .map(|e| format!(r#"<div class="error">{}</div>"#, html_escape(&e)))
            .unwrap_or_default();

        let file_size_html = self
            .file_size
            .map(|s| {
                let display = if s < 1024 {
                    format!("{} B", s)
                } else if s < 1024 * 1024 {
                    format!("{:.1} KB", s as f64 / 1024.0)
                } else {
                    format!("{:.1} MB", s as f64 / (1024.0 * 1024.0))
                };
                format!(
                    r#"<span class="meta-item">{}</span>"#,
                    html_escape(&display)
                )
            })
            .unwrap_or_default();

        let doc_type_html = format!(
            r#"<span class="meta-item type-badge">{}</span>"#,
            html_escape(&self.document_type.to_uppercase())
        );

        let json = |s: &str| serde_json::to_string(s).unwrap_or_else(|_| "\"\"".to_string());

        let html = include_str!("../../../resources/templates/document_password.html")
            .replace("{{LANG}}", locale.code)
            .replace("{{DIR}}", locale.dir)
            .replace("{{T_TITLE}}", &html_escape(&t.title))
            .replace("{{T_HEADING}}", &html_escape(&t.heading))
            .replace("{{T_SUBTITLE}}", &html_escape(&t.subtitle))
            .replace("{{T_BADGE_ENCRYPTED}}", &html_escape(&t.badge_encrypted))
            .replace("{{T_PASSWORD_LABEL}}", &html_escape(&t.password_label))
            .replace(
                "{{T_PASSWORD_PLACEHOLDER}}",
                &html_escape(&t.password_placeholder),
            )
            .replace("{{T_SUBMIT_BUTTON}}", &html_escape(&t.submit_button))
            .replace("{{T_FOOTER}}", &html_escape(&t.footer))
            .replace("{{T_VERIFYING_JSON}}", &json(&t.verifying))
            .replace("{{T_DOWNLOADED_JSON}}", &json(&t.downloaded))
            .replace(
                "{{T_INCORRECT_PASSWORD_JSON}}",
                &json(&t.incorrect_password),
            )
            .replace("{{T_EXPIRED_JSON}}", &json(&t.expired))
            .replace("{{T_LOCKED_JSON}}", &json(&t.locked))
            .replace("{{T_SUBMIT_BUTTON_JSON}}", &json(&t.submit_button))
            .replace("{{NAME}}", &html_escape(&self.document_name))
            .replace("{{DOC_TYPE}}", &doc_type_html)
            .replace("{{FILE_SIZE}}", &file_size_html)
            .replace("{{ERROR}}", &error_html)
            .replace("{{ID}}", &self.document_id.to_string())
            .replace("{{NONCE}}", &nonce);

        let csp = format!(
            "default-src 'none'; \
             style-src 'unsafe-inline' https://fonts.googleapis.com; \
             font-src https://fonts.gstatic.com; \
             script-src 'nonce-{nonce}'; \
             connect-src 'self'; \
             img-src 'self'; \
             frame-ancestors 'none'"
        );

        let csp_header = HeaderValue::from_str(&csp)
            .unwrap_or_else(|_| HeaderValue::from_static("default-src 'none'"));

        Response::builder()
            .status(StatusCode::UNAUTHORIZED)
            .header(header::CONTENT_TYPE, HeaderValue::from_static("text/html"))
            .header(
                header::CACHE_CONTROL,
                HeaderValue::from_static("no-store, private"),
            )
            .header("Content-Security-Policy", csp_header)
            .body(Body::from(html))
            .expect("static headers + body never fail")
    }
}

/// Unified response for the download endpoint: either a file or a password
/// page.
pub enum DownloadResult {
    File(FileDownloadResponse),
    PasswordPage(PasswordPageResponse),
}

impl IntoResponse for DownloadResult {
    fn into_response(self) -> Response<Body> {
        match self {
            DownloadResult::File(file) => file.into_response(),
            DownloadResult::PasswordPage(page) => page.into_response(),
        }
    }
}

/// The outcome of authorizing a document download, decoupled from response
/// rendering. The download handler authorizes → matches → renders, instead of
/// inlining the public / valid-token / password-required branches.
pub enum DownloadAuthorization {
    /// Non-private document — serve the stored bytes as-is.
    Public {
        data: Vec<u8>,
        file_name: String,
        mime_type: String,
    },
    /// Private document with a valid access token — serve decrypted plaintext.
    Private {
        plaintext: Vec<u8>,
        file_name: String,
        mime_type: String,
    },
    /// Private document without a valid token — render the password page.
    PasswordRequired { page: Box<PasswordPageResponse> },
}

/// Decide which banner (if any) the password page shows, given the document's
/// expiry and lockout state. Pure so the precedence (expired before locked) is
/// unit-testable without a request.
fn password_banner(
    expires_at: Option<chrono::DateTime<chrono::Utc>>,
    locked_until: Option<chrono::DateTime<chrono::Utc>>,
    now: chrono::DateTime<chrono::Utc>,
) -> Option<PasswordPageBanner> {
    if expires_at.is_some_and(|exp| exp <= now) {
        Some(PasswordPageBanner::Expired)
    } else if locked_until.is_some() {
        Some(PasswordPageBanner::Locked)
    } else {
        None
    }
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

// ============================================
// FOLDER ENDPOINTS
// ============================================

#[utoipa::path(
    get,
    path = "/sites/{site_id}/document-folders",
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
async fn list_document_folders(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    _access: AuthorizedSite<Document, Read>,
) -> Result<Json<Vec<DocumentFolderResponse>>, ApiError> {
    let folders = DocumentFolderRepo::find_all_for_site(&state.db, site_id).await?;
    let responses: Vec<DocumentFolderResponse> = folders
        .into_iter()
        .map(DocumentFolderResponse::from)
        .collect();
    Ok(Json(responses))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/document-folders",
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
async fn create_document_folder(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    access: AuthorizedSite<Document, Create>,
    ValidatedJson(body): ValidatedJson<CreateDocumentFolderRequest>,
) -> Result<(StatusCode, Json<DocumentFolderResponse>), ApiError> {
    let folder = DocumentFolderRepo::create(&state.db, site_id, body.into_inner()).await?;
    AuditedEntity::audit_only("document_folder")
        .mutate(AuditAction::Create, folder.id)
        .site(site_id)
        .actor(access.actor.id)
        .execute(&state.db)
        .await;
    Ok((
        StatusCode::CREATED,
        Json(DocumentFolderResponse::from(folder)),
    ))
}

#[utoipa::path(
    put,
    path = "/document-folders/{id}",
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
async fn update_document_folder(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContent<DocumentFolder, Update>,
    ValidatedJson(body): ValidatedJson<UpdateDocumentFolderRequest>,
) -> Result<Json<DocumentFolderResponse>, ApiError> {
    let folder = DocumentFolderRepo::update(&state.db, id, body.into_inner()).await?;
    AuditedEntity::audit_only("document_folder")
        .mutate(AuditAction::Update, id)
        .site(access.primary_site_id)
        .actor(access.actor.id)
        .execute(&state.db)
        .await;
    Ok(Json(DocumentFolderResponse::from(folder)))
}

#[utoipa::path(
    delete,
    path = "/document-folders/{id}",
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
async fn delete_document_folder(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContent<DocumentFolder, Delete>,
) -> Result<StatusCode, ApiError> {
    DocumentFolderRepo::delete(&state.db, id).await?;
    AuditedEntity::audit_only("document_folder")
        .mutate(AuditAction::Delete, id)
        .site(access.primary_site_id)
        .actor(access.actor.id)
        .execute(&state.db)
        .await;
    Ok(StatusCode::NO_CONTENT)
}

// ============================================
// DOCUMENT ENDPOINTS
// ============================================

#[utoipa::path(
    get,
    path = "/sites/{site_id}/documents",
    tag = "Documents",
    operation_id = "list_documents",
    description = "List documents for a site, optionally filtered by folder",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("folder_id" = Option<Uuid>, Query, description = "Filter by folder ID"),
        ("page" = Option<i64>, Query, description = "Page number (default: 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page (default: 10)"),
        ("search" = Option<String>, Query, description = "Search by file name (ILIKE)"),
        ("sort_by" = Option<String>, Query, description = "Sort field: created_at (default), file_name"),
        ("sort_dir" = Option<String>, Query, description = "Sort direction: asc, desc (default)")
    ),
    responses(
        (status = 200, description = "List of documents", body = PaginatedDocuments),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_documents(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<ListDocumentsQuery>,
    _access: AuthorizedSite<Document, Read>,
) -> Result<Json<PaginatedDocuments>, ApiError> {
    let params = ListParams::new(q.page, q.page_size, q.search, q.sort_by, q.sort_dir);
    let docs =
        DocumentRepo::find_all_for_site_filtered(&state.db, site_id, q.folder_id, &params).await?;
    let total =
        DocumentRepo::count_for_site_filtered(&state.db, site_id, q.folder_id, params.search_ref())
            .await?;
    let items: Vec<DocumentListItem> = docs.into_iter().map(DocumentListItem::from).collect();
    Ok(Json(params.paginate(items, total)))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/documents",
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
async fn create_document(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
    _access: AuthorizedSite<Document, Create>,
    ValidatedJson(body): ValidatedJson<CreateDocumentRequest>,
) -> Result<(StatusCode, Json<DocumentListItem>), ApiError> {
    if let Some(incoming_bytes) = body.file_size {
        crate::services::storage_quota::StorageQuota::check(&state.db, site_id, incoming_bytes)
            .await?;
    }

    let file_data = if let Some(ref b64) = body.file_data {
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(b64)
            .map_err(|e| {
                ApiError::bad_request(format!("Invalid base64 file_data: {}", e))
                    .with_code(codes::BAD_REQUEST)
            })?;
        Some(decoded)
    } else {
        None
    };

    let doc = DocumentRepo::create(&state.db, site_id, &body, file_data).await?;
    let payload = serde_json::to_value(DocumentListItem::from(doc.clone())).unwrap_or_default();
    publish_pipeline::execute(
        &state.db,
        PublishEvent {
            site_id,
            entity_type: "document",
            entity_id: doc.id,
            // Documents have no Content row; content_id is unused.
            content_id: Uuid::nil(),
            user_id: Some(auth.0.id),
            clerk_actor_id: auth.0.user_identifier().map(str::to_string),
            action: AuditAction::Create,
            webhook_event: "document.created".to_string(),
            webhook_payload: payload,
            audit_metadata: None,
            status_transition: None,
            change_diff: None,
            slug: None,
            webhook_published_event: None,
        },
    )
    .await?;
    Ok((StatusCode::CREATED, Json(DocumentListItem::from(doc))))
}

#[utoipa::path(
    get,
    path = "/documents/{id}",
    tag = "Documents",
    operation_id = "get_document",
    description = "Get a document (lightweight list shape; see GET /documents/{id}/detail for localizations — ADR 0003)",
    params(("id" = Uuid, Path, description = "Document UUID")),
    responses(
        (status = 200, description = "Document (lightweight)", body = DocumentListItem),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_document(
    State(_state): State<AppState>,
    access: AuthorizedContent<Document, Read>,
) -> Result<Json<DocumentListItem>, ApiError> {
    Ok(Json(DocumentListItem::from(access.entity)))
}

#[utoipa::path(
    get,
    path = "/documents/{id}/detail",
    tag = "Documents",
    operation_id = "get_document_detail",
    description = "Get a document with its localizations[] (full detail shape — ADR 0003)",
    params(("id" = Uuid, Path, description = "Document UUID")),
    responses(
        (status = 200, description = "Document detail", body = DocumentResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_document_detail(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContent<Document, Read>,
) -> Result<Json<DocumentResponse>, ApiError> {
    let doc = access.entity;
    let locs = DocumentLocalizationRepo::find_all_for_document(&state.db, id).await?;
    Ok(Json(DocumentResponse::from_parts(doc, locs)))
}

#[utoipa::path(
    put,
    path = "/documents/{id}",
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
async fn update_document(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
    access: AuthorizedContent<Document, Update>,
    ValidatedJson(body): ValidatedJson<UpdateDocumentRequest>,
) -> Result<Json<DocumentListItem>, ApiError> {
    let existing = access.entity;
    let old = serde_json::to_value(&existing).ok();

    let file_data = if let Some(ref b64) = body.file_data {
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(b64)
            .map_err(|e| {
                ApiError::bad_request(format!("Invalid base64 file_data: {}", e))
                    .with_code(codes::BAD_REQUEST)
            })?;
        Some(decoded)
    } else {
        None
    };

    let clear_file = body.url.is_some() && body.file_data.is_none();

    let doc = DocumentRepo::update(&state.db, id, &body, file_data, clear_file).await?;
    let new_value = serde_json::to_value(&doc).ok();
    let change_diff = match (old, new_value) {
        (Some(old), Some(new)) => Some((old, new)),
        _ => None,
    };
    let payload = serde_json::to_value(DocumentListItem::from(doc.clone())).unwrap_or_default();
    publish_pipeline::execute(
        &state.db,
        PublishEvent {
            site_id: existing.site_id,
            entity_type: "document",
            entity_id: id,
            content_id: Uuid::nil(),
            user_id: Some(auth.0.id),
            clerk_actor_id: auth.0.user_identifier().map(str::to_string),
            action: AuditAction::Update,
            webhook_event: "document.updated".to_string(),
            webhook_payload: payload,
            audit_metadata: None,
            status_transition: None,
            change_diff,
            slug: None,
            webhook_published_event: None,
        },
    )
    .await?;
    Ok(Json(DocumentListItem::from(doc)))
}

#[utoipa::path(
    delete,
    path = "/documents/{id}",
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
async fn delete_document(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
    access: AuthorizedContent<Document, Delete>,
) -> Result<StatusCode, ApiError> {
    let existing = access.entity;

    DocumentRepo::soft_delete(&state.db, id).await?;
    publish_pipeline::execute(
        &state.db,
        PublishEvent {
            site_id: existing.site_id,
            entity_type: "document",
            entity_id: id,
            content_id: Uuid::nil(),
            user_id: Some(auth.0.id),
            clerk_actor_id: auth.0.user_identifier().map(str::to_string),
            action: AuditAction::Delete,
            webhook_event: "document.deleted".to_string(),
            webhook_payload: serde_json::json!({"id": id}),
            audit_metadata: None,
            status_transition: None,
            change_diff: None,
            slug: None,
            webhook_published_event: None,
        },
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/documents/{id}/download",
    tag = "Documents",
    operation_id = "download_document",
    description = "Download the uploaded file for a document. Private documents require a token from verify-access.",
    params(
        ("id" = Uuid, Path, description = "Document UUID"),
        ("token" = Option<String>, Query, description = "Access token for private documents")
    ),
    responses(
        (status = 200, description = "File download"),
        (status = 401, description = "Password required (returns HTML form for browsers)"),
        (status = 404, description = "Not found or no file uploaded", body = ProblemDetails)
    )
)]
async fn download_document(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(q): Query<DownloadQuery>,
    headers: HeaderMap,
) -> Result<DownloadResult, ApiError> {
    let accept_language = headers
        .get(header::ACCEPT_LANGUAGE)
        .and_then(|v| v.to_str().ok());

    match authorize_download(&state, id, q.token.as_deref(), accept_language).await? {
        DownloadAuthorization::Public {
            data,
            file_name,
            mime_type,
        } => Ok(DownloadResult::File(FileDownloadResponse {
            data,
            file_name,
            mime_type,
        })),
        DownloadAuthorization::Private {
            plaintext,
            file_name,
            mime_type,
        } => Ok(DownloadResult::File(FileDownloadResponse {
            data: plaintext,
            file_name,
            mime_type,
        })),
        DownloadAuthorization::PasswordRequired { page } => Ok(DownloadResult::PasswordPage(*page)),
    }
}

/// Authorize a download: resolve the document's privacy + token state into a
/// [`DownloadAuthorization`]. Owns the public / valid-token / password-required
/// decision (and the token-DEK → server-key decryption via [`DocumentCrypto`]),
/// leaving the handler to render the chosen variant.
async fn authorize_download(
    state: &AppState,
    id: Uuid,
    token: Option<&str>,
    accept_language: Option<&str>,
) -> Result<DownloadAuthorization, ApiError> {
    let meta = DocumentRepo::find_encryption_meta(&state.db, id)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("No uploaded file for document {}", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("document")
        })?;

    if !meta.is_private {
        let (data, file_name, mime_type) = DocumentRepo::find_file_data(&state.db, id).await?;
        return Ok(DownloadAuthorization::Public {
            data,
            file_name,
            mime_type,
        });
    }

    let hmac_secret = hmac_secret_for_state(state)?;
    if let Some(tok) = token {
        if let Some(verified) = document_encryption::verify_access_token(tok, &id, &hmac_secret) {
            let (ciphertext, file_name, mime_type) =
                DocumentRepo::find_file_data(&state.db, id).await?;

            let nonce = meta.encryption_nonce.as_deref().ok_or_else(|| {
                ApiError::internal("Missing encryption nonce").with_code(codes::INTERNAL_ERROR)
            })?;

            let crypto = DocumentCrypto::from_settings(&state.settings.security)?;
            let recovered =
                crypto.decrypt_with_recovery(&ciphertext, nonce, verified.dek, &meta)?;
            if let Some(rewrapped) = recovered.rewrapped_dek {
                persist_rotation(state, id, &rewrapped).await;
            }

            return Ok(DownloadAuthorization::Private {
                plaintext: recovered.plaintext,
                file_name,
                mime_type,
            });
        }
    }

    let doc = DocumentRepo::find_by_id(&state.db, id).await?;
    let display_name = doc.file_name.as_deref().unwrap_or("Protected Document");
    let locale = password_page_i18n::negotiate(accept_language);
    let banner = password_banner(
        doc.private_access_expires_at,
        doc.private_locked_until,
        chrono::Utc::now(),
    );

    Ok(DownloadAuthorization::PasswordRequired {
        page: Box::new(PasswordPageResponse {
            document_id: id,
            document_name: display_name.to_string(),
            file_size: doc.file_size,
            document_type: doc.document_type.clone(),
            error: None,
            locale: Some(locale),
            banner,
        }),
    })
}

#[utoipa::path(
    post,
    path = "/documents/{id}/verify-access",
    tag = "Documents",
    operation_id = "verify_document_access",
    description = "Verify password for a private document and receive a time-limited access token",
    params(("id" = Uuid, Path, description = "Document UUID")),
    request_body(content = VerifyDocumentAccessRequest, description = "Password"),
    responses(
        (status = 200, description = "Access granted", body = VerifyDocumentAccessResponse),
        (status = 401, description = "Password required", body = ProblemDetails),
        (status = 403, description = "Wrong password", body = ProblemDetails),
        (status = 429, description = "Rate limited", body = ProblemDetails)
    )
)]
async fn verify_document_access(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    ValidatedJson(body): ValidatedJson<VerifyDocumentAccessRequest>,
) -> Result<Json<VerifyDocumentAccessResponse>, ApiError> {
    let meta = DocumentRepo::find_encryption_meta(&state.db, id).await?;
    let meta = match meta {
        Some(m) if m.is_private => m,
        _ => {
            return Err(
                ApiError::unauthorized("This document is not password-protected")
                    .with_code(codes::DOCUMENT_PASSWORD_REQUIRED),
            );
        }
    };

    // Precedence: expired (410) → locked (423) → wrong password (403).
    // The expired/locked checks run before Argon2 so a wrong password on
    // an expired/locked doc never reveals timing or correctness data.
    if let Some(exp) = meta.private_access_expires_at {
        if exp <= chrono::Utc::now() {
            return Err(ApiError::gone("This document's access window has expired")
                .with_code(codes::DOCUMENT_EXPIRED));
        }
    }
    if meta.private_locked_until.is_some() {
        return Err(
            ApiError::locked("This document is locked after too many failed attempts")
                .with_code(codes::DOCUMENT_LOCKED),
        );
    }

    let hash = meta.password_hash.as_deref().ok_or_else(|| {
        ApiError::internal("Private document missing password hash")
            .with_code(codes::INTERNAL_ERROR)
    })?;

    let valid = document_encryption::verify_password(&body.password, hash)?;
    if !valid {
        let (_count, now_locked) =
            DocumentRepo::record_failed_password_attempt(&state.db, id, LOCKOUT_THRESHOLD).await?;
        if now_locked {
            return Err(
                ApiError::locked("This document is locked after too many failed attempts")
                    .with_code(codes::DOCUMENT_LOCKED),
            );
        }
        return Err(
            ApiError::forbidden("Incorrect password").with_code(codes::DOCUMENT_PASSWORD_INCORRECT)
        );
    }

    DocumentRepo::reset_failed_password_attempts(&state.db, id).await?;

    let salt = meta.encryption_salt.as_deref().ok_or_else(|| {
        ApiError::internal("Private document missing encryption salt")
            .with_code(codes::INTERNAL_ERROR)
    })?;
    let dek = document_encryption::derive_key(&body.password, salt)?;

    let hmac_secret = hmac_secret_for_state(&state)?;
    let access = document_encryption::generate_access_token(&id, &hmac_secret, 3600, Some(&dek))?;

    if let Ok(crypto) = DocumentCrypto::from_settings(&state.settings.security) {
        if let Some(rewrapped) = crypto.rewrap_for_rotation(&meta) {
            persist_rotation(&state, id, &rewrapped).await;
        }
    }

    Ok(Json(VerifyDocumentAccessResponse {
        token: access.token,
        expires_at: access.expires_at,
    }))
}

/// Number of consecutive failed password attempts before a private
/// document locks. Per #696 — fixed at 3 for now; if it becomes
/// site-configurable, lift this into site settings.
const LOCKOUT_THRESHOLD: i32 = 3;

/// Maximum allowed TTL on a private-document share, per #695 acceptance
/// criteria. One year is the upper bound to keep ephemeral shares from
/// degenerating into permanent links.
const MAX_TTL_DAYS: i64 = 365;

#[utoipa::path(
    post,
    path = "/documents/{id}/privacy",
    tag = "Documents",
    operation_id = "set_document_privacy",
    description = "Encrypt a document's file with a password",
    params(("id" = Uuid, Path, description = "Document UUID")),
    request_body(content = SetDocumentPrivacyRequest, description = "Password to set"),
    responses(
        (status = 200, description = "Document encrypted"),
        (status = 400, description = "Document has no file or is URL-based", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn set_document_privacy(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
    access: AuthorizedContent<Document, Update>,
    ValidatedJson(body): ValidatedJson<SetDocumentPrivacyRequest>,
) -> Result<StatusCode, ApiError> {
    let doc = access.entity;

    validate_document_password(&state.db, doc.site_id, &body.password).await?;

    if let Some(exp) = body.expires_at {
        let now = chrono::Utc::now();
        let max = now + chrono::Duration::days(MAX_TTL_DAYS);
        if exp <= now || exp > max {
            return Err(ApiError::bad_request(
                "expires_at must be in the future and at most one year ahead",
            )
            .with_code(codes::DOCUMENT_INVALID_TTL));
        }
    }

    if doc.file_name.is_none() {
        return Err(
            ApiError::bad_request("Only uploaded documents can be password-protected")
                .with_code(codes::DOCUMENT_NOT_UPLOADABLE),
        );
    }

    if doc.is_private {
        return Err(ApiError::bad_request(
            "Document is already private. Remove privacy first to change password.",
        )
        .with_code(codes::BAD_REQUEST));
    }

    let (plaintext, _file_name, _mime_type) = DocumentRepo::find_file_data(&state.db, id).await?;

    let crypto = DocumentCrypto::from_settings(&state.settings.security)?;
    let server_key = crypto.current_server_key();

    let encrypted = document_encryption::encrypt_document(
        &plaintext,
        &body.password,
        server_key.as_ref(),
        crypto.current_key_version(),
    )
    .map_err(|e| {
        ApiError::internal(format!("Encryption failed: {}", e))
            .with_code(codes::DOCUMENT_ENCRYPTION_FAILED)
    })?;

    DocumentRepo::set_privacy(
        &state.db,
        id,
        &encrypted.ciphertext,
        &encrypted.password_hash,
        &encrypted.salt,
        &encrypted.nonce,
        encrypted.encrypted_dek.as_deref(),
        encrypted.key_version,
        body.expires_at,
    )
    .await?;

    AuditedEntity::audit_only("document_privacy")
        .mutate(AuditAction::Update, id)
        .site(doc.site_id)
        .actor(auth.0.id)
        .metadata(serde_json::json!("set_private"))
        .execute(&state.db)
        .await;

    Ok(StatusCode::OK)
}

#[utoipa::path(
    delete,
    path = "/documents/{id}/privacy",
    tag = "Documents",
    operation_id = "remove_document_privacy",
    description = "Decrypt a document's file, removing password protection",
    params(("id" = Uuid, Path, description = "Document UUID")),
    request_body(content = RemoveDocumentPrivacyRequest, description = "Password or admin recovery"),
    responses(
        (status = 200, description = "Document decrypted"),
        (status = 403, description = "Wrong password", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn remove_document_privacy(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
    access: AuthorizedContent<Document, Update>,
    ValidatedJson(body): ValidatedJson<RemoveDocumentPrivacyRequest>,
) -> Result<StatusCode, ApiError> {
    let doc = access.entity;

    if !doc.is_private {
        return Err(ApiError::bad_request("Document is not private").with_code(codes::BAD_REQUEST));
    }

    let meta = DocumentRepo::find_encryption_meta(&state.db, id)
        .await?
        .ok_or_else(|| {
            ApiError::internal("Private document has no encryption metadata")
                .with_code(codes::INTERNAL_ERROR)
        })?;

    let (ciphertext, _file_name, _mime_type) = DocumentRepo::find_file_data(&state.db, id).await?;

    let salt = meta.encryption_salt.as_deref().ok_or_else(|| {
        ApiError::internal("Missing encryption salt").with_code(codes::INTERNAL_ERROR)
    })?;
    let nonce = meta.encryption_nonce.as_deref().ok_or_else(|| {
        ApiError::internal("Missing encryption nonce").with_code(codes::INTERNAL_ERROR)
    })?;

    let plaintext = if let Some(ref password) = body.password {
        document_encryption::decrypt_document(&ciphertext, password, salt, nonce).map_err(|_| {
            ApiError::forbidden("Incorrect password or decryption failed")
                .with_code(codes::DOCUMENT_PASSWORD_INCORRECT)
        })?
    } else {
        let crypto = DocumentCrypto::from_settings(&state.settings.security)?;
        crypto
            .decrypt_with_recovery(&ciphertext, nonce, None, &meta)
            .map_err(|_| {
                ApiError::forbidden(
                    "No password provided and server key recovery unavailable. Provide the document password.",
                )
                .with_code(codes::DOCUMENT_DECRYPTION_FAILED)
            })?
            .plaintext
    };

    DocumentRepo::remove_privacy(&state.db, id, &plaintext).await?;

    AuditedEntity::audit_only("document_privacy")
        .mutate(AuditAction::Update, id)
        .site(doc.site_id)
        .actor(auth.0.id)
        .metadata(serde_json::json!("removed_private"))
        .execute(&state.db)
        .await;

    Ok(StatusCode::OK)
}

#[utoipa::path(
    post,
    path = "/documents/{id}/unlock-access",
    tag = "Documents",
    operation_id = "unlock_document_access",
    description = "Clear the 3-attempt lockout on a private document. Requires Write or higher.",
    params(("id" = Uuid, Path, description = "Document UUID")),
    responses(
        (status = 204, description = "Lockout cleared"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails),
        (status = 409, description = "Document is not locked", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn unlock_document_access(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
    access: AuthorizedContent<Document, Update>,
) -> Result<StatusCode, ApiError> {
    let doc = access.entity;

    let cleared = DocumentRepo::clear_lockout(&state.db, id).await?;
    if !cleared {
        return Err(ApiError::conflict("Document is not currently locked")
            .with_code(codes::DOCUMENT_NOT_LOCKED));
    }

    AuditedEntity::audit_only("document_privacy")
        .mutate(AuditAction::Update, id)
        .site(doc.site_id)
        .actor(auth.0.id)
        .metadata(serde_json::json!("unlocked_access"))
        .execute(&state.db)
        .await;

    Ok(StatusCode::NO_CONTENT)
}

// ============================================
// LOCALIZATION ENDPOINTS
// ============================================

#[utoipa::path(
    post,
    path = "/documents/{id}/localizations",
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
async fn create_document_localization(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    _access: AuthorizedContent<Document, Create>,
    ValidatedJson(body): ValidatedJson<CreateDocumentLocalizationRequest>,
) -> Result<(StatusCode, Json<DocumentLocalizationResponse>), ApiError> {
    let loc = DocumentLocalizationRepo::create(&state.db, id, body.into_inner()).await?;
    Ok((
        StatusCode::CREATED,
        Json(DocumentLocalizationResponse::from(loc)),
    ))
}

#[utoipa::path(
    put,
    path = "/documents/localizations/{id}",
    tag = "Documents",
    operation_id = "update_document_localization",
    description = "Update a document localization",
    params(("id" = Uuid, Path, description = "Localization UUID")),
    request_body(content = UpdateDocumentLocalizationRequest, description = "Localization update data"),
    responses(
        (status = 200, description = "Localization updated", body = DocumentLocalizationResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn update_document_localization(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContent<DocumentLocalization, Update>,
    ValidatedJson(body): ValidatedJson<UpdateDocumentLocalizationRequest>,
) -> Result<Json<DocumentLocalizationResponse>, ApiError> {
    let loc = DocumentLocalizationRepo::update(&state.db, id, body.into_inner()).await?;
    AuditedEntity::audit_only("document_localization")
        .mutate(AuditAction::Update, id)
        .site(access.primary_site_id)
        .actor(access.actor.id)
        .execute(&state.db)
        .await;
    Ok(Json(DocumentLocalizationResponse::from(loc)))
}

#[utoipa::path(
    delete,
    path = "/documents/localizations/{id}",
    tag = "Documents",
    operation_id = "delete_document_localization",
    description = "Delete a document localization",
    params(("id" = Uuid, Path, description = "Localization UUID")),
    responses(
        (status = 204, description = "Localization deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn delete_document_localization(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContent<DocumentLocalization, Delete>,
) -> Result<StatusCode, ApiError> {
    DocumentLocalizationRepo::delete(&state.db, id).await?;
    AuditedEntity::audit_only("document_localization")
        .mutate(AuditAction::Delete, id)
        .site(access.primary_site_id)
        .actor(access.actor.id)
        .execute(&state.db)
        .await;
    Ok(StatusCode::NO_CONTENT)
}

// ============================================
// BLOG-DOCUMENT ENDPOINTS
// ============================================

#[utoipa::path(
    get,
    path = "/blogs/{blog_id}/documents",
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
async fn list_blog_documents(
    State(state): State<AppState>,
    Path(blog_id): Path<Uuid>,
    _auth: ReadKey,
) -> Result<Json<Vec<BlogDocumentResponse>>, ApiError> {
    let details = BlogDocumentRepo::find_all_for_blog(&state.db, blog_id).await?;
    let mut responses = Vec::new();
    for detail in details {
        let locs =
            DocumentLocalizationRepo::find_all_for_document(&state.db, detail.document_id).await?;
        responses.push(BlogDocumentResponse::from_parts(detail, locs));
    }
    Ok(Json(responses))
}

#[utoipa::path(
    post,
    path = "/blogs/{blog_id}/documents",
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
async fn assign_blog_document(
    State(state): State<AppState>,
    Path(blog_id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<AssignBlogDocumentRequest>,
) -> Result<(StatusCode, Json<BlogDocumentResponse>), ApiError> {
    let body = body.into_inner();
    let blog = BlogRepo::find_by_id(&state.db, blog_id).await?;
    let site_ids = Content::find_site_ids(&state.db, blog.content_id).await?;
    for site_id in &site_ids {
        PermissionService::require(
            &state.db,
            &auth.0,
            *site_id,
            &Permission::new("document", "create"),
        )
        .await?;
    }
    if let Some(&site_id) = site_ids.first() {
        ModuleGuard::<DocumentsModule>::check(&state.db, site_id).await?;
    }

    let bd =
        BlogDocumentRepo::assign(&state.db, blog_id, body.document_id, body.display_order).await?;

    if let Some(site_id) = site_ids.first() {
        AuditedEntity::audit_only("blog_document")
            .mutate(AuditAction::Create, bd.id)
            .site(*site_id)
            .actor(auth.0.id)
            .execute(&state.db)
            .await;
    }

    let doc = DocumentRepo::find_by_id(&state.db, body.document_id).await?;
    let locs = DocumentLocalizationRepo::find_all_for_document(&state.db, body.document_id).await?;

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

    Ok((StatusCode::CREATED, Json(response)))
}

#[utoipa::path(
    delete,
    path = "/blogs/{blog_id}/documents/{doc_id}",
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
async fn unassign_blog_document(
    State(state): State<AppState>,
    Path((blog_id, doc_id)): Path<(Uuid, Uuid)>,
    auth: WriteKey,
) -> Result<StatusCode, ApiError> {
    let blog = BlogRepo::find_by_id(&state.db, blog_id).await?;
    let site_ids = Content::find_site_ids(&state.db, blog.content_id).await?;
    for site_id in &site_ids {
        PermissionService::require(
            &state.db,
            &auth.0,
            *site_id,
            &Permission::new("document", "delete"),
        )
        .await?;
    }
    if let Some(&site_id) = site_ids.first() {
        ModuleGuard::<DocumentsModule>::check(&state.db, site_id).await?;
    }

    BlogDocumentRepo::unassign(&state.db, blog_id, doc_id).await?;

    if let Some(site_id) = site_ids.first() {
        AuditedEntity::audit_only("blog_document")
            .mutate(AuditAction::Delete, doc_id)
            .site(*site_id)
            .actor(auth.0.id)
            .execute(&state.db)
            .await;
    }

    Ok(StatusCode::NO_CONTENT)
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_document_folders, create_document_folder))
        .routes(routes!(update_document_folder, delete_document_folder))
        .routes(routes!(list_documents, create_document))
        .routes(routes!(get_document, update_document, delete_document))
        .routes(routes!(get_document_detail))
        .routes(routes!(download_document))
        .routes(routes!(verify_document_access))
        .routes(routes!(set_document_privacy, remove_document_privacy))
        .routes(routes!(unlock_document_access))
        .routes(routes!(create_document_localization))
        .routes(routes!(
            update_document_localization,
            delete_document_localization
        ))
        .routes(routes!(list_blog_documents, assign_blog_document))
        .routes(routes!(unassign_blog_document))
}

#[cfg(test)]
mod tests {
    use super::{password_banner, resolve_hmac_secret, PasswordPageBanner};

    #[test]
    fn banner_is_expired_when_past_expiry() {
        let now = chrono::Utc::now();
        let past = now - chrono::Duration::hours(1);
        assert!(matches!(
            password_banner(Some(past), None, now),
            Some(PasswordPageBanner::Expired)
        ));
    }

    #[test]
    fn banner_expiry_takes_precedence_over_lock() {
        // A document both expired and locked shows the expiry banner first.
        let now = chrono::Utc::now();
        let past = now - chrono::Duration::hours(1);
        let locked = now + chrono::Duration::hours(1);
        assert!(matches!(
            password_banner(Some(past), Some(locked), now),
            Some(PasswordPageBanner::Expired)
        ));
    }

    #[test]
    fn banner_is_locked_when_locked_and_not_expired() {
        let now = chrono::Utc::now();
        let future = now + chrono::Duration::hours(1);
        assert!(matches!(
            password_banner(Some(future), Some(future), now),
            Some(PasswordPageBanner::Locked)
        ));
    }

    #[test]
    fn banner_is_none_when_active() {
        let now = chrono::Utc::now();
        assert!(password_banner(None, None, now).is_none());
    }

    #[test]
    fn resolve_hmac_secret_prefers_document_key() {
        let secret = resolve_hmac_secret("doc-key", "ai-key");
        assert_eq!(secret, Some(b"doc-key".to_vec()));
    }

    #[test]
    fn resolve_hmac_secret_falls_back_to_ai_key_when_document_key_empty() {
        let secret = resolve_hmac_secret("", "ai-key");
        assert_eq!(secret, Some(b"ai-key".to_vec()));
    }

    #[test]
    fn resolve_hmac_secret_returns_none_when_both_keys_empty() {
        // Regression test for issue #686: an empty config once silently fell
        // back to a hardcoded literal compiled into the binary. The helper now
        // returns None so the caller fails explicitly instead of signing tokens
        // with a public constant.
        assert_eq!(resolve_hmac_secret("", ""), None);
    }
}
