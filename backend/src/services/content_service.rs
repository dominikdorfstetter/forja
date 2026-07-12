//! Content service — shared logic for content-based entities (Blog, Page, Legal, CV)

use chrono::{DateTime, Utc};
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

use crate::errors::ApiError;
use crate::errors::codes;
use crate::models::content::ContentStatus;

pub struct ContentService;

/// Check whether a content status transition is structurally valid.
/// This is independent of roles or workflow settings — it enforces
/// the immutable state machine (e.g. Draft cannot jump to Archived).
pub fn is_valid_status_transition(from: &ContentStatus, to: &ContentStatus) -> bool {
    matches!(
        (from, to),
        (ContentStatus::Draft, ContentStatus::InReview)
            | (ContentStatus::Draft, ContentStatus::Published)
            | (ContentStatus::Draft, ContentStatus::Scheduled)
            | (ContentStatus::InReview, ContentStatus::Draft)
            | (ContentStatus::InReview, ContentStatus::Published)
            | (ContentStatus::InReview, ContentStatus::Scheduled)
            | (ContentStatus::Published, ContentStatus::Draft)
            | (ContentStatus::Published, ContentStatus::Archived)
            | (ContentStatus::Scheduled, ContentStatus::Draft)
            | (ContentStatus::Scheduled, ContentStatus::Published)
            | (ContentStatus::Scheduled, ContentStatus::Archived)
            | (ContentStatus::Archived, ContentStatus::Published)
            | (ContentStatus::Archived, ContentStatus::Draft)
    )
}

impl ContentService {
    /// Create a new content record with site associations.
    ///
    /// Runs on a caller-supplied connection (`&mut PgConnection`) so the
    /// spine `contents` row and the caller's entity row share **one**
    /// transaction — the caller opens the `tx`, threads `&mut *tx` here and
    /// into its entity INSERT, then commits once. A failed entity INSERT
    /// rolls the spine row back, closing the orphaned-`contents`-row hole.
    /// Returns the content_id.
    #[allow(clippy::too_many_arguments)]
    pub async fn create_content(
        conn: &mut PgConnection,
        entity_type_name: &str,
        slug: Option<&str>,
        status: &ContentStatus,
        site_ids: &[Uuid],
        publish_start: Option<DateTime<Utc>>,
        publish_end: Option<DateTime<Utc>>,
        created_by: Option<&str>,
    ) -> Result<Uuid, ApiError> {
        // Validate scheduling window
        if let (Some(start), Some(end)) = (publish_start, publish_end)
            && end <= start
        {
            return Err(
                ApiError::bad_request("publish_end must be after publish_start")
                    .with_code(codes::CONTENT_PUBLISH_DATE_INVALID),
            );
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

        // Look up entity_type_id
        let entity_type_id: Uuid =
            sqlx::query_scalar("SELECT id FROM entity_types WHERE name = $1")
                .bind(entity_type_name)
                .fetch_optional(&mut *conn)
                .await?
                .ok_or_else(|| {
                    ApiError::bad_request(format!("Unknown entity type: {}", entity_type_name))
                        .with_code(codes::CONTENT_UNKNOWN_ENTITY_TYPE)
                })?;

        // Get default environment
        let environment_id: Uuid =
            sqlx::query_scalar("SELECT id FROM environments WHERE is_default = TRUE LIMIT 1")
                .fetch_optional(&mut *conn)
                .await?
                .ok_or_else(|| {
                    ApiError::bad_request("No default environment configured")
                        .with_code(codes::CONTENT_NO_DEFAULT_ENVIRONMENT)
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
            INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, publish_start, publish_end, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
        .bind(created_by)
        .fetch_one(&mut *conn)
        .await?;

        // Insert content_sites associations
        for site_id in site_ids {
            sqlx::query("INSERT INTO content_sites (content_id, site_id) VALUES ($1, $2)")
                .bind(content_id)
                .bind(site_id)
                .execute(&mut *conn)
                .await?;
        }

        Ok(content_id)
    }

    /// Update an existing content record (slug, status, scheduling).
    /// Auto-sets published_at when status becomes Published.
    /// Auto-sets status to Scheduled when publish_start is in the future.
    /// Validates status transitions against the content state machine.
    pub async fn update_content(
        conn: &mut PgConnection,
        content_id: Uuid,
        slug: Option<&str>,
        status: Option<&ContentStatus>,
        publish_start: Option<DateTime<Utc>>,
        publish_end: Option<DateTime<Utc>>,
    ) -> Result<(), ApiError> {
        // Validate scheduling window
        if let (Some(start), Some(end)) = (publish_start, publish_end)
            && end <= start
        {
            return Err(
                ApiError::bad_request("publish_end must be after publish_start")
                    .with_code(codes::CONTENT_PUBLISH_DATE_INVALID),
            );
        }

        // Validate status transition against the state machine
        if let Some(requested) = status {
            let current: ContentStatus = sqlx::query_scalar(
                "SELECT status FROM contents WHERE id = $1 AND is_deleted = FALSE",
            )
            .bind(content_id)
            .fetch_one(&mut *conn)
            .await?;

            if &current != requested && !is_valid_status_transition(&current, requested) {
                return Err(ApiError::bad_request(format!(
                    "Invalid status transition from {:?} to {:?}",
                    current, requested
                ))
                .with_code(codes::CONTENT_INVALID_STATUS));
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
            .execute(&mut *conn)
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
            .execute(&mut *conn)
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

        Err(ApiError::bad_request(format!(
            "Could not generate unique slug for '{}' — too many copies",
            base_slug
        ))
        .with_code(codes::CONTENT_SLUG_GENERATION_FAILED))
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

        Err(ApiError::bad_request(format!(
            "Could not generate unique route for '{}' — too many copies",
            base_route
        ))
        .with_code(codes::CONTENT_ROUTE_GENERATION_FAILED))
    }

    /// Restore a soft-deleted content record.
    pub async fn restore_content(pool: &PgPool, content_id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query(
            r#"
            UPDATE contents
            SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL, updated_at = NOW()
            WHERE id = $1 AND is_deleted = TRUE
            "#,
        )
        .bind(content_id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(
                ApiError::bad_request(format!("Content {} is not in trash", content_id))
                    .with_code(codes::TRASH_ALREADY_RESTORED),
            );
        }

        Ok(())
    }

    /// Permanently delete a soft-deleted content record and all related data.
    pub async fn permanent_delete_content(pool: &PgPool, content_id: Uuid) -> Result<(), ApiError> {
        // Verify it's actually soft-deleted first
        let row: Option<(bool,)> = sqlx::query_as("SELECT is_deleted FROM contents WHERE id = $1")
            .bind(content_id)
            .fetch_optional(pool)
            .await?;

        match row {
            None => {
                return Err(
                    ApiError::not_found(format!("Content {} not found", content_id))
                        .with_code(codes::ENTITY_NOT_FOUND)
                        .with_entity_type("content"),
                );
            }
            Some((false,)) => {
                return Err(ApiError::bad_request(format!(
                    "Content {} is not in trash",
                    content_id
                ))
                .with_code(codes::TRASH_NOT_DELETED));
            }
            Some((true,)) => {}
        }

        // Hard delete: cascade handles most relations, but clean up junction tables first
        sqlx::query("DELETE FROM content_sites WHERE content_id = $1")
            .bind(content_id)
            .execute(pool)
            .await?;
        sqlx::query("DELETE FROM content_localizations WHERE content_id = $1")
            .bind(content_id)
            .execute(pool)
            .await?;
        sqlx::query("DELETE FROM contents WHERE id = $1")
            .bind(content_id)
            .execute(pool)
            .await?;

        Ok(())
    }

    /// Purge all soft-deleted content older than `retention_days`.
    /// Returns the number of items purged.
    pub async fn purge_expired_trash(pool: &PgPool, retention_days: i64) -> Result<u64, ApiError> {
        let cutoff = chrono::Utc::now() - chrono::Duration::days(retention_days);

        let expired_ids: Vec<(Uuid,)> = sqlx::query_as(
            r#"
            SELECT id FROM contents
            WHERE is_deleted = TRUE AND deleted_at IS NOT NULL AND deleted_at < $1
            "#,
        )
        .bind(cutoff)
        .fetch_all(pool)
        .await?;

        let count = expired_ids.len() as u64;
        for (id,) in expired_ids {
            if let Err(e) = Self::permanent_delete_content(pool, id).await {
                tracing::warn!(content_id = %id, error = %e, "Failed to purge expired trash item");
            }
        }

        Ok(count)
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
            return Err(
                ApiError::not_found(format!("Content with ID {} not found", content_id))
                    .with_code(codes::ENTITY_NOT_FOUND)
                    .with_entity_type("content"),
            );
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_transitions_accepted() {
        let valid = vec![
            (ContentStatus::Draft, ContentStatus::InReview),
            (ContentStatus::Draft, ContentStatus::Published),
            (ContentStatus::Draft, ContentStatus::Scheduled),
            (ContentStatus::InReview, ContentStatus::Draft),
            (ContentStatus::InReview, ContentStatus::Published),
            (ContentStatus::InReview, ContentStatus::Scheduled),
            (ContentStatus::Published, ContentStatus::Draft),
            (ContentStatus::Published, ContentStatus::Archived),
            (ContentStatus::Scheduled, ContentStatus::Draft),
            (ContentStatus::Scheduled, ContentStatus::Published),
            (ContentStatus::Scheduled, ContentStatus::Archived),
            (ContentStatus::Archived, ContentStatus::Published),
            (ContentStatus::Archived, ContentStatus::Draft),
        ];
        for (from, to) in valid {
            assert!(
                is_valid_status_transition(&from, &to),
                "{:?} -> {:?} should be valid",
                from,
                to
            );
        }
    }

    #[test]
    fn blocked_transitions_rejected() {
        let blocked = vec![
            (ContentStatus::Draft, ContentStatus::Archived),
            (ContentStatus::InReview, ContentStatus::Archived),
            (ContentStatus::Archived, ContentStatus::InReview),
            (ContentStatus::Archived, ContentStatus::Scheduled),
            (ContentStatus::Published, ContentStatus::InReview),
            (ContentStatus::Published, ContentStatus::Scheduled),
            (ContentStatus::Scheduled, ContentStatus::InReview),
        ];
        for (from, to) in blocked {
            assert!(
                !is_valid_status_transition(&from, &to),
                "{:?} -> {:?} should be blocked",
                from,
                to
            );
        }
    }
}
