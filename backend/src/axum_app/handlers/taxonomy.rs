//! Axum port of `crate::handlers::taxonomy`. Seventeen endpoints for
//! tag and category CRUD plus content-attachment ops. Mounted under
//! `/api/v1`.

use crate::AppState;
use crate::dto::taxonomy::{
    AssignCategoryRequest, AssignTagRequest, CategoryResponse, CategoryWithCountResponse,
    CreateCategoryRequest, CreateTagRequest, PaginatedCategories, PaginatedTags, TagResponse,
    UpdateCategoryRequest, UpdateTagRequest,
};
use crate::dto::validated::ValidatedJson;
use crate::errors::{ApiError, ProblemDetails, codes};
use crate::guards::actor::Actor;
use crate::guards::auth_guard::{ReadKey, WriteKey};
use crate::models::audit::AuditAction;
use crate::models::content::Content;
use crate::models::taxonomy::{Category, Tag};
use crate::services::audited_mutation::AuditedEntity;
use crate::services::permission_service::{Permission, PermissionService};
use crate::utils::list_params::ListParams;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::Json;
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
struct ListQuery {
    page: Option<i64>,
    page_size: Option<i64>,
    search: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
}

/// Verify the caller has `permission` on at least one of the provided
/// sites. Returns the first authorized site_id (used for audit logging).
async fn require_any_site_permission(
    pool: &sqlx::PgPool,
    auth: &Actor,
    site_ids: &[Uuid],
    permission: &Permission,
) -> Result<Uuid, ApiError> {
    if site_ids.is_empty() {
        return Err(ApiError::not_found("Resource not associated with any site")
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type("tag"));
    }
    for site_id in site_ids {
        if PermissionService::has_permission(pool, auth, *site_id, permission).await? {
            return Ok(*site_id);
        }
    }
    Err(
        ApiError::forbidden("You don't have permission to perform this action")
            .with_code(codes::AUTH_INSUFFICIENT_ROLE),
    )
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/tags",
    tag = "Taxonomy",
    operation_id = "list_tags",
    description = "List all tags for a site",
    params(
        ("site_id" = Uuid, Path, description = "The UUID of the site"),
        ("page" = Option<i64>, Query, description = "Page number, 1-indexed (default: 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page, 1–100 (default: 10)"),
        ("search" = Option<String>, Query, description = "Filter tags by slug (case-insensitive partial match)"),
        ("sort_by" = Option<String>, Query, description = "Sort column: slug (default), created_at"),
        ("sort_dir" = Option<String>, Query, description = "Sort direction: asc or desc (default: asc)")
    ),
    responses(
        (status = 200, description = "List of tags", body = PaginatedTags),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_tags(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<ListQuery>,
    auth: ReadKey,
) -> Result<Json<PaginatedTags>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("taxonomy", "read"),
    )
    .await?;
    let params = ListParams::new(q.page, q.page_size, q.search, q.sort_by, q.sort_dir);
    let tags = Tag::find_all_for_site_filtered(&state.db, site_id, &params).await?;
    let total = Tag::count_for_site_filtered(&state.db, site_id, params.search_ref()).await?;
    Ok(Json(params.paginate(
        tags.into_iter().map(TagResponse::from).collect(),
        total,
    )))
}

#[utoipa::path(
    get,
    path = "/tags/{id}",
    tag = "Taxonomy",
    operation_id = "get_tag",
    description = "Get a tag by ID",
    params(("id" = Uuid, Path, description = "The UUID of the tag")),
    responses(
        (status = 200, description = "Tag details", body = TagResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this tag's site", body = ProblemDetails),
        (status = 404, description = "Tag not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_tag(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<TagResponse>, ApiError> {
    let tag = Tag::find_by_id(&state.db, id).await?;
    let site_ids = Tag::find_site_ids(&state.db, id).await?;
    require_any_site_permission(
        &state.db,
        &auth.0,
        &site_ids,
        &Permission::new("taxonomy", "read"),
    )
    .await?;
    Ok(Json(TagResponse::from(tag)))
}

#[utoipa::path(
    get,
    path = "/tags/by-slug/{slug}",
    tag = "Taxonomy",
    operation_id = "get_tag_by_slug",
    description = "Get a tag by slug",
    params(("slug" = String, Path, description = "URL-friendly identifier (lowercase, hyphens only)")),
    responses(
        (status = 200, description = "Tag details", body = TagResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this tag's site", body = ProblemDetails),
        (status = 404, description = "Tag not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_tag_by_slug(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    auth: ReadKey,
) -> Result<Json<TagResponse>, ApiError> {
    let tag = Tag::find_by_slug(&state.db, &slug).await?;
    let site_ids = Tag::find_site_ids(&state.db, tag.id).await?;
    require_any_site_permission(
        &state.db,
        &auth.0,
        &site_ids,
        &Permission::new("taxonomy", "read"),
    )
    .await?;
    Ok(Json(TagResponse::from(tag)))
}

#[utoipa::path(
    get,
    path = "/content/{content_id}/tags",
    tag = "Taxonomy",
    operation_id = "get_content_tags",
    description = "Get tags assigned to content",
    params(("content_id" = Uuid, Path, description = "The UUID of the content item")),
    responses(
        (status = 200, description = "Content tags", body = Vec<TagResponse>),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_content_tags(
    State(state): State<AppState>,
    Path(content_id): Path<Uuid>,
    _auth: ReadKey,
) -> Result<Json<Vec<TagResponse>>, ApiError> {
    let tags = Tag::find_for_content(&state.db, content_id).await?;
    let responses: Vec<TagResponse> = tags.into_iter().map(TagResponse::from).collect();
    Ok(Json(responses))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/categories",
    tag = "Taxonomy",
    operation_id = "list_categories",
    description = "List root categories for a site",
    params(
        ("site_id" = Uuid, Path, description = "The UUID of the site"),
        ("page" = Option<i64>, Query, description = "Page number, 1-indexed (default: 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page, 1–100 (default: 10)"),
        ("search" = Option<String>, Query, description = "Filter categories by slug (case-insensitive partial match)"),
        ("sort_by" = Option<String>, Query, description = "Sort column: slug (default), created_at"),
        ("sort_dir" = Option<String>, Query, description = "Sort direction: asc or desc (default: asc)")
    ),
    responses(
        (status = 200, description = "Root categories", body = PaginatedCategories),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_categories(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<ListQuery>,
    auth: ReadKey,
) -> Result<Json<PaginatedCategories>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("taxonomy", "read"),
    )
    .await?;
    let params = ListParams::new(q.page, q.page_size, q.search, q.sort_by, q.sort_dir);
    let categories = Category::find_root_for_site_filtered(&state.db, site_id, &params).await?;
    let total =
        Category::count_root_for_site_filtered(&state.db, site_id, params.search_ref()).await?;
    Ok(Json(params.paginate(
        categories.into_iter().map(CategoryResponse::from).collect(),
        total,
    )))
}

#[utoipa::path(
    get,
    path = "/categories/{id}",
    tag = "Taxonomy",
    operation_id = "get_category",
    description = "Get a category by ID",
    params(("id" = Uuid, Path, description = "The UUID of the category")),
    responses(
        (status = 200, description = "Category details", body = CategoryResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this category's site", body = ProblemDetails),
        (status = 404, description = "Category not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_category(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<CategoryResponse>, ApiError> {
    let category = Category::find_by_id(&state.db, id).await?;
    let site_ids = Category::find_site_ids(&state.db, id).await?;
    require_any_site_permission(
        &state.db,
        &auth.0,
        &site_ids,
        &Permission::new("taxonomy", "read"),
    )
    .await?;
    Ok(Json(CategoryResponse::from(category)))
}

#[utoipa::path(
    get,
    path = "/categories/{parent_id}/children",
    tag = "Taxonomy",
    operation_id = "get_category_children",
    description = "Get children of a category",
    params(("parent_id" = Uuid, Path, description = "The UUID of the parent category")),
    responses(
        (status = 200, description = "Child categories", body = Vec<CategoryResponse>),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this category's site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_category_children(
    State(state): State<AppState>,
    Path(parent_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<Vec<CategoryResponse>>, ApiError> {
    let site_ids = Category::find_site_ids(&state.db, parent_id).await?;
    require_any_site_permission(
        &state.db,
        &auth.0,
        &site_ids,
        &Permission::new("taxonomy", "read"),
    )
    .await?;
    let categories = Category::find_children(&state.db, parent_id).await?;
    let responses: Vec<CategoryResponse> =
        categories.into_iter().map(CategoryResponse::from).collect();
    Ok(Json(responses))
}

#[utoipa::path(
    get,
    path = "/content/{content_id}/categories",
    tag = "Taxonomy",
    operation_id = "get_content_categories",
    description = "Get categories assigned to content",
    params(("content_id" = Uuid, Path, description = "The UUID of the content item")),
    responses(
        (status = 200, description = "Content categories", body = Vec<CategoryResponse>),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_content_categories(
    State(state): State<AppState>,
    Path(content_id): Path<Uuid>,
    _auth: ReadKey,
) -> Result<Json<Vec<CategoryResponse>>, ApiError> {
    let categories = Category::find_for_content(&state.db, content_id).await?;
    let responses: Vec<CategoryResponse> =
        categories.into_iter().map(CategoryResponse::from).collect();
    Ok(Json(responses))
}

#[utoipa::path(
    post,
    path = "/tags",
    tag = "Taxonomy",
    operation_id = "create_tag",
    description = "Create a new tag",
    request_body(content = CreateTagRequest, description = "Tag creation data"),
    responses(
        (status = 201, description = "Tag created", body = TagResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn create_tag(
    State(state): State<AppState>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<CreateTagRequest>,
) -> Result<(StatusCode, Json<TagResponse>), ApiError> {
    if let Some(site_id) = body.site_id {
        PermissionService::require(
            &state.db,
            &auth.0,
            site_id,
            &Permission::new("taxonomy", "create"),
        )
        .await?;
    }

    let tag = Tag::create(&state.db, &body).await?;
    AuditedEntity::audit_only("tag")
        .mutate(AuditAction::Create, tag.id)
        .maybe_site(body.site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;
    Ok((StatusCode::CREATED, Json(TagResponse::from(tag))))
}

#[utoipa::path(
    put,
    path = "/tags/{id}",
    tag = "Taxonomy",
    operation_id = "update_tag",
    description = "Update a tag",
    params(("id" = Uuid, Path, description = "Tag UUID")),
    request_body(content = UpdateTagRequest, description = "Tag update data"),
    responses(
        (status = 200, description = "Tag updated", body = TagResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Tag not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn update_tag(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<UpdateTagRequest>,
) -> Result<Json<TagResponse>, ApiError> {
    let site_ids = Tag::find_site_ids(&state.db, id).await?;
    let site_id = require_any_site_permission(
        &state.db,
        &auth.0,
        &site_ids,
        &Permission::new("taxonomy", "update"),
    )
    .await?;
    let tag = Tag::update(&state.db, id, &body).await?;
    AuditedEntity::audit_only("tag")
        .mutate(AuditAction::Update, id)
        .site(site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;
    Ok(Json(TagResponse::from(tag)))
}

#[utoipa::path(
    delete,
    path = "/tags/{id}",
    tag = "Taxonomy",
    operation_id = "delete_tag",
    description = "Soft delete a tag",
    params(("id" = Uuid, Path, description = "Tag UUID")),
    responses(
        (status = 204, description = "Tag deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Tag not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn delete_tag(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
) -> Result<StatusCode, ApiError> {
    let site_ids = Tag::find_site_ids(&state.db, id).await?;
    let site_id = require_any_site_permission(
        &state.db,
        &auth.0,
        &site_ids,
        &Permission::new("taxonomy", "delete"),
    )
    .await?;
    Tag::soft_delete(&state.db, id).await?;
    AuditedEntity::audit_only("tag")
        .mutate(AuditAction::Delete, id)
        .site(site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/categories",
    tag = "Taxonomy",
    operation_id = "create_category",
    description = "Create a new category",
    request_body(content = CreateCategoryRequest, description = "Category creation data"),
    responses(
        (status = 201, description = "Category created", body = CategoryResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn create_category(
    State(state): State<AppState>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<CreateCategoryRequest>,
) -> Result<(StatusCode, Json<CategoryResponse>), ApiError> {
    if let Some(site_id) = body.site_id {
        PermissionService::require(
            &state.db,
            &auth.0,
            site_id,
            &Permission::new("taxonomy", "create"),
        )
        .await?;
    }

    let category = Category::create(&state.db, &body).await?;
    AuditedEntity::audit_only("category")
        .mutate(AuditAction::Create, category.id)
        .maybe_site(body.site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;
    Ok((StatusCode::CREATED, Json(CategoryResponse::from(category))))
}

#[utoipa::path(
    put,
    path = "/categories/{id}",
    tag = "Taxonomy",
    operation_id = "update_category",
    description = "Update a category",
    params(("id" = Uuid, Path, description = "Category UUID")),
    request_body(content = UpdateCategoryRequest, description = "Category update data"),
    responses(
        (status = 200, description = "Category updated", body = CategoryResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Category not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn update_category(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<UpdateCategoryRequest>,
) -> Result<Json<CategoryResponse>, ApiError> {
    let site_ids = Category::find_site_ids(&state.db, id).await?;
    let site_id = require_any_site_permission(
        &state.db,
        &auth.0,
        &site_ids,
        &Permission::new("taxonomy", "update"),
    )
    .await?;
    let category = Category::update(&state.db, id, &body).await?;
    AuditedEntity::audit_only("category")
        .mutate(AuditAction::Update, id)
        .site(site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;
    Ok(Json(CategoryResponse::from(category)))
}

#[utoipa::path(
    delete,
    path = "/categories/{id}",
    tag = "Taxonomy",
    operation_id = "delete_category",
    description = "Soft delete a category",
    params(("id" = Uuid, Path, description = "Category UUID")),
    responses(
        (status = 204, description = "Category deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Category not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn delete_category(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
) -> Result<StatusCode, ApiError> {
    let site_ids = Category::find_site_ids(&state.db, id).await?;
    let site_id = require_any_site_permission(
        &state.db,
        &auth.0,
        &site_ids,
        &Permission::new("taxonomy", "delete"),
    )
    .await?;
    Category::soft_delete(&state.db, id).await?;
    AuditedEntity::audit_only("category")
        .mutate(AuditAction::Delete, id)
        .site(site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/content/{content_id}/tags",
    tag = "Taxonomy",
    operation_id = "assign_tag_to_content",
    description = "Assign a tag to content",
    params(("content_id" = Uuid, Path, description = "Content UUID")),
    request_body(content = AssignTagRequest, description = "Tag assignment"),
    responses(
        (status = 204, description = "Tag assigned"),
        (status = 400, description = "Invalid request", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn assign_tag_to_content(
    State(state): State<AppState>,
    Path(content_id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<AssignTagRequest>,
) -> Result<StatusCode, ApiError> {
    let site_ids = Content::find_site_ids(&state.db, content_id).await?;
    for site_id in &site_ids {
        PermissionService::require(
            &state.db,
            &auth.0,
            *site_id,
            &Permission::new("taxonomy", "update"),
        )
        .await?;
    }
    Tag::assign_to_content(&state.db, content_id, body.tag_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/content/{content_id}/tags/{tag_id}",
    tag = "Taxonomy",
    operation_id = "remove_tag_from_content",
    description = "Remove a tag from content",
    params(
        ("content_id" = Uuid, Path, description = "Content UUID"),
        ("tag_id" = Uuid, Path, description = "Tag UUID")
    ),
    responses(
        (status = 204, description = "Tag removed"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Assignment not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn remove_tag_from_content(
    State(state): State<AppState>,
    Path((content_id, tag_id)): Path<(Uuid, Uuid)>,
    auth: WriteKey,
) -> Result<StatusCode, ApiError> {
    let site_ids = Content::find_site_ids(&state.db, content_id).await?;
    for site_id in &site_ids {
        PermissionService::require(
            &state.db,
            &auth.0,
            *site_id,
            &Permission::new("taxonomy", "delete"),
        )
        .await?;
    }
    Tag::remove_from_content(&state.db, content_id, tag_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/content/{content_id}/categories",
    tag = "Taxonomy",
    operation_id = "assign_category_to_content",
    description = "Assign a category to content",
    params(("content_id" = Uuid, Path, description = "Content UUID")),
    request_body(content = AssignCategoryRequest, description = "Category assignment"),
    responses(
        (status = 204, description = "Category assigned"),
        (status = 400, description = "Invalid request", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn assign_category_to_content(
    State(state): State<AppState>,
    Path(content_id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<AssignCategoryRequest>,
) -> Result<StatusCode, ApiError> {
    let site_ids = Content::find_site_ids(&state.db, content_id).await?;
    for site_id in &site_ids {
        PermissionService::require(
            &state.db,
            &auth.0,
            *site_id,
            &Permission::new("taxonomy", "update"),
        )
        .await?;
    }
    Category::assign_to_content(&state.db, content_id, body.category_id, body.is_primary).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/content/{content_id}/categories/{category_id}",
    tag = "Taxonomy",
    operation_id = "remove_category_from_content",
    description = "Remove a category from content",
    params(
        ("content_id" = Uuid, Path, description = "Content UUID"),
        ("category_id" = Uuid, Path, description = "Category UUID")
    ),
    responses(
        (status = 204, description = "Category removed"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Assignment not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn remove_category_from_content(
    State(state): State<AppState>,
    Path((content_id, category_id)): Path<(Uuid, Uuid)>,
    auth: WriteKey,
) -> Result<StatusCode, ApiError> {
    let site_ids = Content::find_site_ids(&state.db, content_id).await?;
    for site_id in &site_ids {
        PermissionService::require(
            &state.db,
            &auth.0,
            *site_id,
            &Permission::new("taxonomy", "delete"),
        )
        .await?;
    }
    Category::remove_from_content(&state.db, content_id, category_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/categories/blog-counts",
    tag = "Taxonomy",
    operation_id = "get_categories_with_blog_counts",
    description = "Get categories with blog counts for a site",
    params(("site_id" = Uuid, Path, description = "The UUID of the site")),
    responses(
        (status = 200, description = "Categories with counts", body = Vec<CategoryWithCountResponse>),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_categories_with_blog_counts(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<Vec<CategoryWithCountResponse>>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("taxonomy", "read"),
    )
    .await?;
    let categories = Category::find_with_blog_count(&state.db, site_id).await?;
    let responses: Vec<CategoryWithCountResponse> = categories
        .into_iter()
        .map(CategoryWithCountResponse::from)
        .collect();
    Ok(Json(responses))
}

/// Routes are registered with literal-segment routes ahead of param
/// routes (e.g. `/tags/by-slug/{slug}` before `/tags/{id}`,
/// `/categories/blog-counts` before `/categories/{id}`) — same
/// matchit precedence pattern as previous bundles.
pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_tags))
        .routes(routes!(get_tag_by_slug))
        .routes(routes!(get_content_tags, assign_tag_to_content))
        .routes(routes!(remove_tag_from_content))
        .routes(routes!(get_content_categories, assign_category_to_content))
        .routes(routes!(remove_category_from_content))
        .routes(routes!(get_categories_with_blog_counts))
        .routes(routes!(list_categories))
        .routes(routes!(get_category_children))
        .routes(routes!(create_tag))
        .routes(routes!(create_category))
        .routes(routes!(get_tag, update_tag, delete_tag))
        .routes(routes!(get_category, update_category, delete_category))
}
