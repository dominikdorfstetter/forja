//! User preferences model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

use crate::errors::ApiError;

// Known preference keys
pub const KEY_AUTOSAVE_ENABLED: &str = "autosave_enabled";
pub const KEY_AUTOSAVE_DEBOUNCE_SECONDS: &str = "autosave_debounce_seconds";
pub const KEY_LANGUAGE: &str = "language";
pub const KEY_THEME_ID: &str = "theme_id";

/// Returns the default preferences as a JSON object.
pub fn default_preferences() -> serde_json::Value {
    serde_json::json!({
        KEY_AUTOSAVE_ENABLED: true,
        KEY_AUTOSAVE_DEBOUNCE_SECONDS: 3,
        KEY_LANGUAGE: "en",
        KEY_THEME_ID: "system"
    })
}

/// User preferences row
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserPreferences {
    pub clerk_user_id: String,
    pub preferences: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl UserPreferences {
    /// Fetch effective preferences: defaults merged with stored values.
    pub async fn get_effective(
        pool: &PgPool,
        clerk_user_id: &str,
    ) -> Result<serde_json::Value, ApiError> {
        let row: Option<(serde_json::Value,)> = sqlx::query_as(
            r#"
            SELECT preferences
            FROM user_preferences
            WHERE clerk_user_id = $1
            "#,
        )
        .bind(clerk_user_id)
        .fetch_optional(pool)
        .await?;

        let mut defaults = default_preferences();
        if let Some((stored,)) = row {
            if let (Some(base), Some(overlay)) = (defaults.as_object_mut(), stored.as_object()) {
                for (k, v) in overlay {
                    base.insert(k.clone(), v.clone());
                }
            }
        }

        Ok(defaults)
    }

    /// Upsert preferences: merge the partial JSON into existing stored preferences.
    pub async fn upsert(
        pool: &PgPool,
        clerk_user_id: &str,
        partial: serde_json::Value,
    ) -> Result<serde_json::Value, ApiError> {
        sqlx::query(
            r#"
            INSERT INTO user_preferences (clerk_user_id, preferences)
            VALUES ($1, $2)
            ON CONFLICT (clerk_user_id)
            DO UPDATE SET preferences = user_preferences.preferences || $2
            "#,
        )
        .bind(clerk_user_id)
        .bind(&partial)
        .execute(pool)
        .await?;

        Self::get_effective(pool, clerk_user_id).await
    }

    /// Delete preferences for a user (account deletion cleanup).
    pub async fn delete(pool: &PgPool, clerk_user_id: &str) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM user_preferences WHERE clerk_user_id = $1")
            .bind(clerk_user_id)
            .execute(pool)
            .await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_preferences_keys() {
        let d = default_preferences();
        let obj = d.as_object().unwrap();
        assert_eq!(obj.len(), 4);
        assert!(obj.contains_key(KEY_AUTOSAVE_ENABLED));
        assert!(obj.contains_key(KEY_AUTOSAVE_DEBOUNCE_SECONDS));
        assert!(obj.contains_key(KEY_LANGUAGE));
        assert!(obj.contains_key(KEY_THEME_ID));
    }

    #[test]
    fn test_default_preference_values() {
        let d = default_preferences();
        assert_eq!(d[KEY_AUTOSAVE_ENABLED], serde_json::json!(true));
        assert_eq!(d[KEY_AUTOSAVE_DEBOUNCE_SECONDS], serde_json::json!(3));
        assert_eq!(d[KEY_LANGUAGE], serde_json::json!("en"));
        assert_eq!(d[KEY_THEME_ID], serde_json::json!("system"));
    }

    #[test]
    fn test_defaults_merge_with_overlay() {
        let mut defaults = default_preferences();
        let overlay = serde_json::json!({
            KEY_AUTOSAVE_ENABLED: false,
            KEY_AUTOSAVE_DEBOUNCE_SECONDS: 10
        });

        if let (Some(base), Some(over)) = (defaults.as_object_mut(), overlay.as_object()) {
            for (k, v) in over {
                base.insert(k.clone(), v.clone());
            }
        }

        assert_eq!(defaults[KEY_AUTOSAVE_ENABLED], serde_json::json!(false));
        assert_eq!(defaults[KEY_AUTOSAVE_DEBOUNCE_SECONDS], serde_json::json!(10));
    }

    #[test]
    fn test_partial_overlay_preserves_other_defaults() {
        let mut defaults = default_preferences();
        let overlay = serde_json::json!({
            KEY_AUTOSAVE_DEBOUNCE_SECONDS: 15
        });

        if let (Some(base), Some(over)) = (defaults.as_object_mut(), overlay.as_object()) {
            for (k, v) in over {
                base.insert(k.clone(), v.clone());
            }
        }

        // autosave_enabled should still be the default
        assert_eq!(defaults[KEY_AUTOSAVE_ENABLED], serde_json::json!(true));
        assert_eq!(defaults[KEY_AUTOSAVE_DEBOUNCE_SECONDS], serde_json::json!(15));
    }
}
