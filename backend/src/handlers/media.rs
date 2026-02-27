//! Media handlers

use rocket::form::Form;
use rocket::fs::TempFile;
use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State};
use sha2::{Digest, Sha256};
use uuid::Uuid;
use validator::Validate;

use crate::dto::media::{
    AddMediaMetadataRequest, MediaListItem, MediaMetadataResponse, MediaResponse,
    MediaSearchParams, PaginatedMedia, UpdateMediaMetadataRequest, UpdateMediaRequest,
    UploadMediaRequest, ALL_ALLOWED_MIMES,
};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::models::audit::AuditAction;
use crate::models::media::{MediaFile, MediaMetadata, MediaVariant, StorageProvider};
use crate::models::site_membership::SiteRole;
use crate::models::site_settings::SiteSetting;
use crate::services::{audit_service, image_service};
use crate::utils::pagination::PaginationParams;
use crate::AppState;

/// List all media files for a site (paginated, with optional search & filters)
#[utoipa::path(
    tag = "Media",
    operation_id = "list_media",
    description = "List all media files for a site (paginated, with optional search & filters)",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default 1)"),
        ("per_page" = Option<i64>, Query, description = "Items per page (default 10, max 100)"),
        ("search" = Option<String>, Query, description = "Search text (filename, alt text, caption, title)"),
        ("mime_category" = Option<String>, Query, description = "MIME category filter (image, video, audio, document)"),
        ("folder_id" = Option<Uuid>, Query, description = "Folder UUID filter")
    ),
    responses(
        (status = 200, description = "Paginated media list", body = PaginatedMedia),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/media?<page>&<per_page>&<search>&<mime_category>&<folder_id>")]
#[allow(clippy::too_many_arguments)]
pub async fn list_media(
    state: &State<AppState>,
    site_id: Uuid,
    page: Option<i64>,
    per_page: Option<i64>,
    search: Option<String>,
    mime_category: Option<String>,
    folder_id: Option<Uuid>,
    auth: ReadKey,
) -> Result<Json<PaginatedMedia>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let pagination = PaginationParams::new(page, per_page);
    let (limit, offset) = pagination.limit_offset();

    let search_params = MediaSearchParams {
        search,
        mime_category,
        folder_id,
    };

    let (media, total) = if search_params.has_filters() {
        let media =
            MediaFile::search_for_site(&state.db, site_id, &search_params, limit, offset).await?;
        let total = MediaFile::count_for_site_filtered(&state.db, site_id, &search_params).await?;
        (media, total)
    } else {
        let media = MediaFile::find_all_for_site(&state.db, site_id, limit, offset).await?;
        let total = MediaFile::count_for_site(&state.db, site_id).await?;
        (media, total)
    };

    let items: Vec<MediaListItem> = media.into_iter().map(MediaListItem::from).collect();
    let paginated = pagination.paginate(items, total);

    Ok(Json(paginated))
}

/// Get media file by ID (with variants)
#[utoipa::path(
    tag = "Media",
    operation_id = "get_media",
    description = "Get a media file by ID with variants",
    params(("id" = Uuid, Path, description = "Media file UUID")),
    responses(
        (status = 200, description = "Media file with variants", body = MediaResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Media not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/media/<id>")]
pub async fn get_media(
    state: &State<AppState>,
    id: Uuid,
    _auth: ReadKey,
) -> Result<Json<MediaResponse>, ApiError> {
    let media = MediaFile::find_with_variants(&state.db, id).await?;
    Ok(Json(MediaResponse::from(media)))
}

/// Create a media file record
#[utoipa::path(
    tag = "Media",
    operation_id = "create_media",
    description = "Create a media file record",
    request_body(content = UploadMediaRequest, description = "Media file metadata"),
    responses(
        (status = 201, description = "Media created", body = MediaListItem),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/media", data = "<body>")]
pub async fn create_media(
    state: &State<AppState>,
    body: Json<UploadMediaRequest>,
    auth: ReadKey,
) -> Result<(Status, Json<MediaListItem>), ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    // Authorize against the first site_id in the request
    if let Some(&site_id) = req.site_ids.first() {
        auth.0
            .authorize_site_action(&state.db, site_id, &SiteRole::Author)
            .await?;
    }

    // Per-site media file size check
    if let Some(&site_id) = req.site_ids.first() {
        let max = SiteSetting::get_value(
            &state.db,
            site_id,
            crate::models::site_settings::KEY_MAX_MEDIA_FILE_SIZE,
        )
        .await?
        .as_i64()
        .unwrap_or(52_428_800);

        if req.file_size > max {
            return Err(ApiError::BadRequest(format!(
                "File size {} exceeds the per-site maximum of {} bytes",
                req.file_size, max
            )));
        }
    }

    let media = MediaFile::create(&state.db, req).await?;
    audit_service::log_action(
        &state.db,
        None,
        Some(auth.0.id),
        AuditAction::Create,
        "media",
        media.id,
        None,
    )
    .await;
    Ok((Status::Created, Json(MediaListItem::from(media))))
}

/// Multipart form for file upload
#[derive(FromForm)]
pub struct MediaUploadForm<'r> {
    file: TempFile<'r>,
    /// JSON array of site UUIDs, e.g. `["uuid1","uuid2"]`
    site_ids: String,
    folder_id: Option<String>,
    is_global: Option<bool>,
}

/// Upload a media file (multipart/form-data)
#[utoipa::path(
    tag = "Media",
    operation_id = "upload_media_file",
    description = "Upload a media file with automatic MIME detection and image variant generation. Send as multipart/form-data with fields: file, site_ids (JSON array), folder_id (optional), is_global (optional).",
    request_body(content_type = "multipart/form-data", content = String, description = "Multipart form with file + metadata fields"),
    responses(
        (status = 201, description = "Media uploaded and variants generated", body = MediaResponse),
        (status = 400, description = "Invalid file or form data", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/media/upload", data = "<form>")]
pub async fn upload_media(
    state: &State<AppState>,
    auth: ReadKey,
    form: Form<MediaUploadForm<'_>>,
) -> Result<(Status, Json<MediaResponse>), ApiError> {
    // 1. Parse site_ids from JSON string
    let site_ids: Vec<Uuid> = serde_json::from_str(&form.site_ids)
        .map_err(|e| ApiError::BadRequest(format!("Invalid site_ids JSON: {e}")))?;

    if site_ids.is_empty() {
        return Err(ApiError::BadRequest(
            "At least one site ID is required".to_string(),
        ));
    }

    // Authorize against the first site
    auth.0
        .authorize_site_action(&state.db, site_ids[0], &SiteRole::Author)
        .await?;

    // 2. Read file bytes
    let temp_path = form
        .file
        .path()
        .ok_or_else(|| ApiError::BadRequest("No file data received".to_string()))?;
    let file_bytes = tokio::fs::read(temp_path)
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to read uploaded file: {e}")))?;

    if file_bytes.is_empty() {
        return Err(ApiError::BadRequest("Uploaded file is empty".to_string()));
    }

    // 3. Detect MIME type via magic bytes
    let mime_type = infer::get(&file_bytes)
        .map(|t| t.mime_type().to_string())
        .or_else(|| {
            // Fallback: use the content type provided by the client
            form.file.content_type().map(|ct| ct.to_string())
        })
        .unwrap_or_else(|| "application/octet-stream".to_string());

    // For text-based types that infer can't detect, check extension
    let original_filename = form
        .file
        .raw_name()
        .map(|n| n.dangerous_unsafe_unsanitized_raw().as_str().to_string())
        .unwrap_or_else(|| "upload".to_string());

    let mime_type = if mime_type == "application/octet-stream" {
        // Try to infer from extension
        match original_filename
            .rsplit('.')
            .next()
            .map(|e| e.to_lowercase())
        {
            Some(ext) if ext == "md" => "text/markdown".to_string(),
            Some(ext) if ext == "txt" => "text/plain".to_string(),
            Some(ext) if ext == "svg" => "image/svg+xml".to_string(),
            _ => mime_type,
        }
    } else {
        mime_type
    };

    if !ALL_ALLOWED_MIMES.contains(&mime_type.as_str()) {
        return Err(ApiError::BadRequest(format!(
            "File type '{}' is not allowed",
            mime_type
        )));
    }

    // 4. Validate file size against per-site limit
    let file_size = file_bytes.len() as i64;
    let max_size = SiteSetting::get_value(
        &state.db,
        site_ids[0],
        crate::models::site_settings::KEY_MAX_MEDIA_FILE_SIZE,
    )
    .await?
    .as_i64()
    .unwrap_or(52_428_800);

    if file_size > max_size {
        return Err(ApiError::BadRequest(format!(
            "File size {} exceeds the maximum of {} bytes",
            file_size, max_size
        )));
    }

    // 5. Compute SHA-256 checksum
    let checksum = {
        let mut hasher = Sha256::new();
        hasher.update(&file_bytes);
        let hash = hasher.finalize();
        hash.iter()
            .map(|b| format!("{:02x}", b))
            .collect::<String>()
    };

    // 6. Deduplication check
    if let Some(existing) = MediaFile::find_by_checksum(&state.db, &checksum).await? {
        let media = MediaFile::find_with_variants(&state.db, existing.id).await?;
        return Ok((Status::Ok, Json(MediaResponse::from(media))));
    }

    // 7. Sanitize filename and build storage path
    let sanitized_filename = sanitize_filename(&original_filename);
    let now = chrono::Utc::now();
    let storage_path = format!(
        "{}/{}/{:02}/{}",
        site_ids[0],
        now.format("%Y"),
        now.format("%m"),
        sanitized_filename,
    );

    // 8. Store original file
    let public_url = state
        .storage
        .store(&storage_path, &file_bytes, &mime_type)
        .await?;

    // 9. Detect image dimensions
    let (width, height) = if mime_type.starts_with("image/") {
        detect_image_dimensions(&file_bytes)
    } else {
        (None, None)
    };

    // 10. Generate image variants
    let extension = original_filename.rsplit('.').next().unwrap_or("bin");
    let base_path = storage_path
        .rsplit_once('.')
        .map(|(b, _)| b)
        .unwrap_or(&storage_path);

    let variants = if mime_type.starts_with("image/") && !mime_type.contains("svg") {
        image_service::generate_variants(&file_bytes, base_path, extension, &state.storage).await?
    } else {
        vec![]
    };

    // 11. Parse optional fields
    let folder_id = form
        .folder_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(Uuid::parse_str)
        .transpose()
        .map_err(|e| ApiError::BadRequest(format!("Invalid folder_id: {e}")))?;
    let is_global = form.is_global.unwrap_or(false);
    let storage_provider = if state.settings.storage.provider == "s3" {
        StorageProvider::S3
    } else {
        StorageProvider::Local
    };

    // 12. Insert into database
    let media = MediaFile::create_from_upload(
        &state.db,
        &sanitized_filename,
        &original_filename,
        &mime_type,
        file_size,
        storage_provider,
        &storage_path,
        &public_url,
        &checksum,
        width,
        height,
        Some(auth.0.id),
        is_global,
        folder_id,
        site_ids,
    )
    .await?;

    // 13. Insert variants
    let db_variants = if !variants.is_empty() {
        MediaVariant::create_batch(&state.db, media.id, variants).await?
    } else {
        vec![]
    };

    // 14. Audit log
    audit_service::log_action(
        &state.db,
        None,
        Some(auth.0.id),
        AuditAction::Create,
        "media",
        media.id,
        None,
    )
    .await;

    // 15. Build response
    let response = MediaResponse {
        id: media.id,
        filename: media.filename,
        original_filename: media.original_filename,
        mime_type: media.mime_type,
        file_size: media.file_size,
        storage_provider: media.storage_provider,
        public_url: media.public_url,
        width: media.width,
        height: media.height,
        duration: media.duration,
        is_global: media.is_global,
        created_at: media.created_at,
        updated_at: media.updated_at,
        variants: db_variants
            .into_iter()
            .map(crate::dto::media::MediaVariantResponse::from)
            .collect(),
    };

    Ok((Status::Created, Json(response)))
}

/// Sanitize a filename: keep only safe characters, replace spaces with hyphens
fn sanitize_filename(name: &str) -> String {
    let name = name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect::<String>();

    // Collapse consecutive hyphens
    let mut result = String::with_capacity(name.len());
    let mut prev_was_hyphen = false;
    for c in name.chars() {
        if c == '-' {
            if !prev_was_hyphen {
                result.push(c);
            }
            prev_was_hyphen = true;
        } else {
            result.push(c);
            prev_was_hyphen = false;
        }
    }

    if result.is_empty() {
        "upload".to_string()
    } else {
        result
    }
}

/// Detect image dimensions from bytes
fn detect_image_dimensions(bytes: &[u8]) -> (Option<i32>, Option<i32>) {
    match image::ImageReader::new(std::io::Cursor::new(bytes))
        .with_guessed_format()
        .ok()
        .and_then(|r| r.into_dimensions().ok())
    {
        Some((w, h)) => (Some(w as i32), Some(h as i32)),
        None => (None, None),
    }
}

/// Update media file metadata
#[utoipa::path(
    tag = "Media",
    operation_id = "update_media",
    description = "Update media file metadata",
    params(("id" = Uuid, Path, description = "Media file UUID")),
    request_body(content = UpdateMediaRequest, description = "Media update data"),
    responses(
        (status = 200, description = "Media updated", body = MediaListItem),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Media not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[put("/media/<id>", data = "<body>")]
pub async fn update_media(
    state: &State<AppState>,
    id: Uuid,
    body: Json<UpdateMediaRequest>,
    auth: ReadKey,
) -> Result<Json<MediaListItem>, ApiError> {
    let existing = MediaFile::find_by_id(&state.db, id).await?;
    let old = serde_json::to_value(&existing).ok();

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let media = MediaFile::update(&state.db, id, req).await?;
    audit_service::log_action(
        &state.db,
        None,
        Some(auth.0.id),
        AuditAction::Update,
        "media",
        id,
        None,
    )
    .await;
    if let (Some(old), Ok(new)) = (old, serde_json::to_value(&media)) {
        audit_service::log_changes(&state.db, None, "media", id, Some(auth.0.id), &old, &new).await;
    }
    Ok(Json(MediaListItem::from(media)))
}

/// Delete media file (soft delete + storage cleanup)
#[utoipa::path(
    tag = "Media",
    operation_id = "delete_media",
    description = "Soft delete a media file and remove files from storage",
    params(("id" = Uuid, Path, description = "Media file UUID")),
    responses(
        (status = 204, description = "Media deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Media not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/media/<id>")]
pub async fn delete_media(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    // Fetch media and variants before soft-deleting
    let media = MediaFile::find_by_id(&state.db, id).await?;
    let variants = MediaVariant::find_for_media(&state.db, id).await?;

    // Delete variant files from storage
    for variant in &variants {
        if let Err(e) = state.storage.delete(&variant.storage_path).await {
            tracing::warn!(error = %e, path = %variant.storage_path, "Failed to delete variant file from storage");
        }
    }

    // Delete original file from storage
    if let Err(e) = state.storage.delete(&media.storage_path).await {
        tracing::warn!(error = %e, path = %media.storage_path, "Failed to delete original file from storage");
    }

    // Soft-delete the DB record
    MediaFile::soft_delete(&state.db, id).await?;
    audit_service::log_action(
        &state.db,
        None,
        Some(auth.0.id),
        AuditAction::Delete,
        "media",
        id,
        None,
    )
    .await;
    Ok(Status::NoContent)
}

// ============================================
// METADATA ENDPOINTS
// ============================================

/// List metadata for a media file
#[utoipa::path(
    tag = "Media",
    operation_id = "list_media_metadata",
    description = "List all metadata for a media file",
    params(("id" = Uuid, Path, description = "Media file UUID")),
    responses(
        (status = 200, description = "Media metadata", body = Vec<MediaMetadataResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/media/<id>/metadata")]
pub async fn list_media_metadata(
    state: &State<AppState>,
    id: Uuid,
    _auth: ReadKey,
) -> Result<Json<Vec<MediaMetadataResponse>>, ApiError> {
    MediaFile::find_by_id(&state.db, id).await?;
    let metadata = MediaMetadata::find_all_for_media(&state.db, id).await?;
    let responses: Vec<MediaMetadataResponse> = metadata
        .into_iter()
        .map(MediaMetadataResponse::from)
        .collect();
    Ok(Json(responses))
}

/// Create metadata for a media file
#[utoipa::path(
    tag = "Media",
    operation_id = "create_media_metadata",
    description = "Create metadata for a media file",
    params(("id" = Uuid, Path, description = "Media file UUID")),
    request_body(content = AddMediaMetadataRequest, description = "Metadata data"),
    responses(
        (status = 201, description = "Metadata created", body = MediaMetadataResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/media/<id>/metadata", data = "<body>")]
pub async fn create_media_metadata(
    state: &State<AppState>,
    id: Uuid,
    body: Json<AddMediaMetadataRequest>,
    _auth: ReadKey,
) -> Result<(Status, Json<MediaMetadataResponse>), ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    MediaFile::find_by_id(&state.db, id).await?;
    let metadata = MediaMetadata::create(&state.db, id, req).await?;
    Ok((Status::Created, Json(MediaMetadataResponse::from(metadata))))
}

/// Update media metadata
#[utoipa::path(
    tag = "Media",
    operation_id = "update_media_metadata",
    description = "Update media metadata",
    params(("metadata_id" = Uuid, Path, description = "Metadata UUID")),
    request_body(content = UpdateMediaMetadataRequest, description = "Metadata update data"),
    responses(
        (status = 200, description = "Metadata updated", body = MediaMetadataResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[put("/media/metadata/<metadata_id>", data = "<body>")]
pub async fn update_media_metadata(
    state: &State<AppState>,
    metadata_id: Uuid,
    body: Json<UpdateMediaMetadataRequest>,
    _auth: ReadKey,
) -> Result<Json<MediaMetadataResponse>, ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let metadata = MediaMetadata::update(&state.db, metadata_id, req).await?;
    Ok(Json(MediaMetadataResponse::from(metadata)))
}

/// Delete media metadata
#[utoipa::path(
    tag = "Media",
    operation_id = "delete_media_metadata",
    description = "Delete media metadata",
    params(("metadata_id" = Uuid, Path, description = "Metadata UUID")),
    responses(
        (status = 204, description = "Metadata deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/media/metadata/<metadata_id>")]
pub async fn delete_media_metadata(
    state: &State<AppState>,
    metadata_id: Uuid,
    _auth: ReadKey,
) -> Result<Status, ApiError> {
    MediaMetadata::delete(&state.db, metadata_id).await?;
    Ok(Status::NoContent)
}

/// Collect media routes
pub fn routes() -> Vec<Route> {
    routes![
        list_media,
        get_media,
        create_media,
        upload_media,
        update_media,
        delete_media,
        list_media_metadata,
        create_media_metadata,
        update_media_metadata,
        delete_media_metadata
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 10, "Should have 10 media routes");
    }

    #[test]
    fn test_sanitize_filename() {
        assert_eq!(sanitize_filename("hello world.jpg"), "hello-world.jpg");
        assert_eq!(sanitize_filename("file (1).png"), "file-1-.png");
        assert_eq!(sanitize_filename("safe-name_v2.webp"), "safe-name_v2.webp");
        assert_eq!(sanitize_filename(""), "upload");
    }
}
