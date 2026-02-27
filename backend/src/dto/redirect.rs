//! Redirect DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::models::redirect::Redirect;
use crate::utils::pagination::Paginated;

/// Request to create a redirect
#[derive(Debug, Clone, Deserialize, Validate, ToSchema)]
#[schema(description = "Create a URL redirect")]
pub struct CreateRedirectRequest {
    #[schema(example = "/old-blog-post")]
    #[validate(length(
        min = 1,
        max = 2000,
        message = "Source path must be between 1 and 2000 characters"
    ))]
    #[validate(custom(function = "validate_source_path"))]
    pub source_path: String,

    #[schema(example = "/new-blog-post")]
    #[validate(length(
        min = 1,
        max = 2000,
        message = "Destination path must be between 1 and 2000 characters"
    ))]
    #[validate(custom(function = "validate_destination_path"))]
    pub destination_path: String,

    #[schema(example = 301)]
    #[validate(custom(function = "validate_redirect_status_code"))]
    pub status_code: i16,

    #[schema(example = true)]
    pub is_active: Option<bool>,

    #[schema(example = "Blog post slug changed")]
    #[validate(length(max = 500, message = "Description cannot exceed 500 characters"))]
    pub description: Option<String>,

    /// Site ID (overridden by path param)
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub site_id: Uuid,
}

/// Request to update a redirect
#[derive(Debug, Clone, Deserialize, Validate, ToSchema)]
#[schema(description = "Update a URL redirect")]
pub struct UpdateRedirectRequest {
    #[schema(example = "/updated-source")]
    #[validate(length(
        min = 1,
        max = 2000,
        message = "Source path must be between 1 and 2000 characters"
    ))]
    #[validate(custom(function = "validate_source_path"))]
    pub source_path: Option<String>,

    #[schema(example = "/updated-destination")]
    #[validate(length(
        min = 1,
        max = 2000,
        message = "Destination path must be between 1 and 2000 characters"
    ))]
    #[validate(custom(function = "validate_destination_path"))]
    pub destination_path: Option<String>,

    #[schema(example = 302)]
    #[validate(custom(function = "validate_redirect_status_code"))]
    pub status_code: Option<i16>,

    #[schema(example = false)]
    pub is_active: Option<bool>,

    #[schema(example = "Updated description")]
    #[validate(length(max = 500, message = "Description cannot exceed 500 characters"))]
    pub description: Option<String>,
}

/// Redirect response
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(description = "Redirect details")]
pub struct RedirectResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub site_id: Uuid,
    #[schema(example = "/old-blog-post")]
    pub source_path: String,
    #[schema(example = "/new-blog-post")]
    pub destination_path: String,
    #[schema(example = 301)]
    pub status_code: i16,
    #[schema(example = true)]
    pub is_active: bool,
    #[schema(example = "Blog post slug changed")]
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Redirect> for RedirectResponse {
    fn from(r: Redirect) -> Self {
        Self {
            id: r.id,
            site_id: r.site_id,
            source_path: r.source_path,
            destination_path: r.destination_path,
            status_code: r.status_code,
            is_active: r.is_active,
            description: r.description,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

/// Lightweight redirect lookup response
#[derive(Debug, Clone, Serialize, ToSchema)]
#[schema(description = "Redirect lookup result")]
pub struct RedirectLookupResponse {
    #[schema(example = "/new-blog-post")]
    pub destination_path: String,
    #[schema(example = 301)]
    pub status_code: i16,
}

/// Paginated redirects response
pub type PaginatedRedirects = Paginated<RedirectResponse>;

/// Validate source path: must start with `/`, no `..`
fn validate_source_path(path: &str) -> Result<(), validator::ValidationError> {
    if !path.starts_with('/') {
        let mut err = validator::ValidationError::new("invalid_source_path");
        err.message = Some("Source path must start with /".into());
        return Err(err);
    }
    if path.contains("..") {
        let mut err = validator::ValidationError::new("invalid_source_path");
        err.message = Some("Source path must not contain '..'".into());
        return Err(err);
    }
    Ok(())
}

/// Validate destination path: must start with `/` or `http(s)://`
fn validate_destination_path(path: &str) -> Result<(), validator::ValidationError> {
    if !path.starts_with('/') && !path.starts_with("http://") && !path.starts_with("https://") {
        let mut err = validator::ValidationError::new("invalid_destination_path");
        err.message = Some("Destination must start with / or http(s)://".into());
        return Err(err);
    }
    Ok(())
}

/// Validate redirect status code: must be 301 or 302
fn validate_redirect_status_code(code: i16) -> Result<(), validator::ValidationError> {
    if code != 301 && code != 302 {
        let mut err = validator::ValidationError::new("invalid_status_code");
        err.message = Some("Status code must be 301 or 302".into());
        return Err(err);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_create_redirect_valid() {
        let req = CreateRedirectRequest {
            source_path: "/old-page".to_string(),
            destination_path: "/new-page".to_string(),
            status_code: 301,
            is_active: None,
            description: Some("Moved".to_string()),
            site_id: Uuid::new_v4(),
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_create_redirect_external_destination() {
        let req = CreateRedirectRequest {
            source_path: "/old-page".to_string(),
            destination_path: "https://example.com/new-page".to_string(),
            status_code: 302,
            is_active: Some(true),
            description: None,
            site_id: Uuid::new_v4(),
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_create_redirect_invalid_source_no_slash() {
        let req = CreateRedirectRequest {
            source_path: "old-page".to_string(),
            destination_path: "/new-page".to_string(),
            status_code: 301,
            is_active: None,
            description: None,
            site_id: Uuid::new_v4(),
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_create_redirect_invalid_source_dotdot() {
        let req = CreateRedirectRequest {
            source_path: "/old/../etc/passwd".to_string(),
            destination_path: "/new-page".to_string(),
            status_code: 301,
            is_active: None,
            description: None,
            site_id: Uuid::new_v4(),
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_create_redirect_invalid_destination() {
        let req = CreateRedirectRequest {
            source_path: "/old-page".to_string(),
            destination_path: "not-a-path".to_string(),
            status_code: 301,
            is_active: None,
            description: None,
            site_id: Uuid::new_v4(),
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_create_redirect_invalid_status_code() {
        let req = CreateRedirectRequest {
            source_path: "/old-page".to_string(),
            destination_path: "/new-page".to_string(),
            status_code: 404,
            is_active: None,
            description: None,
            site_id: Uuid::new_v4(),
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_create_redirect_description_too_long() {
        let req = CreateRedirectRequest {
            source_path: "/old-page".to_string(),
            destination_path: "/new-page".to_string(),
            status_code: 301,
            is_active: None,
            description: Some("a".repeat(501)),
            site_id: Uuid::new_v4(),
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_update_redirect_valid() {
        let req = UpdateRedirectRequest {
            source_path: Some("/updated-source".to_string()),
            destination_path: Some("/updated-dest".to_string()),
            status_code: Some(302),
            is_active: Some(false),
            description: Some("Updated".to_string()),
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_update_redirect_all_none() {
        let req = UpdateRedirectRequest {
            source_path: None,
            destination_path: None,
            status_code: None,
            is_active: None,
            description: None,
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_redirect_response_serialization() {
        let resp = RedirectResponse {
            id: Uuid::new_v4(),
            site_id: Uuid::new_v4(),
            source_path: "/old".to_string(),
            destination_path: "/new".to_string(),
            status_code: 301,
            is_active: true,
            description: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"status_code\":301"));
        assert!(json.contains("\"is_active\":true"));
    }

    #[test]
    fn test_redirect_lookup_response_serialization() {
        let resp = RedirectLookupResponse {
            destination_path: "/new-page".to_string(),
            status_code: 301,
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"destination_path\":\"/new-page\""));
    }
}
