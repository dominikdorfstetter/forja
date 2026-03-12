//! Blog model

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::blog::{CreateBlogRequest, UpdateBlogRequest};
use crate::errors::ApiError;
use crate::models::content::{ContentLocalization, ContentStatus};
use crate::services::content_service::ContentService;

/// Blog with joined content data
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BlogWithContent {
    // Blog fields
    pub id: Uuid,
    pub content_id: Uuid,
    pub author: String,
    pub published_date: NaiveDate,
    pub reading_time_minutes: Option<i16>,
    pub cover_image_id: Option<Uuid>,
    pub header_image_id: Option<Uuid>,
    pub is_featured: bool,
    pub allow_comments: bool,
    pub is_sample: bool,
    // Content fields
    pub slug: Option<String>,
    pub status: ContentStatus,
    pub published_at: Option<DateTime<Utc>>,
    pub publish_start: Option<DateTime<Utc>>,
    pub publish_end: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Blog model (database row)
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Blog {
    pub id: Uuid,
    pub content_id: Uuid,
    pub author: String,
    pub published_date: NaiveDate,
    pub reading_time_minutes: Option<i16>,
    pub cover_image_id: Option<Uuid>,
    pub header_image_id: Option<Uuid>,
    pub is_featured: bool,
    pub allow_comments: bool,
    pub is_sample: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Blog with full details including localizations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlogDetails {
    pub blog: BlogWithContent,
    pub localizations: Vec<ContentLocalization>,
}

/// Map API/serde status name (PascalCase) to PostgreSQL enum text value.
/// Returns `None` for unrecognised values so the caller can reject them.
fn normalize_content_status(api_value: &str) -> Option<&'static str> {
    match api_value {
        "Draft" => Some("draft"),
        "InReview" => Some("in_review"),
        "Scheduled" => Some("scheduled"),
        "Published" => Some("published"),
        "Archived" => Some("archived"),
        _ => None,
    }
}

impl Blog {
    /// Find all blogs for a site
    pub async fn find_all_for_site(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
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
            WHERE cs.site_id = $1 AND c.is_deleted = FALSE
            ORDER BY b.published_date DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(site_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok(blogs)
    }

    /// Find published blogs for a site
    pub async fn find_published_for_site(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
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
              AND (c.publish_start IS NULL OR c.publish_start <= NOW())
              AND (c.publish_end IS NULL OR c.publish_end > NOW())
            ORDER BY b.published_date DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(site_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok(blogs)
    }

    /// Find blog by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<BlogWithContent, ApiError> {
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
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Blog with ID {} not found", id)))?;

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
        .ok_or_else(|| ApiError::NotFound(format!("Blog with slug '{}' not found", slug)))?;

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

    /// Count blogs for a site
    pub async fn count_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*)
            FROM blogs b
            INNER JOIN contents c ON b.content_id = c.id
            INNER JOIN content_sites cs ON c.id = cs.content_id
            WHERE cs.site_id = $1 AND c.is_deleted = FALSE
            "#,
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;

        Ok(row.0)
    }

    /// Find all blogs for a site with optional search, filter, and sort
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
        // Normalize status to DB enum value early so we can reject invalid values
        let db_status = match status {
            Some(s) => Some(
                normalize_content_status(s)
                    .ok_or_else(|| ApiError::BadRequest(format!("Invalid status filter: {}", s)))?,
            ),
            None => None,
        };
        let db_exclude_status = match exclude_status {
            Some(s) => Some(normalize_content_status(s).ok_or_else(|| {
                ApiError::BadRequest(format!("Invalid exclude_status filter: {}", s))
            })?),
            None => None,
        };

        let mut where_clauses = vec![
            "cs.site_id = $1".to_string(),
            "c.is_deleted = FALSE".to_string(),
        ];
        let mut bind_idx = 4u32; // $1=site_id, $2=limit, $3=offset

        if search.is_some() {
            where_clauses.push(format!(
                "(b.id::text ILIKE '%' || ${bind_idx} || '%' OR c.slug ILIKE '%' || ${bind_idx} || '%' OR b.author ILIKE '%' || ${bind_idx} || '%')"
            ));
            bind_idx += 1;
        }
        if db_status.is_some() {
            where_clauses.push(format!("c.status::text = ${bind_idx}"));
            bind_idx += 1;
        }
        if db_exclude_status.is_some() {
            where_clauses.push(format!("c.status::text != ${bind_idx}"));
            bind_idx += 1;
        }
        let _ = bind_idx;

        let order_col = match sort_by.unwrap_or("published_date") {
            "slug" => "c.slug",
            "author" => "b.author",
            "status" => "c.status",
            "published_date" => "b.published_date",
            "created_at" => "b.created_at",
            _ => "b.published_date",
        };
        let order_dir = match sort_dir.unwrap_or("desc") {
            "asc" | "ASC" => "ASC",
            _ => "DESC",
        };

        let sql = format!(
            r#"
            SELECT
                b.id, b.content_id, b.author, b.published_date,
                b.reading_time_minutes, b.cover_image_id, b.header_image_id, b.is_featured, b.allow_comments, b.is_sample,
                c.slug, c.status, c.published_at, c.publish_start, c.publish_end,
                b.created_at, b.updated_at
            FROM blogs b
            INNER JOIN contents c ON b.content_id = c.id
            INNER JOIN content_sites cs ON c.id = cs.content_id
            WHERE {}
            ORDER BY {} {}
            LIMIT $2 OFFSET $3
            "#,
            where_clauses.join(" AND "),
            order_col,
            order_dir,
        );

        let mut query = sqlx::query_as::<_, BlogWithContent>(&sql)
            .bind(site_id)
            .bind(limit)
            .bind(offset);

        if let Some(s) = search {
            query = query.bind(s);
        }
        if let Some(st) = db_status {
            query = query.bind(st);
        }
        if let Some(es) = db_exclude_status {
            query = query.bind(es);
        }

        let blogs = query.fetch_all(pool).await?;
        Ok(blogs)
    }

    /// Count blogs for a site with optional search and filter
    pub async fn count_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        search: Option<&str>,
        status: Option<&str>,
        exclude_status: Option<&str>,
    ) -> Result<i64, ApiError> {
        let db_status = match status {
            Some(s) => Some(
                normalize_content_status(s)
                    .ok_or_else(|| ApiError::BadRequest(format!("Invalid status filter: {}", s)))?,
            ),
            None => None,
        };
        let db_exclude_status = match exclude_status {
            Some(s) => Some(normalize_content_status(s).ok_or_else(|| {
                ApiError::BadRequest(format!("Invalid exclude_status filter: {}", s))
            })?),
            None => None,
        };

        let mut where_clauses = vec![
            "cs.site_id = $1".to_string(),
            "c.is_deleted = FALSE".to_string(),
        ];
        let mut bind_idx = 2u32; // $1=site_id

        if search.is_some() {
            where_clauses.push(format!(
                "(b.id::text ILIKE '%' || ${bind_idx} || '%' OR c.slug ILIKE '%' || ${bind_idx} || '%' OR b.author ILIKE '%' || ${bind_idx} || '%')"
            ));
            bind_idx += 1;
        }
        if db_status.is_some() {
            where_clauses.push(format!("c.status::text = ${bind_idx}"));
            bind_idx += 1;
        }
        if db_exclude_status.is_some() {
            where_clauses.push(format!("c.status::text != ${bind_idx}"));
            bind_idx += 1;
        }
        let _ = bind_idx;

        let sql = format!(
            r#"
            SELECT COUNT(*)
            FROM blogs b
            INNER JOIN contents c ON b.content_id = c.id
            INNER JOIN content_sites cs ON c.id = cs.content_id
            WHERE {}
            "#,
            where_clauses.join(" AND "),
        );

        let mut query = sqlx::query_as::<_, (i64,)>(&sql).bind(site_id);

        if let Some(s) = search {
            query = query.bind(s);
        }
        if let Some(st) = db_status {
            query = query.bind(st);
        }
        if let Some(es) = db_exclude_status {
            query = query.bind(es);
        }

        let row = query.fetch_one(pool).await?;
        Ok(row.0)
    }

    /// Find published blogs for a site filtered by category slug
    pub async fn find_published_for_site_by_category(
        pool: &PgPool,
        site_id: Uuid,
        category_slug: &str,
        limit: i64,
        offset: i64,
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
            INNER JOIN content_categories cc ON c.id = cc.content_id
            INNER JOIN categories cat ON cc.category_id = cat.id
            WHERE cs.site_id = $1
              AND c.is_deleted = FALSE
              AND c.status IN ('published', 'scheduled')
              AND (c.publish_start IS NULL OR c.publish_start <= NOW())
              AND (c.publish_end IS NULL OR c.publish_end > NOW())
              AND cat.slug = $4
            ORDER BY b.published_date DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(site_id)
        .bind(limit)
        .bind(offset)
        .bind(category_slug)
        .fetch_all(pool)
        .await?;

        Ok(blogs)
    }

    /// Count published blogs for a site filtered by category slug
    pub async fn count_published_for_site_by_category(
        pool: &PgPool,
        site_id: Uuid,
        category_slug: &str,
    ) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*)
            FROM blogs b
            INNER JOIN contents c ON b.content_id = c.id
            INNER JOIN content_sites cs ON c.id = cs.content_id
            INNER JOIN content_categories cc ON c.id = cc.content_id
            INNER JOIN categories cat ON cc.category_id = cat.id
            WHERE cs.site_id = $1
              AND c.is_deleted = FALSE
              AND c.status IN ('published', 'scheduled')
              AND (c.publish_start IS NULL OR c.publish_start <= NOW())
              AND (c.publish_end IS NULL OR c.publish_end > NOW())
              AND cat.slug = $2
            "#,
        )
        .bind(site_id)
        .bind(category_slug)
        .fetch_one(pool)
        .await?;

        Ok(row.0)
    }

    /// Count published blogs for a site
    pub async fn count_published_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*)
            FROM blogs b
            INNER JOIN contents c ON b.content_id = c.id
            INNER JOIN content_sites cs ON c.id = cs.content_id
            WHERE cs.site_id = $1
              AND c.is_deleted = FALSE
              AND c.status IN ('published', 'scheduled')
              AND (c.publish_start IS NULL OR c.publish_start <= NOW())
              AND (c.publish_end IS NULL OR c.publish_end > NOW())
            "#,
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;

        Ok(row.0)
    }

    /// Create a new blog post with associated content
    pub async fn create(
        pool: &PgPool,
        req: CreateBlogRequest,
    ) -> Result<BlogWithContent, ApiError> {
        // Create content record (handles transaction, entity_type lookup, site associations)
        let content_id = ContentService::create_content(
            pool,
            "blog",
            Some(&req.slug),
            &req.status,
            &req.site_ids,
            req.publish_start,
            req.publish_end,
        )
        .await?;

        // Insert into blogs table
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
        .execute(pool)
        .await?;

        // Return the full blog with content
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

    /// Update a blog post
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdateBlogRequest,
    ) -> Result<BlogWithContent, ApiError> {
        // Find existing blog to get content_id
        let existing = Self::find_by_id(pool, id).await?;

        // Update content record
        ContentService::update_content(
            pool,
            existing.content_id,
            req.slug.as_deref(),
            req.status.as_ref(),
            req.publish_start,
            req.publish_end,
        )
        .await?;

        // Update blogs table
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
        .execute(pool)
        .await?;

        Self::find_by_id(pool, id).await
    }

    /// Clone a blog post: creates a new Draft blog copying fields and localizations.
    pub async fn clone_blog(
        pool: &PgPool,
        source_id: Uuid,
        site_ids: Vec<Uuid>,
    ) -> Result<BlogWithContent, ApiError> {
        let source = Self::find_by_id(pool, source_id).await?;

        let base_slug = source.slug.as_deref().unwrap_or("untitled");
        let new_slug = ContentService::generate_unique_slug(pool, base_slug, &site_ids).await?;

        // Create content record as Draft, no scheduling
        let content_id = ContentService::create_content(
            pool,
            "blog",
            Some(&new_slug),
            &ContentStatus::Draft,
            &site_ids,
            None,
            None,
        )
        .await?;

        // Insert blog row copying fields from source
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

        // Copy localizations
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

        // Return full blog
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
    ) -> Result<Vec<BlogWithContent>, ApiError> {
        use crate::models::content::ContentLocalization;

        let samples = vec![
            ("welcome-to-your-new-site", "Welcome to your new site", Some("Your site is ready — here's what you can do with it."), Some("This is your first post. Feel free to edit it, delete it, or start fresh — it's all yours.\n\nUse the editor toolbar to add **bold text**, *italics*, headings, images, and more. When you're happy with your post, click **Publish** to share it with the world.")),
            ("getting-started-with-forja", "Getting started with Forja", Some("A quick tour of the key features that make Forja powerful."), Some("Forja is a modern content management system designed for speed and flexibility.\n\n## Key Features\n\n- **Rich Editor** — Write with a block-based editor that supports headings, images, code blocks, and more\n- **Categories & Tags** — Organize your content with a flexible taxonomy system\n- **Multi-language** — Publish content in multiple languages with built-in localization\n- **Media Library** — Upload and manage images, documents, and other files\n\n## Next Steps\n\n1. Edit this post to make it your own\n2. Create your first original post\n3. Set up your site navigation")),
            ("your-first-real-post", "Your first real post (delete me)", Some("A blank canvas ready for your ideas."), Some("Replace this text with your own content. What will you write about?\n\nTip: Use the `/` key to insert blocks like headings, images, and quotes.")),
        ];

        let mut created = Vec::new();

        for (slug, title, excerpt, body) in samples {
            let req = CreateBlogRequest {
                slug: slug.to_string(),
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

            let blog = Self::create(pool, req).await?;

            // Mark as sample
            sqlx::query("UPDATE blogs SET is_sample = TRUE WHERE id = $1")
                .bind(blog.id)
                .execute(pool)
                .await?;

            // Create localization with sample content
            ContentLocalization::create(
                pool,
                blog.content_id,
                locale_id,
                title,
                None,
                excerpt,
                body,
                None,
                None,
            )
            .await?;

            // Re-fetch to get is_sample = true
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_blog_with_content_serialization() {
        let blog = BlogWithContent {
            id: Uuid::new_v4(),
            content_id: Uuid::new_v4(),
            author: "John Doe".to_string(),
            published_date: NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
            reading_time_minutes: Some(5),
            cover_image_id: None,
            header_image_id: None,
            is_featured: true,
            allow_comments: true,
            is_sample: false,
            slug: Some("my-blog-post".to_string()),
            status: ContentStatus::Published,
            published_at: Some(Utc::now()),
            publish_start: None,
            publish_end: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&blog).unwrap();
        assert!(json.contains("\"author\":\"John Doe\""));
        assert!(json.contains("\"is_featured\":true"));
    }
}
