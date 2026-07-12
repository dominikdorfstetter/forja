//! Blog repository: all SQL queries for blog content entities.
//!
//! Phase 2 of #520. Owns the SQL that previously lived in
//! `models::blog::Blog`. The corresponding `Blog::*` methods are
//! `#[deprecated]` delegating wrappers that will be removed in Phase 3 (#528).

use sqlx::{PgConnection, PgExecutor, PgPool};
use uuid::Uuid;

use crate::dto::blog::{CreateBlogRequest, UpdateBlogRequest};
use crate::errors::ApiError;
use crate::errors::codes;
use crate::models::blog::BlogWithContent;
use crate::models::content::{ContentLocalization, ContentStatus};
use crate::repos::content_query::ContentQuery;
use crate::services::content_service::ContentService;

/// Columns the blog list free-text search scans, aliased for `ContentQuery`
/// (entity table = `e`, content spine = `c`). Hard-coded — never user input.
const BLOG_SEARCH_COLUMNS: &[&str] = &["e.id::text", "c.slug", "e.author"];

/// Map the API `sort_by` value to a safe, hard-coded `ORDER BY` column,
/// aliased for `ContentQuery`. Unknown columns fall back to publish date.
fn blog_sort_column(sort_by: Option<&str>) -> &'static str {
    match sort_by.unwrap_or("published_date") {
        "slug" => "c.slug",
        "author" => "e.author",
        "status" => "c.status",
        "published_date" => "e.published_date",
        "created_at" => "e.created_at",
        _ => "e.published_date",
    }
}

/// Apply the shared blog list filters (search, status, exclude-status) onto a
/// `ContentQuery`. Status values arrive as the API value and are normalized
/// inside `ContentQuery` at execute time. Shared by the list and count paths so
/// both stay in lock-step.
fn apply_blog_filters(
    mut query: ContentQuery,
    search: Option<&str>,
    status: Option<&str>,
    exclude_status: Option<&str>,
) -> ContentQuery {
    if let Some(s) = search {
        query = query.with_search(BLOG_SEARCH_COLUMNS, s);
    }
    if let Some(s) = status {
        query = query.with_status([s]);
    }
    if let Some(s) = exclude_status {
        query = query.exclude_status(s);
    }
    query
}

/// A single seed blog post loaded from a JSON resource file.
#[derive(serde::Deserialize)]
struct SeedPost {
    slug: String,
    title: String,
    excerpt: Option<String>,
    body: Option<String>,
}

/// Loads localized sample content from JSON resource files embedded at compile time.
fn load_seed_content(locale_code: &str) -> Vec<SeedPost> {
    let base = locale_code.split('-').next().unwrap_or(locale_code);

    let json = match base {
        "de" => include_str!("../../resources/seed-content/de.json"),
        "es" => include_str!("../../resources/seed-content/es.json"),
        "fr" => include_str!("../../resources/seed-content/fr.json"),
        "it" => include_str!("../../resources/seed-content/it.json"),
        "nl" => include_str!("../../resources/seed-content/nl.json"),
        "pl" => include_str!("../../resources/seed-content/pl.json"),
        "pt" => include_str!("../../resources/seed-content/pt.json"),
        _ => include_str!("../../resources/seed-content/en.json"),
    };

    serde_json::from_str(json).expect("invalid seed content JSON")
}

/// Repository for blog SQL queries.
pub struct BlogRepo;

impl BlogRepo {
    /// Find all blogs for a site
    pub async fn find_all_for_site(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<BlogWithContent>, ApiError> {
        let (rows, _) = ContentQuery::new("blogs", site_id)
            .paginate(limit, offset)
            .execute::<BlogWithContent>(pool)
            .await?;
        Ok(rows)
    }

    /// Find published blogs for a site
    pub async fn find_published_for_site(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<BlogWithContent>, ApiError> {
        let (rows, _) = ContentQuery::new("blogs", site_id)
            .published_only()
            .paginate(limit, offset)
            .execute::<BlogWithContent>(pool)
            .await?;
        Ok(rows)
    }

    /// Find published blogs for a site, filtered to those with a localization in the given locale
    pub async fn find_published_for_site_by_locale(
        pool: &PgPool,
        site_id: Uuid,
        locale_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<BlogWithContent>, ApiError> {
        let (rows, _) = ContentQuery::new("blogs", site_id)
            .with_locale(locale_id)
            .published_only()
            .paginate(limit, offset)
            .execute::<BlogWithContent>(pool)
            .await?;
        Ok(rows)
    }

    /// Count published blogs for a site, filtered to those with a localization in the given locale.
    pub async fn count_published_for_site_by_locale(
        pool: &PgPool,
        site_id: Uuid,
        locale_id: Uuid,
    ) -> Result<i64, ApiError> {
        let (_, total) = ContentQuery::new("blogs", site_id)
            .with_locale(locale_id)
            .published_only()
            .paginate(0, 0)
            .execute::<BlogWithContent>(pool)
            .await?;
        Ok(total)
    }

    /// Find published blogs for a site filtered by category, with locale filter.
    /// Built on `ContentQuery` (Phase 1 of #520).
    pub async fn find_published_for_site_by_category_and_locale(
        pool: &PgPool,
        site_id: Uuid,
        category_slug: &str,
        locale_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<BlogWithContent>, ApiError> {
        let (rows, _) = ContentQuery::new("blogs", site_id)
            .with_category(category_slug)
            .with_locale(locale_id)
            .published_only()
            .paginate(limit, offset)
            .execute::<BlogWithContent>(pool)
            .await?;
        Ok(rows)
    }

    /// Count published blogs for a site filtered by category, with locale filter.
    /// Built on `ContentQuery` (Phase 1 of #520).
    pub async fn count_published_for_site_by_category_and_locale(
        pool: &PgPool,
        site_id: Uuid,
        category_slug: &str,
        locale_id: Uuid,
    ) -> Result<i64, ApiError> {
        let (_, total) = ContentQuery::new("blogs", site_id)
            .with_category(category_slug)
            .with_locale(locale_id)
            .published_only()
            .paginate(0, 0)
            .execute::<BlogWithContent>(pool)
            .await?;
        Ok(total)
    }

    /// Find blog by ID
    /// Generic over the executor so it can read on a `&PgPool` (normal) or
    /// on a `&mut *tx` mid-transaction (to build the return value of an
    /// uncommitted create/update — #863).
    pub async fn find_by_id<'e, E>(executor: E, id: Uuid) -> Result<BlogWithContent, ApiError>
    where
        E: PgExecutor<'e>,
    {
        let blog = sqlx::query_as::<_, BlogWithContent>(
            r#"
            SELECT
                b.id, b.content_id, b.author, b.published_date,
                b.reading_time_minutes, b.cover_image_id, b.header_image_id, b.is_featured, b.allow_comments, b.is_sample,
                c.slug, c.status, c.published_at, c.publish_start, c.publish_end,
                b.created_at, b.updated_at
            FROM blogs b
            INNER JOIN contents c ON b.content_id = c.id
            WHERE b.id = $1 AND c.is_deleted = FALSE
            "#,
        )
        .bind(id)
        .fetch_optional(executor)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Blog with ID {} not found", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("blog")
        })?;

        Ok(blog)
    }

    /// Find blog by slug within a site
    pub async fn find_by_slug(
        pool: &PgPool,
        site_id: Uuid,
        slug: &str,
    ) -> Result<BlogWithContent, ApiError> {
        let blog = sqlx::query_as::<_, BlogWithContent>(
            r#"
            SELECT
                b.id, b.content_id, b.author, b.published_date,
                b.reading_time_minutes, b.cover_image_id, b.header_image_id, b.is_featured, b.allow_comments, b.is_sample,
                c.slug, c.status, c.published_at, c.publish_start, c.publish_end,
                b.created_at, b.updated_at
            FROM blogs b
            INNER JOIN contents c ON b.content_id = c.id
            INNER JOIN content_sites cs ON c.id = cs.content_id
            WHERE cs.site_id = $1 AND c.slug = $2 AND c.is_deleted = FALSE
            "#,
        )
        .bind(site_id)
        .bind(slug)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Blog with slug '{}' not found", slug))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("blog")
        })?;

        Ok(blog)
    }

    /// Find featured blogs for a site
    pub async fn find_featured_for_site(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
    ) -> Result<Vec<BlogWithContent>, ApiError> {
        let blogs = sqlx::query_as::<_, BlogWithContent>(
            r#"
            SELECT
                b.id, b.content_id, b.author, b.published_date,
                b.reading_time_minutes, b.cover_image_id, b.header_image_id, b.is_featured, b.allow_comments, b.is_sample,
                c.slug, c.status, c.published_at, c.publish_start, c.publish_end,
                b.created_at, b.updated_at
            FROM blogs b
            INNER JOIN contents c ON b.content_id = c.id
            INNER JOIN content_sites cs ON c.id = cs.content_id
            WHERE cs.site_id = $1
              AND c.is_deleted = FALSE
              AND c.status IN ('published', 'scheduled')
              AND b.is_featured = TRUE
              AND (c.publish_start IS NULL OR c.publish_start <= NOW())
              AND (c.publish_end IS NULL OR c.publish_end > NOW())
            ORDER BY b.published_date DESC
            LIMIT $2
            "#,
        )
        .bind(site_id)
        .bind(limit)
        .fetch_all(pool)
        .await?;

        Ok(blogs)
    }

    /// Find similar blogs based on taxonomy overlap and author
    pub async fn find_similar(
        pool: &PgPool,
        blog_id: Uuid,
        site_id: Uuid,
        limit: i64,
    ) -> Result<Vec<BlogWithContent>, ApiError> {
        let blogs = sqlx::query_as::<_, BlogWithContent>(
            r#"
            WITH source AS (
                SELECT b.id, b.content_id, b.author
                FROM blogs b
                INNER JOIN contents c ON b.content_id = c.id
                WHERE b.id = $1 AND c.is_deleted = FALSE
            ),
            source_tags AS (
                SELECT ct.tag_id
                FROM content_tags ct
                INNER JOIN source s ON ct.content_id = s.content_id
            ),
            source_categories AS (
                SELECT cc.category_id, cc.is_primary
                FROM content_categories cc
                INNER JOIN source s ON cc.content_id = s.content_id
            ),
            candidates AS (
                SELECT
                    b.id, b.content_id, b.author, b.published_date,
                    b.reading_time_minutes, b.cover_image_id, b.header_image_id,
                    b.is_featured, b.allow_comments, b.is_sample,
                    c.slug, c.status, c.published_at, c.publish_start, c.publish_end,
                    b.created_at, b.updated_at
                FROM blogs b
                INNER JOIN contents c ON b.content_id = c.id
                INNER JOIN content_sites cs ON c.id = cs.content_id
                WHERE cs.site_id = $2
                  AND b.id != $1
                  AND c.is_deleted = FALSE
                  AND c.status IN ('published', 'scheduled')
                  AND (c.publish_start IS NULL OR c.publish_start <= NOW())
                  AND (c.publish_end IS NULL OR c.publish_end > NOW())
            ),
            scores AS (
                SELECT
                    cand.*,
                    COALESCE((
                        SELECT COUNT(*) * 3
                        FROM content_tags ct
                        INNER JOIN source_tags st ON ct.tag_id = st.tag_id
                        WHERE ct.content_id = cand.content_id
                    ), 0)
                    + COALESCE((
                        SELECT COUNT(*) * 2
                        FROM content_categories cc
                        INNER JOIN source_categories sc ON cc.category_id = sc.category_id
                        WHERE cc.content_id = cand.content_id
                    ), 0)
                    + COALESCE((
                        SELECT 3
                        FROM content_categories cc
                        INNER JOIN source_categories sc ON cc.category_id = sc.category_id
                            AND sc.is_primary = TRUE
                        WHERE cc.content_id = cand.content_id
                          AND cc.is_primary = TRUE
                        LIMIT 1
                    ), 0)
                    + CASE WHEN cand.author = (SELECT author FROM source) THEN 1 ELSE 0 END
                    AS similarity_score
                FROM candidates cand
            )
            SELECT
                id, content_id, author, published_date,
                reading_time_minutes, cover_image_id, header_image_id,
                is_featured, allow_comments, is_sample,
                slug, status, published_at, publish_start, publish_end,
                created_at, updated_at
            FROM scores
            WHERE similarity_score > 0
            ORDER BY similarity_score DESC, published_date DESC
            LIMIT $3
            "#,
        )
        .bind(blog_id)
        .bind(site_id)
        .bind(limit)
        .fetch_all(pool)
        .await?;

        Ok(blogs)
    }

    /// Count blogs grouped by workflow status. Returns `(draft, in_review,
    /// scheduled, published, archived)`. Soft-deleted blogs are excluded.
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
            FROM blogs b
            INNER JOIN contents c ON b.content_id = c.id
            INNER JOIN content_sites cs ON c.id = cs.content_id
            WHERE cs.site_id = $1 AND c.is_deleted = FALSE
            "#,
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;

        Ok(row)
    }

    /// Count blogs for a site
    pub async fn count_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        ContentQuery::new("blogs", site_id).count_only(pool).await
    }

    /// Find all blogs for a site with optional search, filter, and sort.
    ///
    /// Delegates the JOIN / WHERE / pagination assembly to [`ContentQuery`]
    /// (#834); only the blog-specific bits — searchable columns and the
    /// sortable-column allowlist — live here.
    #[allow(clippy::too_many_arguments)]
    pub async fn find_all_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
        search: Option<&str>,
        status: Option<&str>,
        sort_by: Option<&str>,
        sort_dir: Option<&str>,
        exclude_status: Option<&str>,
    ) -> Result<Vec<BlogWithContent>, ApiError> {
        let query = ContentQuery::new("blogs", site_id)
            .order_by_dir(blog_sort_column(sort_by), sort_dir)
            .paginate(limit, offset);
        let query = apply_blog_filters(query, search, status, exclude_status);

        let (rows, _) = query.execute::<BlogWithContent>(pool).await?;
        Ok(rows)
    }

    /// Count blogs for a site with optional search and filter.
    ///
    /// Shares filter assembly with [`Self::find_all_for_site_filtered`] via
    /// [`apply_blog_filters`], so the count always matches the listed rows.
    pub async fn count_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        search: Option<&str>,
        status: Option<&str>,
        exclude_status: Option<&str>,
    ) -> Result<i64, ApiError> {
        let query = apply_blog_filters(
            ContentQuery::new("blogs", site_id),
            search,
            status,
            exclude_status,
        );
        query.count_only(pool).await
    }

    /// Find published blogs for a site filtered by category slug
    pub async fn find_published_for_site_by_category(
        pool: &PgPool,
        site_id: Uuid,
        category_slug: &str,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<BlogWithContent>, ApiError> {
        let (rows, _) = ContentQuery::new("blogs", site_id)
            .with_category(category_slug)
            .published_only()
            .paginate(limit, offset)
            .execute::<BlogWithContent>(pool)
            .await?;
        Ok(rows)
    }

    /// Count published blogs for a site filtered by category slug.
    pub async fn count_published_for_site_by_category(
        pool: &PgPool,
        site_id: Uuid,
        category_slug: &str,
    ) -> Result<i64, ApiError> {
        let (_, total) = ContentQuery::new("blogs", site_id)
            .with_category(category_slug)
            .published_only()
            .paginate(0, 0)
            .execute::<BlogWithContent>(pool)
            .await?;
        Ok(total)
    }

    /// Count published blogs for a site
    pub async fn count_published_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let (_, total) = ContentQuery::new("blogs", site_id)
            .published_only()
            .paginate(0, 0)
            .execute::<BlogWithContent>(pool)
            .await?;
        Ok(total)
    }

    /// Create a new blog post with associated content.
    ///
    /// Runs on the caller's transaction connection (#863) so the spine
    /// `contents` row and the `blogs` row commit atomically. The caller
    /// ([`content_lifecycle::create`](crate::services::content_lifecycle::create))
    /// owns the `tx` and commits once.
    pub async fn create(
        conn: &mut PgConnection,
        req: CreateBlogRequest,
        created_by: Option<&str>,
    ) -> Result<BlogWithContent, ApiError> {
        let slug = match req.slug {
            Some(ref s) if !s.is_empty() => s.clone(),
            _ => {
                let base = match &req.title {
                    Some(t) if !t.is_empty() => crate::utils::slugify::slugify(t),
                    _ => format!("post-{}", chrono::Utc::now().format("%Y%m%d-%H%M%S")),
                };
                crate::utils::slugify::generate_unique_slug(&mut *conn, &base, &req.site_ids)
                    .await?
            }
        };

        let content_id = ContentService::create_content(
            &mut *conn,
            "blog",
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
            INSERT INTO blogs (content_id, author, published_date, reading_time_minutes,
                             cover_image_id, header_image_id, is_featured, allow_comments)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            "#,
        )
        .bind(content_id)
        .bind(&req.author)
        .bind(req.published_date)
        .bind(req.reading_time_minutes)
        .bind(req.cover_image_id)
        .bind(req.header_image_id)
        .bind(req.is_featured)
        .bind(req.allow_comments)
        .execute(&mut *conn)
        .await?;

        let blog = sqlx::query_as::<_, BlogWithContent>(
            r#"
            SELECT
                b.id, b.content_id, b.author, b.published_date,
                b.reading_time_minutes, b.cover_image_id, b.header_image_id, b.is_featured, b.allow_comments, b.is_sample,
                c.slug, c.status, c.published_at, c.publish_start, c.publish_end,
                b.created_at, b.updated_at
            FROM blogs b
            INNER JOIN contents c ON b.content_id = c.id
            WHERE b.content_id = $1
            "#,
        )
        .bind(content_id)
        .fetch_one(&mut *conn)
        .await?;

        Ok(blog)
    }

    /// Update a blog post.
    ///
    /// Runs on the caller's transaction connection (#863) so the spine
    /// `contents` update and the `blogs` update commit atomically.
    pub async fn update(
        conn: &mut PgConnection,
        id: Uuid,
        req: UpdateBlogRequest,
    ) -> Result<BlogWithContent, ApiError> {
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
            UPDATE blogs
            SET author = COALESCE($2, author),
                published_date = COALESCE($3, published_date),
                reading_time_minutes = COALESCE($4, reading_time_minutes),
                cover_image_id = COALESCE($5, cover_image_id),
                header_image_id = COALESCE($6, header_image_id),
                is_featured = COALESCE($7, is_featured),
                allow_comments = COALESCE($8, allow_comments),
                updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(&req.author)
        .bind(req.published_date)
        .bind(req.reading_time_minutes)
        .bind(req.cover_image_id)
        .bind(req.header_image_id)
        .bind(req.is_featured)
        .bind(req.allow_comments)
        .execute(&mut *conn)
        .await?;

        Self::find_by_id(&mut *conn, id).await
    }

    /// Clone a blog post: creates a new Draft blog copying fields and localizations.
    pub async fn clone_blog(
        pool: &PgPool,
        source_id: Uuid,
        site_ids: Vec<Uuid>,
        created_by: Option<&str>,
    ) -> Result<BlogWithContent, ApiError> {
        let source = Self::find_by_id(pool, source_id).await?;

        let base_slug = source.slug.as_deref().unwrap_or("untitled");
        let new_slug = ContentService::generate_unique_slug(pool, base_slug, &site_ids).await?;

        // Clone is outside #863's create/update scope; preserve its prior
        // semantics (spine row atomic on its own) by committing the spine
        // insert in a short-lived tx before the entity insert.
        let content_id = {
            let mut tx = pool.begin().await?;
            let cid = ContentService::create_content(
                &mut tx,
                "blog",
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
            INSERT INTO blogs (content_id, author, published_date, reading_time_minutes,
                             cover_image_id, header_image_id, is_featured, allow_comments)
            VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7)
            "#,
        )
        .bind(content_id)
        .bind(&source.author)
        .bind(source.published_date)
        .bind(source.reading_time_minutes)
        .bind(source.cover_image_id)
        .bind(source.header_image_id)
        .bind(source.allow_comments)
        .execute(pool)
        .await?;

        let localizations =
            ContentLocalization::find_all_for_content(pool, source.content_id).await?;
        for loc in &localizations {
            ContentLocalization::create(
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

        let blog = sqlx::query_as::<_, BlogWithContent>(
            r#"
            SELECT
                b.id, b.content_id, b.author, b.published_date,
                b.reading_time_minutes, b.cover_image_id, b.header_image_id, b.is_featured, b.allow_comments, b.is_sample,
                c.slug, c.status, c.published_at, c.publish_start, c.publish_end,
                b.created_at, b.updated_at
            FROM blogs b
            INNER JOIN contents c ON b.content_id = c.id
            WHERE b.content_id = $1
            "#,
        )
        .bind(content_id)
        .fetch_one(pool)
        .await?;

        Ok(blog)
    }

    /// Soft delete a blog post (via content)
    pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let blog = Self::find_by_id(pool, id).await?;
        ContentService::soft_delete_content(pool, blog.content_id).await
    }

    /// Seed sample blog posts for a new site
    pub async fn seed_sample_content(
        pool: &PgPool,
        site_id: Uuid,
        locale_id: Uuid,
        author: &str,
        locale_code: &str,
    ) -> Result<Vec<BlogWithContent>, ApiError> {
        let samples = load_seed_content(locale_code);

        let mut created = Vec::new();

        for post in &samples {
            let req = CreateBlogRequest {
                slug: Some(post.slug.clone()),
                title: None,
                author: author.to_string(),
                published_date: chrono::Utc::now().date_naive(),
                reading_time_minutes: Some(2),
                cover_image_id: None,
                header_image_id: None,
                is_featured: false,
                allow_comments: true,
                status: ContentStatus::Draft,
                publish_start: None,
                publish_end: None,
                site_ids: vec![site_id],
            };

            let blog = {
                let mut tx = pool.begin().await?;
                let b = Self::create(&mut tx, req, None).await?;
                tx.commit().await?;
                b
            };

            sqlx::query("UPDATE blogs SET is_sample = TRUE WHERE id = $1")
                .bind(blog.id)
                .execute(pool)
                .await?;

            ContentLocalization::create(
                pool,
                blog.content_id,
                locale_id,
                &post.title,
                None,
                post.excerpt.as_deref(),
                post.body.as_deref(),
                None,
                None,
            )
            .await?;

            let updated = Self::find_by_id(pool, blog.id).await?;
            created.push(updated);
        }

        Ok(created)
    }

    /// Delete all sample blog posts for a site
    pub async fn delete_sample_content(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let sample_ids: Vec<Uuid> = sqlx::query_scalar(
            r#"
            SELECT b.id
            FROM blogs b
            INNER JOIN contents c ON b.content_id = c.id
            INNER JOIN content_sites cs ON c.id = cs.content_id
            WHERE cs.site_id = $1 AND b.is_sample = TRUE AND c.is_deleted = FALSE
            "#,
        )
        .bind(site_id)
        .fetch_all(pool)
        .await?;

        let count = sample_ids.len() as i64;
        for id in sample_ids {
            Self::soft_delete(pool, id).await?;
        }

        Ok(count)
    }

    /// Count sample blogs for a site
    pub async fn count_sample_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*)
            FROM blogs b
            INNER JOIN contents c ON b.content_id = c.id
            INNER JOIN content_sites cs ON c.id = cs.content_id
            WHERE cs.site_id = $1 AND b.is_sample = TRUE AND c.is_deleted = FALSE
            "#,
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;

        Ok(row.0)
    }

    /// Check if a site has ever had a published blog post
    pub async fn has_ever_published(pool: &PgPool, site_id: Uuid) -> Result<bool, ApiError> {
        let exists: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS(
                SELECT 1
                FROM blogs b
                INNER JOIN contents c ON b.content_id = c.id
                INNER JOIN content_sites cs ON c.id = cs.content_id
                WHERE cs.site_id = $1 AND c.status = 'published' AND c.is_deleted = FALSE
            )
            "#,
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;

        Ok(exists)
    }
}
