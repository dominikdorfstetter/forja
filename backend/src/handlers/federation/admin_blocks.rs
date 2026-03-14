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
use crate::guards::auth_guard::ReadKey;
use crate::guards::federation_guard::can_manage_federation;
use crate::guards::module_guard::{FederationModule, ModuleGuard};
use crate::models::federation::actor::ApActor;
use crate::models::federation::block::{ApBlockedActor, ApBlockedInstance};
use crate::models::site::Site;
use crate::models::site_membership::SiteRole;
use crate::AppState;

/// Resolve the actor for a site, returning 404 if not found.
async fn require_actor(state: &AppState, site_id: Uuid) -> Result<ApActor, ApiError> {
    ApActor::find_by_site_id(&state.db, site_id)
        .await?
        .ok_or_else(|| ApiError::not_found("No ActivityPub actor for this site"))
}

// ── Instance Blocks ──────────────────────────────────────────────────────

/// List blocked instances for a site
#[utoipa::path(
    tag = "Federation",
    operation_id = "list_blocked_instances",
    description = "List blocked instance domains for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Blocked instances", body = Vec<BlockedInstanceResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/federation/blocks/instances")]
pub async fn list_blocked_instances(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Json<Vec<BlockedInstanceResponse>>, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Admin)
        .await?;
    if !can_manage_federation(&role) {
        return Err(ApiError::forbidden("Insufficient role to view blocklist"));
    }

    Site::find_by_id(&state.db, site_id).await?;
    let actor = require_actor(state.inner(), site_id).await?;

    let blocked = ApBlockedInstance::find_by_actor(&state.db, actor.id).await?;
    let items: Vec<BlockedInstanceResponse> = blocked
        .into_iter()
        .map(BlockedInstanceResponse::from)
        .collect();

    Ok(Json(items))
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
    auth: ReadKey,
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
    auth: ReadKey,
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
    auth: ReadKey,
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

    // Filter: non-empty, reasonable length (max 253 chars for a domain)
    let valid_domains: Vec<String> = req
        .domains
        .into_iter()
        .map(|d| d.trim().to_lowercase())
        .filter(|d| !d.is_empty() && d.len() <= 253)
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
    auth: ReadKey,
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
    auth: ReadKey,
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
        import_blocklist,
        unblock_instance,
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
        assert_eq!(routes.len(), 7, "Should have 7 block admin routes");
    }
}
