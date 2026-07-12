//! CV repositories: SQL for `Skill` and `CvEntry`. Phase 2 of #520.

use std::collections::HashMap;

use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

use crate::dto::cv::{
    CreateCvEntryRequest, CreateSkillRequest, CvEntryLocalizationInput, UpdateCvEntryRequest,
    UpdateSkillRequest,
};
use crate::errors::ApiError;
use crate::errors::codes;
use crate::models::cv::{CvEntry, CvEntryLocalization, CvEntryType, Skill, SkillLocalization};
use crate::repos::content_query::ContentQuery;
use crate::services::content_service::ContentService;
use crate::utils::list_params::ListParams;

/// Columns the CV-entry list free-text search scans, aliased for `ContentQuery`
/// (entity table = `e`). Hard-coded — never user input.
const CV_ENTRY_SEARCH_COLUMNS: &[&str] = &["e.company", "e.location"];

/// Map a `CvEntryType` to its Postgres enum text label. Entity-local (kept out
/// of `ContentQuery`, which stays domain-agnostic) so the `entry_type` filter
/// binds via `e.entry_type::text` — equivalent to the prior direct enum bind.
fn entry_type_to_text(entry_type: &CvEntryType) -> &'static str {
    match entry_type {
        CvEntryType::Work => "work",
        CvEntryType::Education => "education",
        CvEntryType::Volunteer => "volunteer",
        CvEntryType::Certification => "certification",
        CvEntryType::Project => "project",
    }
}

pub struct SkillRepo;

impl SkillRepo {
    pub async fn count_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM skills s INNER JOIN skill_sites ss ON s.id = ss.skill_id WHERE ss.site_id = $1 AND s.is_deleted = FALSE"
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;
        Ok(row.0)
    }

    pub async fn count_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        search: Option<&str>,
    ) -> Result<i64, ApiError> {
        let mut where_clauses = vec![
            "ss.site_id = $1".to_string(),
            "s.is_deleted = FALSE".to_string(),
        ];
        let mut bind_idx = 2u32;

        if search.is_some() {
            where_clauses.push(format!("s.slug ILIKE '%' || ${bind_idx} || '%'"));
            bind_idx += 1;
        }
        let _ = bind_idx;

        let sql = format!(
            r#"
            SELECT COUNT(*)
            FROM skills s
            INNER JOIN skill_sites ss ON s.id = ss.skill_id
            WHERE {}
            "#,
            where_clauses.join(" AND "),
        );

        let mut query = sqlx::query_as::<_, (i64,)>(sqlx::AssertSqlSafe(sql)).bind(site_id);
        if let Some(s) = search {
            query = query.bind(s);
        }

        let row = query.fetch_one(pool).await?;
        Ok(row.0)
    }

    pub async fn find_all_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        params: &ListParams,
    ) -> Result<Vec<Skill>, ApiError> {
        let (limit, offset) = params.limit_offset();

        let mut where_clauses = vec![
            "ss.site_id = $1".to_string(),
            "s.is_deleted = FALSE".to_string(),
        ];
        let mut bind_idx = 4u32;

        if params.search_ref().is_some() {
            where_clauses.push(format!("s.slug ILIKE '%' || ${bind_idx} || '%'"));
            bind_idx += 1;
        }
        let _ = bind_idx;

        let order_col = match params.sort.field_or("slug") {
            "slug" => "s.slug",
            "display_order" => "s.proficiency_level",
            "created_at" => "s.created_at",
            _ => "s.slug",
        };

        let sql = format!(
            r#"
            SELECT s.id, s.name, s.slug, s.category, s.icon, s.proficiency_level,
                   s.is_global, s.is_deleted, s.created_at, s.updated_at
            FROM skills s
            INNER JOIN skill_sites ss ON s.id = ss.skill_id
            WHERE {}
            ORDER BY {}
            LIMIT $2 OFFSET $3
            "#,
            where_clauses.join(" AND "),
            params.sort.order_clause(order_col),
        );

        let mut query = sqlx::query_as::<_, Skill>(sqlx::AssertSqlSafe(sql))
            .bind(site_id)
            .bind(limit)
            .bind(offset);

        if let Some(s) = params.search_ref() {
            query = query.bind(s);
        }

        let skills = query.fetch_all(pool).await?;
        Ok(skills)
    }

    pub async fn find_all_for_site(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Skill>, ApiError> {
        let skills = sqlx::query_as::<_, Skill>(
            r#"
            SELECT s.id, s.name, s.slug, s.category, s.icon, s.proficiency_level,
                   s.is_global, s.is_deleted, s.created_at, s.updated_at
            FROM skills s
            INNER JOIN skill_sites ss ON s.id = ss.skill_id
            WHERE ss.site_id = $1 AND s.is_deleted = FALSE
            ORDER BY s.category ASC, s.name ASC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(site_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok(skills)
    }

    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Skill, ApiError> {
        let skill = sqlx::query_as::<_, Skill>(
            r#"
            SELECT id, name, slug, category, icon, proficiency_level,
                   is_global, is_deleted, created_at, updated_at
            FROM skills
            WHERE id = $1 AND is_deleted = FALSE
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Skill with ID {} not found", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("skill")
        })?;

        Ok(skill)
    }

    pub async fn find_by_slug(pool: &PgPool, slug: &str) -> Result<Skill, ApiError> {
        let skill = sqlx::query_as::<_, Skill>(
            r#"
            SELECT id, name, slug, category, icon, proficiency_level,
                   is_global, is_deleted, created_at, updated_at
            FROM skills
            WHERE slug = $1 AND is_deleted = FALSE
            "#,
        )
        .bind(slug)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Skill with slug '{}' not found", slug))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("skill")
        })?;

        Ok(skill)
    }

    pub async fn create(pool: &PgPool, req: CreateSkillRequest) -> Result<Skill, ApiError> {
        let mut tx = pool.begin().await?;

        let skill = sqlx::query_as::<_, Skill>(
            r#"
            INSERT INTO skills (name, slug, category, icon, proficiency_level, is_global)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, name, slug, category, icon, proficiency_level,
                      is_global, is_deleted, created_at, updated_at
            "#,
        )
        .bind(&req.name)
        .bind(&req.slug)
        .bind(&req.category)
        .bind(&req.icon)
        .bind(req.proficiency_level)
        .bind(req.is_global)
        .fetch_one(&mut *tx)
        .await?;

        for site_id in &req.site_ids {
            sqlx::query("INSERT INTO skill_sites (skill_id, site_id) VALUES ($1, $2)")
                .bind(skill.id)
                .bind(site_id)
                .execute(&mut *tx)
                .await?;
        }

        tx.commit().await?;

        Ok(skill)
    }

    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdateSkillRequest,
    ) -> Result<Skill, ApiError> {
        let skill = sqlx::query_as::<_, Skill>(
            r#"
            UPDATE skills
            SET name = COALESCE($2, name),
                slug = COALESCE($3, slug),
                category = COALESCE($4, category),
                icon = COALESCE($5, icon),
                proficiency_level = COALESCE($6, proficiency_level),
                is_global = COALESCE($7, is_global),
                updated_at = NOW()
            WHERE id = $1 AND is_deleted = FALSE
            RETURNING id, name, slug, category, icon, proficiency_level,
                      is_global, is_deleted, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&req.name)
        .bind(&req.slug)
        .bind(&req.category)
        .bind(&req.icon)
        .bind(req.proficiency_level)
        .bind(req.is_global)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Skill with ID {} not found", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("skill")
        })?;

        Ok(skill)
    }

    /// Bulk-fetch `skill_localizations` rows for a set of skill ids.
    /// Returns a map keyed by `skill_id`; skills with no localizations
    /// are absent from the map — callers default to an empty `Vec`.
    /// Single SQL round-trip regardless of how many skill ids are passed.
    pub async fn find_localizations_for_skills(
        pool: &PgPool,
        skill_ids: &[Uuid],
    ) -> Result<HashMap<Uuid, Vec<SkillLocalization>>, ApiError> {
        if skill_ids.is_empty() {
            return Ok(HashMap::new());
        }

        let rows = sqlx::query_as::<_, SkillLocalization>(
            r#"
            SELECT id, skill_id, locale_id, display_name, description
            FROM skill_localizations
            WHERE skill_id = ANY($1)
            "#,
        )
        .bind(skill_ids)
        .fetch_all(pool)
        .await?;

        let mut map: HashMap<Uuid, Vec<SkillLocalization>> = HashMap::new();
        for row in rows {
            map.entry(row.skill_id).or_default().push(row);
        }
        Ok(map)
    }

    pub async fn find_site_ids(pool: &PgPool, skill_id: Uuid) -> Result<Vec<Uuid>, ApiError> {
        let rows: Vec<(Uuid,)> =
            sqlx::query_as("SELECT site_id FROM skill_sites WHERE skill_id = $1")
                .bind(skill_id)
                .fetch_all(pool)
                .await?;
        Ok(rows.into_iter().map(|(id,)| id).collect())
    }

    pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query(
            "UPDATE skills SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND is_deleted = FALSE",
        )
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(
                ApiError::not_found(format!("Skill with ID {} not found", id))
                    .with_code(codes::ENTITY_NOT_FOUND)
                    .with_entity_type("skill"),
            );
        }

        Ok(())
    }

    /// Restore a soft-deleted skill from trash.
    pub async fn restore(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query(
            "UPDATE skills SET is_deleted = FALSE, deleted_at = NULL, updated_at = NOW() WHERE id = $1 AND is_deleted = TRUE",
        )
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(
                ApiError::not_found(format!("Skill with ID {} not found in trash", id))
                    .with_code(codes::ENTITY_NOT_FOUND)
                    .with_entity_type("skill"),
            );
        }

        Ok(())
    }

    /// Permanently delete a soft-deleted skill. Junction rows in `skill_sites`,
    /// `skill_localizations`, `project_skills`, and `cv_entry_skills` cascade.
    pub async fn permanent_delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM skills WHERE id = $1 AND is_deleted = TRUE")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(
                ApiError::not_found(format!("Skill with ID {} not found in trash", id))
                    .with_code(codes::ENTITY_NOT_FOUND)
                    .with_entity_type("skill"),
            );
        }

        Ok(())
    }

    /// Hard-delete skills soft-deleted before the retention cutoff. Returns the
    /// number purged. Driven by the trash cleanup worker; mirrors
    /// `ContentService::purge_expired_trash` for the (non-content-spine) skills.
    pub async fn purge_expired(pool: &PgPool, retention_days: i64) -> Result<u64, ApiError> {
        let cutoff = chrono::Utc::now() - chrono::TimeDelta::days(retention_days);
        let result = sqlx::query(
            "DELETE FROM skills WHERE is_deleted = TRUE AND deleted_at IS NOT NULL AND deleted_at < $1",
        )
        .bind(cutoff)
        .execute(pool)
        .await?;
        Ok(result.rows_affected())
    }
}

pub struct CvEntryRepo;

impl CvEntryRepo {
    pub async fn count_for_site(
        pool: &PgPool,
        site_id: Uuid,
        entry_type: Option<CvEntryType>,
    ) -> Result<i64, ApiError> {
        let mut query = ContentQuery::new("cv_entries", site_id);
        if let Some(et) = entry_type {
            query = query.with_entity_filter("e.entry_type::text", entry_type_to_text(&et));
        }
        query.count_only(pool).await
    }

    pub async fn count_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        entry_type: Option<CvEntryType>,
        search: Option<&str>,
    ) -> Result<i64, ApiError> {
        let mut query = ContentQuery::new("cv_entries", site_id);
        if let Some(et) = entry_type {
            query = query.with_entity_filter("e.entry_type::text", entry_type_to_text(&et));
        }
        if let Some(s) = search {
            query = query.with_search(CV_ENTRY_SEARCH_COLUMNS, s);
        }
        query.count_only(pool).await
    }

    pub async fn find_all_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        entry_type: Option<CvEntryType>,
        params: &ListParams,
    ) -> Result<Vec<CvEntry>, ApiError> {
        let (limit, offset) = params.limit_offset();
        let order_col = match params.sort.field_or("display_order") {
            "display_order" => "e.display_order",
            "start_date" => "e.start_date",
            "created_at" => "e.created_at",
            _ => "e.display_order",
        };

        let mut query = ContentQuery::new("cv_entries", site_id)
            .order_by_dir(order_col, params.sort.sort_dir.as_deref())
            .paginate(limit, offset);
        if let Some(et) = entry_type {
            query = query.with_entity_filter("e.entry_type::text", entry_type_to_text(&et));
        }
        if let Some(s) = params.search_ref() {
            query = query.with_search(CV_ENTRY_SEARCH_COLUMNS, s);
        }

        let (rows, _) = query.execute::<CvEntry>(pool).await?;
        Ok(rows)
    }

    pub async fn find_all_for_site(
        pool: &PgPool,
        site_id: Uuid,
        entry_type: Option<CvEntryType>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<CvEntry>, ApiError> {
        // Filtered and unfiltered lists order differently: a single-type list
        // drops the leading entry_type sort key the mixed list needs.
        let query = ContentQuery::new("cv_entries", site_id).paginate(limit, offset);
        let query = if let Some(et) = entry_type {
            query
                .with_entity_filter("e.entry_type::text", entry_type_to_text(&et))
                .order_by("e.display_order ASC, e.start_date DESC")
        } else {
            query.order_by("e.entry_type ASC, e.display_order ASC, e.start_date DESC")
        };
        let (rows, _) = query.execute::<CvEntry>(pool).await?;
        Ok(rows)
    }

    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<CvEntry, ApiError> {
        let entry = sqlx::query_as::<_, CvEntry>(
            r#"
            SELECT id, content_id, company, company_url, company_logo_id,
                   location, start_date, end_date, is_current, entry_type,
                   display_order, created_at, updated_at
            FROM cv_entries
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("CV entry with ID {} not found", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("cv_entry")
        })?;

        Ok(entry)
    }

    /// Create a CV entry + spine row + localizations/skills on the caller's
    /// transaction connection (#864). cv_entry is a `ContentEntity`, so the
    /// generic `content_lifecycle::create` owns the `tx` and commits once —
    /// a failure mid-insert leaves no orphaned `contents` row.
    pub async fn create(
        conn: &mut PgConnection,
        req: CreateCvEntryRequest,
        created_by: Option<&str>,
    ) -> Result<CvEntry, ApiError> {
        let content_id = ContentService::create_content(
            &mut *conn,
            "cv_entry",
            None,
            &req.status,
            &req.site_ids,
            None,
            None,
            created_by,
        )
        .await?;

        let entry = sqlx::query_as::<_, CvEntry>(
            r#"
            INSERT INTO cv_entries (content_id, company, company_url, company_logo_id,
                                   location, start_date, end_date, is_current, entry_type, display_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, content_id, company, company_url, company_logo_id,
                      location, start_date, end_date, is_current, entry_type,
                      display_order, created_at, updated_at
            "#,
        )
        .bind(content_id)
        .bind(&req.company)
        .bind(&req.company_url)
        .bind(req.company_logo_id)
        .bind(&req.location)
        .bind(req.start_date)
        .bind(req.end_date)
        .bind(req.is_current)
        .bind(&req.entry_type)
        .bind(req.display_order)
        .fetch_one(&mut *conn)
        .await?;

        if let Some(localizations) = req.localizations {
            Self::set_localizations(&mut *conn, entry.id, localizations).await?;
        }
        if let Some(skill_ids) = req.skill_ids {
            Self::set_skills(&mut *conn, entry.id, skill_ids).await?;
        }

        Ok(entry)
    }

    /// Update a CV entry + spine row + localizations/skills on the caller's
    /// transaction connection (#895). cv_entry is a `ContentUpdate`, so the
    /// generic `content_lifecycle::update` owns the `tx` and commits once —
    /// this runs everything on `conn` rather than opening its own transaction.
    pub async fn update(
        conn: &mut PgConnection,
        id: Uuid,
        req: UpdateCvEntryRequest,
    ) -> Result<CvEntry, ApiError> {
        // Fetch the spine `content_id` on the same connection (mirrors
        // `find_by_id`'s `WHERE id = $1` — cv_entries carries no soft-delete
        // column; that lives on the spine). `None` → entry has no spine row,
        // so there's no `contents` status to update.
        let content_id = sqlx::query_scalar::<_, Option<Uuid>>(
            "SELECT content_id FROM cv_entries WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&mut *conn)
        .await?
        .flatten();

        if let Some(content_id) = content_id {
            ContentService::update_content(
                &mut *conn,
                content_id,
                None,
                req.status.as_ref(),
                None,
                None,
            )
            .await?;
        }

        let entry = sqlx::query_as::<_, CvEntry>(
            r#"
            UPDATE cv_entries
            SET company = COALESCE($2, company),
                company_url = COALESCE($3, company_url),
                company_logo_id = COALESCE($4, company_logo_id),
                location = COALESCE($5, location),
                start_date = COALESCE($6, start_date),
                end_date = COALESCE($7, end_date),
                is_current = COALESCE($8, is_current),
                entry_type = COALESCE($9, entry_type),
                display_order = COALESCE($10, display_order),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, content_id, company, company_url, company_logo_id,
                      location, start_date, end_date, is_current, entry_type,
                      display_order, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&req.company)
        .bind(&req.company_url)
        .bind(req.company_logo_id)
        .bind(&req.location)
        .bind(req.start_date)
        .bind(req.end_date)
        .bind(req.is_current)
        .bind(&req.entry_type)
        .bind(req.display_order)
        .fetch_optional(&mut *conn)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("CV entry with ID {} not found", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("cv_entry")
        })?;

        if let Some(localizations) = req.localizations {
            Self::set_localizations(&mut *conn, id, localizations).await?;
        }
        if let Some(skill_ids) = req.skill_ids {
            Self::set_skills(&mut *conn, id, skill_ids).await?;
        }

        Ok(entry)
    }

    pub async fn set_localizations(
        conn: &mut PgConnection,
        cv_entry_id: Uuid,
        localizations: Vec<CvEntryLocalizationInput>,
    ) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM cv_entry_localizations WHERE cv_entry_id = $1")
            .bind(cv_entry_id)
            .execute(&mut *conn)
            .await?;
        for loc in &localizations {
            sqlx::query(
                r#"
                INSERT INTO cv_entry_localizations (cv_entry_id, locale_id, position, description, achievements)
                VALUES ($1, $2, $3, $4, $5)
                "#,
            )
            .bind(cv_entry_id)
            .bind(loc.locale_id)
            .bind(&loc.position)
            .bind(&loc.description)
            .bind(&loc.achievements)
            .execute(&mut *conn)
            .await?;
        }
        Ok(())
    }

    pub async fn get_localizations(
        pool: &PgPool,
        cv_entry_id: Uuid,
    ) -> Result<Vec<CvEntryLocalization>, ApiError> {
        let rows = sqlx::query_as::<_, CvEntryLocalization>(
            r#"
            SELECT id, cv_entry_id, locale_id, position, description, achievements
            FROM cv_entry_localizations
            WHERE cv_entry_id = $1
            "#,
        )
        .bind(cv_entry_id)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    pub async fn set_skills(
        conn: &mut PgConnection,
        cv_entry_id: Uuid,
        skill_ids: Vec<Uuid>,
    ) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM cv_entry_skills WHERE cv_entry_id = $1")
            .bind(cv_entry_id)
            .execute(&mut *conn)
            .await?;
        for skill_id in &skill_ids {
            sqlx::query("INSERT INTO cv_entry_skills (cv_entry_id, skill_id) VALUES ($1, $2)")
                .bind(cv_entry_id)
                .bind(skill_id)
                .execute(&mut *conn)
                .await?;
        }
        Ok(())
    }

    pub async fn get_skill_ids(pool: &PgPool, cv_entry_id: Uuid) -> Result<Vec<Uuid>, ApiError> {
        let rows: Vec<(Uuid,)> =
            sqlx::query_as("SELECT skill_id FROM cv_entry_skills WHERE cv_entry_id = $1")
                .bind(cv_entry_id)
                .fetch_all(pool)
                .await?;
        Ok(rows.into_iter().map(|(id,)| id).collect())
    }

    /// Bulk-fetch the `cv_entry_id → skill_ids` map for a page of entries in
    /// one SQL query. Entries with no linked skills are absent from the map;
    /// callers should default to an empty vec. Empty input short-circuits
    /// without hitting the DB.
    pub async fn skill_ids_for_entries(
        pool: &PgPool,
        cv_entry_ids: &[Uuid],
    ) -> Result<HashMap<Uuid, Vec<Uuid>>, ApiError> {
        if cv_entry_ids.is_empty() {
            return Ok(HashMap::new());
        }
        let rows: Vec<(Uuid, Uuid)> = sqlx::query_as(
            "SELECT cv_entry_id, skill_id FROM cv_entry_skills WHERE cv_entry_id = ANY($1)",
        )
        .bind(cv_entry_ids)
        .fetch_all(pool)
        .await?;
        let mut map: HashMap<Uuid, Vec<Uuid>> = HashMap::with_capacity(cv_entry_ids.len());
        for (cv_entry_id, skill_id) in rows {
            map.entry(cv_entry_id).or_default().push(skill_id);
        }
        Ok(map)
    }

    /// Bulk-fetch `cv_entry_localizations` rows for a set of CV entry ids in
    /// one SQL query. Entries with no localizations are simply absent from
    /// the result; callers group by `cv_entry_id` and default to an empty
    /// vec. Empty input short-circuits without hitting the DB.
    pub async fn find_localizations_for_entries(
        pool: &PgPool,
        cv_entry_ids: &[Uuid],
    ) -> Result<Vec<CvEntryLocalization>, ApiError> {
        if cv_entry_ids.is_empty() {
            return Ok(Vec::new());
        }
        let rows = sqlx::query_as::<_, CvEntryLocalization>(
            r#"
            SELECT id, cv_entry_id, locale_id, position, description, achievements
            FROM cv_entry_localizations
            WHERE cv_entry_id = ANY($1)
            ORDER BY cv_entry_id, locale_id
            "#,
        )
        .bind(cv_entry_ids)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    pub async fn find_site_ids(pool: &PgPool, cv_entry_id: Uuid) -> Result<Vec<Uuid>, ApiError> {
        let rows: Vec<(Uuid,)> = sqlx::query_as(
            r#"
            SELECT cs.site_id
            FROM cv_entries e
            INNER JOIN content_sites cs ON e.content_id = cs.content_id
            WHERE e.id = $1
            "#,
        )
        .bind(cv_entry_id)
        .fetch_all(pool)
        .await?;
        Ok(rows.into_iter().map(|(id,)| id).collect())
    }

    pub async fn reorder(pool: &PgPool, items: &[(Uuid, i16)]) -> Result<(), ApiError> {
        let mut tx = pool.begin().await?;
        for (id, display_order) in items {
            sqlx::query(
                "UPDATE cv_entries SET display_order = $1, updated_at = NOW() WHERE id = $2",
            )
            .bind(display_order)
            .bind(id)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;
        Ok(())
    }

    pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let entry = Self::find_by_id(pool, id).await?;
        if let Some(content_id) = entry.content_id {
            ContentService::soft_delete_content(pool, content_id).await
        } else {
            Err(ApiError::bad_request("CV entry has no content_id"))
        }
    }
}
