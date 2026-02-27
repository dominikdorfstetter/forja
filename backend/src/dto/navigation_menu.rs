//! Navigation Menu DTOs

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::models::navigation_menu::NavigationMenuWithCount;

/// Request to create a navigation menu
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Create a navigation menu")]
pub struct CreateNavigationMenuRequest {
    /// Slug must be lowercase alphanumeric with hyphens, starting with a letter or digit
    #[schema(example = "primary")]
    #[validate(length(
        min = 1,
        max = 50,
        message = "Slug must be between 1 and 50 characters"
    ))]
    #[validate(regex(path = *SLUG_REGEX, message = "Slug must be lowercase alphanumeric with hyphens"))]
    pub slug: String,

    #[schema(example = "Primary navigation menu")]
    #[validate(length(max = 255, message = "Description cannot exceed 255 characters"))]
    pub description: Option<String>,

    #[schema(example = 3)]
    #[validate(range(min = 1, max = 10, message = "Max depth must be between 1 and 10"))]
    pub max_depth: Option<i16>,

    /// Optional localizations to create with the menu
    #[validate(nested)]
    pub localizations: Option<Vec<MenuLocalizationInput>>,
}

/// Request to update a navigation menu
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update a navigation menu")]
pub struct UpdateNavigationMenuRequest {
    #[schema(example = "primary")]
    #[validate(length(
        min = 1,
        max = 50,
        message = "Slug must be between 1 and 50 characters"
    ))]
    #[validate(regex(path = *SLUG_REGEX, message = "Slug must be lowercase alphanumeric with hyphens"))]
    pub slug: Option<String>,

    #[schema(example = "Primary navigation menu")]
    #[validate(length(max = 255, message = "Description cannot exceed 255 characters"))]
    pub description: Option<String>,

    #[schema(example = 3)]
    #[validate(range(min = 1, max = 10, message = "Max depth must be between 1 and 10"))]
    pub max_depth: Option<i16>,

    #[schema(example = true)]
    pub is_active: Option<bool>,

    /// Optional localizations to upsert
    #[validate(nested)]
    pub localizations: Option<Vec<MenuLocalizationInput>>,
}

/// A localization entry for a menu
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Menu localization input")]
pub struct MenuLocalizationInput {
    pub locale_id: Uuid,

    #[validate(length(
        min = 1,
        max = 200,
        message = "Name must be between 1 and 200 characters"
    ))]
    pub name: String,
}

/// Navigation menu response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Navigation menu details")]
pub struct NavigationMenuResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "550e8400-e29b-41d4-a716-446655440001")]
    pub site_id: Uuid,
    #[schema(example = "primary")]
    pub slug: String,
    #[schema(example = "Primary navigation menu")]
    pub description: Option<String>,
    #[schema(example = 3)]
    pub max_depth: i16,
    #[schema(example = true)]
    pub is_active: bool,
    #[schema(example = 4)]
    pub item_count: i64,
    pub created_at: String,
    pub updated_at: String,
    pub localizations: Option<Vec<MenuLocalizationResponse>>,
}

/// Menu localization response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Menu localization")]
pub struct MenuLocalizationResponse {
    pub id: Uuid,
    pub locale_id: Uuid,
    pub name: String,
}

impl From<NavigationMenuWithCount> for NavigationMenuResponse {
    fn from(menu: NavigationMenuWithCount) -> Self {
        Self {
            id: menu.id,
            site_id: menu.site_id,
            slug: menu.slug,
            description: menu.description,
            max_depth: menu.max_depth,
            is_active: menu.is_active,
            item_count: menu.item_count,
            created_at: menu.created_at.to_rfc3339(),
            updated_at: menu.updated_at.to_rfc3339(),
            localizations: None,
        }
    }
}

lazy_static::lazy_static! {
    static ref SLUG_REGEX: regex::Regex = regex::Regex::new(r"^[a-z0-9][a-z0-9-]*$").unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_valid_create_request() {
        let req = CreateNavigationMenuRequest {
            slug: "primary".to_string(),
            description: Some("Main menu".to_string()),
            max_depth: Some(3),
            localizations: None,
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_invalid_slug() {
        let req = CreateNavigationMenuRequest {
            slug: "Primary Menu!".to_string(),
            description: None,
            max_depth: None,
            localizations: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_valid_slugs() {
        for slug in &["primary", "footer", "sidebar-nav", "menu2"] {
            let req = CreateNavigationMenuRequest {
                slug: slug.to_string(),
                description: None,
                max_depth: None,
                localizations: None,
            };
            assert!(req.validate().is_ok(), "Slug '{}' should be valid", slug);
        }
    }
}
