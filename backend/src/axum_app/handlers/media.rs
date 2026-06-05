//! Axum port of `crate::handlers::media`. Twelve endpoints covering the
//! main media-file lifecycle: list / get / usage, JSON-create, multipart
//! upload + variant generation, update, soft-delete, plus four
//! metadata-row CRUD endpoints. Mounted under `/api/v1`.
//!
//! This is the second multipart bundle in the Axum tree and the most
//! involved one (multi-field upload: `file`, `site_ids` JSON-string,
//! `folder_id`, `is_global`). The `parse_media_upload_fields` helper
//! walks the field stream once and assembles all fields into a struct,
//! capturing the original filename + client-declared content type from
//! the file part for filename sanitization and MIME fallback.
//!
//! Three helpers (`check_storage_quota`, `sanitize_filename`,
//! `detect_image_dimensions`) live in `crate::handlers::media` as
//! `pub(crate)` so both bundles share the same implementation. The
//! Rocket bundle keeps the `sanitize_filename` unit tests; nothing
//! framework-specific lives in those helpers.

use crate::dto::media::{
    AddMediaMetadataRequest, MediaCategoryCounts, MediaListItem, MediaMetadataResponse,
    MediaResponse, MediaSearchParams, MediaUsageResponse, PaginatedMedia,
    UpdateMediaMetadataRequest, UpdateMediaRequest, UploadMediaRequest, ALL_ALLOWED_MIMES,
};
use crate::dto::validated::ValidatedJson;
use crate::errors::{codes, ApiError, ProblemDetails};
use crate::guards::auth_guard::{ReadKey, WriteKey};
use crate::models::audit::AuditAction;
use crate::models::media::{MediaFile, MediaMetadata, MediaVariant, StorageProvider};
use crate::models::site_settings::SiteSetting;
use crate::services::audit_service;
use crate::services::audited_mutation::AuditedEntity;
use crate::services::image_service;
use crate::services::permission_service::{Permission, PermissionService};
use crate::utils::list_params::ListParams;
use crate::AppState;
use axum::extract::{DefaultBodyLimit, Multipart, Path, Query, State};
use axum::http::StatusCode;
use axum::response::Json;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

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

/// Per-route body limit for the multipart upload endpoint. The default
/// `KEY_MAX_MEDIA_FILE_SIZE` is 50 MB; this caps the raw multipart body
/// at 100 MB to allow form overhead and the JSON-encoded `site_ids` field
/// without truncating the file part.
const MAX_MEDIA_BODY_SIZE: usize = 100 * 1024 * 1024;

#[derive(Debug, Deserialize)]
struct ListMediaQuery {
    page: Option<i64>,
    page_size: Option<i64>,
    search: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
    mime_category: Option<String>,
    folder_id: Option<Uuid>,
    tags: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DeleteMediaQuery {
    force: Option<bool>,
}

/// Fields parsed out of the `multipart/form-data` upload body. Mirrors
/// Rocket's `MediaUploadForm` plus the bits Rocket carried implicitly on
/// the `TempFile` (`raw_name`, `content_type`).
struct MediaUploadFields {
    file: Vec<u8>,
    file_filename: Option<String>,
    file_content_type: Option<String>,
    site_ids_raw: Option<String>,
    folder_id: Option<String>,
    is_global: Option<bool>,
}

async fn parse_media_upload_fields(
    mut multipart: Multipart,
) -> Result<MediaUploadFields, ApiError> {
    let mut fields = MediaUploadFields {
        file: Vec::new(),
        file_filename: None,
        file_content_type: None,
        site_ids_raw: None,
        folder_id: None,
        is_global: None,
    };

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        ApiError::bad_request(format!("Malformed multipart: {e}"))
            .with_code(codes::MEDIA_UPLOAD_READ_FAILED)
    })? {
        let name = field.name().unwrap_or_default().to_string();
        match name.as_str() {
            "file" => {
                fields.file_filename = field.file_name().map(|s| s.to_string());
                fields.file_content_type = field.content_type().map(|s| s.to_string());
                fields.file = field.bytes().await.map(|b| b.to_vec()).map_err(|e| {
                    ApiError::bad_request(format!("Failed to read uploaded file: {e}"))
                        .with_code(codes::MEDIA_UPLOAD_READ_FAILED)
                })?;
            }
            "site_ids" => {
                fields.site_ids_raw = Some(field.text().await.map_err(|e| {
                    ApiError::bad_request(format!("Invalid site_ids field: {e}"))
                        .with_code(codes::BAD_REQUEST)
                })?);
            }
            "folder_id" => {
                fields.folder_id = Some(field.text().await.map_err(|e| {
                    ApiError::bad_request(format!("Invalid folder_id field: {e}"))
                        .with_code(codes::BAD_REQUEST)
                })?);
            }
            "is_global" => {
                let raw = field.text().await.map_err(|e| {
                    ApiError::bad_request(format!("Invalid is_global field: {e}"))
                        .with_code(codes::BAD_REQUEST)
                })?;
                fields.is_global = match raw.trim().to_ascii_lowercase().as_str() {
                    "true" | "1" | "yes" => Some(true),
                    "false" | "0" | "no" | "" => Some(false),
                    _ => {
                        return Err(ApiError::bad_request(format!(
                            "Invalid is_global value: {raw}"
                        ))
                        .with_code(codes::BAD_REQUEST));
                    }
                };
            }
            _ => {
                // Drain unknown fields so the stream advances; ignore content.
                let _ = field.bytes().await;
            }
        }
    }

    Ok(fields)
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/media",
    tag = "Media",
    operation_id = "list_media",
    description = "List all media files for a site (paginated, with optional search & filters)",
    params(
        ("site_id" = Uuid, Path, description = "The UUID of the site"),
        ("page" = Option<i64>, Query, description = "Page number, 1-indexed (default: 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page, 1–100 (default: 10)"),
        ("search" = Option<String>, Query, description = "Search by filename, alt text, caption, or title"),
        ("sort_by" = Option<String>, Query, description = "Sort column: created_at, file_name, file_size"),
        ("sort_dir" = Option<String>, Query, description = "Sort direction: asc or desc (default: asc)"),
        ("mime_category" = Option<String>, Query, description = "Filter by MIME type category (e.g. image, video, audio, document)"),
        ("folder_id" = Option<Uuid>, Query, description = "Filter by media folder UUID"),
        ("tags" = Option<String>, Query, description = "Filter by tags (comma-separated, AND logic)")
    ),
    responses(
        (status = 200, description = "Paginated media list", body = PaginatedMedia),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_media(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<ListMediaQuery>,
    auth: ReadKey,
) -> Result<Json<PaginatedMedia>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("media", "read"),
    )
    .await?;
    let params = ListParams::new(q.page, q.page_size, q.search, q.sort_by, q.sort_dir);
    let (limit, offset) = params.limit_offset();

    let sort_field = params.sort.field_or("created_at");
    let sort_direction = params.sort.direction();

    let tag_list = q.tags.as_deref().filter(|s| !s.is_empty()).map(|s| {
        s.split(',')
            .map(|t| t.trim().to_lowercase())
            .filter(|t| !t.is_empty())
            .collect::<Vec<_>>()
    });

    let search_params = MediaSearchParams {
        search: params.search.clone(),
        mime_category: q.mime_category,
        folder_id: q.folder_id,
        tags: tag_list,
    };

    let (media, total) = if search_params.has_filters() {
        let media = MediaFile::search_for_site(
            &state.db,
            site_id,
            &search_params,
            limit,
            offset,
            Some(sort_field),
            Some(sort_direction),
        )
        .await?;
        let total = MediaFile::count_for_site_filtered(&state.db, site_id, &search_params).await?;
        (media, total)
    } else {
        let media = MediaFile::find_all_for_site(
            &state.db,
            site_id,
            limit,
            offset,
            Some(sort_field),
            Some(sort_direction),
        )
        .await?;
        let total = MediaFile::count_for_site(&state.db, site_id).await?;
        (media, total)
    };

    let items: Vec<MediaListItem> = media.into_iter().map(MediaListItem::from).collect();

    let ids: Vec<Uuid> = items.iter().map(|i| i.id).collect();
    let tags_map = crate::models::media_tag::MediaTag::find_by_media_ids(&state.db, &ids).await?;
    let alt_text_ids = MediaFile::find_ids_with_alt_text(&state.db, &ids).await?;

    let items: Vec<MediaListItem> = items
        .into_iter()
        .map(|mut item| {
            if let Some(tags) = tags_map.get(&item.id) {
                item.tags.clone_from(tags);
            }
            item.has_alt_text = alt_text_ids.contains(&item.id);
            item
        })
        .collect();

    Ok(Json(params.paginate(items, total)))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/media/category-counts",
    tag = "Media",
    operation_id = "media_category_counts",
    description = "Count media per MIME category (image, video, audio, document, other)",
    params(("site_id" = Uuid, Path, description = "The UUID of the site")),
    responses(
        (status = 200, description = "Counts per category", body = MediaCategoryCounts),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn media_category_counts(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<MediaCategoryCounts>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("media", "read"),
    )
    .await?;

    let (image, video, audio, document, other) =
        MediaFile::category_counts_for_site(&state.db, site_id).await?;

    Ok(Json(MediaCategoryCounts {
        image,
        video,
        audio,
        document,
        other,
    }))
}

#[utoipa::path(
    get,
    path = "/media/{id}",
    tag = "Media",
    operation_id = "get_media",
    description = "Get a media file by ID with variants",
    params(("id" = Uuid, Path, description = "The UUID of the media file")),
    responses(
        (status = 200, description = "Media file with variants", body = MediaResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 404, description = "Media file not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_media(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<MediaResponse>, ApiError> {
    let media = MediaFile::find_with_variants(&state.db, id).await?;
    let site_ids = MediaFile::find_site_ids(&state.db, id).await?;
    for site_id in &site_ids {
        PermissionService::require(
            &state.db,
            &auth.0,
            *site_id,
            &Permission::new("media", "read"),
        )
        .await?;
    }
    Ok(Json(MediaResponse::from(media)))
}

#[utoipa::path(
    get,
    path = "/media/{id}/usage",
    tag = "Media",
    operation_id = "get_media_usage",
    description = "Get all references to a media file across blogs, pages, and sites. Use this before deleting to understand impact.",
    params(("id" = Uuid, Path, description = "Media file UUID")),
    responses(
        (status = 200, description = "Media usage details", body = MediaUsageResponse),
        (status = 404, description = "Media not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_media_usage(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<MediaUsageResponse>, ApiError> {
    MediaFile::find_by_id(&state.db, id).await?;
    let site_ids = MediaFile::find_site_ids(&state.db, id).await?;
    for site_id in &site_ids {
        PermissionService::require(
            &state.db,
            &auth.0,
            *site_id,
            &Permission::new("media", "read"),
        )
        .await?;
    }
    let references = MediaFile::find_usage(&state.db, id).await?;
    Ok(Json(MediaUsageResponse {
        usage_count: references.len(),
        references,
    }))
}

#[utoipa::path(
    post,
    path = "/media",
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
async fn create_media(
    State(state): State<AppState>,
    auth: WriteKey,
    ValidatedJson(req): ValidatedJson<UploadMediaRequest>,
) -> Result<(StatusCode, Json<MediaListItem>), ApiError> {
    let req = req.into_inner();
    if let Some(&site_id) = req.site_ids.first() {
        PermissionService::require(
            &state.db,
            &auth.0,
            site_id,
            &Permission::new("media", "create"),
        )
        .await?;

        let max = SiteSetting::get_value(
            &state.db,
            site_id,
            crate::models::site_settings::KEY_MAX_MEDIA_FILE_SIZE,
        )
        .await?
        .as_i64()
        .unwrap_or(52_428_800);

        if req.file_size > max {
            return Err(ApiError::bad_request(format!(
                "File size {} exceeds the per-site maximum of {} bytes",
                req.file_size, max
            ))
            .with_code(codes::MEDIA_UPLOAD_TOO_LARGE));
        }

        crate::services::storage_quota::StorageQuota::check(&state.db, site_id, req.file_size)
            .await?;
    }

    let first_site_id = req.site_ids.first().copied();
    let media = MediaFile::create(&state.db, req).await?;
    AuditedEntity::audit_only("media")
        .mutate(AuditAction::Create, media.id)
        .maybe_site(first_site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;
    Ok((StatusCode::CREATED, Json(MediaListItem::from(media))))
}

#[utoipa::path(
    post,
    path = "/media/upload",
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
async fn upload_media(
    State(state): State<AppState>,
    auth: WriteKey,
    multipart: Multipart,
) -> Result<(StatusCode, Json<MediaResponse>), ApiError> {
    let fields = parse_media_upload_fields(multipart).await?;

    let site_ids_raw = fields.site_ids_raw.ok_or_else(|| {
        ApiError::bad_request("Missing 'site_ids' field").with_code(codes::MEDIA_UPLOAD_NO_DATA)
    })?;
    let site_ids: Vec<Uuid> = serde_json::from_str(&site_ids_raw).map_err(|e| {
        ApiError::bad_request(format!("Invalid site_ids JSON: {e}")).with_code(codes::BAD_REQUEST)
    })?;

    if site_ids.is_empty() {
        return Err(
            ApiError::bad_request("At least one site ID is required").with_code(codes::BAD_REQUEST)
        );
    }

    PermissionService::require(
        &state.db,
        &auth.0,
        site_ids[0],
        &Permission::new("media", "create"),
    )
    .await?;

    let file_bytes = fields.file;
    if file_bytes.is_empty() {
        return Err(
            ApiError::bad_request("Uploaded file is empty").with_code(codes::MEDIA_UPLOAD_EMPTY)
        );
    }

    let mime_type = infer::get(&file_bytes)
        .map(|t| t.mime_type().to_string())
        .or(fields.file_content_type)
        .unwrap_or_else(|| "application/octet-stream".to_string());

    let original_filename = fields
        .file_filename
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "upload".to_string());

    let mime_type = if mime_type == "application/octet-stream" {
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
        return Err(
            ApiError::bad_request(format!("File type '{}' is not allowed", mime_type))
                .with_code(codes::MEDIA_UPLOAD_INVALID_TYPE),
        );
    }

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
        return Err(ApiError::bad_request(format!(
            "File size {} exceeds the maximum of {} bytes",
            file_size, max_size
        ))
        .with_code(codes::MEDIA_UPLOAD_TOO_LARGE));
    }

    crate::services::storage_quota::StorageQuota::check(&state.db, site_ids[0], file_size).await?;

    let checksum = {
        let mut hasher = Sha256::new();
        hasher.update(&file_bytes);
        let hash = hasher.finalize();
        hash.iter()
            .map(|b| format!("{:02x}", b))
            .collect::<String>()
    };

    if let Some(existing) = MediaFile::find_by_checksum(&state.db, &checksum).await? {
        let media = MediaFile::find_with_variants(&state.db, existing.id).await?;
        return Ok((StatusCode::OK, Json(MediaResponse::from(media))));
    }

    let sanitized_filename = sanitize_filename(&original_filename);
    let now = chrono::Utc::now();
    let storage_path = format!(
        "{}/{}/{:02}/{}",
        site_ids[0],
        now.format("%Y"),
        now.format("%m"),
        sanitized_filename,
    );

    let public_url = state
        .storage
        .store(&storage_path, &file_bytes, &mime_type)
        .await?;

    let (width, height) = if mime_type.starts_with("image/") {
        detect_image_dimensions(&file_bytes)
    } else {
        (None, None)
    };

    let extension = original_filename.rsplit('.').next().unwrap_or("bin");
    let base_path = storage_path
        .rsplit_once('.')
        .map(|(b, _)| b)
        .unwrap_or(&storage_path);

    let variants = if mime_type.starts_with("image/") && !mime_type.contains("svg") {
        image_service::generate_variants(
            &file_bytes,
            base_path,
            extension,
            &state.storage,
            image_service::FocalPoint::default(),
        )
        .await?
    } else {
        vec![]
    };

    let folder_id = fields
        .folder_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(Uuid::parse_str)
        .transpose()
        .map_err(|e| {
            ApiError::bad_request(format!("Invalid folder_id: {e}")).with_code(codes::BAD_REQUEST)
        })?;
    let is_global = fields.is_global.unwrap_or(false);
    let storage_provider = if state.settings.storage.provider == "s3" {
        StorageProvider::S3
    } else {
        StorageProvider::Local
    };

    let first_site_id = site_ids[0];
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

    let db_variants = if !variants.is_empty() {
        MediaVariant::create_batch(&state.db, media.id, variants).await?
    } else {
        vec![]
    };

    AuditedEntity::audit_only("media")
        .mutate(AuditAction::Create, media.id)
        .site(first_site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;

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
        focal_x: media.focal_x,
        focal_y: media.focal_y,
        created_at: media.created_at,
        updated_at: media.updated_at,
        variants: db_variants
            .into_iter()
            .map(crate::dto::media::MediaVariantResponse::from)
            .collect(),
    };

    Ok((StatusCode::CREATED, Json(response)))
}

#[utoipa::path(
    put,
    path = "/media/{id}",
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
async fn update_media(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(req): ValidatedJson<UpdateMediaRequest>,
) -> Result<Json<MediaListItem>, ApiError> {
    let existing = MediaFile::find_by_id(&state.db, id).await?;
    let site_ids = MediaFile::find_site_ids(&state.db, id).await?;
    for site_id in &site_ids {
        PermissionService::require(
            &state.db,
            &auth.0,
            *site_id,
            &Permission::new("media", "update"),
        )
        .await?;
    }
    let old = serde_json::to_value(&existing).ok();
    let req = req.into_inner();
    let focal_changed = req
        .focal_x
        .zip(req.focal_y)
        .map(|(fx, fy)| {
            (fx - existing.focal_x).abs() > f32::EPSILON
                || (fy - existing.focal_y).abs() > f32::EPSILON
        })
        .unwrap_or(false);

    let media = MediaFile::update(&state.db, id, req).await?;

    if focal_changed && media.mime_type.starts_with("image/") && !media.mime_type.contains("svg") {
        let focal = image_service::FocalPoint {
            x: media.focal_x,
            y: media.focal_y,
        };
        if let Ok((original_bytes, _)) = state.storage.fetch(&media.storage_path).await {
            let extension = media.original_filename.rsplit('.').next().unwrap_or("bin");
            let base_path = media
                .storage_path
                .rsplit_once('.')
                .map(|(b, _)| b)
                .unwrap_or(&media.storage_path);

            let old_variants = MediaVariant::delete_for_media(&state.db, id).await?;
            for v in &old_variants {
                let _ = state.storage.delete(&v.storage_path).await;
            }

            let new_variants = image_service::generate_variants(
                &original_bytes,
                base_path,
                extension,
                &state.storage,
                focal,
            )
            .await?;
            if !new_variants.is_empty() {
                MediaVariant::create_batch(&state.db, id, new_variants).await?;
            }
        }
    }

    let site_id = site_ids.into_iter().next();
    AuditedEntity::audit_only("media")
        .mutate(AuditAction::Update, id)
        .maybe_site(site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;
    if let (Some(old), Ok(new)) = (old, serde_json::to_value(&media)) {
        audit_service::log_changes(&state.db, site_id, "media", id, Some(auth.0.id), &old, &new)
            .await;
    }
    Ok(Json(MediaListItem::from(media)))
}

#[utoipa::path(
    delete,
    path = "/media/{id}",
    tag = "Media",
    operation_id = "delete_media",
    description = "Soft delete a media file and remove files from storage",
    params(
        ("id" = Uuid, Path, description = "Media file UUID"),
        ("force" = Option<bool>, Query, description = "Force delete even if media is in use")
    ),
    responses(
        (status = 204, description = "Media deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Media not found", body = ProblemDetails),
        (status = 409, description = "Media is in use", body = MediaUsageResponse)
    ),
    security(("api_key" = []))
)]
async fn delete_media(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(q): Query<DeleteMediaQuery>,
    auth: WriteKey,
) -> Result<StatusCode, ApiError> {
    MediaFile::find_by_id(&state.db, id).await?;
    let site_ids = MediaFile::find_site_ids(&state.db, id).await?;
    for site_id in &site_ids {
        PermissionService::require(
            &state.db,
            &auth.0,
            *site_id,
            &Permission::new("media", "delete"),
        )
        .await?;
    }

    if !q.force.unwrap_or(false) {
        let references = MediaFile::find_usage(&state.db, id).await?;
        if !references.is_empty() {
            let count = references.len();
            return Err(ApiError::conflict(format!(
                "Cannot delete: media is used in {} item{}. Use ?force=true to override.",
                count,
                if count == 1 { "" } else { "s" }
            ))
            .with_code(codes::CONFLICT));
        }
    }

    MediaFile::soft_delete(&state.db, id).await?;
    let site_id = site_ids.into_iter().next();
    AuditedEntity::audit_only("media")
        .mutate(AuditAction::Delete, id)
        .maybe_site(site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/media/{id}/metadata",
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
async fn list_media_metadata(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<Vec<MediaMetadataResponse>>, ApiError> {
    MediaFile::find_by_id(&state.db, id).await?;
    let site_ids = MediaFile::find_site_ids(&state.db, id).await?;
    for site_id in &site_ids {
        PermissionService::require(
            &state.db,
            &auth.0,
            *site_id,
            &Permission::new("media", "read"),
        )
        .await?;
    }
    let metadata = MediaMetadata::find_all_for_media(&state.db, id).await?;
    let responses: Vec<MediaMetadataResponse> = metadata
        .into_iter()
        .map(MediaMetadataResponse::from)
        .collect();
    Ok(Json(responses))
}

#[utoipa::path(
    post,
    path = "/media/{id}/metadata",
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
async fn create_media_metadata(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(req): ValidatedJson<AddMediaMetadataRequest>,
) -> Result<(StatusCode, Json<MediaMetadataResponse>), ApiError> {
    MediaFile::find_by_id(&state.db, id).await?;
    let site_ids = MediaFile::find_site_ids(&state.db, id).await?;
    for site_id in &site_ids {
        PermissionService::require(
            &state.db,
            &auth.0,
            *site_id,
            &Permission::new("media", "create"),
        )
        .await?;
    }
    let metadata = MediaMetadata::create(&state.db, id, req.into_inner()).await?;
    Ok((
        StatusCode::CREATED,
        Json(MediaMetadataResponse::from(metadata)),
    ))
}

#[utoipa::path(
    put,
    path = "/media/metadata/{metadata_id}",
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
async fn update_media_metadata(
    State(state): State<AppState>,
    Path(metadata_id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(req): ValidatedJson<UpdateMediaMetadataRequest>,
) -> Result<Json<MediaMetadataResponse>, ApiError> {
    let existing = MediaMetadata::find_by_id(&state.db, metadata_id).await?;
    let site_ids = MediaFile::find_site_ids(&state.db, existing.media_file_id).await?;
    for site_id in &site_ids {
        PermissionService::require(
            &state.db,
            &auth.0,
            *site_id,
            &Permission::new("media", "update"),
        )
        .await?;
    }
    let metadata = MediaMetadata::update(&state.db, metadata_id, req.into_inner()).await?;
    Ok(Json(MediaMetadataResponse::from(metadata)))
}

#[utoipa::path(
    delete,
    path = "/media/metadata/{metadata_id}",
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
async fn delete_media_metadata(
    State(state): State<AppState>,
    Path(metadata_id): Path<Uuid>,
    auth: WriteKey,
) -> Result<StatusCode, ApiError> {
    let existing = MediaMetadata::find_by_id(&state.db, metadata_id).await?;
    let site_ids = MediaFile::find_site_ids(&state.db, existing.media_file_id).await?;
    for site_id in &site_ids {
        PermissionService::require(
            &state.db,
            &auth.0,
            *site_id,
            &Permission::new("media", "delete"),
        )
        .await?;
    }
    MediaMetadata::delete(&state.db, metadata_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_media))
        .routes(routes!(media_category_counts))
        .routes(routes!(get_media, update_media, delete_media))
        .routes(routes!(get_media_usage))
        .routes(routes!(create_media))
        .routes(routes!(upload_media))
        .routes(routes!(list_media_metadata, create_media_metadata))
        .routes(routes!(update_media_metadata, delete_media_metadata))
        .layer(DefaultBodyLimit::max(MAX_MEDIA_BODY_SIZE))
}
