//! Navigation DTOs

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::models::navigation::NavigationItem;
use crate::utils::validation::{validate_icon, validate_url};

/// Request to create a navigation item
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Create a navigation item")]
pub struct CreateNavigationItemRequest {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub parent_id: Option<Uuid>,

    /// Either page_id or external_url must be provided (but not both)
    #[schema(example = "550e8400-e29b-41d4-a716-446655440001")]
    pub page_id: Option<Uuid>,

    #[schema(example = "https://github.com")]
    #[validate(length(max = 2000, message = "External URL cannot exceed 2000 characters"))]
    #[validate(custom(function = "validate_url"))]
    pub external_url: Option<String>,

    #[schema(example = "home")]
    #[validate(length(max = 50, message = "Icon name cannot exceed 50 characters"))]
    #[validate(custom(function = "validate_icon_optional"))]
    pub icon: Option<String>,

    #[schema(example = 1)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: i16,

    #[schema(example = false)]
    #[serde(default)]
    pub open_in_new_tab: bool,

    /// Site ID to associate this navigation item with
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub site_id: Uuid,

    /// Menu ID to associate this navigation item with
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub menu_id: Uuid,

    /// Optional localizations to create with the item
    #[validate(nested)]
    pub localizations: Option<Vec<NavigationItemLocalizationInput>>,
}

/// Validate icon (optional version)
fn validate_icon_optional(icon: &str) -> Result<(), validator::ValidationError> {
    if icon.is_empty() {
        return Ok(());
    }
    validate_icon(icon)
}

impl CreateNavigationItemRequest {
    /// Custom validation: either page_id or external_url must be provided
    pub fn validate_link(&self) -> Result<(), String> {
        match (&self.page_id, &self.external_url) {
            (None, None) => Err("Either page_id or external_url must be provided".to_string()),
            (Some(_), Some(_)) => Err("Cannot specify both page_id and external_url".to_string()),
            _ => Ok(()),
        }
    }
}

/// Request to update a navigation item
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update a navigation item")]
pub struct UpdateNavigationItemRequest {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub parent_id: Option<Uuid>,

    #[schema(example = "550e8400-e29b-41d4-a716-446655440001")]
    pub page_id: Option<Uuid>,

    #[schema(example = "https://example.com")]
    #[validate(length(max = 2000, message = "External URL cannot exceed 2000 characters"))]
    #[validate(custom(function = "validate_url"))]
    pub external_url: Option<String>,

    #[schema(example = "link")]
    #[validate(length(max = 50, message = "Icon name cannot exceed 50 characters"))]
    #[validate(custom(function = "validate_icon_optional"))]
    pub icon: Option<String>,

    #[schema(example = 5)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: Option<i16>,

    #[schema(example = true)]
    pub open_in_new_tab: Option<bool>,
}

/// Navigation item response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Navigation item details")]
pub struct NavigationItemResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub menu_id: Uuid,
    #[schema(example = "550e8400-e29b-41d4-a716-446655440001")]
    pub parent_id: Option<Uuid>,
    #[schema(example = "550e8400-e29b-41d4-a716-446655440002")]
    pub page_id: Option<Uuid>,
    #[schema(example = "https://github.com")]
    pub external_url: Option<String>,
    #[schema(example = "home")]
    pub icon: Option<String>,
    #[schema(example = 1)]
    pub display_order: i16,
    #[schema(example = false)]
    pub open_in_new_tab: bool,
    /// Localized title (from first available localization, for admin display)
    pub title: Option<String>,
}

impl From<NavigationItem> for NavigationItemResponse {
    fn from(item: NavigationItem) -> Self {
        Self {
            id: item.id,
            menu_id: item.menu_id,
            parent_id: item.parent_id,
            page_id: item.page_id,
            external_url: item.external_url,
            icon: item.icon,
            display_order: item.display_order,
            open_in_new_tab: item.open_in_new_tab,
            title: None,
        }
    }
}

/// Navigation item with children (tree structure)
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Navigation tree with children", no_recursion)]
pub struct NavigationTree {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "550e8400-e29b-41d4-a716-446655440001")]
    pub parent_id: Option<Uuid>,
    #[schema(example = "550e8400-e29b-41d4-a716-446655440001")]
    pub page_id: Option<Uuid>,
    #[schema(example = "https://github.com")]
    pub external_url: Option<String>,
    #[schema(example = "home")]
    pub icon: Option<String>,
    #[schema(example = 1)]
    pub display_order: i16,
    #[schema(example = false)]
    pub open_in_new_tab: bool,
    /// Localized title
    pub title: Option<String>,
    /// Page slug (for URL construction)
    pub page_slug: Option<String>,
    pub children: Vec<NavigationTree>,
}

/// Single item in a navigation reorder request
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "A navigation item ID with its new display order")]
pub struct ReorderNavigationItem {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,

    #[schema(example = 0)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: i16,
}

/// Request to batch-reorder navigation items
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Batch reorder navigation items")]
pub struct ReorderNavigationItemsRequest {
    #[validate(nested)]
    pub items: Vec<ReorderNavigationItem>,
}

/// Single item in a tree reorder request (with parent_id for hierarchy)
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "A navigation tree item with parent and display order")]
pub struct ReorderNavigationTreeItem {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,

    pub parent_id: Option<Uuid>,

    #[schema(example = 0)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: i16,
}

/// Request to batch-reorder navigation tree items
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Batch reorder navigation tree items with parent support")]
pub struct ReorderNavigationTreeRequest {
    #[validate(nested)]
    pub items: Vec<ReorderNavigationTreeItem>,
}

/// Navigation item localization input (for create/update)
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Navigation item localization input")]
pub struct NavigationItemLocalizationInput {
    pub locale_id: Uuid,
    #[validate(length(
        min = 1,
        max = 200,
        message = "Title must be between 1 and 200 characters"
    ))]
    pub title: String,
}

/// Navigation item localization response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Navigation item localization")]
pub struct NavigationItemLocalizationResponse {
    pub id: Uuid,
    pub navigation_item_id: Uuid,
    pub locale_id: Uuid,
    pub title: String,
}

impl From<crate::models::navigation::NavigationItemLocalization>
    for NavigationItemLocalizationResponse
{
    fn from(loc: crate::models::navigation::NavigationItemLocalization) -> Self {
        Self {
            id: loc.id,
            navigation_item_id: loc.navigation_item_id,
            locale_id: loc.locale_id,
            title: loc.title,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_create_navigation_item_request_with_page() {
        let request = CreateNavigationItemRequest {
            parent_id: None,
            page_id: Some(Uuid::new_v4()),
            external_url: None,
            icon: Some("home".to_string()),
            display_order: 1,
            open_in_new_tab: false,
            site_id: Uuid::new_v4(),
            menu_id: Uuid::new_v4(),
            localizations: None,
        };
        assert!(request.validate().is_ok());
        assert!(request.validate_link().is_ok());
    }

    #[test]
    fn test_create_navigation_item_request_with_external_url() {
        let request = CreateNavigationItemRequest {
            parent_id: None,
            page_id: None,
            external_url: Some("https://github.com".to_string()),
            icon: Some("external-link".to_string()),
            display_order: 2,
            open_in_new_tab: true,
            site_id: Uuid::new_v4(),
            menu_id: Uuid::new_v4(),
            localizations: None,
        };
        assert!(request.validate().is_ok());
        assert!(request.validate_link().is_ok());
    }

    #[test]
    fn test_create_navigation_item_request_no_link() {
        let request = CreateNavigationItemRequest {
            parent_id: None,
            page_id: None,
            external_url: None,
            icon: None,
            display_order: 1,
            open_in_new_tab: false,
            site_id: Uuid::new_v4(),
            menu_id: Uuid::new_v4(),
            localizations: None,
        };
        assert!(request.validate().is_ok()); // Validator passes
        assert!(request.validate_link().is_err()); // But custom validation fails
    }

    #[test]
    fn test_create_navigation_item_request_both_links() {
        let request = CreateNavigationItemRequest {
            parent_id: None,
            page_id: Some(Uuid::new_v4()),
            external_url: Some("https://github.com".to_string()),
            icon: None,
            display_order: 1,
            open_in_new_tab: false,
            site_id: Uuid::new_v4(),
            menu_id: Uuid::new_v4(),
            localizations: None,
        };
        assert!(request.validate_link().is_err());
    }

    #[test]
    fn test_create_navigation_item_invalid_url() {
        let request = CreateNavigationItemRequest {
            parent_id: None,
            page_id: None,
            external_url: Some("javascript:alert(1)".to_string()),
            icon: None,
            display_order: 1,
            open_in_new_tab: false,
            site_id: Uuid::new_v4(),
            menu_id: Uuid::new_v4(),
            localizations: None,
        };
        let result = request.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_update_navigation_item_request_valid() {
        let request = UpdateNavigationItemRequest {
            parent_id: None,
            page_id: None,
            external_url: Some("https://example.com".to_string()),
            icon: Some("link".to_string()),
            display_order: Some(5),
            open_in_new_tab: Some(true),
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_update_navigation_item_request_all_optional() {
        let request = UpdateNavigationItemRequest {
            parent_id: None,
            page_id: None,
            external_url: None,
            icon: None,
            display_order: None,
            open_in_new_tab: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_navigation_item_response_serialization() {
        let item = NavigationItemResponse {
            id: Uuid::new_v4(),
            menu_id: Uuid::new_v4(),
            parent_id: None,
            page_id: Some(Uuid::new_v4()),
            external_url: None,
            icon: Some("home".to_string()),
            display_order: 1,
            open_in_new_tab: false,
            title: Some("Home".to_string()),
        };

        let json = serde_json::to_string(&item).unwrap();
        assert!(json.contains("\"icon\":\"home\""));
    }
}
