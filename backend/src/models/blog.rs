//! Blog model — pure data structs.
//!
//! All SQL lives in [`repos::blog_repo::BlogRepo`](crate::repos::blog_repo::BlogRepo).

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::content::{ContentLocalization, ContentStatus};

/// Blog with joined content data
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BlogWithContent {
    // Blog fields
    pub id: Uuid,
    pub content_id: Uuid,
    pub author: String,
    pub published_date: NaiveDate,
    pub reading_time_minutes: Option<i16>,
    pub cover_image_id: Option<Uuid>,
    pub header_image_id: Option<Uuid>,
    pub is_featured: bool,
    pub allow_comments: bool,
    pub is_sample: bool,
    // Content fields
    pub slug: Option<String>,
    pub status: ContentStatus,
    pub published_at: Option<DateTime<Utc>>,
    pub publish_start: Option<DateTime<Utc>>,
    pub publish_end: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Blog model (database row)
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Blog {
    pub id: Uuid,
    pub content_id: Uuid,
    pub author: String,
    pub published_date: NaiveDate,
    pub reading_time_minutes: Option<i16>,
    pub cover_image_id: Option<Uuid>,
    pub header_image_id: Option<Uuid>,
    pub is_featured: bool,
    pub allow_comments: bool,
    pub is_sample: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Blog with full details including localizations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlogDetails {
    pub blog: BlogWithContent,
    pub localizations: Vec<ContentLocalization>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_blog_with_content_serialization() {
        let blog = BlogWithContent {
            id: Uuid::new_v4(),
            content_id: Uuid::new_v4(),
            author: "John Doe".to_string(),
            published_date: NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
            reading_time_minutes: Some(5),
            cover_image_id: None,
            header_image_id: None,
            is_featured: true,
            allow_comments: true,
            is_sample: false,
            slug: Some("my-blog-post".to_string()),
            status: ContentStatus::Published,
            published_at: Some(Utc::now()),
            publish_start: None,
            publish_end: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&blog).unwrap();
        assert!(json.contains("\"author\":\"John Doe\""));
        assert!(json.contains("\"is_featured\":true"));
    }
}
