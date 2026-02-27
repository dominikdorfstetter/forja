//! User model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::models::api_key::ApiKeyPermission;

/// User role enum matching PostgreSQL
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, utoipa::ToSchema)]
#[sqlx(type_name = "user_role", rename_all = "lowercase")]
pub enum UserRole {
    Owner,
    Admin,
    Editor,
    Author,
    Viewer,
}

impl Default for UserRole {
    fn default() -> Self {
        Self::Viewer
    }
}

impl UserRole {
    /// Maximum API key permission level for this user role.
    /// Owner → Master, Admin → Admin, Editor/Author → Write, Viewer → Read
    pub fn max_api_key_permission(&self) -> ApiKeyPermission {
        match self {
            UserRole::Owner => ApiKeyPermission::Master,
            UserRole::Admin => ApiKeyPermission::Admin,
            UserRole::Editor | UserRole::Author => ApiKeyPermission::Write,
            UserRole::Viewer => ApiKeyPermission::Read,
        }
    }
}

/// User model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub is_active: bool,
    pub is_superadmin: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// User site access
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserSite {
    pub user_id: Uuid,
    pub site_id: Uuid,
    pub role: UserRole,
    pub permissions: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

impl User {
    /// Find user by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let user = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, username, email, first_name, last_name, display_name, avatar_url,
                   is_active, is_superadmin, created_at, updated_at
            FROM users
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("User with ID {} not found", id)))?;

        Ok(user)
    }

    /// Find user by username
    pub async fn find_by_username(pool: &PgPool, username: &str) -> Result<Self, ApiError> {
        let user = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, username, email, first_name, last_name, display_name, avatar_url,
                   is_active, is_superadmin, created_at, updated_at
            FROM users
            WHERE username = $1
            "#,
        )
        .bind(username)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("User '{}' not found", username)))?;

        Ok(user)
    }

    /// Find user by email
    pub async fn find_by_email(pool: &PgPool, email: &str) -> Result<Self, ApiError> {
        let user = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, username, email, first_name, last_name, display_name, avatar_url,
                   is_active, is_superadmin, created_at, updated_at
            FROM users
            WHERE email = $1
            "#,
        )
        .bind(email)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("User with email '{}' not found", email)))?;

        Ok(user)
    }

    /// Find all users with access to a site
    pub async fn find_for_site(pool: &PgPool, site_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let users = sqlx::query_as::<_, Self>(
            r#"
            SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.display_name, u.avatar_url,
                   u.is_active, u.is_superadmin, u.created_at, u.updated_at
            FROM users u
            INNER JOIN user_sites us ON u.id = us.user_id
            WHERE us.site_id = $1 AND u.is_active = TRUE
            ORDER BY u.username ASC
            "#,
        )
        .bind(site_id)
        .fetch_all(pool)
        .await?;

        Ok(users)
    }

    /// Create a new user
    pub async fn create(
        pool: &PgPool,
        username: &str,
        email: &str,
        first_name: Option<&str>,
        last_name: Option<&str>,
        display_name: Option<&str>,
        avatar_url: Option<&str>,
        is_superadmin: bool,
    ) -> Result<Self, ApiError> {
        let user = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO users (username, email, first_name, last_name, display_name, avatar_url, is_superadmin)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, username, email, first_name, last_name, display_name, avatar_url,
                      is_active, is_superadmin, created_at, updated_at
            "#,
        )
        .bind(username)
        .bind(email)
        .bind(first_name)
        .bind(last_name)
        .bind(display_name)
        .bind(avatar_url)
        .bind(is_superadmin)
        .fetch_one(pool)
        .await?;

        Ok(user)
    }

    /// Update a user
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        username: Option<&str>,
        email: Option<&str>,
        first_name: Option<Option<&str>>,
        last_name: Option<Option<&str>>,
        display_name: Option<Option<&str>>,
        avatar_url: Option<Option<&str>>,
        is_active: Option<bool>,
        is_superadmin: Option<bool>,
    ) -> Result<Self, ApiError> {
        let user = sqlx::query_as::<_, Self>(
            r#"
            UPDATE users
            SET username = COALESCE($2, username),
                email = COALESCE($3, email),
                first_name = CASE WHEN $4 THEN $5 ELSE first_name END,
                last_name = CASE WHEN $6 THEN $7 ELSE last_name END,
                display_name = CASE WHEN $8 THEN $9 ELSE display_name END,
                avatar_url = CASE WHEN $10 THEN $11 ELSE avatar_url END,
                is_active = COALESCE($12, is_active),
                is_superadmin = COALESCE($13, is_superadmin),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, username, email, first_name, last_name, display_name, avatar_url,
                      is_active, is_superadmin, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(username)
        .bind(email)
        .bind(first_name.is_some())
        .bind(first_name.flatten())
        .bind(last_name.is_some())
        .bind(last_name.flatten())
        .bind(display_name.is_some())
        .bind(display_name.flatten())
        .bind(avatar_url.is_some())
        .bind(avatar_url.flatten())
        .bind(is_active)
        .bind(is_superadmin)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("User with ID {} not found", id)))?;

        Ok(user)
    }

    /// Delete a user
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!("User with ID {} not found", id)));
        }

        Ok(())
    }

    /// List users with optional active filter
    pub async fn list(
        pool: &PgPool,
        is_active: Option<bool>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Self>, ApiError> {
        let users = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, username, email, first_name, last_name, display_name, avatar_url,
                   is_active, is_superadmin, created_at, updated_at
            FROM users
            WHERE ($1::BOOLEAN IS NULL OR is_active = $1)
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(is_active)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok(users)
    }

    /// Count users
    pub async fn count(pool: &PgPool, is_active: Option<bool>) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*)
            FROM users
            WHERE ($1::BOOLEAN IS NULL OR is_active = $1)
            "#,
        )
        .bind(is_active)
        .fetch_one(pool)
        .await?;

        Ok(row.0)
    }

    /// Get the highest role a user has across all their site assignments
    pub async fn highest_role(pool: &PgPool, user_id: Uuid) -> Result<Option<UserRole>, ApiError> {
        // Role priority: Owner > Admin > Editor > Author > Viewer
        let row: Option<(UserRole,)> = sqlx::query_as(
            r#"
            SELECT role
            FROM user_sites
            WHERE user_id = $1
            ORDER BY CASE role
                WHEN 'owner' THEN 1
                WHEN 'admin' THEN 2
                WHEN 'editor' THEN 3
                WHEN 'author' THEN 4
                WHEN 'viewer' THEN 5
            END ASC
            LIMIT 1
            "#,
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await?;

        Ok(row.map(|(role,)| role))
    }
}

impl UserSite {
    /// Find user's access to a site
    pub async fn find_for_user_site(
        pool: &PgPool,
        user_id: Uuid,
        site_id: Uuid,
    ) -> Result<Option<Self>, ApiError> {
        let access = sqlx::query_as::<_, Self>(
            r#"
            SELECT user_id, site_id, role, permissions, created_at
            FROM user_sites
            WHERE user_id = $1 AND site_id = $2
            "#,
        )
        .bind(user_id)
        .bind(site_id)
        .fetch_optional(pool)
        .await?;

        Ok(access)
    }

    /// Find all site access for a user
    pub async fn find_all_for_user(pool: &PgPool, user_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let access = sqlx::query_as::<_, Self>(
            r#"
            SELECT user_id, site_id, role, permissions, created_at
            FROM user_sites
            WHERE user_id = $1
            "#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?;

        Ok(access)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_role_serialization() {
        let role = UserRole::Editor;
        let json = serde_json::to_string(&role).unwrap();
        assert_eq!(json, "\"Editor\"");
    }

    #[test]
    fn test_user_role_default() {
        let role = UserRole::default();
        assert_eq!(role, UserRole::Viewer);
    }

    #[test]
    fn test_max_api_key_permission() {
        assert_eq!(UserRole::Owner.max_api_key_permission(), ApiKeyPermission::Master);
        assert_eq!(UserRole::Admin.max_api_key_permission(), ApiKeyPermission::Admin);
        assert_eq!(UserRole::Editor.max_api_key_permission(), ApiKeyPermission::Write);
        assert_eq!(UserRole::Author.max_api_key_permission(), ApiKeyPermission::Write);
        assert_eq!(UserRole::Viewer.max_api_key_permission(), ApiKeyPermission::Read);
    }
}
