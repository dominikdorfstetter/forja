//! Navigation model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

use crate::dto::navigation::{
    CreateNavigationItemRequest, NavigationTree, UpdateNavigationItemRequest,
};
use crate::errors::ApiError;

/// Navigation item model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct NavigationItem {
    pub id: Uuid,
    pub site_id: Uuid,
    pub menu_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub page_id: Option<Uuid>,
    pub external_url: Option<String>,
    pub icon: Option<String>,
    pub display_order: i16,
    pub is_active: bool,
    pub open_in_new_tab: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Navigation item with localized title (from JOIN)
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct NavigationItemFlat {
    pub id: Uuid,
    pub site_id: Uuid,
    pub menu_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub page_id: Option<Uuid>,
    pub external_url: Option<String>,
    pub icon: Option<String>,
    pub display_order: i16,
    pub is_active: bool,
    pub open_in_new_tab: bool,
    pub title: Option<String>,
    pub page_slug: Option<String>,
}

/// Navigation item with localization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavigationItemWithTitle {
    pub id: Uuid,
    pub site_id: Uuid,
    pub menu_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub page_id: Option<Uuid>,
    pub external_url: Option<String>,
    pub icon: Option<String>,
    pub display_order: i16,
    pub is_active: bool,
    pub open_in_new_tab: bool,
    pub title: String,
    pub children: Vec<NavigationItemWithTitle>,
}

/// Navigation item localization
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct NavigationItemLocalization {
    pub id: Uuid,
    pub navigation_item_id: Uuid,
    pub locale_id: Uuid,
    pub title: String,
}

impl NavigationItem {
    /// Find all root navigation items for a site's primary menu (active only, backward compat)
    pub async fn find_root_for_site(pool: &PgPool, site_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let items = sqlx::query_as::<_, Self>(
            r#"
            SELECT ni.id, ni.site_id, ni.menu_id, ni.parent_id, ni.page_id, ni.external_url, ni.icon,
                   ni.display_order, ni.is_active, ni.open_in_new_tab, ni.created_at, ni.updated_at
            FROM navigation_items ni
            JOIN navigation_menus nm ON nm.id = ni.menu_id
            WHERE ni.site_id = $1 AND nm.slug = 'primary' AND ni.parent_id IS NULL AND ni.is_active = TRUE
            ORDER BY ni.display_order ASC
            "#,
        )
        .bind(site_id)
        .fetch_all(pool)
        .await?;

        Ok(items)
    }

    /// Find all root items for a menu (active only, for public API)
    pub async fn find_root_for_menu(pool: &PgPool, menu_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let items = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, menu_id, parent_id, page_id, external_url, icon,
                   display_order, is_active, open_in_new_tab, created_at, updated_at
            FROM navigation_items
            WHERE menu_id = $1 AND parent_id IS NULL AND is_active = TRUE
            ORDER BY display_order ASC
            "#,
        )
        .bind(menu_id)
        .fetch_all(pool)
        .await?;

        Ok(items)
    }

    /// Find all navigation items for a menu (including inactive, for admin)
    pub async fn find_all_for_menu_admin(
        pool: &PgPool,
        menu_id: Uuid,
    ) -> Result<Vec<Self>, ApiError> {
        let items = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, menu_id, parent_id, page_id, external_url, icon,
                   display_order, is_active, open_in_new_tab, created_at, updated_at
            FROM navigation_items
            WHERE menu_id = $1
            ORDER BY display_order ASC
            "#,
        )
        .bind(menu_id)
        .fetch_all(pool)
        .await?;

        Ok(items)
    }

    /// Find all navigation items for a site (including inactive, for admin - backward compat)
    pub async fn find_all_for_site_admin(
        pool: &PgPool,
        site_id: Uuid,
    ) -> Result<Vec<Self>, ApiError> {
        let items = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, menu_id, parent_id, page_id, external_url, icon,
                   display_order, is_active, open_in_new_tab, created_at, updated_at
            FROM navigation_items
            WHERE site_id = $1
            ORDER BY display_order ASC
            "#,
        )
        .bind(site_id)
        .fetch_all(pool)
        .await?;

        Ok(items)
    }

    /// Build a navigation tree for a menu with localized titles and page slugs
    pub async fn find_tree_for_menu(
        pool: &PgPool,
        menu_id: Uuid,
        locale_id: Option<Uuid>,
    ) -> Result<Vec<NavigationTree>, ApiError> {
        let flat_items = if let Some(loc_id) = locale_id {
            sqlx::query_as::<_, NavigationItemFlat>(
                r#"
                SELECT ni.id, ni.site_id, ni.menu_id, ni.parent_id, ni.page_id, ni.external_url,
                       ni.icon, ni.display_order, ni.is_active, ni.open_in_new_tab,
                       nil.title, LTRIM(p.route, '/') AS page_slug
                FROM navigation_items ni
                LEFT JOIN navigation_item_localizations nil ON nil.navigation_item_id = ni.id AND nil.locale_id = $2
                LEFT JOIN pages p ON p.id = ni.page_id
                WHERE ni.menu_id = $1 AND ni.is_active = TRUE
                ORDER BY ni.display_order ASC
                "#,
            )
            .bind(menu_id)
            .bind(loc_id)
            .fetch_all(pool)
            .await?
        } else {
            // No locale specified - fetch first available localization
            sqlx::query_as::<_, NavigationItemFlat>(
                r#"
                SELECT ni.id, ni.site_id, ni.menu_id, ni.parent_id, ni.page_id, ni.external_url,
                       ni.icon, ni.display_order, ni.is_active, ni.open_in_new_tab,
                       (SELECT nil.title FROM navigation_item_localizations nil WHERE nil.navigation_item_id = ni.id LIMIT 1) AS title,
                       LTRIM(p.route, '/') AS page_slug
                FROM navigation_items ni
                LEFT JOIN pages p ON p.id = ni.page_id
                WHERE ni.menu_id = $1 AND ni.is_active = TRUE
                ORDER BY ni.display_order ASC
                "#,
            )
            .bind(menu_id)
            .fetch_all(pool)
            .await?
        };

        Ok(build_tree(flat_items))
    }

    /// Find children for a navigation item
    pub async fn find_children(pool: &PgPool, parent_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let items = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, menu_id, parent_id, page_id, external_url, icon,
                   display_order, is_active, open_in_new_tab, created_at, updated_at
            FROM navigation_items
            WHERE parent_id = $1 AND is_active = TRUE
            ORDER BY display_order ASC
            "#,
        )
        .bind(parent_id)
        .fetch_all(pool)
        .await?;

        Ok(items)
    }

    /// Find navigation item by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let item = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, menu_id, parent_id, page_id, external_url, icon,
                   display_order, is_active, open_in_new_tab, created_at, updated_at
            FROM navigation_items
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Navigation item with ID {} not found", id)))?;

        Ok(item)
    }

    /// Create a new navigation item
    pub async fn create(pool: &PgPool, req: CreateNavigationItemRequest) -> Result<Self, ApiError> {
        let item = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO navigation_items (site_id, menu_id, parent_id, page_id, external_url, icon, display_order, open_in_new_tab)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, site_id, menu_id, parent_id, page_id, external_url, icon,
                      display_order, is_active, open_in_new_tab, created_at, updated_at
            "#,
        )
        .bind(req.site_id)
        .bind(req.menu_id)
        .bind(req.parent_id)
        .bind(req.page_id)
        .bind(&req.external_url)
        .bind(&req.icon)
        .bind(req.display_order)
        .bind(req.open_in_new_tab)
        .fetch_one(pool)
        .await?;

        Ok(item)
    }

    /// Update a navigation item
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdateNavigationItemRequest,
    ) -> Result<Self, ApiError> {
        let item = sqlx::query_as::<_, Self>(
            r#"
            UPDATE navigation_items
            SET parent_id = COALESCE($2, parent_id),
                page_id = COALESCE($3, page_id),
                external_url = COALESCE($4, external_url),
                icon = COALESCE($5, icon),
                display_order = COALESCE($6, display_order),
                open_in_new_tab = COALESCE($7, open_in_new_tab),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, site_id, menu_id, parent_id, page_id, external_url, icon,
                      display_order, is_active, open_in_new_tab, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(req.parent_id)
        .bind(req.page_id)
        .bind(&req.external_url)
        .bind(&req.icon)
        .bind(req.display_order)
        .bind(req.open_in_new_tab)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Navigation item with ID {} not found", id)))?;

        Ok(item)
    }

    /// Batch-reorder navigation items for a menu (transactional, with parent_id support)
    pub async fn reorder_for_menu(
        pool: &PgPool,
        menu_id: Uuid,
        items: Vec<(Uuid, Option<Uuid>, i16)>,
    ) -> Result<(), ApiError> {
        let mut tx = pool.begin().await?;

        for (id, parent_id, display_order) in &items {
            let result = sqlx::query(
                "UPDATE navigation_items SET display_order = $1, parent_id = $2, updated_at = NOW() WHERE id = $3 AND menu_id = $4",
            )
            .bind(display_order)
            .bind(parent_id)
            .bind(id)
            .bind(menu_id)
            .execute(&mut *tx)
            .await?;

            if result.rows_affected() == 0 {
                return Err(ApiError::NotFound(format!(
                    "Navigation item with ID {} not found for menu {}",
                    id, menu_id
                )));
            }
        }

        tx.commit().await?;
        Ok(())
    }

    /// Batch-reorder navigation items for a site (backward compat, delegates to primary menu)
    pub async fn reorder_for_site(
        pool: &PgPool,
        site_id: Uuid,
        items: Vec<(Uuid, i16)>,
    ) -> Result<(), ApiError> {
        let mut tx = pool.begin().await?;

        for (id, display_order) in &items {
            let result = sqlx::query(
                "UPDATE navigation_items SET display_order = $1, updated_at = NOW() WHERE id = $2 AND site_id = $3",
            )
            .bind(display_order)
            .bind(id)
            .bind(site_id)
            .execute(&mut *tx)
            .await?;

            if result.rows_affected() == 0 {
                return Err(ApiError::NotFound(format!(
                    "Navigation item with ID {} not found for site {}",
                    id, site_id
                )));
            }
        }

        tx.commit().await?;
        Ok(())
    }

    /// Delete a navigation item (hard delete, cascades to localizations via FK)
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM navigation_items WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!(
                "Navigation item with ID {} not found",
                id
            )));
        }

        Ok(())
    }
}

impl NavigationItemLocalization {
    /// Find localization for navigation item
    pub async fn find_for_item_locale(
        pool: &PgPool,
        navigation_item_id: Uuid,
        locale_id: Uuid,
    ) -> Result<Option<Self>, ApiError> {
        let localization = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, navigation_item_id, locale_id, title
            FROM navigation_item_localizations
            WHERE navigation_item_id = $1 AND locale_id = $2
            "#,
        )
        .bind(navigation_item_id)
        .bind(locale_id)
        .fetch_optional(pool)
        .await?;

        Ok(localization)
    }

    /// Find all localizations for a navigation item
    pub async fn find_all_for_item(
        pool: &PgPool,
        navigation_item_id: Uuid,
    ) -> Result<Vec<Self>, ApiError> {
        let localizations = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, navigation_item_id, locale_id, title
            FROM navigation_item_localizations
            WHERE navigation_item_id = $1
            "#,
        )
        .bind(navigation_item_id)
        .fetch_all(pool)
        .await?;

        Ok(localizations)
    }

    /// Upsert a localization for a navigation item
    pub async fn upsert(
        pool: &PgPool,
        navigation_item_id: Uuid,
        locale_id: Uuid,
        title: &str,
    ) -> Result<Self, ApiError> {
        let loc = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO navigation_item_localizations (navigation_item_id, locale_id, title)
            VALUES ($1, $2, $3)
            ON CONFLICT (navigation_item_id, locale_id) DO UPDATE SET title = EXCLUDED.title
            RETURNING id, navigation_item_id, locale_id, title
            "#,
        )
        .bind(navigation_item_id)
        .bind(locale_id)
        .bind(title)
        .fetch_one(pool)
        .await?;

        Ok(loc)
    }
}

/// Build a tree from flat items
fn build_tree(flat_items: Vec<NavigationItemFlat>) -> Vec<NavigationTree> {
    let mut children_map: HashMap<Option<Uuid>, Vec<&NavigationItemFlat>> = HashMap::new();

    for item in &flat_items {
        children_map.entry(item.parent_id).or_default().push(item);
    }

    fn build_children(
        parent_id: Option<Uuid>,
        children_map: &HashMap<Option<Uuid>, Vec<&NavigationItemFlat>>,
    ) -> Vec<NavigationTree> {
        let Some(items) = children_map.get(&parent_id) else {
            return Vec::new();
        };

        items
            .iter()
            .map(|item| NavigationTree {
                id: item.id,
                parent_id: item.parent_id,
                page_id: item.page_id,
                external_url: item.external_url.clone(),
                icon: item.icon.clone(),
                display_order: item.display_order,
                open_in_new_tab: item.open_in_new_tab,
                title: item.title.clone(),
                page_slug: item.page_slug.clone(),
                children: build_children(Some(item.id), children_map),
            })
            .collect()
    }

    build_children(None, &children_map)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_navigation_item_serialization() {
        let item = NavigationItem {
            id: Uuid::new_v4(),
            site_id: Uuid::new_v4(),
            menu_id: Uuid::new_v4(),
            parent_id: None,
            page_id: Some(Uuid::new_v4()),
            external_url: None,
            icon: Some("home".to_string()),
            display_order: 1,
            is_active: true,
            open_in_new_tab: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&item).unwrap();
        assert!(json.contains("\"icon\":\"home\""));
    }

    #[test]
    fn test_build_tree() {
        let items = vec![
            NavigationItemFlat {
                id: Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap(),
                site_id: Uuid::new_v4(),
                menu_id: Uuid::new_v4(),
                parent_id: None,
                page_id: None,
                external_url: Some("/".to_string()),
                icon: None,
                display_order: 0,
                is_active: true,
                open_in_new_tab: false,
                title: Some("Home".to_string()),
                page_slug: None,
            },
            NavigationItemFlat {
                id: Uuid::parse_str("00000000-0000-0000-0000-000000000002").unwrap(),
                site_id: Uuid::new_v4(),
                menu_id: Uuid::new_v4(),
                parent_id: Some(Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap()),
                page_id: None,
                external_url: Some("/about".to_string()),
                icon: None,
                display_order: 0,
                is_active: true,
                open_in_new_tab: false,
                title: Some("About".to_string()),
                page_slug: None,
            },
        ];

        let tree = build_tree(items);
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].children.len(), 1);
        assert_eq!(tree[0].children[0].title, Some("About".to_string()));
    }
}
