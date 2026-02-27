//! CV/Resume model

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::cv::{
    CreateCvEntryRequest, CreateSkillRequest, UpdateCvEntryRequest, UpdateSkillRequest,
};
use crate::errors::ApiError;
use crate::services::content_service::ContentService;

/// CV entry type enum matching PostgreSQL
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, utoipa::ToSchema)]
#[sqlx(type_name = "cv_entry_type", rename_all = "lowercase")]
#[derive(Default)]
pub enum CvEntryType {
    #[default]
    Work,
    Education,
    Volunteer,
    Certification,
    Project,
}

/// Skill category enum matching PostgreSQL
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, utoipa::ToSchema)]
#[sqlx(type_name = "skill_category", rename_all = "lowercase")]
pub enum SkillCategory {
    Programming,
    Framework,
    Database,
    Devops,
    Language,
    #[sqlx(rename = "soft_skill")]
    SoftSkill,
    Tool,
    Other,
}

/// Skill model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Skill {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub category: Option<SkillCategory>,
    pub icon: Option<String>,
    pub proficiency_level: Option<i16>,
    pub is_global: bool,
    pub is_deleted: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// CV entry model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CvEntry {
    pub id: Uuid,
    pub content_id: Option<Uuid>,
    pub company: String,
    pub company_url: Option<String>,
    pub company_logo_id: Option<Uuid>,
    pub location: String,
    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    pub is_current: bool,
    pub entry_type: CvEntryType,
    pub display_order: i16,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Skill {
    /// Count skills for a site
    pub async fn count_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM skills s INNER JOIN skill_sites ss ON s.id = ss.skill_id WHERE ss.site_id = $1 AND s.is_deleted = FALSE"
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;
        Ok(row.0)
    }

    /// Find all skills for a site
    pub async fn find_all_for_site(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Self>, ApiError> {
        let skills = sqlx::query_as::<_, Self>(
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

    /// Find skill by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let skill = sqlx::query_as::<_, Self>(
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
        .ok_or_else(|| ApiError::NotFound(format!("Skill with ID {} not found", id)))?;

        Ok(skill)
    }

    /// Find skill by slug
    pub async fn find_by_slug(pool: &PgPool, slug: &str) -> Result<Self, ApiError> {
        let skill = sqlx::query_as::<_, Self>(
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
        .ok_or_else(|| ApiError::NotFound(format!("Skill with slug '{}' not found", slug)))?;

        Ok(skill)
    }

    /// Create a new skill with site associations
    pub async fn create(pool: &PgPool, req: CreateSkillRequest) -> Result<Self, ApiError> {
        let mut tx = pool.begin().await?;

        let skill = sqlx::query_as::<_, Self>(
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

    /// Update a skill
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdateSkillRequest,
    ) -> Result<Self, ApiError> {
        let skill = sqlx::query_as::<_, Self>(
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
        .ok_or_else(|| ApiError::NotFound(format!("Skill with ID {} not found", id)))?;

        Ok(skill)
    }

    /// Soft delete a skill
    pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query(
            "UPDATE skills SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1 AND is_deleted = FALSE",
        )
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!(
                "Skill with ID {} not found",
                id
            )));
        }

        Ok(())
    }
}

impl CvEntry {
    /// Count CV entries for a site, optionally filtered by type
    pub async fn count_for_site(
        pool: &PgPool,
        site_id: Uuid,
        entry_type: Option<CvEntryType>,
    ) -> Result<i64, ApiError> {
        let row: (i64,) = if let Some(ref et) = entry_type {
            sqlx::query_as(
                "SELECT COUNT(*) FROM cv_entries e INNER JOIN contents c ON e.content_id = c.id INNER JOIN content_sites cs ON c.id = cs.content_id WHERE cs.site_id = $1 AND e.entry_type = $2 AND c.is_deleted = FALSE"
            )
            .bind(site_id)
            .bind(et)
            .fetch_one(pool)
            .await?
        } else {
            sqlx::query_as(
                "SELECT COUNT(*) FROM cv_entries e INNER JOIN contents c ON e.content_id = c.id INNER JOIN content_sites cs ON c.id = cs.content_id WHERE cs.site_id = $1 AND c.is_deleted = FALSE"
            )
            .bind(site_id)
            .fetch_one(pool)
            .await?
        };
        Ok(row.0)
    }

    /// Find all CV entries for a site
    pub async fn find_all_for_site(
        pool: &PgPool,
        site_id: Uuid,
        entry_type: Option<CvEntryType>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Self>, ApiError> {
        let entries = if let Some(et) = entry_type {
            sqlx::query_as::<_, Self>(
                r#"
                SELECT e.id, e.content_id, e.company, e.company_url, e.company_logo_id,
                       e.location, e.start_date, e.end_date, e.is_current, e.entry_type,
                       e.display_order, e.created_at, e.updated_at
                FROM cv_entries e
                INNER JOIN contents c ON e.content_id = c.id
                INNER JOIN content_sites cs ON c.id = cs.content_id
                WHERE cs.site_id = $1 AND e.entry_type = $2 AND c.is_deleted = FALSE
                ORDER BY e.display_order ASC, e.start_date DESC
                LIMIT $3 OFFSET $4
                "#,
            )
            .bind(site_id)
            .bind(et)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?
        } else {
            sqlx::query_as::<_, Self>(
                r#"
                SELECT e.id, e.content_id, e.company, e.company_url, e.company_logo_id,
                       e.location, e.start_date, e.end_date, e.is_current, e.entry_type,
                       e.display_order, e.created_at, e.updated_at
                FROM cv_entries e
                INNER JOIN contents c ON e.content_id = c.id
                INNER JOIN content_sites cs ON c.id = cs.content_id
                WHERE cs.site_id = $1 AND c.is_deleted = FALSE
                ORDER BY e.entry_type ASC, e.display_order ASC, e.start_date DESC
                LIMIT $2 OFFSET $3
                "#,
            )
            .bind(site_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?
        };

        Ok(entries)
    }

    /// Find CV entry by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let entry = sqlx::query_as::<_, Self>(
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
        .ok_or_else(|| ApiError::NotFound(format!("CV entry with ID {} not found", id)))?;

        Ok(entry)
    }

    /// Create a CV entry with associated content
    pub async fn create(pool: &PgPool, req: CreateCvEntryRequest) -> Result<Self, ApiError> {
        let content_id = ContentService::create_content(
            pool,
            "cv_entry",
            None,
            &req.status,
            &req.site_ids,
            None,
            None,
        )
        .await?;

        let entry = sqlx::query_as::<_, Self>(
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
        .fetch_one(pool)
        .await?;

        Ok(entry)
    }

    /// Update a CV entry
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdateCvEntryRequest,
    ) -> Result<Self, ApiError> {
        let existing = Self::find_by_id(pool, id).await?;

        if let Some(content_id) = existing.content_id {
            ContentService::update_content(pool, content_id, None, req.status.as_ref(), None, None)
                .await?;
        }

        let entry = sqlx::query_as::<_, Self>(
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
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("CV entry with ID {} not found", id)))?;

        Ok(entry)
    }

    /// Soft delete a CV entry (via content)
    pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let entry = Self::find_by_id(pool, id).await?;
        if let Some(content_id) = entry.content_id {
            ContentService::soft_delete_content(pool, content_id).await
        } else {
            Err(ApiError::BadRequest(
                "CV entry has no content_id".to_string(),
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cv_entry_type_serialization() {
        let entry_type = CvEntryType::Education;
        let json = serde_json::to_string(&entry_type).unwrap();
        assert_eq!(json, "\"Education\"");
    }

    #[test]
    fn test_skill_category_serialization() {
        let category = SkillCategory::Programming;
        let json = serde_json::to_string(&category).unwrap();
        assert_eq!(json, "\"Programming\"");
    }
}
