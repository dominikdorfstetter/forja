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
    pub theme: Option<serde_json::Value>,
    pub default_locale_id: Option<Uuid>,
    pub timezone: String,
    pub is_active: bool,
    pub is_deleted: bool,
    pub created_by: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Site {
    /// Find all active sites
    pub async fn find_all(pool: &PgPool) -> Result<Vec<Self>, ApiError> {
        let sites = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, name, slug, description, logo_url, favicon_url, theme,
                   default_locale_id, timezone, is_active, is_deleted, created_by, created_at, updated_at
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
            SELECT id, name, slug, description, logo_url, favicon_url, theme,
                   default_locale_id, timezone, is_active, is_deleted, created_by, created_at, updated_at
            FROM sites
            WHERE id = $1 AND is_deleted = FALSE
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found(format!("Site with ID {} not found", id)).with_code(codes::SITE_NOT_FOUND))?;

        Ok(site)
    }

    /// Find a site by slug
    pub async fn find_by_slug(pool: &PgPool, slug: &str) -> Result<Self, ApiError> {
        let site = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, name, slug, description, logo_url, favicon_url, theme,
                   default_locale_id, timezone, is_active, is_deleted, created_by, created_at, updated_at
            FROM sites
            WHERE slug = $1 AND is_deleted = FALSE
            "#,
        )
        .bind(slug)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found(format!("Site with slug '{}' not found", slug)).with_code(codes::SITE_NOT_FOUND))?;

        Ok(site)
    }

    /// Find a site by domain
    pub async fn find_by_domain(pool: &PgPool, domain: &str) -> Result<Self, ApiError> {
        let site = sqlx::query_as::<_, Self>(
            r#"
            SELECT s.id, s.name, s.slug, s.description, s.logo_url, s.favicon_url, s.theme,
                   s.default_locale_id, s.timezone, s.is_active, s.is_deleted, s.created_by, s.created_at, s.updated_at
            FROM sites s
            INNER JOIN site_domains sd ON s.id = sd.site_id
            WHERE sd.domain = $1 AND sd.is_active = TRUE AND s.is_deleted = FALSE
            "#,
        )
        .bind(domain)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found(format!("Site with domain '{}' not found", domain)).with_code(codes::SITE_NOT_FOUND))?;

        Ok(site)
    }

    /// Create a new site
    pub async fn create(
        pool: &PgPool,
        req: CreateSiteRequest,
        created_by: Option<&str>,
    ) -> Result<Self, ApiError> {
        let site = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO sites (name, slug, description, logo_url, favicon_url, theme, timezone, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, name, slug, description, logo_url, favicon_url, theme,
                      default_locale_id, timezone, is_active, is_deleted, created_by, created_at, updated_at
            "#,
        )
        .bind(&req.name)
        .bind(&req.slug)
        .bind(&req.description)
        .bind(&req.logo_url)
        .bind(&req.favicon_url)
        .bind(&req.theme)
        .bind(req.timezone.unwrap_or_else(|| "UTC".to_string()))
        .bind(created_by)
        .fetch_one(pool)
        .await?;

        Ok(site)
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
                theme = COALESCE($7, theme),
                timezone = COALESCE($8, timezone),
                is_active = COALESCE($9, is_active),
                updated_at = NOW()
            WHERE id = $1 AND is_deleted = FALSE
            RETURNING id, name, slug, description, logo_url, favicon_url, theme,
                      default_locale_id, timezone, is_active, is_deleted, created_by, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&req.name)
        .bind(&req.slug)
        .bind(&req.description)
        .bind(&req.logo_url)
        .bind(&req.favicon_url)
        .bind(&req.theme)
        .bind(&req.timezone)
        .bind(req.is_active)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found(format!("Site with ID {} not found", id)).with_code(codes::SITE_NOT_FOUND))?;

        Ok(site)
    }

    /// Resolve the primary production domain for a site.
    ///
    /// Tries: primary production domain → any active production domain → any active domain.
    /// Returns an error if no domain is configured at all, instead of silently
    /// falling back to "localhost" which would produce broken federation handles.
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
            ApiError::bad_request(
                "No domain configured for this site. Add a domain before enabling federation.",
            )
        })
    }

    /// Soft delete a site
    pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query(
            r#"
            UPDATE sites
            SET is_deleted = TRUE, updated_at = NOW()
            WHERE id = $1 AND is_deleted = FALSE
            "#,
        )
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(
                ApiError::not_found(format!("Site with ID {} not found", id))
                    .with_code(codes::SITE_NOT_FOUND),
            );
        }

        Ok(())
    }
}
