//! Axum port of `crate::handlers::blog`. 22 endpoints — full content
//! CRUD with publish-gate / workflow-service / publish-hooks pipelines,
//! plus public listing (paginated, by-category, featured, similar),
//! detail, localizations, review, RSS feed, bulk operations, and sample
//! content seeding. Last of the "big three" content bundles.

use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderValue, Response, StatusCode, header};
use axum::response::{IntoResponse, Json};
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::AppState;
use crate::axum_app::authorized_content::{
    AuthorizedContent, AuthorizedContentWithOwnership, AuthorizedJson, AuthorizedSite, Create,
    Delete, Read, Update,
};
use crate::axum_app::extractors::ResolveLocale;
use crate::dto::blog::{
    BlogDetailResponse, BlogListItem, BlogResponse, BlogStatusCounts, CreateBlogRequest,
    PaginatedBlogs, UpdateBlogRequest,
};
use crate::dto::bulk::{BulkAction, BulkContentRequest, BulkContentResponse};
use crate::dto::content::{
    CreateLocalizationRequest, LocalizationResponse, UpdateLocalizationRequest,
};
use crate::dto::document::BlogDocumentResponse;
use crate::dto::review::{ReviewActionRequest, ReviewActionResponse};
use crate::dto::taxonomy::{CategoryResponse, TagResponse};
use crate::errors::{ApiError, ProblemDetails, codes};
use crate::guards::actor::Actor;
use crate::guards::auth_guard::{ReadKey, WriteKey};
use crate::guards::module_guard::{BlogModule, ModuleGuard};
use crate::models::blog::BlogWithContent;
use crate::models::content::ContentLocalization;
use crate::models::site::Site;
use crate::models::site_locale::SiteLocale;
use crate::models::taxonomy::{Category, Tag};
use crate::repos::blog_repo::BlogRepo;
use crate::repos::document_repo::{BlogDocumentRepo, DocumentLocalizationRepo};
use crate::services::blog_rss_service;
use crate::services::content_lifecycle;
use crate::services::localization_lifecycle::{self, blog::BlogLocalization};
use crate::services::permission_service::{Permission, PermissionService};
use crate::services::{
    bulk_content_service::BulkContentService,
    review_service::{ReviewContext, ReviewService},
};
use crate::utils::locale_resolver::collapse_localizations;
use crate::utils::pagination::PaginationParams;
use crate::utils::seo;

const DEFAULT_FEATURED_LIMIT: i64 = 5;
const MAX_FEATURED_LIMIT: i64 = 20;
const DEFAULT_SIMILAR_LIMIT: i64 = 3;
const MAX_SIMILAR_LIMIT: i64 = 10;

/// Carries an RSS XML body into an Axum response with the right
/// content-type and a one-hour public cache. Mirrors the file-response
/// pattern from `axum_app::handlers::files::FileResponse`.
pub struct RssResponse(pub String);

impl IntoResponse for RssResponse {
    fn into_response(self) -> Response<Body> {
        Response::builder()
            .status(StatusCode::OK)
            .header(
                header::CONTENT_TYPE,
                HeaderValue::from_static("application/rss+xml"),
            )
            .header(
                header::CACHE_CONTROL,
                HeaderValue::from_static("public, max-age=3600"),
            )
            .body(Body::from(self.0))
            .expect("static headers + string body never fail")
    }
}

#[derive(Debug, Deserialize)]
struct ListBlogsQuery {
    page: Option<i64>,
    page_size: Option<i64>,
    search: Option<String>,
    status: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
    exclude_status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ListPublishedQuery {
    page: Option<i64>,
    page_size: Option<i64>,
    locale_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
struct LimitQuery {
    limit: Option<i64>,
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/blogs",
    tag = "Blogs",
    operation_id = "list_blogs",
    description = "List all blogs for a site (paginated, with optional search/filter/sort)",
    params(
        ("site_id" = Uuid, Path, description = "The UUID of the site. Use GET /sites to list available sites."),
        ("page" = Option<i64>, Query, description = "Page number, 1-indexed (default: 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page, 1–100 (default: 10)"),
        ("search" = Option<String>, Query, description = "Case-insensitive search across blog ID, slug, and author fields (ILIKE)"),
        ("status" = Option<String>, Query, description = "Filter by content status: Draft, InReview, Scheduled, Published, Archived"),
        ("sort_by" = Option<String>, Query, description = "Sort column: slug, author, published_date, status, created_at"),
        ("sort_dir" = Option<String>, Query, description = "Sort direction: asc or desc (default: asc)"),
        ("exclude_status" = Option<String>, Query, description = "Exclude items with this status: Draft, InReview, Scheduled, Published, Archived (e.g. Archived)")
    ),
    responses(
        (status = 200, description = "Paginated blog list", body = PaginatedBlogs),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_blogs(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<ListBlogsQuery>,
    _access: AuthorizedSite<BlogWithContent, Read>,
) -> Result<Json<PaginatedBlogs>, ApiError> {
    let params = PaginationParams::new(q.page, q.page_size);
    let (limit, offset) = params.limit_offset();

    let has_filters = q.search.is_some()
        || q.status.is_some()
        || q.sort_by.is_some()
        || q.sort_dir.is_some()
        || q.exclude_status.is_some();

    let (blogs, total) = if has_filters {
        let blogs = BlogRepo::find_all_for_site_filtered(
            &state.db,
            site_id,
            limit,
            offset,
            q.search.as_deref(),
            q.status.as_deref(),
            q.sort_by.as_deref(),
            q.sort_dir.as_deref(),
            q.exclude_status.as_deref(),
        )
        .await?;
        let total = BlogRepo::count_for_site_filtered(
            &state.db,
            site_id,
            q.search.as_deref(),
            q.status.as_deref(),
            q.exclude_status.as_deref(),
        )
        .await?;
        (blogs, total)
    } else {
        let blogs = BlogRepo::find_all_for_site(&state.db, site_id, limit, offset).await?;
        let total = BlogRepo::count_for_site(&state.db, site_id).await?;
        (blogs, total)
    };

    let items: Vec<BlogListItem> = blogs.into_iter().map(BlogListItem::from).collect();
    Ok(Json(params.paginate(items, total)))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/blogs/published",
    tag = "Blogs",
    operation_id = "list_published_blogs",
    description = "List published blogs for a site (public)",
    params(
        ("site_id" = Uuid, Path, description = "The UUID of the site. Use GET /sites to list available sites."),
        ("page" = Option<i64>, Query, description = "Page number, 1-indexed (default: 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page, 1–100 (default: 10)"),
        ("locale_id" = Option<Uuid>, Query, description = "Filter to blogs with content in this locale (UUID)")
    ),
    responses(
        (status = 200, description = "Paginated published blogs", body = PaginatedBlogs),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_published_blogs(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<ListPublishedQuery>,
    _access: AuthorizedSite<BlogWithContent, Read>,
) -> Result<Json<PaginatedBlogs>, ApiError> {
    let params = PaginationParams::new(q.page, q.page_size);
    let suffix = format!(
        "blogs:published:p{}:ps{}:l{}",
        q.page.unwrap_or(1),
        q.page_size.unwrap_or(10),
        q.locale_id
            .map_or_else(|| "all".to_string(), |u| u.to_string()),
    );
    let result = crate::services::response_cache::cached(
        &state.redis,
        &crate::services::response_cache::key(site_id, &suffix),
        || async {
            let (limit, offset) = params.limit_offset();
            let (blogs, total) = if let Some(lid) = q.locale_id {
                let blogs = BlogRepo::find_published_for_site_by_locale(
                    &state.db, site_id, lid, limit, offset,
                )
                .await?;
                let total =
                    BlogRepo::count_published_for_site_by_locale(&state.db, site_id, lid).await?;
                (blogs, total)
            } else {
                let blogs =
                    BlogRepo::find_published_for_site(&state.db, site_id, limit, offset).await?;
                let total = BlogRepo::count_published_for_site(&state.db, site_id).await?;
                (blogs, total)
            };
            let items: Vec<BlogListItem> = blogs.into_iter().map(BlogListItem::from).collect();
            Ok(params.paginate(items, total))
        },
    )
    .await?;
    Ok(Json(result))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/blogs/published/category/{category_slug}",
    tag = "Blogs",
    operation_id = "list_published_blogs_by_category",
    description = "List published blogs filtered by category slug (public)",
    params(
        ("site_id" = Uuid, Path, description = "The UUID of the site. Use GET /sites to list available sites."),
        ("category_slug" = String, Path, description = "URL-safe category slug (e.g. 'tech', 'announcements')"),
        ("page" = Option<i64>, Query, description = "Page number, 1-indexed (default: 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page, 1–100 (default: 10)"),
        ("locale_id" = Option<Uuid>, Query, description = "Filter to blogs with content in this locale (UUID)")
    ),
    responses(
        (status = 200, description = "Paginated published blogs in category", body = PaginatedBlogs),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_published_blogs_by_category(
    State(state): State<AppState>,
    Path((site_id, category_slug)): Path<(Uuid, String)>,
    Query(q): Query<ListPublishedQuery>,
    _access: AuthorizedSite<BlogWithContent, Read>,
) -> Result<Json<PaginatedBlogs>, ApiError> {
    let params = PaginationParams::new(q.page, q.page_size);
    let suffix = format!(
        "blogs:cat:{}:p{}:ps{}:l{}",
        category_slug,
        q.page.unwrap_or(1),
        q.page_size.unwrap_or(10),
        q.locale_id
            .map_or_else(|| "all".to_string(), |u| u.to_string()),
    );
    let result = crate::services::response_cache::cached(
        &state.redis,
        &crate::services::response_cache::key(site_id, &suffix),
        || async {
            let (limit, offset) = params.limit_offset();
            let (blogs, total) = if let Some(lid) = q.locale_id {
                let blogs = BlogRepo::find_published_for_site_by_category_and_locale(
                    &state.db,
                    site_id,
                    &category_slug,
                    lid,
                    limit,
                    offset,
                )
                .await?;
                let total = BlogRepo::count_published_for_site_by_category_and_locale(
                    &state.db,
                    site_id,
                    &category_slug,
                    lid,
                )
                .await?;
                (blogs, total)
            } else {
                let blogs = BlogRepo::find_published_for_site_by_category(
                    &state.db,
                    site_id,
                    &category_slug,
                    limit,
                    offset,
                )
                .await?;
                let total = BlogRepo::count_published_for_site_by_category(
                    &state.db,
                    site_id,
                    &category_slug,
                )
                .await?;
                (blogs, total)
            };
            let items: Vec<BlogListItem> = blogs.into_iter().map(BlogListItem::from).collect();
            Ok(params.paginate(items, total))
        },
    )
    .await?;
    Ok(Json(result))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/blogs/featured",
    tag = "Blogs",
    operation_id = "list_featured_blogs",
    description = "Get featured blogs for a site",
    params(
        ("site_id" = Uuid, Path, description = "The UUID of the site. Use GET /sites to list available sites."),
        ("limit" = Option<i64>, Query, description = "Max results, 1–20 (default: 5)")
    ),
    responses(
        (status = 200, description = "Featured blogs", body = Vec<BlogListItem>),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_featured_blogs(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<LimitQuery>,
    _access: AuthorizedSite<BlogWithContent, Read>,
) -> Result<Json<Vec<BlogListItem>>, ApiError> {
    let limit = q
        .limit
        .unwrap_or(DEFAULT_FEATURED_LIMIT)
        .min(MAX_FEATURED_LIMIT);
    let items = crate::services::response_cache::cached(
        &state.redis,
        &crate::services::response_cache::key(site_id, &format!("blogs:featured:n{limit}")),
        || async {
            let blogs = BlogRepo::find_featured_for_site(&state.db, site_id, limit).await?;
            Ok(blogs
                .into_iter()
                .map(BlogListItem::from)
                .collect::<Vec<BlogListItem>>())
        },
    )
    .await?;
    Ok(Json(items))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/blogs/{id}/similar",
    tag = "Blogs",
    operation_id = "list_similar_blogs",
    description = "Get similar blogs ranked by taxonomy overlap (shared tags, categories) and author",
    params(
        ("site_id" = Uuid, Path, description = "The UUID of the site. Use GET /sites to list available sites."),
        ("id" = Uuid, Path, description = "The UUID of the source blog post to find similar content for"),
        ("limit" = Option<i64>, Query, description = "Max results, 1–10 (default: 3)")
    ),
    responses(
        (status = 200, description = "Similar blogs", body = Vec<BlogListItem>),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails),
        (status = 404, description = "Blog post not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_similar_blogs(
    State(state): State<AppState>,
    Path((site_id, id)): Path<(Uuid, Uuid)>,
    Query(q): Query<LimitQuery>,
    _access: AuthorizedSite<BlogWithContent, Read>,
) -> Result<Json<Vec<BlogListItem>>, ApiError> {
    BlogRepo::find_by_id(&state.db, id).await?;
    let limit = q
        .limit
        .unwrap_or(DEFAULT_SIMILAR_LIMIT)
        .clamp(1, MAX_SIMILAR_LIMIT);
    let blogs = BlogRepo::find_similar(&state.db, id, site_id, limit).await?;
    let items: Vec<BlogListItem> = blogs.into_iter().map(BlogListItem::from).collect();
    Ok(Json(items))
}

#[utoipa::path(
    get,
    path = "/blogs/{id}",
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
async fn get_blog(
    State(_state): State<AppState>,
    access: AuthorizedContent<BlogWithContent, Read>,
) -> Result<Json<BlogResponse>, ApiError> {
    Ok(Json(BlogResponse::from(access.entity)))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/blogs/by-slug/{slug}",
    tag = "Blogs",
    operation_id = "get_blog_by_slug",
    description = "Get a blog post by slug within a site",
    params(
        ("site_id" = Uuid, Path, description = "The UUID of the site. Use GET /sites to list available sites."),
        ("slug" = String, Path, description = "URL-safe blog slug (e.g. 'my-first-post')")
    ),
    responses(
        (status = 200, description = "Blog details", body = BlogResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails),
        (status = 404, description = "Blog post not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_blog_by_slug(
    State(state): State<AppState>,
    Path((site_id, slug)): Path<(Uuid, String)>,
    _access: AuthorizedSite<BlogWithContent, Read>,
) -> Result<Json<BlogResponse>, ApiError> {
    let response = crate::services::response_cache::cached(
        &state.redis,
        &crate::services::response_cache::key(site_id, &format!("blogs:by-slug:{slug}")),
        || async {
            let blog = BlogRepo::find_by_slug(&state.db, site_id, &slug).await?;
            Ok(BlogResponse::from(blog))
        },
    )
    .await?;
    Ok(Json(response))
}

#[utoipa::path(
    post,
    path = "/blogs",
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
async fn create_blog(
    State(state): State<AppState>,
    access: AuthorizedJson<BlogWithContent, CreateBlogRequest, Create>,
) -> Result<(StatusCode, Json<BlogResponse>), ApiError> {
    let blog = content_lifecycle::create::<BlogWithContent>(
        &state.db,
        access.validated.into_inner(),
        &access.actor,
    )
    .await?;
    Ok((StatusCode::CREATED, Json(BlogResponse::from(blog))))
}

#[utoipa::path(
    put,
    path = "/blogs/{id}",
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
async fn update_blog(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContentWithOwnership<BlogWithContent, Update>,
    crate::dto::validated::ValidatedJson(body): crate::dto::validated::ValidatedJson<
        UpdateBlogRequest,
    >,
) -> Result<Json<BlogResponse>, ApiError> {
    let blog = content_lifecycle::update::<BlogWithContent>(
        &state.db,
        id,
        body.into_inner(),
        access.entity,
        access.site_ids,
        &access.actor,
    )
    .await?;
    Ok(Json(BlogResponse::from(blog)))
}

#[utoipa::path(
    delete,
    path = "/blogs/{id}",
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
async fn delete_blog(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContentWithOwnership<BlogWithContent, Delete>,
) -> Result<StatusCode, ApiError> {
    content_lifecycle::blog::delete(&state.db, id, access.entity, access.site_ids, &access.actor)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/blogs/{id}/clone",
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
async fn clone_blog(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContent<BlogWithContent, Create>,
) -> Result<(StatusCode, Json<BlogResponse>), ApiError> {
    let blog =
        content_lifecycle::blog::clone(&state.db, id, access.site_ids, &access.actor).await?;
    Ok((StatusCode::CREATED, Json(BlogResponse::from(blog))))
}

#[utoipa::path(
    get,
    path = "/blogs/{id}/detail",
    tag = "Blogs",
    operation_id = "get_blog_detail",
    description = "Get blog with all localizations and categories",
    params(
        ("id" = Uuid, Path, description = "Blog UUID"),
        ("locale" = Option<String>, Query, description = "Optional locale code. When set, `localizations[]` collapses to one resolved element after SEO fallbacks are applied (ADR 0002).")
    ),
    responses(
        (status = 200, description = "Blog detail with localizations", body = BlogDetailResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Blog not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_blog_detail(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    locale: ResolveLocale,
    access: AuthorizedContent<BlogWithContent, Read>,
) -> Result<Json<BlogDetailResponse>, ApiError> {
    let blog = access.entity;
    let site_ids = access.site_ids;
    let localizations =
        ContentLocalization::find_all_for_content(&state.db, blog.content_id).await?;
    let mut loc_responses: Vec<LocalizationResponse> = localizations
        .into_iter()
        .map(LocalizationResponse::from)
        .collect();
    let categories = Category::find_for_content(&state.db, blog.content_id).await?;
    let cat_responses: Vec<CategoryResponse> =
        categories.into_iter().map(CategoryResponse::from).collect();
    let tags = Tag::find_for_content(&state.db, blog.content_id).await?;
    let tag_responses: Vec<TagResponse> = tags.into_iter().map(TagResponse::from).collect();

    let blog_docs = BlogDocumentRepo::find_all_for_blog(&state.db, id).await?;
    let mut doc_responses = Vec::new();
    for detail in blog_docs {
        let doc_locs =
            DocumentLocalizationRepo::find_all_for_document(&state.db, detail.document_id).await?;
        doc_responses.push(BlogDocumentResponse::from_parts(detail, doc_locs));
    }

    let blog_resp = BlogResponse::from(blog);
    if let Some(&site_id) = site_ids.first() {
        let site = Site::find_by_id(&state.db, site_id).await?;
        let seo = seo::SeoContext::load(&state.db, &site).await?;
        seo.apply(&mut loc_responses);
        let og_image_url = seo.og_image_url(&state.db, blog_resp.cover_image_id).await;

        loc_responses = collapse_localizations(
            &state.db,
            site_id,
            locale.0.as_deref(),
            loc_responses,
            |l| l.locale_id,
        )
        .await?;

        return Ok(Json(BlogDetailResponse {
            blog: blog_resp,
            localizations: loc_responses,
            categories: cat_responses,
            tags: tag_responses,
            documents: doc_responses,
            og_image_url,
        }));
    }

    Ok(Json(BlogDetailResponse {
        blog: blog_resp,
        localizations: loc_responses,
        categories: cat_responses,
        tags: tag_responses,
        documents: doc_responses,
        og_image_url: None,
    }))
}

#[utoipa::path(
    get,
    path = "/blogs/{id}/localizations",
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
async fn get_blog_localizations(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<Vec<LocalizationResponse>>, ApiError> {
    let blog = BlogRepo::find_by_id(&state.db, id).await?;
    let localizations =
        localization_lifecycle::list::<BlogLocalization>(&state.db, blog.content_id, &auth.0)
            .await?;
    let responses: Vec<LocalizationResponse> = localizations
        .into_iter()
        .map(LocalizationResponse::from)
        .collect();
    Ok(Json(responses))
}

#[utoipa::path(
    post,
    path = "/blogs/{id}/localizations",
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
async fn create_blog_localization(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    // Plain Actor: the lifecycle enforces `{resource}:create` per site,
    // which (unlike `WriteKey`) admits Clerk users by their site role —
    // the admin editor saves localized content through this route.
    auth: Actor,
    crate::dto::validated::ValidatedJson(body): crate::dto::validated::ValidatedJson<
        CreateLocalizationRequest,
    >,
) -> Result<(StatusCode, Json<LocalizationResponse>), ApiError> {
    let body = body.into_inner();
    let blog = BlogRepo::find_by_id(&state.db, id).await?;
    let localization =
        localization_lifecycle::create::<BlogLocalization>(&state.db, blog.content_id, body, &auth)
            .await?;

    Ok((
        StatusCode::CREATED,
        Json(LocalizationResponse::from(localization)),
    ))
}

#[utoipa::path(
    put,
    path = "/blogs/localizations/{id}",
    tag = "Blogs",
    operation_id = "update_blog_localization",
    description = "Update a blog localization",
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
async fn update_blog_localization(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: Actor,
    crate::dto::validated::ValidatedJson(body): crate::dto::validated::ValidatedJson<
        UpdateLocalizationRequest,
    >,
) -> Result<Json<LocalizationResponse>, ApiError> {
    let localization =
        localization_lifecycle::update::<BlogLocalization>(&state.db, id, body.into_inner(), &auth)
            .await?;

    Ok(Json(LocalizationResponse::from(localization)))
}

#[utoipa::path(
    delete,
    path = "/blogs/localizations/{id}",
    tag = "Blogs",
    operation_id = "delete_blog_localization",
    description = "Delete a blog localization",
    params(("id" = Uuid, Path, description = "Localization UUID")),
    responses(
        (status = 204, description = "Localization deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Localization not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn delete_blog_localization(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: Actor,
) -> Result<StatusCode, ApiError> {
    localization_lifecycle::delete::<BlogLocalization>(&state.db, id, &auth).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/blogs/{id}/review",
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
async fn review_blog(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContent<BlogWithContent, Update>,
    crate::dto::validated::ValidatedJson(body): crate::dto::validated::ValidatedJson<
        ReviewActionRequest,
    >,
) -> Result<Json<ReviewActionResponse>, ApiError> {
    let blog = access.entity;
    let site_ids = access.site_ids;
    let actor = access.actor;

    let slug = blog.slug.clone().unwrap_or_else(|| id.to_string());
    let ctx = ReviewContext {
        content_id: blog.content_id,
        entity_type: "blog",
        entity_id: id,
        entity_slug: &slug,
        current_status: &blog.status,
        has_future_publish_start: blog
            .publish_start
            .map(|s| s > chrono::Utc::now())
            .unwrap_or(false),
    };

    let response = ReviewService::review_content(
        &state.db,
        &ctx,
        site_ids.into_iter().next(),
        body.into_inner(),
        actor.user_identifier().map(|s| s.to_string()),
    )
    .await?;

    Ok(Json(response))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/feed.rss",
    tag = "Blogs",
    operation_id = "rss_feed",
    description = "Get an RSS 2.0 feed of published blog posts for a site",
    params(("site_id" = Uuid, Path, description = "The UUID of the site. Use GET /sites to list available sites.")),
    responses(
        (status = 200, description = "RSS 2.0 XML feed containing up to 50 most recent published posts", content_type = "application/rss+xml"),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn rss_feed(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    _access: AuthorizedSite<BlogWithContent, Read>,
) -> Result<RssResponse, ApiError> {
    let xml = blog_rss_service::generate_rss(&state.db, site_id).await?;
    Ok(RssResponse(xml))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/blogs/bulk",
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
async fn bulk_blogs(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
    _module: ModuleGuard<BlogModule>,
    crate::dto::validated::ValidatedJson(body): crate::dto::validated::ValidatedJson<
        BulkContentRequest,
    >,
) -> Result<Json<BulkContentResponse>, ApiError> {
    let body = body.into_inner();
    let required_perm = match body.action {
        BulkAction::Delete => Permission::new("blog", "delete"),
        BulkAction::UpdateStatus => Permission::new("blog", "update"),
    };
    PermissionService::require(&state.db, &auth.0, site_id, &required_perm).await?;

    if matches!(body.action, BulkAction::UpdateStatus) && body.status.is_none() {
        return Err(
            ApiError::bad_request("status field is required for UpdateStatus action")
                .with_code(codes::BLOG_BULK_STATUS_REQUIRED),
        );
    }

    let mut pairs = Vec::with_capacity(body.ids.len());
    for blog_id in &body.ids {
        match BlogRepo::find_by_id(&state.db, *blog_id).await {
            Ok(blog) => pairs.push((*blog_id, blog.content_id)),
            Err(_) => pairs.push((*blog_id, Uuid::nil())),
        }
    }

    let response = BulkContentService::process_bulk_operation(
        &state.db,
        "blog",
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
    path = "/sites/{site_id}/blogs/seed",
    tag = "Blogs",
    operation_id = "seed_sample_content",
    description = "Create sample blog posts for a new site (creates 3 draft posts marked as samples)",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 201, description = "Sample content created", body = Vec<BlogResponse>),
        (status = 400, description = "Sample content already exists", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn seed_sample_content(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    access: AuthorizedSite<BlogWithContent, Create>,
) -> Result<(StatusCode, Json<Vec<BlogResponse>>), ApiError> {
    let existing = BlogRepo::count_sample_for_site(&state.db, site_id).await?;
    if existing > 0 {
        return Err(
            ApiError::bad_request("Sample content already exists for this site")
                .with_code(codes::BLOG_SAMPLE_EXISTS),
        );
    }

    let (locale_id, locale_code) = SiteLocale::find_default_for_site(&state.db, site_id)
        .await?
        .ok_or_else(|| {
            ApiError::bad_request("No default locale configured for this site")
                .with_code(codes::BLOG_NO_DEFAULT_LOCALE)
        })?;

    let author = "Site Author".to_string();

    let blogs = content_lifecycle::blog::seed_samples(
        &state.db,
        site_id,
        locale_id,
        &locale_code,
        &author,
        &access.actor,
    )
    .await?;

    let responses: Vec<BlogResponse> = blogs.into_iter().map(BlogResponse::from).collect();
    Ok((StatusCode::CREATED, Json(responses)))
}

#[utoipa::path(
    delete,
    path = "/sites/{site_id}/blogs/samples",
    tag = "Blogs",
    operation_id = "delete_sample_content",
    description = "Delete all sample blog posts for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Sample content deleted", body = serde_json::Value),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn delete_sample_content(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    access: AuthorizedSite<BlogWithContent, Delete>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let deleted =
        content_lifecycle::blog::delete_samples(&state.db, site_id, &access.actor).await?;

    Ok(Json(serde_json::json!({ "deleted": deleted })))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/blogs/status-counts",
    tag = "Blogs",
    operation_id = "blog_status_counts",
    description = "Count blogs per workflow status (draft, in_review, scheduled, published, archived)",
    params(("site_id" = Uuid, Path, description = "The UUID of the site")),
    responses(
        (status = 200, description = "Counts per status", body = BlogStatusCounts),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn blog_status_counts(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    _access: AuthorizedSite<BlogWithContent, Read>,
) -> Result<Json<BlogStatusCounts>, ApiError> {
    let (draft, in_review, scheduled, published, archived) =
        BlogRepo::status_counts_for_site(&state.db, site_id).await?;

    Ok(Json(BlogStatusCounts {
        draft,
        in_review,
        scheduled,
        published,
        archived,
    }))
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_blogs))
        .routes(routes!(blog_status_counts))
        .routes(routes!(list_published_blogs))
        .routes(routes!(list_published_blogs_by_category))
        .routes(routes!(list_featured_blogs))
        .routes(routes!(list_similar_blogs))
        .routes(routes!(get_blog_by_slug))
        .routes(routes!(rss_feed))
        .routes(routes!(bulk_blogs))
        .routes(routes!(seed_sample_content))
        .routes(routes!(delete_sample_content))
        .routes(routes!(create_blog))
        .routes(routes!(get_blog, update_blog, delete_blog))
        .routes(routes!(clone_blog))
        .routes(routes!(review_blog))
        .routes(routes!(get_blog_detail))
        .routes(routes!(get_blog_localizations, create_blog_localization))
        .routes(routes!(update_blog_localization, delete_blog_localization))
}
