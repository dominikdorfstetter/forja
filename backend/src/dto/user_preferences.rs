//! User preferences DTOs

use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::dto::validated::ValidatedDto;

use crate::models::user_preferences::{KEY_LANGUAGE, KEY_PAGE_SIZE, KEY_THEME_ID};

/// Response with effective user preferences (defaults merged with stored values)
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "User preferences (defaults merged with stored values)")]
pub struct UserPreferencesResponse {
    #[schema(example = "en")]
    pub language: String,
    #[schema(example = "system")]
    pub theme_id: String,
    #[schema(example = 25)]
    pub page_size: i64,
}

impl UserPreferencesResponse {
    /// Build from effective preferences JSON.
    pub fn from_json(json: &serde_json::Value) -> Self {
        Self {
            language: json
                .get(KEY_LANGUAGE)
                .and_then(|v| v.as_str())
                .unwrap_or("en")
                .to_string(),
            theme_id: json
                .get(KEY_THEME_ID)
                .and_then(|v| v.as_str())
                .unwrap_or("system")
                .to_string(),
            page_size: json
                .get(KEY_PAGE_SIZE)
                .and_then(|v| v.as_i64())
                .unwrap_or(25),
        }
    }
}

/// Request to update user preferences (all fields optional for partial updates)
#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, utoipa::ToSchema)]
#[schema(description = "Update user preferences (all fields optional)")]
pub struct UpdateUserPreferencesRequest {
    /// Admin UI language code (e.g. "en", "de")
    #[validate(length(min = 2, max = 5))]
    #[schema(example = "en")]
    pub language: Option<String>,

    /// Theme identifier (e.g. "system", "latte", "mocha")
    #[validate(length(min = 2, max = 20))]
    #[schema(example = "system")]
    pub theme_id: Option<String>,

    /// Table page size for admin UI (10–100)
    #[validate(range(min = 10, max = 100))]
    #[schema(example = 25)]
    pub page_size: Option<i64>,
}

impl UpdateUserPreferencesRequest {
    /// Convert non-None fields to a JSON object for partial merge.
    pub fn to_json(&self) -> serde_json::Value {
        let mut map = serde_json::Map::new();

        if let Some(ref v) = self.language {
            map.insert(KEY_LANGUAGE.to_string(), serde_json::json!(v));
        }
        if let Some(ref v) = self.theme_id {
            map.insert(KEY_THEME_ID.to_string(), serde_json::json!(v));
        }
        if let Some(v) = self.page_size {
            map.insert(KEY_PAGE_SIZE.to_string(), serde_json::json!(v));
        }

        serde_json::Value::Object(map)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_from_json_defaults() {
        let json = crate::models::user_preferences::default_preferences();
        let resp = UserPreferencesResponse::from_json(&json);
        assert_eq!(resp.language, "en");
        assert_eq!(resp.theme_id, "system");
        assert_eq!(resp.page_size, 25);
    }

    #[test]
    fn test_from_json_overrides() {
        let json = serde_json::json!({
            "language": "de",
            "theme_id": "mocha",
            "page_size": 50
        });
        let resp = UserPreferencesResponse::from_json(&json);
        assert_eq!(resp.language, "de");
        assert_eq!(resp.theme_id, "mocha");
        assert_eq!(resp.page_size, 50);
    }

    #[test]
    fn test_from_json_empty_uses_defaults() {
        let json = serde_json::json!({});
        let resp = UserPreferencesResponse::from_json(&json);
        assert_eq!(resp.language, "en");
        assert_eq!(resp.theme_id, "system");
        assert_eq!(resp.page_size, 25);
    }

    #[test]
    fn test_update_request_valid() {
        let req = UpdateUserPreferencesRequest {
            language: Some("de".to_string()),
            theme_id: Some("mocha".to_string()),
            page_size: Some(50),
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_update_request_empty_valid() {
        let req = UpdateUserPreferencesRequest {
            language: None,
            theme_id: None,
            page_size: None,
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_update_request_language_too_short() {
        let req = UpdateUserPreferencesRequest {
            language: Some("x".to_string()),
            theme_id: None,
            page_size: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_update_request_theme_id_too_long() {
        let req = UpdateUserPreferencesRequest {
            language: None,
            theme_id: Some("a".repeat(21)),
            page_size: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_to_json_partial() {
        let req = UpdateUserPreferencesRequest {
            language: Some("de".to_string()),
            theme_id: None,
            page_size: None,
        };
        let json = req.to_json();
        assert_eq!(json["language"], serde_json::json!("de"));
        assert!(json.get("theme_id").is_none());
        assert!(json.get("page_size").is_none());
    }

    #[test]
    fn test_to_json_full() {
        let req = UpdateUserPreferencesRequest {
            language: Some("fr".to_string()),
            theme_id: Some("latte".to_string()),
            page_size: Some(50),
        };
        let json = req.to_json();
        assert_eq!(json["language"], serde_json::json!("fr"));
        assert_eq!(json["theme_id"], serde_json::json!("latte"));
        assert_eq!(json["page_size"], serde_json::json!(50));
    }

    #[test]
    fn test_to_json_empty() {
        let req = UpdateUserPreferencesRequest {
            language: None,
            theme_id: None,
            page_size: None,
        };
        let json = req.to_json();
        assert!(json.as_object().unwrap().is_empty());
    }

    #[test]
    fn test_response_serialization() {
        let resp = UserPreferencesResponse {
            language: "en".to_string(),
            theme_id: "system".to_string(),
            page_size: 25,
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"language\":\"en\""));
        assert!(json.contains("\"theme_id\":\"system\""));
        assert!(json.contains("\"page_size\":25"));
    }
}
