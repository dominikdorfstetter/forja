//! Redirect handlers

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;
use validator::Validate;

use crate::dto::redirect::{
    CreateRedirectRequest, PaginatedRedirects, RedirectLookupResponse, RedirectResponse,
    UpdateRedirectRequest,
};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::models::audit::AuditAction;
use crate::models::redirect::Redirect;
use crate::models::site_membership::SiteRole;
use crate::services::audit_service;
use crate::utils::pagination::PaginationParams;
use crate::AppState;

/// List redirects for a site (paginated)
#[utoipa::path(
    tag = "Redirects",
    operation_id = "list_redirects",
    description = "List all redirects for a site (paginated)",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default 1)"),
        ("per_page" = Option<i64>, Query, description = "Items per page (default 10, max 100)")
    ),
    responses(
        (status = 200, description = "Paginated redirect list", body = PaginatedRedirects),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/redirects?<page>&<per_page>")]
pub async fn list_redirects(
    state: &State<AppState>,
    site_id: Uuid,
    page: Option<i64>,
    per_page: Option<i64>,
    auth: ReadKey,
) -> Result<Json<PaginatedRedirects>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let params = PaginationParams::new(page, per_page);
    let (limit, offset) = params.limit_offset();

    let redirects = Redirect::find_all_for_site(&state.db, site_id, limit, offset).await?;
    let total = Redirect::count_for_site(&state.db, site_id).await?;

    let items: Vec<RedirectResponse> = redirects.into_iter().map(RedirectResponse::from).collect();
    let paginated = params.paginate(items, total);

    Ok(Json(paginated))
}

/// Get a redirect by ID
#[utoipa::path(
    tag = "Redirects",
    operation_id = "get_redirect",
    description = "Get a redirect by ID",
    params(("id" = Uuid, Path, description = "Redirect UUID")),
    responses(
        (status = 200, description = "Redirect details", body = RedirectResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/redirects/<id>")]
pub async fn get_redirect(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Json<RedirectResponse>, ApiError> {
    let redirect = Redirect::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, redirect.site_id, &SiteRole::Viewer)
        .await?;
    Ok(Json(RedirectResponse::from(redirect)))
}

/// Create a redirect
#[utoipa::path(
    tag = "Redirects",
    operation_id = "create_redirect",
    description = "Create a new redirect for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = CreateRedirectRequest, description = "Redirect data"),
    responses(
        (status = 201, description = "Redirect created", body = RedirectResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 409, description = "Duplicate source path", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/sites/<site_id>/redirects", data = "<body>")]
pub async fn create_redirect(
    state: &State<AppState>,
    site_id: Uuid,
    body: Json<CreateRedirectRequest>,
    auth: ReadKey,
) -> Result<(Status, Json<RedirectResponse>), ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Author)
        .await?;
    let mut req = body.into_inner();
    req.site_id = site_id; // Override with path param
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    // Cross-field check
    if req.source_path == req.destination_path {
        return Err(ApiError::BadRequest(
            "Source and destination paths must be different".to_string(),
        ));
    }

    let redirect = Redirect::create(&state.db, req).await?;
    audit_service::log_action(
        &state.db,
        Some(site_id),
        Some(auth.0.id),
        AuditAction::Create,
        "redirect",
        redirect.id,
        None,
    )
    .await;

    Ok((Status::Created, Json(RedirectResponse::from(redirect))))
}

/// Update a redirect
#[utoipa::path(
    tag = "Redirects",
    operation_id = "update_redirect",
    description = "Update a redirect",
    params(("id" = Uuid, Path, description = "Redirect UUID")),
    request_body(content = UpdateRedirectRequest, description = "Redirect update data"),
    responses(
        (status = 200, description = "Redirect updated", body = RedirectResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails),
        (status = 409, description = "Duplicate source path", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[put("/redirects/<id>", data = "<body>")]
pub async fn update_redirect(
    state: &State<AppState>,
    id: Uuid,
    body: Json<UpdateRedirectRequest>,
    auth: ReadKey,
) -> Result<Json<RedirectResponse>, ApiError> {
    let existing = Redirect::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, existing.site_id, &SiteRole::Author)
        .await?;

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    // Cross-field check: resolve effective values
    let effective_source = req.source_path.as_deref().unwrap_or(&existing.source_path);
    let effective_dest = req
        .destination_path
        .as_deref()
        .unwrap_or(&existing.destination_path);
    if effective_source == effective_dest {
        return Err(ApiError::BadRequest(
            "Source and destination paths must be different".to_string(),
        ));
    }

    let redirect = Redirect::update(&state.db, id, req).await?;
    audit_service::log_action(
        &state.db,
        Some(existing.site_id),
        Some(auth.0.id),
        AuditAction::Update,
        "redirect",
        id,
        None,
    )
    .await;

    Ok(Json(RedirectResponse::from(redirect)))
}

/// Delete a redirect
#[utoipa::path(
    tag = "Redirects",
    operation_id = "delete_redirect",
    description = "Delete a redirect",
    params(("id" = Uuid, Path, description = "Redirect UUID")),
    responses(
        (status = 204, description = "Redirect deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/redirects/<id>")]
pub async fn delete_redirect(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    let redirect = Redirect::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, redirect.site_id, &SiteRole::Editor)
        .await?;

    Redirect::delete(&state.db, id).await?;
    audit_service::log_action(
        &state.db,
        Some(redirect.site_id),
        Some(auth.0.id),
        AuditAction::Delete,
        "redirect",
        id,
        None,
    )
    .await;

    Ok(Status::NoContent)
}

/// Lookup an active redirect by source path
#[utoipa::path(
    tag = "Redirects",
    operation_id = "lookup_redirect",
    description = "Lookup an active redirect by source path for a site",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("path" = String, Query, description = "Source path to look up")
    ),
    responses(
        (status = 200, description = "Redirect found", body = RedirectLookupResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "No active redirect for this path", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/redirects/lookup?<path>")]
pub async fn lookup_redirect(
    state: &State<AppState>,
    site_id: Uuid,
    path: String,
    auth: ReadKey,
) -> Result<Json<RedirectLookupResponse>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;

    let redirect = Redirect::find_by_source_path(&state.db, site_id, &path)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No active redirect for path '{}'", path)))?;

    Ok(Json(RedirectLookupResponse {
        destination_path: redirect.destination_path,
        status_code: redirect.status_code,
    }))
}

/// Collect redirect routes
pub fn routes() -> Vec<Route> {
    routes![
        list_redirects,
        get_redirect,
        create_redirect,
        update_redirect,
        delete_redirect,
        lookup_redirect
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 6, "Should have 6 redirect routes");
    }
}
