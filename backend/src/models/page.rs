//! Page model — pure data structs.
//!
//! All SQL lives in [`repos::page_repo`](crate::repos::page_repo).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::content::ContentStatus;

/// Page type enum matching PostgreSQL
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, utoipa::ToSchema)]
#[sqlx(type_name = "page_type", rename_all = "lowercase")]
#[derive(Default)]
pub enum PageType {
    #[default]
    Static,
    Landing,
    Contact,
    #[sqlx(rename = "blog_index")]
    BlogIndex,
    Custom,
}

/// Section type enum matching PostgreSQL
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, utoipa::ToSchema)]
#[sqlx(type_name = "section_type", rename_all = "lowercase")]
pub enum SectionType {
    Hero,
    Features,
    Cta,
    Gallery,
    Testimonials,
    Pricing,
    Faq,
    Contact,
    Custom,
    Stats,
    Team,
    Timeline,
    #[sqlx(rename = "logo_cloud")]
    LogoCloud,
    Newsletter,
    Video,
    Divider,
    Text,
}

/// Page model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Page {
    pub id: Uuid,
    pub content_id: Uuid,
    pub route: String,
    pub page_type: PageType,
    pub template: Option<String>,
    pub is_in_navigation: bool,
    pub navigation_order: Option<i16>,
    pub parent_page_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Page with content data
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PageWithContent {
    pub id: Uuid,
    pub content_id: Uuid,
    pub route: String,
    pub page_type: PageType,
    pub template: Option<String>,
    pub is_in_navigation: bool,
    pub navigation_order: Option<i16>,
    pub parent_page_id: Option<Uuid>,
    pub slug: Option<String>,
    pub status: ContentStatus,
    pub published_at: Option<DateTime<Utc>>,
    pub publish_start: Option<DateTime<Utc>>,
    pub publish_end: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Page section model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PageSection {
    pub id: Uuid,
    pub page_id: Uuid,
    pub section_type: SectionType,
    pub display_order: i16,
    pub cover_image_id: Option<Uuid>,
    pub call_to_action_route: Option<String>,
    pub settings: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Page section localization model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PageSectionLocalization {
    pub id: Uuid,
    pub page_section_id: Uuid,
    pub locale_id: Uuid,
    pub title: Option<String>,
    pub text: Option<String>,
    pub button_text: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_page_type_serialization() {
        let page_type = PageType::Landing;
        let json = serde_json::to_string(&page_type).unwrap();
        assert_eq!(json, "\"Landing\"");
    }

    #[test]
    fn test_section_type_serialization() {
        let section_type = SectionType::Hero;
        let json = serde_json::to_string(&section_type).unwrap();
        assert_eq!(json, "\"Hero\"");
    }
}
