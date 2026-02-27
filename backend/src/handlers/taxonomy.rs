//! Taxonomy handlers (tags, categories)

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;
use validator::Validate;

use crate::dto::taxonomy::{
    AssignCategoryRequest, CategoryResponse, CategoryWithCountResponse, CreateCategoryRequest,
    CreateTagRequest, PaginatedCategories, PaginatedTags, TagResponse, UpdateCategoryRequest,
    UpdateTagRequest,
};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::models::audit::AuditAction;
use crate::models::site_membership::SiteRole;
use crate::models::taxonomy::{Category, Tag};
use crate::services::audit_service;
use crate::utils::pagination::PaginationParams;
use crate::AppState;

/// List all tags for a site
#[utoipa::path(
    tag = "Taxonomy",
    operation_id = "list_tags",
    description = "List all tags for a site",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default: 1)"),
        ("per_page" = Option<i64>, Query, description = "Items per page (default: 25)"),
    ),
    responses(
        (status = 200, description = "List of tags", body = PaginatedTags),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/tags?<page>&<per_page>")]
pub async fn list_tags(
    state: &State<AppState>,
    site_id: Uuid,
    page: Option<i64>,
    per_page: Option<i64>,
    auth: ReadKey,
) -> Result<Json<PaginatedTags>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let params = PaginationParams::new(page, per_page);
    let (limit, offset) = params.limit_offset();
    let tags = Tag::find_all_for_site(&state.db, site_id, limit, offset).await?;
    let total = Tag::count_for_site(&state.db, site_id).await?;
    Ok(Json(params.paginate(
        tags.into_iter().map(TagResponse::from).collect(),
        total,
    )))
}

/// Get tag by ID
#[utoipa::path(
    tag = "Taxonomy",
    operation_id = "get_tag",
    description = "Get a tag by ID",
    params(("id" = Uuid, Path, description = "Tag UUID")),
    responses(
        (status = 200, description = "Tag details", body = TagResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Tag not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/tags/<id>")]
pub async fn get_tag(
    state: &State<AppState>,
    id: Uuid,
    _auth: ReadKey,
) -> Result<Json<TagResponse>, ApiError> {
    let tag = Tag::find_by_id(&state.db, id).await?;
    Ok(Json(TagResponse::from(tag)))
}

/// Get tag by slug
#[utoipa::path(
    tag = "Taxonomy",
    operation_id = "get_tag_by_slug",
    description = "Get a tag by slug",
    params(("slug" = String, Path, description = "Tag slug")),
    responses(
        (status = 200, description = "Tag details", body = TagResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Tag not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/tags/by-slug/<slug>", rank = 1)]
pub async fn get_tag_by_slug(
    state: &State<AppState>,
    slug: &str,
    _auth: ReadKey,
) -> Result<Json<TagResponse>, ApiError> {
    let tag = Tag::find_by_slug(&state.db, slug).await?;
    Ok(Json(TagResponse::from(tag)))
}

/// Get tags for content
#[utoipa::path(
    tag = "Taxonomy",
    operation_id = "get_content_tags",
    description = "Get tags assigned to content",
    params(("content_id" = Uuid, Path, description = "Content UUID")),
    responses(
        (status = 200, description = "Content tags", body = Vec<TagResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/content/<content_id>/tags")]
pub async fn get_content_tags(
    state: &State<AppState>,
    content_id: Uuid,
    _auth: ReadKey,
) -> Result<Json<Vec<TagResponse>>, ApiError> {
    let tags = Tag::find_for_content(&state.db, content_id).await?;
    let responses: Vec<TagResponse> = tags.into_iter().map(TagResponse::from).collect();
    Ok(Json(responses))
}

/// List root categories for a site
#[utoipa::path(
    tag = "Taxonomy",
    operation_id = "list_categories",
    description = "List root categories for a site",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default: 1)"),
        ("per_page" = Option<i64>, Query, description = "Items per page (default: 25)"),
    ),
    responses(
        (status = 200, description = "Root categories", body = PaginatedCategories),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/categories?<page>&<per_page>")]
pub async fn list_categories(
    state: &State<AppState>,
    site_id: Uuid,
    page: Option<i64>,
    per_page: Option<i64>,
    auth: ReadKey,
) -> Result<Json<PaginatedCategories>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let params = PaginationParams::new(page, per_page);
    let (limit, offset) = params.limit_offset();
    let categories = Category::find_root_for_site(&state.db, site_id, limit, offset).await?;
    let total = Category::count_root_for_site(&state.db, site_id).await?;
    Ok(Json(params.paginate(
        categories.into_iter().map(CategoryResponse::from).collect(),
        total,
    )))
}

/// Get category by ID
#[utoipa::path(
    tag = "Taxonomy",
    operation_id = "get_category",
    description = "Get a category by ID",
    params(("id" = Uuid, Path, description = "Category UUID")),
    responses(
        (status = 200, description = "Category details", body = CategoryResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Category not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/categories/<id>")]
pub async fn get_category(
    state: &State<AppState>,
    id: Uuid,
    _auth: ReadKey,
) -> Result<Json<CategoryResponse>, ApiError> {
    let category = Category::find_by_id(&state.db, id).await?;
    Ok(Json(CategoryResponse::from(category)))
}

/// Get children of a category
#[utoipa::path(
    tag = "Taxonomy",
    operation_id = "get_category_children",
    description = "Get children of a category",
    params(("parent_id" = Uuid, Path, description = "Parent category UUID")),
    responses(
        (status = 200, description = "Child categories", body = Vec<CategoryResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/categories/<parent_id>/children", rank = 1)]
pub async fn get_category_children(
    state: &State<AppState>,
    parent_id: Uuid,
    _auth: ReadKey,
) -> Result<Json<Vec<CategoryResponse>>, ApiError> {
    let categories = Category::find_children(&state.db, parent_id).await?;
    let responses: Vec<CategoryResponse> =
        categories.into_iter().map(CategoryResponse::from).collect();
    Ok(Json(responses))
}

/// Get categories for content
#[utoipa::path(
    tag = "Taxonomy",
    operation_id = "get_content_categories",
    description = "Get categories assigned to content",
    params(("content_id" = Uuid, Path, description = "Content UUID")),
    responses(
        (status = 200, description = "Content categories", body = Vec<CategoryResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/content/<content_id>/categories")]
pub async fn get_content_categories(
    state: &State<AppState>,
    content_id: Uuid,
    _auth: ReadKey,
) -> Result<Json<Vec<CategoryResponse>>, ApiError> {
    let categories = Category::find_for_content(&state.db, content_id).await?;
    let responses: Vec<CategoryResponse> =
        categories.into_iter().map(CategoryResponse::from).collect();
    Ok(Json(responses))
}

/// Create a tag
#[utoipa::path(
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
#[post("/tags", data = "<body>")]
pub async fn create_tag(
    state: &State<AppState>,
    body: Json<CreateTagRequest>,
    auth: ReadKey,
) -> Result<(Status, Json<TagResponse>), ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;
    req.validate_site().map_err(ApiError::BadRequest)?;

    if let Some(site_id) = req.site_id {
        auth.0
            .authorize_site_action(&state.db, site_id, &SiteRole::Author)
            .await?;
    }

    let tag = Tag::create(&state.db, &req).await?;
    audit_service::log_action(
        &state.db,
        req.site_id,
        Some(auth.0.id),
        AuditAction::Create,
        "tag",
        tag.id,
        None,
    )
    .await;
    Ok((Status::Created, Json(TagResponse::from(tag))))
}

/// Update a tag
#[utoipa::path(
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
#[put("/tags/<id>", data = "<body>")]
pub async fn update_tag(
    state: &State<AppState>,
    id: Uuid,
    body: Json<UpdateTagRequest>,
    auth: ReadKey,
) -> Result<Json<TagResponse>, ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let tag = Tag::update(&state.db, id, &req).await?;
    audit_service::log_action(
        &state.db,
        None,
        Some(auth.0.id),
        AuditAction::Update,
        "tag",
        id,
        None,
    )
    .await;
    Ok(Json(TagResponse::from(tag)))
}

/// Soft delete a tag
#[utoipa::path(
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
#[delete("/tags/<id>")]
pub async fn delete_tag(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    Tag::soft_delete(&state.db, id).await?;
    audit_service::log_action(
        &state.db,
        None,
        Some(auth.0.id),
        AuditAction::Delete,
        "tag",
        id,
        None,
    )
    .await;
    Ok(Status::NoContent)
}

/// Create a category
#[utoipa::path(
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
#[post("/categories", data = "<body>")]
pub async fn create_category(
    state: &State<AppState>,
    body: Json<CreateCategoryRequest>,
    auth: ReadKey,
) -> Result<(Status, Json<CategoryResponse>), ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;
    req.validate_site().map_err(ApiError::BadRequest)?;

    if let Some(site_id) = req.site_id {
        auth.0
            .authorize_site_action(&state.db, site_id, &SiteRole::Author)
            .await?;
    }

    let category = Category::create(&state.db, &req).await?;
    audit_service::log_action(
        &state.db,
        req.site_id,
        Some(auth.0.id),
        AuditAction::Create,
        "category",
        category.id,
        None,
    )
    .await;
    Ok((Status::Created, Json(CategoryResponse::from(category))))
}

/// Update a category
#[utoipa::path(
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
#[put("/categories/<id>", data = "<body>")]
pub async fn update_category(
    state: &State<AppState>,
    id: Uuid,
    body: Json<UpdateCategoryRequest>,
    auth: ReadKey,
) -> Result<Json<CategoryResponse>, ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let category = Category::update(&state.db, id, &req).await?;
    audit_service::log_action(
        &state.db,
        None,
        Some(auth.0.id),
        AuditAction::Update,
        "category",
        id,
        None,
    )
    .await;
    Ok(Json(CategoryResponse::from(category)))
}

/// Soft delete a category
#[utoipa::path(
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
#[delete("/categories/<id>")]
pub async fn delete_category(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    Category::soft_delete(&state.db, id).await?;
    audit_service::log_action(
        &state.db,
        None,
        Some(auth.0.id),
        AuditAction::Delete,
        "category",
        id,
        None,
    )
    .await;
    Ok(Status::NoContent)
}

/// Assign a category to content
#[utoipa::path(
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
#[post("/content/<content_id>/categories", data = "<body>")]
pub async fn assign_category_to_content(
    state: &State<AppState>,
    content_id: Uuid,
    body: Json<AssignCategoryRequest>,
    _auth: ReadKey,
) -> Result<Status, ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;
    Category::assign_to_content(&state.db, content_id, req.category_id, req.is_primary).await?;
    Ok(Status::NoContent)
}

/// Remove a category from content
#[utoipa::path(
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
#[delete("/content/<content_id>/categories/<category_id>")]
pub async fn remove_category_from_content(
    state: &State<AppState>,
    content_id: Uuid,
    category_id: Uuid,
    _auth: ReadKey,
) -> Result<Status, ApiError> {
    Category::remove_from_content(&state.db, content_id, category_id).await?;
    Ok(Status::NoContent)
}

/// Get categories with blog counts for a site
#[utoipa::path(
    tag = "Taxonomy",
    operation_id = "get_categories_with_blog_counts",
    description = "Get categories with blog counts for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Categories with counts", body = Vec<CategoryWithCountResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/categories/blog-counts", rank = 1)]
pub async fn get_categories_with_blog_counts(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
) -> Result<Json<Vec<CategoryWithCountResponse>>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let categories = Category::find_with_blog_count(&state.db, site_id).await?;
    let responses: Vec<CategoryWithCountResponse> = categories
        .into_iter()
        .map(CategoryWithCountResponse::from)
        .collect();
    Ok(Json(responses))
}

/// Collect taxonomy routes
pub fn routes() -> Vec<Route> {
    routes![
        list_tags,
        get_tag_by_slug,
        get_tag,
        get_content_tags,
        create_tag,
        update_tag,
        delete_tag,
        list_categories,
        get_categories_with_blog_counts,
        get_category_children,
        get_category,
        get_content_categories,
        create_category,
        update_category,
        delete_category,
        assign_category_to_content,
        remove_category_from_content
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 17, "Should have 17 taxonomy routes");
    }
}
