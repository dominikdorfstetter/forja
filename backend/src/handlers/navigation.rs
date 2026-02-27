//! Navigation handlers

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;
use validator::Validate;

use crate::dto::navigation::{
    CreateNavigationItemRequest, NavigationItemLocalizationInput,
    NavigationItemLocalizationResponse, NavigationItemResponse, ReorderNavigationItemsRequest,
    ReorderNavigationTreeRequest, UpdateNavigationItemRequest,
};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::models::audit::AuditAction;
use crate::models::navigation::{NavigationItem, NavigationItemLocalization};
use crate::models::navigation_menu::NavigationMenu;
use crate::models::site_membership::SiteRole;
use crate::services::audit_service;
use crate::AppState;

/// List root navigation items for a site (backward compat - returns primary menu items)
#[utoipa::path(
    tag = "Navigation",
    operation_id = "list_navigation",
    description = "List root navigation items for a site (primary menu)",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Root navigation items", body = Vec<NavigationItemResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/navigation")]
pub async fn list_navigation(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
) -> Result<Json<Vec<NavigationItemResponse>>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let items = NavigationItem::find_root_for_site(&state.db, site_id).await?;
    let responses: Vec<NavigationItemResponse> = items
        .into_iter()
        .map(NavigationItemResponse::from)
        .collect();
    Ok(Json(responses))
}

/// List items for a menu (admin)
#[utoipa::path(
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
#[get("/menus/<menu_id>/items")]
pub async fn list_menu_items(
    state: &State<AppState>,
    menu_id: Uuid,
    auth: ReadKey,
) -> Result<Json<Vec<NavigationItemResponse>>, ApiError> {
    let menu = NavigationMenu::find_by_id(&state.db, menu_id).await?;
    auth.0
        .authorize_site_action(&state.db, menu.site_id, &SiteRole::Viewer)
        .await?;
    let items = NavigationItem::find_all_for_menu_admin(&state.db, menu_id).await?;

    // Enrich with titles from first available localization
    let mut responses = Vec::with_capacity(items.len());
    for item in items {
        let locs = NavigationItemLocalization::find_all_for_item(&state.db, item.id).await?;
        let title = locs.first().map(|l| l.title.clone());
        let mut resp = NavigationItemResponse::from(item);
        resp.title = title;
        responses.push(resp);
    }

    Ok(Json(responses))
}

/// Get navigation item by ID
#[utoipa::path(
    tag = "Navigation",
    operation_id = "get_navigation_item",
    description = "Get a navigation item by ID",
    params(("id" = Uuid, Path, description = "Navigation item UUID")),
    responses(
        (status = 200, description = "Navigation item details", body = NavigationItemResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Item not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/navigation/<id>")]
pub async fn get_navigation_item(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Json<NavigationItemResponse>, ApiError> {
    let item = NavigationItem::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, item.site_id, &SiteRole::Viewer)
        .await?;
    let locs = NavigationItemLocalization::find_all_for_item(&state.db, item.id).await?;
    let title = locs.first().map(|l| l.title.clone());
    let mut resp = NavigationItemResponse::from(item);
    resp.title = title;
    Ok(Json(resp))
}

/// Get children of a navigation item
#[utoipa::path(
    tag = "Navigation",
    operation_id = "get_navigation_children",
    description = "Get children of a navigation item",
    params(("parent_id" = Uuid, Path, description = "Parent navigation item UUID")),
    responses(
        (status = 200, description = "Child navigation items", body = Vec<NavigationItemResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/navigation/<parent_id>/children", rank = 1)]
pub async fn get_navigation_children(
    state: &State<AppState>,
    parent_id: Uuid,
    auth: ReadKey,
) -> Result<Json<Vec<NavigationItemResponse>>, ApiError> {
    let parent = NavigationItem::find_by_id(&state.db, parent_id).await?;
    auth.0
        .authorize_site_action(&state.db, parent.site_id, &SiteRole::Viewer)
        .await?;
    let items = NavigationItem::find_children(&state.db, parent_id).await?;
    let responses: Vec<NavigationItemResponse> = items
        .into_iter()
        .map(NavigationItemResponse::from)
        .collect();
    Ok(Json(responses))
}

/// Create a new navigation item (site-scoped, backward compat)
#[utoipa::path(
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
#[post("/sites/<site_id>/navigation", data = "<body>")]
pub async fn create_navigation_item(
    state: &State<AppState>,
    site_id: Uuid,
    body: Json<CreateNavigationItemRequest>,
    auth: ReadKey,
) -> Result<(Status, Json<NavigationItemResponse>), ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Author)
        .await?;
    let mut req = body.into_inner();
    req.site_id = site_id;

    // If no menu_id provided, use primary menu
    if req.menu_id == Uuid::nil() {
        let primary = NavigationMenu::find_by_slug(&state.db, site_id, "primary").await?;
        req.menu_id = primary.id;
    }

    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;
    req.validate_link().map_err(ApiError::BadRequest)?;

    let item = NavigationItem::create(&state.db, req.clone()).await?;

    // Create localizations if provided
    if let Some(locs) = &req.localizations {
        for loc in locs {
            NavigationItemLocalization::upsert(&state.db, item.id, loc.locale_id, &loc.title)
                .await?;
        }
    }

    audit_service::log_action(
        &state.db,
        Some(site_id),
        Some(auth.0.id),
        AuditAction::Create,
        "navigation_item",
        item.id,
        None,
    )
    .await;
    Ok((Status::Created, Json(NavigationItemResponse::from(item))))
}

/// Create a new navigation item in a menu
#[utoipa::path(
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
#[post("/menus/<menu_id>/items", data = "<body>")]
pub async fn create_menu_item(
    state: &State<AppState>,
    menu_id: Uuid,
    body: Json<CreateNavigationItemRequest>,
    auth: ReadKey,
) -> Result<(Status, Json<NavigationItemResponse>), ApiError> {
    let menu = NavigationMenu::find_by_id(&state.db, menu_id).await?;
    auth.0
        .authorize_site_action(&state.db, menu.site_id, &SiteRole::Author)
        .await?;
    let mut req = body.into_inner();
    req.site_id = menu.site_id;
    req.menu_id = menu_id;

    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;
    req.validate_link().map_err(ApiError::BadRequest)?;

    let item = NavigationItem::create(&state.db, req.clone()).await?;

    // Create localizations if provided
    if let Some(locs) = &req.localizations {
        for loc in locs {
            NavigationItemLocalization::upsert(&state.db, item.id, loc.locale_id, &loc.title)
                .await?;
        }
    }

    audit_service::log_action(
        &state.db,
        Some(menu.site_id),
        Some(auth.0.id),
        AuditAction::Create,
        "navigation_item",
        item.id,
        None,
    )
    .await;
    Ok((Status::Created, Json(NavigationItemResponse::from(item))))
}

/// Update a navigation item
#[utoipa::path(
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
#[put("/navigation/<id>", data = "<body>")]
pub async fn update_navigation_item(
    state: &State<AppState>,
    id: Uuid,
    body: Json<UpdateNavigationItemRequest>,
    auth: ReadKey,
) -> Result<Json<NavigationItemResponse>, ApiError> {
    let existing = NavigationItem::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, existing.site_id, &SiteRole::Author)
        .await?;
    let old = serde_json::to_value(&existing).ok();
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let item = NavigationItem::update(&state.db, id, req).await?;
    audit_service::log_action(
        &state.db,
        Some(existing.site_id),
        Some(auth.0.id),
        AuditAction::Update,
        "navigation_item",
        id,
        None,
    )
    .await;
    if let (Some(old), Ok(new)) = (old, serde_json::to_value(&item)) {
        audit_service::log_changes(
            &state.db,
            Some(existing.site_id),
            "navigation_item",
            id,
            Some(auth.0.id),
            &old,
            &new,
        )
        .await;
    }
    Ok(Json(NavigationItemResponse::from(item)))
}

/// Batch-reorder navigation items for a site (backward compat)
#[utoipa::path(
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
#[post("/sites/<site_id>/navigation/reorder", data = "<body>")]
pub async fn reorder_navigation_items(
    state: &State<AppState>,
    site_id: Uuid,
    body: Json<ReorderNavigationItemsRequest>,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Author)
        .await?;
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let items: Vec<(Uuid, i16)> = req
        .items
        .into_iter()
        .map(|i| (i.id, i.display_order))
        .collect();
    NavigationItem::reorder_for_site(&state.db, site_id, items).await?;
    Ok(Status::NoContent)
}

/// Batch-reorder navigation items for a menu (with parent_id support)
#[utoipa::path(
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
#[post("/menus/<menu_id>/items/reorder", data = "<body>")]
pub async fn reorder_menu_items(
    state: &State<AppState>,
    menu_id: Uuid,
    body: Json<ReorderNavigationTreeRequest>,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    let menu = NavigationMenu::find_by_id(&state.db, menu_id).await?;
    auth.0
        .authorize_site_action(&state.db, menu.site_id, &SiteRole::Author)
        .await?;
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let items: Vec<(Uuid, Option<Uuid>, i16)> = req
        .items
        .into_iter()
        .map(|i| (i.id, i.parent_id, i.display_order))
        .collect();
    NavigationItem::reorder_for_menu(&state.db, menu_id, items).await?;
    Ok(Status::NoContent)
}

/// Get localizations for a navigation item
#[utoipa::path(
    tag = "Navigation",
    operation_id = "get_navigation_item_localizations",
    description = "Get all localizations for a navigation item",
    params(("id" = Uuid, Path, description = "Navigation item UUID")),
    responses(
        (status = 200, description = "Item localizations", body = Vec<NavigationItemLocalizationResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/navigation/<id>/localizations", rank = 2)]
pub async fn get_navigation_item_localizations(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Json<Vec<NavigationItemLocalizationResponse>>, ApiError> {
    let item = NavigationItem::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, item.site_id, &SiteRole::Viewer)
        .await?;
    let locs = NavigationItemLocalization::find_all_for_item(&state.db, id).await?;
    let responses: Vec<NavigationItemLocalizationResponse> = locs
        .into_iter()
        .map(NavigationItemLocalizationResponse::from)
        .collect();
    Ok(Json(responses))
}

/// Upsert localizations for a navigation item
#[utoipa::path(
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
#[put("/navigation/<id>/localizations", data = "<body>")]
pub async fn upsert_navigation_item_localizations(
    state: &State<AppState>,
    id: Uuid,
    body: Json<Vec<NavigationItemLocalizationInput>>,
    auth: ReadKey,
) -> Result<Json<Vec<NavigationItemLocalizationResponse>>, ApiError> {
    let item = NavigationItem::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, item.site_id, &SiteRole::Author)
        .await?;
    let inputs = body.into_inner();
    let mut results = Vec::with_capacity(inputs.len());

    for input in inputs {
        input
            .validate()
            .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;
        let loc = NavigationItemLocalization::upsert(&state.db, id, input.locale_id, &input.title)
            .await?;
        results.push(NavigationItemLocalizationResponse::from(loc));
    }

    Ok(Json(results))
}

/// Delete a navigation item
#[utoipa::path(
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
#[delete("/navigation/<id>")]
pub async fn delete_navigation_item(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    let item = NavigationItem::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, item.site_id, &SiteRole::Editor)
        .await?;
    NavigationItem::delete(&state.db, id).await?;
    audit_service::log_action(
        &state.db,
        Some(item.site_id),
        Some(auth.0.id),
        AuditAction::Delete,
        "navigation_item",
        id,
        None,
    )
    .await;
    Ok(Status::NoContent)
}

/// Collect navigation routes
pub fn routes() -> Vec<Route> {
    routes![
        list_navigation,
        list_menu_items,
        get_navigation_children,
        get_navigation_item,
        create_navigation_item,
        create_menu_item,
        update_navigation_item,
        reorder_navigation_items,
        reorder_menu_items,
        get_navigation_item_localizations,
        upsert_navigation_item_localizations,
        delete_navigation_item
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 12, "Should have 12 navigation routes");
    }
}
