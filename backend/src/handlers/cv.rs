//! CV/Resume handlers

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;
use validator::Validate;

use crate::dto::cv::{
    CreateCvEntryRequest, CreateSkillRequest, CvEntryResponse, PaginatedCvEntries, PaginatedSkills,
    SkillResponse, UpdateCvEntryRequest, UpdateSkillRequest,
};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::models::audit::AuditAction;
use crate::models::cv::{CvEntry, CvEntryType, Skill};
use crate::models::site_membership::SiteRole;
use crate::services::audit_service;
use crate::utils::pagination::PaginationParams;
use crate::AppState;

/// List all skills for a site
#[utoipa::path(
    tag = "CV",
    operation_id = "list_skills",
    description = "List all skills for a site",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default: 1)"),
        ("per_page" = Option<i64>, Query, description = "Items per page (default: 25)"),
    ),
    responses(
        (status = 200, description = "List of skills", body = PaginatedSkills),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/skills?<page>&<per_page>")]
pub async fn list_skills(
    state: &State<AppState>,
    site_id: Uuid,
    page: Option<i64>,
    per_page: Option<i64>,
    auth: ReadKey,
) -> Result<Json<PaginatedSkills>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let params = PaginationParams::new(page, per_page);
    let (limit, offset) = params.limit_offset();
    let skills = Skill::find_all_for_site(&state.db, site_id, limit, offset).await?;
    let total = Skill::count_for_site(&state.db, site_id).await?;
    Ok(Json(params.paginate(
        skills.into_iter().map(SkillResponse::from).collect(),
        total,
    )))
}

/// Get skill by ID
#[utoipa::path(
    tag = "CV",
    operation_id = "get_skill",
    description = "Get a skill by ID",
    params(("id" = Uuid, Path, description = "Skill UUID")),
    responses(
        (status = 200, description = "Skill details", body = SkillResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Skill not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/skills/<id>")]
pub async fn get_skill(
    state: &State<AppState>,
    id: Uuid,
    _auth: ReadKey,
) -> Result<Json<SkillResponse>, ApiError> {
    let skill = Skill::find_by_id(&state.db, id).await?;
    Ok(Json(SkillResponse::from(skill)))
}

/// Get skill by slug
#[utoipa::path(
    tag = "CV",
    operation_id = "get_skill_by_slug",
    description = "Get a skill by slug",
    params(("slug" = String, Path, description = "Skill slug")),
    responses(
        (status = 200, description = "Skill details", body = SkillResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Skill not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/skills/by-slug/<slug>", rank = 1)]
pub async fn get_skill_by_slug(
    state: &State<AppState>,
    slug: &str,
    _auth: ReadKey,
) -> Result<Json<SkillResponse>, ApiError> {
    let skill = Skill::find_by_slug(&state.db, slug).await?;
    Ok(Json(SkillResponse::from(skill)))
}

/// Create a skill
#[utoipa::path(
    tag = "CV",
    operation_id = "create_skill",
    description = "Create a new skill",
    request_body(content = CreateSkillRequest, description = "Skill creation data"),
    responses(
        (status = 201, description = "Skill created", body = SkillResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/skills", data = "<body>")]
pub async fn create_skill(
    state: &State<AppState>,
    body: Json<CreateSkillRequest>,
    auth: ReadKey,
) -> Result<(Status, Json<SkillResponse>), ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    for site_id in &req.site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Author)
            .await?;
    }

    let site_id = req.site_ids.first().copied();
    let skill = Skill::create(&state.db, req).await?;
    audit_service::log_action(
        &state.db,
        site_id,
        Some(auth.0.id),
        AuditAction::Create,
        "skill",
        skill.id,
        None,
    )
    .await;
    Ok((Status::Created, Json(SkillResponse::from(skill))))
}

/// Update a skill
#[utoipa::path(
    tag = "CV",
    operation_id = "update_skill",
    description = "Update a skill",
    params(("id" = Uuid, Path, description = "Skill UUID")),
    request_body(content = UpdateSkillRequest, description = "Skill update data"),
    responses(
        (status = 200, description = "Skill updated", body = SkillResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Skill not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[put("/skills/<id>", data = "<body>")]
pub async fn update_skill(
    state: &State<AppState>,
    id: Uuid,
    body: Json<UpdateSkillRequest>,
    auth: ReadKey,
) -> Result<Json<SkillResponse>, ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let skill = Skill::update(&state.db, id, req).await?;
    audit_service::log_action(
        &state.db,
        None,
        Some(auth.0.id),
        AuditAction::Update,
        "skill",
        id,
        None,
    )
    .await;
    Ok(Json(SkillResponse::from(skill)))
}

/// Delete a skill (soft delete)
#[utoipa::path(
    tag = "CV",
    operation_id = "delete_skill",
    description = "Soft delete a skill",
    params(("id" = Uuid, Path, description = "Skill UUID")),
    responses(
        (status = 204, description = "Skill deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Skill not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/skills/<id>")]
pub async fn delete_skill(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    Skill::soft_delete(&state.db, id).await?;
    audit_service::log_action(
        &state.db,
        None,
        Some(auth.0.id),
        AuditAction::Delete,
        "skill",
        id,
        None,
    )
    .await;
    Ok(Status::NoContent)
}

/// List all CV entries for a site
#[utoipa::path(
    tag = "CV",
    operation_id = "list_cv_entries",
    description = "List all CV entries for a site, optionally filtered by type",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("entry_type" = Option<String>, Query, description = "Filter by type (work, education, volunteer, certification, project)"),
        ("page" = Option<i64>, Query, description = "Page number (default: 1)"),
        ("per_page" = Option<i64>, Query, description = "Items per page (default: 25)"),
    ),
    responses(
        (status = 200, description = "List of CV entries", body = PaginatedCvEntries),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/cv?<entry_type>&<page>&<per_page>")]
pub async fn list_cv_entries(
    state: &State<AppState>,
    site_id: Uuid,
    entry_type: Option<String>,
    page: Option<i64>,
    per_page: Option<i64>,
    auth: ReadKey,
) -> Result<Json<PaginatedCvEntries>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let et = entry_type.and_then(|t| match t.as_str() {
        "work" => Some(CvEntryType::Work),
        "education" => Some(CvEntryType::Education),
        "volunteer" => Some(CvEntryType::Volunteer),
        "certification" => Some(CvEntryType::Certification),
        "project" => Some(CvEntryType::Project),
        _ => None,
    });

    let params = PaginationParams::new(page, per_page);
    let (limit, offset) = params.limit_offset();
    let entries = CvEntry::find_all_for_site(&state.db, site_id, et.clone(), limit, offset).await?;
    let total = CvEntry::count_for_site(&state.db, site_id, et).await?;
    Ok(Json(params.paginate(
        entries.into_iter().map(CvEntryResponse::from).collect(),
        total,
    )))
}

/// Get CV entry by ID
#[utoipa::path(
    tag = "CV",
    operation_id = "get_cv_entry",
    description = "Get a CV entry by ID",
    params(("id" = Uuid, Path, description = "CV entry UUID")),
    responses(
        (status = 200, description = "CV entry details", body = CvEntryResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "CV entry not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/cv/<id>")]
pub async fn get_cv_entry(
    state: &State<AppState>,
    id: Uuid,
    _auth: ReadKey,
) -> Result<Json<CvEntryResponse>, ApiError> {
    let entry = CvEntry::find_by_id(&state.db, id).await?;
    Ok(Json(CvEntryResponse::from(entry)))
}

/// Create a CV entry
#[utoipa::path(
    tag = "CV",
    operation_id = "create_cv_entry",
    description = "Create a new CV entry",
    request_body(content = CreateCvEntryRequest, description = "CV entry creation data"),
    responses(
        (status = 201, description = "CV entry created", body = CvEntryResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/cv", data = "<body>")]
pub async fn create_cv_entry(
    state: &State<AppState>,
    body: Json<CreateCvEntryRequest>,
    auth: ReadKey,
) -> Result<(Status, Json<CvEntryResponse>), ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    for site_id in &req.site_ids {
        auth.0
            .authorize_site_action(&state.db, *site_id, &SiteRole::Author)
            .await?;
    }

    let site_id = req.site_ids.first().copied();
    let entry = CvEntry::create(&state.db, req).await?;
    audit_service::log_action(
        &state.db,
        site_id,
        Some(auth.0.id),
        AuditAction::Create,
        "cv_entry",
        entry.id,
        None,
    )
    .await;
    Ok((Status::Created, Json(CvEntryResponse::from(entry))))
}

/// Update a CV entry
#[utoipa::path(
    tag = "CV",
    operation_id = "update_cv_entry",
    description = "Update a CV entry",
    params(("id" = Uuid, Path, description = "CV entry UUID")),
    request_body(content = UpdateCvEntryRequest, description = "CV entry update data"),
    responses(
        (status = 200, description = "CV entry updated", body = CvEntryResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "CV entry not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[put("/cv/<id>", data = "<body>")]
pub async fn update_cv_entry(
    state: &State<AppState>,
    id: Uuid,
    body: Json<UpdateCvEntryRequest>,
    auth: ReadKey,
) -> Result<Json<CvEntryResponse>, ApiError> {
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let entry = CvEntry::update(&state.db, id, req).await?;
    audit_service::log_action(
        &state.db,
        None,
        Some(auth.0.id),
        AuditAction::Update,
        "cv_entry",
        id,
        None,
    )
    .await;
    Ok(Json(CvEntryResponse::from(entry)))
}

/// Delete a CV entry (soft delete)
#[utoipa::path(
    tag = "CV",
    operation_id = "delete_cv_entry",
    description = "Soft delete a CV entry",
    params(("id" = Uuid, Path, description = "CV entry UUID")),
    responses(
        (status = 204, description = "CV entry deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "CV entry not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/cv/<id>")]
pub async fn delete_cv_entry(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    CvEntry::soft_delete(&state.db, id).await?;
    audit_service::log_action(
        &state.db,
        None,
        Some(auth.0.id),
        AuditAction::Delete,
        "cv_entry",
        id,
        None,
    )
    .await;
    Ok(Status::NoContent)
}

/// Collect CV routes
pub fn routes() -> Vec<Route> {
    routes![
        list_skills,
        get_skill_by_slug,
        get_skill,
        create_skill,
        update_skill,
        delete_skill,
        list_cv_entries,
        get_cv_entry,
        create_cv_entry,
        update_cv_entry,
        delete_cv_entry
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 11, "Should have 11 CV routes");
    }
}
