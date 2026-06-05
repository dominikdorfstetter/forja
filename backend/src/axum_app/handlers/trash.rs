//! Axum port of `crate::handlers::trash`. 4 endpoints for soft-deleted
//! content management — list/count plus restore/permanent-delete with
//! per-entity-type permission resolution.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::Json;
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::dto::trash::{TrashCountResponse, TrashListResponse};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::{AdminKey, ReadKey, WriteKey};
use crate::repos::trash_repo::TrashRepo;
use crate::services::permission_service::{Permission, PermissionService};
use crate::services::trash_service;
use crate::utils::list_params::ListParams;
use crate::AppState;

#[derive(Debug, Deserialize)]
struct EntityTypeQuery {
    entity_type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ListTrashQuery {
    page: Option<i64>,
    page_size: Option<i64>,
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/trash",
    tag = "Trash",
    operation_id = "list_trash",
    description = "List soft-deleted content items for a site (blogs, pages, projects, cv entries, skills, media, documents, legal, social, menu, menu_item). Paginated: returns one bounded page plus the site-wide total.",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page (default 10, max 100)")
    ),
    responses(
        (status = 200, description = "Trash items", body = TrashListResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_trash(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<ListTrashQuery>,
    auth: ReadKey,
) -> Result<Json<TrashListResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("blog", "read"),
    )
    .await?;

    let params = ListParams::new(q.page, q.page_size, None, None, None);
    let (limit, offset) = params.limit_offset();

    // `total` is the site-wide count, not `items.len()` — the page is bounded,
    // so the length only reflects this page, never the full trash.
    let items = TrashRepo::list(&state.db, site_id, limit, offset).await?;
    let total = TrashRepo::count(&state.db, site_id).await?;
    Ok(Json(TrashListResponse { items, total }))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/trash/count",
    tag = "Trash",
    operation_id = "get_trash_count",
    description = "Get count of soft-deleted items for a site including blogs, pages, projects, cv entries, skills, media, documents, legal, social, menu, menu_item (for sidebar badge)",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Trash count", body = TrashCountResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_trash_count(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<TrashCountResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("blog", "read"),
    )
    .await?;

    let count = TrashRepo::count(&state.db, site_id).await?;
    Ok(Json(TrashCountResponse { count }))
}

#[utoipa::path(
    post,
    path = "/trash/{id}/restore",
    tag = "Trash",
    operation_id = "restore_trash_item",
    description = "Restore a soft-deleted item from trash",
    params(
        ("id" = Uuid, Path, description = "Item UUID"),
        ("entity_type" = Option<String>, Query, description = "Entity type: blog, page, project, cv_entry, skill, media, document, legal, social, menu, menu_item")
    ),
    responses(
        (status = 204, description = "Item restored"),
        (status = 400, description = "Item not in trash", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn restore_trash_item(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(q): Query<EntityTypeQuery>,
    auth: WriteKey,
) -> Result<StatusCode, ApiError> {
    let entity = q.entity_type.as_deref().unwrap_or("content");
    trash_service::restore(&state.db, &auth.0, entity, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/trash/{id}",
    tag = "Trash",
    operation_id = "permanent_delete_trash_item",
    description = "Permanently delete a soft-deleted item (cannot be undone)",
    params(
        ("id" = Uuid, Path, description = "Item UUID"),
        ("entity_type" = Option<String>, Query, description = "Entity type: blog, page, project, cv_entry, skill, media, document, legal, social, menu, menu_item")
    ),
    responses(
        (status = 204, description = "Item permanently deleted"),
        (status = 400, description = "Item not in trash", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn permanent_delete_trash_item(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(q): Query<EntityTypeQuery>,
    auth: AdminKey,
) -> Result<StatusCode, ApiError> {
    let entity = q.entity_type.as_deref().unwrap_or("content");
    trash_service::permanent_delete(&state.db, &auth.0, &state.storage, entity, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_trash))
        .routes(routes!(get_trash_count))
        .routes(routes!(restore_trash_item))
        .routes(routes!(permanent_delete_trash_item))
}
