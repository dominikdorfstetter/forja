//! Navigation Menu model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::navigation_menu::{CreateNavigationMenuRequest, UpdateNavigationMenuRequest};
use crate::errors::ApiError;

/// Navigation menu container model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct NavigationMenu {
    pub id: Uuid,
    pub site_id: Uuid,
    pub slug: String,
    pub description: Option<String>,
    pub max_depth: i16,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Navigation menu localization
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct NavigationMenuLocalization {
    pub id: Uuid,
    pub navigation_menu_id: Uuid,
    pub locale_id: Uuid,
    pub name: String,
}

/// Navigation menu with item count (for listing)
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct NavigationMenuWithCount {
    pub id: Uuid,
    pub site_id: Uuid,
    pub slug: String,
    pub description: Option<String>,
    pub max_depth: i16,
    pub is_active: bool,
    pub item_count: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl NavigationMenu {
    /// Find all menus for a site (with item counts)
    pub async fn find_all_for_site(
        pool: &PgPool,
        site_id: Uuid,
    ) -> Result<Vec<NavigationMenuWithCount>, ApiError> {
        let menus = sqlx::query_as::<_, NavigationMenuWithCount>(
            r#"
            SELECT nm.id, nm.site_id, nm.slug, nm.description, nm.max_depth,
                   nm.is_active, COUNT(ni.id) AS item_count,
                   nm.created_at, nm.updated_at
            FROM navigation_menus nm
            LEFT JOIN navigation_items ni ON ni.menu_id = nm.id
            WHERE nm.site_id = $1
            GROUP BY nm.id
            ORDER BY nm.created_at ASC
            "#,
        )
        .bind(site_id)
        .fetch_all(pool)
        .await?;

        Ok(menus)
    }

    /// Find menu by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let menu = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, slug, description, max_depth, is_active, created_at, updated_at
            FROM navigation_menus
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Navigation menu with ID {} not found", id)))?;

        Ok(menu)
    }

    /// Find menu by slug for a site
    pub async fn find_by_slug(pool: &PgPool, site_id: Uuid, slug: &str) -> Result<Self, ApiError> {
        let menu = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, slug, description, max_depth, is_active, created_at, updated_at
            FROM navigation_menus
            WHERE site_id = $1 AND slug = $2
            "#,
        )
        .bind(site_id)
        .bind(slug)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::NotFound(format!(
                "Navigation menu '{}' not found for site {}",
                slug, site_id
            ))
        })?;

        Ok(menu)
    }

    /// Create a new navigation menu
    pub async fn create(
        pool: &PgPool,
        site_id: Uuid,
        req: CreateNavigationMenuRequest,
    ) -> Result<Self, ApiError> {
        let menu = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO navigation_menus (site_id, slug, description, max_depth)
            VALUES ($1, $2, $3, $4)
            RETURNING id, site_id, slug, description, max_depth, is_active, created_at, updated_at
            "#,
        )
        .bind(site_id)
        .bind(&req.slug)
        .bind(&req.description)
        .bind(req.max_depth.unwrap_or(3))
        .fetch_one(pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(ref db_err) = e {
                if db_err.constraint() == Some("uq_navigation_menus_site_slug") {
                    return ApiError::BadRequest(format!(
                        "Menu with slug '{}' already exists for this site",
                        req.slug
                    ));
                }
            }
            ApiError::from(e)
        })?;

        Ok(menu)
    }

    /// Update a navigation menu
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdateNavigationMenuRequest,
    ) -> Result<Self, ApiError> {
        let menu = sqlx::query_as::<_, Self>(
            r#"
            UPDATE navigation_menus
            SET slug = COALESCE($2, slug),
                description = COALESCE($3, description),
                max_depth = COALESCE($4, max_depth),
                is_active = COALESCE($5, is_active),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, site_id, slug, description, max_depth, is_active, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&req.slug)
        .bind(&req.description)
        .bind(req.max_depth)
        .bind(req.is_active)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Navigation menu with ID {} not found", id)))?;

        Ok(menu)
    }

    /// Delete a navigation menu (cascades to items)
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM navigation_menus WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!(
                "Navigation menu with ID {} not found",
                id
            )));
        }

        Ok(())
    }
}

impl NavigationMenuLocalization {
    /// Find all localizations for a menu
    pub async fn find_for_menu(pool: &PgPool, menu_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let locs = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, navigation_menu_id, locale_id, name
            FROM navigation_menu_localizations
            WHERE navigation_menu_id = $1
            "#,
        )
        .bind(menu_id)
        .fetch_all(pool)
        .await?;

        Ok(locs)
    }

    /// Upsert a localization for a menu
    pub async fn upsert(
        pool: &PgPool,
        menu_id: Uuid,
        locale_id: Uuid,
        name: &str,
    ) -> Result<Self, ApiError> {
        let loc = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO navigation_menu_localizations (navigation_menu_id, locale_id, name)
            VALUES ($1, $2, $3)
            ON CONFLICT (navigation_menu_id, locale_id) DO UPDATE SET name = EXCLUDED.name
            RETURNING id, navigation_menu_id, locale_id, name
            "#,
        )
        .bind(menu_id)
        .bind(locale_id)
        .bind(name)
        .fetch_one(pool)
        .await?;

        Ok(loc)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_navigation_menu_serialization() {
        let menu = NavigationMenu {
            id: Uuid::new_v4(),
            site_id: Uuid::new_v4(),
            slug: "primary".to_string(),
            description: Some("Main menu".to_string()),
            max_depth: 3,
            is_active: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&menu).unwrap();
        assert!(json.contains("\"slug\":\"primary\""));
    }
}
