//! Axum port of `crate::handlers::cv`. 15 endpoints for skills + CV
//! entry CRUD, review, bulk ops, and reorder. Mounted under `/api/v1`.
//!
//! First Phase 4 bundle to wire `ModuleGuard<CvModule>` /
//! `ModuleGuard<PortfolioModule>` extractors on real handlers.

use crate::axum_app::authorized_content::{
    AnySite, AuthorizedContent, AuthorizedSite, CvSite, Delete, Read, Update,
};
use crate::axum_app::extractors::ResolveLocale;
use crate::dto::bulk::{BulkAction, BulkContentRequest, BulkContentResponse};
use crate::dto::cv::{
    CreateCvEntryRequest, CreateSkillRequest, CvEntryDetailResponse, CvEntryLocalizationResponse,
    CvEntryResponse, PaginatedCvEntries, PaginatedSkills, ReorderCvEntriesRequest, SkillResponse,
    UpdateCvEntryRequest, UpdateSkillRequest,
};
use crate::dto::review::{ReviewActionRequest, ReviewActionResponse};
use crate::dto::validated::ValidatedJson;
use crate::errors::{codes, ApiError, ProblemDetails};
use crate::guards::actor::Actor;
use crate::guards::auth_guard::{ReadKey, WriteKey};
use crate::guards::module_guard::{CvModule, ModuleGuard};
use crate::models::audit::AuditAction;
use crate::models::cv::{CvEntry, CvEntryType, Skill};
use crate::repos::cv_repo::{CvEntryRepo, SkillRepo};
use crate::services::audited_mutation::AuditedEntity;
use crate::services::bulk_content_service::BulkContentService;
use crate::services::content_lifecycle;
use crate::services::permission_service::{Permission, PermissionService};
use crate::services::publish_pipeline::{self, PublishEvent};
use crate::services::review_service::{ReviewContext, ReviewService};
use crate::utils::list_params::ListParams;
use crate::utils::locale_resolver::{collapse_localizations, pick_one, resolve_ids_for_site};
use crate::AppState;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::Json;
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
struct ListSkillsQuery {
    page: Option<i64>,
    page_size: Option<i64>,
    search: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ListCvQuery {
    entry_type: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
    search: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
}

/// Verify the caller has `permission` on at least one of the provided
/// sites. Returns the first authorized site id (used for audit logging).
///
/// `entity_type` tags the not-found error so the response carries
/// `code: ENTITY_NOT_FOUND, entity_type: <tag>`.
async fn require_any_site_permission(
    pool: &sqlx::PgPool,
    auth: &Actor,
    site_ids: &[Uuid],
    permission: &Permission,
    entity_type: &'static str,
) -> Result<Uuid, ApiError> {
    if site_ids.is_empty() {
        return Err(ApiError::not_found("Resource not associated with any site")
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type(entity_type));
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
    path = "/sites/{site_id}/skills",
    tag = "CV",
    operation_id = "list_skills",
    description = "List all skills for a site",
    params(
        ("site_id" = Uuid, Path, description = "The UUID of the site"),
        ("page" = Option<i64>, Query, description = "Page number, 1-indexed (default: 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page, 1–100 (default: 10)"),
        ("search" = Option<String>, Query, description = "Search by skill slug (case-insensitive partial match)"),
        ("sort_by" = Option<String>, Query, description = "Sort field: slug, display_order, created_at (default: slug)"),
        ("sort_dir" = Option<String>, Query, description = "Sort direction: asc or desc (default: asc)"),
        ("locale" = Option<String>, Query, description = "Optional locale code. When set, each skill's `localizations[]` collapses to one element resolved via the site's locale chain (ADR 0002).")
    ),
    responses(
        (status = 200, description = "List of skills", body = PaginatedSkills),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_skills(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<ListSkillsQuery>,
    locale: ResolveLocale,
    _access: AuthorizedSite<CvSite, Read>,
) -> Result<Json<PaginatedSkills>, ApiError> {
    let suffix = format!(
        "skills:p{:?}:ps{:?}:q{:?}:sb{:?}:sd{:?}:loc{:?}",
        q.page, q.page_size, q.search, q.sort_by, q.sort_dir, locale.0
    );
    let result = crate::services::response_cache::cached(
        &state.redis,
        &crate::services::response_cache::key(site_id, &suffix),
        || async {
            let params = ListParams::new(q.page, q.page_size, q.search, q.sort_by, q.sort_dir);
            let skills = SkillRepo::find_all_for_site_filtered(&state.db, site_id, &params).await?;
            let total =
                SkillRepo::count_for_site_filtered(&state.db, site_id, params.search_ref()).await?;

            let skill_ids: Vec<Uuid> = skills.iter().map(|s| s.id).collect();
            let mut localizations =
                SkillRepo::find_localizations_for_skills(&state.db, &skill_ids).await?;

            let mut items: Vec<SkillResponse> = skills
                .into_iter()
                .map(|s| {
                    let locs = localizations.remove(&s.id).unwrap_or_default();
                    SkillResponse::from((s, locs))
                })
                .collect();

            if let Some(resolution) =
                resolve_ids_for_site(locale.0.as_deref(), &state.db, site_id).await?
            {
                for item in items.iter_mut() {
                    let locs = std::mem::take(&mut item.localizations);
                    item.localizations = pick_one(locs, |l| l.locale_id, resolution);
                }
            }

            Ok(params.paginate(items, total))
        },
    )
    .await?;
    Ok(Json(result))
}

/// Single-skill helper. Fetches the localizations for one skill via the
/// bulk endpoint and unwraps the (at most one) entry. Returns an empty
/// Vec when no localizations exist.
async fn skill_localizations_for(
    pool: &sqlx::PgPool,
    skill_id: Uuid,
) -> Result<Vec<crate::models::cv::SkillLocalization>, ApiError> {
    let mut map = SkillRepo::find_localizations_for_skills(pool, &[skill_id]).await?;
    Ok(map.remove(&skill_id).unwrap_or_default())
}

#[utoipa::path(
    get,
    path = "/skills/{id}",
    tag = "CV",
    operation_id = "get_skill",
    description = "Get a skill by ID",
    params(
        ("id" = Uuid, Path, description = "The UUID of the skill"),
        ("locale" = Option<String>, Query, description = "Optional locale code. When set, `localizations[]` collapses to one resolved element (ADR 0002).")
    ),
    responses(
        (status = 200, description = "Skill details", body = SkillResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this skill's site", body = ProblemDetails),
        (status = 404, description = "Skill not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_skill(
    State(state): State<AppState>,
    locale: ResolveLocale,
    access: AuthorizedContent<Skill, Read, AnySite>,
) -> Result<Json<SkillResponse>, ApiError> {
    let site_id = access.primary_site_id;
    let locs = skill_localizations_for(&state.db, access.entity.id).await?;
    let mut response = SkillResponse::from((access.entity, locs));
    response.localizations = collapse_localizations(
        &state.db,
        site_id,
        locale.0.as_deref(),
        response.localizations,
        |l| l.locale_id,
    )
    .await?;
    Ok(Json(response))
}

#[utoipa::path(
    get,
    path = "/skills/by-slug/{slug}",
    tag = "CV",
    operation_id = "get_skill_by_slug",
    description = "Get a skill by slug",
    params(
        ("slug" = String, Path, description = "URL-friendly identifier (lowercase, hyphens only)"),
        ("locale" = Option<String>, Query, description = "Optional locale code. When set, `localizations[]` collapses to one resolved element (ADR 0002).")
    ),
    responses(
        (status = 200, description = "Skill details", body = SkillResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this skill's site", body = ProblemDetails),
        (status = 404, description = "Skill not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_skill_by_slug(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    locale: ResolveLocale,
    auth: ReadKey,
) -> Result<Json<SkillResponse>, ApiError> {
    let skill = SkillRepo::find_by_slug(&state.db, &slug).await?;
    let site_ids = SkillRepo::find_site_ids(&state.db, skill.id).await?;
    let authorized_site_id = require_any_site_permission(
        &state.db,
        &auth.0,
        &site_ids,
        &Permission::new("cv", "read"),
        "skill",
    )
    .await?;
    let locs = skill_localizations_for(&state.db, skill.id).await?;
    let mut response = SkillResponse::from((skill, locs));
    response.localizations = collapse_localizations(
        &state.db,
        authorized_site_id,
        locale.0.as_deref(),
        response.localizations,
        |l| l.locale_id,
    )
    .await?;
    Ok(Json(response))
}

#[utoipa::path(
    post,
    path = "/skills",
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
async fn create_skill(
    State(state): State<AppState>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<CreateSkillRequest>,
) -> Result<(StatusCode, Json<SkillResponse>), ApiError> {
    for site_id in &body.site_ids {
        PermissionService::require(
            &state.db,
            &auth.0,
            *site_id,
            &Permission::new("cv", "create"),
        )
        .await?;
    }

    if let Some(&site_id) = body.site_ids.first() {
        ModuleGuard::<CvModule>::check(&state.db, site_id).await?;
    }

    let site_id = body.site_ids.first().copied();
    let skill = SkillRepo::create(&state.db, body.into_inner()).await?;
    if let Some(sid) = site_id {
        publish_pipeline::execute(
            &state.db,
            PublishEvent {
                site_id: sid,
                entity_type: "skill",
                entity_id: skill.id,
                // Skills have no Content row; content_id is unused
                // because skill has no status workflow / publish hook.
                content_id: Uuid::nil(),
                user_id: Some(auth.0.id),
                clerk_actor_id: auth.0.user_identifier().map(str::to_string),
                action: AuditAction::Create,
                webhook_event: "cv.created".to_string(),
                webhook_payload: serde_json::json!({"type": "skill", "name": &skill.name}),
                audit_metadata: None,
                status_transition: None,
                change_diff: None,
                slug: None,
                webhook_published_event: None,
            },
        )
        .await?;
    }
    let locs = skill_localizations_for(&state.db, skill.id).await?;
    Ok((
        StatusCode::CREATED,
        Json(SkillResponse::from((skill, locs))),
    ))
}

#[utoipa::path(
    put,
    path = "/skills/{id}",
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
async fn update_skill(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContent<Skill, Update, AnySite>,
    ValidatedJson(body): ValidatedJson<UpdateSkillRequest>,
) -> Result<Json<SkillResponse>, ApiError> {
    let skill = SkillRepo::update(&state.db, id, body.into_inner()).await?;
    publish_pipeline::execute(
        &state.db,
        PublishEvent {
            site_id: access.primary_site_id,
            entity_type: "skill",
            entity_id: id,
            content_id: Uuid::nil(),
            user_id: Some(access.actor.id),
            clerk_actor_id: access.actor.user_identifier().map(str::to_string),
            action: AuditAction::Update,
            webhook_event: "cv.updated".to_string(),
            webhook_payload: serde_json::json!({"type": "skill"}),
            audit_metadata: None,
            status_transition: None,
            change_diff: None,
            slug: None,
            webhook_published_event: None,
        },
    )
    .await?;
    let locs = skill_localizations_for(&state.db, skill.id).await?;
    Ok(Json(SkillResponse::from((skill, locs))))
}

#[utoipa::path(
    delete,
    path = "/skills/{id}",
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
async fn delete_skill(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContent<Skill, Delete, AnySite>,
) -> Result<StatusCode, ApiError> {
    SkillRepo::soft_delete(&state.db, id).await?;
    publish_pipeline::execute(
        &state.db,
        PublishEvent {
            site_id: access.primary_site_id,
            entity_type: "skill",
            entity_id: id,
            content_id: Uuid::nil(),
            user_id: Some(access.actor.id),
            clerk_actor_id: access.actor.user_identifier().map(str::to_string),
            action: AuditAction::Delete,
            webhook_event: "cv.deleted".to_string(),
            webhook_payload: serde_json::json!({"type": "skill"}),
            audit_metadata: None,
            status_transition: None,
            change_diff: None,
            slug: None,
            webhook_published_event: None,
        },
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/cv",
    tag = "CV",
    operation_id = "list_cv_entries",
    description = "List all CV entries for a site, optionally filtered by type",
    params(
        ("site_id" = Uuid, Path, description = "The UUID of the site"),
        ("entry_type" = Option<String>, Query, description = "Filter by entry type: Work, Education, Volunteer, Certification, Project"),
        ("page" = Option<i64>, Query, description = "Page number, 1-indexed (default: 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page, 1–100 (default: 10)"),
        ("search" = Option<String>, Query, description = "Search by company or location (case-insensitive partial match)"),
        ("sort_by" = Option<String>, Query, description = "Sort field: display_order, start_date, created_at (default: display_order)"),
        ("sort_dir" = Option<String>, Query, description = "Sort direction: asc or desc (default: asc)"),
        ("locale" = Option<String>, Query, description = "Optional locale code (e.g. `en`, `de-AT`). When set, each entry's `localizations[]` collapses to one element resolved via the site's locale chain (ADR 0002). Omit to return all localizations.")
    ),
    responses(
        (status = 200, description = "List of CV entries", body = PaginatedCvEntries),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_cv_entries(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<ListCvQuery>,
    locale: ResolveLocale,
    _access: AuthorizedSite<CvSite, Read>,
) -> Result<Json<PaginatedCvEntries>, ApiError> {
    let suffix = format!(
        "cv:et{:?}:p{:?}:ps{:?}:q{:?}:sb{:?}:sd{:?}:loc{:?}",
        q.entry_type, q.page, q.page_size, q.search, q.sort_by, q.sort_dir, locale.0
    );
    let result = crate::services::response_cache::cached(
        &state.redis,
        &crate::services::response_cache::key(site_id, &suffix),
        || async {
            let et = q.entry_type.and_then(|t| match t.as_str() {
                "work" => Some(CvEntryType::Work),
                "education" => Some(CvEntryType::Education),
                "volunteer" => Some(CvEntryType::Volunteer),
                "certification" => Some(CvEntryType::Certification),
                "project" => Some(CvEntryType::Project),
                _ => None,
            });

            let params = ListParams::new(q.page, q.page_size, q.search, q.sort_by, q.sort_dir);
            let entries =
                CvEntryRepo::find_all_for_site_filtered(&state.db, site_id, et.clone(), &params)
                    .await?;
            let total =
                CvEntryRepo::count_for_site_filtered(&state.db, site_id, et, params.search_ref())
                    .await?;

            let mut items = hydrate_cv_entry_list(&state.db, entries).await?;
            apply_locale_to_cv_list(&mut items, &locale, &state.db, site_id).await?;
            Ok(params.paginate(items, total))
        },
    )
    .await?;
    Ok(Json(result))
}

/// Apply ADR 0002 §1 resolver to each item's `localizations[]` when
/// `?locale=` is set. No-op (and zero extra SQL) when the param is absent.
async fn apply_locale_to_cv_list(
    items: &mut [CvEntryResponse],
    locale: &ResolveLocale,
    pool: &sqlx::PgPool,
    site_id: Uuid,
) -> Result<(), ApiError> {
    let Some(resolution) = resolve_ids_for_site(locale.0.as_deref(), pool, site_id).await? else {
        return Ok(());
    };
    for item in items.iter_mut() {
        let locs = std::mem::take(&mut item.localizations);
        item.localizations = pick_one(locs, |l| l.locale_id, resolution);
    }
    Ok(())
}

/// Bulk-hydrate a page of CV entries with `localizations[]` and `skill_ids[]`
/// using one SQL round-trip per association (two queries total, regardless of
/// page size — no N+1). Missing rows become empty vecs, never `null`. Empty
/// input slices short-circuit without hitting the DB.
async fn hydrate_cv_entry_list(
    pool: &sqlx::PgPool,
    entries: Vec<CvEntry>,
) -> Result<Vec<CvEntryResponse>, ApiError> {
    let ids: Vec<Uuid> = entries.iter().map(|e| e.id).collect();
    let mut skills = CvEntryRepo::skill_ids_for_entries(pool, &ids).await?;

    let loc_rows = CvEntryRepo::find_localizations_for_entries(pool, &ids).await?;
    let mut localizations: std::collections::HashMap<Uuid, Vec<CvEntryLocalizationResponse>> =
        std::collections::HashMap::new();
    for row in loc_rows {
        localizations
            .entry(row.cv_entry_id)
            .or_default()
            .push(CvEntryLocalizationResponse::from(row));
    }

    Ok(entries
        .into_iter()
        .map(|e| {
            let id = e.id;
            CvEntryResponse::from(e)
                .with_skill_ids(skills.remove(&id).unwrap_or_default())
                .with_localizations(localizations.remove(&id).unwrap_or_default())
        })
        .collect())
}

/// Build the lightweight `CvEntryResponse` for a single entry: hydrate
/// `localizations[]` + `skill_ids[]` (matching the list-item shape) and
/// collapse localizations when `?locale=` is set (ADR 0002). Shared by the
/// lightweight `/cv/{id}` route and the `/cv/{id}/detail` route — CV's list
/// and detail shapes are intentionally identical (ADR 0003).
async fn load_cv_entry_response(
    state: &AppState,
    id: Uuid,
    entity: CvEntry,
    site_id: Uuid,
    locale: &ResolveLocale,
) -> Result<CvEntryResponse, ApiError> {
    let localizations = CvEntryRepo::get_localizations(&state.db, id).await?;
    let skill_ids = CvEntryRepo::get_skill_ids(&state.db, id).await?;

    let mut entry = CvEntryResponse::from(entity)
        .with_localizations(
            localizations
                .into_iter()
                .map(CvEntryLocalizationResponse::from)
                .collect(),
        )
        .with_skill_ids(skill_ids);
    entry.localizations = collapse_localizations(
        &state.db,
        site_id,
        locale.0.as_deref(),
        entry.localizations,
        |l| l.locale_id,
    )
    .await?;
    Ok(entry)
}

#[utoipa::path(
    get,
    path = "/cv/{id}",
    tag = "CV",
    operation_id = "get_cv_entry",
    description = "Get a CV entry by ID (lightweight list shape; see GET /cv/{id}/detail for the full graph — ADR 0003)",
    params(
        ("id" = Uuid, Path, description = "The UUID of the CV entry"),
        ("locale" = Option<String>, Query, description = "Optional locale code. When set, `localizations[]` collapses to one resolved element (ADR 0002).")
    ),
    responses(
        (status = 200, description = "CV entry (lightweight)", body = CvEntryResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this CV entry's site", body = ProblemDetails),
        (status = 404, description = "CV entry not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_cv_entry(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    locale: ResolveLocale,
    access: AuthorizedContent<CvEntry, Read, AnySite>,
) -> Result<Json<CvEntryResponse>, ApiError> {
    let site_id = access.primary_site_id;
    let entry = load_cv_entry_response(&state, id, access.entity, site_id, &locale).await?;
    Ok(Json(entry))
}

#[utoipa::path(
    get,
    path = "/cv/{id}/detail",
    tag = "CV",
    operation_id = "get_cv_entry_detail",
    description = "Get a CV entry's full detail by ID (ADR 0003). For CV the detail shape is intentionally identical to the lightweight list shape.",
    params(
        ("id" = Uuid, Path, description = "The UUID of the CV entry"),
        ("locale" = Option<String>, Query, description = "Optional locale code. When set, `localizations[]` collapses to one resolved element (ADR 0002).")
    ),
    responses(
        (status = 200, description = "CV entry detail", body = CvEntryDetailResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this CV entry's site", body = ProblemDetails),
        (status = 404, description = "CV entry not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_cv_entry_detail(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    locale: ResolveLocale,
    access: AuthorizedContent<CvEntry, Read, AnySite>,
) -> Result<Json<CvEntryDetailResponse>, ApiError> {
    let site_id = access.primary_site_id;
    let entry = load_cv_entry_response(&state, id, access.entity, site_id, &locale).await?;
    Ok(Json(CvEntryDetailResponse { entry }))
}

#[utoipa::path(
    post,
    path = "/cv",
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
async fn create_cv_entry(
    State(state): State<AppState>,
    access: crate::axum_app::authorized_content::AuthorizedJson<
        crate::axum_app::authorized_content::CvSite,
        CreateCvEntryRequest,
        crate::axum_app::authorized_content::Create,
    >,
) -> Result<(StatusCode, Json<CvEntryResponse>), ApiError> {
    let actor = access.actor;
    let body = access.validated.into_inner();
    // cv_entry is a `ContentEntity` (#864): the generic lifecycle owns the
    // create transaction (spine + entity rows atomic) and fires the
    // `cv.created` pipeline event with the `cv_entry` audit type.
    let entry = content_lifecycle::create::<CvEntry>(&state.db, body, &actor).await?;
    Ok((StatusCode::CREATED, Json(CvEntryResponse::from(entry))))
}

#[utoipa::path(
    put,
    path = "/cv/{id}",
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
async fn update_cv_entry(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContent<CvEntry, Update, AnySite>,
    ValidatedJson(body): ValidatedJson<UpdateCvEntryRequest>,
) -> Result<Json<CvEntryResponse>, ApiError> {
    // cv_entry is a `ContentUpdate` (#895): the generic lifecycle owns the
    // update transaction (spine + entity rows atomic) and fires the
    // `cv.updated` pipeline event. `vec![access.primary_site_id]` preserves the
    // bespoke handler's event site_id == primary_site_id.
    let entry = content_lifecycle::update::<CvEntry>(
        &state.db,
        id,
        body.into_inner(),
        access.entity,
        vec![access.primary_site_id],
        &access.actor,
    )
    .await?;
    Ok(Json(CvEntryResponse::from(entry)))
}

#[utoipa::path(
    delete,
    path = "/cv/{id}",
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
async fn delete_cv_entry(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContent<CvEntry, Delete, AnySite>,
) -> Result<StatusCode, ApiError> {
    let entry = access.entity;
    CvEntryRepo::soft_delete(&state.db, id).await?;
    publish_pipeline::execute(
        &state.db,
        PublishEvent {
            site_id: access.primary_site_id,
            entity_type: "cv_entry",
            entity_id: id,
            content_id: entry.content_id.unwrap_or_default(),
            user_id: Some(access.actor.id),
            clerk_actor_id: access.actor.user_identifier().map(str::to_string),
            action: AuditAction::Delete,
            webhook_event: "cv.deleted".to_string(),
            webhook_payload: serde_json::json!({"type": "cv_entry"}),
            audit_metadata: None,
            status_transition: None,
            change_diff: None,
            slug: None,
            webhook_published_event: None,
        },
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/cv/{id}/review",
    tag = "CV",
    operation_id = "review_cv_entry",
    description = "Review a CV entry (approve or request changes)",
    params(("id" = Uuid, Path, description = "CV entry UUID")),
    request_body(content = ReviewActionRequest, description = "Review action data"),
    responses(
        (status = 200, description = "Review completed", body = ReviewActionResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "CV entry not found", body = ProblemDetails),
        (status = 422, description = "Invalid status for review", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn review_cv_entry(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContent<CvEntry, Update>,
    ValidatedJson(body): ValidatedJson<ReviewActionRequest>,
) -> Result<Json<ReviewActionResponse>, ApiError> {
    let entry = access.entity;
    let content_id = entry.content_id.ok_or_else(|| {
        ApiError::internal("CV entry has no content record").with_code(codes::INTERNAL_ERROR)
    })?;

    let slug = id.to_string();
    let content = crate::models::content::Content::find_by_id(&state.db, content_id).await?;
    let ctx = ReviewContext {
        content_id,
        entity_type: "cv_entry",
        entity_id: id,
        entity_slug: &slug,
        current_status: &content.status,
        has_future_publish_start: content
            .publish_start
            .map(|s| s > chrono::Utc::now())
            .unwrap_or(false),
    };

    let response = ReviewService::review_content(
        &state.db,
        &ctx,
        Some(access.primary_site_id),
        body.into_inner(),
        access.actor.user_identifier().map(|s| s.to_string()),
    )
    .await?;

    Ok(Json(response))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/cv/bulk",
    tag = "CV",
    operation_id = "bulk_cv_entries",
    description = "Perform bulk operations on CV entries (update status, delete)",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = BulkContentRequest, description = "Bulk operation data"),
    responses(
        (status = 200, description = "Bulk operation result", body = BulkContentResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn bulk_cv_entries(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
    _module: ModuleGuard<CvModule>,
    ValidatedJson(body): ValidatedJson<BulkContentRequest>,
) -> Result<Json<BulkContentResponse>, ApiError> {
    let required_perm = match body.action {
        BulkAction::Delete => Permission::new("cv", "delete"),
        BulkAction::UpdateStatus => Permission::new("cv", "update"),
    };
    PermissionService::require(&state.db, &auth.0, site_id, &required_perm).await?;

    if matches!(body.action, BulkAction::UpdateStatus) && body.status.is_none() {
        return Err(
            ApiError::bad_request("status field is required for UpdateStatus action")
                .with_code(codes::CV_BULK_STATUS_REQUIRED),
        );
    }

    let mut pairs = Vec::with_capacity(body.ids.len());
    for entry_id in &body.ids {
        match CvEntryRepo::find_by_id(&state.db, *entry_id).await {
            Ok(e) => pairs.push((*entry_id, e.content_id.unwrap_or(Uuid::nil()))),
            Err(_) => pairs.push((*entry_id, Uuid::nil())),
        }
    }

    let response = BulkContentService::process_bulk_operation(
        &state.db,
        "cv_entry",
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
    path = "/sites/{site_id}/skills/bulk",
    tag = "CV",
    operation_id = "bulk_skills",
    description = "Bulk delete skills",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = BulkContentRequest, description = "Bulk operation data (Delete action only)"),
    responses(
        (status = 200, description = "Bulk operation result", body = BulkContentResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn bulk_skills(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
    _module: ModuleGuard<CvModule>,
    ValidatedJson(body): ValidatedJson<BulkContentRequest>,
) -> Result<Json<BulkContentResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("cv", "delete"),
    )
    .await?;

    let mut results = Vec::with_capacity(body.ids.len());
    let mut succeeded = 0usize;
    let mut failed = 0usize;

    for skill_id in &body.ids {
        match SkillRepo::soft_delete(&state.db, *skill_id).await {
            Ok(()) => {
                succeeded += 1;
                results.push(crate::dto::bulk::BulkItemResult {
                    id: *skill_id,
                    success: true,
                    error: None,
                });
                AuditedEntity::audit_only("skill")
                    .mutate(AuditAction::Delete, *skill_id)
                    .site(site_id)
                    .actor(auth.0.id)
                    .metadata(serde_json::json!({"bulk": true}))
                    .execute(&state.db)
                    .await;
            }
            Err(e) => {
                failed += 1;
                results.push(crate::dto::bulk::BulkItemResult {
                    id: *skill_id,
                    success: false,
                    error: Some(e.to_string()),
                });
            }
        }
    }

    Ok(Json(BulkContentResponse {
        total: body.ids.len(),
        succeeded,
        failed,
        results,
    }))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/cv/reorder",
    tag = "CV",
    operation_id = "reorder_cv_entries",
    description = "Batch-reorder CV entries for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = ReorderCvEntriesRequest, description = "New ordering"),
    responses(
        (status = 204, description = "CV entries reordered"),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn reorder_cv_entries(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
    _module: ModuleGuard<CvModule>,
    ValidatedJson(body): ValidatedJson<ReorderCvEntriesRequest>,
) -> Result<StatusCode, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("cv", "update"),
    )
    .await?;

    let items: Vec<(Uuid, i16)> = body
        .into_inner()
        .items
        .into_iter()
        .map(|i| (i.id, i.display_order))
        .collect();
    CvEntryRepo::reorder(&state.db, &items).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_skills))
        .routes(routes!(get_skill_by_slug))
        .routes(routes!(create_skill))
        .routes(routes!(bulk_skills))
        .routes(routes!(get_skill, update_skill, delete_skill))
        .routes(routes!(list_cv_entries))
        .routes(routes!(create_cv_entry))
        .routes(routes!(bulk_cv_entries))
        .routes(routes!(reorder_cv_entries))
        .routes(routes!(review_cv_entry))
        .routes(routes!(get_cv_entry, update_cv_entry, delete_cv_entry))
        .routes(routes!(get_cv_entry_detail))
}
