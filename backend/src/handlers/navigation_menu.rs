//! Navigation Menu handlers

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;
use validator::Validate;

use crate::dto::navigation::NavigationTree;
use crate::dto::navigation_menu::{
    CreateNavigationMenuRequest, MenuLocalizationResponse, NavigationMenuResponse,
    UpdateNavigationMenuRequest,
};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::models::audit::AuditAction;
use crate::models::navigation::NavigationItem;
use crate::models::navigation_menu::{NavigationMenu, NavigationMenuLocalization};
use crate::models::site_membership::SiteRole;
use crate::services::audit_service;
use crate::AppState;

/// List all menus for a site
#[utoipa::path(
    tag = "Navigation",
    operation_id = "list_navigation_menus",
    description = "List all navigation menus for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Navigation menus", body = Vec<NavigationMenuResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/menus")]
pub async fn list_navigation_menus(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
) -> Result<Json<Vec<NavigationMenuResponse>>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
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

/// Create a new navigation menu
#[utoipa::path(
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
#[post("/sites/<site_id>/menus", data = "<body>")]
pub async fn create_navigation_menu(
    state: &State<AppState>,
    site_id: Uuid,
    body: Json<CreateNavigationMenuRequest>,
    auth: ReadKey,
) -> Result<(Status, Json<NavigationMenuResponse>), ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Author)
        .await?;
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let menu = NavigationMenu::create(&state.db, site_id, req.clone()).await?;

    // Create localizations if provided
    if let Some(locs) = &req.localizations {
        for loc in locs {
            NavigationMenuLocalization::upsert(&state.db, menu.id, loc.locale_id, &loc.name)
                .await?;
        }
    }

    let mut resp = NavigationMenuResponse {
        id: menu.id,
        site_id: menu.site_id,
        slug: menu.slug,
        description: menu.description,
        max_depth: menu.max_depth,
        is_active: menu.is_active,
        item_count: 0,
        created_at: menu.created_at.to_rfc3339(),
        updated_at: menu.updated_at.to_rfc3339(),
        localizations: None,
    };

    let locs = NavigationMenuLocalization::find_for_menu(&state.db, menu.id).await?;
    resp.localizations = Some(
        locs.into_iter()
            .map(|l| MenuLocalizationResponse {
                id: l.id,
                locale_id: l.locale_id,
                name: l.name,
            })
            .collect(),
    );

    audit_service::log_action(
        &state.db,
        Some(site_id),
        Some(auth.0.id),
        AuditAction::Create,
        "navigation_menu",
        menu.id,
        None,
    )
    .await;
    Ok((Status::Created, Json(resp)))
}

/// Get a navigation menu by ID
#[utoipa::path(
    tag = "Navigation",
    operation_id = "get_navigation_menu",
    description = "Get a navigation menu by ID",
    params(("id" = Uuid, Path, description = "Menu UUID")),
    responses(
        (status = 200, description = "Navigation menu details", body = NavigationMenuResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Menu not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/menus/<id>")]
pub async fn get_navigation_menu(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Json<NavigationMenuResponse>, ApiError> {
    let menu = NavigationMenu::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, menu.site_id, &SiteRole::Viewer)
        .await?;
    let locs = NavigationMenuLocalization::find_for_menu(&state.db, menu.id).await?;

    let resp = NavigationMenuResponse {
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
    };

    Ok(Json(resp))
}

/// Get a navigation menu by slug
#[utoipa::path(
    tag = "Navigation",
    operation_id = "get_navigation_menu_by_slug",
    description = "Get a navigation menu by slug for a site",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("slug" = String, Path, description = "Menu slug")
    ),
    responses(
        (status = 200, description = "Navigation menu details", body = NavigationMenuResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Menu not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/menus/slug/<slug>")]
pub async fn get_navigation_menu_by_slug(
    state: &State<AppState>,
    site_id: Uuid,
    slug: &str,
    auth: ReadKey,
) -> Result<Json<NavigationMenuResponse>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;
    let menu = NavigationMenu::find_by_slug(&state.db, site_id, slug).await?;
    let locs = NavigationMenuLocalization::find_for_menu(&state.db, menu.id).await?;

    let resp = NavigationMenuResponse {
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
    };

    Ok(Json(resp))
}

/// Update a navigation menu
#[utoipa::path(
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
#[put("/menus/<id>", data = "<body>")]
pub async fn update_navigation_menu(
    state: &State<AppState>,
    id: Uuid,
    body: Json<UpdateNavigationMenuRequest>,
    auth: ReadKey,
) -> Result<Json<NavigationMenuResponse>, ApiError> {
    let existing_menu = NavigationMenu::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, existing_menu.site_id, &SiteRole::Author)
        .await?;
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let menu = NavigationMenu::update(&state.db, id, req.clone()).await?;

    // Update localizations if provided
    if let Some(locs) = &req.localizations {
        for loc in locs {
            NavigationMenuLocalization::upsert(&state.db, menu.id, loc.locale_id, &loc.name)
                .await?;
        }
    }

    let locs = NavigationMenuLocalization::find_for_menu(&state.db, menu.id).await?;

    let resp = NavigationMenuResponse {
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
    };

    audit_service::log_action(
        &state.db,
        Some(existing_menu.site_id),
        Some(auth.0.id),
        AuditAction::Update,
        "navigation_menu",
        id,
        None,
    )
    .await;
    Ok(Json(resp))
}

/// Delete a navigation menu
#[utoipa::path(
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
#[delete("/menus/<id>")]
pub async fn delete_navigation_menu(
    state: &State<AppState>,
    id: Uuid,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    let menu = NavigationMenu::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, menu.site_id, &SiteRole::Editor)
        .await?;
    NavigationMenu::delete(&state.db, id).await?;
    audit_service::log_action(
        &state.db,
        Some(menu.site_id),
        Some(auth.0.id),
        AuditAction::Delete,
        "navigation_menu",
        id,
        None,
    )
    .await;
    Ok(Status::NoContent)
}

/// Get navigation tree for a menu
#[utoipa::path(
    tag = "Navigation",
    operation_id = "get_navigation_tree",
    description = "Get the full navigation tree for a menu with localized titles",
    params(
        ("menu_id" = Uuid, Path, description = "Menu UUID"),
        ("locale" = Option<String>, Query, description = "Locale code for titles (e.g. 'en')")
    ),
    responses(
        (status = 200, description = "Navigation tree", body = Vec<NavigationTree>),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 404, description = "Menu not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/menus/<menu_id>/tree?<locale>")]
pub async fn get_navigation_tree(
    state: &State<AppState>,
    menu_id: Uuid,
    locale: Option<String>,
    auth: ReadKey,
) -> Result<Json<Vec<NavigationTree>>, ApiError> {
    let menu = NavigationMenu::find_by_id(&state.db, menu_id).await?;
    auth.0
        .authorize_site_action(&state.db, menu.site_id, &SiteRole::Viewer)
        .await?;
    // Resolve locale code to locale_id
    let locale_id = if let Some(code) = locale {
        let locale = sqlx::query_as::<_, crate::models::locale::Locale>(
            "SELECT * FROM locales WHERE code = $1",
        )
        .bind(&code)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| ApiError::BadRequest(format!("Locale '{}' not found", code)))?;
        Some(locale.id)
    } else {
        None
    };

    let tree = NavigationItem::find_tree_for_menu(&state.db, menu_id, locale_id).await?;
    Ok(Json(tree))
}

/// Collect navigation menu routes
pub fn routes() -> Vec<Route> {
    routes![
        list_navigation_menus,
        create_navigation_menu,
        get_navigation_menu,
        get_navigation_menu_by_slug,
        update_navigation_menu,
        delete_navigation_menu,
        get_navigation_tree
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 7, "Should have 7 navigation menu routes");
    }
}
