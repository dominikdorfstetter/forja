//! Axum port of `crate::handlers::favicon`. Five endpoints:
//!
//! - `POST /sites/{site_id}/favicon` (auth: WriteKey, multipart) — generate
//!   favicon package from a source image (single `file` field).
//! - `GET  /sites/{site_id}/favicon` — variants + `<head>` snippet.
//! - `GET  /sites/{site_id}/favicon/download` — zip archive of the package.
//! - `GET  /sites/{slug}/site.webmanifest` (public) — `application/manifest+json`.
//! - `GET  /sites/{slug}/browserconfig.xml` (public) — `application/xml`.
//!
//! This is the first multipart bundle in the Axum tree. The pattern: pull
//! the named field via `axum::extract::Multipart::next_field()`, read the
//! bytes, and validate size + MIME the same way Rocket's `TempFile` flow
//! did. Per-route body limit is set via `DefaultBodyLimit::max(...)` on
//! the bundle router so non-multipart endpoints inherit a sensible cap.
//!
//! Custom Rocket `Responder` types (`ManifestResponse`,
//! `BrowserconfigResponse`, `ZipResponse`) collapse into Axum's
//! tuple-based `IntoResponse` shorthand: `([(HeaderName, HeaderValue); N], body)`.

use axum::extract::{DefaultBodyLimit, Multipart, Path, State};
use axum::http::HeaderValue;
use axum::http::header::{CACHE_CONTROL, CONTENT_DISPOSITION, CONTENT_TYPE};
use axum::response::Json;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::AppState;
use crate::dto::favicon::{
    FaviconResponse, FaviconVariant, ensure_absolute_url, render_head_snippet,
};
use crate::dto::site::UpdateSiteRequest;
use crate::errors::{ApiError, ProblemDetails, codes};
use crate::guards::auth_guard::WriteKey;
use crate::models::site::Site;
use crate::models::site_settings::{KEY_BACKGROUND_COLOR, KEY_THEME_COLOR, SiteSetting};
use crate::services::favicon_service;
use crate::services::permission_service::{Permission, PermissionService};

const MAX_FAVICON_SIZE: usize = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES: &[&str] = &["image/png", "image/jpeg", "image/gif", "image/webp"];

/// Pull the `file` field out of a multipart upload, returning its raw bytes.
/// Rocket's `FromForm` + `TempFile` ergonomics don't translate to Axum;
/// instead we walk the field stream looking for one named `file`. The
/// returned `Vec<u8>` plays the same role as Rocket's `tokio::fs::read`
/// of the temp path.
async fn read_single_file_field(
    mut multipart: Multipart,
    field_name: &str,
) -> Result<Vec<u8>, ApiError> {
    while let Some(field) = multipart.next_field().await.map_err(|e| {
        ApiError::bad_request(format!("Malformed multipart: {e}"))
            .with_code(codes::MEDIA_UPLOAD_READ_FAILED)
    })? {
        if field.name() == Some(field_name) {
            return field.bytes().await.map(|b| b.to_vec()).map_err(|e| {
                ApiError::bad_request(format!("Failed to read uploaded file: {e}"))
                    .with_code(codes::MEDIA_UPLOAD_READ_FAILED)
            });
        }
    }
    Err(
        ApiError::bad_request(format!("Missing '{field_name}' field"))
            .with_code(codes::MEDIA_UPLOAD_NO_DATA),
    )
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/favicon",
    tag = "Sites",
    operation_id = "upload_favicon",
    description = "Upload a source image (512x512+ recommended) to generate a full favicon package including favicon.ico, PNGs, Apple Touch Icon, and Android Chrome icons.",
    request_body(content_type = "multipart/form-data", content = String, description = "Multipart form with a file field"),
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Favicon package generated", body = FaviconResponse),
        (status = 400, description = "Invalid image", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("bearer_auth" = []))
)]
async fn upload_favicon(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
    multipart: Multipart,
) -> Result<Json<FaviconResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("settings", "update"),
    )
    .await?;

    Site::find_by_id(&state.db, site_id).await?;

    let file_bytes = read_single_file_field(multipart, "file").await?;

    if file_bytes.is_empty() {
        return Err(ApiError::bad_request("Empty file").with_code(codes::MEDIA_UPLOAD_EMPTY));
    }
    if file_bytes.len() > MAX_FAVICON_SIZE {
        return Err(ApiError::bad_request("File too large (max 10 MB)")
            .with_code(codes::MEDIA_UPLOAD_TOO_LARGE));
    }

    let mime = infer::get(&file_bytes)
        .map(|t| t.mime_type().to_string())
        .unwrap_or_default();
    if !ALLOWED_MIME_TYPES.contains(&mime.as_str()) {
        return Err(ApiError::bad_request(format!(
            "Unsupported image type: {mime}. Use PNG, JPEG, GIF, or WebP."
        ))
        .with_code(codes::MEDIA_UPLOAD_INVALID_TYPE));
    }

    let variants =
        favicon_service::generate_favicon_package(&file_bytes, site_id, &state.storage).await?;

    // Cache-bust: `/files/{*path}` ships `Cache-Control: immutable`, so a same-path replacement is invisible to browsers without a query-string change.
    let cache_bust = chrono::Utc::now().timestamp();

    let public_url = &state.settings.public_url;
    let variants: Vec<FaviconVariant> = variants
        .into_iter()
        .map(|mut v| {
            v.url = format!(
                "{}?v={}",
                ensure_absolute_url(&v.url, public_url),
                cache_bust
            );
            v
        })
        .collect();

    if let Some(v32) = variants.iter().find(|v| v.name == "favicon-32x32.png") {
        Site::update(
            &state.db,
            site_id,
            UpdateSiteRequest {
                name: None,
                slug: None,
                description: None,
                logo_url: None,
                favicon_url: Some(v32.url.clone()),
                base_url: None,
                theme: None,
                timezone: None,
                is_active: None,
            },
        )
        .await?;
    }

    let theme_color = SiteSetting::get_value(&state.db, site_id, KEY_THEME_COLOR)
        .await?
        .as_str()
        .unwrap_or("#ffffff")
        .to_string();

    let snippet = render_head_snippet(&variants, &theme_color);

    Ok(Json(FaviconResponse {
        variants,
        head_snippet: snippet,
    }))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/favicon",
    tag = "Sites",
    operation_id = "get_favicon",
    description = "Get all favicon variant URLs and the HTML <head> snippet for the site.",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Favicon variants and snippet", body = FaviconResponse),
        (status = 404, description = "No favicon package generated yet", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_favicon(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
) -> Result<Json<FaviconResponse>, ApiError> {
    let site = Site::find_by_id(&state.db, site_id).await?;
    let base_path = format!("site_favicons/{}", site_id);

    let probe_path = format!("{}/favicon-32x32.png", base_path);
    if !state.storage.exists(&probe_path).await? {
        return Err(ApiError::not_found(
            "No favicon package generated yet. Upload a source image first.".to_string(),
        )
        .with_code(codes::RESOURCE_NOT_FOUND));
    }

    let variant_names: Vec<(&str, u32, u32)> = vec![
        ("favicon.ico", 48, 48),
        ("favicon-16x16.png", 16, 16),
        ("favicon-32x32.png", 32, 32),
        ("apple-touch-icon.png", 180, 180),
        ("android-chrome-192x192.png", 192, 192),
        ("android-chrome-512x512.png", 512, 512),
    ];

    // Cache-bust: see `upload_favicon`. `site.updated_at` is bumped by every favicon upload via Site::update.
    let cache_bust = site.updated_at.timestamp();

    let public_url = &state.settings.public_url;
    let variants: Vec<FaviconVariant> = variant_names
        .into_iter()
        .map(|(name, w, h)| {
            let path = format!("{}/{}", base_path, name);
            let url = ensure_absolute_url(&state.storage.public_url(&path), public_url);
            FaviconVariant {
                name: name.to_string(),
                url: format!("{}?v={}", url, cache_bust),
                width: w,
                height: h,
            }
        })
        .collect();

    let theme_color = SiteSetting::get_value(&state.db, site_id, KEY_THEME_COLOR)
        .await?
        .as_str()
        .unwrap_or("#ffffff")
        .to_string();

    let snippet = render_head_snippet(&variants, &theme_color);

    Ok(Json(FaviconResponse {
        variants,
        head_snippet: snippet,
    }))
}

#[utoipa::path(
    get,
    path = "/sites/{slug}/site.webmanifest",
    tag = "Sites",
    operation_id = "get_webmanifest",
    description = "Get the web app manifest for a site. Public endpoint.",
    params(("slug" = String, Path, description = "URL-friendly site identifier")),
    responses(
        (status = 200, description = "Web manifest JSON", content_type = "application/manifest+json"),
        (status = 404, description = "Site not found", body = ProblemDetails)
    )
)]
async fn get_webmanifest(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<([(axum::http::HeaderName, HeaderValue); 2], String), ApiError> {
    let site = Site::find_by_slug(&state.db, &slug).await?;
    let base_path = format!("site_favicons/{}", site.id);
    let cache_bust = site.updated_at.timestamp();

    let variants = vec![
        FaviconVariant {
            name: "android-chrome-192x192.png".to_string(),
            url: format!(
                "{}?v={}",
                state
                    .storage
                    .public_url(&format!("{}/android-chrome-192x192.png", base_path)),
                cache_bust
            ),
            width: 192,
            height: 192,
        },
        FaviconVariant {
            name: "android-chrome-512x512.png".to_string(),
            url: format!(
                "{}?v={}",
                state
                    .storage
                    .public_url(&format!("{}/android-chrome-512x512.png", base_path)),
                cache_bust
            ),
            width: 512,
            height: 512,
        },
    ];

    let theme_color = SiteSetting::get_value(&state.db, site.id, KEY_THEME_COLOR)
        .await?
        .as_str()
        .unwrap_or("#ffffff")
        .to_string();
    let bg_color = SiteSetting::get_value(&state.db, site.id, KEY_BACKGROUND_COLOR)
        .await?
        .as_str()
        .unwrap_or("#ffffff")
        .to_string();

    let json = favicon_service::render_webmanifest(&site.name, &theme_color, &bg_color, &variants);
    Ok((
        [
            (
                CONTENT_TYPE,
                HeaderValue::from_static("application/manifest+json"),
            ),
            (
                CACHE_CONTROL,
                HeaderValue::from_static("public, max-age=3600"),
            ),
        ],
        json,
    ))
}

#[utoipa::path(
    get,
    path = "/sites/{slug}/browserconfig.xml",
    tag = "Sites",
    operation_id = "get_browserconfig",
    description = "Get the browserconfig.xml for IE/Edge tile. Public endpoint.",
    params(("slug" = String, Path, description = "URL-friendly site identifier")),
    responses(
        (status = 200, description = "Browserconfig XML", content_type = "application/xml"),
        (status = 404, description = "Site not found", body = ProblemDetails)
    )
)]
async fn get_browserconfig(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<([(axum::http::HeaderName, HeaderValue); 2], String), ApiError> {
    let site = Site::find_by_slug(&state.db, &slug).await?;
    let base_path = format!("site_favicons/{}", site.id);
    let cache_bust = site.updated_at.timestamp();

    let variants = vec![FaviconVariant {
        name: "android-chrome-192x192.png".to_string(),
        url: format!(
            "{}?v={}",
            state
                .storage
                .public_url(&format!("{}/android-chrome-192x192.png", base_path)),
            cache_bust
        ),
        width: 192,
        height: 192,
    }];

    let xml = favicon_service::render_browserconfig(&variants);
    Ok((
        [
            (CONTENT_TYPE, HeaderValue::from_static("application/xml")),
            (
                CACHE_CONTROL,
                HeaderValue::from_static("public, max-age=3600"),
            ),
        ],
        xml,
    ))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/favicon/download",
    tag = "Sites",
    operation_id = "download_favicon_package",
    description = "Download a complete self-hostable favicon package (icons + site.webmanifest + browserconfig.xml).",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Zip archive of favicon files", content_type = "application/zip"),
        (status = 404, description = "No favicon package generated yet", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn download_favicon(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
) -> Result<([(axum::http::HeaderName, HeaderValue); 2], Vec<u8>), ApiError> {
    let site = Site::find_by_id(&state.db, site_id).await?;
    let base_path = format!("site_favicons/{}", site_id);

    let probe_path = format!("{}/favicon-32x32.png", base_path);
    if !state.storage.exists(&probe_path).await? {
        return Err(
            ApiError::not_found("No favicon package generated yet.".to_string())
                .with_code(codes::RESOURCE_NOT_FOUND),
        );
    }

    let filenames = [
        "favicon.ico",
        "favicon-16x16.png",
        "favicon-32x32.png",
        "apple-touch-icon.png",
        "android-chrome-192x192.png",
        "android-chrome-512x512.png",
    ];

    let theme_color = SiteSetting::get_value(&state.db, site_id, KEY_THEME_COLOR)
        .await?
        .as_str()
        .unwrap_or("#ffffff")
        .to_string();
    let bg_color = SiteSetting::get_value(&state.db, site_id, KEY_BACKGROUND_COLOR)
        .await?
        .as_str()
        .unwrap_or("#ffffff")
        .to_string();

    let self_hosted_variants = vec![
        FaviconVariant {
            name: "android-chrome-192x192.png".to_string(),
            url: "/android-chrome-192x192.png".to_string(),
            width: 192,
            height: 192,
        },
        FaviconVariant {
            name: "android-chrome-512x512.png".to_string(),
            url: "/android-chrome-512x512.png".to_string(),
            width: 512,
            height: 512,
        },
    ];

    let manifest_json = favicon_service::render_webmanifest(
        &site.name,
        &theme_color,
        &bg_color,
        &self_hosted_variants,
    );
    let browserconfig_xml = favicon_service::render_browserconfig(&[FaviconVariant {
        name: "android-chrome-192x192.png".to_string(),
        url: "/android-chrome-192x192.png".to_string(),
        width: 192,
        height: 192,
    }]);

    let mut zip_buf = Vec::new();
    {
        let mut zip = zip::ZipWriter::new(std::io::Cursor::new(&mut zip_buf));
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        for name in &filenames {
            let path = format!("{}/{}", base_path, name);
            if let Ok((data, _content_type)) = state.storage.fetch(&path).await {
                zip.start_file(*name, options).map_err(|e| {
                    ApiError::internal(format!("Zip error: {e}")).with_code(codes::INTERNAL_ERROR)
                })?;
                std::io::Write::write_all(&mut zip, &data).map_err(|e| {
                    ApiError::internal(format!("Zip write error: {e}"))
                        .with_code(codes::INTERNAL_ERROR)
                })?;
            }
        }

        zip.start_file("site.webmanifest", options).map_err(|e| {
            ApiError::internal(format!("Zip error: {e}")).with_code(codes::INTERNAL_ERROR)
        })?;
        std::io::Write::write_all(&mut zip, manifest_json.as_bytes()).map_err(|e| {
            ApiError::internal(format!("Zip write error: {e}")).with_code(codes::INTERNAL_ERROR)
        })?;

        zip.start_file("browserconfig.xml", options).map_err(|e| {
            ApiError::internal(format!("Zip error: {e}")).with_code(codes::INTERNAL_ERROR)
        })?;
        std::io::Write::write_all(&mut zip, browserconfig_xml.as_bytes()).map_err(|e| {
            ApiError::internal(format!("Zip write error: {e}")).with_code(codes::INTERNAL_ERROR)
        })?;

        zip.finish().map_err(|e| {
            ApiError::internal(format!("Zip finalize error: {e}")).with_code(codes::INTERNAL_ERROR)
        })?;
    }

    Ok((
        [
            (CONTENT_TYPE, HeaderValue::from_static("application/zip")),
            (
                CONTENT_DISPOSITION,
                HeaderValue::from_static("attachment; filename=\"favicon-package.zip\""),
            ),
        ],
        zip_buf,
    ))
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(upload_favicon, get_favicon))
        .routes(routes!(download_favicon))
        .routes(routes!(get_webmanifest))
        .routes(routes!(get_browserconfig))
        .layer(DefaultBodyLimit::max(MAX_FAVICON_SIZE))
}
