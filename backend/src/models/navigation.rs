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
use crate::errors::codes;

/// Navigation item model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct NavigationItem {
    pub id: Uuid,
    pub site_id: Uuid,
    pub menu_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub page_id: Option<Uuid>,
    pub external_url: Option<String>,
    pub legal_document_id: Option<Uuid>,
    pub icon: Option<String>,
    pub display_order: i16,
    pub is_active: bool,
    pub open_in_new_tab: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_deleted: bool,
    pub deleted_at: Option<DateTime<Utc>>,
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
    pub legal_document_id: Option<Uuid>,
    pub icon: Option<String>,
    pub display_order: i16,
    pub is_active: bool,
    pub open_in_new_tab: bool,
    pub title: Option<String>,
    pub page_slug: Option<String>,
    pub legal_slug: Option<String>,
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
            SELECT ni.id, ni.site_id, ni.menu_id, ni.parent_id, ni.page_id, ni.external_url,
                   ni.legal_document_id, ni.icon,
                   ni.display_order, ni.is_active, ni.open_in_new_tab, ni.created_at, ni.updated_at,
                   ni.is_deleted, ni.deleted_at
            FROM navigation_items ni
            JOIN navigation_menus nm ON nm.id = ni.menu_id
            WHERE ni.site_id = $1 AND nm.slug = 'primary' AND ni.parent_id IS NULL AND ni.is_active = TRUE AND ni.is_deleted = FALSE
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
            SELECT id, site_id, menu_id, parent_id, page_id, external_url, legal_document_id, icon,
                   display_order, is_active, open_in_new_tab, created_at, updated_at,
                   is_deleted, deleted_at
            FROM navigation_items
            WHERE menu_id = $1 AND parent_id IS NULL AND is_active = TRUE AND is_deleted = FALSE
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
            SELECT id, site_id, menu_id, parent_id, page_id, external_url, legal_document_id, icon,
                   display_order, is_active, open_in_new_tab, created_at, updated_at,
                   is_deleted, deleted_at
            FROM navigation_items
            WHERE menu_id = $1 AND is_deleted = FALSE
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
            SELECT id, site_id, menu_id, parent_id, page_id, external_url, legal_document_id, icon,
                   display_order, is_active, open_in_new_tab, created_at, updated_at,
                   is_deleted, deleted_at
            FROM navigation_items
            WHERE site_id = $1 AND is_deleted = FALSE
            ORDER BY display_order ASC
            "#,
        )
        .bind(site_id)
        .fetch_all(pool)
        .await?;

        Ok(items)
    }

    /// Public tree query for one menu: item columns plus a resolved title,
    /// the linked page's slug, and the linked legal document's version-chain
    /// ROOT slug (mirroring `legal_repo::find_by_slug_for_site` — versions
    /// resolve through the root, so the walk goes up `parent_version_id`).
    /// Both link targets must belong to the item's own site (defense in
    /// depth against cross-site references): the page join is scoped through
    /// `content_sites`, the legal chain root through the same table inside
    /// the LATERAL. Broken links never render publicly: target-less items
    /// (all three link columns NULL — e.g. after a page or legal-document
    /// purge), page items whose page does not resolve on-site, and legal
    /// items whose chain-root slug does not resolve (soft-deleted document,
    /// slug-less root) are all dropped; the admin items read
    /// (`find_all_for_menu_admin`) keeps them visible for repair.
    fn tree_query(title_select: &str, locale_join: &str) -> String {
        format!(
            r#"
            SELECT ni.id, ni.site_id, ni.menu_id, ni.parent_id, ni.page_id, ni.external_url,
                   ni.legal_document_id, ni.icon, ni.display_order, ni.is_active, ni.open_in_new_tab,
                   {title_select},
                   LTRIM(p.route, '/') AS page_slug, lroot.slug AS legal_slug
            FROM navigation_items ni
            {locale_join}
            LEFT JOIN pages p ON p.id = ni.page_id
                AND EXISTS (
                    SELECT 1 FROM content_sites cs
                    WHERE cs.content_id = p.content_id AND cs.site_id = ni.site_id
                )
            LEFT JOIN LATERAL (
                WITH RECURSIVE chain AS (
                    SELECT ld.id, ld.content_id, ld.parent_version_id
                    FROM legal_documents ld
                    WHERE ld.id = ni.legal_document_id AND ld.is_deleted = FALSE
                    UNION ALL
                    SELECT parent.id, parent.content_id, parent.parent_version_id
                    FROM legal_documents parent
                    INNER JOIN chain ON chain.parent_version_id = parent.id
                    WHERE parent.is_deleted = FALSE
                )
                SELECT c.slug
                FROM chain
                INNER JOIN contents c ON c.id = chain.content_id
                INNER JOIN content_sites cs
                    ON cs.content_id = chain.content_id AND cs.site_id = ni.site_id
                WHERE chain.parent_version_id IS NULL
                LIMIT 1
            ) lroot ON TRUE
            WHERE ni.menu_id = $1 AND ni.is_active = TRUE AND ni.is_deleted = FALSE
              AND ((ni.page_id IS NOT NULL AND p.id IS NOT NULL)
                   OR ni.external_url IS NOT NULL
                   OR (ni.legal_document_id IS NOT NULL AND lroot.slug IS NOT NULL))
            ORDER BY ni.display_order ASC
            "#
        )
    }

    /// Build a navigation tree for a menu with localized titles, page slugs,
    /// and legal chain-root slugs. Locale mode resolves titles through the
    /// ADR 0002 chain: requested locale → site default locale → first
    /// available localization.
    pub async fn find_tree_for_menu(
        pool: &PgPool,
        menu_id: Uuid,
        locale_id: Option<Uuid>,
    ) -> Result<Vec<NavigationTree>, ApiError> {
        let flat_items = if let Some(loc_id) = locale_id {
            sqlx::query_as::<_, NavigationItemFlat>(sqlx::AssertSqlSafe(Self::tree_query(
                r#"COALESCE(
                    (SELECT nil.title FROM navigation_item_localizations nil
                     WHERE nil.navigation_item_id = ni.id AND nil.locale_id = $2),
                    (SELECT nil.title FROM navigation_item_localizations nil
                     INNER JOIN site_locales sl
                         ON sl.locale_id = nil.locale_id
                        AND sl.site_id = ni.site_id
                        AND sl.is_default = TRUE
                     WHERE nil.navigation_item_id = ni.id
                     LIMIT 1),
                    (SELECT nil.title FROM navigation_item_localizations nil
                     WHERE nil.navigation_item_id = ni.id LIMIT 1)
                ) AS title"#,
                "",
            )))
            .bind(menu_id)
            .bind(loc_id)
            .fetch_all(pool)
            .await?
        } else {
            // No locale specified - fetch first available localization
            sqlx::query_as::<_, NavigationItemFlat>(sqlx::AssertSqlSafe(Self::tree_query(
                "(SELECT nil.title FROM navigation_item_localizations nil WHERE nil.navigation_item_id = ni.id LIMIT 1) AS title",
                "",
            )))
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
            SELECT id, site_id, menu_id, parent_id, page_id, external_url, legal_document_id, icon,
                   display_order, is_active, open_in_new_tab, created_at, updated_at,
                   is_deleted, deleted_at
            FROM navigation_items
            WHERE parent_id = $1 AND is_active = TRUE AND is_deleted = FALSE
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
            SELECT id, site_id, menu_id, parent_id, page_id, external_url, legal_document_id, icon,
                   display_order, is_active, open_in_new_tab, created_at, updated_at,
                   is_deleted, deleted_at
            FROM navigation_items
            WHERE id = $1 AND is_deleted = FALSE
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Navigation item with ID {} not found", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("nav_item")
        })?;

        Ok(item)
    }

    /// Create a new navigation item
    pub async fn create(pool: &PgPool, req: CreateNavigationItemRequest) -> Result<Self, ApiError> {
        let item = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO navigation_items (site_id, menu_id, parent_id, page_id, external_url, legal_document_id, icon, display_order, open_in_new_tab)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, site_id, menu_id, parent_id, page_id, external_url, legal_document_id, icon,
                      display_order, is_active, open_in_new_tab, created_at, updated_at,
                      is_deleted, deleted_at
            "#,
        )
        .bind(req.site_id)
        .bind(req.menu_id)
        .bind(req.parent_id)
        .bind(req.page_id)
        .bind(&req.external_url)
        .bind(req.legal_document_id)
        .bind(&req.icon)
        .bind(req.display_order)
        .bind(req.open_in_new_tab)
        .fetch_one(pool)
        .await?;

        Ok(item)
    }

    /// Update a navigation item. Providing any link target switches the item
    /// to exactly that target and clears the other two (validate_link caps
    /// writes at one target); omitting all three leaves the link untouched.
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdateNavigationItemRequest,
    ) -> Result<Self, ApiError> {
        let switch_link = req.changes_link();
        let item = sqlx::query_as::<_, Self>(
            r#"
            UPDATE navigation_items
            SET parent_id = COALESCE($2, parent_id),
                page_id = CASE WHEN $3 THEN $4 ELSE page_id END,
                external_url = CASE WHEN $3 THEN $5 ELSE external_url END,
                legal_document_id = CASE WHEN $3 THEN $6 ELSE legal_document_id END,
                icon = COALESCE($7, icon),
                display_order = COALESCE($8, display_order),
                open_in_new_tab = COALESCE($9, open_in_new_tab),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, site_id, menu_id, parent_id, page_id, external_url, legal_document_id, icon,
                      display_order, is_active, open_in_new_tab, created_at, updated_at,
                      is_deleted, deleted_at
            "#,
        )
        .bind(id)
        .bind(req.parent_id)
        .bind(switch_link)
        .bind(req.page_id)
        .bind(&req.external_url)
        .bind(req.legal_document_id)
        .bind(&req.icon)
        .bind(req.display_order)
        .bind(req.open_in_new_tab)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Navigation item with ID {} not found", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("nav_item")
        })?;

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
                "UPDATE navigation_items SET display_order = $1, parent_id = $2, updated_at = NOW() WHERE id = $3 AND menu_id = $4 AND is_deleted = FALSE",
            )
            .bind(display_order)
            .bind(parent_id)
            .bind(id)
            .bind(menu_id)
            .execute(&mut *tx)
            .await?;

            if result.rows_affected() == 0 {
                return Err(ApiError::not_found(format!(
                    "Navigation item with ID {} not found for menu {}",
                    id, menu_id
                ))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("nav_item"));
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
                "UPDATE navigation_items SET display_order = $1, updated_at = NOW() WHERE id = $2 AND site_id = $3 AND is_deleted = FALSE",
            )
            .bind(display_order)
            .bind(id)
            .bind(site_id)
            .execute(&mut *tx)
            .await?;

            if result.rows_affected() == 0 {
                return Err(ApiError::not_found(format!(
                    "Navigation item with ID {} not found for site {}",
                    id, site_id
                ))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("nav_item"));
            }
        }

        tx.commit().await?;
        Ok(())
    }

    /// Soft delete a navigation item and its children (localizations preserved)
    pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        // Soft-delete the item itself
        let result = sqlx::query(
            r#"
            UPDATE navigation_items
            SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW()
            WHERE id = $1 AND is_deleted = FALSE
            "#,
        )
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(
                ApiError::not_found(format!("Navigation item with ID {} not found", id))
                    .with_code(codes::ENTITY_NOT_FOUND)
                    .with_entity_type("nav_item"),
            );
        }

        // Also soft-delete any children (recursive via CTE)
        sqlx::query(
            r#"
            WITH RECURSIVE children AS (
                SELECT id FROM navigation_items WHERE parent_id = $1 AND is_deleted = FALSE
                UNION ALL
                SELECT ni.id FROM navigation_items ni
                INNER JOIN children c ON ni.parent_id = c.id
                WHERE ni.is_deleted = FALSE
            )
            UPDATE navigation_items
            SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW()
            WHERE id IN (SELECT id FROM children)
            "#,
        )
        .bind(id)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Restore a soft-deleted navigation item and its children
    pub async fn restore(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query(
            r#"
            UPDATE navigation_items
            SET is_deleted = FALSE, deleted_at = NULL, updated_at = NOW()
            WHERE id = $1 AND is_deleted = TRUE
            "#,
        )
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::not_found(format!(
                "Navigation item with ID {} not found or not deleted",
                id
            ))
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type("nav_item"));
        }

        // Also restore children that were cascade-deleted with this item
        sqlx::query(
            r#"
            WITH RECURSIVE children AS (
                SELECT id FROM navigation_items WHERE parent_id = $1 AND is_deleted = TRUE
                UNION ALL
                SELECT ni.id FROM navigation_items ni
                INNER JOIN children c ON ni.parent_id = c.id
                WHERE ni.is_deleted = TRUE
            )
            UPDATE navigation_items
            SET is_deleted = FALSE, deleted_at = NULL, updated_at = NOW()
            WHERE id IN (SELECT id FROM children)
            "#,
        )
        .bind(id)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Permanently delete a navigation item (FK cascades to localizations)
    pub async fn permanent_delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result =
            sqlx::query("DELETE FROM navigation_items WHERE id = $1 AND is_deleted = TRUE")
                .bind(id)
                .execute(pool)
                .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::not_found(format!(
                "Navigation item with ID {} not found in trash",
                id
            ))
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type("nav_item"));
        }

        Ok(())
    }

    /// Find a deleted navigation item by ID
    pub async fn find_deleted_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, menu_id, parent_id, page_id, external_url, legal_document_id, icon,
                   display_order, is_active, open_in_new_tab, created_at, updated_at,
                   is_deleted, deleted_at
            FROM navigation_items
            WHERE id = $1 AND is_deleted = TRUE
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Navigation item with ID {} not found in trash", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("nav_item")
        })
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
                legal_document_id: item.legal_document_id,
                icon: item.icon.clone(),
                display_order: item.display_order,
                open_in_new_tab: item.open_in_new_tab,
                title: item.title.clone(),
                page_slug: item.page_slug.clone(),
                legal_slug: item.legal_slug.clone(),
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
            legal_document_id: None,
            icon: Some("home".to_string()),
            display_order: 1,
            is_active: true,
            open_in_new_tab: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            is_deleted: false,
            deleted_at: None,
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
                legal_document_id: None,
                icon: None,
                display_order: 0,
                is_active: true,
                open_in_new_tab: false,
                title: Some("Home".to_string()),
                page_slug: None,
                legal_slug: None,
            },
            NavigationItemFlat {
                id: Uuid::parse_str("00000000-0000-0000-0000-000000000002").unwrap(),
                site_id: Uuid::new_v4(),
                menu_id: Uuid::new_v4(),
                parent_id: Some(Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap()),
                page_id: None,
                external_url: Some("/about".to_string()),
                legal_document_id: None,
                icon: None,
                display_order: 0,
                is_active: true,
                open_in_new_tab: false,
                title: Some("About".to_string()),
                page_slug: None,
                legal_slug: None,
            },
        ];

        let tree = build_tree(items);
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].children.len(), 1);
        assert_eq!(tree[0].children[0].title, Some("About".to_string()));
    }
}
