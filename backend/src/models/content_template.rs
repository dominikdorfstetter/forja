//! Content template model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::content_template::{CreateContentTemplateRequest, UpdateContentTemplateRequest};
use crate::errors::ApiError;

/// Content template model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ContentTemplate {
    pub id: Uuid,
    pub site_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub icon: String,
    pub slug_prefix: String,
    pub is_featured: bool,
    pub allow_comments: bool,
    pub title: String,
    pub subtitle: String,
    pub excerpt: String,
    pub body: String,
    pub meta_title: String,
    pub meta_description: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl ContentTemplate {
    /// Find all content templates for a site (paginated, with optional search)
    pub async fn find_all_for_site(
        pool: &PgPool,
        site_id: Uuid,
        search: Option<&str>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Self>, ApiError> {
        let templates = match search {
            Some(q) if !q.is_empty() => {
                let pattern = format!("%{}%", q);
                sqlx::query_as::<_, Self>(
                    r#"
                    SELECT id, site_id, name, description, icon, slug_prefix,
                           is_featured, allow_comments, title, subtitle, excerpt, body,
                           meta_title, meta_description, is_active, created_at, updated_at
                    FROM content_templates
                    WHERE site_id = $1 AND (name ILIKE $4 OR description ILIKE $4)
                    ORDER BY created_at DESC
                    LIMIT $2 OFFSET $3
                    "#,
                )
                .bind(site_id)
                .bind(limit)
                .bind(offset)
                .bind(&pattern)
                .fetch_all(pool)
                .await?
            }
            _ => {
                sqlx::query_as::<_, Self>(
                    r#"
                    SELECT id, site_id, name, description, icon, slug_prefix,
                           is_featured, allow_comments, title, subtitle, excerpt, body,
                           meta_title, meta_description, is_active, created_at, updated_at
                    FROM content_templates
                    WHERE site_id = $1
                    ORDER BY created_at DESC
                    LIMIT $2 OFFSET $3
                    "#,
                )
                .bind(site_id)
                .bind(limit)
                .bind(offset)
                .fetch_all(pool)
                .await?
            }
        };

        Ok(templates)
    }

    /// Count content templates for a site (with optional search)
    pub async fn count_for_site(
        pool: &PgPool,
        site_id: Uuid,
        search: Option<&str>,
    ) -> Result<i64, ApiError> {
        let row: (i64,) = match search {
            Some(q) if !q.is_empty() => {
                let pattern = format!("%{}%", q);
                sqlx::query_as(
                    "SELECT COUNT(*) FROM content_templates WHERE site_id = $1 AND (name ILIKE $2 OR description ILIKE $2)",
                )
                .bind(site_id)
                .bind(&pattern)
                .fetch_one(pool)
                .await?
            }
            _ => {
                sqlx::query_as("SELECT COUNT(*) FROM content_templates WHERE site_id = $1")
                    .bind(site_id)
                    .fetch_one(pool)
                    .await?
            }
        };
        Ok(row.0)
    }

    /// Find content template by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let template = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, name, description, icon, slug_prefix,
                   is_featured, allow_comments, title, subtitle, excerpt, body,
                   meta_title, meta_description, is_active, created_at, updated_at
            FROM content_templates
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Content template with ID {} not found", id)))?;

        Ok(template)
    }

    /// Create a new content template
    pub async fn create(
        pool: &PgPool,
        req: CreateContentTemplateRequest,
    ) -> Result<Self, ApiError> {
        let template = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO content_templates (site_id, name, description, icon, slug_prefix,
                   is_featured, allow_comments, title, subtitle, excerpt, body,
                   meta_title, meta_description, is_active)
            VALUES ($1, $2, $3, COALESCE($4, 'Article'), COALESCE($5, 'post'),
                    COALESCE($6, FALSE), COALESCE($7, TRUE), COALESCE($8, ''),
                    COALESCE($9, ''), COALESCE($10, ''), COALESCE($11, ''),
                    COALESCE($12, ''), COALESCE($13, ''), COALESCE($14, TRUE))
            RETURNING id, site_id, name, description, icon, slug_prefix,
                      is_featured, allow_comments, title, subtitle, excerpt, body,
                      meta_title, meta_description, is_active, created_at, updated_at
            "#,
        )
        .bind(req.site_id)
        .bind(&req.name)
        .bind(&req.description)
        .bind(&req.icon)
        .bind(&req.slug_prefix)
        .bind(req.is_featured)
        .bind(req.allow_comments)
        .bind(&req.title)
        .bind(&req.subtitle)
        .bind(&req.excerpt)
        .bind(&req.body)
        .bind(&req.meta_title)
        .bind(&req.meta_description)
        .bind(req.is_active)
        .fetch_one(pool)
        .await?;

        Ok(template)
    }

    /// Update a content template (partial update with COALESCE)
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdateContentTemplateRequest,
    ) -> Result<Self, ApiError> {
        let template = sqlx::query_as::<_, Self>(
            r#"
            UPDATE content_templates
            SET name = COALESCE($2, name),
                description = COALESCE($3, description),
                icon = COALESCE($4, icon),
                slug_prefix = COALESCE($5, slug_prefix),
                is_featured = COALESCE($6, is_featured),
                allow_comments = COALESCE($7, allow_comments),
                title = COALESCE($8, title),
                subtitle = COALESCE($9, subtitle),
                excerpt = COALESCE($10, excerpt),
                body = COALESCE($11, body),
                meta_title = COALESCE($12, meta_title),
                meta_description = COALESCE($13, meta_description),
                is_active = COALESCE($14, is_active),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, site_id, name, description, icon, slug_prefix,
                      is_featured, allow_comments, title, subtitle, excerpt, body,
                      meta_title, meta_description, is_active, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&req.name)
        .bind(&req.description)
        .bind(&req.icon)
        .bind(&req.slug_prefix)
        .bind(req.is_featured)
        .bind(req.allow_comments)
        .bind(&req.title)
        .bind(&req.subtitle)
        .bind(&req.excerpt)
        .bind(&req.body)
        .bind(&req.meta_title)
        .bind(&req.meta_description)
        .bind(req.is_active)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Content template with ID {} not found", id)))?;

        Ok(template)
    }

    /// Delete a content template (hard delete)
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM content_templates WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!(
                "Content template with ID {} not found",
                id
            )));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_content_template_serialization() {
        let template = ContentTemplate {
            id: Uuid::new_v4(),
            site_id: Uuid::new_v4(),
            name: "Tutorial".to_string(),
            description: Some("Step-by-step guide".to_string()),
            icon: "School".to_string(),
            slug_prefix: "tutorial".to_string(),
            is_featured: false,
            allow_comments: true,
            title: "How to do something".to_string(),
            subtitle: "A guide".to_string(),
            excerpt: "Learn how".to_string(),
            body: "## Step 1".to_string(),
            meta_title: "Tutorial".to_string(),
            meta_description: "A tutorial".to_string(),
            is_active: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&template).unwrap();
        assert!(json.contains("\"name\":\"Tutorial\""));
        assert!(json.contains("\"icon\":\"School\""));
    }
}
