//! Site DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::dto::site_locale::SiteLocaleInput;
use crate::dto::validated::ValidatedDto;
use crate::models::site::Site;

/// Response for preview token generation
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Short-lived JWT for draft content preview")]
pub struct PreviewTokenResponse {
    /// The signed JWT token
    #[schema(example = "eyJhbGciOiJIUzI1NiJ9...")]
    pub token: String,
    /// Token expiry as Unix timestamp
    #[schema(example = 1711000000)]
    pub expires_at: i64,
}

/// Per-category counts of items soft-deleted into the trash by a site
/// content reset (issue #714). Mirrors the trash table set the shared
/// `TrashCleanupWorker` already purges.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[schema(description = "Per-category counts of items moved to trash by a content reset")]
pub struct ResetContentResponse {
    /// Content rows (blogs, pages, CV, project) trashed via `content_sites`.
    pub contents: u64,
    /// `legal_documents` rows trashed (keyed off the same content linkage).
    pub legal_documents: u64,
    /// Site-scoped `documents` rows trashed.
    pub documents: u64,
    /// Site-scoped `social_links` rows trashed.
    pub social_links: u64,
    /// Site-scoped `navigation_menus` rows trashed.
    pub navigation_menus: u64,
    /// Site-scoped `navigation_items` rows trashed.
    pub navigation_items: u64,
    /// Site-owned `media_files` rows trashed (`media_sites.is_owner`).
    pub media_files: u64,
    /// Sum of every category count above.
    pub total: u64,
}

/// Status of an asynchronous site export job (issue #716). Returned by
/// both `POST /sites/{id}/export` (202) and `GET …/export/{jobId}`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[schema(description = "Status of an asynchronous site export job")]
pub struct SiteExportJobResponse {
    /// Export job id — poll `GET /sites/{id}/export/{jobId}` with this.
    pub id: Uuid,
    /// `queued` | `running` | `ready` | `failed`.
    pub status: String,
    /// When the export was requested.
    pub created_at: DateTime<Utc>,
    /// Expiring signed download link — present only while the job is
    /// `ready` and its artifact has not expired.
    pub download_url: Option<String>,
    /// When the download link (and stored artifact) expires.
    pub expires_at: Option<DateTime<Utc>>,
    /// Failure detail — present only when `status == "failed"`.
    pub error: Option<String>,
}

impl SiteExportJobResponse {
    /// Map a job row to its wire shape. `download_url` is supplied by the
    /// handler (it owns route construction) and should be `Some` only for
    /// a `ready`, non-expired job.
    pub fn from_job(
        job: &crate::models::site_export::SiteExportJob,
        download_url: Option<String>,
    ) -> Self {
        Self {
            id: job.id,
            status: job.status.as_str().to_string(),
            created_at: job.created_at,
            download_url,
            expires_at: job.expires_at,
            error: job.error.clone(),
        }
    }
}

/// Request to create a new site
#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, utoipa::ToSchema)]
#[schema(description = "Create a site")]
pub struct CreateSiteRequest {
    #[schema(example = "My Website")]
    #[validate(length(
        min = 1,
        max = 200,
        message = "Name must be between 1 and 200 characters"
    ))]
    pub name: String,

    #[schema(example = "my-website")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Slug must be between 1 and 100 characters"
    ))]
    #[validate(custom(function = "validate_slug"))]
    pub slug: String,

    #[schema(example = "A great website")]
    #[validate(length(max = 1000, message = "Description cannot exceed 1000 characters"))]
    pub description: Option<String>,

    #[schema(example = "https://example.com/logo.png")]
    #[validate(url(message = "Logo URL must be a valid URL"))]
    pub logo_url: Option<String>,

    #[schema(example = "https://example.com/favicon.ico")]
    #[validate(url(message = "Favicon URL must be a valid URL"))]
    pub favicon_url: Option<String>,

    #[schema(example = "https://example.com")]
    #[validate(url(message = "Base URL must be a valid URL"))]
    pub base_url: Option<String>,

    #[validate(custom(function = "validate_theme_json"))]
    pub theme: Option<serde_json::Value>,

    #[schema(example = "Europe/Vienna")]
    #[validate(length(max = 50, message = "Timezone cannot exceed 50 characters"))]
    #[validate(custom(function = "validate_timezone_option"))]
    pub timezone: Option<String>,

    /// Initial locales to assign to the site (optional)
    #[serde(default)]
    pub locales: Option<Vec<SiteLocaleInput>>,
}

/// Request to update a site
#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, utoipa::ToSchema)]
#[schema(description = "Update a site")]
pub struct UpdateSiteRequest {
    #[schema(example = "Updated Website")]
    #[validate(length(
        min = 1,
        max = 200,
        message = "Name must be between 1 and 200 characters"
    ))]
    pub name: Option<String>,

    #[schema(example = "updated-website")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Slug must be between 1 and 100 characters"
    ))]
    #[validate(custom(function = "validate_slug_option"))]
    pub slug: Option<String>,

    #[schema(example = "Updated description")]
    #[validate(length(max = 1000, message = "Description cannot exceed 1000 characters"))]
    pub description: Option<String>,

    #[schema(example = "https://example.com/new-logo.png")]
    #[validate(url(message = "Logo URL must be a valid URL"))]
    pub logo_url: Option<String>,

    #[schema(example = "https://example.com/new-favicon.ico")]
    #[validate(url(message = "Favicon URL must be a valid URL"))]
    pub favicon_url: Option<String>,

    #[schema(example = "https://example.com")]
    #[validate(url(message = "Base URL must be a valid URL"))]
    pub base_url: Option<String>,

    #[validate(custom(function = "validate_theme_json"))]
    pub theme: Option<serde_json::Value>,

    #[schema(example = "Europe/Vienna")]
    #[validate(length(max = 50, message = "Timezone cannot exceed 50 characters"))]
    #[validate(custom(function = "validate_timezone_option"))]
    pub timezone: Option<String>,

    #[schema(example = false)]
    pub is_active: Option<bool>,
}

/// Site response
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[schema(description = "Full site details")]
pub struct SiteResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "My Website")]
    pub name: String,
    #[schema(example = "my-website")]
    pub slug: String,
    #[schema(example = "A great website")]
    pub description: Option<String>,
    #[schema(example = "https://example.com/logo.png")]
    pub logo_url: Option<String>,
    #[schema(example = "https://example.com/favicon.ico")]
    pub favicon_url: Option<String>,
    #[schema(example = "https://example.com")]
    pub base_url: Option<String>,
    pub theme: Option<serde_json::Value>,
    #[schema(example = "660e8400-e29b-41d4-a716-446655440000")]
    pub default_locale_id: Option<Uuid>,
    #[schema(example = "Europe/Vienna")]
    pub timezone: String,
    #[schema(example = true)]
    pub is_active: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by: Option<String>,
    #[schema(example = "2024-01-15T10:30:00Z")]
    pub created_at: DateTime<Utc>,
    #[schema(example = "2024-01-16T12:00:00Z")]
    pub updated_at: DateTime<Utc>,
    /// When the site was soft-deleted. Present only on the deleted-sites
    /// list — drives the restore grace-window countdown.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "2024-02-01T09:00:00Z")]
    pub deleted_at: Option<DateTime<Utc>>,
}

impl From<Site> for SiteResponse {
    fn from(site: Site) -> Self {
        Self {
            id: site.id,
            name: site.name,
            slug: site.slug,
            description: site.description,
            logo_url: site.logo_url,
            favicon_url: site.favicon_url,
            base_url: site.base_url,
            theme: site.theme,
            default_locale_id: site.default_locale_id,
            timezone: site.timezone,
            is_active: site.is_active,
            created_by: site.created_by,
            created_at: site.created_at,
            updated_at: site.updated_at,
            deleted_at: site.deleted_at,
        }
    }
}

/// Feature flags for the site context
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[schema(description = "Feature flags derived from site settings")]
pub struct SiteContextFeatures {
    #[schema(example = false)]
    pub editorial_workflow: bool,
    #[schema(example = true)]
    pub scheduling: bool,
    #[schema(example = true)]
    pub versioning: bool,
    #[schema(example = false)]
    pub analytics: bool,
}

/// Contextual suggestions for the UI
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[schema(description = "UI suggestions based on site state")]
pub struct SiteContextSuggestions {
    #[schema(example = false)]
    pub show_team_workflow_prompt: bool,
}

/// Module enable/disable flags for the site
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[schema(description = "Content module flags — which modules are enabled for this site")]
pub struct SiteContextModules {
    #[schema(example = true)]
    pub blog: bool,
    #[schema(example = true)]
    pub pages: bool,
    #[schema(example = false)]
    pub portfolio: bool,
    #[schema(example = false)]
    pub legal: bool,
    #[schema(example = false)]
    pub documents: bool,
    #[schema(example = false)]
    pub ai: bool,
    #[schema(example = false)]
    pub forms: bool,
    #[schema(example = false)]
    pub collections: bool,
}

/// Site context response for progressive disclosure
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[schema(description = "Site context for adaptive UI — drives progressive disclosure")]
pub struct SiteContextResponse {
    #[schema(example = 1)]
    pub member_count: i64,
    #[schema(example = "owner")]
    pub current_user_role: String,
    pub features: SiteContextFeatures,
    pub suggestions: SiteContextSuggestions,
    pub modules: SiteContextModules,
    /// Template integration data — code injection, SEO defaults, theme colors
    pub integration: SiteContextIntegration,
}

/// Template integration data consumed by frontends for document rendering.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[schema(
    description = "Data for template integration — code injection, SEO defaults, theme colors"
)]
pub struct SiteContextIntegration {
    /// HTML/JS to inject into <head>
    #[schema(example = "")]
    pub code_injection_head: String,
    /// HTML/JS to inject before </body>
    #[schema(example = "")]
    pub code_injection_footer: String,
    /// SEO title template with {{title}} and {{site_name}} placeholders
    #[schema(example = "{{title}} | {{site_name}}")]
    pub seo_title_template: String,
    /// Fallback meta description
    #[schema(example = "")]
    pub seo_default_description: String,
    /// Theme color for manifest/meta tags
    #[schema(example = "#ffffff")]
    pub theme_color: String,
    /// Background color for manifest
    #[schema(example = "#ffffff")]
    pub background_color: String,
}

/// Compute whether the team workflow prompt should be shown.
///
/// Returns true when:
/// - The site has 2+ members (team setup)
/// - Editorial workflow is not yet enabled
/// - The user hasn't dismissed the prompt
pub fn should_show_team_workflow_prompt(
    member_count: i64,
    editorial_workflow: bool,
    prompt_dismissed: bool,
) -> bool {
    member_count >= 2 && !editorial_workflow && !prompt_dismissed
}

/// Import the validation module to use the slug validation function
use crate::utils::validation::{validate_json_depth, validate_slug, validate_timezone};

/// Validate a slug from a string reference
fn validate_slug_option(slug: &str) -> Result<(), validator::ValidationError> {
    validate_slug(slug)
}

/// Validate timezone format for Option<String> fields
fn validate_timezone_option(tz: &str) -> Result<(), validator::ValidationError> {
    validate_timezone(tz)
}

/// Validate theme JSON is not excessively nested
fn validate_theme_json(value: &serde_json::Value) -> Result<(), validator::ValidationError> {
    validate_json_depth(value, 10)
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_create_site_request_valid() {
        let request = CreateSiteRequest {
            name: "My Website".to_string(),
            slug: "my-website".to_string(),
            description: Some("A great website".to_string()),
            logo_url: None,
            favicon_url: None,
            base_url: None,
            theme: None,
            timezone: Some("Europe/Vienna".to_string()),
            locales: None,
        };

        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_site_request_empty_name() {
        let request = CreateSiteRequest {
            name: "".to_string(),
            slug: "my-website".to_string(),
            description: None,
            logo_url: None,
            favicon_url: None,
            base_url: None,
            theme: None,
            timezone: None,
            locales: None,
        };

        let result = request.validate();
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.field_errors().contains_key("name"));
    }

    #[test]
    fn test_create_site_request_empty_slug() {
        let request = CreateSiteRequest {
            name: "My Website".to_string(),
            slug: "".to_string(),
            description: None,
            logo_url: None,
            favicon_url: None,
            base_url: None,
            theme: None,
            timezone: None,
            locales: None,
        };

        let result = request.validate();
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.field_errors().contains_key("slug"));
    }

    #[test]
    fn test_create_site_request_name_too_long() {
        let request = CreateSiteRequest {
            name: "a".repeat(201),
            slug: "my-website".to_string(),
            description: None,
            logo_url: None,
            favicon_url: None,
            base_url: None,
            theme: None,
            timezone: None,
            locales: None,
        };

        let result = request.validate();
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.field_errors().contains_key("name"));
    }

    #[test]
    fn test_update_site_request_valid() {
        let request = UpdateSiteRequest {
            name: Some("Updated Website".to_string()),
            slug: None,
            description: Some("Updated description".to_string()),
            logo_url: None,
            favicon_url: None,
            base_url: None,
            theme: None,
            timezone: None,
            is_active: Some(false),
        };

        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_update_site_request_empty_allowed() {
        // All fields are optional in update
        let request = UpdateSiteRequest {
            name: None,
            slug: None,
            description: None,
            logo_url: None,
            favicon_url: None,
            base_url: None,
            theme: None,
            timezone: None,
            is_active: None,
        };

        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_site_response_serialization() {
        let site = Site {
            id: Uuid::new_v4(),
            name: "Test Site".to_string(),
            slug: "test-site".to_string(),
            description: Some("A test site".to_string()),
            logo_url: None,
            favicon_url: None,
            base_url: None,
            theme: None,
            default_locale_id: None,
            timezone: "UTC".to_string(),
            is_active: true,
            is_deleted: false,
            created_by: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
        };

        let response = SiteResponse::from(site.clone());

        assert_eq!(response.id, site.id);
        assert_eq!(response.name, site.name);
        assert_eq!(response.slug, site.slug);
        assert_eq!(response.is_active, site.is_active);

        // Verify serialization works
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("test-site"));
        assert!(json.contains("Test Site"));
    }

    #[test]
    fn test_site_response_deserialization() {
        let json = r#"{
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "name": "Test Site",
            "slug": "test-site",
            "description": null,
            "logo_url": null,
            "favicon_url": null,
            "base_url": null,
            "theme": null,
            "default_locale_id": null,
            "timezone": "UTC",
            "is_active": true,
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        }"#;

        let response: SiteResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.name, "Test Site");
        assert_eq!(response.slug, "test-site");
        assert!(response.is_active);
    }

    #[test]
    fn test_create_site_request_invalid_timezone() {
        let request = CreateSiteRequest {
            name: "My Website".to_string(),
            slug: "my-website".to_string(),
            description: None,
            logo_url: None,
            favicon_url: None,
            base_url: None,
            theme: None,
            timezone: Some("InvalidTimezone".to_string()),
            locales: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_site_request_theme_too_deep() {
        // Build deeply nested JSON (12 levels)
        let mut deep = serde_json::json!("value");
        for _ in 0..12 {
            deep = serde_json::json!({"nested": deep});
        }

        let request = CreateSiteRequest {
            name: "My Website".to_string(),
            slug: "my-website".to_string(),
            description: None,
            logo_url: None,
            favicon_url: None,
            base_url: None,
            theme: Some(deep),
            timezone: None,
            locales: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_site_request_invalid_slug_pattern() {
        let request = CreateSiteRequest {
            name: "My Website".to_string(),
            slug: "My Website!".to_string(),
            description: None,
            logo_url: None,
            favicon_url: None,
            base_url: None,
            theme: None,
            timezone: None,
            locales: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_site_request_description_too_long() {
        let request = CreateSiteRequest {
            name: "My Website".to_string(),
            slug: "my-website".to_string(),
            description: Some("a".repeat(1001)),
            logo_url: None,
            favicon_url: None,
            base_url: None,
            theme: None,
            timezone: None,
            locales: None,
        };
        let result = request.validate();
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .field_errors()
            .contains_key("description"));
    }

    #[test]
    fn test_update_site_request_invalid_timezone() {
        let request = UpdateSiteRequest {
            name: None,
            slug: None,
            description: None,
            logo_url: None,
            favicon_url: None,
            base_url: None,
            theme: None,
            timezone: Some("BadTimezone".to_string()),
            is_active: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_should_show_team_workflow_prompt_solo_user() {
        // Solo user — never show prompt
        assert!(!should_show_team_workflow_prompt(1, false, false));
    }

    #[test]
    fn test_should_show_team_workflow_prompt_team_without_workflow() {
        // Team (2+) without editorial workflow and not dismissed — show prompt
        assert!(should_show_team_workflow_prompt(2, false, false));
        assert!(should_show_team_workflow_prompt(5, false, false));
    }

    #[test]
    fn test_should_show_team_workflow_prompt_already_enabled() {
        // Team with editorial workflow already enabled — don't show
        assert!(!should_show_team_workflow_prompt(3, true, false));
    }

    #[test]
    fn test_should_show_team_workflow_prompt_dismissed() {
        // Team without workflow but prompt dismissed — don't show
        assert!(!should_show_team_workflow_prompt(2, false, true));
    }

    #[test]
    fn test_site_context_response_serialization() {
        let response = SiteContextResponse {
            member_count: 1,
            current_user_role: "owner".to_string(),
            features: SiteContextFeatures {
                editorial_workflow: false,
                scheduling: true,
                versioning: true,
                analytics: false,
            },
            suggestions: SiteContextSuggestions {
                show_team_workflow_prompt: false,
            },
            modules: SiteContextModules {
                blog: true,
                pages: true,
                portfolio: false,
                legal: false,
                documents: false,
                ai: false,
                forms: false,
                collections: false,
            },
            integration: SiteContextIntegration {
                code_injection_head: "".to_string(),
                code_injection_footer: "".to_string(),
                seo_title_template: "{{title}} | {{site_name}}".to_string(),
                seo_default_description: "".to_string(),
                theme_color: "#ffffff".to_string(),
                background_color: "#ffffff".to_string(),
            },
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"member_count\":1"));
        assert!(json.contains("\"current_user_role\":\"owner\""));
        assert!(json.contains("\"editorial_workflow\":false"));
        assert!(json.contains("\"integration\""));
        assert!(json.contains("\"scheduling\":true"));
        assert!(json.contains("\"show_team_workflow_prompt\":false"));
        assert!(json.contains("\"blog\":true"));
        assert!(json.contains("\"portfolio\":false"));
    }

    #[test]
    fn test_update_site_request_slug_with_uppercase() {
        let request = UpdateSiteRequest {
            name: None,
            slug: Some("My-Slug".to_string()),
            description: None,
            logo_url: None,
            favicon_url: None,
            base_url: None,
            theme: None,
            timezone: None,
            is_active: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_site_request_valid_base_url() {
        let request = CreateSiteRequest {
            name: "My Website".to_string(),
            slug: "my-website".to_string(),
            description: None,
            logo_url: None,
            favicon_url: None,
            base_url: Some("https://example.com".to_string()),
            theme: None,
            timezone: None,
            locales: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_site_request_invalid_base_url() {
        let request = CreateSiteRequest {
            name: "My Website".to_string(),
            slug: "my-website".to_string(),
            description: None,
            logo_url: None,
            favicon_url: None,
            base_url: Some("not-a-url".to_string()),
            theme: None,
            timezone: None,
            locales: None,
        };
        let result = request.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().field_errors().contains_key("base_url"));
    }

    #[test]
    fn test_update_site_request_valid_base_url() {
        let request = UpdateSiteRequest {
            name: None,
            slug: None,
            description: None,
            logo_url: None,
            favicon_url: None,
            base_url: Some("https://myblog.example.com".to_string()),
            theme: None,
            timezone: None,
            is_active: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_update_site_request_invalid_base_url() {
        let request = UpdateSiteRequest {
            name: None,
            slug: None,
            description: None,
            logo_url: None,
            favicon_url: None,
            base_url: Some("ftp://bad-protocol".to_string()),
            theme: None,
            timezone: None,
            is_active: None,
        };
        // ftp:// is technically a valid URL per the validator crate, so this should pass
        // The frontend enforces https:// protocol
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_site_response_includes_base_url() {
        let site = Site {
            id: Uuid::new_v4(),
            name: "Test".to_string(),
            slug: "test".to_string(),
            description: None,
            logo_url: None,
            favicon_url: None,
            base_url: Some("https://test.example.com".to_string()),
            theme: None,
            default_locale_id: None,
            timezone: "UTC".to_string(),
            is_active: true,
            is_deleted: false,
            created_by: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
        };

        let response = SiteResponse::from(site);
        assert_eq!(
            response.base_url,
            Some("https://test.example.com".to_string())
        );
    }
}
