//! Axum port of `crate::handlers::navigation_menu`. Seven endpoints for
//! per-site navigation menu CRUD plus a tree-rendering endpoint.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::Json;
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::dto::navigation::NavigationTree;
use crate::dto::navigation_menu::{
    CreateNavigationMenuRequest, MenuLocalizationResponse, NavigationMenuResponse,
    UpdateNavigationMenuRequest,
};
use crate::dto::validated::ValidatedJson;
use crate::errors::codes;
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::{ReadKey, WriteKey};
use crate::models::audit::AuditAction;
use crate::models::navigation::NavigationItem;
use crate::models::navigation_menu::{NavigationMenu, NavigationMenuLocalization};
use crate::services::audited_mutation::AuditedEntity;
use crate::services::permission_service::{Permission, PermissionService};
use crate::AppState;

#[derive(Debug, Deserialize)]
struct TreeQuery {
    locale: Option<String>,
}

/// Hydrate a `NavigationMenu` row with its localizations into the
/// response shape. Used by every read endpoint to keep the projection
/// consistent.
async fn build_menu_response(
    state: &AppState,
    menu: NavigationMenu,
) -> Result<NavigationMenuResponse, ApiError> {
    let locs = NavigationMenuLocalization::find_for_menu(&state.db, menu.id).await?;
    Ok(NavigationMenuResponse {
        id: menu.id,
        site_id: menu.site_id,
        slug: menu.slug,
        description: menu.description,
        max_depth: menu.max_depth,
        is_active: menu.is_active,
        item_count: 0,
        created_at: menu.created_at.to_rfc3339(),
        updated_at: menu.updated_at.to_rfc3339(),
        localizations: Some(
            locs.into_iter()
                .map(|l| MenuLocalizationResponse {
                    id: l.id,
                    locale_id: l.locale_id,
                    name: l.name,
                })
                .collect(),
        ),
    })
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/menus",
    tag = "Navigation",
    operation_id = "list_navigation_menus",
    description = "List all navigation menus for a site",
    params(("site_id" = Uuid, Path, description = "The UUID of the site")),
    responses(
        (status = 200, description = "Navigation menus", body = Vec<NavigationMenuResponse>),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_navigation_menus(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<Vec<NavigationMenuResponse>>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("navigation", "read"),
    )
    .await?;
    let menus = NavigationMenu::find_all_for_site(&state.db, site_id).await?;
    let mut responses: Vec<NavigationMenuResponse> = Vec::with_capacity(menus.len());

    for menu in menus {
        let locs = NavigationMenuLocalization::find_for_menu(&state.db, menu.id).await?;
        let mut resp = NavigationMenuResponse::from(menu);
        resp.localizations = Some(
            locs.into_iter()
                .map(|l| MenuLocalizationResponse {
                    id: l.id,
                    locale_id: l.locale_id,
                    name: l.name,
                })
                .collect(),
        );
        responses.push(resp);
    }

    Ok(Json(responses))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/menus",
    tag = "Navigation",
    operation_id = "create_navigation_menu",
    description = "Create a new navigation menu for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = CreateNavigationMenuRequest, description = "Menu data"),
    responses(
        (status = 201, description = "Menu created", body = NavigationMenuResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn create_navigation_menu(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<CreateNavigationMenuRequest>,
) -> Result<(StatusCode, Json<NavigationMenuResponse>), ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("navigation", "create"),
    )
    .await?;

    let menu = NavigationMenu::create(&state.db, site_id, body.clone()).await?;

    if let Some(locs) = &body.localizations {
        for loc in locs {
            NavigationMenuLocalization::upsert(&state.db, menu.id, loc.locale_id, &loc.name)
                .await?;
        }
    }

    let resp = build_menu_response(&state, menu).await?;

    AuditedEntity::audit_only("navigation_menu")
        .mutate(AuditAction::Create, resp.id)
        .site(site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;
    Ok((StatusCode::CREATED, Json(resp)))
}

#[utoipa::path(
    get,
    path = "/menus/{id}",
    tag = "Navigation",
    operation_id = "get_navigation_menu",
    description = "Get a navigation menu by ID",
    params(("id" = Uuid, Path, description = "The UUID of the navigation menu")),
    responses(
        (status = 200, description = "Navigation menu details", body = NavigationMenuResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 404, description = "Navigation menu not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_navigation_menu(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<NavigationMenuResponse>, ApiError> {
    let menu = NavigationMenu::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        menu.site_id,
        &Permission::new("navigation", "read"),
    )
    .await?;
    Ok(Json(build_menu_response(&state, menu).await?))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/menus/slug/{slug}",
    tag = "Navigation",
    operation_id = "get_navigation_menu_by_slug",
    description = "Get a navigation menu by slug for a site",
    params(
        ("site_id" = Uuid, Path, description = "The UUID of the site"),
        ("slug" = String, Path, description = "URL-friendly identifier (lowercase, hyphens only)")
    ),
    responses(
        (status = 200, description = "Navigation menu details", body = NavigationMenuResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 404, description = "Navigation menu not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_navigation_menu_by_slug(
    State(state): State<AppState>,
    Path((site_id, slug)): Path<(Uuid, String)>,
    auth: ReadKey,
) -> Result<Json<NavigationMenuResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("navigation", "read"),
    )
    .await?;
    // Identical for every caller of the site → cacheable after the key check.
    let response = crate::services::response_cache::cached(
        &state.redis,
        &crate::services::response_cache::key(site_id, &format!("menus:slug:{slug}")),
        || async {
            let menu = NavigationMenu::find_by_slug(&state.db, site_id, &slug).await?;
            build_menu_response(&state, menu).await
        },
    )
    .await?;
    Ok(Json(response))
}

#[utoipa::path(
    put,
    path = "/menus/{id}",
    tag = "Navigation",
    operation_id = "update_navigation_menu",
    description = "Update a navigation menu",
    params(("id" = Uuid, Path, description = "Menu UUID")),
    request_body(content = UpdateNavigationMenuRequest, description = "Menu update data"),
    responses(
        (status = 200, description = "Menu updated", body = NavigationMenuResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Menu not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn update_navigation_menu(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<UpdateNavigationMenuRequest>,
) -> Result<Json<NavigationMenuResponse>, ApiError> {
    let existing_menu = NavigationMenu::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        existing_menu.site_id,
        &Permission::new("navigation", "update"),
    )
    .await?;

    let menu = NavigationMenu::update(&state.db, id, body.clone()).await?;

    if let Some(locs) = &body.localizations {
        for loc in locs {
            NavigationMenuLocalization::upsert(&state.db, menu.id, loc.locale_id, &loc.name)
                .await?;
        }
    }

    let resp = build_menu_response(&state, menu).await?;

    AuditedEntity::audit_only("navigation_menu")
        .mutate(AuditAction::Update, id)
        .site(existing_menu.site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;
    Ok(Json(resp))
}

#[utoipa::path(
    delete,
    path = "/menus/{id}",
    tag = "Navigation",
    operation_id = "delete_navigation_menu",
    description = "Delete a navigation menu (cascades to items)",
    params(("id" = Uuid, Path, description = "Menu UUID")),
    responses(
        (status = 204, description = "Menu deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Menu not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn delete_navigation_menu(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
) -> Result<StatusCode, ApiError> {
    let menu = NavigationMenu::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        menu.site_id,
        &Permission::new("navigation", "delete"),
    )
    .await?;
    NavigationMenu::soft_delete(&state.db, id).await?;
    AuditedEntity::audit_only("navigation_menu")
        .mutate(AuditAction::Update, id)
        .site(menu.site_id)
        .actor(auth.0.id)
        .metadata(serde_json::json!({ "action": "soft_delete" }))
        .execute(&state.db)
        .await;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/menus/{menu_id}/tree",
    tag = "Navigation",
    operation_id = "get_navigation_tree",
    description = "Get the full navigation tree for a menu with localized titles",
    params(
        ("menu_id" = Uuid, Path, description = "The UUID of the navigation menu"),
        ("locale" = Option<String>, Query, description = "Locale code for localized titles (e.g. en, de, fr)")
    ),
    responses(
        (status = 200, description = "Navigation tree", body = Vec<NavigationTree>),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 404, description = "Navigation menu not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_navigation_tree(
    State(state): State<AppState>,
    Path(menu_id): Path<Uuid>,
    Query(q): Query<TreeQuery>,
    auth: ReadKey,
) -> Result<Json<Vec<NavigationTree>>, ApiError> {
    let menu = NavigationMenu::find_by_id(&state.db, menu_id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        menu.site_id,
        &Permission::new("navigation", "read"),
    )
    .await?;
    let locale_id = if let Some(code) = q.locale {
        let locale = crate::models::locale::Locale::find_by_code_opt(&state.db, &code)
            .await?
            .ok_or_else(|| {
                ApiError::bad_request(format!("Locale '{}' not found", code))
                    .with_code(codes::BAD_REQUEST)
            })?;
        Some(locale.id)
    } else {
        None
    };

    let tree = NavigationItem::find_tree_for_menu(&state.db, menu_id, locale_id).await?;
    Ok(Json(tree))
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_navigation_menus, create_navigation_menu))
        .routes(routes!(get_navigation_menu_by_slug))
        .routes(routes!(get_navigation_tree))
        .routes(routes!(
            get_navigation_menu,
            update_navigation_menu,
            delete_navigation_menu
        ))
}
