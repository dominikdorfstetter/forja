//! Onboarding DTOs
//!
//! Request/response types for the onboarding survey endpoints.
//! Data is stored in the user_preferences JSON blob but exposed
//! through dedicated DTOs for clean API separation.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::models::user_preferences::{
    KEY_ONBOARDING_COMPLETED, KEY_ONBOARDING_COMPLETED_AT, KEY_ONBOARDING_INTENTS,
    KEY_ONBOARDING_USER_TYPE,
};

/// Valid user types from the onboarding survey
const VALID_USER_TYPES: &[&str] = &["solo", "team", "agency"];

/// Valid content intents from the onboarding survey
const VALID_INTENTS: &[&str] = &["blog", "portfolio", "marketing", "docs", "company"];

/// Response with the user's onboarding state
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Onboarding survey state for the authenticated user")]
pub struct OnboardingResponse {
    /// Whether the onboarding survey has been completed
    #[schema(example = true)]
    pub completed: bool,

    /// User type selected during onboarding (solo, team, agency)
    #[schema(example = "solo")]
    pub user_type: Option<String>,

    /// Content intents selected during onboarding
    #[schema(example = json!(["blog", "portfolio"]))]
    pub intents: Vec<String>,

    /// When the onboarding was completed
    pub completed_at: Option<DateTime<Utc>>,
}

impl OnboardingResponse {
    /// Build from the effective preferences JSON blob.
    pub fn from_json(json: &serde_json::Value) -> Self {
        Self {
            completed: json
                .get(KEY_ONBOARDING_COMPLETED)
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            user_type: json
                .get(KEY_ONBOARDING_USER_TYPE)
                .and_then(|v| v.as_str())
                .map(String::from),
            intents: json
                .get(KEY_ONBOARDING_INTENTS)
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default(),
            completed_at: json
                .get(KEY_ONBOARDING_COMPLETED_AT)
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse::<DateTime<Utc>>().ok()),
        }
    }
}

/// Request to complete the onboarding survey
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Complete the onboarding survey with user type and content intents")]
pub struct CompleteOnboardingRequest {
    /// User type: "solo", "team", or "agency"
    #[validate(length(min = 1, max = 20))]
    #[schema(example = "solo")]
    pub user_type: String,

    /// Content intents (e.g. ["blog", "portfolio"])
    #[schema(example = json!(["blog", "portfolio"]))]
    pub intents: Vec<String>,
}

impl CompleteOnboardingRequest {
    /// Validate that user_type and intents contain known values.
    pub fn validate_values(&self) -> Result<(), String> {
        if !VALID_USER_TYPES.contains(&self.user_type.as_str()) {
            return Err(format!(
                "Invalid user_type '{}'. Must be one of: {}",
                self.user_type,
                VALID_USER_TYPES.join(", ")
            ));
        }
        for intent in &self.intents {
            if !VALID_INTENTS.contains(&intent.as_str()) {
                return Err(format!(
                    "Invalid intent '{}'. Must be one of: {}",
                    intent,
                    VALID_INTENTS.join(", ")
                ));
            }
        }
        Ok(())
    }

    /// Convert to a JSON object for storage in user_preferences.
    pub fn to_json(&self) -> serde_json::Value {
        serde_json::json!({
            KEY_ONBOARDING_COMPLETED: true,
            KEY_ONBOARDING_USER_TYPE: self.user_type,
            KEY_ONBOARDING_INTENTS: self.intents,
            KEY_ONBOARDING_COMPLETED_AT: Utc::now().to_rfc3339(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_from_json_not_completed() {
        let json = serde_json::json!({});
        let resp = OnboardingResponse::from_json(&json);
        assert!(!resp.completed);
        assert!(resp.user_type.is_none());
        assert!(resp.intents.is_empty());
        assert!(resp.completed_at.is_none());
    }

    #[test]
    fn test_from_json_completed() {
        let json = serde_json::json!({
            "onboarding_completed": true,
            "onboarding_user_type": "solo",
            "onboarding_intents": ["blog", "portfolio"],
            "onboarding_completed_at": "2026-03-03T12:00:00Z"
        });
        let resp = OnboardingResponse::from_json(&json);
        assert!(resp.completed);
        assert_eq!(resp.user_type.as_deref(), Some("solo"));
        assert_eq!(resp.intents, vec!["blog", "portfolio"]);
        assert!(resp.completed_at.is_some());
    }

    #[test]
    fn test_from_json_partial() {
        let json = serde_json::json!({
            "onboarding_completed": true,
            "onboarding_user_type": "team"
        });
        let resp = OnboardingResponse::from_json(&json);
        assert!(resp.completed);
        assert_eq!(resp.user_type.as_deref(), Some("team"));
        assert!(resp.intents.is_empty());
    }

    #[test]
    fn test_valid_request() {
        let req = CompleteOnboardingRequest {
            user_type: "solo".to_string(),
            intents: vec!["blog".to_string()],
        };
        assert!(req.validate().is_ok());
        assert!(req.validate_values().is_ok());
    }

    #[test]
    fn test_invalid_user_type() {
        let req = CompleteOnboardingRequest {
            user_type: "unknown".to_string(),
            intents: vec!["blog".to_string()],
        };
        assert!(req.validate_values().is_err());
    }

    #[test]
    fn test_invalid_intent() {
        let req = CompleteOnboardingRequest {
            user_type: "solo".to_string(),
            intents: vec!["invalid".to_string()],
        };
        assert!(req.validate_values().is_err());
    }

    #[test]
    fn test_empty_intents_valid() {
        let req = CompleteOnboardingRequest {
            user_type: "solo".to_string(),
            intents: vec![],
        };
        assert!(req.validate().is_ok());
        assert!(req.validate_values().is_ok());
    }

    #[test]
    fn test_all_valid_user_types() {
        for user_type in &["solo", "team", "agency"] {
            let req = CompleteOnboardingRequest {
                user_type: user_type.to_string(),
                intents: vec![],
            };
            assert!(req.validate_values().is_ok());
        }
    }

    #[test]
    fn test_all_valid_intents() {
        let req = CompleteOnboardingRequest {
            user_type: "solo".to_string(),
            intents: vec![
                "blog".to_string(),
                "portfolio".to_string(),
                "marketing".to_string(),
                "docs".to_string(),
                "company".to_string(),
            ],
        };
        assert!(req.validate_values().is_ok());
    }

    #[test]
    fn test_to_json_structure() {
        let req = CompleteOnboardingRequest {
            user_type: "team".to_string(),
            intents: vec!["blog".to_string(), "company".to_string()],
        };
        let json = req.to_json();
        assert_eq!(json["onboarding_completed"], true);
        assert_eq!(json["onboarding_user_type"], "team");
        assert_eq!(
            json["onboarding_intents"],
            serde_json::json!(["blog", "company"])
        );
        assert!(json["onboarding_completed_at"].as_str().is_some());
    }

    #[test]
    fn test_user_type_too_long() {
        let req = CompleteOnboardingRequest {
            user_type: "a".repeat(21),
            intents: vec![],
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_user_type_empty() {
        let req = CompleteOnboardingRequest {
            user_type: "".to_string(),
            intents: vec![],
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_response_serialization() {
        let resp = OnboardingResponse {
            completed: true,
            user_type: Some("solo".to_string()),
            intents: vec!["blog".to_string()],
            completed_at: Some(Utc::now()),
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"completed\":true"));
        assert!(json.contains("\"user_type\":\"solo\""));
        assert!(json.contains("\"intents\":[\"blog\"]"));
    }
}
