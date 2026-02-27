//! Content template DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::models::content_template::ContentTemplate;
use crate::utils::pagination::Paginated;

/// Request to create a content template
#[derive(Debug, Clone, Deserialize, Validate, ToSchema)]
#[schema(description = "Create a content template")]
pub struct CreateContentTemplateRequest {
    #[schema(example = "Tutorial")]
    #[validate(length(
        min = 1,
        max = 200,
        message = "Name must be between 1 and 200 characters"
    ))]
    pub name: String,

    #[schema(example = "Step-by-step guide template")]
    #[validate(length(max = 2000, message = "Description cannot exceed 2000 characters"))]
    pub description: Option<String>,

    #[schema(example = "School")]
    #[validate(length(max = 50, message = "Icon cannot exceed 50 characters"))]
    pub icon: Option<String>,

    #[schema(example = "tutorial")]
    #[validate(length(max = 100, message = "Slug prefix cannot exceed 100 characters"))]
    pub slug_prefix: Option<String>,

    #[schema(example = false)]
    pub is_featured: Option<bool>,

    #[schema(example = true)]
    pub allow_comments: Option<bool>,

    #[schema(example = "How to [Do Something]")]
    pub title: Option<String>,

    #[schema(example = "A practical guide")]
    pub subtitle: Option<String>,

    #[schema(example = "Learn how to...")]
    pub excerpt: Option<String>,

    #[schema(example = "## Step 1\n\nContent here...")]
    pub body: Option<String>,

    #[schema(example = "Tutorial — Step-by-Step")]
    #[validate(length(max = 500, message = "Meta title cannot exceed 500 characters"))]
    pub meta_title: Option<String>,

    #[schema(example = "A step-by-step tutorial")]
    #[validate(length(max = 500, message = "Meta description cannot exceed 500 characters"))]
    pub meta_description: Option<String>,

    #[schema(example = true)]
    pub is_active: Option<bool>,

    /// Site ID (overridden by path param)
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub site_id: Uuid,
}

/// Request to update a content template
#[derive(Debug, Clone, Deserialize, Validate, ToSchema)]
#[schema(description = "Update a content template")]
pub struct UpdateContentTemplateRequest {
    #[schema(example = "Updated Tutorial")]
    #[validate(length(
        min = 1,
        max = 200,
        message = "Name must be between 1 and 200 characters"
    ))]
    pub name: Option<String>,

    #[schema(example = "Updated description")]
    #[validate(length(max = 2000, message = "Description cannot exceed 2000 characters"))]
    pub description: Option<String>,

    #[schema(example = "School")]
    #[validate(length(max = 50, message = "Icon cannot exceed 50 characters"))]
    pub icon: Option<String>,

    #[schema(example = "tutorial")]
    #[validate(length(max = 100, message = "Slug prefix cannot exceed 100 characters"))]
    pub slug_prefix: Option<String>,

    #[schema(example = false)]
    pub is_featured: Option<bool>,

    #[schema(example = true)]
    pub allow_comments: Option<bool>,

    #[schema(example = "Updated Title")]
    pub title: Option<String>,

    #[schema(example = "Updated subtitle")]
    pub subtitle: Option<String>,

    #[schema(example = "Updated excerpt")]
    pub excerpt: Option<String>,

    #[schema(example = "Updated body content")]
    pub body: Option<String>,

    #[schema(example = "Updated Meta Title")]
    #[validate(length(max = 500, message = "Meta title cannot exceed 500 characters"))]
    pub meta_title: Option<String>,

    #[schema(example = "Updated meta description")]
    #[validate(length(max = 500, message = "Meta description cannot exceed 500 characters"))]
    pub meta_description: Option<String>,

    #[schema(example = true)]
    pub is_active: Option<bool>,
}

/// Content template response
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(description = "Content template details")]
pub struct ContentTemplateResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub site_id: Uuid,
    #[schema(example = "Tutorial")]
    pub name: String,
    #[schema(example = "Step-by-step guide template")]
    pub description: Option<String>,
    #[schema(example = "School")]
    pub icon: String,
    #[schema(example = "tutorial")]
    pub slug_prefix: String,
    #[schema(example = false)]
    pub is_featured: bool,
    #[schema(example = true)]
    pub allow_comments: bool,
    #[schema(example = "How to [Do Something]")]
    pub title: String,
    #[schema(example = "A practical guide")]
    pub subtitle: String,
    #[schema(example = "Learn how to...")]
    pub excerpt: String,
    #[schema(example = "## Step 1\n\nContent here...")]
    pub body: String,
    #[schema(example = "Tutorial — Step-by-Step")]
    pub meta_title: String,
    #[schema(example = "A step-by-step tutorial")]
    pub meta_description: String,
    #[schema(example = true)]
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<ContentTemplate> for ContentTemplateResponse {
    fn from(t: ContentTemplate) -> Self {
        Self {
            id: t.id,
            site_id: t.site_id,
            name: t.name,
            description: t.description,
            icon: t.icon,
            slug_prefix: t.slug_prefix,
            is_featured: t.is_featured,
            allow_comments: t.allow_comments,
            title: t.title,
            subtitle: t.subtitle,
            excerpt: t.excerpt,
            body: t.body,
            meta_title: t.meta_title,
            meta_description: t.meta_description,
            is_active: t.is_active,
            created_at: t.created_at,
            updated_at: t.updated_at,
        }
    }
}

/// Paginated content templates response
pub type PaginatedContentTemplates = Paginated<ContentTemplateResponse>;

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_create_content_template_valid() {
        let req = CreateContentTemplateRequest {
            name: "Tutorial".to_string(),
            description: Some("A guide".to_string()),
            icon: Some("School".to_string()),
            slug_prefix: Some("tutorial".to_string()),
            is_featured: None,
            allow_comments: None,
            title: Some("Title".to_string()),
            subtitle: None,
            excerpt: None,
            body: None,
            meta_title: None,
            meta_description: None,
            is_active: None,
            site_id: Uuid::new_v4(),
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_create_content_template_name_too_long() {
        let req = CreateContentTemplateRequest {
            name: "a".repeat(201),
            description: None,
            icon: None,
            slug_prefix: None,
            is_featured: None,
            allow_comments: None,
            title: None,
            subtitle: None,
            excerpt: None,
            body: None,
            meta_title: None,
            meta_description: None,
            is_active: None,
            site_id: Uuid::new_v4(),
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_update_content_template_valid() {
        let req = UpdateContentTemplateRequest {
            name: Some("Updated".to_string()),
            description: None,
            icon: None,
            slug_prefix: None,
            is_featured: None,
            allow_comments: None,
            title: None,
            subtitle: None,
            excerpt: None,
            body: None,
            meta_title: None,
            meta_description: None,
            is_active: None,
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_update_content_template_all_none() {
        let req = UpdateContentTemplateRequest {
            name: None,
            description: None,
            icon: None,
            slug_prefix: None,
            is_featured: None,
            allow_comments: None,
            title: None,
            subtitle: None,
            excerpt: None,
            body: None,
            meta_title: None,
            meta_description: None,
            is_active: None,
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_content_template_response_serialization() {
        let resp = ContentTemplateResponse {
            id: Uuid::new_v4(),
            site_id: Uuid::new_v4(),
            name: "Tutorial".to_string(),
            description: Some("A guide".to_string()),
            icon: "School".to_string(),
            slug_prefix: "tutorial".to_string(),
            is_featured: false,
            allow_comments: true,
            title: "Title".to_string(),
            subtitle: "Sub".to_string(),
            excerpt: "Exc".to_string(),
            body: "Body".to_string(),
            meta_title: "MT".to_string(),
            meta_description: "MD".to_string(),
            is_active: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"name\":\"Tutorial\""));
        assert!(json.contains("\"is_active\":true"));
    }
}
