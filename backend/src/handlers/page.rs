//! Page handlers

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;
use validator::Validate;

use crate::dto::bulk::{BulkAction, BulkContentRequest, BulkContentResponse};
use crate::dto::content::{
    CreateLocalizationRequest, LocalizationResponse, UpdateLocalizationRequest,
};
use crate::dto::page::{
    CreatePageRequest, CreatePageSectionRequest, PageDetailResponse, PageListItem, PageResponse,
    PageSectionResponse, PaginatedPages, ReorderPageSectionsRequest, SectionLocalizationResponse,
    UpdatePageRequest, UpdatePageSectionRequest, UpsertSectionLocalizationRequest,
};
use crate::dto::review::{ReviewActionRequest, ReviewActionResponse};
use crate::errors::{codes, ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::guards::module_guard::{ModuleGuard, PagesModule};
use crate::models::audit::AuditAction;
use crate::models::content::{Content, ContentLocalization, ContentStatus};
use crate::models::page::{Page, PageSection, PageSectionLocalization};
use crate::models::site_membership::SiteRole;
use crate::services::{
    audit_service,
    bulk_content_service::BulkContentService,
    notification_service,
    review_service::{ReviewContext, ReviewService},
    webhook_service, workflow_service,
};
use crate::utils::pagination::PaginationParams;
use crate::AppState;

/// List all pages for a site (paginated)
#[utoipa::path(
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
#[allow(clippy::too_many_arguments)]
#[get("/sites/<site_id>/pages?<page>&<page_size>&<search>&<status>&<page_type>&<sort_by>&<sort_dir>&<exclude_status>")]
pub async fn list_pages(
    state: &State<AppState>,
    site_id: Uuid,
    page: Option<i64>,
    page_size: Option<i64>,
    search: Option<String>,
    status: Option<String>,
    page_type: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
    exclude_status: Option<String>,
    auth: ReadKey,
    _module: ModuleGuard<PagesModule>,
) -> Result<Json<PaginatedPages>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let params = PaginationParams::new(page, page_size);
    let (limit, offset) = params.limit_offset();

    let has_filters = search.is_some()
        || status.is_some()
        || page_type.is_some()
        || sort_by.is_some()
        || sort_dir.is_some()
        || exclude_status.is_some();

    let (pages, total) = if has_filters {
        let pages = Page::find_all_for_site_filtered(
            &state.db,
            site_id,
            limit,
            offset,
            search.as_deref(),
            status.as_deref(),
            page_type.as_deref(),
            sort_by.as_deref(),
            sort_dir.as_deref(),
            exclude_status.as_deref(),
        )
        .await?;
        let total = Page::count_for_site_filtered(
            &state.db,
            site_id,
            search.as_deref(),
            status.as_deref(),
            page_type.as_deref(),
            exclude_status.as_deref(),
        )
        .await?;
        (pages, total)
    } else {
        let pages = Page::find_all_for_site(&state.db, site_id, limit, offset).await?;
        let total = Page::count_for_site(&state.db, site_id).await?;
        (pages, total)
    };

    let items: Vec<PageListItem> = pages.into_iter().map(PageListItem::from).collect();
    let paginated = params.paginate(items, total);

    Ok(Json(paginated))
}

/// Get page by ID
#[utoipa::path(
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
#[get("/pages/<id>")]
pub async fn get_page(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Json<PageResponse>, ApiError> {
    let page = Page::find_by_id(&state.db, id).await?;
    let site_ids = Content::find_site_ids(&state.db, page.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Viewer)
            .await?;
    }
    if let Some(&site_id) = site_ids.first() {
        ModuleGuard::<PagesModule>::check(&state.db, site_id).await?;
    }
    Ok(Json(PageResponse::from(page)))
}

/// Get page by route within a site
#[utoipa::path(
    tag = "Pages",
    operation_id = "get_page_by_route",
    description = "Get a page by its route within a site",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("route" = String, Path, description = "Page route")
    ),
    responses(
        (status = 200, description = "Page details", body = PageResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Page not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/pages/by-route/<route..>")]
pub async fn get_page_by_route(
    state: &State<AppState>,
    site_id: Uuid,
    route: std::path::PathBuf,
    auth: ReadKey,
    _module: ModuleGuard<PagesModule>,
) -> Result<Json<PageResponse>, ApiError> {
    let route_str = route.to_string_lossy();
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    // Normalize: routes are stored with leading slash in DB
    let normalized = format!("/{}", route_str);
    let page = Page::find_by_route(&state.db, site_id, &normalized).await?;
    Ok(Json(PageResponse::from(page)))
}

/// Get sections for a page
#[utoipa::path(
    tag = "Pages",
    operation_id = "get_page_sections",
    description = "Get all sections for a page",
    params(("page_id" = Uuid, Path, description = "Page UUID")),
    responses(
        (status = 200, description = "Page sections", body = Vec<PageSectionResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/pages/<page_id>/sections")]
pub async fn get_page_sections(
    state: &State<AppState>,
    page_id: Uuid,
    auth: ReadKey,
) -> Result<Json<Vec<PageSectionResponse>>, ApiError> {
    let page = Page::find_by_id(&state.db, page_id).await?;
    let site_ids = Content::find_site_ids(&state.db, page.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Viewer)
            .await?;
    }
    if let Some(&site_id) = site_ids.first() {
        ModuleGuard::<PagesModule>::check(&state.db, site_id).await?;
    }

    let sections = PageSection::find_for_page(&state.db, page_id).await?;
    let responses: Vec<PageSectionResponse> = sections
        .into_iter()
        .map(PageSectionResponse::from)
        .collect();
    Ok(Json(responses))
}

/// Create a new page
#[utoipa::path(
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
#[post("/pages", data = "<body>")]
pub async fn create_page(
    state: &State<AppState>,
    body: Json<CreatePageRequest>,
    auth: ReadKey,
) -> Result<(Status, Json<PageResponse>), ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::bad_request(format!("Validation error: {}", e)))?;

    for site_id in &req.site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Author)
            .await?;
    }
    if let Some(&site_id) = req.site_ids.first() {
        ModuleGuard::<PagesModule>::check(&state.db, site_id).await?;
    }

    // Validate initial status against editorial workflow rules
    if let Some(site_id) = req.site_ids.first() {
        let role = auth
            .0
            .effective_site_role(&state.db, *site_id)
            .await?
            .unwrap_or(SiteRole::Viewer);
        workflow_service::validate_status_transition(
            &state.db,
            *site_id,
            &role,
            &ContentStatus::Draft,
            &req.status,
        )
        .await?;
    }

    let page = Page::create(&state.db, req).await?;
    let site_id = Content::find_site_ids(&state.db, page.content_id)
        .await?
        .into_iter()
        .next();
    audit_service::log_action(
        &state.db,
        site_id,
        Some(auth.0.id),
        AuditAction::Create,
        "page",
        page.id,
        None,
    )
    .await;
    if let Some(sid) = site_id {
        webhook_service::dispatch(
            state.db.clone(),
            sid,
            "page.created",
            page.id,
            serde_json::to_value(PageResponse::from(page.clone())).unwrap_or_default(),
        );
    }
    Ok((Status::Created, Json(PageResponse::from(page))))
}

/// Update a page
#[utoipa::path(
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
#[put("/pages/<id>", data = "<body>")]
pub async fn update_page(
    state: &State<AppState>,
    id: Uuid,
    body: Json<UpdatePageRequest>,
    auth: ReadKey,
) -> Result<Json<PageResponse>, ApiError> {
    let existing = Page::find_by_id(&state.db, id).await?;
    let site_ids = Content::find_site_ids(&state.db, existing.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Author)
            .await?;
    }
    if let Some(&site_id) = site_ids.first() {
        ModuleGuard::<PagesModule>::check(&state.db, site_id).await?;
    }
    let old = serde_json::to_value(&existing).ok();

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::bad_request(format!("Validation error: {}", e)))?;

    // Validate status transition against editorial workflow rules
    if let Some(ref requested_status) = req.status {
        if let Some(site_id) = site_ids.first() {
            let role = auth
                .0
                .effective_site_role(&state.db, *site_id)
                .await?
                .unwrap_or(SiteRole::Viewer);
            workflow_service::validate_status_transition(
                &state.db,
                *site_id,
                &role,
                &existing.status,
                requested_status,
            )
            .await?;
        }
    }

    let page = Page::update(&state.db, id, req).await?;
    let site_id = site_ids.into_iter().next();
    audit_service::log_action(
        &state.db,
        site_id,
        Some(auth.0.id),
        AuditAction::Update,
        "page",
        id,
        None,
    )
    .await;
    if let (Some(old), Ok(new)) = (old, serde_json::to_value(&page)) {
        audit_service::log_changes(&state.db, site_id, "page", id, Some(auth.0.id), &old, &new)
            .await;
    }
    if let Some(sid) = site_id {
        webhook_service::dispatch(
            state.db.clone(),
            sid,
            "page.updated",
            id,
            serde_json::to_value(PageResponse::from(page.clone())).unwrap_or_default(),
        );
        // Notify reviewers when content is submitted for review
        if page.status == ContentStatus::InReview && existing.status != ContentStatus::InReview {
            let slug = page.slug.clone().unwrap_or_else(|| page.route.clone());
            notification_service::notify_content_submitted(
                state.db.clone(),
                sid,
                "page",
                id,
                &slug,
                Some(auth.0.id),
            );
        }
    }
    Ok(Json(PageResponse::from(page)))
}

/// Delete a page (soft delete)
#[utoipa::path(
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
#[delete("/pages/<id>")]
pub async fn delete_page(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    let page = Page::find_by_id(&state.db, id).await?;
    let site_ids = Content::find_site_ids(&state.db, page.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Editor)
            .await?;
    }
    if let Some(&site_id) = site_ids.first() {
        ModuleGuard::<PagesModule>::check(&state.db, site_id).await?;
    }

    Page::soft_delete(&state.db, id).await?;
    let site_id = site_ids.into_iter().next();
    audit_service::log_action(
        &state.db,
        site_id,
        Some(auth.0.id),
        AuditAction::Delete,
        "page",
        id,
        None,
    )
    .await;
    if let Some(sid) = site_id {
        webhook_service::dispatch(
            state.db.clone(),
            sid,
            "page.deleted",
            id,
            serde_json::json!({"id": id}),
        );
    }
    Ok(Status::NoContent)
}

/// Clone a page
#[utoipa::path(
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
#[post("/pages/<id>/clone")]
pub async fn clone_page(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<(Status, Json<PageResponse>), ApiError> {
    let existing = Page::find_by_id(&state.db, id).await?;
    let site_ids = Content::find_site_ids(&state.db, existing.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Author)
            .await?;
    }
    if let Some(&site_id) = site_ids.first() {
        ModuleGuard::<PagesModule>::check(&state.db, site_id).await?;
    }

    let page = Page::clone_page(&state.db, id, site_ids.clone()).await?;
    let site_id = site_ids.into_iter().next();
    let metadata = serde_json::json!({ "cloned_from": id.to_string() });
    audit_service::log_action(
        &state.db,
        site_id,
        Some(auth.0.id),
        AuditAction::Create,
        "page",
        page.id,
        Some(metadata),
    )
    .await;
    if let Some(sid) = site_id {
        webhook_service::dispatch(
            state.db.clone(),
            sid,
            "page.created",
            page.id,
            serde_json::to_value(PageResponse::from(page.clone())).unwrap_or_default(),
        );
    }
    Ok((Status::Created, Json(PageResponse::from(page))))
}

/// Create a page section
#[utoipa::path(
    tag = "Pages",
    operation_id = "create_page_section",
    description = "Create a section for a page",
    params(("page_id" = Uuid, Path, description = "Page UUID")),
    request_body(content = CreatePageSectionRequest, description = "Section data"),
    responses(
        (status = 201, description = "Section created", body = PageSectionResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/pages/<page_id>/sections", data = "<body>")]
pub async fn create_page_section(
    state: &State<AppState>,
    page_id: Uuid,
    body: Json<CreatePageSectionRequest>,
    auth: ReadKey,
) -> Result<(Status, Json<PageSectionResponse>), ApiError> {
    let page = Page::find_by_id(&state.db, page_id).await?;
    let site_ids = Content::find_site_ids(&state.db, page.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Author)
            .await?;
    }
    if let Some(&site_id) = site_ids.first() {
        ModuleGuard::<PagesModule>::check(&state.db, site_id).await?;
    }

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::bad_request(format!("Validation error: {}", e)))?;

    let section = PageSection::create(&state.db, page_id, req).await?;
    Ok((Status::Created, Json(PageSectionResponse::from(section))))
}

/// Update a page section
#[utoipa::path(
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
#[put("/pages/sections/<id>", data = "<body>")]
pub async fn update_page_section(
    state: &State<AppState>,
    id: Uuid,
    body: Json<UpdatePageSectionRequest>,
    auth: ReadKey,
) -> Result<Json<PageSectionResponse>, ApiError> {
    let existing_section = PageSection::find_by_id(&state.db, id).await?;
    let page = Page::find_by_id(&state.db, existing_section.page_id).await?;
    let site_ids = Content::find_site_ids(&state.db, page.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Author)
            .await?;
    }
    if let Some(&site_id) = site_ids.first() {
        ModuleGuard::<PagesModule>::check(&state.db, site_id).await?;
    }

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::bad_request(format!("Validation error: {}", e)))?;

    let section = PageSection::update(&state.db, id, req).await?;
    Ok(Json(PageSectionResponse::from(section)))
}

/// Delete a page section
#[utoipa::path(
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
#[delete("/pages/sections/<id>")]
pub async fn delete_page_section(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    let section = PageSection::find_by_id(&state.db, id).await?;
    let page = Page::find_by_id(&state.db, section.page_id).await?;
    let site_ids = Content::find_site_ids(&state.db, page.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Editor)
            .await?;
    }
    if let Some(&site_id) = site_ids.first() {
        ModuleGuard::<PagesModule>::check(&state.db, site_id).await?;
    }

    PageSection::delete(&state.db, id).await?;
    Ok(Status::NoContent)
}

/// Batch-reorder page sections
#[utoipa::path(
    tag = "Pages",
    operation_id = "reorder_page_sections",
    description = "Batch-reorder page sections for a page",
    params(("page_id" = Uuid, Path, description = "Page UUID")),
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
#[post("/pages/<page_id>/sections/reorder", rank = 3, data = "<body>")]
pub async fn reorder_page_sections(
    state: &State<AppState>,
    page_id: Uuid,
    body: Json<ReorderPageSectionsRequest>,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    let page = Page::find_by_id(&state.db, page_id).await?;
    let site_ids = Content::find_site_ids(&state.db, page.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Author)
            .await?;
    }
    if let Some(&site_id) = site_ids.first() {
        ModuleGuard::<PagesModule>::check(&state.db, site_id).await?;
    }

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::bad_request(format!("Validation error: {}", e)))?;

    let items: Vec<(Uuid, i16)> = req
        .items
        .into_iter()
        .map(|i| (i.id, i.display_order))
        .collect();
    PageSection::reorder_for_page(&state.db, page_id, items).await?;
    Ok(Status::NoContent)
}

/// Get localizations for a section
#[utoipa::path(
    tag = "Pages",
    operation_id = "get_section_localizations",
    description = "Get all localizations for a page section",
    params(("section_id" = Uuid, Path, description = "Section UUID")),
    responses(
        (status = 200, description = "Section localizations", body = Vec<SectionLocalizationResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/pages/sections/<section_id>/localizations", rank = 1)]
pub async fn get_section_localizations(
    state: &State<AppState>,
    section_id: Uuid,
    auth: ReadKey,
) -> Result<Json<Vec<SectionLocalizationResponse>>, ApiError> {
    let section = PageSection::find_by_id(&state.db, section_id).await?;
    let page = Page::find_by_id(&state.db, section.page_id).await?;
    let site_ids = Content::find_site_ids(&state.db, page.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Viewer)
            .await?;
    }
    if let Some(&site_id) = site_ids.first() {
        ModuleGuard::<PagesModule>::check(&state.db, site_id).await?;
    }

    let localizations = PageSectionLocalization::find_for_section(&state.db, section_id).await?;
    let responses: Vec<SectionLocalizationResponse> = localizations
        .into_iter()
        .map(SectionLocalizationResponse::from)
        .collect();
    Ok(Json(responses))
}

/// Get all section localizations for a page
#[utoipa::path(
    tag = "Pages",
    operation_id = "get_page_section_localizations",
    description = "Get all section localizations for all sections of a page",
    params(("page_id" = Uuid, Path, description = "Page UUID")),
    responses(
        (status = 200, description = "All section localizations for the page", body = Vec<SectionLocalizationResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/pages/<page_id>/sections/localizations", rank = 2)]
pub async fn get_page_section_localizations(
    state: &State<AppState>,
    page_id: Uuid,
    auth: ReadKey,
) -> Result<Json<Vec<SectionLocalizationResponse>>, ApiError> {
    let page = Page::find_by_id(&state.db, page_id).await?;
    let site_ids = Content::find_site_ids(&state.db, page.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Viewer)
            .await?;
    }
    if let Some(&site_id) = site_ids.first() {
        ModuleGuard::<PagesModule>::check(&state.db, site_id).await?;
    }

    let localizations = PageSectionLocalization::find_all_for_page(&state.db, page_id).await?;
    let responses: Vec<SectionLocalizationResponse> = localizations
        .into_iter()
        .map(SectionLocalizationResponse::from)
        .collect();
    Ok(Json(responses))
}

/// Upsert a section localization
#[utoipa::path(
    tag = "Pages",
    operation_id = "upsert_section_localization",
    description = "Create or update a localization for a page section",
    params(("section_id" = Uuid, Path, description = "Section UUID")),
    request_body(content = UpsertSectionLocalizationRequest, description = "Localization data"),
    responses(
        (status = 200, description = "Localization upserted", body = SectionLocalizationResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[put("/pages/sections/<section_id>/localizations", data = "<body>")]
pub async fn upsert_section_localization(
    state: &State<AppState>,
    section_id: Uuid,
    body: Json<UpsertSectionLocalizationRequest>,
    auth: ReadKey,
) -> Result<Json<SectionLocalizationResponse>, ApiError> {
    let section = PageSection::find_by_id(&state.db, section_id).await?;
    let page = Page::find_by_id(&state.db, section.page_id).await?;
    let site_ids = Content::find_site_ids(&state.db, page.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Author)
            .await?;
    }
    if let Some(&site_id) = site_ids.first() {
        ModuleGuard::<PagesModule>::check(&state.db, site_id).await?;
    }

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::bad_request(format!("Validation error: {}", e)))?;

    let localization = PageSectionLocalization::upsert(
        &state.db,
        section_id,
        req.locale_id,
        req.title.as_deref(),
        req.text.as_deref(),
        req.button_text.as_deref(),
    )
    .await?;

    Ok(Json(SectionLocalizationResponse::from(localization)))
}

/// Delete a section localization
#[utoipa::path(
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
#[delete("/pages/sections/localizations/<id>")]
pub async fn delete_section_localization(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    let loc = PageSectionLocalization::find_by_id(&state.db, id).await?;
    let section = PageSection::find_by_id(&state.db, loc.page_section_id).await?;
    let page = Page::find_by_id(&state.db, section.page_id).await?;
    let site_ids = Content::find_site_ids(&state.db, page.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Editor)
            .await?;
    }
    if let Some(&site_id) = site_ids.first() {
        ModuleGuard::<PagesModule>::check(&state.db, site_id).await?;
    }

    PageSectionLocalization::delete(&state.db, id).await?;
    Ok(Status::NoContent)
}

/// Review a page (approve or request changes)
#[utoipa::path(
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
#[post("/pages/<id>/review", data = "<body>")]
pub async fn review_page(
    state: &State<AppState>,
    id: Uuid,
    body: Json<ReviewActionRequest>,
    auth: ReadKey,
) -> Result<Json<ReviewActionResponse>, ApiError> {
    let page = Page::find_by_id(&state.db, id).await?;
    let site_ids = Content::find_site_ids(&state.db, page.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Reviewer)
            .await?;
    }
    if let Some(&site_id) = site_ids.first() {
        ModuleGuard::<PagesModule>::check(&state.db, site_id).await?;
    }

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
        auth.0.id,
    )
    .await?;

    Ok(Json(response))
}

/// Bulk action on pages for a site
#[utoipa::path(
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
#[post("/sites/<site_id>/pages/bulk", data = "<body>")]
pub async fn bulk_pages(
    state: &State<AppState>,
    site_id: Uuid,
    body: Json<BulkContentRequest>,
    auth: ReadKey,
    _module: ModuleGuard<PagesModule>,
) -> Result<Json<BulkContentResponse>, ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::bad_request(format!("Validation error: {}", e)))?;

    let required_role = match req.action {
        BulkAction::Delete => SiteRole::Editor,
        BulkAction::UpdateStatus => SiteRole::Author,
    };
    auth.0
        .authorize_site_action(&state.db, site_id, &required_role)
        .await?;

    if matches!(req.action, BulkAction::UpdateStatus) && req.status.is_none() {
        return Err(
            ApiError::bad_request("status field is required for UpdateStatus action")
                .with_code(codes::PAGE_BULK_STATUS_REQUIRED),
        );
    }

    // Resolve page IDs → (page_id, content_id) pairs
    let mut pairs = Vec::with_capacity(req.ids.len());
    for page_id in &req.ids {
        match Page::find_by_id(&state.db, *page_id).await {
            Ok(page) => pairs.push((*page_id, page.content_id)),
            Err(_) => pairs.push((*page_id, Uuid::nil())),
        }
    }

    let response = BulkContentService::process_bulk_operation(
        &state.db,
        "page",
        site_id,
        &req.action,
        req.status.as_ref(),
        &pairs,
        auth.0.id,
    )
    .await;

    Ok(Json(response))
}

/// Get page detail (page + all localizations)
#[utoipa::path(
    tag = "Pages",
    operation_id = "get_page_detail",
    description = "Get page with all content localizations (SEO metadata)",
    params(("id" = Uuid, Path, description = "Page UUID")),
    responses(
        (status = 200, description = "Page detail with localizations", body = PageDetailResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Page not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/pages/<id>/detail")]
pub async fn get_page_detail(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Json<PageDetailResponse>, ApiError> {
    let page = Page::find_by_id(&state.db, id).await?;
    let site_ids = Content::find_site_ids(&state.db, page.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Viewer)
            .await?;
    }
    if let Some(&site_id) = site_ids.first() {
        ModuleGuard::<PagesModule>::check(&state.db, site_id).await?;
    }
    let localizations =
        ContentLocalization::find_all_for_content(&state.db, page.content_id).await?;
    let loc_responses: Vec<LocalizationResponse> = localizations
        .into_iter()
        .map(LocalizationResponse::from)
        .collect();

    Ok(Json(PageDetailResponse {
        page: PageResponse::from(page),
        localizations: loc_responses,
    }))
}

/// Get page localizations
#[utoipa::path(
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
#[get("/pages/<id>/localizations")]
pub async fn get_page_localizations(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Json<Vec<LocalizationResponse>>, ApiError> {
    let page = Page::find_by_id(&state.db, id).await?;
    let site_ids = Content::find_site_ids(&state.db, page.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Viewer)
            .await?;
    }
    if let Some(&site_id) = site_ids.first() {
        ModuleGuard::<PagesModule>::check(&state.db, site_id).await?;
    }
    let localizations =
        ContentLocalization::find_all_for_content(&state.db, page.content_id).await?;
    let responses: Vec<LocalizationResponse> = localizations
        .into_iter()
        .map(LocalizationResponse::from)
        .collect();
    Ok(Json(responses))
}

/// Create a localization for a page
#[utoipa::path(
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
#[post("/pages/<id>/localizations", data = "<body>")]
pub async fn create_page_localization(
    state: &State<AppState>,
    id: Uuid,
    body: Json<CreateLocalizationRequest>,
    auth: ReadKey,
) -> Result<(Status, Json<LocalizationResponse>), ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::bad_request(format!("Validation error: {}", e)))?;

    let page = Page::find_by_id(&state.db, id).await?;
    let site_ids = Content::find_site_ids(&state.db, page.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Author)
            .await?;
    }
    if let Some(&site_id) = site_ids.first() {
        ModuleGuard::<PagesModule>::check(&state.db, site_id).await?;
    }

    // Check for duplicate locale
    let existing = ContentLocalization::find_all_for_content(&state.db, page.content_id).await?;
    if existing.iter().any(|l| l.locale_id == req.locale_id) {
        return Err(ApiError::bad_request(format!(
            "Localization for locale {} already exists",
            req.locale_id
        ))
        .with_code(codes::PAGE_LOCALIZATION_EXISTS));
    }

    let localization = ContentLocalization::create(
        &state.db,
        page.content_id,
        req.locale_id,
        &req.title,
        req.subtitle.as_deref(),
        req.excerpt.as_deref(),
        req.body.as_deref(),
        req.meta_title.as_deref(),
        req.meta_description.as_deref(),
    )
    .await?;

    Ok((
        Status::Created,
        Json(LocalizationResponse::from(localization)),
    ))
}

/// Update a page localization
#[utoipa::path(
    tag = "Pages",
    operation_id = "update_page_localization",
    description = "Update a content localization for a page",
    params(("loc_id" = Uuid, Path, description = "Localization UUID")),
    request_body(content = UpdateLocalizationRequest, description = "Localization update data"),
    responses(
        (status = 200, description = "Localization updated", body = LocalizationResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Localization not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[put("/pages/localizations/<loc_id>", data = "<body>")]
pub async fn update_page_localization(
    state: &State<AppState>,
    loc_id: Uuid,
    body: Json<UpdateLocalizationRequest>,
    auth: ReadKey,
) -> Result<Json<LocalizationResponse>, ApiError> {
    let existing_loc = ContentLocalization::find_by_id(&state.db, loc_id).await?;
    let site_ids = Content::find_site_ids(&state.db, existing_loc.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Author)
            .await?;
    }
    if let Some(&site_id) = site_ids.first() {
        ModuleGuard::<PagesModule>::check(&state.db, site_id).await?;
    }

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::bad_request(format!("Validation error: {}", e)))?;

    let localization = ContentLocalization::update(
        &state.db,
        loc_id,
        req.title.as_deref(),
        req.subtitle.as_deref(),
        req.excerpt.as_deref(),
        req.body.as_deref(),
        req.meta_title.as_deref(),
        req.meta_description.as_deref(),
        req.translation_status.as_ref(),
    )
    .await?;

    Ok(Json(LocalizationResponse::from(localization)))
}

/// Delete a page localization
#[utoipa::path(
    tag = "Pages",
    operation_id = "delete_page_localization",
    description = "Delete a content localization for a page",
    params(("loc_id" = Uuid, Path, description = "Localization UUID")),
    responses(
        (status = 204, description = "Localization deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Localization not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/pages/localizations/<loc_id>")]
pub async fn delete_page_localization(
    state: &State<AppState>,
    loc_id: Uuid,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    let existing_loc = ContentLocalization::find_by_id(&state.db, loc_id).await?;
    let site_ids = Content::find_site_ids(&state.db, existing_loc.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Editor)
            .await?;
    }
    if let Some(&site_id) = site_ids.first() {
        ModuleGuard::<PagesModule>::check(&state.db, site_id).await?;
    }

    ContentLocalization::delete(&state.db, loc_id).await?;
    Ok(Status::NoContent)
}

/// Collect page routes
pub fn routes() -> Vec<Route> {
    routes![
        list_pages,
        get_page,
        get_page_by_route,
        get_page_detail,
        get_page_sections,
        create_page,
        update_page,
        delete_page,
        clone_page,
        review_page,
        create_page_section,
        update_page_section,
        delete_page_section,
        reorder_page_sections,
        get_section_localizations,
        get_page_section_localizations,
        get_page_localizations,
        upsert_section_localization,
        delete_section_localization,
        create_page_localization,
        update_page_localization,
        delete_page_localization,
        bulk_pages
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 23, "Should have 23 page routes");
    }
}
