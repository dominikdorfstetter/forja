//! Site settings model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

use crate::errors::ApiError;

// Known setting keys
pub const KEY_MAX_DOCUMENT_FILE_SIZE: &str = "max_document_file_size";
pub const KEY_MAX_MEDIA_FILE_SIZE: &str = "max_media_file_size";
pub const KEY_ANALYTICS_ENABLED: &str = "analytics_enabled";
pub const KEY_ANALYTICS_RETENTION_DAYS: &str = "analytics_retention_days";
pub const KEY_AUDIT_LOG_RETENTION_DAYS: &str = "audit_log_retention_days";
pub const KEY_MAINTENANCE_MODE: &str = "maintenance_mode";
pub const KEY_CONTACT_EMAIL: &str = "contact_email";
pub const KEY_EDITORIAL_WORKFLOW_ENABLED: &str = "editorial_workflow_enabled";
pub const KEY_PREVIEW_TEMPLATES: &str = "preview_templates";
pub const KEY_SCHEDULING_ENABLED: &str = "scheduling_enabled";
pub const KEY_VERSIONING_ENABLED: &str = "versioning_enabled";
pub const KEY_TEAM_FEATURES_PROMPT_DISMISSED: &str = "team_features_prompt_dismissed";

// Module enable/disable keys
pub const KEY_MODULE_BLOG_ENABLED: &str = "module_blog_enabled";
pub const KEY_MODULE_PAGES_ENABLED: &str = "module_pages_enabled";
pub const KEY_MODULE_PORTFOLIO_ENABLED: &str = "module_portfolio_enabled";
pub const KEY_MODULE_LEGAL_ENABLED: &str = "module_legal_enabled";
pub const KEY_MODULE_DOCUMENTS_ENABLED: &str = "module_documents_enabled";
pub const KEY_MODULE_AI_ENABLED: &str = "module_ai_enabled";
pub const KEY_MODULE_FORMS_ENABLED: &str = "module_forms_enabled";
pub const KEY_MODULE_COLLECTIONS_ENABLED: &str = "module_collections_enabled";
// Document password policy
pub const KEY_DOCUMENT_PASSWORD_MIN_LENGTH: &str = "document_password_min_length";
pub const KEY_DOCUMENT_PASSWORD_REGEX: &str = "document_password_regex";

// SEO
pub const KEY_ROBOTS_TXT_RULES: &str = "robots_txt_rules";
pub const KEY_SEO_TITLE_TEMPLATE: &str = "seo_title_template";
pub const KEY_SEO_DEFAULT_DESCRIPTION: &str = "seo_default_description";
pub const KEY_SEO_DEFAULT_OG_IMAGE_ID: &str = "seo_default_og_image_id";

// Favicon / manifest
pub const KEY_THEME_COLOR: &str = "theme_color";
pub const KEY_BACKGROUND_COLOR: &str = "background_color";

// Code injection
pub const KEY_CODE_INJECTION_HEAD: &str = "code_injection_head";
pub const KEY_CODE_INJECTION_FOOTER: &str = "code_injection_footer";

// Storage quota
pub const KEY_STORAGE_QUOTA_BYTES: &str = "storage_quota_bytes";

// CORS
pub const KEY_ALLOWED_ORIGINS: &str = "allowed_origins";

/// Returns the known defaults as a HashMap.
pub fn defaults() -> HashMap<String, serde_json::Value> {
    let mut m = HashMap::new();
    m.insert(
        KEY_MAX_DOCUMENT_FILE_SIZE.into(),
        serde_json::json!(10_485_760),
    ); // 10 MB
    m.insert(
        KEY_MAX_MEDIA_FILE_SIZE.into(),
        serde_json::json!(52_428_800),
    ); // 50 MB
    m.insert(KEY_ANALYTICS_ENABLED.into(), serde_json::json!(false));
    m.insert(KEY_ANALYTICS_RETENTION_DAYS.into(), serde_json::json!(90));
    m.insert(KEY_AUDIT_LOG_RETENTION_DAYS.into(), serde_json::json!(365));
    m.insert(KEY_MAINTENANCE_MODE.into(), serde_json::json!(false));
    m.insert(KEY_CONTACT_EMAIL.into(), serde_json::json!(""));
    m.insert(
        KEY_EDITORIAL_WORKFLOW_ENABLED.into(),
        serde_json::json!(false),
    );
    m.insert(KEY_PREVIEW_TEMPLATES.into(), serde_json::json!([]));
    m.insert(KEY_SCHEDULING_ENABLED.into(), serde_json::json!(true));
    m.insert(KEY_VERSIONING_ENABLED.into(), serde_json::json!(true));
    m.insert(
        KEY_TEAM_FEATURES_PROMPT_DISMISSED.into(),
        serde_json::json!(false),
    );
    m.insert(KEY_MODULE_BLOG_ENABLED.into(), serde_json::json!(true));
    m.insert(KEY_MODULE_PAGES_ENABLED.into(), serde_json::json!(true));
    m.insert(
        KEY_MODULE_PORTFOLIO_ENABLED.into(),
        serde_json::json!(false),
    );
    m.insert(KEY_MODULE_LEGAL_ENABLED.into(), serde_json::json!(false));
    m.insert(
        KEY_MODULE_DOCUMENTS_ENABLED.into(),
        serde_json::json!(false),
    );
    m.insert(KEY_MODULE_AI_ENABLED.into(), serde_json::json!(false));
    m.insert(
        KEY_DOCUMENT_PASSWORD_MIN_LENGTH.into(),
        serde_json::json!(8),
    );
    m.insert(KEY_DOCUMENT_PASSWORD_REGEX.into(), serde_json::json!("")); // empty = no regex enforcement

    // SEO
    m.insert(
        KEY_ROBOTS_TXT_RULES.into(),
        serde_json::json!([
            { "user_agent": "*", "rules": [{ "directive": "Allow", "path": "/" }] }
        ]),
    );
    m.insert(
        KEY_SEO_TITLE_TEMPLATE.into(),
        serde_json::json!("{{title}} | {{site_name}}"),
    );
    m.insert(KEY_SEO_DEFAULT_DESCRIPTION.into(), serde_json::json!(""));
    m.insert(KEY_SEO_DEFAULT_OG_IMAGE_ID.into(), serde_json::Value::Null);
    // Favicon / manifest
    m.insert(KEY_THEME_COLOR.into(), serde_json::json!("#ffffff"));
    m.insert(KEY_BACKGROUND_COLOR.into(), serde_json::json!("#ffffff"));
    // Code injection
    m.insert(KEY_CODE_INJECTION_HEAD.into(), serde_json::json!(""));
    m.insert(KEY_CODE_INJECTION_FOOTER.into(), serde_json::json!(""));
    // Storage quota (default: 1 GB)
    m.insert(
        KEY_STORAGE_QUOTA_BYTES.into(),
        serde_json::json!(1_073_741_824_i64),
    );
    // CORS allowed origins (default: empty = no cross-origin allowed)
    m.insert(KEY_ALLOWED_ORIGINS.into(), serde_json::json!([]));
    m
}

/// Site setting row
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SiteSetting {
    pub id: Uuid,
    pub site_id: Uuid,
    pub setting_key: String,
    pub setting_value: serde_json::Value,
    pub is_sensitive: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl SiteSetting {
    /// Fetch all settings rows for a site.
    pub async fn find_all_for_site(pool: &PgPool, site_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let rows = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, setting_key, setting_value, is_sensitive, created_at, updated_at
            FROM site_settings
            WHERE site_id = $1
            ORDER BY setting_key
            "#,
        )
        .bind(site_id)
        .fetch_all(pool)
        .await?;

        Ok(rows)
    }

    /// Upsert a single setting.
    pub async fn upsert(
        pool: &PgPool,
        site_id: Uuid,
        key: &str,
        value: serde_json::Value,
        is_sensitive: bool,
    ) -> Result<Self, ApiError> {
        let row = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO site_settings (site_id, setting_key, setting_value, is_sensitive)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (site_id, setting_key)
            DO UPDATE SET setting_value = EXCLUDED.setting_value,
                          is_sensitive  = EXCLUDED.is_sensitive,
                          updated_at    = NOW()
            RETURNING id, site_id, setting_key, setting_value, is_sensitive, created_at, updated_at
            "#,
        )
        .bind(site_id)
        .bind(key)
        .bind(&value)
        .bind(is_sensitive)
        .fetch_one(pool)
        .await?;

        Ok(row)
    }

    /// Build a HashMap of effective settings: defaults merged with DB values.
    pub async fn get_effective_settings(
        pool: &PgPool,
        site_id: Uuid,
    ) -> Result<HashMap<String, serde_json::Value>, ApiError> {
        let mut map = defaults();
        let rows = Self::find_all_for_site(pool, site_id).await?;
        for row in rows {
            map.insert(row.setting_key, row.setting_value);
        }
        Ok(map)
    }

    /// Single key lookup with default fallback.
    pub async fn get_value(
        pool: &PgPool,
        site_id: Uuid,
        key: &str,
    ) -> Result<serde_json::Value, ApiError> {
        let row: Option<(serde_json::Value,)> = sqlx::query_as(
            r#"
            SELECT setting_value
            FROM site_settings
            WHERE site_id = $1 AND setting_key = $2
            "#,
        )
        .bind(site_id)
        .bind(key)
        .fetch_optional(pool)
        .await?;

        if let Some((val,)) = row {
            return Ok(val);
        }

        // Fall back to default
        Ok(defaults().remove(key).unwrap_or(serde_json::Value::Null))
    }

    /// Multi-key lookup in a single round-trip. Returns every requested key,
    /// falling back to its known default (or `Null`) when the row is absent —
    /// same per-key semantics as [`get_value`](Self::get_value), but one query
    /// instead of N. Used by callers that need several settings at once (e.g.
    /// the SEO envelope's three keys).
    pub async fn get_many(
        pool: &PgPool,
        site_id: Uuid,
        keys: &[&str],
    ) -> Result<HashMap<String, serde_json::Value>, ApiError> {
        let key_strings: Vec<String> = keys.iter().map(|k| k.to_string()).collect();
        let rows: Vec<(String, serde_json::Value)> = sqlx::query_as(
            r#"
            SELECT setting_key, setting_value
            FROM site_settings
            WHERE site_id = $1 AND setting_key = ANY($2)
            "#,
        )
        .bind(site_id)
        .bind(&key_strings)
        .fetch_all(pool)
        .await?;

        let mut found: HashMap<String, serde_json::Value> = rows.into_iter().collect();
        let mut defaults_map = defaults();
        let mut out = HashMap::with_capacity(keys.len());
        for &key in keys {
            let value = found
                .remove(key)
                .or_else(|| defaults_map.remove(key))
                .unwrap_or(serde_json::Value::Null);
            out.insert(key.to_string(), value);
        }
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_defaults_contains_all_keys() {
        let d = defaults();
        assert_eq!(d.len(), 30);
        assert!(d.contains_key(KEY_MAX_DOCUMENT_FILE_SIZE));
        assert!(d.contains_key(KEY_MAX_MEDIA_FILE_SIZE));
        assert!(d.contains_key(KEY_ANALYTICS_ENABLED));
        assert!(d.contains_key(KEY_ANALYTICS_RETENTION_DAYS));
        assert!(d.contains_key(KEY_AUDIT_LOG_RETENTION_DAYS));
        assert!(d.contains_key(KEY_MAINTENANCE_MODE));
        assert!(d.contains_key(KEY_CONTACT_EMAIL));
        assert!(d.contains_key(KEY_EDITORIAL_WORKFLOW_ENABLED));
        assert!(d.contains_key(KEY_PREVIEW_TEMPLATES));
        assert!(d.contains_key(KEY_SCHEDULING_ENABLED));
        assert!(d.contains_key(KEY_VERSIONING_ENABLED));
        assert!(d.contains_key(KEY_TEAM_FEATURES_PROMPT_DISMISSED));
        assert!(d.contains_key(KEY_MODULE_BLOG_ENABLED));
        assert!(d.contains_key(KEY_MODULE_PAGES_ENABLED));
        assert!(d.contains_key(KEY_MODULE_PORTFOLIO_ENABLED));
        assert!(d.contains_key(KEY_MODULE_LEGAL_ENABLED));
        assert!(d.contains_key(KEY_MODULE_DOCUMENTS_ENABLED));
        assert!(d.contains_key(KEY_MODULE_AI_ENABLED));
        assert!(d.contains_key(KEY_DOCUMENT_PASSWORD_MIN_LENGTH));
        assert!(d.contains_key(KEY_DOCUMENT_PASSWORD_REGEX));
        assert!(d.contains_key(KEY_ROBOTS_TXT_RULES));
        assert!(d.contains_key(KEY_SEO_TITLE_TEMPLATE));
        assert!(d.contains_key(KEY_SEO_DEFAULT_DESCRIPTION));
        assert!(d.contains_key(KEY_SEO_DEFAULT_OG_IMAGE_ID));
        assert!(d.contains_key(KEY_THEME_COLOR));
        assert!(d.contains_key(KEY_BACKGROUND_COLOR));
        assert!(d.contains_key(KEY_CODE_INJECTION_HEAD));
        assert!(d.contains_key(KEY_CODE_INJECTION_FOOTER));
        assert!(d.contains_key(KEY_STORAGE_QUOTA_BYTES));
        assert!(d.contains_key(KEY_ALLOWED_ORIGINS));
    }

    #[test]
    fn test_default_values() {
        let d = defaults();
        assert_eq!(d[KEY_MAX_DOCUMENT_FILE_SIZE], serde_json::json!(10_485_760));
        assert_eq!(d[KEY_MAX_MEDIA_FILE_SIZE], serde_json::json!(52_428_800));
        assert_eq!(d[KEY_ANALYTICS_ENABLED], serde_json::json!(false));
        assert_eq!(d[KEY_ANALYTICS_RETENTION_DAYS], serde_json::json!(90));
        assert_eq!(d[KEY_AUDIT_LOG_RETENTION_DAYS], serde_json::json!(365));
        assert_eq!(d[KEY_MAINTENANCE_MODE], serde_json::json!(false));
        assert_eq!(d[KEY_CONTACT_EMAIL], serde_json::json!(""));
        assert_eq!(d[KEY_EDITORIAL_WORKFLOW_ENABLED], serde_json::json!(false));
        assert_eq!(d[KEY_PREVIEW_TEMPLATES], serde_json::json!([]));
        assert_eq!(d[KEY_SCHEDULING_ENABLED], serde_json::json!(true));
        assert_eq!(d[KEY_VERSIONING_ENABLED], serde_json::json!(true));
        assert_eq!(
            d[KEY_TEAM_FEATURES_PROMPT_DISMISSED],
            serde_json::json!(false)
        );
        assert_eq!(d[KEY_MODULE_BLOG_ENABLED], serde_json::json!(true));
        assert_eq!(d[KEY_MODULE_PAGES_ENABLED], serde_json::json!(true));
        assert_eq!(d[KEY_MODULE_PORTFOLIO_ENABLED], serde_json::json!(false));
        assert_eq!(d[KEY_MODULE_LEGAL_ENABLED], serde_json::json!(false));
        assert_eq!(d[KEY_MODULE_DOCUMENTS_ENABLED], serde_json::json!(false));
        assert_eq!(d[KEY_MODULE_AI_ENABLED], serde_json::json!(false));
        assert_eq!(d[KEY_DOCUMENT_PASSWORD_MIN_LENGTH], serde_json::json!(8));
        assert_eq!(d[KEY_DOCUMENT_PASSWORD_REGEX], serde_json::json!(""));
        assert_eq!(
            d[KEY_STORAGE_QUOTA_BYTES],
            serde_json::json!(1_073_741_824_i64)
        );
        assert_eq!(d[KEY_ALLOWED_ORIGINS], serde_json::json!([]));
    }

    #[test]
    fn test_site_setting_serialization() {
        let setting = SiteSetting {
            id: Uuid::new_v4(),
            site_id: Uuid::new_v4(),
            setting_key: "analytics_enabled".to_string(),
            setting_value: serde_json::json!(true),
            is_sensitive: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&setting).unwrap();
        assert!(json.contains("\"setting_key\":\"analytics_enabled\""));
        assert!(json.contains("\"setting_value\":true"));
    }
}
