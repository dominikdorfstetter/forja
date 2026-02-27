//! Media folder handlers

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;
use validator::Validate;

use crate::dto::media_folder::{
    CreateMediaFolderRequest, MediaFolderResponse, UpdateMediaFolderRequest,
};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::models::media_folder::MediaFolder;
use crate::models::site_membership::SiteRole;
use crate::AppState;

/// List media folders for a site
#[utoipa::path(
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
#[get("/sites/<site_id>/media-folders")]
pub async fn list_media_folders(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
) -> Result<Json<Vec<MediaFolderResponse>>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let folders = MediaFolder::find_all_for_site(&state.db, site_id).await?;
    let responses: Vec<MediaFolderResponse> =
        folders.into_iter().map(MediaFolderResponse::from).collect();
    Ok(Json(responses))
}

/// Create a media folder
#[utoipa::path(
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
#[post("/sites/<site_id>/media-folders", data = "<body>")]
pub async fn create_media_folder(
    state: &State<AppState>,
    site_id: Uuid,
    body: Json<CreateMediaFolderRequest>,
    auth: ReadKey,
) -> Result<(Status, Json<MediaFolderResponse>), ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Author)
        .await?;
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let folder = MediaFolder::create(&state.db, site_id, req).await?;
    Ok((Status::Created, Json(MediaFolderResponse::from(folder))))
}

/// Update a media folder
#[utoipa::path(
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
#[put("/media-folders/<id>", data = "<body>")]
pub async fn update_media_folder(
    state: &State<AppState>,
    id: Uuid,
    body: Json<UpdateMediaFolderRequest>,
    auth: ReadKey,
) -> Result<Json<MediaFolderResponse>, ApiError> {
    let existing = MediaFolder::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, existing.site_id, &SiteRole::Author)
        .await?;

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let folder = MediaFolder::update(&state.db, id, req).await?;
    Ok(Json(MediaFolderResponse::from(folder)))
}

/// Delete a media folder
#[utoipa::path(
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
#[delete("/media-folders/<id>")]
pub async fn delete_media_folder(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    let existing = MediaFolder::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, existing.site_id, &SiteRole::Editor)
        .await?;

    MediaFolder::delete(&state.db, id).await?;
    Ok(Status::NoContent)
}

/// Collect media folder routes
pub fn routes() -> Vec<Route> {
    routes![
        list_media_folders,
        create_media_folder,
        update_media_folder,
        delete_media_folder
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 4, "Should have 4 media folder routes");
    }
}
