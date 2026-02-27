//! Page DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::models::content::ContentStatus;
use crate::models::page::{
    PageSection, PageSectionLocalization, PageType, PageWithContent, SectionType,
};
use crate::utils::pagination::Paginated;
use crate::utils::validation::{validate_json_depth, validate_route, validate_slug};

/// Request to create a new page
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Create a page")]
pub struct CreatePageRequest {
    #[schema(example = "/about")]
    #[validate(length(
        min = 1,
        max = 500,
        message = "Route must be between 1 and 500 characters"
    ))]
    #[validate(custom(function = "validate_route"))]
    pub route: String,

    #[schema(example = "about")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Slug must be between 1 and 100 characters"
    ))]
    #[validate(custom(function = "validate_slug"))]
    pub slug: String,

    #[serde(default)]
    pub page_type: PageType,

    #[schema(example = "default")]
    #[validate(length(max = 100, message = "Template name cannot exceed 100 characters"))]
    pub template: Option<String>,

    #[schema(example = true)]
    #[serde(default)]
    pub is_in_navigation: bool,

    #[schema(example = 1)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Navigation order must be between 0 and 9999"
    ))]
    pub navigation_order: Option<i16>,

    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub parent_page_id: Option<Uuid>,

    #[serde(default)]
    pub status: ContentStatus,

    pub publish_start: Option<DateTime<Utc>>,
    pub publish_end: Option<DateTime<Utc>>,

    /// Site IDs to associate this page with
    #[validate(length(min = 1, message = "At least one site ID is required"))]
    pub site_ids: Vec<Uuid>,
}

/// Request to update a page
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update a page")]
pub struct UpdatePageRequest {
    #[schema(example = "/about-us")]
    #[validate(length(
        min = 1,
        max = 500,
        message = "Route must be between 1 and 500 characters"
    ))]
    #[validate(custom(function = "validate_route"))]
    pub route: Option<String>,

    #[schema(example = "about-us")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Slug must be between 1 and 100 characters"
    ))]
    #[validate(custom(function = "validate_slug"))]
    pub slug: Option<String>,

    pub page_type: Option<PageType>,

    #[schema(example = "default")]
    #[validate(length(max = 100, message = "Template name cannot exceed 100 characters"))]
    pub template: Option<String>,

    #[schema(example = false)]
    pub is_in_navigation: Option<bool>,

    #[schema(example = 2)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Navigation order must be between 0 and 9999"
    ))]
    pub navigation_order: Option<i16>,

    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub parent_page_id: Option<Uuid>,

    pub status: Option<ContentStatus>,

    pub publish_start: Option<DateTime<Utc>>,
    pub publish_end: Option<DateTime<Utc>>,
}

/// Request to create a page section
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Create a page section")]
pub struct CreatePageSectionRequest {
    pub section_type: SectionType,

    #[schema(example = 0)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: i16,

    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub cover_image_id: Option<Uuid>,

    #[schema(example = "/contact")]
    #[validate(length(max = 500, message = "CTA route cannot exceed 500 characters"))]
    pub call_to_action_route: Option<String>,

    #[validate(custom(function = "validate_section_settings"))]
    pub settings: Option<serde_json::Value>,
}

/// Validate section settings JSON
fn validate_section_settings(
    settings: &serde_json::Value,
) -> Result<(), validator::ValidationError> {
    validate_json_depth(settings, 5)
}

/// Request to update a page section
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update a page section")]
pub struct UpdatePageSectionRequest {
    pub section_type: Option<SectionType>,

    #[schema(example = 1)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: Option<i16>,

    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub cover_image_id: Option<Uuid>,

    #[schema(example = "/contact")]
    #[validate(length(max = 500, message = "CTA route cannot exceed 500 characters"))]
    pub call_to_action_route: Option<String>,

    #[validate(custom(function = "validate_section_settings"))]
    pub settings: Option<serde_json::Value>,
}

/// Page list item response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Page summary for lists")]
pub struct PageListItem {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "/about")]
    pub route: String,
    pub page_type: PageType,
    #[schema(example = "about")]
    pub slug: Option<String>,
    #[schema(example = true)]
    pub is_in_navigation: bool,
    pub status: ContentStatus,
    pub publish_start: Option<DateTime<Utc>>,
    pub publish_end: Option<DateTime<Utc>>,
    #[schema(example = "2024-01-15T10:30:00Z")]
    pub created_at: DateTime<Utc>,
}

impl From<PageWithContent> for PageListItem {
    fn from(page: PageWithContent) -> Self {
        Self {
            id: page.id,
            route: page.route,
            page_type: page.page_type,
            slug: page.slug,
            is_in_navigation: page.is_in_navigation,
            status: page.status,
            publish_start: page.publish_start,
            publish_end: page.publish_end,
            created_at: page.created_at,
        }
    }
}

/// Full page response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Full page details")]
pub struct PageResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "660e8400-e29b-41d4-a716-446655440000")]
    pub content_id: Uuid,
    #[schema(example = "/about")]
    pub route: String,
    pub page_type: PageType,
    #[schema(example = "default")]
    pub template: Option<String>,
    #[schema(example = true)]
    pub is_in_navigation: bool,
    #[schema(example = 1)]
    pub navigation_order: Option<i16>,
    #[schema(example = "770e8400-e29b-41d4-a716-446655440000")]
    pub parent_page_id: Option<Uuid>,
    #[schema(example = "about")]
    pub slug: Option<String>,
    pub status: ContentStatus,
    #[schema(example = "2024-01-15T10:30:00Z")]
    pub published_at: Option<DateTime<Utc>>,
    pub publish_start: Option<DateTime<Utc>>,
    pub publish_end: Option<DateTime<Utc>>,
    #[schema(example = "2024-01-15T10:30:00Z")]
    pub created_at: DateTime<Utc>,
    #[schema(example = "2024-01-16T12:00:00Z")]
    pub updated_at: DateTime<Utc>,
}

impl From<PageWithContent> for PageResponse {
    fn from(page: PageWithContent) -> Self {
        Self {
            id: page.id,
            content_id: page.content_id,
            route: page.route,
            page_type: page.page_type,
            template: page.template,
            is_in_navigation: page.is_in_navigation,
            navigation_order: page.navigation_order,
            parent_page_id: page.parent_page_id,
            slug: page.slug,
            status: page.status,
            published_at: page.published_at,
            publish_start: page.publish_start,
            publish_end: page.publish_end,
            created_at: page.created_at,
            updated_at: page.updated_at,
        }
    }
}

/// Page section response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Page section details")]
pub struct PageSectionResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "770e8400-e29b-41d4-a716-446655440000")]
    pub page_id: Uuid,
    pub section_type: SectionType,
    #[schema(example = 0)]
    pub display_order: i16,
    #[schema(example = "660e8400-e29b-41d4-a716-446655440000")]
    pub cover_image_id: Option<Uuid>,
    #[schema(example = "/contact")]
    pub call_to_action_route: Option<String>,
    pub settings: Option<serde_json::Value>,
}

impl From<PageSection> for PageSectionResponse {
    fn from(section: PageSection) -> Self {
        Self {
            id: section.id,
            page_id: section.page_id,
            section_type: section.section_type,
            display_order: section.display_order,
            cover_image_id: section.cover_image_id,
            call_to_action_route: section.call_to_action_route,
            settings: section.settings,
        }
    }
}

/// Section localization response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Section localization content")]
pub struct SectionLocalizationResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "660e8400-e29b-41d4-a716-446655440000")]
    pub page_section_id: Uuid,
    #[schema(example = "770e8400-e29b-41d4-a716-446655440000")]
    pub locale_id: Uuid,
    pub title: Option<String>,
    pub text: Option<String>,
    pub button_text: Option<String>,
}

impl From<PageSectionLocalization> for SectionLocalizationResponse {
    fn from(loc: PageSectionLocalization) -> Self {
        Self {
            id: loc.id,
            page_section_id: loc.page_section_id,
            locale_id: loc.locale_id,
            title: loc.title,
            text: loc.text,
            button_text: loc.button_text,
        }
    }
}

/// Request to upsert a section localization
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Upsert section localization")]
pub struct UpsertSectionLocalizationRequest {
    #[schema(example = "770e8400-e29b-41d4-a716-446655440000")]
    pub locale_id: Uuid,

    #[validate(length(max = 500, message = "Title cannot exceed 500 characters"))]
    pub title: Option<String>,

    #[validate(length(max = 50000, message = "Text cannot exceed 50000 characters"))]
    pub text: Option<String>,

    #[validate(length(max = 200, message = "Button text cannot exceed 200 characters"))]
    pub button_text: Option<String>,
}

/// Paginated page list
pub type PaginatedPages = Paginated<PageListItem>;

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_create_page_request_valid() {
        let request = CreatePageRequest {
            route: "/about".to_string(),
            slug: "about".to_string(),
            page_type: PageType::Static,
            template: Some("default".to_string()),
            is_in_navigation: true,
            navigation_order: Some(1),
            parent_page_id: None,
            status: ContentStatus::Draft,
            publish_start: None,
            publish_end: None,
            site_ids: vec![Uuid::new_v4()],
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_page_request_invalid_route() {
        let request = CreatePageRequest {
            route: "no-leading-slash".to_string(),
            slug: "about".to_string(),
            page_type: PageType::Static,
            template: None,
            is_in_navigation: false,
            navigation_order: None,
            parent_page_id: None,
            status: ContentStatus::Draft,
            publish_start: None,
            publish_end: None,
            site_ids: vec![Uuid::new_v4()],
        };
        let result = request.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_create_page_request_path_traversal() {
        let request = CreatePageRequest {
            route: "/admin/../secret".to_string(),
            slug: "secret".to_string(),
            page_type: PageType::Static,
            template: None,
            is_in_navigation: false,
            navigation_order: None,
            parent_page_id: None,
            status: ContentStatus::Draft,
            publish_start: None,
            publish_end: None,
            site_ids: vec![Uuid::new_v4()],
        };
        let result = request.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_create_page_request_no_sites() {
        let request = CreatePageRequest {
            route: "/about".to_string(),
            slug: "about".to_string(),
            page_type: PageType::Static,
            template: None,
            is_in_navigation: false,
            navigation_order: None,
            parent_page_id: None,
            status: ContentStatus::Draft,
            publish_start: None,
            publish_end: None,
            site_ids: vec![],
        };
        let result = request.validate();
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.field_errors().contains_key("site_ids"));
    }

    #[test]
    fn test_create_page_section_request_valid() {
        let request = CreatePageSectionRequest {
            section_type: SectionType::Hero,
            display_order: 0,
            cover_image_id: None,
            call_to_action_route: Some("/contact".to_string()),
            settings: Some(serde_json::json!({"title": "Welcome"})),
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_page_section_deep_json() {
        // Create deeply nested settings (more than 5 levels)
        let mut deep = serde_json::json!("value");
        for _ in 0..8 {
            deep = serde_json::json!({"nested": deep});
        }

        let request = CreatePageSectionRequest {
            section_type: SectionType::Custom,
            display_order: 0,
            cover_image_id: None,
            call_to_action_route: None,
            settings: Some(deep),
        };
        let result = request.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_update_page_request_valid() {
        let request = UpdatePageRequest {
            route: Some("/new-route".to_string()),
            slug: Some("new-slug".to_string()),
            page_type: None,
            template: None,
            is_in_navigation: Some(false),
            navigation_order: None,
            parent_page_id: None,
            status: Some(ContentStatus::Published),
            publish_start: None,
            publish_end: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_update_page_request_all_optional() {
        let request = UpdatePageRequest {
            route: None,
            slug: None,
            page_type: None,
            template: None,
            is_in_navigation: None,
            navigation_order: None,
            parent_page_id: None,
            status: None,
            publish_start: None,
            publish_end: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_page_list_item_serialization() {
        let item = PageListItem {
            id: Uuid::new_v4(),
            route: "/about".to_string(),
            page_type: PageType::Static,
            slug: Some("about".to_string()),
            is_in_navigation: true,
            status: ContentStatus::Published,
            publish_start: None,
            publish_end: None,
            created_at: Utc::now(),
        };

        let json = serde_json::to_string(&item).unwrap();
        assert!(json.contains("\"route\":\"/about\""));
    }
}
