//! Page repositories: SQL for `Page`, `PageSection`, and `PageSectionLocalization`.
//!
//! Phase 2 of #520. The corresponding model methods are `#[deprecated]`
//! delegating wrappers (deleted in Phase 3 / #528).

use sqlx::{PgConnection, PgExecutor, PgPool};
use uuid::Uuid;

use crate::dto::page::{
    CreatePageRequest, CreatePageSectionRequest, UpdatePageRequest, UpdatePageSectionRequest,
};
use crate::errors::codes;
use crate::errors::ApiError;
use crate::models::content::ContentStatus;
use crate::models::page::{PageSection, PageSectionLocalization, PageWithContent};
use crate::repos::content_query::ContentQuery;
use crate::services::content_service::ContentService;

/// `PageWithContent` SELECT column list (entity = `p`, content spine = `c`),
/// hoisted to one place so the single-row reads don't re-spell it.
const PAGE_WITH_CONTENT_COLUMNS: &str = r#"
    p.id, p.content_id, p.route, p.page_type,
    p.template, p.is_in_navigation, p.navigation_order, p.parent_page_id,
    c.slug, c.status, c.published_at, c.publish_start, c.publish_end,
    p.created_at, p.updated_at
"#;

/// Columns the page list free-text search scans, aliased for `ContentQuery`
/// (entity table = `e`). Hard-coded — never user input.
const PAGE_SEARCH_COLUMNS: &[&str] = &["e.id::text", "e.route", "c.slug"];

fn normalize_page_type(api_value: &str) -> Option<&'static str> {
    match api_value {
        "Static" => Some("static"),
        "Landing" => Some("landing"),
        "Contact" => Some("contact"),
        "BlogIndex" => Some("blog_index"),
        "Custom" => Some("custom"),
        _ => None,
    }
}

/// Apply the shared page list filters (search, status, page_type,
/// exclude-status) onto a `ContentQuery`. Status values are normalized inside
/// `ContentQuery` at execute; `page_type` uses the entity-local
/// `normalize_page_type`. Shared by the list and count paths so both stay in
/// lock-step.
fn apply_page_filters(
    mut query: ContentQuery,
    search: Option<&str>,
    status: Option<&str>,
    page_type: Option<&str>,
    exclude_status: Option<&str>,
) -> ContentQuery {
    if let Some(s) = search {
        query = query.with_search(PAGE_SEARCH_COLUMNS, s);
    }
    if let Some(s) = status {
        query = query.with_status([s]);
    }
    if let Some(pt) = page_type {
        query = query.with_entity_filter_norm("e.page_type::text", pt, normalize_page_type);
    }
    if let Some(es) = exclude_status {
        query = query.exclude_status(es);
    }
    query
}

/// Repository for `Page` SQL queries.
pub struct PageRepo;

impl PageRepo {
    pub async fn find_published_for_site(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<PageWithContent>, ApiError> {
        let (rows, _) = ContentQuery::new("pages", site_id)
            .published_only()
            .order_by("e.route ASC")
            .paginate(limit, offset)
            .execute::<PageWithContent>(pool)
            .await?;
        Ok(rows)
    }

    pub async fn find_all_for_site(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<PageWithContent>, ApiError> {
        let (rows, _) = ContentQuery::new("pages", site_id)
            .order_by("e.route ASC")
            .paginate(limit, offset)
            .execute::<PageWithContent>(pool)
            .await?;
        Ok(rows)
    }

    /// Generic over the executor so create/update can build their return
    /// value on a `&mut *tx` mid-transaction (#863); normal callers pass
    /// `&PgPool`.
    pub async fn find_by_id<'e, E>(executor: E, id: Uuid) -> Result<PageWithContent, ApiError>
    where
        E: PgExecutor<'e>,
    {
        let sql = format!(
            r#"
            SELECT {}
            FROM pages p
            INNER JOIN contents c ON p.content_id = c.id
            WHERE p.id = $1 AND c.is_deleted = FALSE
            "#,
            PAGE_WITH_CONTENT_COLUMNS,
        );
        let page = sqlx::query_as::<_, PageWithContent>(sqlx::AssertSqlSafe(sql))
            .bind(id)
            .fetch_optional(executor)
            .await?
            .ok_or_else(|| {
                ApiError::not_found(format!("Page with ID {} not found", id))
                    .with_code(codes::ENTITY_NOT_FOUND)
                    .with_entity_type("page")
            })?;

        Ok(page)
    }

    pub async fn find_by_route(
        pool: &PgPool,
        site_id: Uuid,
        route: &str,
    ) -> Result<PageWithContent, ApiError> {
        let sql = format!(
            r#"
            SELECT {}
            FROM pages p
            INNER JOIN contents c ON p.content_id = c.id
            INNER JOIN content_sites cs ON c.id = cs.content_id
            WHERE cs.site_id = $1 AND p.route = $2 AND c.is_deleted = FALSE
            "#,
            PAGE_WITH_CONTENT_COLUMNS,
        );
        let page = sqlx::query_as::<_, PageWithContent>(sqlx::AssertSqlSafe(sql))
            .bind(site_id)
            .bind(route)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| {
                ApiError::not_found(format!("Page with route '{}' not found", route))
                    .with_code(codes::ENTITY_NOT_FOUND)
                    .with_entity_type("page")
            })?;

        Ok(page)
    }

    pub async fn count_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        ContentQuery::new("pages", site_id).count_only(pool).await
    }

    pub async fn status_counts_for_site(
        pool: &PgPool,
        site_id: Uuid,
    ) -> Result<(i64, i64, i64, i64, i64), ApiError> {
        let row: (i64, i64, i64, i64, i64) = sqlx::query_as(
            r#"
            SELECT
                COUNT(*) FILTER (WHERE c.status = 'draft'),
                COUNT(*) FILTER (WHERE c.status = 'in_review'),
                COUNT(*) FILTER (WHERE c.status = 'scheduled'),
                COUNT(*) FILTER (WHERE c.status = 'published'),
                COUNT(*) FILTER (WHERE c.status = 'archived')
            FROM pages p
            INNER JOIN contents c ON p.content_id = c.id
            INNER JOIN content_sites cs ON c.id = cs.content_id
            WHERE cs.site_id = $1 AND c.is_deleted = FALSE
            "#,
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;

        Ok(row)
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn find_all_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
        search: Option<&str>,
        status: Option<&str>,
        page_type: Option<&str>,
        sort_by: Option<&str>,
        sort_dir: Option<&str>,
        exclude_status: Option<&str>,
    ) -> Result<Vec<PageWithContent>, ApiError> {
        let order_col = match sort_by.unwrap_or("route") {
            "route" => "e.route",
            "slug" => "c.slug",
            "page_type" => "e.page_type",
            "status" => "c.status",
            "created_at" => "e.created_at",
            _ => "e.route",
        };

        let query = apply_page_filters(
            ContentQuery::new("pages", site_id)
                .order_by_dir(order_col, sort_dir)
                .paginate(limit, offset),
            search,
            status,
            page_type,
            exclude_status,
        );

        let (rows, _) = query.execute::<PageWithContent>(pool).await?;
        Ok(rows)
    }

    pub async fn count_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        search: Option<&str>,
        status: Option<&str>,
        page_type: Option<&str>,
        exclude_status: Option<&str>,
    ) -> Result<i64, ApiError> {
        apply_page_filters(
            ContentQuery::new("pages", site_id),
            search,
            status,
            page_type,
            exclude_status,
        )
        .count_only(pool)
        .await
    }

    /// Create a page + spine row atomically on the caller's tx connection (#863).
    pub async fn create(
        conn: &mut PgConnection,
        req: CreatePageRequest,
        created_by: Option<&str>,
    ) -> Result<PageWithContent, ApiError> {
        let slug = match req.slug {
            Some(ref s) if !s.is_empty() => s.clone(),
            _ => {
                let base = crate::utils::slugify::slugify(req.route.trim_start_matches('/'));
                crate::utils::slugify::generate_unique_slug(&mut *conn, &base, &req.site_ids)
                    .await?
            }
        };

        let content_id = ContentService::create_content(
            &mut *conn,
            "page",
            Some(&slug),
            &req.status,
            &req.site_ids,
            req.publish_start,
            req.publish_end,
            created_by,
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
        .execute(&mut *conn)
        .await?;

        let sql = format!(
            r#"
            SELECT {}
            FROM pages p
            INNER JOIN contents c ON p.content_id = c.id
            WHERE p.content_id = $1
            "#,
            PAGE_WITH_CONTENT_COLUMNS,
        );
        let page = sqlx::query_as::<_, PageWithContent>(sqlx::AssertSqlSafe(sql))
            .bind(content_id)
            .fetch_one(&mut *conn)
            .await?;

        Ok(page)
    }

    /// Update a page + spine row atomically on the caller's tx connection (#863).
    pub async fn update(
        conn: &mut PgConnection,
        id: Uuid,
        req: UpdatePageRequest,
    ) -> Result<PageWithContent, ApiError> {
        let existing = Self::find_by_id(&mut *conn, id).await?;

        ContentService::update_content(
            &mut *conn,
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
        .execute(&mut *conn)
        .await?;

        Self::find_by_id(&mut *conn, id).await
    }

    pub async fn clone_page(
        pool: &PgPool,
        source_id: Uuid,
        site_ids: Vec<Uuid>,
        created_by: Option<&str>,
    ) -> Result<PageWithContent, ApiError> {
        let source = Self::find_by_id(pool, source_id).await?;

        let base_slug = source.slug.as_deref().unwrap_or("untitled");
        let new_slug = ContentService::generate_unique_slug(pool, base_slug, &site_ids).await?;
        let new_route =
            ContentService::generate_unique_route(pool, &source.route, &site_ids).await?;

        // Clone is outside #863's create/update scope; preserve its prior
        // semantics (spine row atomic on its own) by committing the spine
        // insert in a short-lived tx before the entity insert.
        let content_id = {
            let mut tx = pool.begin().await?;
            let cid = ContentService::create_content(
                &mut tx,
                "page",
                Some(&new_slug),
                &ContentStatus::Draft,
                &site_ids,
                None,
                None,
                created_by,
            )
            .await?;
            tx.commit().await?;
            cid
        };

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

        let sql = format!(
            r#"
            SELECT {}
            FROM pages p
            INNER JOIN contents c ON p.content_id = c.id
            WHERE p.content_id = $1
            "#,
            PAGE_WITH_CONTENT_COLUMNS,
        );
        let new_page = sqlx::query_as::<_, PageWithContent>(sqlx::AssertSqlSafe(sql))
            .bind(content_id)
            .fetch_one(pool)
            .await?;

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

        let source_sections = PageSectionRepo::find_for_page(pool, source_id).await?;
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

            let section_locs =
                PageSectionLocalizationRepo::find_for_section(pool, section.id).await?;
            for sloc in &section_locs {
                PageSectionLocalizationRepo::upsert(
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

    pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let page = Self::find_by_id(pool, id).await?;
        ContentService::soft_delete_content(pool, page.content_id).await
    }
}

/// Repository for `PageSection` SQL queries.
pub struct PageSectionRepo;

impl PageSectionRepo {
    pub async fn find_for_page(pool: &PgPool, page_id: Uuid) -> Result<Vec<PageSection>, ApiError> {
        let sections = sqlx::query_as::<_, PageSection>(
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

    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<PageSection, ApiError> {
        let section = sqlx::query_as::<_, PageSection>(
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
        .ok_or_else(|| {
            ApiError::not_found(format!("Page section with ID {} not found", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("page_section")
        })?;

        Ok(section)
    }

    pub async fn create(
        pool: &PgPool,
        page_id: Uuid,
        req: CreatePageSectionRequest,
    ) -> Result<PageSection, ApiError> {
        let section = sqlx::query_as::<_, PageSection>(
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

    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdatePageSectionRequest,
    ) -> Result<PageSection, ApiError> {
        let section = sqlx::query_as::<_, PageSection>(
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
        .ok_or_else(|| {
            ApiError::not_found(format!("Page section with ID {} not found", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("page_section")
        })?;

        Ok(section)
    }

    pub async fn reorder_for_page(
        pool: &PgPool,
        page_id: Uuid,
        items: Vec<(Uuid, i16)>,
    ) -> Result<(), ApiError> {
        let mut tx = pool.begin().await?;

        for (id, display_order) in &items {
            let result = sqlx::query(
                "UPDATE page_sections SET display_order = $1, updated_at = NOW() WHERE id = $2 AND page_id = $3",
            )
            .bind(display_order)
            .bind(id)
            .bind(page_id)
            .execute(&mut *tx)
            .await?;

            if result.rows_affected() == 0 {
                return Err(ApiError::not_found(format!(
                    "Page section with ID {} not found for page {}",
                    id, page_id
                ))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("page_section"));
            }
        }

        tx.commit().await?;
        Ok(())
    }

    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM page_sections WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(
                ApiError::not_found(format!("Page section with ID {} not found", id))
                    .with_code(codes::ENTITY_NOT_FOUND)
                    .with_entity_type("page_section"),
            );
        }

        Ok(())
    }
}

/// Repository for `PageSectionLocalization` SQL queries.
pub struct PageSectionLocalizationRepo;

impl PageSectionLocalizationRepo {
    pub async fn find_for_section(
        pool: &PgPool,
        section_id: Uuid,
    ) -> Result<Vec<PageSectionLocalization>, ApiError> {
        let localizations = sqlx::query_as::<_, PageSectionLocalization>(
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

    pub async fn find_all_for_page(
        pool: &PgPool,
        page_id: Uuid,
    ) -> Result<Vec<PageSectionLocalization>, ApiError> {
        let localizations = sqlx::query_as::<_, PageSectionLocalization>(
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

    pub async fn upsert(
        pool: &PgPool,
        section_id: Uuid,
        locale_id: Uuid,
        title: Option<&str>,
        text: Option<&str>,
        button_text: Option<&str>,
    ) -> Result<PageSectionLocalization, ApiError> {
        let localization = sqlx::query_as::<_, PageSectionLocalization>(
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

    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<PageSectionLocalization, ApiError> {
        let localization = sqlx::query_as::<_, PageSectionLocalization>(
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
            ApiError::not_found(format!(
                "Page section localization with ID {} not found",
                id
            ))
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type("page_section")
        })?;

        Ok(localization)
    }

    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM page_section_localizations WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::not_found(format!(
                "Page section localization with ID {} not found",
                id
            ))
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type("page_section"));
        }

        Ok(())
    }
}
