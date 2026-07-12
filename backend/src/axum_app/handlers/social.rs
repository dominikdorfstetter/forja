//! Axum port of `crate::handlers::social`. Six endpoints for social
//! link CRUD plus batch reorder. Mounted under `/api/v1`. Adds the
//! audit-log fire-and-forget pattern (`audit_service::log_action(...)`)
//! that downstream domain bundles all use.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::Json;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::dto::social::{
    CreateSocialLinkRequest, ReorderSocialLinksRequest, SocialLinkResponse, UpdateSocialLinkRequest,
};
use crate::dto::validated::ValidatedJson;
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::{ReadKey, WriteKey};
use crate::models::audit::AuditAction;
use crate::models::social::SocialLink;
use crate::services::audited_mutation::AuditedEntity;

/// Social links audit their mutations without dispatching a webhook.
const SOCIAL_LINK: AuditedEntity = AuditedEntity::audit_only("social_link");
use crate::AppState;
use crate::services::permission_service::{Permission, PermissionService};

/// Site social links, cached (identical for every caller of the site).
/// Shared by the list handler and the cache-rebuild warmer.
pub(crate) async fn cached_social_links(
    state: &AppState,
    site_id: Uuid,
) -> Result<Vec<SocialLinkResponse>, ApiError> {
    crate::services::response_cache::cached(
        &state.redis,
        &crate::services::response_cache::key(site_id, "social"),
        || async {
            let links = SocialLink::find_all_for_site(&state.db, site_id).await?;
            Ok(links
                .into_iter()
                .map(SocialLinkResponse::from)
                .collect::<Vec<SocialLinkResponse>>())
        },
    )
    .await
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/social",
    tag = "Social Links",
    operation_id = "list_social_links",
    description = "List all social links for a site",
    params(("site_id" = Uuid, Path, description = "The UUID of the site")),
    responses(
        (status = 200, description = "List of social links", body = Vec<SocialLinkResponse>),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_social_links(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<Vec<SocialLinkResponse>>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("social", "read"),
    )
    .await?;
    Ok(Json(cached_social_links(&state, site_id).await?))
}

#[utoipa::path(
    get,
    path = "/social/{id}",
    tag = "Social Links",
    operation_id = "get_social_link",
    description = "Get a social link by ID",
    params(("id" = Uuid, Path, description = "The UUID of the social link")),
    responses(
        (status = 200, description = "Social link details", body = SocialLinkResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 404, description = "Social link not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_social_link(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<SocialLinkResponse>, ApiError> {
    let link = SocialLink::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        link.site_id,
        &Permission::new("social", "read"),
    )
    .await?;
    Ok(Json(SocialLinkResponse::from(link)))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/social",
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
async fn create_social_link(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<CreateSocialLinkRequest>,
) -> Result<(StatusCode, Json<SocialLinkResponse>), ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("social", "create"),
    )
    .await?;
    let mut body = body.into_inner();
    body.site_id = site_id;

    let link = SocialLink::create(&state.db, body).await?;
    SOCIAL_LINK
        .mutate(AuditAction::Create, link.id)
        .site(site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;
    Ok((StatusCode::CREATED, Json(SocialLinkResponse::from(link))))
}

#[utoipa::path(
    put,
    path = "/social/{id}",
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
async fn update_social_link(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<UpdateSocialLinkRequest>,
) -> Result<Json<SocialLinkResponse>, ApiError> {
    let existing = SocialLink::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        existing.site_id,
        &Permission::new("social", "update"),
    )
    .await?;

    let link = SocialLink::update(&state.db, id, body.into_inner()).await?;
    SOCIAL_LINK
        .mutate(AuditAction::Update, id)
        .site(existing.site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;
    Ok(Json(SocialLinkResponse::from(link)))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/social/reorder",
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
async fn reorder_social_links(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<ReorderSocialLinksRequest>,
) -> Result<StatusCode, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("social", "update"),
    )
    .await?;

    let body = body.into_inner();
    let items: Vec<(Uuid, i16)> = body
        .items
        .into_iter()
        .map(|i| (i.id, i.display_order))
        .collect();
    SocialLink::reorder_for_site(&state.db, site_id, items).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/social/{id}",
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
async fn delete_social_link(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
) -> Result<StatusCode, ApiError> {
    let link = SocialLink::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        link.site_id,
        &Permission::new("social", "delete"),
    )
    .await?;
    SocialLink::soft_delete(&state.db, id).await?;
    SOCIAL_LINK
        .mutate(AuditAction::Update, id)
        .site(link.site_id)
        .actor(auth.0.id)
        .metadata(serde_json::json!({ "action": "soft_delete" }))
        .execute(&state.db)
        .await;
    Ok(StatusCode::NO_CONTENT)
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_social_links, create_social_link))
        .routes(routes!(reorder_social_links))
        .routes(routes!(
            get_social_link,
            update_social_link,
            delete_social_link
        ))
}
