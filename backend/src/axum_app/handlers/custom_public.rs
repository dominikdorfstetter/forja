//! Public Consumer API for custom-type entries (#795).
//!
//! Generic, type-key-parameterised read endpoints for published entries of
//! publicly-readable collections. PII is stripped; responses ride the shared
//! response cache. A Read API key with site access is required (mirrors the
//! built-in public content endpoints). Non-public / data-only types 404.

use axum::extract::{Path, Query, State};
use axum::response::Json;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::AppState;
use crate::axum_app::authorized_content::{AuthorizedSite, Read, SiteKind};
use crate::dto::custom_entry::{PublicEntry, PublicSchema};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::module_guard::CollectionsModule;
use crate::models::custom_public;
use crate::services::response_cache;
use crate::utils::pagination::{Paginated, PaginationParams};

/// Site-kind marker for the public collections API: gated by the Collections
/// module, authorised by `custom_entry:read` (a Read API key qualifies).
pub struct CollectionSite;
impl SiteKind for CollectionSite {
    type Module = CollectionsModule;
    const RESOURCE: &'static str = "custom_entry";
}

type PaginatedPublicEntries = Paginated<PublicEntry>;

#[derive(Debug, serde::Deserialize)]
struct PublicListQuery {
    locale: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/collections/{type_key}/published",
    tag = "Collections (Public)",
    operation_id = "list_public_collection_entries",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("type_key" = String, Path, description = "Collection key"),
        ("locale" = Option<String>, Query, description = "Locale code (default: site default)"),
        ("page" = Option<i64>, Query, description = "1-based page"),
        ("page_size" = Option<i64>, Query, description = "Page size")
    ),
    responses(
        (status = 200, description = "Published entries (PII-stripped)", body = PaginatedPublicEntries),
        (status = 404, description = "Collection not public", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_published(
    State(state): State<AppState>,
    Path((site_id, type_key)): Path<(Uuid, String)>,
    Query(q): Query<PublicListQuery>,
    _access: AuthorizedSite<CollectionSite, Read>,
) -> Result<Json<PaginatedPublicEntries>, ApiError> {
    let page = q.page.unwrap_or(1).max(1);
    let page_size = q.page_size.unwrap_or(20).clamp(1, 100);
    let locale = q.locale.clone().unwrap_or_else(|| "_".into());
    let suffix = format!("collections:{type_key}:published:l{locale}:p{page}:ps{page_size}");
    let result = response_cache::cached(
        &state.redis,
        &response_cache::key(site_id, &suffix),
        || async {
            let (items, total) = custom_public::published_list(
                &state.db,
                site_id,
                &type_key,
                q.locale.as_deref(),
                page,
                page_size,
            )
            .await?;
            Ok(PaginationParams::new(Some(page), Some(page_size)).paginate(items, total))
        },
    )
    .await?;
    Ok(Json(result))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/collections/{type_key}/by-slug/{slug}",
    tag = "Collections (Public)",
    operation_id = "get_public_collection_entry",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("type_key" = String, Path, description = "Collection key"),
        ("slug" = String, Path, description = "Entry slug"),
        ("locale" = Option<String>, Query, description = "Locale code")
    ),
    responses(
        (status = 200, description = "Published entry (PII-stripped)", body = PublicEntry),
        (status = 404, description = "Not found / not public", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_by_slug(
    State(state): State<AppState>,
    Path((site_id, type_key, slug)): Path<(Uuid, String, String)>,
    Query(q): Query<PublicListQuery>,
    _access: AuthorizedSite<CollectionSite, Read>,
) -> Result<Json<PublicEntry>, ApiError> {
    let locale = q.locale.clone().unwrap_or_else(|| "_".into());
    let suffix = format!("collections:{type_key}:by-slug:{slug}:l{locale}");
    let result = response_cache::cached(
        &state.redis,
        &response_cache::key(site_id, &suffix),
        || async {
            custom_public::published_by_slug(
                &state.db,
                site_id,
                &type_key,
                &slug,
                q.locale.as_deref(),
            )
            .await
        },
    )
    .await?;
    Ok(Json(result))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/collections/{type_key}/schema",
    tag = "Collections (Public)",
    operation_id = "get_public_collection_schema",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("type_key" = String, Path, description = "Collection key")
    ),
    responses(
        (status = 200, description = "Public field schema", body = PublicSchema),
        (status = 404, description = "Not public", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_schema(
    State(state): State<AppState>,
    Path((site_id, type_key)): Path<(Uuid, String)>,
    _access: AuthorizedSite<CollectionSite, Read>,
) -> Result<Json<PublicSchema>, ApiError> {
    Ok(Json(
        custom_public::schema(&state.db, site_id, &type_key).await?,
    ))
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_published))
        .routes(routes!(get_by_slug))
        .routes(routes!(get_schema))
}
