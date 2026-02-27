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
pub const KEY_MAINTENANCE_MODE: &str = "maintenance_mode";
pub const KEY_CONTACT_EMAIL: &str = "contact_email";
pub const KEY_POSTS_PER_PAGE: &str = "posts_per_page";
pub const KEY_EDITORIAL_WORKFLOW_ENABLED: &str = "editorial_workflow_enabled";
pub const KEY_PREVIEW_TEMPLATES: &str = "preview_templates";

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
    m.insert(KEY_MAINTENANCE_MODE.into(), serde_json::json!(false));
    m.insert(KEY_CONTACT_EMAIL.into(), serde_json::json!(""));
    m.insert(KEY_POSTS_PER_PAGE.into(), serde_json::json!(10));
    m.insert(
        KEY_EDITORIAL_WORKFLOW_ENABLED.into(),
        serde_json::json!(false),
    );
    m.insert(KEY_PREVIEW_TEMPLATES.into(), serde_json::json!([]));
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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_defaults_contains_all_keys() {
        let d = defaults();
        assert_eq!(d.len(), 8);
        assert!(d.contains_key(KEY_MAX_DOCUMENT_FILE_SIZE));
        assert!(d.contains_key(KEY_MAX_MEDIA_FILE_SIZE));
        assert!(d.contains_key(KEY_ANALYTICS_ENABLED));
        assert!(d.contains_key(KEY_MAINTENANCE_MODE));
        assert!(d.contains_key(KEY_CONTACT_EMAIL));
        assert!(d.contains_key(KEY_POSTS_PER_PAGE));
        assert!(d.contains_key(KEY_EDITORIAL_WORKFLOW_ENABLED));
        assert!(d.contains_key(KEY_PREVIEW_TEMPLATES));
    }

    #[test]
    fn test_default_values() {
        let d = defaults();
        assert_eq!(d[KEY_MAX_DOCUMENT_FILE_SIZE], serde_json::json!(10_485_760));
        assert_eq!(d[KEY_MAX_MEDIA_FILE_SIZE], serde_json::json!(52_428_800));
        assert_eq!(d[KEY_ANALYTICS_ENABLED], serde_json::json!(false));
        assert_eq!(d[KEY_MAINTENANCE_MODE], serde_json::json!(false));
        assert_eq!(d[KEY_CONTACT_EMAIL], serde_json::json!(""));
        assert_eq!(d[KEY_POSTS_PER_PAGE], serde_json::json!(10));
        assert_eq!(d[KEY_EDITORIAL_WORKFLOW_ENABLED], serde_json::json!(false));
        assert_eq!(d[KEY_PREVIEW_TEMPLATES], serde_json::json!([]));
    }

    #[test]
    fn test_site_setting_serialization() {
        let setting = SiteSetting {
            id: Uuid::new_v4(),
            site_id: Uuid::new_v4(),
            setting_key: "posts_per_page".to_string(),
            setting_value: serde_json::json!(20),
            is_sensitive: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&setting).unwrap();
        assert!(json.contains("\"setting_key\":\"posts_per_page\""));
        assert!(json.contains("\"setting_value\":20"));
    }
}
