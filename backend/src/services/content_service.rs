//! Content service — shared logic for content-based entities (Blog, Page, Legal, CV)

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::models::content::ContentStatus;

pub struct ContentService;

impl ContentService {
    /// Create a new content record with site associations.
    /// Uses a transaction so the caller can wrap this with their own entity insert.
    /// Returns the content_id.
    pub async fn create_content(
        pool: &PgPool,
        entity_type_name: &str,
        slug: Option<&str>,
        status: &ContentStatus,
        site_ids: &[Uuid],
        publish_start: Option<DateTime<Utc>>,
        publish_end: Option<DateTime<Utc>>,
    ) -> Result<Uuid, ApiError> {
        // Validate scheduling window
        if let (Some(start), Some(end)) = (publish_start, publish_end) {
            if end <= start {
                return Err(ApiError::BadRequest(
                    "publish_end must be after publish_start".to_string(),
                ));
            }
        }

        // Auto-status: if publish_start is in the future and status is Published, use Scheduled
        let effective_status = if let Some(start) = publish_start {
            if start > Utc::now() && *status == ContentStatus::Published {
                ContentStatus::Scheduled
            } else {
                status.clone()
            }
        } else {
            status.clone()
        };

        let mut tx = pool.begin().await?;

        // Look up entity_type_id
        let entity_type_id: Uuid =
            sqlx::query_scalar("SELECT id FROM entity_types WHERE name = $1")
                .bind(entity_type_name)
                .fetch_optional(&mut *tx)
                .await?
                .ok_or_else(|| {
                    ApiError::BadRequest(format!("Unknown entity type: {}", entity_type_name))
                })?;

        // Get default environment
        let environment_id: Uuid =
            sqlx::query_scalar("SELECT id FROM environments WHERE is_default = TRUE LIMIT 1")
                .fetch_optional(&mut *tx)
                .await?
                .ok_or_else(|| {
                    ApiError::BadRequest("No default environment configured".to_string())
                })?;

        // Determine published_at
        let published_at = if effective_status == ContentStatus::Published {
            Some(Utc::now())
        } else {
            None
        };

        // Insert into contents
        let content_id: Uuid = sqlx::query_scalar(
            r#"
            INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, publish_start, publish_end)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
            "#,
        )
        .bind(entity_type_id)
        .bind(environment_id)
        .bind(slug)
        .bind(&effective_status)
        .bind(published_at)
        .bind(publish_start)
        .bind(publish_end)
        .fetch_one(&mut *tx)
        .await?;

        // Insert content_sites associations
        for site_id in site_ids {
            sqlx::query("INSERT INTO content_sites (content_id, site_id) VALUES ($1, $2)")
                .bind(content_id)
                .bind(site_id)
                .execute(&mut *tx)
                .await?;
        }

        tx.commit().await?;

        Ok(content_id)
    }

    /// Update an existing content record (slug, status, scheduling).
    /// Auto-sets published_at when status becomes Published.
    /// Auto-sets status to Scheduled when publish_start is in the future.
    pub async fn update_content(
        pool: &PgPool,
        content_id: Uuid,
        slug: Option<&str>,
        status: Option<&ContentStatus>,
        publish_start: Option<DateTime<Utc>>,
        publish_end: Option<DateTime<Utc>>,
    ) -> Result<(), ApiError> {
        // Validate scheduling window
        if let (Some(start), Some(end)) = (publish_start, publish_end) {
            if end <= start {
                return Err(ApiError::BadRequest(
                    "publish_end must be after publish_start".to_string(),
                ));
            }
        }

        // Auto-status: if publish_start is future and status is Published, use Scheduled
        let effective_status = if let Some(start) = publish_start {
            if start > Utc::now() {
                let s = status.unwrap_or(&ContentStatus::Published);
                if *s == ContentStatus::Published {
                    Some(ContentStatus::Scheduled)
                } else {
                    status.cloned()
                }
            } else {
                status.cloned()
            }
        } else {
            status.cloned()
        };

        // If status is being set to Published, set published_at
        let set_published = effective_status
            .as_ref()
            .map(|s| *s == ContentStatus::Published)
            .unwrap_or(false);

        if set_published {
            sqlx::query(
                r#"
                UPDATE contents
                SET slug = COALESCE($2, slug),
                    status = COALESCE($3, status),
                    published_at = COALESCE(published_at, NOW()),
                    publish_start = $4,
                    publish_end = $5,
                    updated_at = NOW()
                WHERE id = $1 AND is_deleted = FALSE
                "#,
            )
            .bind(content_id)
            .bind(slug)
            .bind(&effective_status)
            .bind(publish_start)
            .bind(publish_end)
            .execute(pool)
            .await?;
        } else {
            sqlx::query(
                r#"
                UPDATE contents
                SET slug = COALESCE($2, slug),
                    status = COALESCE($3, status),
                    publish_start = $4,
                    publish_end = $5,
                    updated_at = NOW()
                WHERE id = $1 AND is_deleted = FALSE
                "#,
            )
            .bind(content_id)
            .bind(slug)
            .bind(&effective_status)
            .bind(publish_start)
            .bind(publish_end)
            .execute(pool)
            .await?;
        }

        Ok(())
    }

    /// Generate a unique slug for cloned content.
    /// Tries `"{base}-copy"`, then `"{base}-copy-2"` through `"{base}-copy-99"`.
    pub async fn generate_unique_slug(
        pool: &PgPool,
        base_slug: &str,
        site_ids: &[Uuid],
    ) -> Result<String, ApiError> {
        // Strip existing -copy[-N] suffix to get a clean base
        let clean_base = if let Some(idx) = base_slug.rfind("-copy") {
            &base_slug[..idx]
        } else {
            base_slug
        };

        let candidates: Vec<String> = std::iter::once(format!("{}-copy", clean_base))
            .chain((2..=99).map(|n| format!("{}-copy-{}", clean_base, n)))
            .collect();

        for candidate in &candidates {
            let exists: bool = sqlx::query_scalar(
                r#"
                SELECT EXISTS(
                    SELECT 1 FROM contents c
                    INNER JOIN content_sites cs ON c.id = cs.content_id
                    WHERE c.slug = $1 AND cs.site_id = ANY($2) AND c.is_deleted = FALSE
                )
                "#,
            )
            .bind(candidate)
            .bind(site_ids)
            .fetch_one(pool)
            .await?;

            if !exists {
                return Ok(candidate.clone());
            }
        }

        Err(ApiError::BadRequest(format!(
            "Could not generate unique slug for '{}' — too many copies",
            base_slug
        )))
    }

    /// Generate a unique route for cloned pages.
    /// Same logic as slug but checks the pages table.
    pub async fn generate_unique_route(
        pool: &PgPool,
        base_route: &str,
        site_ids: &[Uuid],
    ) -> Result<String, ApiError> {
        let clean_base = if let Some(idx) = base_route.rfind("-copy") {
            &base_route[..idx]
        } else {
            base_route
        };

        let candidates: Vec<String> = std::iter::once(format!("{}-copy", clean_base))
            .chain((2..=99).map(|n| format!("{}-copy-{}", clean_base, n)))
            .collect();

        for candidate in &candidates {
            let exists: bool = sqlx::query_scalar(
                r#"
                SELECT EXISTS(
                    SELECT 1 FROM pages p
                    INNER JOIN contents c ON p.content_id = c.id
                    INNER JOIN content_sites cs ON c.id = cs.content_id
                    WHERE p.route = $1 AND cs.site_id = ANY($2) AND c.is_deleted = FALSE
                )
                "#,
            )
            .bind(candidate)
            .bind(site_ids)
            .fetch_one(pool)
            .await?;

            if !exists {
                return Ok(candidate.clone());
            }
        }

        Err(ApiError::BadRequest(format!(
            "Could not generate unique route for '{}' — too many copies",
            base_route
        )))
    }

    /// Soft delete a content record.
    pub async fn soft_delete_content(pool: &PgPool, content_id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query(
            r#"
            UPDATE contents
            SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW()
            WHERE id = $1 AND is_deleted = FALSE
            "#,
        )
        .bind(content_id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!(
                "Content with ID {} not found",
                content_id
            )));
        }

        Ok(())
    }
}
