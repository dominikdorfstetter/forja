//! Locale model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::locale::{CreateLocaleRequest, UpdateLocaleRequest};
use crate::errors::ApiError;

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
        .ok_or_else(|| ApiError::NotFound(format!("Locale with ID {} not found", id)))?;

        Ok(locale)
    }

    /// Find locale by code
    pub async fn find_by_code(pool: &PgPool, code: &str) -> Result<Self, ApiError> {
        let locale = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, code, name, native_name, direction, is_active, created_at
            FROM locales
            WHERE code = $1
            "#,
        )
        .bind(code)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Locale with code '{}' not found", code)))?;

        Ok(locale)
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
            return Err(ApiError::Conflict(format!(
                "Locale with code '{}' already exists",
                req.code
            )));
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
        .ok_or_else(|| ApiError::NotFound(format!("Locale with ID {} not found", id)))?;

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
            return Err(ApiError::Conflict(
                "Cannot delete: locale is assigned to one or more sites".to_string(),
            ));
        }

        let result = sqlx::query("DELETE FROM locales WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!(
                "Locale with ID {} not found",
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
