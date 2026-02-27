//! Social links handlers

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;
use validator::Validate;

use crate::dto::social::{
    CreateSocialLinkRequest, ReorderSocialLinksRequest, SocialLinkResponse, UpdateSocialLinkRequest,
};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::models::audit::AuditAction;
use crate::models::site_membership::SiteRole;
use crate::models::social::SocialLink;
use crate::services::audit_service;
use crate::AppState;

/// List all social links for a site
#[utoipa::path(
    tag = "Social Links",
    operation_id = "list_social_links",
    description = "List all social links for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "List of social links", body = Vec<SocialLinkResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/social")]
pub async fn list_social_links(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
) -> Result<Json<Vec<SocialLinkResponse>>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let links = SocialLink::find_all_for_site(&state.db, site_id).await?;
    let responses: Vec<SocialLinkResponse> =
        links.into_iter().map(SocialLinkResponse::from).collect();
    Ok(Json(responses))
}

/// Get social link by ID
#[utoipa::path(
    tag = "Social Links",
    operation_id = "get_social_link",
    description = "Get a social link by ID",
    params(("id" = Uuid, Path, description = "Social link UUID")),
    responses(
        (status = 200, description = "Social link details", body = SocialLinkResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Social link not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/social/<id>")]
pub async fn get_social_link(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Json<SocialLinkResponse>, ApiError> {
    let link = SocialLink::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, link.site_id, &SiteRole::Viewer)
        .await?;
    Ok(Json(SocialLinkResponse::from(link)))
}

/// Create a new social link
#[utoipa::path(
    tag = "Social Links",
    operation_id = "create_social_link",
    description = "Create a new social link for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = CreateSocialLinkRequest, description = "Social link data"),
    responses(
        (status = 201, description = "Social link created", body = SocialLinkResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/sites/<site_id>/social", data = "<body>")]
pub async fn create_social_link(
    state: &State<AppState>,
    site_id: Uuid,
    body: Json<CreateSocialLinkRequest>,
    auth: ReadKey,
) -> Result<(Status, Json<SocialLinkResponse>), ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Author)
        .await?;
    let mut req = body.into_inner();
    req.site_id = site_id; // Override with path param
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let link = SocialLink::create(&state.db, req).await?;
    audit_service::log_action(
        &state.db,
        Some(site_id),
        Some(auth.0.id),
        AuditAction::Create,
        "social_link",
        link.id,
        None,
    )
    .await;
    Ok((Status::Created, Json(SocialLinkResponse::from(link))))
}

/// Update a social link
#[utoipa::path(
    tag = "Social Links",
    operation_id = "update_social_link",
    description = "Update a social link",
    params(("id" = Uuid, Path, description = "Social link UUID")),
    request_body(content = UpdateSocialLinkRequest, description = "Social link update data"),
    responses(
        (status = 200, description = "Social link updated", body = SocialLinkResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Social link not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[put("/social/<id>", data = "<body>")]
pub async fn update_social_link(
    state: &State<AppState>,
    id: Uuid,
    body: Json<UpdateSocialLinkRequest>,
    auth: ReadKey,
) -> Result<Json<SocialLinkResponse>, ApiError> {
    let existing = SocialLink::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, existing.site_id, &SiteRole::Author)
        .await?;
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let link = SocialLink::update(&state.db, id, req).await?;
    audit_service::log_action(
        &state.db,
        Some(existing.site_id),
        Some(auth.0.id),
        AuditAction::Update,
        "social_link",
        id,
        None,
    )
    .await;
    Ok(Json(SocialLinkResponse::from(link)))
}

/// Batch-reorder social links for a site
#[utoipa::path(
    tag = "Social Links",
    operation_id = "reorder_social_links",
    description = "Batch-reorder social links for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = ReorderSocialLinksRequest, description = "New ordering"),
    responses(
        (status = 204, description = "Social links reordered"),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Social link not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/sites/<site_id>/social/reorder", data = "<body>")]
pub async fn reorder_social_links(
    state: &State<AppState>,
    site_id: Uuid,
    body: Json<ReorderSocialLinksRequest>,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Author)
        .await?;
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let items: Vec<(Uuid, i16)> = req
        .items
        .into_iter()
        .map(|i| (i.id, i.display_order))
        .collect();
    SocialLink::reorder_for_site(&state.db, site_id, items).await?;
    Ok(Status::NoContent)
}

/// Delete a social link
#[utoipa::path(
    tag = "Social Links",
    operation_id = "delete_social_link",
    description = "Delete a social link",
    params(("id" = Uuid, Path, description = "Social link UUID")),
    responses(
        (status = 204, description = "Social link deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Social link not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/social/<id>")]
pub async fn delete_social_link(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    let link = SocialLink::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, link.site_id, &SiteRole::Editor)
        .await?;
    SocialLink::delete(&state.db, id).await?;
    audit_service::log_action(
        &state.db,
        Some(link.site_id),
        Some(auth.0.id),
        AuditAction::Delete,
        "social_link",
        id,
        None,
    )
    .await;
    Ok(Status::NoContent)
}

/// Collect social routes
pub fn routes() -> Vec<Route> {
    routes![
        list_social_links,
        get_social_link,
        create_social_link,
        update_social_link,
        reorder_social_links,
        delete_social_link
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 6, "Should have 6 social routes");
    }
}
