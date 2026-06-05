//! Site model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::site::{CreateSiteRequest, UpdateSiteRequest};
use crate::errors::codes;
use crate::errors::ApiError;

/// Site (tenant/website) model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Site {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub favicon_url: Option<String>,
    pub base_url: Option<String>,
    pub theme: Option<serde_json::Value>,
    pub default_locale_id: Option<Uuid>,
    pub timezone: String,
    pub is_active: bool,
    pub is_deleted: bool,
    pub created_by: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// Set when the site is soft-deleted; cleared on restore. Drives the
    /// 30-day restore grace window and the purge worker.
    pub deleted_at: Option<DateTime<Utc>>,
}

impl Site {
    /// Find all active sites
    pub async fn find_all(pool: &PgPool) -> Result<Vec<Self>, ApiError> {
        let sites = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, name, slug, description, logo_url, favicon_url, base_url, theme,
                   default_locale_id, timezone, is_active, is_deleted, created_by, created_at, updated_at, deleted_at
            FROM sites
            WHERE is_deleted = FALSE
            ORDER BY name ASC
            "#,
        )
        .fetch_all(pool)
        .await?;

        Ok(sites)
    }

    /// Find a site by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let site = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, name, slug, description, logo_url, favicon_url, base_url, theme,
                   default_locale_id, timezone, is_active, is_deleted, created_by, created_at, updated_at, deleted_at
            FROM sites
            WHERE id = $1 AND is_deleted = FALSE
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found(format!("Site with ID {} not found", id)).with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("site"))?;

        Ok(site)
    }

    /// Find a site by slug
    pub async fn find_by_slug(pool: &PgPool, slug: &str) -> Result<Self, ApiError> {
        let site = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, name, slug, description, logo_url, favicon_url, base_url, theme,
                   default_locale_id, timezone, is_active, is_deleted, created_by, created_at, updated_at, deleted_at
            FROM sites
            WHERE slug = $1 AND is_deleted = FALSE
            "#,
        )
        .bind(slug)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found(format!("Site with slug '{}' not found", slug)).with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("site"))?;

        Ok(site)
    }

    /// Find a site by domain
    pub async fn find_by_domain(pool: &PgPool, domain: &str) -> Result<Self, ApiError> {
        let site = sqlx::query_as::<_, Self>(
            r#"
            SELECT s.id, s.name, s.slug, s.description, s.logo_url, s.favicon_url, s.base_url, s.theme,
                   s.default_locale_id, s.timezone, s.is_active, s.is_deleted, s.created_by, s.created_at, s.updated_at, s.deleted_at
            FROM sites s
            INNER JOIN site_domains sd ON s.id = sd.site_id
            WHERE sd.domain = $1 AND sd.is_active = TRUE AND s.is_deleted = FALSE
            "#,
        )
        .bind(domain)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found(format!("Site with domain '{}' not found", domain)).with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("site"))?;

        Ok(site)
    }

    /// Create a new site.
    ///
    /// If the requested slug collides with an existing one, append `-2`,
    /// `-3`, … until a free slot is found. Slugs are auto-derived from
    /// the site name on the client, so the user never has to disambiguate.
    pub async fn create(
        pool: &PgPool,
        req: CreateSiteRequest,
        created_by: Option<&str>,
    ) -> Result<Self, ApiError> {
        let timezone = req.timezone.clone().unwrap_or_else(|| "UTC".to_string());
        let base_slug = req.slug.clone();
        let mut candidate = base_slug.clone();
        let mut attempt: u32 = 1;

        loop {
            let result = sqlx::query_as::<_, Self>(
                r#"
                INSERT INTO sites (name, slug, description, logo_url, favicon_url, base_url, theme, timezone, created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id, name, slug, description, logo_url, favicon_url, base_url, theme,
                          default_locale_id, timezone, is_active, is_deleted, created_by, created_at, updated_at, deleted_at
                "#,
            )
            .bind(&req.name)
            .bind(&candidate)
            .bind(&req.description)
            .bind(&req.logo_url)
            .bind(&req.favicon_url)
            .bind(&req.base_url)
            .bind(&req.theme)
            .bind(&timezone)
            .bind(created_by)
            .fetch_one(pool)
            .await;

            match result {
                Ok(site) => return Ok(site),
                Err(sqlx::Error::Database(ref db_err))
                    if db_err.code().as_deref() == Some("23505") =>
                {
                    attempt += 1;
                    if attempt > 100 {
                        return Err(ApiError::conflict(format!(
                            "Could not generate a unique slug from '{}'",
                            base_slug
                        )));
                    }
                    candidate = format!("{}-{}", base_slug, attempt);
                }
                Err(e) => return Err(ApiError::from(e)),
            }
        }
    }

    /// Update a site
    pub async fn update(pool: &PgPool, id: Uuid, req: UpdateSiteRequest) -> Result<Self, ApiError> {
        let site = sqlx::query_as::<_, Self>(
            r#"
            UPDATE sites
            SET name = COALESCE($2, name),
                slug = COALESCE($3, slug),
                description = COALESCE($4, description),
                logo_url = COALESCE($5, logo_url),
                favicon_url = COALESCE($6, favicon_url),
                base_url = COALESCE($7, base_url),
                theme = COALESCE($8, theme),
                timezone = COALESCE($9, timezone),
                is_active = COALESCE($10, is_active),
                updated_at = NOW()
            WHERE id = $1 AND is_deleted = FALSE
            RETURNING id, name, slug, description, logo_url, favicon_url, base_url, theme,
                      default_locale_id, timezone, is_active, is_deleted, created_by, created_at, updated_at, deleted_at
            "#,
        )
        .bind(id)
        .bind(&req.name)
        .bind(&req.slug)
        .bind(&req.description)
        .bind(&req.logo_url)
        .bind(&req.favicon_url)
        .bind(&req.base_url)
        .bind(&req.theme)
        .bind(&req.timezone)
        .bind(req.is_active)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found(format!("Site with ID {} not found", id)).with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("site"))?;

        Ok(site)
    }

    /// Resolve the primary production domain for a site.
    ///
    /// Tries: primary production domain → any active production domain → any active domain.
    /// Returns an error if no domain is configured at all, instead of silently
    /// falling back to "localhost" which would produce broken URLs.
    pub async fn resolve_domain(pool: &PgPool, site_id: Uuid) -> Result<String, ApiError> {
        let domain: Option<String> = sqlx::query_scalar(
            r#"
            SELECT domain FROM site_domains
            WHERE site_id = $1 AND is_active = TRUE
            ORDER BY
                (is_primary = TRUE AND environment = 'production') DESC,
                (environment = 'production') DESC,
                is_primary DESC,
                created_at ASC
            LIMIT 1
            "#,
        )
        .bind(site_id)
        .fetch_optional(pool)
        .await?;

        domain.ok_or_else(|| {
            tracing::warn!(site_id = %site_id, "No domain configured for site");
            ApiError::bad_request("No domain configured for this site.")
        })
    }

    /// The site's *strict* primary production domain, if one is set.
    ///
    /// Unlike [`resolve_domain`], this does not fall back to other domains and
    /// returns `None` (rather than erroring) when no primary production domain
    /// exists — callers that build optional absolute URLs (e.g. the RSS feed)
    /// want an empty base URL in that case, not a hard failure.
    ///
    /// [`resolve_domain`]: Self::resolve_domain
    pub async fn primary_production_domain(
        pool: &PgPool,
        site_id: Uuid,
    ) -> Result<Option<String>, ApiError> {
        let domain: Option<String> = sqlx::query_scalar(
            "SELECT domain FROM site_domains \
             WHERE site_id = $1 AND is_primary = TRUE AND environment = 'production' LIMIT 1",
        )
        .bind(site_id)
        .fetch_optional(pool)
        .await?;
        Ok(domain)
    }

    /// Days a soft-deleted site can be restored before the purge worker
    /// hard-deletes it. Matches the shared trash retention window.
    pub const SOFT_DELETE_RETENTION_DAYS: i64 = 30;

    /// Soft delete a site, stamping `deleted_at` to start the grace window.
    pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query(
            r#"
            UPDATE sites
            SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW()
            WHERE id = $1 AND is_deleted = FALSE
            "#,
        )
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(
                ApiError::not_found(format!("Site with ID {} not found", id))
                    .with_code(codes::ENTITY_NOT_FOUND)
                    .with_entity_type("site"),
            );
        }

        Ok(())
    }

    /// Restore a soft-deleted site within the grace window.
    ///
    /// - 404 `ENTITY_NOT_FOUND` if no soft-deleted row exists (never
    ///   deleted, already restored, or already purged).
    /// - 410 `SITE_RESTORE_EXPIRED` if the {SOFT_DELETE_RETENTION_DAYS}-day
    ///   window has lapsed (the purge worker will hard-delete it).
    ///
    /// Rows soft-deleted before `deleted_at` existed (NULL stamp) are
    /// treated as restorable — we can't prove they're expired.
    pub async fn restore(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let not_found = || {
            ApiError::not_found(format!("Soft-deleted site with ID {} not found", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("site")
        };

        let deleted_at: Option<DateTime<Utc>> =
            sqlx::query_scalar("SELECT deleted_at FROM sites WHERE id = $1 AND is_deleted = TRUE")
                .bind(id)
                .fetch_optional(pool)
                .await?
                .ok_or_else(not_found)?;

        let cutoff = Utc::now() - chrono::TimeDelta::days(Self::SOFT_DELETE_RETENTION_DAYS);
        if let Some(ts) = deleted_at {
            if ts < cutoff {
                return Err(ApiError::gone(format!(
                    "Site {} can no longer be restored — the {}-day grace window has lapsed",
                    id,
                    Self::SOFT_DELETE_RETENTION_DAYS
                ))
                .with_code(codes::SITE_RESTORE_EXPIRED));
            }
        }

        let site = sqlx::query_as::<_, Self>(
            r#"
            UPDATE sites
            SET is_deleted = FALSE, deleted_at = NULL, updated_at = NOW()
            WHERE id = $1 AND is_deleted = TRUE
            RETURNING id, name, slug, description, logo_url, favicon_url, base_url, theme,
                      default_locale_id, timezone, is_active, is_deleted, created_by, created_at, updated_at, deleted_at
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(not_found)?;

        Ok(site)
    }

    /// Soft-deleted sites still inside the restore grace window, newest
    /// deletion first. Backs the deleted-sites restore UI (#713).
    ///
    /// Rows with a NULL `deleted_at` (soft-deleted before the stamp
    /// existed) are excluded — the UI needs the stamp to show a
    /// countdown; `restore` still accepts them directly.
    pub async fn find_deleted_within_grace(pool: &PgPool) -> Result<Vec<Self>, ApiError> {
        let cutoff = Utc::now() - chrono::TimeDelta::days(Self::SOFT_DELETE_RETENTION_DAYS);
        let sites = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, name, slug, description, logo_url, favicon_url, base_url, theme,
                   default_locale_id, timezone, is_active, is_deleted, created_by, created_at, updated_at, deleted_at
            FROM sites
            WHERE is_deleted = TRUE AND deleted_at IS NOT NULL AND deleted_at >= $1
            ORDER BY deleted_at DESC
            "#,
        )
        .bind(cutoff)
        .fetch_all(pool)
        .await?;

        Ok(sites)
    }

    /// Hard-delete soft-deleted sites whose grace window has lapsed,
    /// returning the purged ids (for audit).
    ///
    /// All site-scoped data — content, media, members, api keys, locales,
    /// audit logs — cascade-deletes via `ON DELETE CASCADE` foreign keys.
    /// The cascade is enforced by the schema, not re-implemented here.
    pub async fn purge_expired(pool: &PgPool) -> Result<Vec<Uuid>, ApiError> {
        let cutoff = Utc::now() - chrono::TimeDelta::days(Self::SOFT_DELETE_RETENTION_DAYS);
        let ids: Vec<(Uuid,)> = sqlx::query_as(
            r#"
            DELETE FROM sites
            WHERE is_deleted = TRUE AND deleted_at IS NOT NULL AND deleted_at < $1
            RETURNING id
            "#,
        )
        .bind(cutoff)
        .fetch_all(pool)
        .await?;

        Ok(ids.into_iter().map(|(id,)| id).collect())
    }
}
