//! Help state DTOs
//!
//! Request/response types for the contextual help system.
//! Data is stored in the user_preferences JSON blob but exposed
//! through dedicated DTOs for clean API separation.

use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::models::user_preferences::{
    KEY_HELP_FIELD_HELP_SEEN, KEY_HELP_HOTSPOTS_SEEN, KEY_HELP_TOUR_COMPLETED,
};

/// Response with the user's help system state
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Help system state for the authenticated user")]
pub struct HelpStateResponse {
    /// Whether the quick tour has been completed
    #[schema(example = false)]
    pub tour_completed: bool,

    /// IDs of hotspots the user has dismissed
    #[schema(example = json!(["dashboard_site_selector", "editor_slash_commands"]))]
    pub hotspots_seen: Vec<String>,

    /// IDs of field help tooltips the user has dismissed
    #[schema(example = json!(["editor_slug_field"]))]
    pub field_help_seen: Vec<String>,
}

impl HelpStateResponse {
    /// Build from the effective preferences JSON blob.
    pub fn from_json(json: &serde_json::Value) -> Self {
        Self {
            tour_completed: json
                .get(KEY_HELP_TOUR_COMPLETED)
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            hotspots_seen: json
                .get(KEY_HELP_HOTSPOTS_SEEN)
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default(),
            field_help_seen: json
                .get(KEY_HELP_FIELD_HELP_SEEN)
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default(),
        }
    }
}

/// Request to update help system state (all fields optional)
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update help system state")]
pub struct UpdateHelpStateRequest {
    /// Mark the tour as completed
    #[schema(example = true)]
    pub tour_completed: Option<bool>,

    /// Dismiss a single hotspot by ID (appended to hotspots_seen)
    #[validate(length(max = 100))]
    #[schema(example = "dashboard_site_selector")]
    pub dismiss_hotspot: Option<String>,

    /// Dismiss a single field help tooltip by ID (appended to field_help_seen)
    #[validate(length(max = 100))]
    #[schema(example = "editor_slug_field")]
    pub dismiss_field_help: Option<String>,
}

impl UpdateHelpStateRequest {
    /// Convert to a JSON object for merging into user_preferences.
    ///
    /// For array fields (hotspots_seen, field_help_seen), the caller must
    /// pass the current arrays so that the new item can be appended.
    pub fn to_json(
        &self,
        current_hotspots: &[String],
        current_field_help: &[String],
    ) -> serde_json::Value {
        let mut map = serde_json::Map::new();

        if let Some(v) = self.tour_completed {
            map.insert(KEY_HELP_TOUR_COMPLETED.to_string(), serde_json::json!(v));
        }

        if let Some(ref id) = self.dismiss_hotspot {
            let mut hotspots: Vec<String> = current_hotspots.to_vec();
            if !hotspots.contains(id) {
                hotspots.push(id.clone());
            }
            map.insert(
                KEY_HELP_HOTSPOTS_SEEN.to_string(),
                serde_json::json!(hotspots),
            );
        }

        if let Some(ref id) = self.dismiss_field_help {
            let mut field_help: Vec<String> = current_field_help.to_vec();
            if !field_help.contains(id) {
                field_help.push(id.clone());
            }
            map.insert(
                KEY_HELP_FIELD_HELP_SEEN.to_string(),
                serde_json::json!(field_help),
            );
        }

        serde_json::Value::Object(map)
    }

    /// Build a JSON object that resets all help state to defaults.
    pub fn reset_json() -> serde_json::Value {
        serde_json::json!({
            KEY_HELP_TOUR_COMPLETED: false,
            KEY_HELP_HOTSPOTS_SEEN: [],
            KEY_HELP_FIELD_HELP_SEEN: [],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_from_json_defaults() {
        let json = serde_json::json!({});
        let resp = HelpStateResponse::from_json(&json);
        assert!(!resp.tour_completed);
        assert!(resp.hotspots_seen.is_empty());
        assert!(resp.field_help_seen.is_empty());
    }

    #[test]
    fn test_from_json_populated() {
        let json = serde_json::json!({
            "help_tour_completed": true,
            "help_hotspots_seen": ["dashboard_site_selector", "editor_slash"],
            "help_field_help_seen": ["editor_slug_field"]
        });
        let resp = HelpStateResponse::from_json(&json);
        assert!(resp.tour_completed);
        assert_eq!(
            resp.hotspots_seen,
            vec!["dashboard_site_selector", "editor_slash"]
        );
        assert_eq!(resp.field_help_seen, vec!["editor_slug_field"]);
    }

    #[test]
    fn test_to_json_tour_completed() {
        let req = UpdateHelpStateRequest {
            tour_completed: Some(true),
            dismiss_hotspot: None,
            dismiss_field_help: None,
        };
        let json = req.to_json(&[], &[]);
        assert_eq!(json["help_tour_completed"], true);
    }

    #[test]
    fn test_to_json_dismiss_hotspot_appends() {
        let req = UpdateHelpStateRequest {
            tour_completed: None,
            dismiss_hotspot: Some("new_hotspot".to_string()),
            dismiss_field_help: None,
        };
        let current = vec!["existing".to_string()];
        let json = req.to_json(&current, &[]);
        let arr = json["help_hotspots_seen"].as_array().unwrap();
        assert_eq!(arr.len(), 2);
        assert_eq!(arr[0], "existing");
        assert_eq!(arr[1], "new_hotspot");
    }

    #[test]
    fn test_to_json_dismiss_hotspot_idempotent() {
        let req = UpdateHelpStateRequest {
            tour_completed: None,
            dismiss_hotspot: Some("existing".to_string()),
            dismiss_field_help: None,
        };
        let current = vec!["existing".to_string()];
        let json = req.to_json(&current, &[]);
        let arr = json["help_hotspots_seen"].as_array().unwrap();
        assert_eq!(arr.len(), 1);
    }

    #[test]
    fn test_to_json_dismiss_field_help() {
        let req = UpdateHelpStateRequest {
            tour_completed: None,
            dismiss_hotspot: None,
            dismiss_field_help: Some("slug_field".to_string()),
        };
        let json = req.to_json(&[], &[]);
        let arr = json["help_field_help_seen"].as_array().unwrap();
        assert_eq!(arr.len(), 1);
        assert_eq!(arr[0], "slug_field");
    }

    #[test]
    fn test_reset_json() {
        let json = UpdateHelpStateRequest::reset_json();
        assert_eq!(json["help_tour_completed"], false);
        assert!(json["help_hotspots_seen"].as_array().unwrap().is_empty());
        assert!(json["help_field_help_seen"].as_array().unwrap().is_empty());
    }

    #[test]
    fn test_to_json_empty_request() {
        let req = UpdateHelpStateRequest {
            tour_completed: None,
            dismiss_hotspot: None,
            dismiss_field_help: None,
        };
        let json = req.to_json(&[], &[]);
        assert!(json.as_object().unwrap().is_empty());
    }

    #[test]
    fn test_response_serialization() {
        let resp = HelpStateResponse {
            tour_completed: true,
            hotspots_seen: vec!["a".to_string()],
            field_help_seen: vec![],
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"tour_completed\":true"));
        assert!(json.contains("\"hotspots_seen\":[\"a\"]"));
        assert!(json.contains("\"field_help_seen\":[]"));
    }
}
