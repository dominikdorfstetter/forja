//! Content model - base for all content types

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;

/// Content status enum matching PostgreSQL
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, utoipa::ToSchema)]
#[sqlx(type_name = "content_status", rename_all = "lowercase")]
#[derive(Default)]
pub enum ContentStatus {
    #[default]
    Draft,
    #[sqlx(rename = "in_review")]
    InReview,
    Scheduled,
    Published,
    Archived,
}

/// Translation status enum matching PostgreSQL
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, utoipa::ToSchema)]
#[sqlx(type_name = "translation_status", rename_all = "lowercase")]
#[derive(Default)]
pub enum TranslationStatus {
    #[default]
    Pending,
    #[sqlx(rename = "in_progress")]
    InProgress,
    Review,
    Approved,
    Outdated,
}

/// Base content model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Content {
    pub id: Uuid,
    pub entity_type_id: Uuid,
    pub environment_id: Uuid,
    pub slug: Option<String>,
    pub status: ContentStatus,
    pub published_at: Option<DateTime<Utc>>,
    pub publish_start: Option<DateTime<Utc>>,
    pub publish_end: Option<DateTime<Utc>>,
    pub current_version: i16,
    pub is_global: bool,
    pub created_by: Option<Uuid>,
    pub updated_by: Option<Uuid>,
    pub is_deleted: bool,
    pub deleted_at: Option<DateTime<Utc>>,
    pub deleted_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Content localization model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ContentLocalization {
    pub id: Uuid,
    pub content_id: Uuid,
    pub locale_id: Uuid,
    pub title: String,
    pub subtitle: Option<String>,
    pub excerpt: Option<String>,
    pub body: Option<String>,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub translation_status: TranslationStatus,
    pub translated_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Content {
    /// Find the site IDs associated with a content item (via content_sites junction table)
    pub async fn find_site_ids(pool: &PgPool, content_id: Uuid) -> Result<Vec<Uuid>, ApiError> {
        let rows: Vec<(Uuid,)> =
            sqlx::query_as("SELECT site_id FROM content_sites WHERE content_id = $1")
                .bind(content_id)
                .fetch_all(pool)
                .await?;

        Ok(rows.into_iter().map(|(id,)| id).collect())
    }

    /// Find content by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let content = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, entity_type_id, environment_id, slug, status, published_at,
                   publish_start, publish_end, current_version, is_global,
                   created_by, updated_by, is_deleted, deleted_at, deleted_by,
                   created_at, updated_at
            FROM contents
            WHERE id = $1 AND is_deleted = FALSE
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Content with ID {} not found", id)))?;

        Ok(content)
    }

    /// Find content by slug within a site
    pub async fn find_by_slug(pool: &PgPool, site_id: Uuid, slug: &str) -> Result<Self, ApiError> {
        let content = sqlx::query_as::<_, Self>(
            r#"
            SELECT c.id, c.entity_type_id, c.environment_id, c.slug, c.status, c.published_at,
                   c.publish_start, c.publish_end, c.current_version, c.is_global,
                   c.created_by, c.updated_by, c.is_deleted, c.deleted_at, c.deleted_by,
                   c.created_at, c.updated_at
            FROM contents c
            INNER JOIN content_sites cs ON c.id = cs.content_id
            WHERE cs.site_id = $1 AND c.slug = $2 AND c.is_deleted = FALSE
            "#,
        )
        .bind(site_id)
        .bind(slug)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Content with slug '{}' not found", slug)))?;

        Ok(content)
    }
}

impl ContentLocalization {
    /// Find localization for content
    pub async fn find_for_content(
        pool: &PgPool,
        content_id: Uuid,
        locale_id: Uuid,
    ) -> Result<Self, ApiError> {
        let localization = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, content_id, locale_id, title, subtitle, excerpt, body,
                   meta_title, meta_description, translation_status, translated_by,
                   created_at, updated_at
            FROM content_localizations
            WHERE content_id = $1 AND locale_id = $2
            "#,
        )
        .bind(content_id)
        .bind(locale_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::NotFound(format!(
                "Localization not found for content {} and locale {}",
                content_id, locale_id
            ))
        })?;

        Ok(localization)
    }

    /// Find all localizations for content
    pub async fn find_all_for_content(
        pool: &PgPool,
        content_id: Uuid,
    ) -> Result<Vec<Self>, ApiError> {
        let localizations = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, content_id, locale_id, title, subtitle, excerpt, body,
                   meta_title, meta_description, translation_status, translated_by,
                   created_at, updated_at
            FROM content_localizations
            WHERE content_id = $1
            "#,
        )
        .bind(content_id)
        .fetch_all(pool)
        .await?;

        Ok(localizations)
    }

    /// Find localization by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let localization = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, content_id, locale_id, title, subtitle, excerpt, body,
                   meta_title, meta_description, translation_status, translated_by,
                   created_at, updated_at
            FROM content_localizations
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Localization with ID {} not found", id)))?;

        Ok(localization)
    }

    /// Create a new localization
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        pool: &PgPool,
        content_id: Uuid,
        locale_id: Uuid,
        title: &str,
        subtitle: Option<&str>,
        excerpt: Option<&str>,
        body: Option<&str>,
        meta_title: Option<&str>,
        meta_description: Option<&str>,
    ) -> Result<Self, ApiError> {
        let localization = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO content_localizations (content_id, locale_id, title, subtitle, excerpt, body,
                                               meta_title, meta_description)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, content_id, locale_id, title, subtitle, excerpt, body,
                      meta_title, meta_description, translation_status, translated_by,
                      created_at, updated_at
            "#,
        )
        .bind(content_id)
        .bind(locale_id)
        .bind(title)
        .bind(subtitle)
        .bind(excerpt)
        .bind(body)
        .bind(meta_title)
        .bind(meta_description)
        .fetch_one(pool)
        .await?;

        Ok(localization)
    }

    /// Update a localization
    #[allow(clippy::too_many_arguments)]
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        title: Option<&str>,
        subtitle: Option<&str>,
        excerpt: Option<&str>,
        body: Option<&str>,
        meta_title: Option<&str>,
        meta_description: Option<&str>,
        translation_status: Option<&TranslationStatus>,
    ) -> Result<Self, ApiError> {
        let localization = sqlx::query_as::<_, Self>(
            r#"
            UPDATE content_localizations
            SET title = COALESCE($2, title),
                subtitle = COALESCE($3, subtitle),
                excerpt = COALESCE($4, excerpt),
                body = COALESCE($5, body),
                meta_title = COALESCE($6, meta_title),
                meta_description = COALESCE($7, meta_description),
                translation_status = COALESCE($8, translation_status),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, content_id, locale_id, title, subtitle, excerpt, body,
                      meta_title, meta_description, translation_status, translated_by,
                      created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(title)
        .bind(subtitle)
        .bind(excerpt)
        .bind(body)
        .bind(meta_title)
        .bind(meta_description)
        .bind(translation_status)
        .fetch_one(pool)
        .await?;

        Ok(localization)
    }

    /// Delete a localization
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM content_localizations WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!(
                "Localization with ID {} not found",
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
    fn test_content_status_default() {
        let status = ContentStatus::default();
        assert_eq!(status, ContentStatus::Draft);
    }

    #[test]
    fn test_content_status_serialization() {
        let status = ContentStatus::Published;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"Published\"");
    }

    #[test]
    fn test_translation_status_default() {
        let status = TranslationStatus::default();
        assert_eq!(status, TranslationStatus::Pending);
    }
}
