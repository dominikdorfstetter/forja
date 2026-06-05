//! Axum port of `crate::handlers::page`. 24 endpoints for page CRUD,
//! sections, section localizations, content localizations, plus review
//! and bulk operations.
//!
//! Path-param naming is normalized: `/pages/{id}/...` uses `id` across
//! every method (Rocket allowed `id` and `page_id` to coexist; matchit
//! demands one canonical name per branching position). Same with
//! `/pages/sections/{id}/...`.

use crate::axum_app::authorized_content::{
    AuthorizedContent, AuthorizedContentWithOwnership, AuthorizedJson, AuthorizedSite, Create,
    Delete, Read, Update,
};
use crate::axum_app::extractors::ResolveLocale;
use crate::dto::bulk::{BulkAction, BulkContentRequest, BulkContentResponse};
use crate::dto::content::{
    CreateLocalizationRequest, LocalizationResponse, UpdateLocalizationRequest,
};
use crate::dto::page::{
    CreatePageRequest, CreatePageSectionRequest, PageDetailResponse, PageListItem, PageResponse,
    PageSectionResponse, PageStatusCounts, PaginatedPages, ReorderPageSectionsRequest,
    SectionLocalizationResponse, UpdatePageRequest, UpdatePageSectionRequest,
    UpsertSectionLocalizationRequest,
};
use crate::dto::review::{ReviewActionRequest, ReviewActionResponse};
use crate::dto::validated::ValidatedJson;
use crate::errors::{codes, ApiError, ProblemDetails};
use crate::guards::auth_guard::{ReadKey, WriteKey};
use crate::guards::module_guard::{ModuleGuard, PagesModule};
use crate::models::content::ContentLocalization;
use crate::models::page::PageWithContent;
use crate::models::site::Site;
use crate::repos::page_repo::{PageRepo, PageSectionLocalizationRepo, PageSectionRepo};
use crate::services::content_lifecycle;
use crate::services::localization_lifecycle::{self, page::PageLocalization};
use crate::services::permission_service::{Permission, PermissionService};
use crate::services::{
    bulk_content_service::BulkContentService,
    review_service::{ReviewContext, ReviewService},
};
use crate::utils::locale_resolver::collapse_localizations;
use crate::utils::pagination::PaginationParams;
use crate::utils::seo;
use crate::AppState;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::Json;
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
struct ListPagesQuery {
    page: Option<i64>,
    page_size: Option<i64>,
    search: Option<String>,
    status: Option<String>,
    page_type: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
    exclude_status: Option<String>,
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/pages",
    tag = "Pages",
    operation_id = "list_pages",
    description = "List all pages for a site (paginated, with optional search/filter/sort)",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page (default 10, max 100)"),
        ("search" = Option<String>, Query, description = "Search by ID, route, or slug (ILIKE)"),
        ("status" = Option<String>, Query, description = "Filter by status"),
        ("page_type" = Option<String>, Query, description = "Filter by page type"),
        ("sort_by" = Option<String>, Query, description = "Sort column: route, slug, page_type, status, created_at"),
        ("sort_dir" = Option<String>, Query, description = "Sort direction: asc or desc"),
        ("exclude_status" = Option<String>, Query, description = "Exclude items with this status (e.g. Archived)")
    ),
    responses(
        (status = 200, description = "Paginated page list", body = PaginatedPages),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_pages(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<ListPagesQuery>,
    _access: AuthorizedSite<PageWithContent, Read>,
) -> Result<Json<PaginatedPages>, ApiError> {
    let params = PaginationParams::new(q.page, q.page_size);
    let (limit, offset) = params.limit_offset();

    let has_filters = q.search.is_some()
        || q.status.is_some()
        || q.page_type.is_some()
        || q.sort_by.is_some()
        || q.sort_dir.is_some()
        || q.exclude_status.is_some();

    let (pages, total) = if has_filters {
        let pages = PageRepo::find_all_for_site_filtered(
            &state.db,
            site_id,
            limit,
            offset,
            q.search.as_deref(),
            q.status.as_deref(),
            q.page_type.as_deref(),
            q.sort_by.as_deref(),
            q.sort_dir.as_deref(),
            q.exclude_status.as_deref(),
        )
        .await?;
        let total = PageRepo::count_for_site_filtered(
            &state.db,
            site_id,
            q.search.as_deref(),
            q.status.as_deref(),
            q.page_type.as_deref(),
            q.exclude_status.as_deref(),
        )
        .await?;
        (pages, total)
    } else {
        let pages = PageRepo::find_all_for_site(&state.db, site_id, limit, offset).await?;
        let total = PageRepo::count_for_site(&state.db, site_id).await?;
        (pages, total)
    };

    let items: Vec<PageListItem> = pages.into_iter().map(PageListItem::from).collect();
    let paginated = params.paginate(items, total);

    Ok(Json(paginated))
}

#[utoipa::path(
    get,
    path = "/pages/{id}",
    tag = "Pages",
    operation_id = "get_page",
    description = "Get a page by ID",
    params(("id" = Uuid, Path, description = "Page UUID")),
    responses(
        (status = 200, description = "Page details", body = PageResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Page not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_page(
    State(_state): State<AppState>,
    access: AuthorizedContent<PageWithContent, Read>,
) -> Result<Json<PageResponse>, ApiError> {
    Ok(Json(PageResponse::from(access.entity)))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/pages/by-route/{route}",
    tag = "Pages",
    operation_id = "get_page_by_route",
    description = "Get a page by its route within a site",
    params(
        ("site_id" = Uuid, Path, description = "The UUID of the site"),
        ("route" = String, Path, description = "The page route path (without leading slash, e.g. 'about' or 'blog/hello-world')")
    ),
    responses(
        (status = 200, description = "Page details", body = PageResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails),
        (status = 404, description = "Page not found for the given route", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_page_by_route(
    State(state): State<AppState>,
    Path((site_id, route)): Path<(Uuid, String)>,
    _access: AuthorizedSite<PageWithContent, Read>,
) -> Result<Json<PageResponse>, ApiError> {
    let normalized = format!("/{}", route);
    let response = crate::services::response_cache::cached(
        &state.redis,
        &crate::services::response_cache::key(site_id, &format!("pages:by-route:{normalized}")),
        || async {
            let page = PageRepo::find_by_route(&state.db, site_id, &normalized).await?;
            Ok(PageResponse::from(page))
        },
    )
    .await?;
    Ok(Json(response))
}

#[utoipa::path(
    get,
    path = "/pages/{id}/sections",
    tag = "Pages",
    operation_id = "get_page_sections",
    description = "Get all sections for a page",
    params(("id" = Uuid, Path, description = "The UUID of the page to retrieve sections for")),
    responses(
        (status = 200, description = "Page sections", body = Vec<PageSectionResponse>),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails),
        (status = 404, description = "Page not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_page_sections(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    _access: AuthorizedContent<PageWithContent, Read>,
) -> Result<Json<Vec<PageSectionResponse>>, ApiError> {
    let sections = PageSectionRepo::find_for_page(&state.db, id).await?;
    let responses: Vec<PageSectionResponse> = sections
        .into_iter()
        .map(PageSectionResponse::from)
        .collect();
    Ok(Json(responses))
}

#[utoipa::path(
    post,
    path = "/pages",
    tag = "Pages",
    operation_id = "create_page",
    description = "Create a new page",
    request_body(content = CreatePageRequest, description = "Page creation data"),
    responses(
        (status = 201, description = "Page created", body = PageResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn create_page(
    State(state): State<AppState>,
    access: AuthorizedJson<PageWithContent, CreatePageRequest, Create>,
) -> Result<(StatusCode, Json<PageResponse>), ApiError> {
    let page = content_lifecycle::create::<PageWithContent>(
        &state.db,
        access.validated.into_inner(),
        &access.actor,
    )
    .await?;
    Ok((StatusCode::CREATED, Json(PageResponse::from(page))))
}

#[utoipa::path(
    put,
    path = "/pages/{id}",
    tag = "Pages",
    operation_id = "update_page",
    description = "Update a page",
    params(("id" = Uuid, Path, description = "Page UUID")),
    request_body(content = UpdatePageRequest, description = "Page update data"),
    responses(
        (status = 200, description = "Page updated", body = PageResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Page not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn update_page(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContentWithOwnership<PageWithContent, Update>,
    ValidatedJson(body): ValidatedJson<UpdatePageRequest>,
) -> Result<Json<PageResponse>, ApiError> {
    let page = content_lifecycle::update::<PageWithContent>(
        &state.db,
        id,
        body.into_inner(),
        access.entity,
        access.site_ids,
        &access.actor,
    )
    .await?;
    Ok(Json(PageResponse::from(page)))
}

#[utoipa::path(
    delete,
    path = "/pages/{id}",
    tag = "Pages",
    operation_id = "delete_page",
    description = "Soft delete a page",
    params(("id" = Uuid, Path, description = "Page UUID")),
    responses(
        (status = 204, description = "Page deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Page not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn delete_page(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContentWithOwnership<PageWithContent, Delete>,
) -> Result<StatusCode, ApiError> {
    content_lifecycle::page::delete(&state.db, id, access.entity, access.site_ids, &access.actor)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/pages/{id}/clone",
    tag = "Pages",
    operation_id = "clone_page",
    description = "Clone an existing page as a new Draft",
    params(("id" = Uuid, Path, description = "Source page UUID")),
    responses(
        (status = 201, description = "Page cloned", body = PageResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Source page not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn clone_page(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContent<PageWithContent, Create>,
) -> Result<(StatusCode, Json<PageResponse>), ApiError> {
    let page =
        content_lifecycle::page::clone(&state.db, id, access.site_ids, &access.actor).await?;
    Ok((StatusCode::CREATED, Json(PageResponse::from(page))))
}

#[utoipa::path(
    post,
    path = "/pages/{id}/sections",
    tag = "Pages",
    operation_id = "create_page_section",
    description = "Create a section for a page",
    params(("id" = Uuid, Path, description = "Page UUID")),
    request_body(content = CreatePageSectionRequest, description = "Section data"),
    responses(
        (status = 201, description = "Section created", body = PageSectionResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn create_page_section(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    _access: AuthorizedContent<PageWithContent, Create>,
    ValidatedJson(body): ValidatedJson<CreatePageSectionRequest>,
) -> Result<(StatusCode, Json<PageSectionResponse>), ApiError> {
    let section = PageSectionRepo::create(&state.db, id, body.into_inner()).await?;
    Ok((
        StatusCode::CREATED,
        Json(PageSectionResponse::from(section)),
    ))
}

#[utoipa::path(
    put,
    path = "/pages/sections/{id}",
    tag = "Pages",
    operation_id = "update_page_section",
    description = "Update a page section",
    params(("id" = Uuid, Path, description = "Section UUID")),
    request_body(content = UpdatePageSectionRequest, description = "Section update data"),
    responses(
        (status = 200, description = "Section updated", body = PageSectionResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Section not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn update_page_section(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    _access: AuthorizedContent<crate::models::page::PageSection, Update>,
    ValidatedJson(body): ValidatedJson<UpdatePageSectionRequest>,
) -> Result<Json<PageSectionResponse>, ApiError> {
    let section = PageSectionRepo::update(&state.db, id, body.into_inner()).await?;
    Ok(Json(PageSectionResponse::from(section)))
}

#[utoipa::path(
    delete,
    path = "/pages/sections/{id}",
    tag = "Pages",
    operation_id = "delete_page_section",
    description = "Delete a page section",
    params(("id" = Uuid, Path, description = "Section UUID")),
    responses(
        (status = 204, description = "Section deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Section not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn delete_page_section(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    _access: AuthorizedContent<crate::models::page::PageSection, Delete>,
) -> Result<StatusCode, ApiError> {
    PageSectionRepo::delete(&state.db, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/pages/{id}/sections/reorder",
    tag = "Pages",
    operation_id = "reorder_page_sections",
    description = "Batch-reorder page sections for a page",
    params(("id" = Uuid, Path, description = "Page UUID")),
    request_body(content = ReorderPageSectionsRequest, description = "New ordering"),
    responses(
        (status = 204, description = "Page sections reordered"),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Section not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn reorder_page_sections(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    _access: AuthorizedContent<PageWithContent, Update>,
    ValidatedJson(body): ValidatedJson<ReorderPageSectionsRequest>,
) -> Result<StatusCode, ApiError> {
    let body = body.into_inner();
    let items: Vec<(Uuid, i16)> = body
        .items
        .into_iter()
        .map(|i| (i.id, i.display_order))
        .collect();
    PageSectionRepo::reorder_for_page(&state.db, id, items).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/pages/sections/{id}/localizations",
    tag = "Pages",
    operation_id = "get_section_localizations",
    description = "Get all localizations for a page section",
    params(("id" = Uuid, Path, description = "The UUID of the page section to retrieve localizations for")),
    responses(
        (status = 200, description = "Section localizations", body = Vec<SectionLocalizationResponse>),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails),
        (status = 404, description = "Section not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_section_localizations(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    _access: AuthorizedContent<crate::models::page::PageSection, Read>,
) -> Result<Json<Vec<SectionLocalizationResponse>>, ApiError> {
    let localizations = PageSectionLocalizationRepo::find_for_section(&state.db, id).await?;
    let responses: Vec<SectionLocalizationResponse> = localizations
        .into_iter()
        .map(SectionLocalizationResponse::from)
        .collect();
    Ok(Json(responses))
}

#[utoipa::path(
    get,
    path = "/pages/{id}/sections/localizations",
    tag = "Pages",
    operation_id = "get_page_section_localizations",
    description = "Get all section localizations for all sections of a page",
    params(("id" = Uuid, Path, description = "Page UUID")),
    responses(
        (status = 200, description = "All section localizations for the page", body = Vec<SectionLocalizationResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_page_section_localizations(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    _access: AuthorizedContent<PageWithContent, Read>,
) -> Result<Json<Vec<SectionLocalizationResponse>>, ApiError> {
    let localizations = PageSectionLocalizationRepo::find_all_for_page(&state.db, id).await?;
    let responses: Vec<SectionLocalizationResponse> = localizations
        .into_iter()
        .map(SectionLocalizationResponse::from)
        .collect();
    Ok(Json(responses))
}

#[utoipa::path(
    put,
    path = "/pages/sections/{id}/localizations",
    tag = "Pages",
    operation_id = "upsert_section_localization",
    description = "Create or update a localization for a page section",
    params(("id" = Uuid, Path, description = "Section UUID")),
    request_body(content = UpsertSectionLocalizationRequest, description = "Localization data"),
    responses(
        (status = 200, description = "Localization upserted", body = SectionLocalizationResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn upsert_section_localization(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    _access: AuthorizedContent<crate::models::page::PageSection, Update>,
    ValidatedJson(body): ValidatedJson<UpsertSectionLocalizationRequest>,
) -> Result<Json<SectionLocalizationResponse>, ApiError> {
    let localization = PageSectionLocalizationRepo::upsert(
        &state.db,
        id,
        body.locale_id,
        body.title.as_deref(),
        body.text.as_deref(),
        body.button_text.as_deref(),
    )
    .await?;

    Ok(Json(SectionLocalizationResponse::from(localization)))
}

#[utoipa::path(
    delete,
    path = "/pages/sections/localizations/{id}",
    tag = "Pages",
    operation_id = "delete_section_localization",
    description = "Delete a section localization",
    params(("id" = Uuid, Path, description = "Localization UUID")),
    responses(
        (status = 204, description = "Localization deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Localization not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn delete_section_localization(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    _access: AuthorizedContent<crate::models::page::PageSectionLocalization, Delete>,
) -> Result<StatusCode, ApiError> {
    PageSectionLocalizationRepo::delete(&state.db, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/pages/{id}/review",
    tag = "Pages",
    operation_id = "review_page",
    description = "Approve or request changes on a page (editorial workflow)",
    params(("id" = Uuid, Path, description = "Page UUID")),
    request_body(content = ReviewActionRequest, description = "Review action"),
    responses(
        (status = 200, description = "Review action completed", body = ReviewActionResponse),
        (status = 400, description = "Content is not in review", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Page not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn review_page(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
    access: AuthorizedContent<PageWithContent, Update>,
    ValidatedJson(body): ValidatedJson<ReviewActionRequest>,
) -> Result<Json<ReviewActionResponse>, ApiError> {
    let page = access.entity;
    let site_ids = access.site_ids;
    let slug = page.slug.clone().unwrap_or_else(|| page.route.clone());
    let ctx = ReviewContext {
        content_id: page.content_id,
        entity_type: "page",
        entity_id: id,
        entity_slug: &slug,
        current_status: &page.status,
        has_future_publish_start: page
            .publish_start
            .map(|s| s > chrono::Utc::now())
            .unwrap_or(false),
    };

    let response = ReviewService::review_content(
        &state.db,
        &ctx,
        site_ids.into_iter().next(),
        body.into_inner(),
        auth.0.user_identifier().map(|s| s.to_string()),
    )
    .await?;

    Ok(Json(response))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/pages/bulk",
    tag = "Pages",
    operation_id = "bulk_pages",
    description = "Perform a bulk action (update status or delete) on multiple pages",
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
async fn bulk_pages(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
    _module: ModuleGuard<PagesModule>,
    ValidatedJson(body): ValidatedJson<BulkContentRequest>,
) -> Result<Json<BulkContentResponse>, ApiError> {
    let body = body.into_inner();
    let required_perm = match body.action {
        BulkAction::Delete => Permission::new("page", "delete"),
        BulkAction::UpdateStatus => Permission::new("page", "update"),
    };
    PermissionService::require(&state.db, &auth.0, site_id, &required_perm).await?;

    if matches!(body.action, BulkAction::UpdateStatus) && body.status.is_none() {
        return Err(
            ApiError::bad_request("status field is required for UpdateStatus action")
                .with_code(codes::PAGE_BULK_STATUS_REQUIRED),
        );
    }

    let mut pairs = Vec::with_capacity(body.ids.len());
    for page_id in &body.ids {
        match PageRepo::find_by_id(&state.db, *page_id).await {
            Ok(page) => pairs.push((*page_id, page.content_id)),
            Err(_) => pairs.push((*page_id, Uuid::nil())),
        }
    }

    let response = BulkContentService::process_bulk_operation(
        &state.db,
        "page",
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
    get,
    path = "/pages/{id}/detail",
    tag = "Pages",
    operation_id = "get_page_detail",
    description = "Get page with all content localizations (SEO metadata)",
    params(
        ("id" = Uuid, Path, description = "Page UUID"),
        ("locale" = Option<String>, Query, description = "Optional locale code. When set, `localizations[]` collapses to one resolved element after SEO fallbacks are applied (ADR 0002).")
    ),
    responses(
        (status = 200, description = "Page detail with localizations", body = PageDetailResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Page not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_page_detail(
    State(state): State<AppState>,
    locale: ResolveLocale,
    access: AuthorizedContent<PageWithContent, Read>,
) -> Result<Json<PageDetailResponse>, ApiError> {
    let page = access.entity;
    let site_ids = access.site_ids;
    let localizations =
        ContentLocalization::find_all_for_content(&state.db, page.content_id).await?;
    let mut loc_responses: Vec<LocalizationResponse> = localizations
        .into_iter()
        .map(LocalizationResponse::from)
        .collect();

    let mut og_image_url = None;
    if let Some(&site_id) = site_ids.first() {
        let site = Site::find_by_id(&state.db, site_id).await?;
        let seo = seo::SeoContext::load(&state.db, &site).await?;
        seo.apply(&mut loc_responses);
        // Pages have no cover image; the cascade starts at the site default.
        og_image_url = seo.og_image_url(&state.db, None).await;

        loc_responses = collapse_localizations(
            &state.db,
            site_id,
            locale.0.as_deref(),
            loc_responses,
            |l| l.locale_id,
        )
        .await?;
    }

    Ok(Json(PageDetailResponse {
        page: PageResponse::from(page),
        localizations: loc_responses,
        og_image_url,
    }))
}

#[utoipa::path(
    get,
    path = "/pages/{id}/localizations",
    tag = "Pages",
    operation_id = "get_page_localizations",
    description = "Get all content localizations for a page",
    params(("id" = Uuid, Path, description = "Page UUID")),
    responses(
        (status = 200, description = "Page localizations", body = Vec<LocalizationResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Page not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_page_localizations(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<Vec<LocalizationResponse>>, ApiError> {
    let page = PageRepo::find_by_id(&state.db, id).await?;
    let localizations =
        localization_lifecycle::list::<PageLocalization>(&state.db, page.content_id, &auth.0)
            .await?;
    let responses: Vec<LocalizationResponse> = localizations
        .into_iter()
        .map(LocalizationResponse::from)
        .collect();
    Ok(Json(responses))
}

#[utoipa::path(
    post,
    path = "/pages/{id}/localizations",
    tag = "Pages",
    operation_id = "create_page_localization",
    description = "Create a content localization for a page (SEO metadata)",
    params(("id" = Uuid, Path, description = "Page UUID")),
    request_body(content = CreateLocalizationRequest, description = "Localization data"),
    responses(
        (status = 201, description = "Localization created", body = LocalizationResponse),
        (status = 400, description = "Validation error or duplicate locale", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn create_page_localization(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<CreateLocalizationRequest>,
) -> Result<(StatusCode, Json<LocalizationResponse>), ApiError> {
    let page = PageRepo::find_by_id(&state.db, id).await?;
    let localization = localization_lifecycle::create::<PageLocalization>(
        &state.db,
        page.content_id,
        body.into_inner(),
        &auth.0,
    )
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(LocalizationResponse::from(localization)),
    ))
}

#[utoipa::path(
    put,
    path = "/pages/localizations/{id}",
    tag = "Pages",
    operation_id = "update_page_localization",
    description = "Update a content localization for a page",
    params(("id" = Uuid, Path, description = "Localization UUID")),
    request_body(content = UpdateLocalizationRequest, description = "Localization update data"),
    responses(
        (status = 200, description = "Localization updated", body = LocalizationResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Localization not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn update_page_localization(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<UpdateLocalizationRequest>,
) -> Result<Json<LocalizationResponse>, ApiError> {
    let localization = localization_lifecycle::update::<PageLocalization>(
        &state.db,
        id,
        body.into_inner(),
        &auth.0,
    )
    .await?;

    Ok(Json(LocalizationResponse::from(localization)))
}

#[utoipa::path(
    delete,
    path = "/pages/localizations/{id}",
    tag = "Pages",
    operation_id = "delete_page_localization",
    description = "Delete a content localization for a page",
    params(("id" = Uuid, Path, description = "Localization UUID")),
    responses(
        (status = 204, description = "Localization deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Localization not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn delete_page_localization(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
) -> Result<StatusCode, ApiError> {
    localization_lifecycle::delete::<PageLocalization>(&state.db, id, &auth.0).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/pages/status-counts",
    tag = "Pages",
    operation_id = "page_status_counts",
    description = "Count pages per workflow status (draft, in_review, scheduled, published, archived)",
    params(("site_id" = Uuid, Path, description = "The UUID of the site")),
    responses(
        (status = 200, description = "Counts per status", body = PageStatusCounts),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn page_status_counts(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    _access: AuthorizedSite<PageWithContent, Read>,
) -> Result<Json<PageStatusCounts>, ApiError> {
    let (draft, in_review, scheduled, published, archived) =
        PageRepo::status_counts_for_site(&state.db, site_id).await?;

    Ok(Json(PageStatusCounts {
        draft,
        in_review,
        scheduled,
        published,
        archived,
    }))
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_pages))
        .routes(routes!(page_status_counts))
        .routes(routes!(get_page_by_route))
        .routes(routes!(bulk_pages))
        .routes(routes!(create_page))
        .routes(routes!(get_page, update_page, delete_page))
        .routes(routes!(clone_page))
        .routes(routes!(review_page))
        .routes(routes!(get_page_detail))
        .routes(routes!(get_page_localizations, create_page_localization))
        .routes(routes!(get_page_sections, create_page_section))
        .routes(routes!(reorder_page_sections))
        .routes(routes!(get_page_section_localizations))
        .routes(routes!(update_page_section, delete_page_section))
        .routes(routes!(
            get_section_localizations,
            upsert_section_localization
        ))
        .routes(routes!(delete_section_localization))
        .routes(routes!(update_page_localization, delete_page_localization))
}
