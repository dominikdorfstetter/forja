//! Axum port of `crate::handlers::redirect`. Six endpoints for URL
//! redirect CRUD plus an active-redirect lookup. Mounted under `/api/v1`.
//!
//! First Phase 4 bundle to wire `ListParams` (page/page_size/search/
//! sort_by/sort_dir) through `axum::extract::Query`. The same
//! deserialize-into-struct + `ListParams::new(...)` shape will be reused
//! for every paginated read in the remaining bundles.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::Json;
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::dto::redirect::{
    CreateRedirectRequest, PaginatedRedirects, RedirectLookupResponse, RedirectResponse,
    UpdateRedirectRequest,
};
use crate::dto::validated::ValidatedJson;
use crate::errors::{ApiError, ProblemDetails, codes};
use crate::guards::auth_guard::{ReadKey, WriteKey};
use crate::models::audit::AuditAction;
use crate::models::redirect::Redirect;
use crate::services::audited_mutation::AuditedEntity;

/// Redirects audit their mutations without dispatching a webhook.
const REDIRECT: AuditedEntity = AuditedEntity::audit_only("redirect");
use crate::AppState;
use crate::services::permission_service::{Permission, PermissionService};
use crate::utils::list_params::ListParams;

#[derive(Debug, Deserialize)]
struct ListRedirectsQuery {
    page: Option<i64>,
    page_size: Option<i64>,
    search: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LookupQuery {
    path: String,
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/redirects",
    tag = "Redirects",
    operation_id = "list_redirects",
    description = "List all redirects for a site (paginated, with optional search/sort)",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page (default 10, max 100)"),
        ("search" = Option<String>, Query, description = "Search by source_path or destination_path (ILIKE)"),
        ("sort_by" = Option<String>, Query, description = "Sort column: created_at, source_path"),
        ("sort_dir" = Option<String>, Query, description = "Sort direction: asc or desc")
    ),
    responses(
        (status = 200, description = "Paginated redirect list", body = PaginatedRedirects),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_redirects(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<ListRedirectsQuery>,
    auth: ReadKey,
) -> Result<Json<PaginatedRedirects>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("redirect", "read"),
    )
    .await?;
    let params = ListParams::new(q.page, q.page_size, q.search, q.sort_by, q.sort_dir);

    let redirects = Redirect::find_all_for_site_filtered(&state.db, site_id, &params).await?;
    let total = Redirect::count_for_site_filtered(&state.db, site_id, params.search_ref()).await?;

    let items: Vec<RedirectResponse> = redirects.into_iter().map(RedirectResponse::from).collect();
    let paginated = params.paginate(items, total);

    Ok(Json(paginated))
}

#[utoipa::path(
    get,
    path = "/redirects/{id}",
    tag = "Redirects",
    operation_id = "get_redirect",
    description = "Get a redirect by ID",
    params(("id" = Uuid, Path, description = "Redirect UUID")),
    responses(
        (status = 200, description = "Redirect details", body = RedirectResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_redirect(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<RedirectResponse>, ApiError> {
    let redirect = Redirect::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        redirect.site_id,
        &Permission::new("redirect", "read"),
    )
    .await?;
    Ok(Json(RedirectResponse::from(redirect)))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/redirects",
    tag = "Redirects",
    operation_id = "create_redirect",
    description = "Create a new redirect for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = CreateRedirectRequest, description = "Redirect data"),
    responses(
        (status = 201, description = "Redirect created", body = RedirectResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 409, description = "Duplicate source path", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn create_redirect(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<CreateRedirectRequest>,
) -> Result<(StatusCode, Json<RedirectResponse>), ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("redirect", "create"),
    )
    .await?;
    let mut body = body.into_inner();
    body.site_id = site_id;

    if body.source_path == body.destination_path {
        return Err(
            ApiError::bad_request("Source and destination paths must be different")
                .with_code(codes::REDIRECT_SAME_PATH),
        );
    }

    let redirect = Redirect::create(&state.db, body).await?;
    REDIRECT
        .mutate(AuditAction::Create, redirect.id)
        .site(site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;

    Ok((StatusCode::CREATED, Json(RedirectResponse::from(redirect))))
}

#[utoipa::path(
    put,
    path = "/redirects/{id}",
    tag = "Redirects",
    operation_id = "update_redirect",
    description = "Update a redirect",
    params(("id" = Uuid, Path, description = "Redirect UUID")),
    request_body(content = UpdateRedirectRequest, description = "Redirect update data"),
    responses(
        (status = 200, description = "Redirect updated", body = RedirectResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails),
        (status = 409, description = "Duplicate source path", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn update_redirect(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<UpdateRedirectRequest>,
) -> Result<Json<RedirectResponse>, ApiError> {
    let existing = Redirect::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        existing.site_id,
        &Permission::new("redirect", "update"),
    )
    .await?;

    let effective_source = body.source_path.as_deref().unwrap_or(&existing.source_path);
    let effective_dest = body
        .destination_path
        .as_deref()
        .unwrap_or(&existing.destination_path);
    if effective_source == effective_dest {
        return Err(
            ApiError::bad_request("Source and destination paths must be different")
                .with_code(codes::REDIRECT_SAME_PATH),
        );
    }

    let redirect = Redirect::update(&state.db, id, body.into_inner()).await?;
    REDIRECT
        .mutate(AuditAction::Update, id)
        .site(existing.site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;

    Ok(Json(RedirectResponse::from(redirect)))
}

#[utoipa::path(
    delete,
    path = "/redirects/{id}",
    tag = "Redirects",
    operation_id = "delete_redirect",
    description = "Delete a redirect",
    params(("id" = Uuid, Path, description = "Redirect UUID")),
    responses(
        (status = 204, description = "Redirect deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn delete_redirect(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
) -> Result<StatusCode, ApiError> {
    let redirect = Redirect::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        redirect.site_id,
        &Permission::new("redirect", "delete"),
    )
    .await?;

    Redirect::delete(&state.db, id).await?;
    REDIRECT
        .mutate(AuditAction::Delete, id)
        .site(redirect.site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/redirects/lookup",
    tag = "Redirects",
    operation_id = "lookup_redirect",
    description = "Lookup an active redirect by source path for a site",
    params(
        ("site_id" = Uuid, Path, description = "The UUID of the site"),
        ("path" = String, Query, description = "Source path to look up a redirect for (e.g. /old-page)")
    ),
    responses(
        (status = 200, description = "Redirect found", body = RedirectLookupResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails),
        (status = 404, description = "Redirect not found for the given path", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn lookup_redirect(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<LookupQuery>,
    auth: ReadKey,
) -> Result<Json<RedirectLookupResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("redirect", "read"),
    )
    .await?;

    let redirect = Redirect::find_by_source_path(&state.db, site_id, &q.path)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("No active redirect for path '{}'", q.path))
                .with_code(codes::RESOURCE_NOT_FOUND)
        })?;

    Ok(Json(RedirectLookupResponse {
        destination_path: redirect.destination_path,
        status_code: redirect.status_code,
    }))
}

/// `/sites/{site_id}/redirects/lookup` is registered before
/// `/redirects/{id}` so the literal `lookup` segment beats `{id}` even
/// though matchit would resolve it correctly either way.
pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_redirects, create_redirect))
        .routes(routes!(lookup_redirect))
        .routes(routes!(get_redirect, update_redirect, delete_redirect))
}
