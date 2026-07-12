//! Locale model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::locale::{CreateLocaleRequest, UpdateLocaleRequest};
use crate::errors::ApiError;
use crate::errors::codes;

/// Text direction enum matching PostgreSQL
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, utoipa::ToSchema)]
#[sqlx(type_name = "text_direction", rename_all = "lowercase")]
pub enum TextDirection {
    Ltr,
    Rtl,
}

/// Locale model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Locale {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub native_name: Option<String>,
    pub direction: TextDirection,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

/// Locale with usage count (for admin list)
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LocaleWithUsage {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub native_name: Option<String>,
    pub direction: TextDirection,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub site_count: i64,
}

impl Locale {
    /// Find all active locales
    pub async fn find_all(pool: &PgPool) -> Result<Vec<Self>, ApiError> {
        let locales = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, code, name, native_name, direction, is_active, created_at
            FROM locales
            WHERE is_active = TRUE
            ORDER BY code ASC
            "#,
        )
        .fetch_all(pool)
        .await?;

        Ok(locales)
    }

    /// Find all locales including inactive ones (for admin)
    pub async fn find_all_including_inactive(pool: &PgPool) -> Result<Vec<Self>, ApiError> {
        let locales = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, code, name, native_name, direction, is_active, created_at
            FROM locales
            ORDER BY code ASC
            "#,
        )
        .fetch_all(pool)
        .await?;

        Ok(locales)
    }

    /// Find all locales including inactive ones with site usage count (for admin)
    pub async fn find_all_with_usage(pool: &PgPool) -> Result<Vec<LocaleWithUsage>, ApiError> {
        let locales = sqlx::query_as::<_, LocaleWithUsage>(
            r#"
            SELECT l.id, l.code, l.name, l.native_name, l.direction, l.is_active, l.created_at,
                   COUNT(sl.site_id)::bigint AS site_count
            FROM locales l
            LEFT JOIN site_locales sl ON sl.locale_id = l.id
            GROUP BY l.id, l.code, l.name, l.native_name, l.direction, l.is_active, l.created_at
            ORDER BY l.code ASC
            "#,
        )
        .fetch_all(pool)
        .await?;

        Ok(locales)
    }

    /// Find locale by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let locale = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, code, name, native_name, direction, is_active, created_at
            FROM locales
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Locale with ID {} not found", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("locale")
        })?;

        Ok(locale)
    }

    /// Find locale by code; `Ok(None)` when the code is unknown.
    pub async fn find_by_code_opt(pool: &PgPool, code: &str) -> Result<Option<Self>, ApiError> {
        let locale = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, code, name, native_name, direction, is_active, created_at
            FROM locales
            WHERE code = $1
            "#,
        )
        .bind(code)
        .fetch_optional(pool)
        .await?;

        Ok(locale)
    }

    /// Find locale by code
    pub async fn find_by_code(pool: &PgPool, code: &str) -> Result<Self, ApiError> {
        Self::find_by_code_opt(pool, code).await?.ok_or_else(|| {
            ApiError::not_found(format!("Locale with code '{}' not found", code))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("locale")
        })
    }

    /// Resolve a locale identifier — a UUID *or* a code like `"de"` — to its id.
    /// `Ok(None)` when the locale is unknown (callers fall back to the default).
    pub async fn find_id_by_id_or_code(
        pool: &PgPool,
        identifier: &str,
    ) -> Result<Option<Uuid>, ApiError> {
        if let Ok(id) = Uuid::parse_str(identifier) {
            let exists: Option<Uuid> = sqlx::query_scalar("SELECT id FROM locales WHERE id = $1")
                .bind(id)
                .fetch_optional(pool)
                .await?;
            return Ok(exists);
        }
        let row: Option<Uuid> = sqlx::query_scalar("SELECT id FROM locales WHERE code = $1")
            .bind(identifier)
            .fetch_optional(pool)
            .await?;
        Ok(row)
    }

    /// Create a new locale
    pub async fn create(pool: &PgPool, req: &CreateLocaleRequest) -> Result<Self, ApiError> {
        // Check for duplicate code
        let exists =
            sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM locales WHERE code = $1)")
                .bind(&req.code)
                .fetch_one(pool)
                .await?;

        if exists {
            return Err(ApiError::conflict(format!(
                "Locale with code '{}' already exists",
                req.code
            ))
            .with_code(codes::LOCALE_CODE_TAKEN));
        }

        let locale = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO locales (code, name, native_name, direction, is_active)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, code, name, native_name, direction, is_active, created_at
            "#,
        )
        .bind(&req.code)
        .bind(&req.name)
        .bind(&req.native_name)
        .bind(&req.direction)
        .bind(req.is_active)
        .fetch_one(pool)
        .await?;

        Ok(locale)
    }

    /// Update a locale (partial update using COALESCE)
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: &UpdateLocaleRequest,
    ) -> Result<Self, ApiError> {
        let locale = sqlx::query_as::<_, Self>(
            r#"
            UPDATE locales
            SET name = COALESCE($2, name),
                native_name = COALESCE($3, native_name),
                direction = COALESCE($4, direction),
                is_active = COALESCE($5, is_active)
            WHERE id = $1
            RETURNING id, code, name, native_name, direction, is_active, created_at
            "#,
        )
        .bind(id)
        .bind(&req.name)
        .bind(&req.native_name)
        .bind(&req.direction)
        .bind(req.is_active)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Locale with ID {} not found", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("locale")
        })?;

        Ok(locale)
    }

    /// Delete a locale (hard delete, checks site_locales references first)
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        // Check if locale is assigned to any sites
        let in_use = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM site_locales WHERE locale_id = $1)",
        )
        .bind(id)
        .fetch_one(pool)
        .await?;

        if in_use {
            return Err(ApiError::conflict(
                "Cannot delete: locale is assigned to one or more sites",
            )
            .with_code(codes::LOCALE_DELETE_IN_USE));
        }

        let result = sqlx::query("DELETE FROM locales WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(
                ApiError::not_found(format!("Locale with ID {} not found", id))
                    .with_code(codes::ENTITY_NOT_FOUND)
                    .with_entity_type("locale"),
            );
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_text_direction_serialization() {
        let dir = TextDirection::Ltr;
        let json = serde_json::to_string(&dir).unwrap();
        assert_eq!(json, "\"Ltr\"");
    }

    #[test]
    fn test_text_direction_deserialization() {
        let dir: TextDirection = serde_json::from_str("\"Rtl\"").unwrap();
        assert_eq!(dir, TextDirection::Rtl);
    }
}
