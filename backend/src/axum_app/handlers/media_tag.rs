//! Axum port of `crate::handlers::media_tag`. Three endpoints for
//! per-media-file tags and per-site tag autocomplete. Mounted under
//! `/api/v1`.
//!
//! First Phase 4 bundle to use `auth.0` destructuring (locale's
//! `AdminKey` was a pure gate; here we need the inner `AuthenticatedKey`
//! for `PermissionService::require`). Same shape every CRUD-with-RBAC
//! bundle that follows uses.

use axum::extract::{Path, Query, State};
use axum::response::Json;
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::dto::media_tag::{MediaTagsResponse, SiteTagsResponse, UpdateMediaTagsRequest};
use crate::dto::validated::ValidatedJson;
use crate::errors::codes;
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::{ReadKey, WriteKey};
use crate::models::media::MediaFile;
use crate::models::media_tag::MediaTag;
use crate::services::permission_service::{Permission, PermissionService};
use crate::AppState;

#[derive(Debug, Deserialize)]
struct SiteTagsQuery {
    prefix: Option<String>,
    limit: Option<i64>,
}

#[utoipa::path(
    get,
    path = "/media/{id}/tags",
    tag = "Media Tags",
    operation_id = "get_media_tags",
    description = "Get all tags for a media file",
    params(("id" = Uuid, Path, description = "The UUID of the media file")),
    responses(
        (status = 200, description = "Tags for the media file", body = MediaTagsResponse),
        (status = 404, description = "Media file not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_media_tags(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<MediaTagsResponse>, ApiError> {
    let site_ids = MediaFile::find_site_ids(&state.db, id).await?;
    for site_id in &site_ids {
        if PermissionService::require(
            &state.db,
            &auth.0,
            *site_id,
            &Permission::new("media", "read"),
        )
        .await
        .is_ok()
        {
            let tags = MediaTag::find_by_media_id(&state.db, id).await?;
            return Ok(Json(MediaTagsResponse { tags }));
        }
    }
    Err(ApiError::forbidden("Insufficient permissions").with_code(codes::FORBIDDEN))
}

#[utoipa::path(
    put,
    path = "/media/{id}/tags",
    tag = "Media Tags",
    operation_id = "update_media_tags",
    description = "Replace all tags on a media file",
    params(("id" = Uuid, Path, description = "The UUID of the media file")),
    request_body = UpdateMediaTagsRequest,
    responses(
        (status = 200, description = "Updated tags", body = MediaTagsResponse),
        (status = 400, description = "Invalid tags", body = ProblemDetails),
        (status = 404, description = "Media file not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn update_media_tags(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<UpdateMediaTagsRequest>,
) -> Result<Json<MediaTagsResponse>, ApiError> {
    MediaFile::find_by_id(&state.db, id).await?;
    let site_ids = MediaFile::find_site_ids(&state.db, id).await?;
    for site_id in &site_ids {
        if PermissionService::require(
            &state.db,
            &auth.0,
            *site_id,
            &Permission::new("media", "update"),
        )
        .await
        .is_ok()
        {
            let tags = MediaTag::replace_for_media(&state.db, id, &body.tags).await?;
            return Ok(Json(MediaTagsResponse { tags }));
        }
    }
    Err(ApiError::forbidden("Insufficient permissions").with_code(codes::FORBIDDEN))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/media-tags",
    tag = "Media Tags",
    operation_id = "get_site_tags",
    description = "Get all distinct tags used on media for a site, with usage counts",
    params(
        ("site_id" = Uuid, Path, description = "The UUID of the site"),
        ("prefix" = Option<String>, Query, description = "Filter tags by prefix (for autocomplete)"),
        ("limit" = Option<i64>, Query, description = "Max number of tags to return (default: 100, max: 200)")
    ),
    responses(
        (status = 200, description = "Site tags with counts", body = SiteTagsResponse),
        (status = 403, description = "Insufficient permissions", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_site_tags(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(params): Query<SiteTagsQuery>,
    auth: ReadKey,
) -> Result<Json<SiteTagsResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("media", "read"),
    )
    .await?;
    let tags =
        MediaTag::find_for_site(&state.db, site_id, params.prefix.as_deref(), params.limit).await?;
    Ok(Json(SiteTagsResponse { tags }))
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(get_media_tags, update_media_tags))
        .routes(routes!(get_site_tags))
}
