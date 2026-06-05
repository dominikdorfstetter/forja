//! Axum port of `crate::handlers::navigation`. Twelve endpoints for
//! navigation item CRUD, including site-scoped (back-compat) and
//! menu-scoped variants, batch reorder for both, and per-item
//! localizations. First Phase 4 bundle to integrate `webhook_service`
//! fire-and-forget dispatch — same shape as `audit_service::log_action`.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::Json;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::dto::navigation::{
    CreateNavigationItemRequest, NavigationItemLocalizationInput,
    NavigationItemLocalizationResponse, NavigationItemResponse, ReorderNavigationItemsRequest,
    ReorderNavigationTreeRequest, UpdateNavigationItemRequest,
};
use crate::dto::validated::ValidatedJson;
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::{ReadKey, WriteKey};
use crate::models::audit::AuditAction;
use crate::models::navigation::{NavigationItem, NavigationItemLocalization};
use crate::models::navigation_menu::NavigationMenu;
use crate::services::audited_mutation::AuditedEntity;

/// Navigation items audit and fire `navigation.*` webhooks.
const NAVIGATION_ITEM: AuditedEntity =
    AuditedEntity::with_webhooks("navigation_item", "navigation");
use crate::services::permission_service::{Permission, PermissionService};
use crate::services::webhook_service;
use crate::AppState;

#[utoipa::path(
    get,
    path = "/sites/{site_id}/navigation",
    tag = "Navigation",
    operation_id = "list_navigation",
    description = "List root navigation items for a site (primary menu)",
    params(("site_id" = Uuid, Path, description = "The UUID of the site")),
    responses(
        (status = 200, description = "Root navigation items", body = Vec<NavigationItemResponse>),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_navigation(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<Vec<NavigationItemResponse>>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("navigation", "read"),
    )
    .await?;
    let items = NavigationItem::find_root_for_site(&state.db, site_id).await?;
    let responses: Vec<NavigationItemResponse> = items
        .into_iter()
        .map(NavigationItemResponse::from)
        .collect();
    Ok(Json(responses))
}

#[utoipa::path(
    get,
    path = "/menus/{menu_id}/items",
    tag = "Navigation",
    operation_id = "list_menu_items",
    description = "List all navigation items for a menu (including inactive)",
    params(("menu_id" = Uuid, Path, description = "Menu UUID")),
    responses(
        (status = 200, description = "Navigation items for menu", body = Vec<NavigationItemResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_menu_items(
    State(state): State<AppState>,
    Path(menu_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<Vec<NavigationItemResponse>>, ApiError> {
    let menu = NavigationMenu::find_by_id(&state.db, menu_id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        menu.site_id,
        &Permission::new("navigation", "read"),
    )
    .await?;
    let items = NavigationItem::find_all_for_menu_admin(&state.db, menu_id).await?;

    let mut responses = Vec::with_capacity(items.len());
    for item in items {
        let locs = NavigationItemLocalization::find_all_for_item(&state.db, item.id).await?;
        let title = locs.first().map(|l| l.title.clone());
        let locale_count = locs.len() as i32;
        let mut resp = NavigationItemResponse::from(item);
        resp.title = title;
        resp.locale_count = locale_count;
        responses.push(resp);
    }

    Ok(Json(responses))
}

#[utoipa::path(
    get,
    path = "/navigation/{id}",
    tag = "Navigation",
    operation_id = "get_navigation_item",
    description = "Get a navigation item by ID",
    params(("id" = Uuid, Path, description = "The UUID of the navigation item")),
    responses(
        (status = 200, description = "Navigation item details", body = NavigationItemResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 404, description = "Navigation item not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_navigation_item(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<NavigationItemResponse>, ApiError> {
    let item = NavigationItem::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        item.site_id,
        &Permission::new("navigation", "read"),
    )
    .await?;
    let locs = NavigationItemLocalization::find_all_for_item(&state.db, item.id).await?;
    let title = locs.first().map(|l| l.title.clone());
    let mut resp = NavigationItemResponse::from(item);
    resp.title = title;
    Ok(Json(resp))
}

#[utoipa::path(
    get,
    path = "/navigation/{parent_id}/children",
    tag = "Navigation",
    operation_id = "get_navigation_children",
    description = "Get children of a navigation item",
    params(("parent_id" = Uuid, Path, description = "The UUID of the parent navigation item")),
    responses(
        (status = 200, description = "Child navigation items", body = Vec<NavigationItemResponse>),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_navigation_children(
    State(state): State<AppState>,
    Path(parent_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<Vec<NavigationItemResponse>>, ApiError> {
    let parent = NavigationItem::find_by_id(&state.db, parent_id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        parent.site_id,
        &Permission::new("navigation", "read"),
    )
    .await?;
    let items = NavigationItem::find_children(&state.db, parent_id).await?;
    let responses: Vec<NavigationItemResponse> = items
        .into_iter()
        .map(NavigationItemResponse::from)
        .collect();
    Ok(Json(responses))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/navigation",
    tag = "Navigation",
    operation_id = "create_navigation_item",
    description = "Create a new navigation item",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = CreateNavigationItemRequest, description = "Navigation item data"),
    responses(
        (status = 201, description = "Item created", body = NavigationItemResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn create_navigation_item(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<CreateNavigationItemRequest>,
) -> Result<(StatusCode, Json<NavigationItemResponse>), ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("navigation", "create"),
    )
    .await?;
    let mut body = body.into_inner();
    body.site_id = site_id;

    if body.menu_id == Uuid::nil() {
        let primary = NavigationMenu::find_by_slug(&state.db, site_id, "primary").await?;
        body.menu_id = primary.id;
    }

    let item = NavigationItem::create(&state.db, body.clone()).await?;

    if let Some(locs) = &body.localizations {
        for loc in locs {
            NavigationItemLocalization::upsert(&state.db, item.id, loc.locale_id, &loc.title)
                .await?;
        }
    }

    NAVIGATION_ITEM
        .mutate(AuditAction::Create, item.id)
        .site(site_id)
        .actor(auth.0.id)
        .payload(serde_json::json!({"type": "navigation_item"}))
        .execute(&state.db)
        .await;
    Ok((
        StatusCode::CREATED,
        Json(NavigationItemResponse::from(item)),
    ))
}

#[utoipa::path(
    post,
    path = "/menus/{menu_id}/items",
    tag = "Navigation",
    operation_id = "create_menu_item",
    description = "Create a new navigation item in a menu",
    params(("menu_id" = Uuid, Path, description = "Menu UUID")),
    request_body(content = CreateNavigationItemRequest, description = "Navigation item data"),
    responses(
        (status = 201, description = "Item created", body = NavigationItemResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn create_menu_item(
    State(state): State<AppState>,
    Path(menu_id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<CreateNavigationItemRequest>,
) -> Result<(StatusCode, Json<NavigationItemResponse>), ApiError> {
    let menu = NavigationMenu::find_by_id(&state.db, menu_id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        menu.site_id,
        &Permission::new("navigation", "create"),
    )
    .await?;
    let mut body = body.into_inner();
    body.site_id = menu.site_id;
    body.menu_id = menu_id;

    let item = NavigationItem::create(&state.db, body.clone()).await?;

    if let Some(locs) = &body.localizations {
        for loc in locs {
            NavigationItemLocalization::upsert(&state.db, item.id, loc.locale_id, &loc.title)
                .await?;
        }
    }

    NAVIGATION_ITEM
        .mutate(AuditAction::Create, item.id)
        .site(menu.site_id)
        .actor(auth.0.id)
        .payload(serde_json::json!({"type": "menu_item"}))
        .execute(&state.db)
        .await;
    Ok((
        StatusCode::CREATED,
        Json(NavigationItemResponse::from(item)),
    ))
}

#[utoipa::path(
    put,
    path = "/navigation/{id}",
    tag = "Navigation",
    operation_id = "update_navigation_item",
    description = "Update a navigation item",
    params(("id" = Uuid, Path, description = "Navigation item UUID")),
    request_body(content = UpdateNavigationItemRequest, description = "Navigation update data"),
    responses(
        (status = 200, description = "Item updated", body = NavigationItemResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Item not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn update_navigation_item(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<UpdateNavigationItemRequest>,
) -> Result<Json<NavigationItemResponse>, ApiError> {
    let existing = NavigationItem::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        existing.site_id,
        &Permission::new("navigation", "update"),
    )
    .await?;
    let old = serde_json::to_value(&existing).ok();

    let item = NavigationItem::update(&state.db, id, body.into_inner()).await?;
    let change_diff = match (old, serde_json::to_value(&item)) {
        (Some(old), Ok(new)) => Some((old, new)),
        _ => None,
    };
    NAVIGATION_ITEM
        .mutate(AuditAction::Update, id)
        .site(existing.site_id)
        .actor(auth.0.id)
        .payload(serde_json::json!({"type": "navigation_item"}))
        .maybe_diff(change_diff)
        .execute(&state.db)
        .await;
    Ok(Json(NavigationItemResponse::from(item)))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/navigation/reorder",
    tag = "Navigation",
    operation_id = "reorder_navigation_items",
    description = "Batch-reorder navigation items for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = ReorderNavigationItemsRequest, description = "New ordering"),
    responses(
        (status = 204, description = "Navigation items reordered"),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Navigation item not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn reorder_navigation_items(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<ReorderNavigationItemsRequest>,
) -> Result<StatusCode, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("navigation", "update"),
    )
    .await?;
    let body = body.into_inner();

    let items: Vec<(Uuid, i16)> = body
        .items
        .into_iter()
        .map(|i| (i.id, i.display_order))
        .collect();
    NavigationItem::reorder_for_site(&state.db, site_id, items).await?;
    webhook_service::dispatch(
        &state.db,
        site_id,
        "navigation.updated",
        site_id,
        &serde_json::json!({"type": "reorder"}),
    )
    .await;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/menus/{menu_id}/items/reorder",
    tag = "Navigation",
    operation_id = "reorder_menu_items",
    description = "Batch-reorder navigation items for a menu with hierarchy support",
    params(("menu_id" = Uuid, Path, description = "Menu UUID")),
    request_body(content = ReorderNavigationTreeRequest, description = "New ordering with parent IDs"),
    responses(
        (status = 204, description = "Navigation items reordered"),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Navigation item not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn reorder_menu_items(
    State(state): State<AppState>,
    Path(menu_id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<ReorderNavigationTreeRequest>,
) -> Result<StatusCode, ApiError> {
    let menu = NavigationMenu::find_by_id(&state.db, menu_id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        menu.site_id,
        &Permission::new("navigation", "update"),
    )
    .await?;
    let body = body.into_inner();

    let items: Vec<(Uuid, Option<Uuid>, i16)> = body
        .items
        .into_iter()
        .map(|i| (i.id, i.parent_id, i.display_order))
        .collect();
    NavigationItem::reorder_for_menu(&state.db, menu_id, items).await?;
    webhook_service::dispatch(
        &state.db,
        menu.site_id,
        "navigation.updated",
        menu_id,
        &serde_json::json!({"type": "reorder"}),
    )
    .await;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/navigation/{id}/localizations",
    tag = "Navigation",
    operation_id = "get_navigation_item_localizations",
    description = "Get all localizations for a navigation item",
    params(("id" = Uuid, Path, description = "The UUID of the navigation item")),
    responses(
        (status = 200, description = "Item localizations", body = Vec<NavigationItemLocalizationResponse>),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_navigation_item_localizations(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<Vec<NavigationItemLocalizationResponse>>, ApiError> {
    let item = NavigationItem::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        item.site_id,
        &Permission::new("navigation", "read"),
    )
    .await?;
    let locs = NavigationItemLocalization::find_all_for_item(&state.db, id).await?;
    let responses: Vec<NavigationItemLocalizationResponse> = locs
        .into_iter()
        .map(NavigationItemLocalizationResponse::from)
        .collect();
    Ok(Json(responses))
}

#[utoipa::path(
    put,
    path = "/navigation/{id}/localizations",
    tag = "Navigation",
    operation_id = "upsert_navigation_item_localizations",
    description = "Upsert localizations for a navigation item (array of {locale_id, title})",
    params(("id" = Uuid, Path, description = "Navigation item UUID")),
    request_body(content = Vec<NavigationItemLocalizationInput>, description = "Localizations to upsert"),
    responses(
        (status = 200, description = "Localizations upserted", body = Vec<NavigationItemLocalizationResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn upsert_navigation_item_localizations(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(inputs): ValidatedJson<Vec<NavigationItemLocalizationInput>>,
) -> Result<Json<Vec<NavigationItemLocalizationResponse>>, ApiError> {
    let item = NavigationItem::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        item.site_id,
        &Permission::new("navigation", "update"),
    )
    .await?;
    let inputs = inputs.into_inner();
    let mut results = Vec::with_capacity(inputs.len());

    for input in inputs {
        let loc = NavigationItemLocalization::upsert(&state.db, id, input.locale_id, &input.title)
            .await?;
        results.push(NavigationItemLocalizationResponse::from(loc));
    }

    Ok(Json(results))
}

#[utoipa::path(
    delete,
    path = "/navigation/{id}",
    tag = "Navigation",
    operation_id = "delete_navigation_item",
    description = "Delete a navigation item",
    params(("id" = Uuid, Path, description = "Navigation item UUID")),
    responses(
        (status = 204, description = "Item deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Item not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn delete_navigation_item(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
) -> Result<StatusCode, ApiError> {
    let item = NavigationItem::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        item.site_id,
        &Permission::new("navigation", "delete"),
    )
    .await?;
    NavigationItem::soft_delete(&state.db, id).await?;
    // Soft-delete is audited as Update but fires the `deleted` webhook.
    NAVIGATION_ITEM
        .mutate(AuditAction::Update, id)
        .site(item.site_id)
        .actor(auth.0.id)
        .payload(serde_json::json!({"type": "navigation_item"}))
        .metadata(serde_json::json!({ "action": "soft_delete" }))
        .webhook("navigation.deleted")
        .execute(&state.db)
        .await;
    Ok(StatusCode::NO_CONTENT)
}

/// Routes are registered children-first so that `/navigation/{id}/children`
/// and `/navigation/{id}/localizations` (literal trailing segments) are
/// resolved by matchit ahead of `/navigation/{id}`.
pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_navigation, create_navigation_item))
        .routes(routes!(reorder_navigation_items))
        .routes(routes!(list_menu_items, create_menu_item))
        .routes(routes!(reorder_menu_items))
        .routes(routes!(get_navigation_children))
        .routes(routes!(
            get_navigation_item_localizations,
            upsert_navigation_item_localizations
        ))
        .routes(routes!(
            get_navigation_item,
            update_navigation_item,
            delete_navigation_item
        ))
}
