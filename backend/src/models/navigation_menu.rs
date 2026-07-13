//! Navigation Menu model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgExecutor, PgPool};
use uuid::Uuid;

use crate::dto::navigation_menu::{CreateNavigationMenuRequest, UpdateNavigationMenuRequest};
use crate::errors::ApiError;
use crate::errors::codes;

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
    pub is_deleted: bool,
    pub deleted_at: Option<DateTime<Utc>>,
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
    pub is_deleted: bool,
    pub deleted_at: Option<DateTime<Utc>>,
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
                   nm.created_at, nm.updated_at, nm.is_deleted, nm.deleted_at
            FROM navigation_menus nm
            LEFT JOIN navigation_items ni ON ni.menu_id = nm.id AND ni.is_deleted = FALSE
            WHERE nm.site_id = $1 AND nm.is_deleted = FALSE
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
            SELECT id, site_id, slug, description, max_depth, is_active,
                   created_at, updated_at, is_deleted, deleted_at
            FROM navigation_menus
            WHERE id = $1 AND is_deleted = FALSE
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Navigation menu with ID {} not found", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("nav_menu")
        })?;

        Ok(menu)
    }

    /// Find menu by slug for a site
    pub async fn find_by_slug(pool: &PgPool, site_id: Uuid, slug: &str) -> Result<Self, ApiError> {
        let menu = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, slug, description, max_depth, is_active,
                   created_at, updated_at, is_deleted, deleted_at
            FROM navigation_menus
            WHERE site_id = $1 AND slug = $2 AND is_deleted = FALSE
            "#,
        )
        .bind(site_id)
        .bind(slug)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!(
                "Navigation menu '{}' not found for site {}",
                slug, site_id
            ))
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type("nav_menu")
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
            RETURNING id, site_id, slug, description, max_depth, is_active,
                      created_at, updated_at, is_deleted, deleted_at
            "#,
        )
        .bind(site_id)
        .bind(&req.slug)
        .bind(&req.description)
        .bind(req.max_depth.unwrap_or(3))
        .fetch_one(pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(ref db_err) = e
                && db_err.constraint() == Some("uq_navigation_menus_site_slug")
            {
                return ApiError::bad_request(format!(
                    "Menu with slug '{}' already exists for this site",
                    req.slug
                ));
            }
            ApiError::from(e)
        })?;

        Ok(menu)
    }

    /// Update a navigation menu: the menu row, localization upserts, and
    /// localization removals commit in one transaction.
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdateNavigationMenuRequest,
    ) -> Result<Self, ApiError> {
        let mut tx = pool.begin().await?;

        let menu = sqlx::query_as::<_, Self>(
            r#"
            UPDATE navigation_menus
            SET slug = COALESCE($2, slug),
                description = COALESCE($3, description),
                max_depth = COALESCE($4, max_depth),
                is_active = COALESCE($5, is_active),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, site_id, slug, description, max_depth, is_active,
                      created_at, updated_at, is_deleted, deleted_at
            "#,
        )
        .bind(id)
        .bind(&req.slug)
        .bind(&req.description)
        .bind(req.max_depth)
        .bind(req.is_active)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Navigation menu with ID {} not found", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("nav_menu")
        })?;

        if let Some(locs) = &req.localizations {
            for loc in locs {
                NavigationMenuLocalization::upsert(&mut *tx, id, loc.locale_id, &loc.name).await?;
            }
        }

        if let Some(removed) = &req.removed_locale_ids
            && !removed.is_empty()
        {
            sqlx::query(
                "DELETE FROM navigation_menu_localizations
                 WHERE navigation_menu_id = $1 AND locale_id = ANY($2)",
            )
            .bind(id)
            .bind(removed)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(menu)
    }

    /// Soft delete a navigation menu (items preserved in DB)
    pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query(
            r#"
            UPDATE navigation_menus
            SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW()
            WHERE id = $1 AND is_deleted = FALSE
            "#,
        )
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(
                ApiError::not_found(format!("Navigation menu with ID {} not found", id))
                    .with_code(codes::ENTITY_NOT_FOUND)
                    .with_entity_type("nav_menu"),
            );
        }

        Ok(())
    }

    /// Restore a soft-deleted navigation menu (items become accessible again)
    pub async fn restore(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query(
            r#"
            UPDATE navigation_menus
            SET is_deleted = FALSE, deleted_at = NULL, updated_at = NOW()
            WHERE id = $1 AND is_deleted = TRUE
            "#,
        )
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::not_found(format!(
                "Navigation menu with ID {} not found or not deleted",
                id
            ))
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type("nav_menu"));
        }

        Ok(())
    }

    /// Permanently delete a navigation menu (FK cascades to items and localizations)
    pub async fn permanent_delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result =
            sqlx::query("DELETE FROM navigation_menus WHERE id = $1 AND is_deleted = TRUE")
                .bind(id)
                .execute(pool)
                .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::not_found(format!(
                "Navigation menu with ID {} not found in trash",
                id
            ))
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type("nav_menu"));
        }

        Ok(())
    }

    /// Find a deleted navigation menu by ID
    pub async fn find_deleted_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, slug, description, max_depth, is_active,
                   created_at, updated_at, is_deleted, deleted_at
            FROM navigation_menus
            WHERE id = $1 AND is_deleted = TRUE
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Navigation menu with ID {} not found in trash", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("nav_menu")
        })
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

    /// Upsert a localization for a menu. Generic over the executor so
    /// [`NavigationMenu::update`] can run it on its transaction; normal
    /// callers pass `&PgPool`.
    pub async fn upsert<'e, E>(
        executor: E,
        menu_id: Uuid,
        locale_id: Uuid,
        name: &str,
    ) -> Result<Self, ApiError>
    where
        E: PgExecutor<'e>,
    {
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
        .fetch_one(executor)
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
            is_deleted: false,
            deleted_at: None,
        };

        let json = serde_json::to_string(&menu).unwrap();
        assert!(json.contains("\"slug\":\"primary\""));
    }
}
