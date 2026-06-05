//! Schema-builder API for custom types (#791).
//!
//! Five admin endpoints under `/sites/{site_id}/custom-types`, all behind
//! `ModuleGuard<CollectionsModule>`. Schema *reads* require `custom_type:read`
//! (any site member — entry editors need the schema to render forms); schema
//! *writes* require `custom_type:write` (Admin+). Denials surface as
//! `ERR_CUSTOM_TYPE_FORBIDDEN` so the admin UI can branch on it.

use crate::dto::validated::ValidatedJson;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::Json;
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::dto::custom_type::{
    CreateCustomTypeRequest, CustomTypeResponse, CustomTypeSummary, UpdateCustomTypeRequest,
};
use crate::dto::ropa::RopaReport;
use crate::errors::{codes, ApiError, ProblemDetails};
use crate::guards::actor::Actor;
use crate::guards::auth_guard::ReadKey;
use crate::guards::module_guard::{CollectionsModule, ModuleGuard};
use crate::models::custom_type::CustomType;
use crate::services::permission_service::{Permission, PermissionService};
use crate::AppState;

/// Authorize a custom-type action, mapping denial to ERR_CUSTOM_TYPE_FORBIDDEN.
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
        &Permission::new("custom_type", action),
    )
    .await?;
    if allowed {
        Ok(())
    } else {
        Err(
            ApiError::forbidden("You do not have permission to manage custom types")
                .with_code(codes::ERR_CUSTOM_TYPE_FORBIDDEN),
        )
    }
}

#[derive(Debug, Deserialize)]
struct DeleteParams {
    /// Delete even when entries exist.
    force: Option<bool>,
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/custom-types",
    tag = "Custom Types",
    operation_id = "create_custom_type",
    description = "Define a new custom type (Collection) and its fields.",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body = CreateCustomTypeRequest,
    responses(
        (status = 201, description = "Type created", body = CustomTypeResponse),
        (status = 403, description = "Insufficient role", body = ProblemDetails),
        (status = 409, description = "Key already taken", body = ProblemDetails),
        (status = 422, description = "Schema validation failed", body = ProblemDetails)
    ),
    security(("clerk_jwt" = []), ("api_key" = []))
)]
async fn create_custom_type(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
    _module: ModuleGuard<CollectionsModule>,
    ValidatedJson(body): ValidatedJson<CreateCustomTypeRequest>,
) -> Result<(StatusCode, Json<CustomTypeResponse>), ApiError> {
    authorize(&state, &auth.0, site_id, "write").await?;
    let created = CustomType::create(&state.db, site_id, auth.0.id, body.into_inner()).await?;
    Ok((StatusCode::CREATED, Json(created)))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/custom-types",
    tag = "Custom Types",
    operation_id = "list_custom_types",
    description = "List the custom types defined for a site.",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Custom types", body = Vec<CustomTypeSummary>),
        (status = 403, description = "Insufficient role", body = ProblemDetails)
    ),
    security(("clerk_jwt" = []), ("api_key" = []))
)]
async fn list_custom_types(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
    _module: ModuleGuard<CollectionsModule>,
) -> Result<Json<Vec<CustomTypeSummary>>, ApiError> {
    authorize(&state, &auth.0, site_id, "read").await?;
    Ok(Json(CustomType::list(&state.db, site_id).await?))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/custom-types/{type_key}",
    tag = "Custom Types",
    operation_id = "get_custom_type",
    description = "Get one custom type with its full field schema.",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("type_key" = String, Path, description = "Custom type key")
    ),
    responses(
        (status = 200, description = "Custom type", body = CustomTypeResponse),
        (status = 403, description = "Insufficient role", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("clerk_jwt" = []), ("api_key" = []))
)]
async fn get_custom_type(
    State(state): State<AppState>,
    Path((site_id, type_key)): Path<(Uuid, String)>,
    auth: ReadKey,
    _module: ModuleGuard<CollectionsModule>,
) -> Result<Json<CustomTypeResponse>, ApiError> {
    authorize(&state, &auth.0, site_id, "read").await?;
    Ok(Json(CustomType::get(&state.db, site_id, &type_key).await?))
}

#[utoipa::path(
    put,
    path = "/sites/{site_id}/custom-types/{type_key}",
    tag = "Custom Types",
    operation_id = "update_custom_type",
    description = "Replace a custom type's header and field set.",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("type_key" = String, Path, description = "Custom type key")
    ),
    request_body = UpdateCustomTypeRequest,
    responses(
        (status = 200, description = "Type updated", body = CustomTypeResponse),
        (status = 403, description = "Insufficient role", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails),
        (status = 422, description = "Schema validation failed", body = ProblemDetails)
    ),
    security(("clerk_jwt" = []), ("api_key" = []))
)]
async fn update_custom_type(
    State(state): State<AppState>,
    Path((site_id, type_key)): Path<(Uuid, String)>,
    auth: ReadKey,
    _module: ModuleGuard<CollectionsModule>,
    ValidatedJson(body): ValidatedJson<UpdateCustomTypeRequest>,
) -> Result<Json<CustomTypeResponse>, ApiError> {
    authorize(&state, &auth.0, site_id, "write").await?;
    let updated =
        CustomType::update(&state.db, site_id, auth.0.id, &type_key, body.into_inner()).await?;
    Ok(Json(updated))
}

#[utoipa::path(
    delete,
    path = "/sites/{site_id}/custom-types/{type_key}",
    tag = "Custom Types",
    operation_id = "delete_custom_type",
    description = "Delete a custom type. Refuses (409) when entries exist unless force=true.",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("type_key" = String, Path, description = "Custom type key"),
        ("force" = Option<bool>, Query, description = "Delete even when entries exist")
    ),
    responses(
        (status = 204, description = "Type deleted"),
        (status = 403, description = "Insufficient role", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails),
        (status = 409, description = "Type still has entries", body = ProblemDetails)
    ),
    security(("clerk_jwt" = []), ("api_key" = []))
)]
async fn delete_custom_type(
    State(state): State<AppState>,
    Path((site_id, type_key)): Path<(Uuid, String)>,
    Query(params): Query<DeleteParams>,
    auth: ReadKey,
    _module: ModuleGuard<CollectionsModule>,
) -> Result<StatusCode, ApiError> {
    authorize(&state, &auth.0, site_id, "write").await?;
    CustomType::delete(&state.db, site_id, &type_key, params.force.unwrap_or(false)).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/ropa",
    tag = "Custom Types",
    operation_id = "get_site_ropa",
    description = "Generate the GDPR Art. 30 Records of Processing for the site's custom types.",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "RoPA report", body = RopaReport),
        (status = 403, description = "Insufficient role", body = ProblemDetails)
    ),
    security(("clerk_jwt" = []), ("api_key" = []))
)]
async fn get_site_ropa(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
    _module: ModuleGuard<CollectionsModule>,
) -> Result<Json<RopaReport>, ApiError> {
    // Admin-level: the RoPA aggregates the site's data-protection contract.
    authorize(&state, &auth.0, site_id, "write").await?;
    Ok(Json(
        crate::models::ropa::generate(&state.db, site_id).await?,
    ))
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(create_custom_type, list_custom_types))
        .routes(routes!(
            get_custom_type,
            update_custom_type,
            delete_custom_type
        ))
        .routes(routes!(get_site_ropa))
}
