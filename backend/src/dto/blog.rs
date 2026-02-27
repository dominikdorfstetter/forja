//! Blog DTOs

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::dto::content::LocalizationResponse;
use crate::dto::document::BlogDocumentResponse;
use crate::dto::taxonomy::CategoryResponse;
use crate::models::blog::BlogWithContent;
use crate::models::content::ContentStatus;
use crate::utils::pagination::Paginated;
use crate::utils::validation::validate_slug;

/// Request to create a new blog post
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Create a new blog post")]
pub struct CreateBlogRequest {
    #[schema(example = "my-awesome-post")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Slug must be between 1 and 100 characters"
    ))]
    #[validate(custom(function = "validate_slug"))]
    pub slug: String,

    #[schema(example = "Jane Doe")]
    #[validate(length(
        min = 1,
        max = 200,
        message = "Author must be between 1 and 200 characters"
    ))]
    pub author: String,

    pub published_date: NaiveDate,

    #[validate(range(
        min = 0,
        max = 999,
        message = "Reading time must be between 0 and 999 minutes"
    ))]
    pub reading_time_minutes: Option<i16>,

    pub cover_image_id: Option<Uuid>,

    pub header_image_id: Option<Uuid>,

    #[serde(default)]
    pub is_featured: bool,

    #[serde(default = "default_true")]
    pub allow_comments: bool,

    #[serde(default)]
    pub status: ContentStatus,

    pub publish_start: Option<DateTime<Utc>>,
    pub publish_end: Option<DateTime<Utc>>,

    /// Site IDs to associate this blog with
    #[validate(length(min = 1, message = "At least one site ID is required"))]
    pub site_ids: Vec<Uuid>,
}

fn default_true() -> bool {
    true
}

/// Request to update a blog post
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update a blog post")]
pub struct UpdateBlogRequest {
    #[schema(example = "updated-post-slug")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Slug must be between 1 and 100 characters"
    ))]
    #[validate(custom(function = "validate_slug"))]
    pub slug: Option<String>,

    #[schema(example = "Updated Author Name")]
    #[validate(length(
        min = 1,
        max = 200,
        message = "Author must be between 1 and 200 characters"
    ))]
    pub author: Option<String>,

    pub published_date: Option<NaiveDate>,

    #[validate(range(
        min = 0,
        max = 999,
        message = "Reading time must be between 0 and 999 minutes"
    ))]
    pub reading_time_minutes: Option<i16>,

    pub cover_image_id: Option<Uuid>,

    pub header_image_id: Option<Uuid>,

    pub is_featured: Option<bool>,

    pub allow_comments: Option<bool>,

    pub status: Option<ContentStatus>,

    pub publish_start: Option<DateTime<Utc>>,
    pub publish_end: Option<DateTime<Utc>>,
}

/// Blog list response item
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Blog post summary for lists")]
pub struct BlogListItem {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "my-awesome-post")]
    pub slug: Option<String>,
    #[schema(example = "Jane Doe")]
    pub author: String,
    pub published_date: NaiveDate,
    pub reading_time_minutes: Option<i16>,
    pub cover_image_id: Option<Uuid>,
    pub header_image_id: Option<Uuid>,
    pub is_featured: bool,
    pub status: ContentStatus,
    pub publish_start: Option<DateTime<Utc>>,
    pub publish_end: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<BlogWithContent> for BlogListItem {
    fn from(blog: BlogWithContent) -> Self {
        Self {
            id: blog.id,
            slug: blog.slug,
            author: blog.author,
            published_date: blog.published_date,
            reading_time_minutes: blog.reading_time_minutes,
            cover_image_id: blog.cover_image_id,
            header_image_id: blog.header_image_id,
            is_featured: blog.is_featured,
            status: blog.status,
            publish_start: blog.publish_start,
            publish_end: blog.publish_end,
            created_at: blog.created_at,
            updated_at: blog.updated_at,
        }
    }
}

/// Full blog response with content details
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Full blog post details")]
pub struct BlogResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "660e8400-e29b-41d4-a716-446655440000")]
    pub content_id: Uuid,
    #[schema(example = "my-awesome-post")]
    pub slug: Option<String>,
    #[schema(example = "Jane Doe")]
    pub author: String,
    pub published_date: NaiveDate,
    pub reading_time_minutes: Option<i16>,
    pub cover_image_id: Option<Uuid>,
    pub header_image_id: Option<Uuid>,
    pub is_featured: bool,
    pub allow_comments: bool,
    pub status: ContentStatus,
    pub published_at: Option<DateTime<Utc>>,
    pub publish_start: Option<DateTime<Utc>>,
    pub publish_end: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<BlogWithContent> for BlogResponse {
    fn from(blog: BlogWithContent) -> Self {
        Self {
            id: blog.id,
            content_id: blog.content_id,
            slug: blog.slug,
            author: blog.author,
            published_date: blog.published_date,
            reading_time_minutes: blog.reading_time_minutes,
            cover_image_id: blog.cover_image_id,
            header_image_id: blog.header_image_id,
            is_featured: blog.is_featured,
            allow_comments: blog.allow_comments,
            status: blog.status,
            published_at: blog.published_at,
            publish_start: blog.publish_start,
            publish_end: blog.publish_end,
            created_at: blog.created_at,
            updated_at: blog.updated_at,
        }
    }
}

/// Blog detail response with localizations, categories, and documents
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Blog post with localizations, categories, and documents")]
pub struct BlogDetailResponse {
    #[serde(flatten)]
    pub blog: BlogResponse,
    pub localizations: Vec<LocalizationResponse>,
    pub categories: Vec<CategoryResponse>,
    pub documents: Vec<BlogDocumentResponse>,
}

/// Paginated blog list response
pub type PaginatedBlogs = Paginated<BlogListItem>;

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_create_blog_request_valid() {
        let request = CreateBlogRequest {
            slug: "my-awesome-post".to_string(),
            author: "Jane Doe".to_string(),
            published_date: NaiveDate::from_ymd_opt(2024, 6, 15).unwrap(),
            reading_time_minutes: Some(10),
            cover_image_id: None,
            header_image_id: None,
            is_featured: false,
            allow_comments: true,
            status: ContentStatus::Draft,
            publish_start: None,
            publish_end: None,
            site_ids: vec![Uuid::new_v4()],
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_blog_request_invalid_slug() {
        let request = CreateBlogRequest {
            slug: "My Invalid Slug!".to_string(),
            author: "Jane Doe".to_string(),
            published_date: NaiveDate::from_ymd_opt(2024, 6, 15).unwrap(),
            reading_time_minutes: None,
            cover_image_id: None,
            header_image_id: None,
            is_featured: false,
            allow_comments: true,
            status: ContentStatus::Draft,
            publish_start: None,
            publish_end: None,
            site_ids: vec![Uuid::new_v4()],
        };
        let result = request.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_create_blog_request_empty_author() {
        let request = CreateBlogRequest {
            slug: "my-post".to_string(),
            author: "".to_string(),
            published_date: NaiveDate::from_ymd_opt(2024, 6, 15).unwrap(),
            reading_time_minutes: None,
            cover_image_id: None,
            header_image_id: None,
            is_featured: false,
            allow_comments: true,
            status: ContentStatus::Draft,
            publish_start: None,
            publish_end: None,
            site_ids: vec![Uuid::new_v4()],
        };
        let result = request.validate();
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.field_errors().contains_key("author"));
    }

    #[test]
    fn test_create_blog_request_no_sites() {
        let request = CreateBlogRequest {
            slug: "my-post".to_string(),
            author: "Jane Doe".to_string(),
            published_date: NaiveDate::from_ymd_opt(2024, 6, 15).unwrap(),
            reading_time_minutes: None,
            cover_image_id: None,
            header_image_id: None,
            is_featured: false,
            allow_comments: true,
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
    fn test_create_blog_request_invalid_reading_time() {
        let request = CreateBlogRequest {
            slug: "my-post".to_string(),
            author: "Jane Doe".to_string(),
            published_date: NaiveDate::from_ymd_opt(2024, 6, 15).unwrap(),
            reading_time_minutes: Some(1000),
            cover_image_id: None,
            header_image_id: None,
            is_featured: false,
            allow_comments: true,
            status: ContentStatus::Draft,
            publish_start: None,
            publish_end: None,
            site_ids: vec![Uuid::new_v4()],
        };
        let result = request.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_update_blog_request_valid() {
        let request = UpdateBlogRequest {
            slug: Some("updated-slug".to_string()),
            author: Some("Updated Author".to_string()),
            published_date: None,
            reading_time_minutes: Some(15),
            cover_image_id: None,
            header_image_id: None,
            is_featured: Some(true),
            allow_comments: None,
            status: Some(ContentStatus::Published),
            publish_start: None,
            publish_end: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_update_blog_request_all_optional() {
        let request = UpdateBlogRequest {
            slug: None,
            author: None,
            published_date: None,
            reading_time_minutes: None,
            cover_image_id: None,
            header_image_id: None,
            is_featured: None,
            allow_comments: None,
            status: None,
            publish_start: None,
            publish_end: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_blog_list_item_serialization() {
        let item = BlogListItem {
            id: Uuid::new_v4(),
            slug: Some("my-post".to_string()),
            author: "Jane Doe".to_string(),
            published_date: NaiveDate::from_ymd_opt(2024, 6, 15).unwrap(),
            reading_time_minutes: Some(10),
            cover_image_id: None,
            header_image_id: None,
            is_featured: false,
            status: ContentStatus::Published,
            publish_start: None,
            publish_end: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&item).unwrap();
        assert!(json.contains("\"author\":\"Jane Doe\""));
        assert!(json.contains("\"slug\":\"my-post\""));
    }

    #[test]
    fn test_blog_response_serialization() {
        let response = BlogResponse {
            id: Uuid::new_v4(),
            content_id: Uuid::new_v4(),
            slug: Some("test-blog".to_string()),
            author: "Test Author".to_string(),
            published_date: NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
            reading_time_minutes: Some(5),
            cover_image_id: None,
            header_image_id: None,
            is_featured: true,
            allow_comments: true,
            status: ContentStatus::Draft,
            published_at: None,
            publish_start: None,
            publish_end: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"allow_comments\":true"));
        assert!(json.contains("\"status\":\"Draft\""));
    }
}
