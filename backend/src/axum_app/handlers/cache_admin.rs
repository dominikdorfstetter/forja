//! Cache management endpoints.
//!
//! Lets a **site admin** (Owner/Admin role) inspect, invalidate, and rebuild
//! the response cache for their own site, and a **system admin** do the same
//! across all sites. Rebuild = invalidate + proactively re-warm the
//! deterministic per-site resources (the cache is otherwise read-through, so
//! parameterized resources refill lazily on next request).

use axum::extract::{Path, State};
use axum::response::Json;
use serde::Serialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::AppState;
use crate::errors::codes;
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::actor::Actor;
use crate::models::site_membership::SiteRole;
use crate::services::response_cache::{self, GlobalCacheStats, SiteCacheStats};

use super::{site_locale::cached_site_locales, social::cached_social_links};

/// Result of an invalidate / rebuild operation.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct CacheMutationResponse {
    /// Number of cache entries removed.
    pub invalidated: u64,
    /// Resource keys re-warmed (rebuild only; empty for a plain invalidate).
    pub warmed: Vec<String>,
}

/// Authorize a site-scoped cache action: system admins always pass; otherwise
/// the caller must hold Owner/Admin role on the target site.
async fn require_site_cache_admin(
    state: &AppState,
    auth: &Actor,
    site_id: Uuid,
) -> Result<(), ApiError> {
    if auth.is_system_admin(&state.db).await.unwrap_or(false) {
        return Ok(());
    }
    let role = auth
        .effective_site_role(&state.db, site_id)
        .await?
        .unwrap_or(SiteRole::Viewer);
    if matches!(role, SiteRole::Owner | SiteRole::Admin) {
        Ok(())
    } else {
        Err(
            ApiError::forbidden("Site admin (Owner or Admin) required to manage the cache")
                .with_code(codes::FORBIDDEN),
        )
    }
}

async fn require_system_admin(state: &AppState, auth: &Actor) -> Result<(), ApiError> {
    if auth.is_system_admin(&state.db).await.unwrap_or(false) {
        Ok(())
    } else {
        Err(ApiError::forbidden("System admin required").with_code(codes::FORBIDDEN))
    }
}

/// Re-warm the deterministic per-site resources (those with no query/locale
/// variance). Returns the resource keys warmed.
async fn warm_site(state: &AppState, site_id: Uuid) -> Vec<String> {
    let mut warmed = Vec::new();
    if cached_social_links(state, site_id).await.is_ok() {
        warmed.push("social".to_string());
    }
    if cached_site_locales(state, site_id).await.is_ok() {
        warmed.push("locales".to_string());
    }
    warmed
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/cache",
    tag = "Cache",
    operation_id = "get_site_cache_stats",
    description = "Inspect the response-cache entries for a site (site admin).",
    params(("site_id" = Uuid, Path, description = "The UUID of the site")),
    responses(
        (status = 200, description = "Cached entries for the site", body = SiteCacheStats),
        (status = 403, description = "Site admin required", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn get_site_cache_stats(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: Actor,
) -> Result<Json<SiteCacheStats>, ApiError> {
    require_site_cache_admin(&state, &auth, site_id).await?;
    Ok(Json(
        response_cache::stats_for_site(&state.redis, site_id).await,
    ))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/cache/invalidate",
    tag = "Cache",
    operation_id = "invalidate_site_cache",
    description = "Clear all cached responses for a site (site admin).",
    params(("site_id" = Uuid, Path, description = "The UUID of the site")),
    responses(
        (status = 200, description = "Cache cleared", body = CacheMutationResponse),
        (status = 403, description = "Site admin required", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn invalidate_site_cache(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: Actor,
) -> Result<Json<CacheMutationResponse>, ApiError> {
    require_site_cache_admin(&state, &auth, site_id).await?;
    let invalidated = response_cache::invalidate_site_counted(&state.redis, site_id).await;
    Ok(Json(CacheMutationResponse {
        invalidated,
        warmed: Vec::new(),
    }))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/cache/rebuild",
    tag = "Cache",
    operation_id = "rebuild_site_cache",
    description = "Clear a site's cache and re-warm its deterministic resources (site admin).",
    params(("site_id" = Uuid, Path, description = "The UUID of the site")),
    responses(
        (status = 200, description = "Cache rebuilt", body = CacheMutationResponse),
        (status = 403, description = "Site admin required", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn rebuild_site_cache(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: Actor,
) -> Result<Json<CacheMutationResponse>, ApiError> {
    require_site_cache_admin(&state, &auth, site_id).await?;
    let invalidated = response_cache::invalidate_site_counted(&state.redis, site_id).await;
    let warmed = warm_site(&state, site_id).await;
    Ok(Json(CacheMutationResponse {
        invalidated,
        warmed,
    }))
}

#[utoipa::path(
    get,
    path = "/cache",
    tag = "Cache",
    operation_id = "get_global_cache_stats",
    description = "Inspect the response cache across all sites (system admin).",
    responses(
        (status = 200, description = "Global cache summary", body = GlobalCacheStats),
        (status = 403, description = "System admin required", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn get_global_cache_stats(
    State(state): State<AppState>,
    auth: Actor,
) -> Result<Json<GlobalCacheStats>, ApiError> {
    require_system_admin(&state, &auth).await?;
    Ok(Json(response_cache::stats_global(&state.redis).await))
}

#[utoipa::path(
    post,
    path = "/cache/invalidate",
    tag = "Cache",
    operation_id = "invalidate_all_cache",
    description = "Clear the entire response cache for all sites (system admin).",
    responses(
        (status = 200, description = "Cache cleared", body = CacheMutationResponse),
        (status = 403, description = "System admin required", body = ProblemDetails)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn invalidate_all_cache(
    State(state): State<AppState>,
    auth: Actor,
) -> Result<Json<CacheMutationResponse>, ApiError> {
    require_system_admin(&state, &auth).await?;
    let invalidated = response_cache::invalidate_all(&state.redis).await;
    Ok(Json(CacheMutationResponse {
        invalidated,
        warmed: Vec::new(),
    }))
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(get_site_cache_stats))
        .routes(routes!(invalidate_site_cache))
        .routes(routes!(rebuild_site_cache))
        .routes(routes!(get_global_cache_stats))
        .routes(routes!(invalidate_all_cache))
}
