//! Axum port of `crate::handlers::files`. Public, no-auth proxy that
//! streams stored files (S3 or local) by their backend path. Mounted at
//! the root, so the public path is `/files/{*path}` — matches Rocket's
//! `mount("/", handlers::files::routes())`.
//!
//! Path-traversal hardening lives in `services::storage` (the
//! `validated_path` helper rejects `..` / absolute / prefix segments
//! with `403 Forbidden`), so this handler can forward the raw catch-all
//! string straight through.

use axum::body::Body;
use axum::extract::{Path, State};
use axum::http::{HeaderValue, Response, StatusCode, header};
use axum::response::IntoResponse;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

use crate::AppState;

/// Carries fetched bytes plus their MIME type into an Axum response,
/// pinning cache headers and forcing SVGs to download (defence against
/// stored XSS via embedded `<script>` in SVG).
pub struct FileResponse {
    pub data: Vec<u8>,
    pub content_type: String,
}

impl FileResponse {
    /// SVGs render inline by default in browsers, which makes them an
    /// XSS vector if user-uploaded. Force `attachment` to neutralize.
    fn is_svg(&self) -> bool {
        self.content_type.starts_with("image/svg")
    }
}

impl IntoResponse for FileResponse {
    fn into_response(self) -> Response<Body> {
        let content_type = HeaderValue::from_str(&self.content_type)
            .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream"));

        let mut builder = Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, content_type)
            .header(
                header::CACHE_CONTROL,
                HeaderValue::from_static("public, max-age=31536000, immutable"),
            );

        if self.is_svg() {
            builder = builder.header(
                header::CONTENT_DISPOSITION,
                HeaderValue::from_static("attachment"),
            );
        }

        builder
            .body(Body::from(self.data))
            .expect("static headers + bytes body never fail")
    }
}

#[utoipa::path(
    get,
    path = "/files/{*path}",
    tag = "Files",
    operation_id = "serve_file",
    description = "Public proxy for files stored in the configured storage backend (S3 or local). Streams bytes with long-lived cache headers; SVGs are returned with `Content-Disposition: attachment` to defuse stored XSS.",
    params(("path" = String, Path, description = "Storage backend path, multi-segment (e.g. `media/2026/05/foo.png`).")),
    responses(
        (status = 200, description = "File bytes", content_type = "application/octet-stream"),
        (status = 404, description = "File not found")
    )
)]
async fn serve_file(
    State(state): State<AppState>,
    Path(path): Path<String>,
) -> Result<FileResponse, StatusCode> {
    let (data, content_type) = state
        .storage
        .fetch(&path)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(FileResponse { data, content_type })
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(routes!(serve_file))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn svg_content_type_is_recognized() {
        let r = FileResponse {
            data: b"<svg></svg>".to_vec(),
            content_type: "image/svg+xml".to_string(),
        };
        assert!(r.is_svg());
    }

    #[test]
    fn png_is_not_svg() {
        let r = FileResponse {
            data: vec![0x89, 0x50, 0x4E, 0x47],
            content_type: "image/png".to_string(),
        };
        assert!(!r.is_svg());
    }

    /// Verifies SVG responses get `Content-Disposition: attachment` to
    /// suppress inline rendering — the security-critical part.
    #[test]
    fn svg_response_sets_content_disposition_attachment() {
        let r = FileResponse {
            data: b"<svg/>".to_vec(),
            content_type: "image/svg+xml".to_string(),
        };
        let response = r.into_response();
        let cd = response
            .headers()
            .get(header::CONTENT_DISPOSITION)
            .and_then(|v| v.to_str().ok());
        assert_eq!(cd, Some("attachment"));
    }

    #[test]
    fn non_svg_response_omits_content_disposition() {
        let r = FileResponse {
            data: vec![0x00],
            content_type: "image/png".to_string(),
        };
        let response = r.into_response();
        assert!(
            response
                .headers()
                .get(header::CONTENT_DISPOSITION)
                .is_none()
        );
    }

    #[test]
    fn response_sets_immutable_cache_control() {
        let r = FileResponse {
            data: vec![0x00],
            content_type: "image/png".to_string(),
        };
        let response = r.into_response();
        let cc = response
            .headers()
            .get(header::CACHE_CONTROL)
            .and_then(|v| v.to_str().ok());
        assert_eq!(cc, Some("public, max-age=31536000, immutable"));
    }
}
