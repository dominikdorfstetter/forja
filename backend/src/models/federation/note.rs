//! ApNote model — short-form notes posted directly to the Fediverse

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;

/// A short-form note posted directly to the Fediverse (Quick Post).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ApNote {
    pub id: Uuid,
    pub site_id: Uuid,
    pub body: String,
    pub body_html: String,
    pub published_at: DateTime<Utc>,
    pub activity_uri: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

impl ApNote {
    /// Create a new note.
    pub async fn create(
        pool: &PgPool,
        site_id: Uuid,
        body: &str,
        body_html: &str,
        created_by: Option<Uuid>,
    ) -> Result<Self, ApiError> {
        let note = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO ap_notes (site_id, body, body_html, created_by)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(site_id)
        .bind(body)
        .bind(body_html)
        .bind(created_by)
        .fetch_one(pool)
        .await?;

        Ok(note)
    }

    /// Update the activity URI after federation.
    pub async fn set_activity_uri(
        pool: &PgPool,
        id: Uuid,
        activity_uri: &str,
    ) -> Result<(), ApiError> {
        sqlx::query("UPDATE ap_notes SET activity_uri = $2 WHERE id = $1")
            .bind(id)
            .bind(activity_uri)
            .execute(pool)
            .await?;

        Ok(())
    }

    /// Find notes for a site, paginated, newest first.
    pub async fn find_by_site(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Self>, ApiError> {
        let notes = sqlx::query_as::<_, Self>(
            r#"
            SELECT * FROM ap_notes
            WHERE site_id = $1
            ORDER BY published_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(site_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok(notes)
    }

    /// Delete a note by ID.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<Option<Self>, ApiError> {
        let note = sqlx::query_as::<_, Self>("DELETE FROM ap_notes WHERE id = $1 RETURNING *")
            .bind(id)
            .fetch_optional(pool)
            .await?;

        Ok(note)
    }

    /// Count notes for a site.
    pub async fn count_by_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM ap_notes WHERE site_id = $1")
            .bind(site_id)
            .fetch_one(pool)
            .await?;

        Ok(row.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ap_note_struct_fields() {
        let note = ApNote {
            id: Uuid::new_v4(),
            site_id: Uuid::new_v4(),
            body: "Hello Fediverse!".to_string(),
            body_html: "<p>Hello Fediverse!</p>".to_string(),
            published_at: Utc::now(),
            activity_uri: Some("https://example.com/ap/notes/1".to_string()),
            created_by: Some(Uuid::new_v4()),
            created_at: Utc::now(),
        };

        assert_eq!(note.body, "Hello Fediverse!");
        assert!(note.activity_uri.is_some());
        assert!(note.created_by.is_some());
    }

    #[test]
    fn test_ap_note_serialization() {
        let note = ApNote {
            id: Uuid::new_v4(),
            site_id: Uuid::new_v4(),
            body: "Test note".to_string(),
            body_html: "<p>Test note</p>".to_string(),
            published_at: Utc::now(),
            activity_uri: None,
            created_by: None,
            created_at: Utc::now(),
        };

        let json = serde_json::to_value(&note).unwrap();
        assert_eq!(json["body"], "Test note");
        assert!(json["activity_uri"].is_null());
    }
}
