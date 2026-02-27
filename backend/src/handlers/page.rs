//! Page handlers

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;
use validator::Validate;

use crate::dto::bulk::{BulkAction, BulkContentRequest, BulkContentResponse};
use crate::dto::page::{
    CreatePageRequest, CreatePageSectionRequest, PageListItem, PageResponse, PageSectionResponse,
    PaginatedPages, SectionLocalizationResponse, UpdatePageRequest, UpdatePageSectionRequest,
    UpsertSectionLocalizationRequest,
};
use crate::dto::review::{ReviewAction, ReviewActionRequest, ReviewActionResponse};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::models::audit::AuditAction;
use crate::models::content::{Content, ContentStatus};
use crate::models::page::{Page, PageSection, PageSectionLocalization};
use crate::models::site_membership::SiteRole;
use crate::services::{
    audit_service, bulk_content_service::BulkContentService, content_service::ContentService,
    notification_service, webhook_service, workflow_service,
};
use crate::utils::pagination::PaginationParams;
use crate::AppState;

/// List all pages for a site (paginated)
#[utoipa::path(
    tag = "Pages",
    operation_id = "list_pages",
    description = "List all pages for a site (paginated)",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default 1)"),
        ("per_page" = Option<i64>, Query, description = "Items per page (default 10, max 100)")
    ),
    responses(
        (status = 200, description = "Paginated page list", body = PaginatedPages),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/pages?<page>&<per_page>")]
pub async fn list_pages(
    state: &State<AppState>,
    site_id: Uuid,
    page: Option<i64>,
    per_page: Option<i64>,
    auth: ReadKey,
) -> Result<Json<PaginatedPages>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let params = PaginationParams::new(page, per_page);
    let (limit, offset) = params.limit_offset();

    let pages = Page::find_all_for_site(&state.db, site_id, limit, offset).await?;
    let total = Page::count_for_site(&state.db, site_id).await?;

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
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    for site_id in &req.site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Author)
            .await?;
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
    let old = serde_json::to_value(&existing).ok();

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

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
                auth.0.clerk_user_id().map(String::from),
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

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

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

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

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

    PageSection::delete(&state.db, id).await?;
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

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

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

    // Content must be InReview
    if page.status != ContentStatus::InReview {
        return Err(ApiError::BadRequest(
            "Content must be in 'InReview' status to perform a review action.".to_string(),
        ));
    }

    let req = body.into_inner();
    let site_id = site_ids.into_iter().next();

    let is_approve = matches!(req.action, ReviewAction::Approve);
    let (new_status, audit_action, message) = if is_approve {
        let status = if page
            .publish_start
            .map(|s| s > chrono::Utc::now())
            .unwrap_or(false)
        {
            ContentStatus::Scheduled
        } else {
            ContentStatus::Published
        };
        (
            status,
            AuditAction::Approve,
            "Content approved and published.",
        )
    } else {
        (
            ContentStatus::Draft,
            AuditAction::RequestChanges,
            "Changes requested. Content moved back to Draft.",
        )
    };

    ContentService::update_content(
        &state.db,
        page.content_id,
        None,
        Some(&new_status),
        None,
        None,
    )
    .await?;

    let metadata = req
        .comment
        .as_ref()
        .map(|c| serde_json::json!({ "comment": c }));
    audit_service::log_action(
        &state.db,
        site_id,
        Some(auth.0.id),
        audit_action,
        "page",
        id,
        metadata,
    )
    .await;

    if let Some(sid) = site_id {
        webhook_service::dispatch(
            state.db.clone(),
            sid,
            "page.reviewed",
            id,
            serde_json::json!({
                "status": new_status,
                "message": message,
            }),
        );

        // Notify the content creator about the review result
        let content = Content::find_by_id(&state.db, page.content_id).await?;
        let slug = page.slug.clone().unwrap_or_else(|| page.route.clone());
        let actor_clerk_id = auth.0.clerk_user_id().map(String::from);
        if is_approve {
            notification_service::notify_content_approved(
                state.db.clone(),
                sid,
                "page",
                id,
                &slug,
                content.created_by,
                actor_clerk_id,
            );
        } else {
            notification_service::notify_changes_requested(
                state.db.clone(),
                sid,
                "page",
                id,
                &slug,
                content.created_by,
                actor_clerk_id,
                req.comment,
            );
        }
    }

    Ok(Json(ReviewActionResponse {
        status: new_status,
        message: message.to_string(),
    }))
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
) -> Result<Json<BulkContentResponse>, ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let required_role = match req.action {
        BulkAction::Delete => SiteRole::Editor,
        BulkAction::UpdateStatus => SiteRole::Author,
    };
    auth.0
        .authorize_site_action(&state.db, site_id, &required_role)
        .await?;

    if matches!(req.action, BulkAction::UpdateStatus) && req.status.is_none() {
        return Err(ApiError::BadRequest(
            "status field is required for UpdateStatus action".to_string(),
        ));
    }

    let mut pairs = Vec::with_capacity(req.ids.len());
    for page_id in &req.ids {
        match Page::find_by_id(&state.db, *page_id).await {
            Ok(page) => pairs.push((*page_id, page.content_id)),
            Err(_) => {
                pairs.push((*page_id, Uuid::nil()));
            }
        }
    }

    let response = match req.action {
        BulkAction::UpdateStatus => {
            let target_status = req.status.as_ref().unwrap();
            let valid_pairs: Vec<_> = pairs
                .iter()
                .filter(|(_, cid)| !cid.is_nil())
                .copied()
                .collect();
            let mut resp =
                BulkContentService::bulk_update_status(&state.db, &valid_pairs, target_status)
                    .await;

            for &(page_id, content_id) in &pairs {
                if content_id.is_nil() {
                    resp.failed += 1;
                    resp.results.push(crate::dto::bulk::BulkItemResult {
                        id: page_id,
                        success: false,
                        error: Some(format!("Page {} not found", page_id)),
                    });
                }
            }
            resp.total = pairs.len();

            for result in &resp.results {
                if result.success {
                    audit_service::log_action(&state.db, Some(site_id), Some(auth.0.id), AuditAction::Update, "page", result.id, Some(serde_json::json!({"bulk_action": "update_status", "status": target_status}))).await;
                    webhook_service::dispatch(
                        state.db.clone(),
                        site_id,
                        "page.updated",
                        result.id,
                        serde_json::json!({"bulk": true, "status": target_status}),
                    );
                }
            }
            resp
        }
        BulkAction::Delete => {
            let valid_pairs: Vec<_> = pairs
                .iter()
                .filter(|(_, cid)| !cid.is_nil())
                .copied()
                .collect();
            let mut resp = BulkContentService::bulk_delete(&state.db, &valid_pairs).await;

            for &(page_id, content_id) in &pairs {
                if content_id.is_nil() {
                    resp.failed += 1;
                    resp.results.push(crate::dto::bulk::BulkItemResult {
                        id: page_id,
                        success: false,
                        error: Some(format!("Page {} not found", page_id)),
                    });
                }
            }
            resp.total = pairs.len();

            for result in &resp.results {
                if result.success {
                    audit_service::log_action(
                        &state.db,
                        Some(site_id),
                        Some(auth.0.id),
                        AuditAction::Delete,
                        "page",
                        result.id,
                        Some(serde_json::json!({"bulk_action": "delete"})),
                    )
                    .await;
                    webhook_service::dispatch(
                        state.db.clone(),
                        site_id,
                        "page.deleted",
                        result.id,
                        serde_json::json!({"id": result.id, "bulk": true}),
                    );
                }
            }
            resp
        }
    };

    Ok(Json(response))
}

/// Collect page routes
pub fn routes() -> Vec<Route> {
    routes![
        list_pages,
        get_page,
        get_page_by_route,
        get_page_sections,
        create_page,
        update_page,
        delete_page,
        clone_page,
        review_page,
        create_page_section,
        update_page_section,
        delete_page_section,
        get_section_localizations,
        get_page_section_localizations,
        upsert_section_localization,
        delete_section_localization,
        bulk_pages
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 17, "Should have 17 page routes");
    }
}
