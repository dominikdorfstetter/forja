//! Entry CRUD API for custom types (#793).
//!
//! Locale-aware create / read / update / delete + publish / unpublish / list
//! for entries of a custom type, under
//! `/sites/{site_id}/custom-types/{type_key}/entries`. All behind
//! `ModuleGuard<CollectionsModule>`. Reads need `custom_entry:read` (any
//! member); writes need `custom_entry:write` (Author+ — a Write API key maps
//! to Editor and qualifies, enabling headless ingestion). PII handling,
//! validation, and uniqueness are enforced in the storage layer (#792).
//!
//! Per-type webhook event names / publish-pipeline integration are a
//! documented fast-follow (see the epic): entries publish through a
//! self-contained default-locale gate here rather than threading a dynamic
//! type key through the shared `&'static str` pipeline.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::Json;
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::AppState;
use crate::dto::custom_entry::{
    CustomEntryRequest, CustomEntryResponse, CustomEntrySummary, CustomTypeSchema,
};
use crate::dto::validated::ValidatedJson;
use crate::errors::{ApiError, ProblemDetails, codes};
use crate::guards::actor::Actor;
use crate::guards::auth_guard::ReadKey;
use crate::guards::module_guard::{CollectionsModule, ModuleGuard};
use crate::models::custom_entry::CustomEntry;
use crate::services::encryption::resolve_key;
use crate::services::permission_service::{Permission, PermissionService};
use crate::utils::pagination::Paginated;

type PaginatedEntries = Paginated<CustomEntrySummary>;

async fn authorize(
    state: &AppState,
    actor: &Actor,
    site_id: Uuid,
    action: &str,
) -> Result<(), ApiError> {
    let allowed = PermissionService::has_permission(
        &state.db,
        actor,
        site_id,
        &Permission::new("custom_entry", action),
    )
    .await?;
    if allowed {
        Ok(())
    } else {
        Err(
            ApiError::forbidden("You do not have permission to manage entries")
                .with_code(codes::AUTH_INSUFFICIENT_ROLE),
        )
    }
}

fn enc_key(state: &AppState) -> Result<[u8; 32], ApiError> {
    resolve_key(&state.settings.security.document_encryption_key)
}

#[derive(Debug, Deserialize)]
struct ListQuery {
    status: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/custom-types/{type_key}/entries",
    tag = "Custom Entries",
    operation_id = "create_custom_entry",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("type_key" = String, Path, description = "Custom type key")
    ),
    request_body = CustomEntryRequest,
    responses(
        (status = 201, description = "Entry created", body = CustomEntryResponse),
        (status = 403, description = "Insufficient role", body = ProblemDetails),
        (status = 422, description = "Validation failed", body = ProblemDetails)
    ),
    security(("clerk_jwt" = []), ("api_key" = []))
)]
async fn create_entry(
    State(state): State<AppState>,
    Path((site_id, type_key)): Path<(Uuid, String)>,
    auth: ReadKey,
    _module: ModuleGuard<CollectionsModule>,
    schema: CustomTypeSchema,
    ValidatedJson(body): ValidatedJson<CustomEntryRequest>,
) -> Result<(StatusCode, Json<CustomEntryResponse>), ApiError> {
    authorize(&state, &auth.0, site_id, "write").await?;
    let key = enc_key(&state)?;
    let created = CustomEntry::create_with_schema(
        &state.db,
        &key,
        site_id,
        &type_key,
        &schema.0,
        auth.0.id,
        body.into_inner(),
    )
    .await?;
    Ok((StatusCode::CREATED, Json(created)))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/custom-types/{type_key}/entries",
    tag = "Custom Entries",
    operation_id = "list_custom_entries",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("type_key" = String, Path, description = "Custom type key"),
        ("status" = Option<String>, Query, description = "Filter by status"),
        ("page" = Option<i64>, Query, description = "1-based page"),
        ("page_size" = Option<i64>, Query, description = "Page size")
    ),
    responses(
        (status = 200, description = "Entries", body = PaginatedEntries),
        (status = 403, description = "Insufficient role", body = ProblemDetails)
    ),
    security(("clerk_jwt" = []), ("api_key" = []))
)]
async fn list_entries(
    State(state): State<AppState>,
    Path((site_id, type_key)): Path<(Uuid, String)>,
    Query(q): Query<ListQuery>,
    auth: ReadKey,
    _module: ModuleGuard<CollectionsModule>,
) -> Result<Json<PaginatedEntries>, ApiError> {
    authorize(&state, &auth.0, site_id, "read").await?;
    let page = q.page.unwrap_or(1).max(1);
    let page_size = q.page_size.unwrap_or(20).clamp(1, 100);
    let (items, total) = CustomEntry::list(
        &state.db,
        site_id,
        &type_key,
        q.status.as_deref(),
        page,
        page_size,
    )
    .await?;
    Ok(Json(Paginated::new(
        items,
        page as u32,
        page_size as u32,
        total as u64,
    )))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/custom-types/{type_key}/entries/{entry_id}",
    tag = "Custom Entries",
    operation_id = "get_custom_entry",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("type_key" = String, Path, description = "Custom type key"),
        ("entry_id" = Uuid, Path, description = "Entry content id")
    ),
    responses(
        (status = 200, description = "Entry", body = CustomEntryResponse),
        (status = 403, description = "Insufficient role", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("clerk_jwt" = []), ("api_key" = []))
)]
async fn get_entry(
    State(state): State<AppState>,
    Path((site_id, type_key, entry_id)): Path<(Uuid, String, Uuid)>,
    auth: ReadKey,
    _module: ModuleGuard<CollectionsModule>,
) -> Result<Json<CustomEntryResponse>, ApiError> {
    let reveal = authorize(&state, &auth.0, site_id, "write").await.is_ok();
    authorize(&state, &auth.0, site_id, "read").await?;
    let key = enc_key(&state)?;
    Ok(Json(
        CustomEntry::read(&state.db, &key, site_id, &type_key, entry_id, reveal).await?,
    ))
}

#[utoipa::path(
    put,
    path = "/sites/{site_id}/custom-types/{type_key}/entries/{entry_id}",
    tag = "Custom Entries",
    operation_id = "update_custom_entry",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("type_key" = String, Path, description = "Custom type key"),
        ("entry_id" = Uuid, Path, description = "Entry content id")
    ),
    request_body = CustomEntryRequest,
    responses(
        (status = 200, description = "Entry updated", body = CustomEntryResponse),
        (status = 403, description = "Insufficient role", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails),
        (status = 422, description = "Validation failed", body = ProblemDetails)
    ),
    security(("clerk_jwt" = []), ("api_key" = []))
)]
async fn update_entry(
    State(state): State<AppState>,
    Path((site_id, type_key, entry_id)): Path<(Uuid, String, Uuid)>,
    auth: ReadKey,
    _module: ModuleGuard<CollectionsModule>,
    schema: CustomTypeSchema,
    ValidatedJson(body): ValidatedJson<CustomEntryRequest>,
) -> Result<Json<CustomEntryResponse>, ApiError> {
    authorize(&state, &auth.0, site_id, "write").await?;
    let key = enc_key(&state)?;
    Ok(Json(
        CustomEntry::update(
            &state.db,
            &key,
            site_id,
            &type_key,
            entry_id,
            &schema.0,
            auth.0.id,
            body.into_inner(),
        )
        .await?,
    ))
}

#[utoipa::path(
    delete,
    path = "/sites/{site_id}/custom-types/{type_key}/entries/{entry_id}",
    tag = "Custom Entries",
    operation_id = "delete_custom_entry",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("type_key" = String, Path, description = "Custom type key"),
        ("entry_id" = Uuid, Path, description = "Entry content id")
    ),
    responses(
        (status = 204, description = "Entry deleted"),
        (status = 403, description = "Insufficient role", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("clerk_jwt" = []), ("api_key" = []))
)]
async fn delete_entry(
    State(state): State<AppState>,
    Path((site_id, type_key, entry_id)): Path<(Uuid, String, Uuid)>,
    auth: ReadKey,
    _module: ModuleGuard<CollectionsModule>,
) -> Result<StatusCode, ApiError> {
    authorize(&state, &auth.0, site_id, "write").await?;
    CustomEntry::soft_delete(&state.db, site_id, &type_key, entry_id, auth.0.id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/custom-types/{type_key}/entries/{entry_id}/publish",
    tag = "Custom Entries",
    operation_id = "publish_custom_entry",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("type_key" = String, Path, description = "Custom type key"),
        ("entry_id" = Uuid, Path, description = "Entry content id")
    ),
    responses(
        (status = 200, description = "Entry published", body = CustomEntryResponse),
        (status = 403, description = "Insufficient role", body = ProblemDetails),
        (status = 422, description = "Required fields missing", body = ProblemDetails)
    ),
    security(("clerk_jwt" = []), ("api_key" = []))
)]
async fn publish_entry(
    State(state): State<AppState>,
    Path((site_id, type_key, entry_id)): Path<(Uuid, String, Uuid)>,
    auth: ReadKey,
    _module: ModuleGuard<CollectionsModule>,
) -> Result<Json<CustomEntryResponse>, ApiError> {
    authorize(&state, &auth.0, site_id, "write").await?;
    let key = enc_key(&state)?;
    Ok(Json(
        CustomEntry::publish(&state.db, &key, site_id, &type_key, entry_id, auth.0.id).await?,
    ))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/custom-types/{type_key}/entries/{entry_id}/unpublish",
    tag = "Custom Entries",
    operation_id = "unpublish_custom_entry",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("type_key" = String, Path, description = "Custom type key"),
        ("entry_id" = Uuid, Path, description = "Entry content id")
    ),
    responses(
        (status = 200, description = "Entry unpublished", body = CustomEntryResponse),
        (status = 403, description = "Insufficient role", body = ProblemDetails)
    ),
    security(("clerk_jwt" = []), ("api_key" = []))
)]
async fn unpublish_entry(
    State(state): State<AppState>,
    Path((site_id, type_key, entry_id)): Path<(Uuid, String, Uuid)>,
    auth: ReadKey,
    _module: ModuleGuard<CollectionsModule>,
) -> Result<Json<CustomEntryResponse>, ApiError> {
    authorize(&state, &auth.0, site_id, "write").await?;
    let key = enc_key(&state)?;
    Ok(Json(
        CustomEntry::unpublish(&state.db, &key, site_id, &type_key, entry_id, auth.0.id).await?,
    ))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/custom-types/{type_key}/entries/{entry_id}/erase-pii",
    tag = "Custom Entries",
    operation_id = "erase_custom_entry_pii",
    description = "GDPR erasure: strip all PII field values from an entry and audit the action.",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("type_key" = String, Path, description = "Custom type key"),
        ("entry_id" = Uuid, Path, description = "Entry content id")
    ),
    responses(
        (status = 204, description = "PII erased"),
        (status = 403, description = "Insufficient role", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("clerk_jwt" = []), ("api_key" = []))
)]
async fn erase_entry_pii(
    State(state): State<AppState>,
    Path((site_id, type_key, entry_id)): Path<(Uuid, String, Uuid)>,
    auth: ReadKey,
    _module: ModuleGuard<CollectionsModule>,
) -> Result<StatusCode, ApiError> {
    // Erasure is an Admin-level compliance action (custom_type:write).
    let is_admin = PermissionService::has_permission(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("custom_type", "write"),
    )
    .await?;
    if !is_admin {
        return Err(ApiError::forbidden("PII erasure requires an admin")
            .with_code(codes::AUTH_INSUFFICIENT_ROLE));
    }
    CustomEntry::erase_pii(&state.db, site_id, &type_key, entry_id, auth.0.id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(create_entry, list_entries))
        .routes(routes!(get_entry, update_entry, delete_entry))
        .routes(routes!(publish_entry))
        .routes(routes!(unpublish_entry))
        .routes(routes!(erase_entry_pii))
}
