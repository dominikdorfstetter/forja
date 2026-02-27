//! Environment model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;

/// Environment type enum matching PostgreSQL
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, utoipa::ToSchema)]
#[sqlx(type_name = "environment_type", rename_all = "lowercase")]
pub enum EnvironmentType {
    Development,
    Staging,
    Production,
}

/// Environment model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Environment {
    pub id: Uuid,
    pub name: EnvironmentType,
    pub display_name: String,
    pub is_default: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Environment {
    /// Find all environments
    pub async fn find_all(pool: &PgPool) -> Result<Vec<Self>, ApiError> {
        let environments = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, name, display_name, is_default, created_at, updated_at
            FROM environments
            ORDER BY name ASC
            "#,
        )
        .fetch_all(pool)
        .await?;

        Ok(environments)
    }

    /// Find environment by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let environment = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, name, display_name, is_default, created_at, updated_at
            FROM environments
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Environment with ID {} not found", id)))?;

        Ok(environment)
    }

    /// Find the default environment
    pub async fn find_default(pool: &PgPool) -> Result<Self, ApiError> {
        let environment = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, name, display_name, is_default, created_at, updated_at
            FROM environments
            WHERE is_default = TRUE
            LIMIT 1
            "#,
        )
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound("No default environment configured".to_string()))?;

        Ok(environment)
    }

    /// Find environment by name
    pub async fn find_by_name(pool: &PgPool, name: EnvironmentType) -> Result<Self, ApiError> {
        let environment = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, name, display_name, is_default, created_at, updated_at
            FROM environments
            WHERE name = $1
            "#,
        )
        .bind(&name)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Environment {:?} not found", name)))?;

        Ok(environment)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_environment_type_serialization() {
        let env = EnvironmentType::Production;
        let json = serde_json::to_string(&env).unwrap();
        assert_eq!(json, "\"Production\"");
    }

    #[test]
    fn test_environment_type_deserialization() {
        let env: EnvironmentType = serde_json::from_str("\"Development\"").unwrap();
        assert_eq!(env, EnvironmentType::Development);
    }
}
