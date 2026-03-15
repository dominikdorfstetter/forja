//! Federation blocklist admin endpoints (instances and actors)

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;
use validator::Validate;

use crate::dto::federation::requests::{
    BlockActorRequest, BlockInstanceRequest, ImportBlocklistRequest,
};
use crate::dto::federation::responses::{
    BlockedActorResponse, BlockedInstanceResponse, BlocklistImportResponse,
};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::{AdminKey, ReadKey};
use crate::guards::federation_guard::can_manage_federation;
use crate::guards::module_guard::{FederationModule, ModuleGuard};
use crate::models::federation::actor::ApActor;
use crate::models::federation::block::{ApBlockedActor, ApBlockedInstance};
use crate::models::site::Site;
use crate::models::site_membership::SiteRole;
use crate::utils::pagination::{Paginated, PaginationParams};
use crate::AppState;

/// Resolve the actor for a site, returning 404 if not found.
async fn require_actor(state: &AppState, site_id: Uuid) -> Result<ApActor, ApiError> {
    ApActor::find_by_site_id(&state.db, site_id)
        .await?
        .ok_or_else(|| ApiError::not_found("No ActivityPub actor for this site"))
}

// ── Instance Blocks ──────────────────────────────────────────────────────

/// List blocked instances for a site (paginated)
#[utoipa::path(
    tag = "Federation",
    operation_id = "list_blocked_instances",
    description = "List blocked instance domains for a site (paginated)",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default: 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page (default: 10, max: 100)")
    ),
    responses(
        (status = 200, description = "Paginated blocked instances", body = Paginated<BlockedInstanceResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/federation/blocks/instances?<page>&<page_size>")]
pub async fn list_blocked_instances(
    state: &State<AppState>,
    site_id: Uuid,
    page: Option<i64>,
    page_size: Option<i64>,
    auth: ReadKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Json<Paginated<BlockedInstanceResponse>>, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Admin)
        .await?;
    if !can_manage_federation(&role) {
        return Err(ApiError::forbidden("Insufficient role to view blocklist"));
    }

    Site::find_by_id(&state.db, site_id).await?;
    let actor = require_actor(state.inner(), site_id).await?;

    let params = PaginationParams::new(page, page_size);
    let (limit, offset) = params.limit_offset();

    let blocked: Vec<ApBlockedInstance> = sqlx::query_as::<_, ApBlockedInstance>(
        r#"
        SELECT * FROM ap_blocked_instances
        WHERE actor_id = $1
        ORDER BY blocked_at DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(actor.id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let total: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM ap_blocked_instances WHERE actor_id = $1")
            .bind(actor.id)
            .fetch_one(&state.db)
            .await?;
    let total = total.0;

    let items: Vec<BlockedInstanceResponse> = blocked
        .into_iter()
        .map(BlockedInstanceResponse::from)
        .collect();
    let paginated = params.paginate(items, total);

    Ok(Json(paginated))
}

/// Block an instance domain
#[utoipa::path(
    tag = "Federation",
    operation_id = "block_instance",
    description = "Block a remote instance domain",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = BlockInstanceRequest, description = "Instance to block"),
    responses(
        (status = 200, description = "Instance blocked", body = BlockedInstanceResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/sites/<site_id>/federation/blocks/instances", data = "<body>")]
pub async fn block_instance(
    state: &State<AppState>,
    site_id: Uuid,
    body: Json<BlockInstanceRequest>,
    auth: AdminKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Json<BlockedInstanceResponse>, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Admin)
        .await?;
    if !can_manage_federation(&role) {
        return Err(ApiError::forbidden("Insufficient role to manage blocklist"));
    }

    Site::find_by_id(&state.db, site_id).await?;
    let actor = require_actor(state.inner(), site_id).await?;

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::bad_request(format!("Validation error: {e}")))?;

    let blocked =
        ApBlockedInstance::create(&state.db, actor.id, &req.domain, req.reason.as_deref()).await?;

    tracing::info!(
        site_id = %site_id,
        domain = %req.domain,
        "Blocked instance"
    );

    Ok(Json(BlockedInstanceResponse::from(blocked)))
}

/// Update the reason for a blocked instance
#[utoipa::path(
    tag = "Federation",
    operation_id = "update_blocked_instance",
    description = "Update the reason for a blocked instance domain",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("domain" = String, Path, description = "Blocked domain to update")
    ),
    request_body(content = BlockInstanceRequest, description = "Updated block info"),
    responses(
        (status = 200, description = "Block updated", body = BlockedInstanceResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Blocked instance not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[put(
    "/sites/<site_id>/federation/blocks/instances/<domain>",
    data = "<body>"
)]
pub async fn update_blocked_instance(
    state: &State<AppState>,
    site_id: Uuid,
    domain: &str,
    body: Json<BlockInstanceRequest>,
    auth: AdminKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Json<BlockedInstanceResponse>, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Admin)
        .await?;
    if !can_manage_federation(&role) {
        return Err(ApiError::forbidden("Insufficient role to manage blocklist"));
    }

    Site::find_by_id(&state.db, site_id).await?;
    let actor = require_actor(state.inner(), site_id).await?;

    let req = body.into_inner();

    let updated =
        ApBlockedInstance::update_reason(&state.db, actor.id, domain, req.reason.as_deref())
            .await?
            .ok_or_else(|| ApiError::not_found("Blocked instance not found"))?;

    tracing::info!(site_id = %site_id, domain = domain, "Updated blocked instance reason");

    Ok(Json(BlockedInstanceResponse::from(updated)))
}

/// Unblock an instance domain
#[utoipa::path(
    tag = "Federation",
    operation_id = "unblock_instance",
    description = "Unblock a remote instance domain",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("domain" = String, Path, description = "Domain to unblock")
    ),
    responses(
        (status = 204, description = "Instance unblocked"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/sites/<site_id>/federation/blocks/instances/<domain>")]
pub async fn unblock_instance(
    state: &State<AppState>,
    site_id: Uuid,
    domain: &str,
    auth: AdminKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Status, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Admin)
        .await?;
    if !can_manage_federation(&role) {
        return Err(ApiError::forbidden("Insufficient role to manage blocklist"));
    }

    Site::find_by_id(&state.db, site_id).await?;
    let actor = require_actor(state.inner(), site_id).await?;

    ApBlockedInstance::delete(&state.db, actor.id, domain).await?;

    tracing::info!(site_id = %site_id, domain = domain, "Unblocked instance");

    Ok(Status::NoContent)
}

/// Clear all blocked instances for a site
#[utoipa::path(
    tag = "Federation",
    operation_id = "clear_blocklist",
    description = "Remove all blocked instance domains for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 204, description = "Blocklist cleared"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/sites/<site_id>/federation/blocks/instances")]
pub async fn clear_blocklist(
    state: &State<AppState>,
    site_id: Uuid,
    auth: AdminKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Status, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Owner)
        .await?;
    if !can_manage_federation(&role) {
        return Err(ApiError::forbidden(
            "Only site owners can clear the entire blocklist",
        ));
    }

    Site::find_by_id(&state.db, site_id).await?;
    let actor = require_actor(state.inner(), site_id).await?;

    ApBlockedInstance::delete_all(&state.db, actor.id).await?;

    tracing::info!(site_id = %site_id, "Cleared entire instance blocklist");

    Ok(Status::NoContent)
}

/// Bulk-import blocked instance domains from a shared blocklist (CSV/text)
#[utoipa::path(
    tag = "Federation",
    operation_id = "import_blocklist",
    description = "Bulk-import blocked instance domains from a shared blocklist",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = ImportBlocklistRequest, description = "Domains to block"),
    responses(
        (status = 200, description = "Import result", body = BlocklistImportResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/sites/<site_id>/federation/blocks/instances/import", data = "<body>")]
pub async fn import_blocklist(
    state: &State<AppState>,
    site_id: Uuid,
    body: Json<ImportBlocklistRequest>,
    auth: AdminKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Json<BlocklistImportResponse>, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Admin)
        .await?;
    if !can_manage_federation(&role) {
        return Err(ApiError::forbidden("Insufficient role to manage blocklist"));
    }

    Site::find_by_id(&state.db, site_id).await?;
    let actor = require_actor(state.inner(), site_id).await?;

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::bad_request(format!("Validation error: {e}")))?;

    // Security: cap at 10,000 domains per import to prevent DB abuse
    if req.domains.len() > 10_000 {
        return Err(ApiError::bad_request(
            "Maximum 10,000 domains per import. Split into multiple requests.",
        ));
    }

    // Filter and validate: non-empty, max 253 chars, valid domain format (alphanumeric + hyphens + dots)
    let domain_regex = regex::Regex::new(r"^[a-z0-9]([a-z0-9\-\.]*[a-z0-9])?$").unwrap();
    let valid_domains: Vec<String> = req
        .domains
        .into_iter()
        .map(|d| d.trim().to_lowercase())
        .filter(|d| !d.is_empty() && d.len() <= 253 && domain_regex.is_match(d))
        .collect();

    let total_requested = valid_domains.len();
    let imported =
        ApBlockedInstance::bulk_block_instances(&state.db, actor.id, &valid_domains).await?;
    let skipped = total_requested - imported;

    tracing::info!(
        site_id = %site_id,
        imported = imported,
        skipped = skipped,
        "Bulk-imported blocklist"
    );

    Ok(Json(BlocklistImportResponse { imported, skipped }))
}

// ── Actor Blocks ────────────────────────────────────────────────────────

/// List blocked actors for a site
#[utoipa::path(
    tag = "Federation",
    operation_id = "list_blocked_actors",
    description = "List blocked remote actors for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Blocked actors", body = Vec<BlockedActorResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/federation/blocks/actors")]
pub async fn list_blocked_actors(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Json<Vec<BlockedActorResponse>>, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Admin)
        .await?;
    if !can_manage_federation(&role) {
        return Err(ApiError::forbidden("Insufficient role to view blocklist"));
    }

    Site::find_by_id(&state.db, site_id).await?;
    let actor = require_actor(state.inner(), site_id).await?;

    let blocked = ApBlockedActor::find_by_actor(&state.db, actor.id).await?;
    let items: Vec<BlockedActorResponse> = blocked
        .into_iter()
        .map(BlockedActorResponse::from)
        .collect();

    Ok(Json(items))
}

/// Block a remote actor
#[utoipa::path(
    tag = "Federation",
    operation_id = "block_actor",
    description = "Block a remote actor",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = BlockActorRequest, description = "Actor to block"),
    responses(
        (status = 200, description = "Actor blocked", body = BlockedActorResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/sites/<site_id>/federation/blocks/actors", data = "<body>")]
pub async fn block_actor(
    state: &State<AppState>,
    site_id: Uuid,
    body: Json<BlockActorRequest>,
    auth: AdminKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Json<BlockedActorResponse>, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Admin)
        .await?;
    if !can_manage_federation(&role) {
        return Err(ApiError::forbidden("Insufficient role to manage blocklist"));
    }

    Site::find_by_id(&state.db, site_id).await?;
    let actor = require_actor(state.inner(), site_id).await?;

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::bad_request(format!("Validation error: {e}")))?;

    let blocked =
        ApBlockedActor::create(&state.db, actor.id, &req.actor_uri, req.reason.as_deref()).await?;

    tracing::info!(
        site_id = %site_id,
        actor_uri = %req.actor_uri,
        "Blocked actor"
    );

    Ok(Json(BlockedActorResponse::from(blocked)))
}

/// Unblock a remote actor
#[utoipa::path(
    tag = "Federation",
    operation_id = "unblock_actor",
    description = "Unblock a remote actor",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("actor_uri" = String, Path, description = "Encoded actor URI to unblock")
    ),
    responses(
        (status = 204, description = "Actor unblocked"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/sites/<site_id>/federation/blocks/actors/<actor_uri>")]
pub async fn unblock_actor(
    state: &State<AppState>,
    site_id: Uuid,
    actor_uri: &str,
    auth: AdminKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Status, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Admin)
        .await?;
    if !can_manage_federation(&role) {
        return Err(ApiError::forbidden("Insufficient role to manage blocklist"));
    }

    Site::find_by_id(&state.db, site_id).await?;
    let actor = require_actor(state.inner(), site_id).await?;

    // Rocket automatically percent-decodes path segments
    ApBlockedActor::delete(&state.db, actor.id, actor_uri).await?;

    tracing::info!(
        site_id = %site_id,
        actor_uri = actor_uri,
        "Unblocked actor"
    );

    Ok(Status::NoContent)
}

/// Collect admin block routes
pub fn routes() -> Vec<Route> {
    routes![
        list_blocked_instances,
        block_instance,
        update_blocked_instance,
        import_blocklist,
        unblock_instance,
        clear_blocklist,
        list_blocked_actors,
        block_actor,
        unblock_actor
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 9, "Should have 9 block admin routes");
    }
}
