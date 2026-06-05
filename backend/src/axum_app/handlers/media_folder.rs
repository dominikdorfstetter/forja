//! Axum port of `crate::handlers::media_folder`. Four endpoints (list,
//! create, update, delete) gated by RBAC permission checks. Mounted under
//! `/api/v1`. Establishes the per-site CRUD shape with `WriteKey` +
//! `PermissionService::require`.

use crate::dto::media_folder::{
    CreateMediaFolderRequest, MediaFolderResponse, UpdateMediaFolderRequest,
};
use crate::dto::validated::ValidatedJson;
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::{ReadKey, WriteKey};
use crate::models::media_folder::MediaFolder;
use crate::services::permission_service::{Permission, PermissionService};
use crate::AppState;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::Json;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

#[utoipa::path(
    get,
    path = "/sites/{site_id}/media-folders",
    tag = "Media",
    operation_id = "list_media_folders",
    description = "List all media folders for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "List of media folders", body = Vec<MediaFolderResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_media_folders(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<Vec<MediaFolderResponse>>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("media", "read"),
    )
    .await?;
    let folders = MediaFolder::find_all_for_site(&state.db, site_id).await?;
    let responses: Vec<MediaFolderResponse> =
        folders.into_iter().map(MediaFolderResponse::from).collect();
    Ok(Json(responses))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/media-folders",
    tag = "Media",
    operation_id = "create_media_folder",
    description = "Create a media folder",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = CreateMediaFolderRequest, description = "Folder data"),
    responses(
        (status = 201, description = "Folder created", body = MediaFolderResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn create_media_folder(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<CreateMediaFolderRequest>,
) -> Result<(StatusCode, Json<MediaFolderResponse>), ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("media", "create"),
    )
    .await?;
    let folder = MediaFolder::create(&state.db, site_id, body.into_inner()).await?;
    Ok((StatusCode::CREATED, Json(MediaFolderResponse::from(folder))))
}

#[utoipa::path(
    put,
    path = "/media-folders/{id}",
    tag = "Media",
    operation_id = "update_media_folder",
    description = "Update a media folder",
    params(("id" = Uuid, Path, description = "Folder UUID")),
    request_body(content = UpdateMediaFolderRequest, description = "Folder update data"),
    responses(
        (status = 200, description = "Folder updated", body = MediaFolderResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn update_media_folder(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<UpdateMediaFolderRequest>,
) -> Result<Json<MediaFolderResponse>, ApiError> {
    let existing = MediaFolder::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        existing.site_id,
        &Permission::new("media", "update"),
    )
    .await?;

    let folder = MediaFolder::update(&state.db, id, body.into_inner()).await?;
    Ok(Json(MediaFolderResponse::from(folder)))
}

#[utoipa::path(
    delete,
    path = "/media-folders/{id}",
    tag = "Media",
    operation_id = "delete_media_folder",
    description = "Delete a media folder",
    params(("id" = Uuid, Path, description = "Folder UUID")),
    responses(
        (status = 204, description = "Folder deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn delete_media_folder(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
) -> Result<StatusCode, ApiError> {
    let existing = MediaFolder::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        existing.site_id,
        &Permission::new("media", "delete"),
    )
    .await?;

    MediaFolder::delete(&state.db, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_media_folders, create_media_folder))
        .routes(routes!(update_media_folder, delete_media_folder))
}
