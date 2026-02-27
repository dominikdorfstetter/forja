//! Page model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::page::{
    CreatePageRequest, CreatePageSectionRequest, UpdatePageRequest, UpdatePageSectionRequest,
};
use crate::errors::ApiError;
use crate::models::content::ContentStatus;
use crate::services::content_service::ContentService;

/// Page type enum matching PostgreSQL
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, utoipa::ToSchema)]
#[sqlx(type_name = "page_type", rename_all = "lowercase")]
#[derive(Default)]
pub enum PageType {
    #[default]
    Static,
    Landing,
    Contact,
    #[sqlx(rename = "blog_index")]
    BlogIndex,
    Custom,
}

/// Section type enum matching PostgreSQL
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, utoipa::ToSchema)]
#[sqlx(type_name = "section_type", rename_all = "lowercase")]
pub enum SectionType {
    Hero,
    Features,
    Cta,
    Gallery,
    Testimonials,
    Pricing,
    Faq,
    Contact,
    Custom,
}

/// Page model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Page {
    pub id: Uuid,
    pub content_id: Uuid,
    pub route: String,
    pub page_type: PageType,
    pub template: Option<String>,
    pub is_in_navigation: bool,
    pub navigation_order: Option<i16>,
    pub parent_page_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Page with content data
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PageWithContent {
    pub id: Uuid,
    pub content_id: Uuid,
    pub route: String,
    pub page_type: PageType,
    pub template: Option<String>,
    pub is_in_navigation: bool,
    pub navigation_order: Option<i16>,
    pub parent_page_id: Option<Uuid>,
    pub slug: Option<String>,
    pub status: ContentStatus,
    pub published_at: Option<DateTime<Utc>>,
    pub publish_start: Option<DateTime<Utc>>,
    pub publish_end: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Page section model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PageSection {
    pub id: Uuid,
    pub page_id: Uuid,
    pub section_type: SectionType,
    pub display_order: i16,
    pub cover_image_id: Option<Uuid>,
    pub call_to_action_route: Option<String>,
    pub settings: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Page {
    /// Find all pages for a site
    pub async fn find_all_for_site(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<PageWithContent>, ApiError> {
        let pages = sqlx::query_as::<_, PageWithContent>(
            r#"
            SELECT
                p.id, p.content_id, p.route, p.page_type,
                p.template, p.is_in_navigation, p.navigation_order, p.parent_page_id,
                c.slug, c.status, c.published_at, c.publish_start, c.publish_end,
                p.created_at, p.updated_at
            FROM pages p
            INNER JOIN contents c ON p.content_id = c.id
            INNER JOIN content_sites cs ON c.id = cs.content_id
            WHERE cs.site_id = $1 AND c.is_deleted = FALSE
            ORDER BY p.route ASC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(site_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok(pages)
    }

    /// Find page by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<PageWithContent, ApiError> {
        let page = sqlx::query_as::<_, PageWithContent>(
            r#"
            SELECT
                p.id, p.content_id, p.route, p.page_type,
                p.template, p.is_in_navigation, p.navigation_order, p.parent_page_id,
                c.slug, c.status, c.published_at, c.publish_start, c.publish_end,
                p.created_at, p.updated_at
            FROM pages p
            INNER JOIN contents c ON p.content_id = c.id
            WHERE p.id = $1 AND c.is_deleted = FALSE
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Page with ID {} not found", id)))?;

        Ok(page)
    }

    /// Find page by route within a site
    pub async fn find_by_route(
        pool: &PgPool,
        site_id: Uuid,
        route: &str,
    ) -> Result<PageWithContent, ApiError> {
        let page = sqlx::query_as::<_, PageWithContent>(
            r#"
            SELECT
                p.id, p.content_id, p.route, p.page_type,
                p.template, p.is_in_navigation, p.navigation_order, p.parent_page_id,
                c.slug, c.status, c.published_at, c.publish_start, c.publish_end,
                p.created_at, p.updated_at
            FROM pages p
            INNER JOIN contents c ON p.content_id = c.id
            INNER JOIN content_sites cs ON c.id = cs.content_id
            WHERE cs.site_id = $1 AND p.route = $2 AND c.is_deleted = FALSE
            "#,
        )
        .bind(site_id)
        .bind(route)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Page with route '{}' not found", route)))?;

        Ok(page)
    }

    /// Count pages for a site
    pub async fn count_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*)
            FROM pages p
            INNER JOIN contents c ON p.content_id = c.id
            INNER JOIN content_sites cs ON c.id = cs.content_id
            WHERE cs.site_id = $1 AND c.is_deleted = FALSE
            "#,
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;

        Ok(row.0)
    }

    /// Create a new page with associated content
    pub async fn create(
        pool: &PgPool,
        req: CreatePageRequest,
    ) -> Result<PageWithContent, ApiError> {
        let content_id = ContentService::create_content(
            pool,
            "page",
            Some(&req.slug),
            &req.status,
            &req.site_ids,
            req.publish_start,
            req.publish_end,
        )
        .await?;

        sqlx::query(
            r#"
            INSERT INTO pages (content_id, route, page_type, template,
                             is_in_navigation, navigation_order, parent_page_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
        )
        .bind(content_id)
        .bind(&req.route)
        .bind(&req.page_type)
        .bind(&req.template)
        .bind(req.is_in_navigation)
        .bind(req.navigation_order)
        .bind(req.parent_page_id)
        .execute(pool)
        .await?;

        let page = sqlx::query_as::<_, PageWithContent>(
            r#"
            SELECT
                p.id, p.content_id, p.route, p.page_type,
                p.template, p.is_in_navigation, p.navigation_order, p.parent_page_id,
                c.slug, c.status, c.published_at, c.publish_start, c.publish_end,
                p.created_at, p.updated_at
            FROM pages p
            INNER JOIN contents c ON p.content_id = c.id
            WHERE p.content_id = $1
            "#,
        )
        .bind(content_id)
        .fetch_one(pool)
        .await?;

        Ok(page)
    }

    /// Update a page
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdatePageRequest,
    ) -> Result<PageWithContent, ApiError> {
        let existing = Self::find_by_id(pool, id).await?;

        ContentService::update_content(
            pool,
            existing.content_id,
            req.slug.as_deref(),
            req.status.as_ref(),
            req.publish_start,
            req.publish_end,
        )
        .await?;

        sqlx::query(
            r#"
            UPDATE pages
            SET route = COALESCE($2, route),
                page_type = COALESCE($3, page_type),
                template = COALESCE($4, template),
                is_in_navigation = COALESCE($5, is_in_navigation),
                navigation_order = COALESCE($6, navigation_order),
                parent_page_id = COALESCE($7, parent_page_id),
                updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(&req.route)
        .bind(&req.page_type)
        .bind(&req.template)
        .bind(req.is_in_navigation)
        .bind(req.navigation_order)
        .bind(req.parent_page_id)
        .execute(pool)
        .await?;

        Self::find_by_id(pool, id).await
    }

    /// Clone a page: creates a new Draft page copying fields, localizations, sections, and section localizations.
    pub async fn clone_page(
        pool: &PgPool,
        source_id: Uuid,
        site_ids: Vec<Uuid>,
    ) -> Result<PageWithContent, ApiError> {
        let source = Self::find_by_id(pool, source_id).await?;

        let base_slug = source.slug.as_deref().unwrap_or("untitled");
        let new_slug = ContentService::generate_unique_slug(pool, base_slug, &site_ids).await?;
        let new_route =
            ContentService::generate_unique_route(pool, &source.route, &site_ids).await?;

        // Create content record as Draft, no scheduling
        let content_id = ContentService::create_content(
            pool,
            "page",
            Some(&new_slug),
            &ContentStatus::Draft,
            &site_ids,
            None,
            None,
        )
        .await?;

        // Insert page row copying fields from source
        sqlx::query(
            r#"
            INSERT INTO pages (content_id, route, page_type, template,
                             is_in_navigation, navigation_order, parent_page_id)
            VALUES ($1, $2, $3, $4, FALSE, $5, $6)
            "#,
        )
        .bind(content_id)
        .bind(&new_route)
        .bind(&source.page_type)
        .bind(&source.template)
        .bind(source.navigation_order)
        .bind(source.parent_page_id)
        .execute(pool)
        .await?;

        // Get the new page
        let new_page = sqlx::query_as::<_, PageWithContent>(
            r#"
            SELECT
                p.id, p.content_id, p.route, p.page_type,
                p.template, p.is_in_navigation, p.navigation_order, p.parent_page_id,
                c.slug, c.status, c.published_at, c.publish_start, c.publish_end,
                p.created_at, p.updated_at
            FROM pages p
            INNER JOIN contents c ON p.content_id = c.id
            WHERE p.content_id = $1
            "#,
        )
        .bind(content_id)
        .fetch_one(pool)
        .await?;

        // Copy content localizations
        let localizations = crate::models::content::ContentLocalization::find_all_for_content(
            pool,
            source.content_id,
        )
        .await?;
        for loc in &localizations {
            crate::models::content::ContentLocalization::create(
                pool,
                content_id,
                loc.locale_id,
                &loc.title,
                loc.subtitle.as_deref(),
                loc.excerpt.as_deref(),
                loc.body.as_deref(),
                loc.meta_title.as_deref(),
                loc.meta_description.as_deref(),
            )
            .await?;
        }

        // Copy page sections and their localizations
        let source_sections = PageSection::find_for_page(pool, source_id).await?;
        for section in &source_sections {
            let new_section = sqlx::query_as::<_, PageSection>(
                r#"
                INSERT INTO page_sections (page_id, section_type, display_order,
                                          cover_image_id, call_to_action_route, settings)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, page_id, section_type, display_order, cover_image_id,
                          call_to_action_route, settings, created_at, updated_at
                "#,
            )
            .bind(new_page.id)
            .bind(&section.section_type)
            .bind(section.display_order)
            .bind(section.cover_image_id)
            .bind(&section.call_to_action_route)
            .bind(&section.settings)
            .fetch_one(pool)
            .await?;

            // Copy section localizations
            let section_locs = PageSectionLocalization::find_for_section(pool, section.id).await?;
            for sloc in &section_locs {
                PageSectionLocalization::upsert(
                    pool,
                    new_section.id,
                    sloc.locale_id,
                    sloc.title.as_deref(),
                    sloc.text.as_deref(),
                    sloc.button_text.as_deref(),
                )
                .await?;
            }
        }

        Ok(new_page)
    }

    /// Soft delete a page (via content)
    pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let page = Self::find_by_id(pool, id).await?;
        ContentService::soft_delete_content(pool, page.content_id).await
    }
}

impl PageSection {
    /// Find sections for a page
    pub async fn find_for_page(pool: &PgPool, page_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let sections = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, page_id, section_type, display_order, cover_image_id,
                   call_to_action_route, settings, created_at, updated_at
            FROM page_sections
            WHERE page_id = $1
            ORDER BY display_order ASC
            "#,
        )
        .bind(page_id)
        .fetch_all(pool)
        .await?;

        Ok(sections)
    }

    /// Find section by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let section = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, page_id, section_type, display_order, cover_image_id,
                   call_to_action_route, settings, created_at, updated_at
            FROM page_sections
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Page section with ID {} not found", id)))?;

        Ok(section)
    }

    /// Create a new page section
    pub async fn create(
        pool: &PgPool,
        page_id: Uuid,
        req: CreatePageSectionRequest,
    ) -> Result<Self, ApiError> {
        let section = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO page_sections (page_id, section_type, display_order,
                                      cover_image_id, call_to_action_route, settings)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, page_id, section_type, display_order, cover_image_id,
                      call_to_action_route, settings, created_at, updated_at
            "#,
        )
        .bind(page_id)
        .bind(&req.section_type)
        .bind(req.display_order)
        .bind(req.cover_image_id)
        .bind(&req.call_to_action_route)
        .bind(&req.settings)
        .fetch_one(pool)
        .await?;

        Ok(section)
    }

    /// Update a page section
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdatePageSectionRequest,
    ) -> Result<Self, ApiError> {
        let section = sqlx::query_as::<_, Self>(
            r#"
            UPDATE page_sections
            SET section_type = COALESCE($2, section_type),
                display_order = COALESCE($3, display_order),
                cover_image_id = COALESCE($4, cover_image_id),
                call_to_action_route = COALESCE($5, call_to_action_route),
                settings = COALESCE($6, settings),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, page_id, section_type, display_order, cover_image_id,
                      call_to_action_route, settings, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&req.section_type)
        .bind(req.display_order)
        .bind(req.cover_image_id)
        .bind(&req.call_to_action_route)
        .bind(&req.settings)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Page section with ID {} not found", id)))?;

        Ok(section)
    }

    /// Delete a page section (hard delete)
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM page_sections WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!(
                "Page section with ID {} not found",
                id
            )));
        }

        Ok(())
    }
}

/// Page section localization model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PageSectionLocalization {
    pub id: Uuid,
    pub page_section_id: Uuid,
    pub locale_id: Uuid,
    pub title: Option<String>,
    pub text: Option<String>,
    pub button_text: Option<String>,
}

impl PageSectionLocalization {
    /// Find all localizations for a section
    pub async fn find_for_section(pool: &PgPool, section_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let localizations = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, page_section_id, locale_id, title, text, button_text
            FROM page_section_localizations
            WHERE page_section_id = $1
            "#,
        )
        .bind(section_id)
        .fetch_all(pool)
        .await?;

        Ok(localizations)
    }

    /// Find all section localizations for a page (via JOIN on page_sections)
    pub async fn find_all_for_page(pool: &PgPool, page_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let localizations = sqlx::query_as::<_, Self>(
            r#"
            SELECT psl.id, psl.page_section_id, psl.locale_id, psl.title, psl.text, psl.button_text
            FROM page_section_localizations psl
            INNER JOIN page_sections ps ON psl.page_section_id = ps.id
            WHERE ps.page_id = $1
            "#,
        )
        .bind(page_id)
        .fetch_all(pool)
        .await?;

        Ok(localizations)
    }

    /// Upsert a section localization (INSERT ON CONFLICT UPDATE)
    pub async fn upsert(
        pool: &PgPool,
        section_id: Uuid,
        locale_id: Uuid,
        title: Option<&str>,
        text: Option<&str>,
        button_text: Option<&str>,
    ) -> Result<Self, ApiError> {
        let localization = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO page_section_localizations (page_section_id, locale_id, title, text, button_text)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (page_section_id, locale_id)
            DO UPDATE SET title = $3, text = $4, button_text = $5
            RETURNING id, page_section_id, locale_id, title, text, button_text
            "#,
        )
        .bind(section_id)
        .bind(locale_id)
        .bind(title)
        .bind(text)
        .bind(button_text)
        .fetch_one(pool)
        .await?;

        Ok(localization)
    }

    /// Find a localization by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let localization = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, page_section_id, locale_id, title, text, button_text
            FROM page_section_localizations
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::NotFound(format!(
                "Page section localization with ID {} not found",
                id
            ))
        })?;

        Ok(localization)
    }

    /// Delete a localization (hard delete)
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM page_section_localizations WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!(
                "Page section localization with ID {} not found",
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
    fn test_page_type_serialization() {
        let page_type = PageType::Landing;
        let json = serde_json::to_string(&page_type).unwrap();
        assert_eq!(json, "\"Landing\"");
    }

    #[test]
    fn test_section_type_serialization() {
        let section_type = SectionType::Hero;
        let json = serde_json::to_string(&section_type).unwrap();
        assert_eq!(json, "\"Hero\"");
    }
}
