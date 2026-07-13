//! Site settings DTOs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use validator::Validate;

use crate::dto::validated::ValidatedDto;

use crate::models::site_settings::{
    KEY_ALLOWED_ORIGINS, KEY_ANALYTICS_ENABLED, KEY_BACKGROUND_COLOR, KEY_CODE_INJECTION_FOOTER,
    KEY_CODE_INJECTION_HEAD, KEY_CONTACT_EMAIL, KEY_DATA_RETENTION_DAYS,
    KEY_DOCUMENT_PASSWORD_MIN_LENGTH, KEY_DOCUMENT_PASSWORD_REGEX, KEY_EDITORIAL_WORKFLOW_ENABLED,
    KEY_MAINTENANCE_MODE, KEY_MAX_DOCUMENT_FILE_SIZE, KEY_MAX_MEDIA_FILE_SIZE,
    KEY_MODULE_AI_ENABLED, KEY_MODULE_BLOG_ENABLED, KEY_MODULE_COLLECTIONS_ENABLED,
    KEY_MODULE_DOCUMENTS_ENABLED, KEY_MODULE_FORMS_ENABLED, KEY_MODULE_LEGAL_ENABLED,
    KEY_MODULE_PAGES_ENABLED, KEY_MODULE_PORTFOLIO_ENABLED, KEY_PREVIEW_TEMPLATES,
    KEY_ROBOTS_TXT_RULES, KEY_SEO_DEFAULT_DESCRIPTION, KEY_SEO_DEFAULT_OG_IMAGE_ID,
    KEY_SEO_TITLE_TEMPLATE, KEY_STORAGE_QUOTA_BYTES, KEY_TEAM_FEATURES_PROMPT_DISMISSED,
    KEY_THEME_COLOR,
};
use crate::utils::validation::{
    validate_allowed_origins, validate_data_retention_days, validate_email,
    validate_storage_quota_bytes,
};

/// Storage usage for a single site.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Storage usage and quota for a site")]
pub struct StorageUsageResponse {
    /// Site UUID
    pub site_id: String,
    /// Total bytes used by media files
    #[schema(example = 123456789)]
    pub media_bytes: i64,
    /// Total bytes used by documents
    #[schema(example = 5242880)]
    pub document_bytes: i64,
    /// Total bytes used (media + documents)
    #[schema(example = 128698869)]
    pub total_bytes: i64,
    /// Configured quota in bytes
    #[schema(example = 1073741824)]
    pub quota_bytes: i64,
    /// Usage as a percentage (0.0 – 100.0+)
    #[schema(example = 12.0)]
    pub usage_percent: f64,
}

/// Storage overview for system admin (all sites).
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "System-wide storage usage across all sites")]
pub struct SystemStorageOverviewResponse {
    /// Per-site breakdown
    pub sites: Vec<SiteStorageSummary>,
    /// Total bytes used across all sites
    #[schema(example = 500000000)]
    pub total_bytes: i64,
    /// Total quota across all sites
    #[schema(example = 2147483647)]
    pub total_quota_bytes: i64,
}

/// Per-site storage summary in system overview.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct SiteStorageSummary {
    pub site_id: String,
    pub site_name: String,
    #[schema(example = 128698869)]
    pub total_bytes: i64,
    #[schema(example = 1073741824)]
    pub quota_bytes: i64,
    #[schema(example = 12.0)]
    pub usage_percent: f64,
}

/// Per-site overview for system admin — combines site info, settings, storage, and member count.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Per-site overview for system admin dashboard")]
pub struct SiteOverviewEntry {
    pub site_id: String,
    pub site_name: String,
    pub slug: String,
    pub is_active: bool,
    pub maintenance_mode: bool,
    pub member_count: i64,
    pub total_storage_bytes: i64,
    pub storage_quota_bytes: i64,
    pub storage_usage_percent: f64,
    pub created_at: String,
}

/// System-wide sites overview response.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "System-wide sites overview with combined metrics")]
pub struct SitesOverviewResponse {
    pub sites: Vec<SiteOverviewEntry>,
    pub total_sites: usize,
}

/// A preview template entry (name + URL of a dev server)
#[derive(Debug, Clone, Serialize, Deserialize, Validate, utoipa::ToSchema)]
pub struct PreviewTemplate {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    #[validate(length(min = 1, max = 500))]
    pub url: String,
    /// True for server-configured templates (read-only, not stored in DB)
    #[serde(default)]
    #[schema(example = false)]
    pub is_builtin: bool,
}

/// A single directive within a robots.txt user-agent block
#[derive(Debug, Clone, Serialize, Deserialize, Validate, utoipa::ToSchema)]
pub struct RobotsTxtDirective {
    /// "Allow" or "Disallow"
    #[validate(length(min = 1, max = 20))]
    #[schema(example = "Allow")]
    pub directive: String,
    /// The path this directive applies to
    #[validate(length(max = 500))]
    #[schema(example = "/")]
    pub path: String,
}

/// A user-agent block in robots.txt rules
#[derive(Debug, Clone, Serialize, Deserialize, Validate, utoipa::ToSchema)]
pub struct RobotsTxtRule {
    /// User-agent string (e.g. "*", "Googlebot")
    #[validate(length(min = 1, max = 200))]
    #[schema(example = "*")]
    pub user_agent: String,
    /// Directives for this user-agent
    pub rules: Vec<RobotsTxtDirective>,
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
    #[schema(example = false)]
    pub editorial_workflow_enabled: bool,
    pub preview_templates: Vec<PreviewTemplate>,
    // Document password policy
    #[schema(example = 8)]
    pub document_password_min_length: i64,
    #[schema(example = "")]
    pub document_password_regex: String,
    // Module flags
    #[schema(example = true)]
    pub module_blog_enabled: bool,
    #[schema(example = true)]
    pub module_pages_enabled: bool,
    #[schema(example = false)]
    pub module_portfolio_enabled: bool,
    #[schema(example = false)]
    pub module_legal_enabled: bool,
    #[schema(example = false)]
    pub module_documents_enabled: bool,
    #[schema(example = false)]
    pub module_ai_enabled: bool,
    #[schema(example = false)]
    pub module_forms_enabled: bool,
    #[schema(example = false)]
    pub module_collections_enabled: bool,
    // SEO
    pub robots_txt_rules: Vec<RobotsTxtRule>,
    #[schema(example = "{{title}} | {{site_name}}")]
    pub seo_title_template: String,
    #[schema(example = "")]
    pub seo_default_description: String,
    /// UUID of a media file to use as default OG image (null if unset)
    pub seo_default_og_image_id: Option<String>,
    // Favicon / manifest
    #[schema(example = "#ffffff")]
    pub theme_color: String,
    #[schema(example = "#ffffff")]
    pub background_color: String,
    // Code injection
    #[schema(example = "")]
    pub code_injection_head: String,
    #[schema(example = "")]
    pub code_injection_footer: String,
    // Storage quota
    #[schema(example = 1073741824)]
    pub storage_quota_bytes: i64,
    // CORS allowed origins
    /// List of allowed origins for cross-origin requests (e.g. ["https://myblog.com"])
    pub allowed_origins: Vec<String>,
    // GDPR data retention (#19)
    /// Days audit logs / change history are retained before the purge worker
    /// deletes them (null = retention purge disabled)
    #[schema(example = 365)]
    pub data_retention_days: Option<i64>,
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
            editorial_workflow_enabled: map
                .get(KEY_EDITORIAL_WORKFLOW_ENABLED)
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            preview_templates: map
                .get(KEY_PREVIEW_TEMPLATES)
                .and_then(|v| serde_json::from_value::<Vec<PreviewTemplate>>(v.clone()).ok())
                .unwrap_or_default(),
            document_password_min_length: map
                .get(KEY_DOCUMENT_PASSWORD_MIN_LENGTH)
                .and_then(|v| v.as_i64())
                .unwrap_or(8),
            document_password_regex: map
                .get(KEY_DOCUMENT_PASSWORD_REGEX)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            module_blog_enabled: map
                .get(KEY_MODULE_BLOG_ENABLED)
                .and_then(|v| v.as_bool())
                .unwrap_or(true),
            module_pages_enabled: map
                .get(KEY_MODULE_PAGES_ENABLED)
                .and_then(|v| v.as_bool())
                .unwrap_or(true),
            module_portfolio_enabled: map
                .get(KEY_MODULE_PORTFOLIO_ENABLED)
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            module_legal_enabled: map
                .get(KEY_MODULE_LEGAL_ENABLED)
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            module_documents_enabled: map
                .get(KEY_MODULE_DOCUMENTS_ENABLED)
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            module_ai_enabled: map
                .get(KEY_MODULE_AI_ENABLED)
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            module_forms_enabled: map
                .get(KEY_MODULE_FORMS_ENABLED)
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            module_collections_enabled: map
                .get(KEY_MODULE_COLLECTIONS_ENABLED)
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            robots_txt_rules: map
                .get(KEY_ROBOTS_TXT_RULES)
                .and_then(|v| serde_json::from_value::<Vec<RobotsTxtRule>>(v.clone()).ok())
                .unwrap_or_else(|| {
                    vec![RobotsTxtRule {
                        user_agent: "*".to_string(),
                        rules: vec![RobotsTxtDirective {
                            directive: "Allow".to_string(),
                            path: "/".to_string(),
                        }],
                    }]
                }),
            seo_title_template: map
                .get(KEY_SEO_TITLE_TEMPLATE)
                .and_then(|v| v.as_str())
                .unwrap_or("{{title}} | {{site_name}}")
                .to_string(),
            seo_default_description: map
                .get(KEY_SEO_DEFAULT_DESCRIPTION)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            seo_default_og_image_id: map
                .get(KEY_SEO_DEFAULT_OG_IMAGE_ID)
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            theme_color: map
                .get(KEY_THEME_COLOR)
                .and_then(|v| v.as_str())
                .unwrap_or("#ffffff")
                .to_string(),
            background_color: map
                .get(KEY_BACKGROUND_COLOR)
                .and_then(|v| v.as_str())
                .unwrap_or("#ffffff")
                .to_string(),
            code_injection_head: map
                .get(KEY_CODE_INJECTION_HEAD)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            code_injection_footer: map
                .get(KEY_CODE_INJECTION_FOOTER)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            storage_quota_bytes: map
                .get(KEY_STORAGE_QUOTA_BYTES)
                .and_then(|v| v.as_i64())
                .unwrap_or(1_073_741_824),
            allowed_origins: map
                .get(KEY_ALLOWED_ORIGINS)
                .and_then(|v| serde_json::from_value::<Vec<String>>(v.clone()).ok())
                .unwrap_or_default(),
            data_retention_days: map.get(KEY_DATA_RETENTION_DAYS).and_then(|v| v.as_i64()),
        }
    }
}

/// Curated public subset of site settings, readable by Viewer-tier keys.
///
/// Sensitivity is this code-side field-pick — the `is_sensitive` DB column
/// is dead and must not be trusted. Operational config (allowed origins,
/// quotas, retention, module flags) stays on the Admin-only
/// [`SiteSettingsResponse`].
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Public subset of site settings (Viewer-tier read)")]
pub struct PublicSiteSettingsResponse {
    /// Public contact email; empty string when unset
    #[schema(example = "hello@example.com")]
    pub contact_email: String,
    /// Theme color for the web manifest (hex)
    #[schema(example = "#ffffff")]
    pub theme_color: String,
    /// Background color for the web manifest (hex)
    #[schema(example = "#ffffff")]
    pub background_color: String,
    /// SEO title template
    #[schema(example = "{{title}} | {{site_name}}")]
    pub seo_title_template: String,
    /// Fallback meta description; empty string when unset
    #[schema(example = "")]
    pub seo_default_description: String,
    /// Whether the site is in maintenance mode. Public by design: SSR
    /// frontends need it (with a Viewer-tier key) to swap the whole
    /// site for a maintenance page while operators work in the admin.
    #[schema(example = false)]
    pub maintenance_mode: bool,
}

impl PublicSiteSettingsResponse {
    /// Field-pick from the effective settings map, using the same house
    /// defaults as `GET /sites/{id}/context` for absent keys.
    pub fn from_map(map: &HashMap<String, serde_json::Value>) -> Self {
        let str_or = |key: &str, default: &str| {
            map.get(key)
                .and_then(|v| v.as_str())
                .unwrap_or(default)
                .to_string()
        };
        Self {
            contact_email: str_or(KEY_CONTACT_EMAIL, ""),
            theme_color: str_or(KEY_THEME_COLOR, "#ffffff"),
            background_color: str_or(KEY_BACKGROUND_COLOR, "#ffffff"),
            seo_title_template: str_or(KEY_SEO_TITLE_TEMPLATE, "{{title}} | {{site_name}}"),
            seo_default_description: str_or(KEY_SEO_DEFAULT_DESCRIPTION, ""),
            maintenance_mode: map
                .get(KEY_MAINTENANCE_MODE)
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
        }
    }
}

/// Request to update site settings (all fields optional)
#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, utoipa::ToSchema)]
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

    #[schema(example = false)]
    pub editorial_workflow_enabled: Option<bool>,

    pub preview_templates: Option<Vec<PreviewTemplate>>,

    /// Dismiss the team features prompt banner
    #[schema(example = false)]
    pub team_features_prompt_dismissed: Option<bool>,

    // Document password policy
    /// Minimum password length for document encryption (4–128)
    #[validate(range(min = 4, max = 128))]
    #[schema(example = 8)]
    pub document_password_min_length: Option<i64>,

    /// Regex pattern for document password validation (empty = no regex)
    #[validate(length(max = 500))]
    #[schema(example = "")]
    pub document_password_regex: Option<String>,

    // Module flags
    pub module_blog_enabled: Option<bool>,
    pub module_pages_enabled: Option<bool>,
    pub module_portfolio_enabled: Option<bool>,
    pub module_legal_enabled: Option<bool>,
    pub module_documents_enabled: Option<bool>,
    pub module_ai_enabled: Option<bool>,
    pub module_forms_enabled: Option<bool>,
    pub module_collections_enabled: Option<bool>,

    // SEO
    pub robots_txt_rules: Option<Vec<RobotsTxtRule>>,

    /// SEO title template (e.g. "{{title}} | {{site_name}}")
    #[validate(length(max = 500))]
    #[schema(example = "{{title}} | {{site_name}}")]
    pub seo_title_template: Option<String>,

    /// Fallback meta description
    #[validate(length(max = 500))]
    #[schema(example = "My site's default description")]
    pub seo_default_description: Option<String>,

    /// UUID of a media file to use as default OG image (null to clear)
    pub seo_default_og_image_id: Option<serde_json::Value>,

    /// Theme color for web manifest (hex, e.g. "#4a90d9")
    #[validate(length(max = 20))]
    #[schema(example = "#ffffff")]
    pub theme_color: Option<String>,

    /// Background color for web manifest (hex, e.g. "#ffffff")
    #[validate(length(max = 20))]
    #[schema(example = "#ffffff")]
    pub background_color: Option<String>,

    /// HTML/JS to inject into <head> (max 10,000 chars)
    #[validate(length(max = 10000))]
    #[schema(example = "")]
    pub code_injection_head: Option<String>,

    /// HTML/JS to inject before </body> (max 10,000 chars)
    #[validate(length(max = 10000))]
    #[schema(example = "")]
    pub code_injection_footer: Option<String>,

    /// Storage quota in bytes (100 MB – 1 TB). System admin only.
    #[validate(custom(function = "validate_storage_quota_bytes"))]
    #[schema(example = 1073741824)]
    pub storage_quota_bytes: Option<i64>,

    /// Allowed origins for per-site CORS (e.g. ["https://myblog.com"])
    #[validate(custom(function = "validate_allowed_origins"))]
    pub allowed_origins: Option<Vec<String>>,

    /// GDPR data retention in days for audit logs / change history (30–3650;
    /// JSON null disables the retention purge, absent = no change)
    #[validate(custom(function = "validate_data_retention_days"))]
    #[schema(example = 365)]
    pub data_retention_days: Option<serde_json::Value>,
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
        if let Some(v) = self.editorial_workflow_enabled {
            out.push((KEY_EDITORIAL_WORKFLOW_ENABLED, serde_json::json!(v), false));
        }
        if let Some(ref v) = self.preview_templates {
            out.push((KEY_PREVIEW_TEMPLATES, serde_json::json!(v), false));
        }
        if let Some(v) = self.team_features_prompt_dismissed {
            out.push((
                KEY_TEAM_FEATURES_PROMPT_DISMISSED,
                serde_json::json!(v),
                false,
            ));
        }
        if let Some(v) = self.document_password_min_length {
            out.push((
                KEY_DOCUMENT_PASSWORD_MIN_LENGTH,
                serde_json::json!(v),
                false,
            ));
        }
        if let Some(ref v) = self.document_password_regex {
            out.push((KEY_DOCUMENT_PASSWORD_REGEX, serde_json::json!(v), false));
        }
        if let Some(v) = self.module_blog_enabled {
            out.push((KEY_MODULE_BLOG_ENABLED, serde_json::json!(v), false));
        }
        if let Some(v) = self.module_pages_enabled {
            out.push((KEY_MODULE_PAGES_ENABLED, serde_json::json!(v), false));
        }
        if let Some(v) = self.module_portfolio_enabled {
            out.push((KEY_MODULE_PORTFOLIO_ENABLED, serde_json::json!(v), false));
        }
        if let Some(v) = self.module_legal_enabled {
            out.push((KEY_MODULE_LEGAL_ENABLED, serde_json::json!(v), false));
        }
        if let Some(v) = self.module_documents_enabled {
            out.push((KEY_MODULE_DOCUMENTS_ENABLED, serde_json::json!(v), false));
        }
        if let Some(v) = self.module_ai_enabled {
            out.push((KEY_MODULE_AI_ENABLED, serde_json::json!(v), false));
        }
        if let Some(v) = self.module_forms_enabled {
            out.push((KEY_MODULE_FORMS_ENABLED, serde_json::json!(v), false));
        }
        if let Some(v) = self.module_collections_enabled {
            out.push((KEY_MODULE_COLLECTIONS_ENABLED, serde_json::json!(v), false));
        }
        if let Some(ref v) = self.robots_txt_rules {
            out.push((KEY_ROBOTS_TXT_RULES, serde_json::json!(v), false));
        }
        if let Some(ref v) = self.seo_title_template {
            out.push((KEY_SEO_TITLE_TEMPLATE, serde_json::json!(v), false));
        }
        if let Some(ref v) = self.seo_default_description {
            out.push((KEY_SEO_DEFAULT_DESCRIPTION, serde_json::json!(v), false));
        }
        if let Some(ref v) = self.seo_default_og_image_id {
            out.push((KEY_SEO_DEFAULT_OG_IMAGE_ID, v.clone(), false));
        }
        if let Some(ref v) = self.theme_color {
            out.push((KEY_THEME_COLOR, serde_json::json!(v), false));
        }
        if let Some(ref v) = self.background_color {
            out.push((KEY_BACKGROUND_COLOR, serde_json::json!(v), false));
        }
        if let Some(ref v) = self.code_injection_head {
            out.push((KEY_CODE_INJECTION_HEAD, serde_json::json!(v), false));
        }
        if let Some(ref v) = self.code_injection_footer {
            out.push((KEY_CODE_INJECTION_FOOTER, serde_json::json!(v), false));
        }
        if let Some(v) = self.storage_quota_bytes {
            out.push((KEY_STORAGE_QUOTA_BYTES, serde_json::json!(v), false));
        }
        if let Some(ref v) = self.allowed_origins {
            out.push((KEY_ALLOWED_ORIGINS, serde_json::json!(v), false));
        }
        if let Some(ref v) = self.data_retention_days {
            out.push((KEY_DATA_RETENTION_DAYS, v.clone(), false));
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
        assert!(!resp.editorial_workflow_enabled);
        assert!(resp.preview_templates.is_empty());
        assert!(resp.module_blog_enabled);
        assert!(resp.module_pages_enabled);
        assert!(!resp.module_portfolio_enabled);
        assert!(!resp.module_legal_enabled);
        assert!(!resp.module_documents_enabled);
        assert!(!resp.module_ai_enabled);
        assert_eq!(resp.robots_txt_rules.len(), 1);
        assert_eq!(resp.robots_txt_rules[0].user_agent, "*");
        assert_eq!(resp.seo_title_template, "{{title}} | {{site_name}}");
        assert_eq!(resp.seo_default_description, "");
        assert!(resp.seo_default_og_image_id.is_none());
        assert_eq!(resp.theme_color, "#ffffff");
        assert_eq!(resp.background_color, "#ffffff");
        assert_eq!(resp.code_injection_head, "");
        assert_eq!(resp.code_injection_footer, "");
        assert_eq!(resp.storage_quota_bytes, 1_073_741_824);
        assert!(resp.allowed_origins.is_empty());
    }

    #[test]
    fn test_from_map_overrides() {
        let mut map = crate::models::site_settings::defaults();
        map.insert(
            "contact_email".into(),
            serde_json::json!("test@example.com"),
        );
        let resp = SiteSettingsResponse::from_map(&map);
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
            editorial_workflow_enabled: None,
            preview_templates: None,
            team_features_prompt_dismissed: None,
            module_blog_enabled: Some(true),
            module_pages_enabled: None,
            module_portfolio_enabled: None,
            module_legal_enabled: None,
            module_documents_enabled: None,
            module_ai_enabled: None,
            module_forms_enabled: None,
            module_collections_enabled: None,

            document_password_min_length: None,
            document_password_regex: None,
            robots_txt_rules: None,
            seo_title_template: None,
            seo_default_description: None,
            seo_default_og_image_id: None,
            theme_color: None,
            background_color: None,
            code_injection_head: None,
            code_injection_footer: None,
            storage_quota_bytes: None,
            allowed_origins: None,
            data_retention_days: None,
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

            editorial_workflow_enabled: None,
            preview_templates: None,
            team_features_prompt_dismissed: None,
            module_blog_enabled: None,
            module_pages_enabled: None,
            module_portfolio_enabled: None,
            module_legal_enabled: None,
            module_documents_enabled: None,
            module_ai_enabled: None,
            module_forms_enabled: None,
            module_collections_enabled: None,

            document_password_min_length: None,
            document_password_regex: None,
            robots_txt_rules: None,
            seo_title_template: None,
            seo_default_description: None,
            seo_default_og_image_id: None,
            theme_color: None,
            background_color: None,
            code_injection_head: None,
            code_injection_footer: None,
            storage_quota_bytes: None,
            allowed_origins: None,
            data_retention_days: None,
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

            editorial_workflow_enabled: None,
            preview_templates: None,
            team_features_prompt_dismissed: None,
            module_blog_enabled: None,
            module_pages_enabled: None,
            module_portfolio_enabled: None,
            module_legal_enabled: None,
            module_documents_enabled: None,
            module_ai_enabled: None,
            module_forms_enabled: None,
            module_collections_enabled: None,

            document_password_min_length: None,
            document_password_regex: None,
            robots_txt_rules: None,
            seo_title_template: None,
            seo_default_description: None,
            seo_default_og_image_id: None,
            theme_color: None,
            background_color: None,
            code_injection_head: None,
            code_injection_footer: None,
            storage_quota_bytes: None,
            allowed_origins: None,
            data_retention_days: None,
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

            editorial_workflow_enabled: None,
            preview_templates: None,
            team_features_prompt_dismissed: None,
            module_blog_enabled: None,
            module_pages_enabled: None,
            module_portfolio_enabled: None,
            module_legal_enabled: None,
            module_documents_enabled: None,
            module_ai_enabled: None,
            module_forms_enabled: None,
            module_collections_enabled: None,

            document_password_min_length: None,
            document_password_regex: None,
            robots_txt_rules: None,
            seo_title_template: None,
            seo_default_description: None,
            seo_default_og_image_id: None,
            theme_color: None,
            background_color: None,
            code_injection_head: None,
            code_injection_footer: None,
            storage_quota_bytes: None,
            allowed_origins: None,
            data_retention_days: None,
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

            editorial_workflow_enabled: None,
            preview_templates: None,
            team_features_prompt_dismissed: None,
            module_blog_enabled: None,
            module_pages_enabled: None,
            module_portfolio_enabled: None,
            module_legal_enabled: None,
            module_documents_enabled: None,
            module_ai_enabled: None,
            module_forms_enabled: None,
            module_collections_enabled: None,

            document_password_min_length: None,
            document_password_regex: None,
            robots_txt_rules: None,
            seo_title_template: None,
            seo_default_description: None,
            seo_default_og_image_id: None,
            theme_color: None,
            background_color: None,
            code_injection_head: None,
            code_injection_footer: None,
            storage_quota_bytes: None,
            allowed_origins: None,
            data_retention_days: None,
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

            editorial_workflow_enabled: None,
            preview_templates: None,
            team_features_prompt_dismissed: None,
            module_blog_enabled: None,
            module_pages_enabled: None,
            module_portfolio_enabled: None,
            module_legal_enabled: None,
            module_documents_enabled: None,
            module_ai_enabled: None,
            module_forms_enabled: None,
            module_collections_enabled: None,

            document_password_min_length: None,
            document_password_regex: None,
            robots_txt_rules: None,
            seo_title_template: None,
            seo_default_description: None,
            seo_default_og_image_id: None,
            theme_color: None,
            background_color: None,
            code_injection_head: None,
            code_injection_footer: None,
            storage_quota_bytes: None,
            allowed_origins: None,
            data_retention_days: None,
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

            editorial_workflow_enabled: None,
            preview_templates: None,
            team_features_prompt_dismissed: None,
            module_blog_enabled: None,
            module_pages_enabled: None,
            module_portfolio_enabled: None,
            module_legal_enabled: None,
            module_documents_enabled: None,
            module_ai_enabled: None,
            module_forms_enabled: None,
            module_collections_enabled: None,

            document_password_min_length: None,
            document_password_regex: None,
            robots_txt_rules: None,
            seo_title_template: None,
            seo_default_description: None,
            seo_default_og_image_id: None,
            theme_color: None,
            background_color: None,
            code_injection_head: None,
            code_injection_footer: None,
            storage_quota_bytes: None,
            allowed_origins: None,
            data_retention_days: None,
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

            editorial_workflow_enabled: None,
            preview_templates: None,
            team_features_prompt_dismissed: None,
            module_blog_enabled: None,
            module_pages_enabled: None,
            module_portfolio_enabled: None,
            module_legal_enabled: None,
            module_documents_enabled: None,
            module_ai_enabled: None,
            module_forms_enabled: None,
            module_collections_enabled: None,

            document_password_min_length: None,
            document_password_regex: None,
            robots_txt_rules: None,
            seo_title_template: None,
            seo_default_description: None,
            seo_default_og_image_id: None,
            theme_color: None,
            background_color: None,
            code_injection_head: None,
            code_injection_footer: None,
            storage_quota_bytes: None,
            allowed_origins: None,
            data_retention_days: None,
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
            editorial_workflow_enabled: None,
            preview_templates: None,
            team_features_prompt_dismissed: None,
            module_blog_enabled: Some(true),
            module_pages_enabled: None,
            module_portfolio_enabled: None,
            module_legal_enabled: None,
            module_documents_enabled: None,
            module_ai_enabled: None,
            module_forms_enabled: None,
            module_collections_enabled: None,

            document_password_min_length: None,
            document_password_regex: None,
            robots_txt_rules: None,
            seo_title_template: None,
            seo_default_description: None,
            seo_default_og_image_id: None,
            theme_color: None,
            background_color: None,
            code_injection_head: None,
            code_injection_footer: None,
            storage_quota_bytes: None,
            allowed_origins: None,
            data_retention_days: None,
        };
        let vec = req.to_settings_vec();
        assert_eq!(vec.len(), 3);
        assert_eq!(vec[0].0, "max_document_file_size");
        assert_eq!(vec[1].0, "analytics_enabled");
        assert_eq!(vec[2].0, "module_blog_enabled");
    }

    #[test]
    fn test_response_serialization() {
        let resp = SiteSettingsResponse {
            max_document_file_size: 10_485_760,
            max_media_file_size: 52_428_800,
            analytics_enabled: false,
            maintenance_mode: false,
            contact_email: "".to_string(),
            editorial_workflow_enabled: false,
            preview_templates: vec![],
            module_blog_enabled: true,
            module_pages_enabled: true,
            module_portfolio_enabled: false,
            module_legal_enabled: false,
            module_documents_enabled: false,
            module_ai_enabled: false,
            module_forms_enabled: false,
            module_collections_enabled: false,
            document_password_min_length: 8,
            document_password_regex: "".to_string(),
            robots_txt_rules: vec![RobotsTxtRule {
                user_agent: "*".to_string(),
                rules: vec![RobotsTxtDirective {
                    directive: "Allow".to_string(),
                    path: "/".to_string(),
                }],
            }],
            seo_title_template: "{{title}} | {{site_name}}".to_string(),
            seo_default_description: "".to_string(),
            seo_default_og_image_id: None,
            theme_color: "#ffffff".to_string(),
            background_color: "#ffffff".to_string(),
            code_injection_head: "".to_string(),
            code_injection_footer: "".to_string(),
            storage_quota_bytes: 1_073_741_824,
            allowed_origins: vec![],
            data_retention_days: None,
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"max_document_file_size\":10485760"));
        assert!(json.contains("\"seo_title_template\""));
    }

    #[test]
    fn test_update_request_valid_allowed_origins() {
        let req = UpdateSiteSettingsRequest {
            max_document_file_size: None,
            max_media_file_size: None,
            analytics_enabled: None,
            maintenance_mode: None,
            contact_email: None,
            editorial_workflow_enabled: None,
            preview_templates: None,
            team_features_prompt_dismissed: None,
            module_blog_enabled: None,
            module_pages_enabled: None,
            module_portfolio_enabled: None,
            module_legal_enabled: None,
            module_documents_enabled: None,
            module_ai_enabled: None,
            module_forms_enabled: None,
            module_collections_enabled: None,

            document_password_min_length: None,
            document_password_regex: None,
            robots_txt_rules: None,
            seo_title_template: None,
            seo_default_description: None,
            seo_default_og_image_id: None,
            theme_color: None,
            background_color: None,
            code_injection_head: None,
            code_injection_footer: None,
            storage_quota_bytes: None,
            allowed_origins: Some(vec![
                "https://example.com".to_string(),
                "http://localhost:3000".to_string(),
            ]),
            data_retention_days: None,
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_update_request_invalid_allowed_origins() {
        let req = UpdateSiteSettingsRequest {
            max_document_file_size: None,
            max_media_file_size: None,
            analytics_enabled: None,
            maintenance_mode: None,
            contact_email: None,
            editorial_workflow_enabled: None,
            preview_templates: None,
            team_features_prompt_dismissed: None,
            module_blog_enabled: None,
            module_pages_enabled: None,
            module_portfolio_enabled: None,
            module_legal_enabled: None,
            module_documents_enabled: None,
            module_ai_enabled: None,
            module_forms_enabled: None,
            module_collections_enabled: None,

            document_password_min_length: None,
            document_password_regex: None,
            robots_txt_rules: None,
            seo_title_template: None,
            seo_default_description: None,
            seo_default_og_image_id: None,
            theme_color: None,
            background_color: None,
            code_injection_head: None,
            code_injection_footer: None,
            storage_quota_bytes: None,
            allowed_origins: Some(vec![
                "https://example.com".to_string(),
                "https://example.com/path".to_string(), // invalid: has path
            ]),
            data_retention_days: None,
        };
        assert!(req.validate().is_err());
    }

    /// All-`None` request for tests that exercise a single field.
    fn empty_update_request() -> UpdateSiteSettingsRequest {
        serde_json::from_str("{}").expect("all fields are optional")
    }

    #[test]
    fn test_update_request_data_retention_days_accepts_bounds_and_null() {
        for value in [
            serde_json::Value::Null,
            serde_json::json!(30),
            serde_json::json!(365),
            serde_json::json!(3650),
        ] {
            let req = UpdateSiteSettingsRequest {
                data_retention_days: Some(value.clone()),
                ..empty_update_request()
            };
            assert!(req.validate().is_ok(), "{value} must be accepted");
        }
    }

    #[test]
    fn test_update_request_data_retention_days_rejects_out_of_range() {
        for value in [
            serde_json::json!(29),
            serde_json::json!(3651),
            serde_json::json!(0),
            serde_json::json!(-1),
            serde_json::json!("90"),
        ] {
            let req = UpdateSiteSettingsRequest {
                data_retention_days: Some(value.clone()),
                ..empty_update_request()
            };
            assert!(req.validate().is_err(), "{value} must be rejected");
        }
    }

    #[test]
    fn test_update_request_data_retention_days_round_trips_to_settings_vec() {
        let req = UpdateSiteSettingsRequest {
            data_retention_days: Some(serde_json::json!(90)),
            ..empty_update_request()
        };
        let vec = req.to_settings_vec();
        assert_eq!(vec.len(), 1);
        assert_eq!(vec[0].0, "data_retention_days");
        assert_eq!(vec[0].1, serde_json::json!(90));

        // Explicit null is forwarded (disables retention), absent is omitted.
        let req = UpdateSiteSettingsRequest {
            data_retention_days: Some(serde_json::Value::Null),
            ..empty_update_request()
        };
        assert_eq!(req.to_settings_vec().len(), 1);
        assert!(empty_update_request().to_settings_vec().is_empty());
    }

    #[test]
    fn test_from_map_data_retention_days() {
        let mut map = crate::models::site_settings::defaults();
        assert_eq!(
            SiteSettingsResponse::from_map(&map).data_retention_days,
            None
        );
        map.insert("data_retention_days".into(), serde_json::json!(180));
        assert_eq!(
            SiteSettingsResponse::from_map(&map).data_retention_days,
            Some(180)
        );
    }

    #[test]
    fn test_public_settings_from_map_defaults() {
        let resp = PublicSiteSettingsResponse::from_map(&crate::models::site_settings::defaults());
        assert_eq!(resp.contact_email, "");
        assert_eq!(resp.theme_color, "#ffffff");
        assert_eq!(resp.background_color, "#ffffff");
        assert_eq!(resp.seo_title_template, "{{title}} | {{site_name}}");
        assert_eq!(resp.seo_default_description, "");
    }

    #[test]
    fn test_public_settings_from_map_overrides() {
        let mut map = crate::models::site_settings::defaults();
        map.insert("contact_email".into(), serde_json::json!("hi@example.com"));
        map.insert("theme_color".into(), serde_json::json!("#123456"));
        let resp = PublicSiteSettingsResponse::from_map(&map);
        assert_eq!(resp.contact_email, "hi@example.com");
        assert_eq!(resp.theme_color, "#123456");
    }

    #[test]
    fn test_public_settings_serializes_exactly_the_allowlist() {
        let resp = PublicSiteSettingsResponse::from_map(&crate::models::site_settings::defaults());
        let json = serde_json::to_value(&resp).unwrap();
        let mut keys: Vec<&str> = json
            .as_object()
            .unwrap()
            .keys()
            .map(|k| k.as_str())
            .collect();
        keys.sort_unstable();
        assert_eq!(
            keys,
            vec![
                "background_color",
                "contact_email",
                "seo_default_description",
                "seo_title_template",
                "theme_color",
            ]
        );
    }

    #[test]
    fn test_preview_template_is_builtin_defaults_to_false() {
        let json = r#"{"name":"Blog","url":"http://localhost:4321"}"#;
        let pt: PreviewTemplate = serde_json::from_str(json).unwrap();
        assert!(!pt.is_builtin);
    }

    #[test]
    fn test_preview_template_is_builtin_roundtrip() {
        let pt = PreviewTemplate {
            name: "Blog".to_string(),
            url: "http://preview:4321".to_string(),
            is_builtin: true,
        };
        let json = serde_json::to_string(&pt).unwrap();
        assert!(json.contains("\"is_builtin\":true"));

        let deserialized: PreviewTemplate = serde_json::from_str(&json).unwrap();
        assert!(deserialized.is_builtin);
    }

    #[test]
    fn test_preview_templates_stored_without_builtin_flag() {
        let templates = [
            PreviewTemplate {
                name: "Blog".to_string(),
                url: "http://preview:4321".to_string(),
                is_builtin: true,
            },
            PreviewTemplate {
                name: "Custom".to_string(),
                url: "http://localhost:3000".to_string(),
                is_builtin: false,
            },
        ];
        // Only user templates (non-builtin) should be saved
        let user_templates: Vec<&PreviewTemplate> =
            templates.iter().filter(|t| !t.is_builtin).collect();
        assert_eq!(user_templates.len(), 1);
        assert_eq!(user_templates[0].name, "Custom");
    }
}
