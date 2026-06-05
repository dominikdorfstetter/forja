//! Axum port of `crate::handlers::content_template`. Five endpoints for
//! per-site content template CRUD. Mounted under `/api/v1`. Pure
//! application of the media_folder shape.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::Json;
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::dto::content_template::{
    ContentTemplateResponse, CreateContentTemplateRequest, PaginatedContentTemplates,
    UpdateContentTemplateRequest,
};
use crate::dto::validated::ValidatedJson;
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::{ReadKey, WriteKey};
use crate::models::audit::AuditAction;
use crate::models::content_template::ContentTemplate;
use crate::services::audited_mutation::AuditedEntity;
use crate::services::permission_service::{Permission, PermissionService};
use crate::utils::list_params::ListParams;
use crate::AppState;

#[derive(Debug, Deserialize)]
struct ListTemplatesQuery {
    page: Option<i64>,
    page_size: Option<i64>,
    search: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/content-templates",
    tag = "Content Templates",
    operation_id = "list_content_templates",
    description = "List all content templates for a site (paginated, searchable, sortable)",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default: 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page (default: 10)"),
        ("search" = Option<String>, Query, description = "Search by name or description (ILIKE)"),
        ("sort_by" = Option<String>, Query, description = "Sort field: name (default), created_at"),
        ("sort_dir" = Option<String>, Query, description = "Sort direction: asc, desc (default)")
    ),
    responses(
        (status = 200, description = "Paginated content template list", body = PaginatedContentTemplates),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_content_templates(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<ListTemplatesQuery>,
    auth: ReadKey,
) -> Result<Json<PaginatedContentTemplates>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("template", "read"),
    )
    .await?;
    let params = ListParams::new(q.page, q.page_size, q.search, q.sort_by, q.sort_dir);
    let templates =
        ContentTemplate::find_all_for_site_filtered(&state.db, site_id, &params).await?;
    let total =
        ContentTemplate::count_for_site_filtered(&state.db, site_id, params.search_ref()).await?;

    let items: Vec<ContentTemplateResponse> = templates
        .into_iter()
        .map(ContentTemplateResponse::from)
        .collect();

    Ok(Json(params.paginate(items, total)))
}

#[utoipa::path(
    get,
    path = "/content-templates/{id}",
    tag = "Content Templates",
    operation_id = "get_content_template",
    description = "Get a content template by ID",
    params(("id" = Uuid, Path, description = "Content template UUID")),
    responses(
        (status = 200, description = "Content template details", body = ContentTemplateResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_content_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<ContentTemplateResponse>, ApiError> {
    let template = ContentTemplate::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        template.site_id,
        &Permission::new("template", "read"),
    )
    .await?;
    Ok(Json(ContentTemplateResponse::from(template)))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/content-templates",
    tag = "Content Templates",
    operation_id = "create_content_template",
    description = "Create a new content template for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = CreateContentTemplateRequest, description = "Content template data"),
    responses(
        (status = 201, description = "Content template created", body = ContentTemplateResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 409, description = "Duplicate template name", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn create_content_template(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<CreateContentTemplateRequest>,
) -> Result<(StatusCode, Json<ContentTemplateResponse>), ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("template", "create"),
    )
    .await?;
    let mut body = body.into_inner();
    body.site_id = site_id;

    let template = ContentTemplate::create(&state.db, body).await?;
    AuditedEntity::audit_only("content_template")
        .mutate(AuditAction::Create, template.id)
        .site(site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;

    Ok((
        StatusCode::CREATED,
        Json(ContentTemplateResponse::from(template)),
    ))
}

#[utoipa::path(
    put,
    path = "/content-templates/{id}",
    tag = "Content Templates",
    operation_id = "update_content_template",
    description = "Update a content template",
    params(("id" = Uuid, Path, description = "Content template UUID")),
    request_body(content = UpdateContentTemplateRequest, description = "Content template update data"),
    responses(
        (status = 200, description = "Content template updated", body = ContentTemplateResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn update_content_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<UpdateContentTemplateRequest>,
) -> Result<Json<ContentTemplateResponse>, ApiError> {
    let existing = ContentTemplate::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        existing.site_id,
        &Permission::new("template", "update"),
    )
    .await?;

    let template = ContentTemplate::update(&state.db, id, body.into_inner()).await?;
    AuditedEntity::audit_only("content_template")
        .mutate(AuditAction::Update, id)
        .site(existing.site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;

    Ok(Json(ContentTemplateResponse::from(template)))
}

#[utoipa::path(
    delete,
    path = "/content-templates/{id}",
    tag = "Content Templates",
    operation_id = "delete_content_template",
    description = "Delete a content template",
    params(("id" = Uuid, Path, description = "Content template UUID")),
    responses(
        (status = 204, description = "Content template deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn delete_content_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
) -> Result<StatusCode, ApiError> {
    let template = ContentTemplate::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        template.site_id,
        &Permission::new("template", "delete"),
    )
    .await?;

    ContentTemplate::delete(&state.db, id).await?;
    AuditedEntity::audit_only("content_template")
        .mutate(AuditAction::Delete, id)
        .site(template.site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;

    Ok(StatusCode::NO_CONTENT)
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_content_templates, create_content_template))
        .routes(routes!(
            get_content_template,
            update_content_template,
            delete_content_template
        ))
}
