//! Blog handlers

use std::io::Cursor;

use chrono::Utc;
use rocket::http::{ContentType, Header, Status};
use rocket::response::{self, Responder, Response};
use rocket::serde::json::Json;
use rocket::{Request, Route, State};
use rss::{ChannelBuilder, GuidBuilder, ItemBuilder};
use uuid::Uuid;
use validator::Validate;

use crate::dto::blog::{
    BlogDetailResponse, BlogListItem, BlogResponse, CreateBlogRequest, PaginatedBlogs,
    UpdateBlogRequest,
};
use crate::dto::bulk::{BulkAction, BulkContentRequest, BulkContentResponse};
use crate::dto::content::{
    CreateLocalizationRequest, LocalizationResponse, UpdateLocalizationRequest,
};
use crate::dto::document::BlogDocumentResponse;
use crate::dto::review::{ReviewAction, ReviewActionRequest, ReviewActionResponse};
use crate::dto::taxonomy::CategoryResponse;
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::models::audit::AuditAction;
use crate::models::blog::Blog;
use crate::models::content::{Content, ContentLocalization, ContentStatus};
use crate::models::document::{BlogDocument, DocumentLocalization};
use crate::models::site::Site;
use crate::models::site_membership::SiteRole;
use crate::models::taxonomy::Category;
use crate::services::{
    audit_service, bulk_content_service::BulkContentService, content_service::ContentService,
    notification_service, webhook_service, workflow_service,
};
use crate::utils::pagination::PaginationParams;
use crate::AppState;

/// Custom responder for RSS XML feeds
pub struct RssResponse(pub String);

impl<'r> Responder<'r, 'static> for RssResponse {
    fn respond_to(self, _req: &'r Request<'_>) -> response::Result<'static> {
        Response::build()
            .status(Status::Ok)
            .header(ContentType::new("application", "rss+xml"))
            .header(Header::new("Cache-Control", "public, max-age=3600"))
            .sized_body(self.0.len(), Cursor::new(self.0))
            .ok()
    }
}

/// List all blogs for a site (paginated)
#[utoipa::path(
    tag = "Blogs",
    operation_id = "list_blogs",
    description = "List all blogs for a site (paginated)",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default 1)"),
        ("per_page" = Option<i64>, Query, description = "Items per page (default 10, max 100)")
    ),
    responses(
        (status = 200, description = "Paginated blog list", body = PaginatedBlogs),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/blogs?<page>&<per_page>")]
pub async fn list_blogs(
    state: &State<AppState>,
    site_id: Uuid,
    page: Option<i64>,
    per_page: Option<i64>,
    auth: ReadKey,
) -> Result<Json<PaginatedBlogs>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let params = PaginationParams::new(page, per_page);
    let (limit, offset) = params.limit_offset();

    let blogs = Blog::find_all_for_site(&state.db, site_id, limit, offset).await?;
    let total = Blog::count_for_site(&state.db, site_id).await?;

    let items: Vec<BlogListItem> = blogs.into_iter().map(BlogListItem::from).collect();
    let paginated = params.paginate(items, total);

    Ok(Json(paginated))
}

/// List published blogs for a site (public endpoint)
#[utoipa::path(
    tag = "Blogs",
    operation_id = "list_published_blogs",
    description = "List published blogs for a site (public)",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default 1)"),
        ("per_page" = Option<i64>, Query, description = "Items per page (default 10, max 100)")
    ),
    responses(
        (status = 200, description = "Paginated published blogs", body = PaginatedBlogs),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/blogs/published?<page>&<per_page>")]
pub async fn list_published_blogs(
    state: &State<AppState>,
    site_id: Uuid,
    page: Option<i64>,
    per_page: Option<i64>,
    auth: ReadKey,
) -> Result<Json<PaginatedBlogs>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let params = PaginationParams::new(page, per_page);
    let (limit, offset) = params.limit_offset();

    let blogs = Blog::find_published_for_site(&state.db, site_id, limit, offset).await?;
    let total = Blog::count_published_for_site(&state.db, site_id).await?;

    let items: Vec<BlogListItem> = blogs.into_iter().map(BlogListItem::from).collect();
    let paginated = params.paginate(items, total);

    Ok(Json(paginated))
}

/// Get featured blogs for a site
#[utoipa::path(
    tag = "Blogs",
    operation_id = "list_featured_blogs",
    description = "Get featured blogs for a site",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("limit" = Option<i64>, Query, description = "Max results (default 5, max 20)")
    ),
    responses(
        (status = 200, description = "Featured blogs", body = Vec<BlogListItem>),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/blogs/featured?<limit>")]
pub async fn list_featured_blogs(
    state: &State<AppState>,
    site_id: Uuid,
    limit: Option<i64>,
    auth: ReadKey,
) -> Result<Json<Vec<BlogListItem>>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let limit = limit.unwrap_or(5).min(20);
    let blogs = Blog::find_featured_for_site(&state.db, site_id, limit).await?;
    let items: Vec<BlogListItem> = blogs.into_iter().map(BlogListItem::from).collect();
    Ok(Json(items))
}

/// Get blog by ID
#[utoipa::path(
    tag = "Blogs",
    operation_id = "get_blog",
    description = "Get a blog post by ID",
    params(("id" = Uuid, Path, description = "Blog UUID")),
    responses(
        (status = 200, description = "Blog details", body = BlogResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Blog not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/blogs/<id>")]
pub async fn get_blog(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Json<BlogResponse>, ApiError> {
    let blog = Blog::find_by_id(&state.db, id).await?;
    let site_ids = Content::find_site_ids(&state.db, blog.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Viewer)
            .await?;
    }
    Ok(Json(BlogResponse::from(blog)))
}

/// Get blog by slug within a site
#[utoipa::path(
    tag = "Blogs",
    operation_id = "get_blog_by_slug",
    description = "Get a blog post by slug within a site",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("slug" = String, Path, description = "Blog slug")
    ),
    responses(
        (status = 200, description = "Blog details", body = BlogResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Blog not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/blogs/by-slug/<slug>")]
pub async fn get_blog_by_slug(
    state: &State<AppState>,
    site_id: Uuid,
    slug: &str,
    auth: ReadKey,
) -> Result<Json<BlogResponse>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let blog = Blog::find_by_slug(&state.db, site_id, slug).await?;
    Ok(Json(BlogResponse::from(blog)))
}

/// Create a new blog post
#[utoipa::path(
    tag = "Blogs",
    operation_id = "create_blog",
    description = "Create a new blog post",
    request_body(content = CreateBlogRequest, description = "Blog creation data"),
    responses(
        (status = 201, description = "Blog created", body = BlogResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/blogs", data = "<body>")]
pub async fn create_blog(
    state: &State<AppState>,
    body: Json<CreateBlogRequest>,
    auth: ReadKey,
) -> Result<(Status, Json<BlogResponse>), ApiError> {
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

    let blog = Blog::create(&state.db, req).await?;
    let site_id = Content::find_site_ids(&state.db, blog.content_id)
        .await?
        .into_iter()
        .next();
    audit_service::log_action(
        &state.db,
        site_id,
        Some(auth.0.id),
        AuditAction::Create,
        "blog",
        blog.id,
        None,
    )
    .await;
    if let Some(sid) = site_id {
        webhook_service::dispatch(
            state.db.clone(),
            sid,
            "blog.created",
            blog.id,
            serde_json::to_value(BlogResponse::from(blog.clone())).unwrap_or_default(),
        );
    }
    Ok((Status::Created, Json(BlogResponse::from(blog))))
}

/// Update a blog post
#[utoipa::path(
    tag = "Blogs",
    operation_id = "update_blog",
    description = "Update a blog post",
    params(("id" = Uuid, Path, description = "Blog UUID")),
    request_body(content = UpdateBlogRequest, description = "Blog update data"),
    responses(
        (status = 200, description = "Blog updated", body = BlogResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Blog not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[put("/blogs/<id>", data = "<body>")]
pub async fn update_blog(
    state: &State<AppState>,
    id: Uuid,
    body: Json<UpdateBlogRequest>,
    auth: ReadKey,
) -> Result<Json<BlogResponse>, ApiError> {
    let existing = Blog::find_by_id(&state.db, id).await?;
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

    let blog = Blog::update(&state.db, id, req).await?;
    let site_id = site_ids.into_iter().next();
    audit_service::log_action(
        &state.db,
        site_id,
        Some(auth.0.id),
        AuditAction::Update,
        "blog",
        id,
        None,
    )
    .await;
    if let (Some(old), Ok(new)) = (old, serde_json::to_value(&blog)) {
        audit_service::log_changes(&state.db, site_id, "blog", id, Some(auth.0.id), &old, &new)
            .await;
    }
    if let Some(sid) = site_id {
        webhook_service::dispatch(
            state.db.clone(),
            sid,
            "blog.updated",
            id,
            serde_json::to_value(BlogResponse::from(blog.clone())).unwrap_or_default(),
        );
        // Notify reviewers when content is submitted for review
        if blog.status == ContentStatus::InReview && existing.status != ContentStatus::InReview {
            let slug = blog.slug.clone().unwrap_or_else(|| id.to_string());
            notification_service::notify_content_submitted(
                state.db.clone(),
                sid,
                "blog",
                id,
                &slug,
                auth.0.clerk_user_id().map(String::from),
            );
        }
    }
    Ok(Json(BlogResponse::from(blog)))
}

/// Delete a blog post (soft delete)
#[utoipa::path(
    tag = "Blogs",
    operation_id = "delete_blog",
    description = "Soft delete a blog post",
    params(("id" = Uuid, Path, description = "Blog UUID")),
    responses(
        (status = 204, description = "Blog deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Blog not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/blogs/<id>")]
pub async fn delete_blog(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    let blog = Blog::find_by_id(&state.db, id).await?;
    let site_ids = Content::find_site_ids(&state.db, blog.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Editor)
            .await?;
    }

    Blog::soft_delete(&state.db, id).await?;
    let site_id = site_ids.into_iter().next();
    audit_service::log_action(
        &state.db,
        site_id,
        Some(auth.0.id),
        AuditAction::Delete,
        "blog",
        id,
        None,
    )
    .await;
    if let Some(sid) = site_id {
        webhook_service::dispatch(
            state.db.clone(),
            sid,
            "blog.deleted",
            id,
            serde_json::json!({"id": id}),
        );
    }
    Ok(Status::NoContent)
}

/// Clone a blog post
#[utoipa::path(
    tag = "Blogs",
    operation_id = "clone_blog",
    description = "Clone an existing blog post as a new Draft",
    params(("id" = Uuid, Path, description = "Source blog UUID")),
    responses(
        (status = 201, description = "Blog cloned", body = BlogResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Source blog not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/blogs/<id>/clone")]
pub async fn clone_blog(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<(Status, Json<BlogResponse>), ApiError> {
    let existing = Blog::find_by_id(&state.db, id).await?;
    let site_ids = Content::find_site_ids(&state.db, existing.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Author)
            .await?;
    }

    let blog = Blog::clone_blog(&state.db, id, site_ids.clone()).await?;
    let site_id = site_ids.into_iter().next();
    let metadata = serde_json::json!({ "cloned_from": id.to_string() });
    audit_service::log_action(
        &state.db,
        site_id,
        Some(auth.0.id),
        AuditAction::Create,
        "blog",
        blog.id,
        Some(metadata),
    )
    .await;
    if let Some(sid) = site_id {
        webhook_service::dispatch(
            state.db.clone(),
            sid,
            "blog.created",
            blog.id,
            serde_json::to_value(BlogResponse::from(blog.clone())).unwrap_or_default(),
        );
    }
    Ok((Status::Created, Json(BlogResponse::from(blog))))
}

/// Get blog detail (blog + all localizations + categories)
#[utoipa::path(
    tag = "Blogs",
    operation_id = "get_blog_detail",
    description = "Get blog with all localizations and categories",
    params(("id" = Uuid, Path, description = "Blog UUID")),
    responses(
        (status = 200, description = "Blog detail with localizations", body = BlogDetailResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Blog not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/blogs/<id>/detail")]
pub async fn get_blog_detail(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Json<BlogDetailResponse>, ApiError> {
    let blog = Blog::find_by_id(&state.db, id).await?;
    let site_ids = Content::find_site_ids(&state.db, blog.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Viewer)
            .await?;
    }
    let localizations =
        ContentLocalization::find_all_for_content(&state.db, blog.content_id).await?;
    let loc_responses: Vec<LocalizationResponse> = localizations
        .into_iter()
        .map(LocalizationResponse::from)
        .collect();
    let categories = Category::find_for_content(&state.db, blog.content_id).await?;
    let cat_responses: Vec<CategoryResponse> =
        categories.into_iter().map(CategoryResponse::from).collect();

    // Fetch attached documents with localizations
    let blog_docs = BlogDocument::find_all_for_blog(&state.db, id).await?;
    let mut doc_responses = Vec::new();
    for detail in blog_docs {
        let doc_locs =
            DocumentLocalization::find_all_for_document(&state.db, detail.document_id).await?;
        doc_responses.push(BlogDocumentResponse::from_parts(detail, doc_locs));
    }

    Ok(Json(BlogDetailResponse {
        blog: BlogResponse::from(blog),
        localizations: loc_responses,
        categories: cat_responses,
        documents: doc_responses,
    }))
}

/// Get blog localizations
#[utoipa::path(
    tag = "Blogs",
    operation_id = "get_blog_localizations",
    description = "Get all localizations for a blog",
    params(("id" = Uuid, Path, description = "Blog UUID")),
    responses(
        (status = 200, description = "Blog localizations", body = Vec<LocalizationResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Blog not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/blogs/<id>/localizations")]
pub async fn get_blog_localizations(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Json<Vec<LocalizationResponse>>, ApiError> {
    let blog = Blog::find_by_id(&state.db, id).await?;
    let site_ids = Content::find_site_ids(&state.db, blog.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Viewer)
            .await?;
    }
    let localizations =
        ContentLocalization::find_all_for_content(&state.db, blog.content_id).await?;
    let responses: Vec<LocalizationResponse> = localizations
        .into_iter()
        .map(LocalizationResponse::from)
        .collect();
    Ok(Json(responses))
}

/// Create a localization for a blog
#[utoipa::path(
    tag = "Blogs",
    operation_id = "create_blog_localization",
    description = "Create a localization for a blog",
    params(("id" = Uuid, Path, description = "Blog UUID")),
    request_body(content = CreateLocalizationRequest, description = "Localization data"),
    responses(
        (status = 201, description = "Localization created", body = LocalizationResponse),
        (status = 400, description = "Validation error or duplicate locale", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/blogs/<id>/localizations", data = "<body>")]
pub async fn create_blog_localization(
    state: &State<AppState>,
    id: Uuid,
    body: Json<CreateLocalizationRequest>,
    auth: ReadKey,
) -> Result<(Status, Json<LocalizationResponse>), ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let blog = Blog::find_by_id(&state.db, id).await?;
    let site_ids = Content::find_site_ids(&state.db, blog.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Author)
            .await?;
    }

    // Check for duplicate locale
    let existing = ContentLocalization::find_all_for_content(&state.db, blog.content_id).await?;
    if existing.iter().any(|l| l.locale_id == req.locale_id) {
        return Err(ApiError::BadRequest(format!(
            "Localization for locale {} already exists",
            req.locale_id
        )));
    }

    let localization = ContentLocalization::create(
        &state.db,
        blog.content_id,
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

/// Update a blog localization
#[utoipa::path(
    tag = "Blogs",
    operation_id = "update_blog_localization",
    description = "Update a blog localization",
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
#[put("/blogs/localizations/<loc_id>", data = "<body>")]
pub async fn update_blog_localization(
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

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

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

/// Delete a blog localization
#[utoipa::path(
    tag = "Blogs",
    operation_id = "delete_blog_localization",
    description = "Delete a blog localization",
    params(("loc_id" = Uuid, Path, description = "Localization UUID")),
    responses(
        (status = 204, description = "Localization deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Localization not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/blogs/localizations/<loc_id>")]
pub async fn delete_blog_localization(
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

    ContentLocalization::delete(&state.db, loc_id).await?;
    Ok(Status::NoContent)
}

/// Review a blog post (approve or request changes)
#[utoipa::path(
    tag = "Blogs",
    operation_id = "review_blog",
    description = "Approve or request changes on a blog post (editorial workflow)",
    params(("id" = Uuid, Path, description = "Blog UUID")),
    request_body(content = ReviewActionRequest, description = "Review action"),
    responses(
        (status = 200, description = "Review action completed", body = ReviewActionResponse),
        (status = 400, description = "Content is not in review", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Blog not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/blogs/<id>/review", data = "<body>")]
pub async fn review_blog(
    state: &State<AppState>,
    id: Uuid,
    body: Json<ReviewActionRequest>,
    auth: ReadKey,
) -> Result<Json<ReviewActionResponse>, ApiError> {
    let blog = Blog::find_by_id(&state.db, id).await?;
    let site_ids = Content::find_site_ids(&state.db, blog.content_id).await?;
    for site_id in &site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Reviewer)
            .await?;
    }

    // Content must be InReview
    if blog.status != ContentStatus::InReview {
        return Err(ApiError::BadRequest(
            "Content must be in 'InReview' status to perform a review action.".to_string(),
        ));
    }

    let req = body.into_inner();
    let site_id = site_ids.into_iter().next();

    let is_approve = matches!(req.action, ReviewAction::Approve);
    let (new_status, audit_action, message) = if is_approve {
        // If publish_start is in the future, set Scheduled instead of Published
        let status = if blog
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

    // Update content status
    ContentService::update_content(
        &state.db,
        blog.content_id,
        None,
        Some(&new_status),
        None,
        None,
    )
    .await?;

    // Log audit with optional comment in metadata
    let metadata = req
        .comment
        .as_ref()
        .map(|c| serde_json::json!({ "comment": c }));
    audit_service::log_action(
        &state.db,
        site_id,
        Some(auth.0.id),
        audit_action,
        "blog",
        id,
        metadata,
    )
    .await;

    if let Some(sid) = site_id {
        webhook_service::dispatch(
            state.db.clone(),
            sid,
            "blog.reviewed",
            id,
            serde_json::json!({
                "status": new_status,
                "message": message,
            }),
        );

        // Notify the content creator about the review result
        let content = Content::find_by_id(&state.db, blog.content_id).await?;
        let slug = blog.slug.clone().unwrap_or_else(|| id.to_string());
        let actor_clerk_id = auth.0.clerk_user_id().map(String::from);
        if is_approve {
            notification_service::notify_content_approved(
                state.db.clone(),
                sid,
                "blog",
                id,
                &slug,
                content.created_by,
                actor_clerk_id,
            );
        } else {
            notification_service::notify_changes_requested(
                state.db.clone(),
                sid,
                "blog",
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

/// RSS feed for a site's published blog posts
#[utoipa::path(
    tag = "Blogs",
    operation_id = "rss_feed",
    description = "Get an RSS 2.0 feed of published blog posts for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "RSS 2.0 XML feed", content_type = "application/rss+xml"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/feed.rss")]
pub async fn rss_feed(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
) -> Result<RssResponse, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;

    let site = Site::find_by_id(&state.db, site_id).await?;

    // Lookup the primary production domain for link URLs
    let domain: Option<String> = sqlx::query_scalar(
        "SELECT domain FROM site_domains WHERE site_id = $1 AND is_primary = TRUE AND environment = 'production' LIMIT 1"
    )
    .bind(site_id)
    .fetch_optional(&state.db)
    .await?;
    let base_url = domain.map(|d| format!("https://{d}")).unwrap_or_default();

    // Fetch last 50 published posts
    let blogs = Blog::find_published_for_site(&state.db, site_id, 50, 0).await?;

    // Build RSS items
    let mut items = Vec::with_capacity(blogs.len());
    for blog in &blogs {
        let localizations =
            ContentLocalization::find_all_for_content(&state.db, blog.content_id).await?;
        let loc = match localizations.first() {
            Some(l) => l,
            None => continue, // skip blogs with no localizations
        };

        let description = loc
            .excerpt
            .clone()
            .or_else(|| {
                loc.body.as_ref().map(|b| {
                    if b.len() > 500 {
                        format!("{}…", &b[..500])
                    } else {
                        b.clone()
                    }
                })
            })
            .unwrap_or_default();

        let link = blog
            .slug
            .as_ref()
            .map(|s| format!("{base_url}/blog/{s}"))
            .unwrap_or_default();

        let guid = GuidBuilder::default()
            .value(blog.id.to_string())
            .permalink(false)
            .build();

        let pub_date = blog
            .published_date
            .and_hms_opt(0, 0, 0)
            .and_then(|dt| {
                dt.and_local_timezone(chrono::FixedOffset::east_opt(0).unwrap())
                    .single()
            })
            .map(|dt| dt.to_rfc2822());

        let item = ItemBuilder::default()
            .title(Some(loc.title.clone()))
            .link(Some(link))
            .description(Some(description))
            .author(Some(blog.author.clone()))
            .guid(Some(guid))
            .pub_date(pub_date)
            .build();

        items.push(item);
    }

    let channel = ChannelBuilder::default()
        .title(&site.name)
        .link(&base_url)
        .description(site.description.unwrap_or_default())
        .language(Some("en".to_string()))
        .last_build_date(Some(Utc::now().to_rfc2822()))
        .generator(Some("OpenYapper".to_string()))
        .items(items)
        .build();

    Ok(RssResponse(channel.to_string()))
}

/// Bulk action on blogs for a site
#[utoipa::path(
    tag = "Blogs",
    operation_id = "bulk_blogs",
    description = "Perform a bulk action (update status or delete) on multiple blogs",
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
#[post("/sites/<site_id>/blogs/bulk", data = "<body>")]
pub async fn bulk_blogs(
    state: &State<AppState>,
    site_id: Uuid,
    body: Json<BulkContentRequest>,
    auth: ReadKey,
) -> Result<Json<BulkContentResponse>, ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    // Delete requires Editor role, status update requires Author
    let required_role = match req.action {
        BulkAction::Delete => SiteRole::Editor,
        BulkAction::UpdateStatus => SiteRole::Author,
    };
    auth.0
        .authorize_site_action(&state.db, site_id, &required_role)
        .await?;

    // Validate: UpdateStatus requires a status field
    if matches!(req.action, BulkAction::UpdateStatus) && req.status.is_none() {
        return Err(ApiError::BadRequest(
            "status field is required for UpdateStatus action".to_string(),
        ));
    }

    // Resolve blog IDs → (blog_id, content_id) pairs
    let mut pairs = Vec::with_capacity(req.ids.len());
    for blog_id in &req.ids {
        match Blog::find_by_id(&state.db, *blog_id).await {
            Ok(blog) => pairs.push((*blog_id, blog.content_id)),
            Err(_) => {
                // Will be reported as a failure in the response
                pairs.push((*blog_id, Uuid::nil()));
            }
        }
    }

    let response = match req.action {
        BulkAction::UpdateStatus => {
            let target_status = req.status.as_ref().unwrap();
            // Filter out entries with nil content_id (not found)
            let valid_pairs: Vec<_> = pairs
                .iter()
                .filter(|(_, cid)| !cid.is_nil())
                .copied()
                .collect();
            let mut resp =
                BulkContentService::bulk_update_status(&state.db, &valid_pairs, target_status)
                    .await;

            // Add not-found entries as failures
            for &(blog_id, content_id) in &pairs {
                if content_id.is_nil() {
                    resp.failed += 1;
                    resp.results.push(crate::dto::bulk::BulkItemResult {
                        id: blog_id,
                        success: false,
                        error: Some(format!("Blog {} not found", blog_id)),
                    });
                }
            }
            resp.total = pairs.len();

            // Audit + webhooks for successful items
            for result in &resp.results {
                if result.success {
                    audit_service::log_action(&state.db, Some(site_id), Some(auth.0.id), AuditAction::Update, "blog", result.id, Some(serde_json::json!({"bulk_action": "update_status", "status": target_status}))).await;
                    webhook_service::dispatch(
                        state.db.clone(),
                        site_id,
                        "blog.updated",
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

            for &(blog_id, content_id) in &pairs {
                if content_id.is_nil() {
                    resp.failed += 1;
                    resp.results.push(crate::dto::bulk::BulkItemResult {
                        id: blog_id,
                        success: false,
                        error: Some(format!("Blog {} not found", blog_id)),
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
                        "blog",
                        result.id,
                        Some(serde_json::json!({"bulk_action": "delete"})),
                    )
                    .await;
                    webhook_service::dispatch(
                        state.db.clone(),
                        site_id,
                        "blog.deleted",
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

/// Collect blog routes
pub fn routes() -> Vec<Route> {
    routes![
        list_blogs,
        list_published_blogs,
        list_featured_blogs,
        get_blog,
        get_blog_by_slug,
        create_blog,
        update_blog,
        delete_blog,
        clone_blog,
        review_blog,
        get_blog_detail,
        get_blog_localizations,
        create_blog_localization,
        update_blog_localization,
        delete_blog_localization,
        rss_feed,
        bulk_blogs
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 17, "Should have 17 blog routes");
    }
}
