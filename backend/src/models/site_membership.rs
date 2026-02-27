//! Site membership model
//!
//! Per-site role assignments for Clerk users.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::models::api_key::ApiKeyPermission;

/// Site-scoped roles (ordered from most to least privileged)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, utoipa::ToSchema)]
#[sqlx(type_name = "site_role", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum SiteRole {
    Owner,
    Admin,
    Editor,
    Author,
    Reviewer,
    Viewer,
}

impl SiteRole {
    /// Numeric rank (higher = more privileged)
    pub fn rank(&self) -> u8 {
        match self {
            SiteRole::Owner => 60,
            SiteRole::Admin => 50,
            SiteRole::Editor => 40,
            SiteRole::Author => 30,
            SiteRole::Reviewer => 20,
            SiteRole::Viewer => 10,
        }
    }

    /// Whether this role is at least as privileged as the given minimum
    pub fn has_at_least(&self, min: &SiteRole) -> bool {
        self.rank() >= min.rank()
    }

    pub fn can_manage_members(&self) -> bool {
        matches!(self, SiteRole::Owner | SiteRole::Admin)
    }

    pub fn can_edit_all_content(&self) -> bool {
        matches!(self, SiteRole::Owner | SiteRole::Admin | SiteRole::Editor)
    }

    pub fn can_create_content(&self) -> bool {
        self.rank() >= SiteRole::Author.rank()
    }

    pub fn can_review(&self) -> bool {
        self.rank() >= SiteRole::Reviewer.rank()
    }

    pub fn can_delete_site(&self) -> bool {
        matches!(self, SiteRole::Owner)
    }

    pub fn can_transfer_ownership(&self) -> bool {
        matches!(self, SiteRole::Owner)
    }

    /// Map site role to legacy API key permission for backwards compat
    pub fn to_api_key_permission(&self) -> ApiKeyPermission {
        match self {
            SiteRole::Owner => ApiKeyPermission::Master,
            SiteRole::Admin => ApiKeyPermission::Admin,
            SiteRole::Editor | SiteRole::Author => ApiKeyPermission::Write,
            SiteRole::Reviewer | SiteRole::Viewer => ApiKeyPermission::Read,
        }
    }
}

impl std::fmt::Display for SiteRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SiteRole::Owner => write!(f, "owner"),
            SiteRole::Admin => write!(f, "admin"),
            SiteRole::Editor => write!(f, "editor"),
            SiteRole::Author => write!(f, "author"),
            SiteRole::Reviewer => write!(f, "reviewer"),
            SiteRole::Viewer => write!(f, "viewer"),
        }
    }
}

/// Site membership row
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SiteMembership {
    pub id: Uuid,
    pub clerk_user_id: String,
    pub site_id: Uuid,
    pub role: SiteRole,
    pub invited_by: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl SiteMembership {
    /// Find a membership by Clerk user ID and site ID
    pub async fn find_by_clerk_user_and_site(
        pool: &PgPool,
        clerk_user_id: &str,
        site_id: Uuid,
    ) -> Result<Option<Self>, ApiError> {
        let membership = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, clerk_user_id, site_id, role, invited_by, created_at, updated_at
            FROM site_memberships
            WHERE clerk_user_id = $1 AND site_id = $2
            "#,
        )
        .bind(clerk_user_id)
        .bind(site_id)
        .fetch_optional(pool)
        .await?;

        Ok(membership)
    }

    /// Find all memberships for a Clerk user
    pub async fn find_all_for_clerk_user(
        pool: &PgPool,
        clerk_user_id: &str,
    ) -> Result<Vec<Self>, ApiError> {
        let memberships = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, clerk_user_id, site_id, role, invited_by, created_at, updated_at
            FROM site_memberships
            WHERE clerk_user_id = $1
            ORDER BY created_at ASC
            "#,
        )
        .bind(clerk_user_id)
        .fetch_all(pool)
        .await?;

        Ok(memberships)
    }

    /// Find all memberships for a site
    pub async fn find_all_for_site(pool: &PgPool, site_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let memberships = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, clerk_user_id, site_id, role, invited_by, created_at, updated_at
            FROM site_memberships
            WHERE site_id = $1
            ORDER BY role ASC, created_at ASC
            "#,
        )
        .bind(site_id)
        .fetch_all(pool)
        .await?;

        Ok(memberships)
    }

    /// Create a new membership
    pub async fn create(
        pool: &PgPool,
        clerk_user_id: &str,
        site_id: Uuid,
        role: &SiteRole,
        invited_by: Option<&str>,
    ) -> Result<Self, ApiError> {
        let membership = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO site_memberships (clerk_user_id, site_id, role, invited_by)
            VALUES ($1, $2, $3, $4)
            RETURNING id, clerk_user_id, site_id, role, invited_by, created_at, updated_at
            "#,
        )
        .bind(clerk_user_id)
        .bind(site_id)
        .bind(role)
        .bind(invited_by)
        .fetch_one(pool)
        .await?;

        Ok(membership)
    }

    /// Update the role of an existing membership
    pub async fn update_role(
        pool: &PgPool,
        id: Uuid,
        new_role: &SiteRole,
    ) -> Result<Self, ApiError> {
        let membership = sqlx::query_as::<_, Self>(
            r#"
            UPDATE site_memberships
            SET role = $2, updated_at = NOW()
            WHERE id = $1
            RETURNING id, clerk_user_id, site_id, role, invited_by, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(new_role)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Membership {} not found", id)))?;

        Ok(membership)
    }

    /// Delete a membership
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM site_memberships WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!("Membership {} not found", id)));
        }

        Ok(())
    }

    /// Transfer ownership: demote old owner to Admin, promote new owner to Owner.
    /// Must be called within a transaction conceptually — we use a single TX here.
    pub async fn transfer_ownership(
        pool: &PgPool,
        site_id: Uuid,
        old_owner_clerk_id: &str,
        new_owner_clerk_id: &str,
    ) -> Result<(), ApiError> {
        let mut tx = pool.begin().await?;

        // Demote old owner to Admin
        sqlx::query(
            r#"
            UPDATE site_memberships
            SET role = 'admin', updated_at = NOW()
            WHERE site_id = $1 AND clerk_user_id = $2 AND role = 'owner'
            "#,
        )
        .bind(site_id)
        .bind(old_owner_clerk_id)
        .execute(&mut *tx)
        .await?;

        // Promote new owner — upsert in case they already have a membership
        sqlx::query(
            r#"
            INSERT INTO site_memberships (clerk_user_id, site_id, role, invited_by)
            VALUES ($1, $2, 'owner', $3)
            ON CONFLICT (clerk_user_id, site_id)
            DO UPDATE SET role = 'owner', updated_at = NOW()
            "#,
        )
        .bind(new_owner_clerk_id)
        .bind(site_id)
        .bind(old_owner_clerk_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(())
    }

    /// Count memberships for a site
    pub async fn count_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let (count,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM site_memberships WHERE site_id = $1")
                .bind(site_id)
                .fetch_one(pool)
                .await?;
        Ok(count)
    }

    /// Check if a Clerk user is a system admin
    pub async fn is_system_admin(pool: &PgPool, clerk_user_id: &str) -> Result<bool, ApiError> {
        let row: Option<(String,)> =
            sqlx::query_as("SELECT clerk_user_id FROM system_admins WHERE clerk_user_id = $1")
                .bind(clerk_user_id)
                .fetch_optional(pool)
                .await?;
        Ok(row.is_some())
    }

    /// Check if a Clerk user has at least Admin role on any site
    pub async fn has_admin_on_any_site(
        pool: &PgPool,
        clerk_user_id: &str,
    ) -> Result<bool, ApiError> {
        let row: Option<(Uuid,)> = sqlx::query_as(
            r#"
            SELECT site_id FROM site_memberships
            WHERE clerk_user_id = $1 AND role IN ('owner', 'admin')
            LIMIT 1
            "#,
        )
        .bind(clerk_user_id)
        .fetch_optional(pool)
        .await?;
        Ok(row.is_some())
    }

    /// Find sites owned by a Clerk user (where they are the sole owner)
    pub async fn find_owned_sites(
        pool: &PgPool,
        clerk_user_id: &str,
    ) -> Result<Vec<Uuid>, ApiError> {
        let rows: Vec<(Uuid,)> = sqlx::query_as(
            r#"
            SELECT site_id FROM site_memberships
            WHERE clerk_user_id = $1 AND role = 'owner'
            "#,
        )
        .bind(clerk_user_id)
        .fetch_all(pool)
        .await?;

        Ok(rows.into_iter().map(|(id,)| id).collect())
    }

    /// Check if a site has any other owner besides the given user
    pub async fn site_has_other_owner(
        pool: &PgPool,
        site_id: Uuid,
        clerk_user_id: &str,
    ) -> Result<bool, ApiError> {
        let row: Option<(String,)> = sqlx::query_as(
            r#"
            SELECT clerk_user_id FROM site_memberships
            WHERE site_id = $1 AND role = 'owner' AND clerk_user_id != $2
            LIMIT 1
            "#,
        )
        .bind(site_id)
        .bind(clerk_user_id)
        .fetch_optional(pool)
        .await?;

        Ok(row.is_some())
    }

    /// Delete all memberships for a Clerk user
    pub async fn delete_all_for_clerk_user(
        pool: &PgPool,
        clerk_user_id: &str,
    ) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM site_memberships WHERE clerk_user_id = $1")
            .bind(clerk_user_id)
            .execute(pool)
            .await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_site_role_rank_ordering() {
        assert!(SiteRole::Owner.rank() > SiteRole::Admin.rank());
        assert!(SiteRole::Admin.rank() > SiteRole::Editor.rank());
        assert!(SiteRole::Editor.rank() > SiteRole::Author.rank());
        assert!(SiteRole::Author.rank() > SiteRole::Reviewer.rank());
        assert!(SiteRole::Reviewer.rank() > SiteRole::Viewer.rank());
    }

    #[test]
    fn test_has_at_least() {
        assert!(SiteRole::Owner.has_at_least(&SiteRole::Admin));
        assert!(SiteRole::Admin.has_at_least(&SiteRole::Admin));
        assert!(!SiteRole::Editor.has_at_least(&SiteRole::Admin));
        assert!(SiteRole::Viewer.has_at_least(&SiteRole::Viewer));
    }

    #[test]
    fn test_permission_helpers() {
        assert!(SiteRole::Owner.can_manage_members());
        assert!(SiteRole::Admin.can_manage_members());
        assert!(!SiteRole::Editor.can_manage_members());

        assert!(SiteRole::Editor.can_edit_all_content());
        assert!(!SiteRole::Author.can_edit_all_content());

        assert!(SiteRole::Author.can_create_content());
        assert!(!SiteRole::Reviewer.can_create_content());

        assert!(SiteRole::Reviewer.can_review());
        assert!(!SiteRole::Viewer.can_review());

        assert!(SiteRole::Owner.can_delete_site());
        assert!(!SiteRole::Admin.can_delete_site());

        assert!(SiteRole::Owner.can_transfer_ownership());
        assert!(!SiteRole::Admin.can_transfer_ownership());
    }

    #[test]
    fn test_to_api_key_permission() {
        assert_eq!(
            SiteRole::Owner.to_api_key_permission(),
            ApiKeyPermission::Master
        );
        assert_eq!(
            SiteRole::Admin.to_api_key_permission(),
            ApiKeyPermission::Admin
        );
        assert_eq!(
            SiteRole::Editor.to_api_key_permission(),
            ApiKeyPermission::Write
        );
        assert_eq!(
            SiteRole::Author.to_api_key_permission(),
            ApiKeyPermission::Write
        );
        assert_eq!(
            SiteRole::Reviewer.to_api_key_permission(),
            ApiKeyPermission::Read
        );
        assert_eq!(
            SiteRole::Viewer.to_api_key_permission(),
            ApiKeyPermission::Read
        );
    }

    #[test]
    fn test_site_role_display() {
        assert_eq!(SiteRole::Owner.to_string(), "owner");
        assert_eq!(SiteRole::Admin.to_string(), "admin");
        assert_eq!(SiteRole::Viewer.to_string(), "viewer");
    }
}
