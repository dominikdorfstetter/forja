//! Project repository: SQL for `Project` and its junction tables.
//! Phase 2 of #520.

use std::collections::HashMap;

use sqlx::{PgConnection, PgExecutor, PgPool};
use uuid::Uuid;

use crate::dto::project::{
    CreateProjectLinkRequest, CreateProjectLocalizationRequest, CreateProjectRequest,
    ProjectMediaRequest, UpdateProjectRequest,
};
use crate::errors::codes;
use crate::errors::ApiError;
use crate::models::content::Content;
use crate::models::project::{
    ProjectLink, ProjectLocalization, ProjectMediaItem, ProjectWithContent,
};
use crate::repos::content_query::ContentQuery;
use crate::services::content_service::ContentService;
use crate::utils::list_params::ListParams;

/// Columns the project list free-text search scans, aliased for `ContentQuery`
/// (entity table = `e`). Hard-coded — never user input.
const PROJECT_SEARCH_COLUMNS: &[&str] = &["e.slug"];

const PROJECT_WITH_CONTENT_COLUMNS: &str = r#"
    p.id, p.content_id, p.slug, p.display_order, p.is_featured,
    p.start_date, p.end_date, p.is_ongoing, p.is_deleted,
    c.status, c.published_at, c.publish_start, c.publish_end,
    p.created_at, p.updated_at
"#;

/// Apply the shared project list filters (search, status, is_featured) onto a
/// `ContentQuery`. Status arrives as the API value and is normalized inside
/// `ContentQuery` at execute time; `is_featured` is an entity-table column.
/// Shared by the list and count paths so both stay in lock-step.
fn apply_project_filters(
    mut query: ContentQuery,
    search: Option<&str>,
    status: Option<&str>,
    is_featured: Option<bool>,
) -> ContentQuery {
    if let Some(s) = search {
        query = query.with_search(PROJECT_SEARCH_COLUMNS, s);
    }
    if let Some(s) = status {
        query = query.with_status([s]);
    }
    if let Some(f) = is_featured {
        query = query.with_entity_filter("e.is_featured", f);
    }
    query
}

pub struct ProjectRepo;

impl ProjectRepo {
    pub async fn count_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        ContentQuery::new("projects", site_id)
            .count_only(pool)
            .await
    }

    pub async fn count_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        search: Option<&str>,
        status: Option<&str>,
        is_featured: Option<bool>,
    ) -> Result<i64, ApiError> {
        apply_project_filters(
            ContentQuery::new("projects", site_id),
            search,
            status,
            is_featured,
        )
        .count_only(pool)
        .await
    }

    pub async fn count_published_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        ContentQuery::new("projects", site_id)
            .published_only()
            .count_only(pool)
            .await
    }

    pub async fn find_all_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        params: &ListParams,
        status: Option<&str>,
        is_featured: Option<bool>,
    ) -> Result<Vec<ProjectWithContent>, ApiError> {
        let (limit, offset) = params.limit_offset();

        let order_col = match params.sort.field_or("display_order") {
            "display_order" => "e.display_order",
            "slug" => "e.slug",
            "status" => "c.status",
            "start_date" => "e.start_date",
            "created_at" => "e.created_at",
            _ => "e.display_order",
        };

        let query = apply_project_filters(
            ContentQuery::new("projects", site_id)
                .order_by_dir(order_col, params.sort.sort_dir.as_deref())
                .paginate(limit, offset),
            params.search_ref(),
            status,
            is_featured,
        );

        // ContentQuery selects `e.*, c.slug, ...`; `projects` also has its own
        // `slug` column, so the row carries two identically-named `slug` columns.
        // projects.slug and contents.slug are always written together (create /
        // update set both from the same value), so whichever one FromRow binds,
        // ProjectWithContent.slug is the same value the hand-rolled `p.slug`
        // returned — no behavior change.
        let (rows, _) = query.execute::<ProjectWithContent>(pool).await?;
        Ok(rows)
    }

    /// Generic over the executor so create/update can build their return
    /// value on a `&mut *tx` mid-transaction (#863); normal callers pass
    /// `&PgPool`.
    pub async fn find_by_id<'e, E>(executor: E, id: Uuid) -> Result<ProjectWithContent, ApiError>
    where
        E: PgExecutor<'e>,
    {
        let sql = format!(
            r#"
            SELECT {}
            FROM projects p
            INNER JOIN contents c ON p.content_id = c.id
            WHERE p.id = $1 AND c.is_deleted = FALSE
            "#,
            PROJECT_WITH_CONTENT_COLUMNS,
        );

        let project = sqlx::query_as::<_, ProjectWithContent>(sqlx::AssertSqlSafe(sql))
            .bind(id)
            .fetch_optional(executor)
            .await?
            .ok_or_else(|| {
                ApiError::not_found(format!("Project with ID {} not found", id))
                    .with_code(codes::ENTITY_NOT_FOUND)
                    .with_entity_type("project")
            })?;

        Ok(project)
    }

    pub async fn find_by_slug(
        pool: &PgPool,
        site_id: Uuid,
        slug: &str,
    ) -> Result<ProjectWithContent, ApiError> {
        let sql = format!(
            r#"
            SELECT {}
            FROM projects p
            INNER JOIN contents c ON p.content_id = c.id
            INNER JOIN content_sites cs ON c.id = cs.content_id
            WHERE cs.site_id = $1 AND p.slug = $2 AND c.is_deleted = FALSE
            "#,
            PROJECT_WITH_CONTENT_COLUMNS,
        );

        let project = sqlx::query_as::<_, ProjectWithContent>(sqlx::AssertSqlSafe(sql))
            .bind(site_id)
            .bind(slug)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| {
                ApiError::not_found(format!("Project with slug '{}' not found", slug))
                    .with_code(codes::ENTITY_NOT_FOUND)
                    .with_entity_type("project")
            })?;

        Ok(project)
    }

    pub async fn find_published_for_site(
        pool: &PgPool,
        site_id: Uuid,
        params: &ListParams,
        is_featured: Option<bool>,
    ) -> Result<Vec<ProjectWithContent>, ApiError> {
        let (limit, offset) = params.limit_offset();

        let mut where_clauses = vec![
            "cs.site_id = $1".to_string(),
            "c.is_deleted = FALSE".to_string(),
            "c.status IN ('published', 'scheduled')".to_string(),
            "(c.publish_start IS NULL OR c.publish_start <= NOW())".to_string(),
            "(c.publish_end IS NULL OR c.publish_end > NOW())".to_string(),
        ];
        let mut bind_idx = 4u32;

        if is_featured.is_some() {
            where_clauses.push(format!("p.is_featured = ${bind_idx}"));
            bind_idx += 1;
        }
        let _ = bind_idx;

        let order_col = match params.sort.field_or("display_order") {
            "display_order" => "p.display_order",
            "start_date" => "p.start_date",
            "created_at" => "p.created_at",
            _ => "p.display_order",
        };

        let sql = format!(
            r#"
            SELECT {}
            FROM projects p
            INNER JOIN contents c ON p.content_id = c.id
            INNER JOIN content_sites cs ON c.id = cs.content_id
            WHERE {}
            ORDER BY {}
            LIMIT $2 OFFSET $3
            "#,
            PROJECT_WITH_CONTENT_COLUMNS,
            where_clauses.join(" AND "),
            params.sort.order_clause(order_col),
        );

        let mut query = sqlx::query_as::<_, ProjectWithContent>(sqlx::AssertSqlSafe(sql))
            .bind(site_id)
            .bind(limit)
            .bind(offset);

        if let Some(f) = is_featured {
            query = query.bind(f);
        }

        let projects = query.fetch_all(pool).await?;
        Ok(projects)
    }

    /// Create a project + spine row + junction rows atomically on the
    /// caller's tx connection (#863). The `set_*` helpers reference the
    /// uncommitted `project_id`, so they must run on the same connection.
    pub async fn create(
        conn: &mut PgConnection,
        req: CreateProjectRequest,
        created_by: Option<&str>,
    ) -> Result<ProjectWithContent, ApiError> {
        let slug = req.slug.clone();

        let content_id = ContentService::create_content(
            &mut *conn,
            "project",
            Some(&slug),
            &req.status,
            &req.site_ids,
            None,
            None,
            created_by,
        )
        .await?;

        let project_id: Uuid = sqlx::query_scalar(
            r#"
            INSERT INTO projects (content_id, slug, display_order, is_featured,
                                  start_date, end_date, is_ongoing)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
            "#,
        )
        .bind(content_id)
        .bind(&slug)
        .bind(req.display_order.unwrap_or(0))
        .bind(req.is_featured.unwrap_or(false))
        .bind(req.start_date)
        .bind(req.end_date)
        .bind(req.is_ongoing.unwrap_or(false))
        .fetch_one(&mut *conn)
        .await?;

        if let Some(localizations) = req.localizations {
            Self::set_localizations(&mut *conn, project_id, localizations).await?;
        }
        if let Some(links) = req.links {
            Self::set_links(&mut *conn, project_id, links).await?;
        }
        if let Some(media) = req.media {
            Self::set_media(&mut *conn, project_id, media).await?;
        }
        if let Some(skill_ids) = req.skill_ids {
            Self::set_skills(&mut *conn, project_id, skill_ids).await?;
        }
        if let Some(cv_entry_ids) = req.cv_entry_ids {
            Self::set_cv_entries(&mut *conn, project_id, cv_entry_ids).await?;
        }

        Self::find_by_id(&mut *conn, project_id).await
    }

    /// Update a project + spine row + junction rows atomically on the
    /// caller's tx connection (#863).
    pub async fn update(
        conn: &mut PgConnection,
        id: Uuid,
        req: UpdateProjectRequest,
    ) -> Result<ProjectWithContent, ApiError> {
        let existing = Self::find_by_id(&mut *conn, id).await?;

        ContentService::update_content(
            &mut *conn,
            existing.content_id,
            req.slug.as_deref(),
            req.status.as_ref(),
            None,
            None,
        )
        .await?;

        sqlx::query(
            r#"
            UPDATE projects
            SET slug = COALESCE($2, slug),
                display_order = COALESCE($3, display_order),
                is_featured = COALESCE($4, is_featured),
                start_date = COALESCE($5, start_date),
                end_date = COALESCE($6, end_date),
                is_ongoing = COALESCE($7, is_ongoing),
                updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(&req.slug)
        .bind(req.display_order)
        .bind(req.is_featured)
        .bind(req.start_date)
        .bind(req.end_date)
        .bind(req.is_ongoing)
        .execute(&mut *conn)
        .await?;

        if let Some(localizations) = req.localizations {
            Self::set_localizations(&mut *conn, id, localizations).await?;
        }
        if let Some(links) = req.links {
            Self::set_links(&mut *conn, id, links).await?;
        }
        if let Some(media) = req.media {
            Self::set_media(&mut *conn, id, media).await?;
        }
        if let Some(skill_ids) = req.skill_ids {
            Self::set_skills(&mut *conn, id, skill_ids).await?;
        }
        if let Some(cv_entry_ids) = req.cv_entry_ids {
            Self::set_cv_entries(&mut *conn, id, cv_entry_ids).await?;
        }

        Self::find_by_id(&mut *conn, id).await
    }

    pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let project = Self::find_by_id(pool, id).await?;
        ContentService::soft_delete_content(pool, project.content_id).await
    }

    pub async fn find_site_ids(pool: &PgPool, project_id: Uuid) -> Result<Vec<Uuid>, ApiError> {
        let project = Self::find_by_id(pool, project_id).await?;
        Content::find_site_ids(pool, project.content_id).await
    }

    pub async fn set_localizations(
        conn: &mut PgConnection,
        project_id: Uuid,
        localizations: Vec<CreateProjectLocalizationRequest>,
    ) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM project_localizations WHERE project_id = $1")
            .bind(project_id)
            .execute(&mut *conn)
            .await?;

        for loc in &localizations {
            sqlx::query(
                r#"
                INSERT INTO project_localizations (project_id, locale_id, title, short_description, description)
                VALUES ($1, $2, $3, $4, $5)
                "#,
            )
            .bind(project_id)
            .bind(loc.locale_id)
            .bind(&loc.title)
            .bind(&loc.short_description)
            .bind(&loc.description)
            .execute(&mut *conn)
            .await?;
        }
        Ok(())
    }

    pub async fn set_links(
        conn: &mut PgConnection,
        project_id: Uuid,
        links: Vec<CreateProjectLinkRequest>,
    ) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM project_links WHERE project_id = $1")
            .bind(project_id)
            .execute(&mut *conn)
            .await?;

        for link in &links {
            sqlx::query(
                r#"
                INSERT INTO project_links (project_id, label, url, link_type, icon, display_order)
                VALUES ($1, $2, $3, $4, $5, $6)
                "#,
            )
            .bind(project_id)
            .bind(&link.label)
            .bind(&link.url)
            .bind(&link.link_type)
            .bind(&link.icon)
            .bind(link.display_order)
            .execute(&mut *conn)
            .await?;
        }

        Ok(())
    }

    pub async fn get_links(pool: &PgPool, project_id: Uuid) -> Result<Vec<ProjectLink>, ApiError> {
        let links = sqlx::query_as::<_, ProjectLink>(
            r#"
            SELECT id, project_id, label, url, link_type, icon, display_order, created_at
            FROM project_links
            WHERE project_id = $1
            ORDER BY display_order ASC
            "#,
        )
        .bind(project_id)
        .fetch_all(pool)
        .await?;

        Ok(links)
    }

    pub async fn set_media(
        conn: &mut PgConnection,
        project_id: Uuid,
        media: Vec<ProjectMediaRequest>,
    ) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM project_media WHERE project_id = $1")
            .bind(project_id)
            .execute(&mut *conn)
            .await?;

        for item in &media {
            sqlx::query(
                r#"
                INSERT INTO project_media (project_id, media_id, display_order, is_cover)
                VALUES ($1, $2, $3, $4)
                "#,
            )
            .bind(project_id)
            .bind(item.media_id)
            .bind(item.display_order)
            .bind(item.is_cover)
            .execute(&mut *conn)
            .await?;
        }

        Ok(())
    }

    pub async fn get_media(
        pool: &PgPool,
        project_id: Uuid,
    ) -> Result<Vec<ProjectMediaItem>, ApiError> {
        let media = sqlx::query_as::<_, ProjectMediaItem>(
            r#"
            SELECT project_id, media_id, display_order, is_cover
            FROM project_media
            WHERE project_id = $1
            ORDER BY display_order ASC
            "#,
        )
        .bind(project_id)
        .fetch_all(pool)
        .await?;

        Ok(media)
    }

    pub async fn set_skills(
        conn: &mut PgConnection,
        project_id: Uuid,
        skill_ids: Vec<Uuid>,
    ) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM project_skills WHERE project_id = $1")
            .bind(project_id)
            .execute(&mut *conn)
            .await?;

        for skill_id in &skill_ids {
            sqlx::query("INSERT INTO project_skills (project_id, skill_id) VALUES ($1, $2)")
                .bind(project_id)
                .bind(skill_id)
                .execute(&mut *conn)
                .await?;
        }

        Ok(())
    }

    pub async fn get_skill_ids(pool: &PgPool, project_id: Uuid) -> Result<Vec<Uuid>, ApiError> {
        let rows: Vec<(Uuid,)> =
            sqlx::query_as("SELECT skill_id FROM project_skills WHERE project_id = $1")
                .bind(project_id)
                .fetch_all(pool)
                .await?;
        Ok(rows.into_iter().map(|(id,)| id).collect())
    }

    /// Bulk-fetch the `project_id → skill_ids` map for a page of projects in
    /// one SQL query. Projects with no linked skills are absent from the map;
    /// callers should default to an empty vec.
    pub async fn skill_ids_for_projects(
        pool: &PgPool,
        project_ids: &[Uuid],
    ) -> Result<HashMap<Uuid, Vec<Uuid>>, ApiError> {
        if project_ids.is_empty() {
            return Ok(HashMap::new());
        }
        let rows: Vec<(Uuid, Uuid)> = sqlx::query_as(
            "SELECT project_id, skill_id FROM project_skills WHERE project_id = ANY($1)",
        )
        .bind(project_ids)
        .fetch_all(pool)
        .await?;
        let mut map: HashMap<Uuid, Vec<Uuid>> = HashMap::with_capacity(project_ids.len());
        for (project_id, skill_id) in rows {
            map.entry(project_id).or_default().push(skill_id);
        }
        Ok(map)
    }

    pub async fn set_cv_entries(
        conn: &mut PgConnection,
        project_id: Uuid,
        cv_entry_ids: Vec<Uuid>,
    ) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM project_cv_entries WHERE project_id = $1")
            .bind(project_id)
            .execute(&mut *conn)
            .await?;

        for cv_entry_id in &cv_entry_ids {
            sqlx::query("INSERT INTO project_cv_entries (project_id, cv_entry_id) VALUES ($1, $2)")
                .bind(project_id)
                .bind(cv_entry_id)
                .execute(&mut *conn)
                .await?;
        }

        Ok(())
    }

    pub async fn get_cv_entry_ids(pool: &PgPool, project_id: Uuid) -> Result<Vec<Uuid>, ApiError> {
        let rows: Vec<(Uuid,)> =
            sqlx::query_as("SELECT cv_entry_id FROM project_cv_entries WHERE project_id = $1")
                .bind(project_id)
                .fetch_all(pool)
                .await?;
        Ok(rows.into_iter().map(|(id,)| id).collect())
    }

    pub async fn reorder(pool: &PgPool, items: &[(Uuid, i16)]) -> Result<(), ApiError> {
        let mut tx = pool.begin().await?;
        for (id, display_order) in items {
            sqlx::query(
                "UPDATE projects SET display_order = $1, updated_at = NOW() WHERE id = $2 AND is_deleted = FALSE",
            )
            .bind(display_order)
            .bind(id)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;
        Ok(())
    }

    pub async fn get_localizations(
        pool: &PgPool,
        project_id: Uuid,
    ) -> Result<Vec<ProjectLocalization>, ApiError> {
        let localizations = sqlx::query_as::<_, ProjectLocalization>(
            r#"
            SELECT id, project_id, locale_id, title, short_description, description
            FROM project_localizations
            WHERE project_id = $1
            "#,
        )
        .bind(project_id)
        .fetch_all(pool)
        .await?;

        Ok(localizations)
    }

    /// Bulk-fetch localizations for a set of projects in a single SQL round-trip.
    /// Returns rows flat — callers group by `project_id`. An empty input slice
    /// short-circuits to `Ok(vec![])` without hitting the DB.
    pub async fn find_localizations_for_project_ids(
        pool: &PgPool,
        project_ids: &[Uuid],
    ) -> Result<Vec<ProjectLocalization>, ApiError> {
        if project_ids.is_empty() {
            return Ok(Vec::new());
        }
        let localizations = sqlx::query_as::<_, ProjectLocalization>(
            r#"
            SELECT id, project_id, locale_id, title, short_description, description
            FROM project_localizations
            WHERE project_id = ANY($1)
            ORDER BY project_id, locale_id
            "#,
        )
        .bind(project_ids)
        .fetch_all(pool)
        .await?;

        Ok(localizations)
    }
}
