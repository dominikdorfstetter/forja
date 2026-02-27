//! Site settings DTOs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use validator::Validate;

use crate::models::site_settings::{
    KEY_ANALYTICS_ENABLED, KEY_CONTACT_EMAIL, KEY_EDITORIAL_WORKFLOW_ENABLED, KEY_MAINTENANCE_MODE,
    KEY_MAX_DOCUMENT_FILE_SIZE, KEY_MAX_MEDIA_FILE_SIZE, KEY_POSTS_PER_PAGE, KEY_PREVIEW_TEMPLATES,
};
use crate::utils::validation::validate_email;

/// A preview template entry (name + URL of a dev server)
#[derive(Debug, Clone, Serialize, Deserialize, Validate, utoipa::ToSchema)]
pub struct PreviewTemplate {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    #[validate(length(min = 1, max = 500))]
    pub url: String,
}

/// Response with all effective site settings (defaults merged with DB)
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Site settings (defaults merged with database values)")]
pub struct SiteSettingsResponse {
    #[schema(example = 10485760)]
    pub max_document_file_size: i64,
    #[schema(example = 52428800)]
    pub max_media_file_size: i64,
    #[schema(example = false)]
    pub analytics_enabled: bool,
    #[schema(example = false)]
    pub maintenance_mode: bool,
    #[schema(example = "")]
    pub contact_email: String,
    #[schema(example = 10)]
    pub posts_per_page: i64,
    #[schema(example = false)]
    pub editorial_workflow_enabled: bool,
    pub preview_templates: Vec<PreviewTemplate>,
}

impl SiteSettingsResponse {
    /// Build from the effective settings HashMap.
    pub fn from_map(map: &HashMap<String, serde_json::Value>) -> Self {
        Self {
            max_document_file_size: map
                .get(KEY_MAX_DOCUMENT_FILE_SIZE)
                .and_then(|v| v.as_i64())
                .unwrap_or(10_485_760),
            max_media_file_size: map
                .get(KEY_MAX_MEDIA_FILE_SIZE)
                .and_then(|v| v.as_i64())
                .unwrap_or(52_428_800),
            analytics_enabled: map
                .get(KEY_ANALYTICS_ENABLED)
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            maintenance_mode: map
                .get(KEY_MAINTENANCE_MODE)
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            contact_email: map
                .get(KEY_CONTACT_EMAIL)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            posts_per_page: map
                .get(KEY_POSTS_PER_PAGE)
                .and_then(|v| v.as_i64())
                .unwrap_or(10),
            editorial_workflow_enabled: map
                .get(KEY_EDITORIAL_WORKFLOW_ENABLED)
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            preview_templates: map
                .get(KEY_PREVIEW_TEMPLATES)
                .and_then(|v| serde_json::from_value::<Vec<PreviewTemplate>>(v.clone()).ok())
                .unwrap_or_default(),
        }
    }
}

/// Request to update site settings (all fields optional)
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update site settings (all fields optional)")]
pub struct UpdateSiteSettingsRequest {
    /// Max document upload size in bytes (1 MB – 100 MB)
    #[validate(range(min = 1_048_576, max = 104_857_600))]
    #[schema(example = 10485760)]
    pub max_document_file_size: Option<i64>,

    /// Max media upload size in bytes (1 MB – 500 MB)
    #[validate(range(min = 1_048_576, max = 524_288_000))]
    #[schema(example = 52428800)]
    pub max_media_file_size: Option<i64>,

    #[schema(example = false)]
    pub analytics_enabled: Option<bool>,

    #[schema(example = false)]
    pub maintenance_mode: Option<bool>,

    #[validate(length(max = 500))]
    #[validate(custom(function = "validate_email"))]
    #[schema(example = "admin@example.com")]
    pub contact_email: Option<String>,

    #[validate(range(min = 1, max = 100))]
    #[schema(example = 10)]
    pub posts_per_page: Option<i64>,

    #[schema(example = false)]
    pub editorial_workflow_enabled: Option<bool>,

    pub preview_templates: Option<Vec<PreviewTemplate>>,
}

impl UpdateSiteSettingsRequest {
    /// Convert non-None fields to (key, value, is_sensitive) tuples for upsert.
    pub fn to_settings_vec(&self) -> Vec<(&str, serde_json::Value, bool)> {
        let mut out = Vec::new();

        if let Some(v) = self.max_document_file_size {
            out.push((KEY_MAX_DOCUMENT_FILE_SIZE, serde_json::json!(v), false));
        }
        if let Some(v) = self.max_media_file_size {
            out.push((KEY_MAX_MEDIA_FILE_SIZE, serde_json::json!(v), false));
        }
        if let Some(v) = self.analytics_enabled {
            out.push((KEY_ANALYTICS_ENABLED, serde_json::json!(v), false));
        }
        if let Some(v) = self.maintenance_mode {
            out.push((KEY_MAINTENANCE_MODE, serde_json::json!(v), false));
        }
        if let Some(ref v) = self.contact_email {
            out.push((KEY_CONTACT_EMAIL, serde_json::json!(v), false));
        }
        if let Some(v) = self.posts_per_page {
            out.push((KEY_POSTS_PER_PAGE, serde_json::json!(v), false));
        }
        if let Some(v) = self.editorial_workflow_enabled {
            out.push((KEY_EDITORIAL_WORKFLOW_ENABLED, serde_json::json!(v), false));
        }
        if let Some(ref v) = self.preview_templates {
            out.push((KEY_PREVIEW_TEMPLATES, serde_json::json!(v), false));
        }

        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_from_map_defaults() {
        let map = crate::models::site_settings::defaults();
        let resp = SiteSettingsResponse::from_map(&map);
        assert_eq!(resp.max_document_file_size, 10_485_760);
        assert_eq!(resp.max_media_file_size, 52_428_800);
        assert!(!resp.analytics_enabled);
        assert!(!resp.maintenance_mode);
        assert_eq!(resp.contact_email, "");
        assert_eq!(resp.posts_per_page, 10);
        assert!(!resp.editorial_workflow_enabled);
        assert!(resp.preview_templates.is_empty());
    }

    #[test]
    fn test_from_map_overrides() {
        let mut map = crate::models::site_settings::defaults();
        map.insert("posts_per_page".into(), serde_json::json!(25));
        map.insert(
            "contact_email".into(),
            serde_json::json!("test@example.com"),
        );
        let resp = SiteSettingsResponse::from_map(&map);
        assert_eq!(resp.posts_per_page, 25);
        assert_eq!(resp.contact_email, "test@example.com");
    }

    #[test]
    fn test_update_request_valid() {
        let req = UpdateSiteSettingsRequest {
            max_document_file_size: Some(5_000_000),
            max_media_file_size: None,
            analytics_enabled: Some(true),
            maintenance_mode: None,
            contact_email: Some("a@b.com".into()),
            posts_per_page: Some(20),
            editorial_workflow_enabled: None,
            preview_templates: None,
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_update_request_doc_size_too_small() {
        let req = UpdateSiteSettingsRequest {
            max_document_file_size: Some(500), // below 1 MB
            max_media_file_size: None,
            analytics_enabled: None,
            maintenance_mode: None,
            contact_email: None,
            posts_per_page: None,
            editorial_workflow_enabled: None,
            preview_templates: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_update_request_doc_size_too_large() {
        let req = UpdateSiteSettingsRequest {
            max_document_file_size: Some(200_000_000), // over 100 MB
            max_media_file_size: None,
            analytics_enabled: None,
            maintenance_mode: None,
            contact_email: None,
            posts_per_page: None,
            editorial_workflow_enabled: None,
            preview_templates: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_update_request_media_size_too_small() {
        let req = UpdateSiteSettingsRequest {
            max_document_file_size: None,
            max_media_file_size: Some(500), // below 1 MB
            analytics_enabled: None,
            maintenance_mode: None,
            contact_email: None,
            posts_per_page: None,
            editorial_workflow_enabled: None,
            preview_templates: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_update_request_posts_per_page_zero() {
        let req = UpdateSiteSettingsRequest {
            max_document_file_size: None,
            max_media_file_size: None,
            analytics_enabled: None,
            maintenance_mode: None,
            contact_email: None,
            posts_per_page: Some(0),
            editorial_workflow_enabled: None,
            preview_templates: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_update_request_posts_per_page_too_high() {
        let req = UpdateSiteSettingsRequest {
            max_document_file_size: None,
            max_media_file_size: None,
            analytics_enabled: None,
            maintenance_mode: None,
            contact_email: None,
            posts_per_page: Some(101),
            editorial_workflow_enabled: None,
            preview_templates: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_update_request_empty_valid() {
        let req = UpdateSiteSettingsRequest {
            max_document_file_size: None,
            max_media_file_size: None,
            analytics_enabled: None,
            maintenance_mode: None,
            contact_email: None,
            posts_per_page: None,
            editorial_workflow_enabled: None,
            preview_templates: None,
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_update_request_invalid_email() {
        let req = UpdateSiteSettingsRequest {
            max_document_file_size: None,
            max_media_file_size: None,
            analytics_enabled: None,
            maintenance_mode: None,
            contact_email: Some("not-an-email".into()),
            posts_per_page: None,
            editorial_workflow_enabled: None,
            preview_templates: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_update_request_valid_email() {
        let req = UpdateSiteSettingsRequest {
            max_document_file_size: None,
            max_media_file_size: None,
            analytics_enabled: None,
            maintenance_mode: None,
            contact_email: Some("admin@example.com".into()),
            posts_per_page: None,
            editorial_workflow_enabled: None,
            preview_templates: None,
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_update_request_empty_email_valid() {
        // Empty string should be valid (clearing the field)
        let req = UpdateSiteSettingsRequest {
            max_document_file_size: None,
            max_media_file_size: None,
            analytics_enabled: None,
            maintenance_mode: None,
            contact_email: Some("".into()),
            posts_per_page: None,
            editorial_workflow_enabled: None,
            preview_templates: None,
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_to_settings_vec() {
        let req = UpdateSiteSettingsRequest {
            max_document_file_size: Some(5_000_000),
            max_media_file_size: None,
            analytics_enabled: Some(true),
            maintenance_mode: None,
            contact_email: None,
            posts_per_page: Some(20),
            editorial_workflow_enabled: None,
            preview_templates: None,
        };
        let vec = req.to_settings_vec();
        assert_eq!(vec.len(), 3);
        assert_eq!(vec[0].0, "max_document_file_size");
        assert_eq!(vec[1].0, "analytics_enabled");
        assert_eq!(vec[2].0, "posts_per_page");
    }

    #[test]
    fn test_response_serialization() {
        let resp = SiteSettingsResponse {
            max_document_file_size: 10_485_760,
            max_media_file_size: 52_428_800,
            analytics_enabled: false,
            maintenance_mode: false,
            contact_email: "".to_string(),
            posts_per_page: 10,
            editorial_workflow_enabled: false,
            preview_templates: vec![],
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"max_document_file_size\":10485760"));
        assert!(json.contains("\"posts_per_page\":10"));
    }
}
