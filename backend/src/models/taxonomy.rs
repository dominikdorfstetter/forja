//! Taxonomy model (tags, categories)

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::taxonomy::{
    CreateCategoryRequest, CreateTagRequest, UpdateCategoryRequest, UpdateTagRequest,
};
use crate::errors::ApiError;

/// Tag model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Tag {
    pub id: Uuid,
    pub slug: String,
    pub is_global: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

/// Category model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Category {
    pub id: Uuid,
    pub parent_id: Option<Uuid>,
    pub slug: String,
    pub is_global: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

/// Category with blog count (for listing endpoints)
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CategoryWithBlogCount {
    pub id: Uuid,
    pub parent_id: Option<Uuid>,
    pub slug: String,
    pub is_global: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub blog_count: i64,
}

/// Tag localization
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TagLocalization {
    pub id: Uuid,
    pub tag_id: Uuid,
    pub locale_id: Uuid,
    pub name: String,
}

/// Category localization
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CategoryLocalization {
    pub id: Uuid,
    pub category_id: Uuid,
    pub locale_id: Uuid,
    pub name: String,
    pub description: Option<String>,
}

impl Tag {
    /// Count tags for a site
    pub async fn count_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM tags t INNER JOIN tag_sites ts ON t.id = ts.tag_id WHERE ts.site_id = $1 AND t.is_active = TRUE"
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;
        Ok(row.0)
    }

    /// Find all tags for a site
    pub async fn find_all_for_site(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Self>, ApiError> {
        let tags = sqlx::query_as::<_, Self>(
            r#"
            SELECT t.id, t.slug, t.is_global, t.is_active, t.created_at
            FROM tags t
            INNER JOIN tag_sites ts ON t.id = ts.tag_id
            WHERE ts.site_id = $1 AND t.is_active = TRUE
            ORDER BY t.slug ASC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(site_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok(tags)
    }

    /// Find tag by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let tag = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, slug, is_global, is_active, created_at
            FROM tags
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Tag with ID {} not found", id)))?;

        Ok(tag)
    }

    /// Find tag by slug
    pub async fn find_by_slug(pool: &PgPool, slug: &str) -> Result<Self, ApiError> {
        let tag = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, slug, is_global, is_active, created_at
            FROM tags
            WHERE slug = $1
            "#,
        )
        .bind(slug)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Tag with slug '{}' not found", slug)))?;

        Ok(tag)
    }

    /// Find tags for content
    pub async fn find_for_content(pool: &PgPool, content_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let tags = sqlx::query_as::<_, Self>(
            r#"
            SELECT t.id, t.slug, t.is_global, t.is_active, t.created_at
            FROM tags t
            INNER JOIN content_tags ct ON t.id = ct.tag_id
            WHERE ct.content_id = $1 AND t.is_active = TRUE
            ORDER BY t.slug ASC
            "#,
        )
        .bind(content_id)
        .fetch_all(pool)
        .await?;

        Ok(tags)
    }

    /// Create a new tag
    pub async fn create(pool: &PgPool, req: &CreateTagRequest) -> Result<Self, ApiError> {
        let mut tx = pool.begin().await?;

        let tag = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO tags (slug, is_global)
            VALUES ($1, $2)
            RETURNING id, slug, is_global, is_active, created_at
            "#,
        )
        .bind(&req.slug)
        .bind(req.is_global)
        .fetch_one(&mut *tx)
        .await?;

        // Associate with site if provided
        if let Some(site_id) = req.site_id {
            sqlx::query("INSERT INTO tag_sites (tag_id, site_id) VALUES ($1, $2)")
                .bind(tag.id)
                .bind(site_id)
                .execute(&mut *tx)
                .await?;
        }

        tx.commit().await?;
        Ok(tag)
    }

    /// Update a tag
    pub async fn update(pool: &PgPool, id: Uuid, req: &UpdateTagRequest) -> Result<Self, ApiError> {
        let tag = sqlx::query_as::<_, Self>(
            r#"
            UPDATE tags
            SET slug = COALESCE($2, slug),
                is_global = COALESCE($3, is_global)
            WHERE id = $1
            RETURNING id, slug, is_global, is_active, created_at
            "#,
        )
        .bind(id)
        .bind(&req.slug)
        .bind(req.is_global)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Tag with ID {} not found", id)))?;

        Ok(tag)
    }

    /// Soft delete a tag
    pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("UPDATE tags SET is_active = FALSE WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!("Tag with ID {} not found", id)));
        }

        Ok(())
    }
}

impl Category {
    /// Count root categories for a site
    pub async fn count_root_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM categories c INNER JOIN category_sites cs ON c.id = cs.category_id WHERE cs.site_id = $1 AND c.parent_id IS NULL AND c.is_active = TRUE"
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;
        Ok(row.0)
    }

    /// Find root categories for a site
    pub async fn find_root_for_site(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Self>, ApiError> {
        let categories = sqlx::query_as::<_, Self>(
            r#"
            SELECT c.id, c.parent_id, c.slug, c.is_global, c.is_active, c.created_at
            FROM categories c
            INNER JOIN category_sites cs ON c.id = cs.category_id
            WHERE cs.site_id = $1 AND c.parent_id IS NULL AND c.is_active = TRUE
            ORDER BY c.slug ASC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(site_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok(categories)
    }

    /// Find category by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let category = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, parent_id, slug, is_global, is_active, created_at
            FROM categories
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Category with ID {} not found", id)))?;

        Ok(category)
    }

    /// Find children of a category
    pub async fn find_children(pool: &PgPool, parent_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let categories = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, parent_id, slug, is_global, is_active, created_at
            FROM categories
            WHERE parent_id = $1 AND is_active = TRUE
            ORDER BY slug ASC
            "#,
        )
        .bind(parent_id)
        .fetch_all(pool)
        .await?;

        Ok(categories)
    }

    /// Find categories for content
    pub async fn find_for_content(pool: &PgPool, content_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let categories = sqlx::query_as::<_, Self>(
            r#"
            SELECT c.id, c.parent_id, c.slug, c.is_global, c.is_active, c.created_at
            FROM categories c
            INNER JOIN content_categories cc ON c.id = cc.category_id
            WHERE cc.content_id = $1 AND c.is_active = TRUE
            ORDER BY cc.is_primary DESC, c.slug ASC
            "#,
        )
        .bind(content_id)
        .fetch_all(pool)
        .await?;

        Ok(categories)
    }

    /// Find all categories for a site (including children)
    pub async fn find_all_for_site(pool: &PgPool, site_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let categories = sqlx::query_as::<_, Self>(
            r#"
            SELECT c.id, c.parent_id, c.slug, c.is_global, c.is_active, c.created_at
            FROM categories c
            INNER JOIN category_sites cs ON c.id = cs.category_id
            WHERE cs.site_id = $1 AND c.is_active = TRUE
            ORDER BY c.slug ASC
            "#,
        )
        .bind(site_id)
        .fetch_all(pool)
        .await?;

        Ok(categories)
    }

    /// Create a new category
    pub async fn create(pool: &PgPool, req: &CreateCategoryRequest) -> Result<Self, ApiError> {
        let mut tx = pool.begin().await?;

        let category = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO categories (parent_id, slug, is_global)
            VALUES ($1, $2, $3)
            RETURNING id, parent_id, slug, is_global, is_active, created_at
            "#,
        )
        .bind(req.parent_id)
        .bind(&req.slug)
        .bind(req.is_global)
        .fetch_one(&mut *tx)
        .await?;

        // Associate with site if provided
        if let Some(site_id) = req.site_id {
            sqlx::query("INSERT INTO category_sites (category_id, site_id) VALUES ($1, $2)")
                .bind(category.id)
                .bind(site_id)
                .execute(&mut *tx)
                .await?;
        }

        tx.commit().await?;
        Ok(category)
    }

    /// Update a category
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: &UpdateCategoryRequest,
    ) -> Result<Self, ApiError> {
        let category = sqlx::query_as::<_, Self>(
            r#"
            UPDATE categories
            SET parent_id = COALESCE($2, parent_id),
                slug = COALESCE($3, slug),
                is_global = COALESCE($4, is_global)
            WHERE id = $1
            RETURNING id, parent_id, slug, is_global, is_active, created_at
            "#,
        )
        .bind(id)
        .bind(req.parent_id)
        .bind(&req.slug)
        .bind(req.is_global)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Category with ID {} not found", id)))?;

        Ok(category)
    }

    /// Soft delete a category
    pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("UPDATE categories SET is_active = FALSE WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!(
                "Category with ID {} not found",
                id
            )));
        }

        Ok(())
    }

    /// Assign a category to content (INSERT ON CONFLICT UPDATE is_primary)
    pub async fn assign_to_content(
        pool: &PgPool,
        content_id: Uuid,
        category_id: Uuid,
        is_primary: bool,
    ) -> Result<(), ApiError> {
        sqlx::query(
            r#"
            INSERT INTO content_categories (content_id, category_id, is_primary)
            VALUES ($1, $2, $3)
            ON CONFLICT (content_id, category_id)
            DO UPDATE SET is_primary = $3
            "#,
        )
        .bind(content_id)
        .bind(category_id)
        .bind(is_primary)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Remove a category from content
    pub async fn remove_from_content(
        pool: &PgPool,
        content_id: Uuid,
        category_id: Uuid,
    ) -> Result<(), ApiError> {
        let result = sqlx::query(
            "DELETE FROM content_categories WHERE content_id = $1 AND category_id = $2",
        )
        .bind(content_id)
        .bind(category_id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(
                "Category assignment not found".to_string(),
            ));
        }

        Ok(())
    }

    /// Find categories with blog count for a site
    pub async fn find_with_blog_count(
        pool: &PgPool,
        site_id: Uuid,
    ) -> Result<Vec<CategoryWithBlogCount>, ApiError> {
        let rows = sqlx::query_as::<_, CategoryWithBlogCount>(
            r#"
            SELECT c.id, c.parent_id, c.slug, c.is_global, c.is_active, c.created_at,
                   COUNT(DISTINCT b.id) AS blog_count
            FROM categories c
            INNER JOIN category_sites cs ON c.id = cs.category_id
            LEFT JOIN content_categories cc ON c.id = cc.category_id
            LEFT JOIN contents co ON cc.content_id = co.id
            LEFT JOIN blogs b ON b.content_id = co.id
            WHERE cs.site_id = $1 AND c.is_active = TRUE
            GROUP BY c.id, c.parent_id, c.slug, c.is_global, c.is_active, c.created_at
            ORDER BY c.slug ASC
            "#,
        )
        .bind(site_id)
        .fetch_all(pool)
        .await?;

        Ok(rows)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tag_serialization() {
        let tag = Tag {
            id: Uuid::new_v4(),
            slug: "rust".to_string(),
            is_global: false,
            is_active: true,
            created_at: Utc::now(),
        };

        let json = serde_json::to_string(&tag).unwrap();
        assert!(json.contains("\"slug\":\"rust\""));
    }
}
