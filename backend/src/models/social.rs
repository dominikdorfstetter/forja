//! Social links model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::social::{CreateSocialLinkRequest, UpdateSocialLinkRequest};
use crate::errors::ApiError;

/// Social link model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SocialLink {
    pub id: Uuid,
    pub site_id: Uuid,
    pub title: String,
    pub url: String,
    pub icon: String,
    pub alt_text: Option<String>,
    pub display_order: i16,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl SocialLink {
    /// Find all social links for a site (active only, for public API)
    pub async fn find_all_for_site(pool: &PgPool, site_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let links = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, title, url, icon, alt_text, display_order,
                   is_active, created_at, updated_at
            FROM social_links
            WHERE site_id = $1 AND is_active = TRUE
            ORDER BY display_order ASC
            "#,
        )
        .bind(site_id)
        .fetch_all(pool)
        .await?;

        Ok(links)
    }

    /// Find all social links for a site (including inactive, for admin)
    pub async fn find_all_for_site_admin(
        pool: &PgPool,
        site_id: Uuid,
    ) -> Result<Vec<Self>, ApiError> {
        let links = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, title, url, icon, alt_text, display_order,
                   is_active, created_at, updated_at
            FROM social_links
            WHERE site_id = $1
            ORDER BY display_order ASC
            "#,
        )
        .bind(site_id)
        .fetch_all(pool)
        .await?;

        Ok(links)
    }

    /// Find social link by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let link = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, title, url, icon, alt_text, display_order,
                   is_active, created_at, updated_at
            FROM social_links
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Social link with ID {} not found", id)))?;

        Ok(link)
    }

    /// Create a new social link
    pub async fn create(pool: &PgPool, req: CreateSocialLinkRequest) -> Result<Self, ApiError> {
        let link = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO social_links (site_id, title, url, icon, alt_text, display_order)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, site_id, title, url, icon, alt_text, display_order,
                      is_active, created_at, updated_at
            "#,
        )
        .bind(req.site_id)
        .bind(&req.title)
        .bind(&req.url)
        .bind(&req.icon)
        .bind(&req.alt_text)
        .bind(req.display_order)
        .fetch_one(pool)
        .await?;

        Ok(link)
    }

    /// Update a social link
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdateSocialLinkRequest,
    ) -> Result<Self, ApiError> {
        let link = sqlx::query_as::<_, Self>(
            r#"
            UPDATE social_links
            SET title = COALESCE($2, title),
                url = COALESCE($3, url),
                icon = COALESCE($4, icon),
                alt_text = COALESCE($5, alt_text),
                display_order = COALESCE($6, display_order),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, site_id, title, url, icon, alt_text, display_order,
                      is_active, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&req.title)
        .bind(&req.url)
        .bind(&req.icon)
        .bind(&req.alt_text)
        .bind(req.display_order)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Social link with ID {} not found", id)))?;

        Ok(link)
    }

    /// Batch-reorder social links for a site within a single transaction
    pub async fn reorder_for_site(
        pool: &PgPool,
        site_id: Uuid,
        items: Vec<(Uuid, i16)>,
    ) -> Result<(), ApiError> {
        let mut tx = pool.begin().await?;

        for (id, display_order) in &items {
            let result = sqlx::query(
                "UPDATE social_links SET display_order = $1, updated_at = NOW() WHERE id = $2 AND site_id = $3",
            )
            .bind(display_order)
            .bind(id)
            .bind(site_id)
            .execute(&mut *tx)
            .await?;

            if result.rows_affected() == 0 {
                return Err(ApiError::NotFound(format!(
                    "Social link with ID {} not found for site {}",
                    id, site_id
                )));
            }
        }

        tx.commit().await?;
        Ok(())
    }

    /// Delete a social link (hard delete)
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM social_links WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!(
                "Social link with ID {} not found",
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
    fn test_social_link_serialization() {
        let link = SocialLink {
            id: Uuid::new_v4(),
            site_id: Uuid::new_v4(),
            title: "GitHub".to_string(),
            url: "https://github.com/example".to_string(),
            icon: "github".to_string(),
            alt_text: Some("GitHub Profile".to_string()),
            display_order: 1,
            is_active: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&link).unwrap();
        assert!(json.contains("\"title\":\"GitHub\""));
    }
}
