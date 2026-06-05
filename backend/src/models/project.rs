//! Project model — pure data structs.
//!
//! All SQL lives in [`repos::project_repo::ProjectRepo`](crate::repos::project_repo::ProjectRepo).

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::content::ContentStatus;

/// Project link type enum matching PostgreSQL
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, utoipa::ToSchema)]
#[sqlx(type_name = "project_link_type", rename_all = "lowercase")]
#[derive(Default)]
pub enum ProjectLinkType {
    Source,
    Demo,
    Documentation,
    Website,
    #[default]
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Project {
    pub id: Uuid,
    pub content_id: Uuid,
    pub slug: String,
    pub display_order: i16,
    pub is_featured: bool,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub is_ongoing: bool,
    pub is_deleted: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ProjectWithContent {
    pub id: Uuid,
    pub content_id: Uuid,
    pub slug: String,
    pub display_order: i16,
    pub is_featured: bool,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub is_ongoing: bool,
    pub is_deleted: bool,
    pub status: ContentStatus,
    pub published_at: Option<DateTime<Utc>>,
    pub publish_start: Option<DateTime<Utc>>,
    pub publish_end: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ProjectLocalization {
    pub id: Uuid,
    pub project_id: Uuid,
    pub locale_id: Uuid,
    pub title: String,
    pub short_description: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ProjectLink {
    pub id: Uuid,
    pub project_id: Uuid,
    pub label: String,
    pub url: String,
    pub link_type: ProjectLinkType,
    pub icon: Option<String>,
    pub display_order: i16,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ProjectMediaItem {
    pub project_id: Uuid,
    pub media_id: Uuid,
    pub display_order: i16,
    pub is_cover: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ProjectCvEntryLink {
    pub project_id: Uuid,
    pub cv_entry_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ProjectSkillLink {
    pub project_id: Uuid,
    pub skill_id: Uuid,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_project_link_type_serialization() {
        let link_type = ProjectLinkType::Source;
        let json = serde_json::to_string(&link_type).unwrap();
        assert_eq!(json, "\"Source\"");
    }

    #[test]
    fn test_project_link_type_default() {
        let link_type = ProjectLinkType::default();
        assert_eq!(link_type, ProjectLinkType::Other);
    }
}
