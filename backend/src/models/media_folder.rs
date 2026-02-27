//! Media folder model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::media_folder::{CreateMediaFolderRequest, UpdateMediaFolderRequest};
use crate::errors::ApiError;

/// Media folder model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MediaFolder {
    pub id: Uuid,
    pub site_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub name: String,
    pub display_order: i16,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl MediaFolder {
    pub async fn find_all_for_site(pool: &PgPool, site_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let folders = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, parent_id, name, display_order, created_at, updated_at
            FROM media_folders
            WHERE site_id = $1
            ORDER BY display_order ASC, name ASC
            "#,
        )
        .bind(site_id)
        .fetch_all(pool)
        .await?;

        Ok(folders)
    }

    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let folder = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, parent_id, name, display_order, created_at, updated_at
            FROM media_folders
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Media folder with ID {} not found", id)))?;

        Ok(folder)
    }

    pub async fn create(
        pool: &PgPool,
        site_id: Uuid,
        req: CreateMediaFolderRequest,
    ) -> Result<Self, ApiError> {
        let folder = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO media_folders (site_id, parent_id, name, display_order)
            VALUES ($1, $2, $3, $4)
            RETURNING id, site_id, parent_id, name, display_order, created_at, updated_at
            "#,
        )
        .bind(site_id)
        .bind(req.parent_id)
        .bind(&req.name)
        .bind(req.display_order)
        .fetch_one(pool)
        .await?;

        Ok(folder)
    }

    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdateMediaFolderRequest,
    ) -> Result<Self, ApiError> {
        let folder = sqlx::query_as::<_, Self>(
            r#"
            UPDATE media_folders
            SET name = COALESCE($2, name),
                parent_id = COALESCE($3, parent_id),
                display_order = COALESCE($4, display_order),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, site_id, parent_id, name, display_order, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&req.name)
        .bind(req.parent_id)
        .bind(req.display_order)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Media folder with ID {} not found", id)))?;

        Ok(folder)
    }

    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM media_folders WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!(
                "Media folder with ID {} not found",
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
    fn test_media_folder_serialization() {
        let folder = MediaFolder {
            id: Uuid::new_v4(),
            site_id: Uuid::new_v4(),
            parent_id: None,
            name: "Photos".to_string(),
            display_order: 0,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&folder).unwrap();
        assert!(json.contains("\"name\":\"Photos\""));
    }
}
