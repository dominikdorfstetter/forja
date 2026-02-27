//! Content template handlers

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;
use validator::Validate;

use crate::dto::content_template::{
    ContentTemplateResponse, CreateContentTemplateRequest, PaginatedContentTemplates,
    UpdateContentTemplateRequest,
};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::models::audit::AuditAction;
use crate::models::content_template::ContentTemplate;
use crate::models::site_membership::SiteRole;
use crate::services::audit_service;
use crate::utils::pagination::PaginationParams;
use crate::AppState;

/// List content templates for a site (paginated, searchable)
#[utoipa::path(
    tag = "Content Templates",
    operation_id = "list_content_templates",
    description = "List all content templates for a site (paginated, searchable)",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default 1)"),
        ("per_page" = Option<i64>, Query, description = "Items per page (default 10, max 100)"),
        ("search" = Option<String>, Query, description = "Search by name or description")
    ),
    responses(
        (status = 200, description = "Paginated content template list", body = PaginatedContentTemplates),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/content-templates?<page>&<per_page>&<search>")]
pub async fn list_content_templates(
    state: &State<AppState>,
    site_id: Uuid,
    page: Option<i64>,
    per_page: Option<i64>,
    search: Option<String>,
    auth: ReadKey,
) -> Result<Json<PaginatedContentTemplates>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let params = PaginationParams::new(page, per_page);
    let (limit, offset) = params.limit_offset();

    let search_ref = search.as_deref();
    let templates =
        ContentTemplate::find_all_for_site(&state.db, site_id, search_ref, limit, offset).await?;
    let total = ContentTemplate::count_for_site(&state.db, site_id, search_ref).await?;

    let items: Vec<ContentTemplateResponse> = templates
        .into_iter()
        .map(ContentTemplateResponse::from)
        .collect();
    let paginated = params.paginate(items, total);

    Ok(Json(paginated))
}

/// Get a content template by ID
#[utoipa::path(
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
#[get("/content-templates/<id>")]
pub async fn get_content_template(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Json<ContentTemplateResponse>, ApiError> {
    let template = ContentTemplate::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, template.site_id, &SiteRole::Viewer)
        .await?;
    Ok(Json(ContentTemplateResponse::from(template)))
}

/// Create a content template
#[utoipa::path(
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
#[post("/sites/<site_id>/content-templates", data = "<body>")]
pub async fn create_content_template(
    state: &State<AppState>,
    site_id: Uuid,
    body: Json<CreateContentTemplateRequest>,
    auth: ReadKey,
) -> Result<(Status, Json<ContentTemplateResponse>), ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Author)
        .await?;
    let mut req = body.into_inner();
    req.site_id = site_id; // Override with path param
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let template = ContentTemplate::create(&state.db, req).await?;
    audit_service::log_action(
        &state.db,
        Some(site_id),
        Some(auth.0.id),
        AuditAction::Create,
        "content_template",
        template.id,
        None,
    )
    .await;

    Ok((
        Status::Created,
        Json(ContentTemplateResponse::from(template)),
    ))
}

/// Update a content template
#[utoipa::path(
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
#[put("/content-templates/<id>", data = "<body>")]
pub async fn update_content_template(
    state: &State<AppState>,
    id: Uuid,
    body: Json<UpdateContentTemplateRequest>,
    auth: ReadKey,
) -> Result<Json<ContentTemplateResponse>, ApiError> {
    let existing = ContentTemplate::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, existing.site_id, &SiteRole::Author)
        .await?;

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let template = ContentTemplate::update(&state.db, id, req).await?;
    audit_service::log_action(
        &state.db,
        Some(existing.site_id),
        Some(auth.0.id),
        AuditAction::Update,
        "content_template",
        id,
        None,
    )
    .await;

    Ok(Json(ContentTemplateResponse::from(template)))
}

/// Delete a content template
#[utoipa::path(
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
#[delete("/content-templates/<id>")]
pub async fn delete_content_template(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    let template = ContentTemplate::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, template.site_id, &SiteRole::Editor)
        .await?;

    ContentTemplate::delete(&state.db, id).await?;
    audit_service::log_action(
        &state.db,
        Some(template.site_id),
        Some(auth.0.id),
        AuditAction::Delete,
        "content_template",
        id,
        None,
    )
    .await;

    Ok(Status::NoContent)
}

/// Collect content template routes
pub fn routes() -> Vec<Route> {
    routes![
        list_content_templates,
        get_content_template,
        create_content_template,
        update_content_template,
        delete_content_template
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 5, "Should have 5 content template routes");
    }
}
