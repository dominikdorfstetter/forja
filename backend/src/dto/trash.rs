//! Trash DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A single item in the trash list.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct TrashItem {
    /// Content ID
    pub id: Uuid,
    /// Entity type name (e.g. "blog", "page")
    pub entity_type: String,
    /// Title from the default localization (if available)
    pub title: Option<String>,
    /// Content slug
    pub slug: Option<String>,
    /// When the item was deleted
    pub deleted_at: Option<DateTime<Utc>>,
    /// Site ID the content belongs to
    pub site_id: Uuid,
}

/// Paginated trash response.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct TrashListResponse {
    pub items: Vec<TrashItem>,
    pub total: i64,
}

/// Trash count for badge.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct TrashCountResponse {
    pub count: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trash_item_serialization() {
        let item = TrashItem {
            id: Uuid::new_v4(),
            entity_type: "blog".to_string(),
            title: Some("Test Blog".to_string()),
            slug: Some("test-blog".to_string()),
            deleted_at: Some(Utc::now()),
            site_id: Uuid::new_v4(),
        };
        let json = serde_json::to_string(&item).unwrap();
        assert!(json.contains("\"entity_type\":\"blog\""));
        assert!(json.contains("\"title\":\"Test Blog\""));
    }

    #[test]
    fn test_trash_count_response_serialization() {
        let resp = TrashCountResponse { count: 5 };
        let json = serde_json::to_string(&resp).unwrap();
        assert_eq!(json, "{\"count\":5}");
    }
}
