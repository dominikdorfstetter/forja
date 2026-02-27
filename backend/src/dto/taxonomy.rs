//! Taxonomy DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::models::taxonomy::{Category, CategoryWithBlogCount, Tag};
use crate::utils::pagination::Paginated;
use crate::utils::validation::validate_slug;

/// Request to create a tag
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Create a tag")]
pub struct CreateTagRequest {
    #[schema(example = "rust-programming")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Slug must be between 1 and 100 characters"
    ))]
    #[validate(custom(function = "validate_slug"))]
    pub slug: String,

    #[schema(example = false)]
    #[serde(default)]
    pub is_global: bool,

    /// Site ID to associate this tag with (required if not global)
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub site_id: Option<Uuid>,
}

impl CreateTagRequest {
    /// Validate that site_id is provided when not global
    pub fn validate_site(&self) -> Result<(), String> {
        if !self.is_global && self.site_id.is_none() {
            return Err("site_id is required when is_global is false".to_string());
        }
        Ok(())
    }
}

/// Request to update a tag
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update a tag")]
pub struct UpdateTagRequest {
    #[schema(example = "updated-tag")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Slug must be between 1 and 100 characters"
    ))]
    #[validate(custom(function = "validate_slug"))]
    pub slug: Option<String>,

    #[schema(example = true)]
    pub is_global: Option<bool>,
}

/// Request to create a category
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Create a category")]
pub struct CreateCategoryRequest {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub parent_id: Option<Uuid>,

    #[schema(example = "technology")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Slug must be between 1 and 100 characters"
    ))]
    #[validate(custom(function = "validate_slug"))]
    pub slug: String,

    #[schema(example = false)]
    #[serde(default)]
    pub is_global: bool,

    /// Site ID to associate this category with (required if not global)
    #[schema(example = "660e8400-e29b-41d4-a716-446655440000")]
    pub site_id: Option<Uuid>,
}

impl CreateCategoryRequest {
    /// Validate that site_id is provided when not global
    pub fn validate_site(&self) -> Result<(), String> {
        if !self.is_global && self.site_id.is_none() {
            return Err("site_id is required when is_global is false".to_string());
        }
        Ok(())
    }
}

/// Request to update a category
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update a category")]
pub struct UpdateCategoryRequest {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub parent_id: Option<Uuid>,

    #[schema(example = "updated-category")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Slug must be between 1 and 100 characters"
    ))]
    #[validate(custom(function = "validate_slug"))]
    pub slug: Option<String>,

    #[schema(example = true)]
    pub is_global: Option<bool>,
}

/// Tag response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Tag details")]
pub struct TagResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "rust-programming")]
    pub slug: String,
    #[schema(example = false)]
    pub is_global: bool,
    #[schema(example = "2024-01-15T10:30:00Z")]
    pub created_at: DateTime<Utc>,
}

impl From<Tag> for TagResponse {
    fn from(tag: Tag) -> Self {
        Self {
            id: tag.id,
            slug: tag.slug,
            is_global: tag.is_global,
            created_at: tag.created_at,
        }
    }
}

/// Category response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Category details")]
pub struct CategoryResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "660e8400-e29b-41d4-a716-446655440000")]
    pub parent_id: Option<Uuid>,
    #[schema(example = "technology")]
    pub slug: String,
    #[schema(example = false)]
    pub is_global: bool,
    #[schema(example = "2024-01-15T10:30:00Z")]
    pub created_at: DateTime<Utc>,
}

impl From<Category> for CategoryResponse {
    fn from(category: Category) -> Self {
        Self {
            id: category.id,
            parent_id: category.parent_id,
            slug: category.slug,
            is_global: category.is_global,
            created_at: category.created_at,
        }
    }
}

/// Category with children (tree structure)
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Category tree with children", no_recursion)]
pub struct CategoryTree {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "technology")]
    pub slug: String,
    #[schema(example = false)]
    pub is_global: bool,
    pub children: Vec<CategoryTree>,
}

/// Request to assign a category to content
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Assign category to content")]
pub struct AssignCategoryRequest {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub category_id: Uuid,
    #[schema(example = true)]
    #[serde(default)]
    pub is_primary: bool,
}

/// Category response with blog count
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Category with blog count")]
pub struct CategoryWithCountResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "660e8400-e29b-41d4-a716-446655440000")]
    pub parent_id: Option<Uuid>,
    #[schema(example = "technology")]
    pub slug: String,
    #[schema(example = false)]
    pub is_global: bool,
    #[schema(example = "2024-01-15T10:30:00Z")]
    pub created_at: DateTime<Utc>,
    #[schema(example = 42)]
    pub blog_count: i64,
}

impl From<CategoryWithBlogCount> for CategoryWithCountResponse {
    fn from(c: CategoryWithBlogCount) -> Self {
        Self {
            id: c.id,
            parent_id: c.parent_id,
            slug: c.slug,
            is_global: c.is_global,
            created_at: c.created_at,
            blog_count: c.blog_count,
        }
    }
}

/// Paginated tag list response
pub type PaginatedTags = Paginated<TagResponse>;

/// Paginated category list response
pub type PaginatedCategories = Paginated<CategoryResponse>;

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_create_tag_request_valid() {
        let request = CreateTagRequest {
            slug: "rust-programming".to_string(),
            is_global: false,
            site_id: Some(Uuid::new_v4()),
        };
        assert!(request.validate().is_ok());
        assert!(request.validate_site().is_ok());
    }

    #[test]
    fn test_create_tag_request_global() {
        let request = CreateTagRequest {
            slug: "rust".to_string(),
            is_global: true,
            site_id: None,
        };
        assert!(request.validate().is_ok());
        assert!(request.validate_site().is_ok());
    }

    #[test]
    fn test_create_tag_request_no_site() {
        let request = CreateTagRequest {
            slug: "test".to_string(),
            is_global: false,
            site_id: None,
        };
        assert!(request.validate().is_ok()); // Validator passes
        assert!(request.validate_site().is_err()); // Custom validation fails
    }

    #[test]
    fn test_create_tag_request_invalid_slug() {
        let request = CreateTagRequest {
            slug: "Invalid Slug!".to_string(),
            is_global: false,
            site_id: Some(Uuid::new_v4()),
        };
        let result = request.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_create_tag_request_empty_slug() {
        let request = CreateTagRequest {
            slug: "".to_string(),
            is_global: false,
            site_id: Some(Uuid::new_v4()),
        };
        let result = request.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_update_tag_request_valid() {
        let request = UpdateTagRequest {
            slug: Some("updated-tag".to_string()),
            is_global: Some(true),
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_update_tag_request_all_optional() {
        let request = UpdateTagRequest {
            slug: None,
            is_global: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_category_request_valid() {
        let request = CreateCategoryRequest {
            parent_id: None,
            slug: "technology".to_string(),
            is_global: false,
            site_id: Some(Uuid::new_v4()),
        };
        assert!(request.validate().is_ok());
        assert!(request.validate_site().is_ok());
    }

    #[test]
    fn test_create_category_request_with_parent() {
        let parent_id = Uuid::new_v4();
        let request = CreateCategoryRequest {
            parent_id: Some(parent_id),
            slug: "web-development".to_string(),
            is_global: false,
            site_id: Some(Uuid::new_v4()),
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_category_request_invalid_slug() {
        let request = CreateCategoryRequest {
            parent_id: None,
            slug: "Category With Spaces".to_string(),
            is_global: false,
            site_id: Some(Uuid::new_v4()),
        };
        let result = request.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_update_category_request_valid() {
        let request = UpdateCategoryRequest {
            parent_id: Some(Uuid::new_v4()),
            slug: Some("updated-category".to_string()),
            is_global: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_tag_response_serialization() {
        let tag = TagResponse {
            id: Uuid::new_v4(),
            slug: "rust".to_string(),
            is_global: false,
            created_at: Utc::now(),
        };

        let json = serde_json::to_string(&tag).unwrap();
        assert!(json.contains("\"slug\":\"rust\""));
    }

    #[test]
    fn test_category_response_serialization() {
        let category = CategoryResponse {
            id: Uuid::new_v4(),
            parent_id: None,
            slug: "technology".to_string(),
            is_global: false,
            created_at: Utc::now(),
        };

        let json = serde_json::to_string(&category).unwrap();
        assert!(json.contains("\"slug\":\"technology\""));
    }
}
