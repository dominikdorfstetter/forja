//! Axum port of `crate::handlers::project`. 10 endpoints for project
//! CRUD, public listing, review, bulk ops, reorder. Mounted under
//! `/api/v1`.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::Json;
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::axum_app::authorized_content::{
    AuthorizedContent, AuthorizedJson, AuthorizedSite, Create, Delete, Read, Update,
};
use crate::axum_app::extractors::ResolveLocale;
use crate::dto::bulk::{BulkAction, BulkContentRequest, BulkContentResponse};
use crate::dto::project::{
    CreateProjectRequest, PaginatedProjects, ProjectDetailResponse, ProjectLinkResponse,
    ProjectLocalizationResponse, ProjectMediaResponse, ProjectResponse, ReorderProjectsRequest,
    UpdateProjectRequest,
};
use crate::dto::review::{ReviewActionRequest, ReviewActionResponse};
use crate::dto::validated::ValidatedJson;
use crate::errors::{codes, ApiError, ProblemDetails};
use crate::guards::auth_guard::WriteKey;
use crate::guards::module_guard::{ModuleGuard, PortfolioModule};
use crate::models::project::ProjectWithContent;
use crate::repos::project_repo::ProjectRepo;
use crate::services::bulk_content_service::BulkContentService;
use crate::services::content_lifecycle;
use crate::services::permission_service::{Permission, PermissionService};
use crate::services::review_service::{ReviewContext, ReviewService};
use crate::utils::list_params::ListParams;
use crate::utils::locale_resolver::{collapse_localizations, pick_one, resolve_ids_for_site};
use crate::AppState;

#[derive(Debug, Deserialize)]
struct ListProjectsQuery {
    page: Option<i64>,
    page_size: Option<i64>,
    search: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
    status: Option<String>,
    is_featured: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct ListPublishedQuery {
    page: Option<i64>,
    page_size: Option<i64>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
    is_featured: Option<bool>,
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/projects",
    tag = "Projects",
    operation_id = "list_projects",
    description = "List all projects for a site (paginated, with optional search/filter/sort)",
    params(
        ("site_id" = Uuid, Path, description = "The UUID of the site"),
        ("page" = Option<i64>, Query, description = "Page number, 1-indexed (default: 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page, 1–100 (default: 10)"),
        ("search" = Option<String>, Query, description = "Search by project slug (case-insensitive partial match)"),
        ("sort_by" = Option<String>, Query, description = "Sort field: slug, display_order, status, start_date, created_at (default: display_order)"),
        ("sort_dir" = Option<String>, Query, description = "Sort direction: asc or desc (default: asc)"),
        ("status" = Option<String>, Query, description = "Filter by content status: Draft, InReview, Scheduled, Published, Archived"),
        ("is_featured" = Option<bool>, Query, description = "Filter by featured flag"),
        ("locale" = Option<String>, Query, description = "Optional locale code (e.g. `en`, `de-AT`). When set, each project's `localizations[]` collapses to one element resolved via the site's locale chain (ADR 0002). Omit to return all localizations.")
    ),
    responses(
        (status = 200, description = "Paginated project list", body = PaginatedProjects),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_projects(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<ListProjectsQuery>,
    locale: ResolveLocale,
    _access: AuthorizedSite<ProjectWithContent, Read>,
) -> Result<Json<PaginatedProjects>, ApiError> {
    let params = ListParams::new(q.page, q.page_size, q.search, q.sort_by, q.sort_dir);
    let projects = ProjectRepo::find_all_for_site_filtered(
        &state.db,
        site_id,
        &params,
        q.status.as_deref(),
        q.is_featured,
    )
    .await?;
    let total = ProjectRepo::count_for_site_filtered(
        &state.db,
        site_id,
        params.search_ref(),
        q.status.as_deref(),
        q.is_featured,
    )
    .await?;

    let mut items = hydrate_project_list(&state.db, projects).await?;
    apply_locale_to_list(&mut items, &locale, &state.db, site_id).await?;
    Ok(Json(params.paginate(items, total)))
}

/// Apply ADR 0002 §1 resolver to each item's `localizations[]` when
/// `?locale=` is present. No-op (and zero extra SQL) when the param is
/// absent — the response keeps every localization, as before.
async fn apply_locale_to_list(
    items: &mut [ProjectResponse],
    locale: &ResolveLocale,
    pool: &sqlx::PgPool,
    site_id: Uuid,
) -> Result<(), ApiError> {
    let Some(resolution) = resolve_ids_for_site(locale.0.as_deref(), pool, site_id).await? else {
        return Ok(());
    };
    for item in items.iter_mut() {
        let locs = std::mem::take(&mut item.localizations);
        item.localizations = pick_one(locs, |l| l.locale_id, resolution);
    }
    Ok(())
}

/// Bulk-hydrate a page of projects with `skill_ids[]` and `localizations[]`
/// using one SQL round-trip per association (two queries total, regardless
/// of page size — no N+1). Missing entries are empty vecs, never `null`.
async fn hydrate_project_list(
    pool: &sqlx::PgPool,
    projects: Vec<ProjectWithContent>,
) -> Result<Vec<ProjectResponse>, ApiError> {
    let ids: Vec<Uuid> = projects.iter().map(|p| p.id).collect();
    let mut skills = ProjectRepo::skill_ids_for_projects(pool, &ids).await?;

    let loc_rows = ProjectRepo::find_localizations_for_project_ids(pool, &ids).await?;
    let mut localizations: std::collections::HashMap<Uuid, Vec<ProjectLocalizationResponse>> =
        std::collections::HashMap::new();
    for row in loc_rows {
        localizations
            .entry(row.project_id)
            .or_default()
            .push(ProjectLocalizationResponse::from(row));
    }

    Ok(projects
        .into_iter()
        .map(|p| {
            let id = p.id;
            ProjectResponse::from(p)
                .with_skill_ids(skills.remove(&id).unwrap_or_default())
                .with_localizations(localizations.remove(&id).unwrap_or_default())
        })
        .collect())
}

/// Build the lightweight `ProjectResponse` for a single project: hydrate
/// `skill_ids[]` + `localizations[]` (matching the list-item shape) and
/// collapse localizations when `?locale=` is set (ADR 0002). Shared by the
/// lightweight `/projects/{id}` route and the `/projects/{id}/detail` route,
/// which layers the relational graph (`links`/`media`/`cv_entry_ids`) on top
/// (ADR 0001 / ADR 0003).
async fn load_project_response(
    state: &AppState,
    id: Uuid,
    project: ProjectWithContent,
    site_id: Uuid,
    locale: &ResolveLocale,
) -> Result<ProjectResponse, ApiError> {
    let localizations = ProjectRepo::get_localizations(&state.db, id).await?;
    let skill_ids = ProjectRepo::get_skill_ids(&state.db, id).await?;

    let mut response = ProjectResponse::from(project)
        .with_skill_ids(skill_ids)
        .with_localizations(
            localizations
                .into_iter()
                .map(ProjectLocalizationResponse::from)
                .collect(),
        );
    response.localizations = collapse_localizations(
        &state.db,
        site_id,
        locale.0.as_deref(),
        response.localizations,
        |l| l.locale_id,
    )
    .await?;
    Ok(response)
}

#[utoipa::path(
    get,
    path = "/projects/{id}",
    tag = "Projects",
    operation_id = "get_project",
    description = "Get a project by ID (lightweight list shape; see GET /projects/{id}/detail for links/media/cv_entry_ids — ADR 0001 / ADR 0003)",
    params(
        ("id" = Uuid, Path, description = "The UUID of the project"),
        ("locale" = Option<String>, Query, description = "Optional locale code. When set, `localizations[]` collapses to one resolved element (ADR 0002).")
    ),
    responses(
        (status = 200, description = "Project (lightweight)", body = ProjectResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions", body = ProblemDetails),
        (status = 404, description = "Project not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_project(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    locale: ResolveLocale,
    access: AuthorizedContent<ProjectWithContent, Read>,
) -> Result<Json<ProjectResponse>, ApiError> {
    let site_id = access.primary_site_id;
    let response = load_project_response(&state, id, access.entity, site_id, &locale).await?;
    Ok(Json(response))
}

#[utoipa::path(
    get,
    path = "/projects/{id}/detail",
    tag = "Projects",
    operation_id = "get_project_detail",
    description = "Get a project with its full relational graph: list-shape fields plus links, media, cv_entry_ids (ADR 0001 / ADR 0003)",
    params(
        ("id" = Uuid, Path, description = "The UUID of the project"),
        ("locale" = Option<String>, Query, description = "Optional locale code. When set, `localizations[]` collapses to one resolved element (ADR 0002).")
    ),
    responses(
        (status = 200, description = "Project detail", body = ProjectDetailResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions", body = ProblemDetails),
        (status = 404, description = "Project not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_project_detail(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    locale: ResolveLocale,
    access: AuthorizedContent<ProjectWithContent, Read>,
) -> Result<Json<ProjectDetailResponse>, ApiError> {
    let site_id = access.primary_site_id;

    let links = ProjectRepo::get_links(&state.db, id).await?;
    let media = ProjectRepo::get_media(&state.db, id).await?;
    let cv_entry_ids = ProjectRepo::get_cv_entry_ids(&state.db, id).await?;

    let response = load_project_response(&state, id, access.entity, site_id, &locale).await?;

    Ok(Json(ProjectDetailResponse {
        project: response,
        links: links.into_iter().map(ProjectLinkResponse::from).collect(),
        media: media.into_iter().map(ProjectMediaResponse::from).collect(),
        cv_entry_ids,
    }))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/projects/by-slug/{slug}",
    tag = "Projects",
    operation_id = "get_project_by_slug",
    description = "Get a project by slug within a site",
    params(
        ("site_id" = Uuid, Path, description = "The UUID of the site"),
        ("slug" = String, Path, description = "URL-friendly identifier (lowercase, hyphens only)"),
        ("locale" = Option<String>, Query, description = "Optional locale code. When set, `localizations[]` collapses to one resolved element (ADR 0002).")
    ),
    responses(
        (status = 200, description = "Project details", body = ProjectDetailResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions", body = ProblemDetails),
        (status = 404, description = "Project not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_project_by_slug(
    State(state): State<AppState>,
    Path((site_id, slug)): Path<(Uuid, String)>,
    locale: ResolveLocale,
    _access: AuthorizedSite<ProjectWithContent, Read>,
) -> Result<Json<ProjectDetailResponse>, ApiError> {
    let suffix = format!(
        "projects:by-slug:{slug}:loc:{}",
        locale.0.as_deref().unwrap_or("all")
    );
    let response = crate::services::response_cache::cached(
        &state.redis,
        &crate::services::response_cache::key(site_id, &suffix),
        || async {
            let project = ProjectRepo::find_by_slug(&state.db, site_id, &slug).await?;
            let id = project.id;

            let localizations = ProjectRepo::get_localizations(&state.db, id).await?;
            let links = ProjectRepo::get_links(&state.db, id).await?;
            let media = ProjectRepo::get_media(&state.db, id).await?;
            let skill_ids = ProjectRepo::get_skill_ids(&state.db, id).await?;
            let cv_entry_ids = ProjectRepo::get_cv_entry_ids(&state.db, id).await?;

            let mut project_resp = ProjectResponse::from(project)
                .with_skill_ids(skill_ids)
                .with_localizations(
                    localizations
                        .into_iter()
                        .map(ProjectLocalizationResponse::from)
                        .collect(),
                );
            project_resp.localizations = collapse_localizations(
                &state.db,
                site_id,
                locale.0.as_deref(),
                project_resp.localizations,
                |l| l.locale_id,
            )
            .await?;

            Ok(ProjectDetailResponse {
                project: project_resp,
                links: links.into_iter().map(ProjectLinkResponse::from).collect(),
                media: media.into_iter().map(ProjectMediaResponse::from).collect(),
                cv_entry_ids,
            })
        },
    )
    .await?;
    Ok(Json(response))
}

#[utoipa::path(
    post,
    path = "/projects",
    tag = "Projects",
    operation_id = "create_project",
    description = "Create a new project",
    request_body(content = CreateProjectRequest, description = "Project creation data"),
    responses(
        (status = 201, description = "Project created", body = ProjectResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn create_project(
    State(state): State<AppState>,
    access: AuthorizedJson<ProjectWithContent, CreateProjectRequest, Create>,
) -> Result<(StatusCode, Json<ProjectResponse>), ApiError> {
    let project = content_lifecycle::create::<ProjectWithContent>(
        &state.db,
        access.validated.into_inner(),
        &access.actor,
    )
    .await?;
    let id = project.id;
    let skill_ids = ProjectRepo::get_skill_ids(&state.db, id).await?;
    let localizations = ProjectRepo::get_localizations(&state.db, id).await?;
    let response = ProjectResponse::from(project)
        .with_skill_ids(skill_ids)
        .with_localizations(
            localizations
                .into_iter()
                .map(ProjectLocalizationResponse::from)
                .collect(),
        );
    Ok((StatusCode::CREATED, Json(response)))
}

#[utoipa::path(
    put,
    path = "/projects/{id}",
    tag = "Projects",
    operation_id = "update_project",
    description = "Update a project",
    params(("id" = Uuid, Path, description = "Project UUID")),
    request_body(content = UpdateProjectRequest, description = "Project update data"),
    responses(
        (status = 200, description = "Project updated", body = ProjectResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Project not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn update_project(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContent<ProjectWithContent, Update>,
    ValidatedJson(body): ValidatedJson<UpdateProjectRequest>,
) -> Result<Json<ProjectResponse>, ApiError> {
    let project = content_lifecycle::update::<ProjectWithContent>(
        &state.db,
        id,
        body.into_inner(),
        access.entity,
        access.site_ids,
        &access.actor,
    )
    .await?;
    let pid = project.id;
    let skill_ids = ProjectRepo::get_skill_ids(&state.db, pid).await?;
    let localizations = ProjectRepo::get_localizations(&state.db, pid).await?;
    let response = ProjectResponse::from(project)
        .with_skill_ids(skill_ids)
        .with_localizations(
            localizations
                .into_iter()
                .map(ProjectLocalizationResponse::from)
                .collect(),
        );
    Ok(Json(response))
}

#[utoipa::path(
    delete,
    path = "/projects/{id}",
    tag = "Projects",
    operation_id = "delete_project",
    description = "Soft delete a project",
    params(("id" = Uuid, Path, description = "Project UUID")),
    responses(
        (status = 204, description = "Project deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Project not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn delete_project(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContent<ProjectWithContent, Delete>,
) -> Result<StatusCode, ApiError> {
    content_lifecycle::project::delete(
        &state.db,
        id,
        access.entity,
        access.site_ids,
        &access.actor,
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/projects/public",
    tag = "Projects",
    operation_id = "list_published_projects",
    description = "List published projects for a site (public-facing)",
    params(
        ("site_id" = Uuid, Path, description = "The UUID of the site"),
        ("page" = Option<i64>, Query, description = "Page number, 1-indexed (default: 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page, 1–100 (default: 10)"),
        ("sort_by" = Option<String>, Query, description = "Sort field: display_order, start_date, created_at (default: display_order)"),
        ("sort_dir" = Option<String>, Query, description = "Sort direction: asc or desc (default: asc)"),
        ("is_featured" = Option<bool>, Query, description = "Filter by featured flag"),
        ("locale" = Option<String>, Query, description = "Optional locale code. When set, each project's `localizations[]` collapses to one resolved element (ADR 0002).")
    ),
    responses(
        (status = 200, description = "Paginated published projects", body = PaginatedProjects),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_published_projects(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<ListPublishedQuery>,
    locale: ResolveLocale,
    _access: AuthorizedSite<ProjectWithContent, Read>,
) -> Result<Json<PaginatedProjects>, ApiError> {
    let suffix = format!(
        "projects:public:p{}:ps{}:sb{}:sd{}:f{}:loc:{}",
        q.page.unwrap_or(1),
        q.page_size.unwrap_or(10),
        q.sort_by.as_deref().unwrap_or("-"),
        q.sort_dir.as_deref().unwrap_or("-"),
        q.is_featured
            .map_or_else(|| "-".to_string(), |b| b.to_string()),
        locale.0.as_deref().unwrap_or("all"),
    );
    let result = crate::services::response_cache::cached(
        &state.redis,
        &crate::services::response_cache::key(site_id, &suffix),
        || async {
            let params = ListParams::new(q.page, q.page_size, None, q.sort_by, q.sort_dir);
            let projects =
                ProjectRepo::find_published_for_site(&state.db, site_id, &params, q.is_featured)
                    .await?;
            let total = ProjectRepo::count_published_for_site(&state.db, site_id).await?;
            let mut items = hydrate_project_list(&state.db, projects).await?;
            apply_locale_to_list(&mut items, &locale, &state.db, site_id).await?;
            Ok(params.paginate(items, total))
        },
    )
    .await?;
    Ok(Json(result))
}

#[utoipa::path(
    post,
    path = "/projects/{id}/review",
    tag = "Projects",
    operation_id = "review_project",
    description = "Approve or request changes on a project (editorial workflow)",
    params(("id" = Uuid, Path, description = "Project UUID")),
    request_body(content = ReviewActionRequest, description = "Review action"),
    responses(
        (status = 200, description = "Review action completed", body = ReviewActionResponse),
        (status = 400, description = "Content is not in review", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Project not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn review_project(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContent<ProjectWithContent, Update>,
    ValidatedJson(body): ValidatedJson<ReviewActionRequest>,
) -> Result<Json<ReviewActionResponse>, ApiError> {
    let project = access.entity;
    let site_ids = access.site_ids;

    let ctx = ReviewContext {
        content_id: project.content_id,
        entity_type: "project",
        entity_id: id,
        entity_slug: &project.slug,
        current_status: &project.status,
        has_future_publish_start: project
            .publish_start
            .map(|s| s > chrono::Utc::now())
            .unwrap_or(false),
    };

    let response = ReviewService::review_content(
        &state.db,
        &ctx,
        site_ids.into_iter().next(),
        body.into_inner(),
        access.actor.user_identifier().map(|s| s.to_string()),
    )
    .await?;

    Ok(Json(response))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/projects/bulk",
    tag = "Projects",
    operation_id = "bulk_projects",
    description = "Perform a bulk action (update status or delete) on multiple projects",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = BulkContentRequest, description = "Bulk action request"),
    responses(
        (status = 200, description = "Bulk operation results", body = BulkContentResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn bulk_projects(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
    _module: ModuleGuard<PortfolioModule>,
    ValidatedJson(body): ValidatedJson<BulkContentRequest>,
) -> Result<Json<BulkContentResponse>, ApiError> {
    let body = body.into_inner();
    let required_perm = match body.action {
        BulkAction::Delete => Permission::new("portfolio", "delete"),
        BulkAction::UpdateStatus => Permission::new("portfolio", "update"),
    };
    PermissionService::require(&state.db, &auth.0, site_id, &required_perm).await?;

    if matches!(body.action, BulkAction::UpdateStatus) && body.status.is_none() {
        return Err(
            ApiError::bad_request("status field is required for UpdateStatus action")
                .with_code(codes::PROJECT_BULK_STATUS_REQUIRED),
        );
    }

    let mut pairs = Vec::with_capacity(body.ids.len());
    for project_id in &body.ids {
        match ProjectRepo::find_by_id(&state.db, *project_id).await {
            Ok(p) => pairs.push((*project_id, p.content_id)),
            Err(_) => pairs.push((*project_id, Uuid::nil())),
        }
    }

    let response = BulkContentService::process_bulk_operation(
        &state.db,
        "project",
        site_id,
        &body.action,
        body.status.as_ref(),
        &pairs,
        auth.0.id,
    )
    .await;

    Ok(Json(response))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/projects/reorder",
    tag = "Projects",
    operation_id = "reorder_projects",
    description = "Batch-reorder projects for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = ReorderProjectsRequest, description = "New ordering"),
    responses(
        (status = 204, description = "Projects reordered"),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn reorder_projects(
    State(state): State<AppState>,
    _access: AuthorizedSite<ProjectWithContent, Update>,
    ValidatedJson(body): ValidatedJson<ReorderProjectsRequest>,
) -> Result<StatusCode, ApiError> {
    let body = body.into_inner();
    let items: Vec<(Uuid, i16)> = body
        .items
        .into_iter()
        .map(|i| (i.id, i.display_order))
        .collect();
    ProjectRepo::reorder(&state.db, &items).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_projects))
        .routes(routes!(list_published_projects))
        .routes(routes!(get_project_by_slug))
        .routes(routes!(create_project))
        .routes(routes!(bulk_projects))
        .routes(routes!(reorder_projects))
        .routes(routes!(review_project))
        .routes(routes!(get_project, update_project, delete_project))
        .routes(routes!(get_project_detail))
}
