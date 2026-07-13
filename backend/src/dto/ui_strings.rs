//! UI Strings DTOs — site-scoped localized key→string dictionary for
//! template chrome ("min read", footer headings, aria-labels).
//!
//! Keys are locale-invariant technical identifiers with a dot-namespaced
//! convention (`blog.min_read`, `nav.aria.toggle_dark`); values are the
//! per-locale display strings. Validation limits live here as the single
//! source of truth — handlers and the repo reference these constants.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::dto::validated::ValidatedDto;
use crate::models::content::TranslationStatus;

/// Maximum number of UI string keys per site (enforced in the create handler).
pub const UI_STRINGS_MAX_KEYS_PER_SITE: i64 = 500;
/// Maximum length of a UI string key.
pub const UI_STRING_KEY_MAX_LEN: u64 = 128;
/// Maximum length of a localized value.
pub const UI_STRING_VALUE_MAX_LEN: u64 = 1000;

lazy_static::lazy_static! {
    /// Lowercase alphanumeric segments joined by `.`, `_` or `-`
    /// (e.g. `blog.min_read`, `nav.aria.toggle_dark`).
    pub static ref UI_STRING_KEY_REGEX: regex::Regex =
        regex::Regex::new(r"^[a-z0-9]+(?:[._-][a-z0-9]+)*$")
            .expect("UI_STRING_KEY_REGEX is a valid regex literal");
}

/// One localized value to upsert for a UI string key.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, ToSchema)]
pub struct UiStringLocalizationInput {
    pub locale_id: Uuid,
    #[validate(length(
        min = 1,
        max = UI_STRING_VALUE_MAX_LEN,
        message = "Value must be between 1 and 1000 characters"
    ))]
    pub value: String,
}

/// Request to create a UI string key with its initial localizations.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, ValidatedDto, ToSchema)]
pub struct CreateUiStringRequest {
    #[schema(example = "blog.min_read")]
    #[validate(length(
        min = 1,
        max = UI_STRING_KEY_MAX_LEN,
        message = "Key must be between 1 and 128 characters"
    ))]
    #[validate(regex(
        path = *UI_STRING_KEY_REGEX,
        message = "Key must be lowercase alphanumeric segments joined by '.', '_' or '-'"
    ))]
    pub key: String,
    #[serde(default)]
    #[validate(nested)]
    pub localizations: Vec<UiStringLocalizationInput>,
}

/// Request to update a UI string — rename the key and/or upsert localizations.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, ValidatedDto, ToSchema)]
pub struct UpdateUiStringRequest {
    /// New key; omit to keep the current key.
    #[validate(length(
        min = 1,
        max = UI_STRING_KEY_MAX_LEN,
        message = "Key must be between 1 and 128 characters"
    ))]
    #[validate(regex(
        path = *UI_STRING_KEY_REGEX,
        message = "Key must be lowercase alphanumeric segments joined by '.', '_' or '-'"
    ))]
    pub key: Option<String>,
    #[serde(default)]
    #[validate(nested)]
    pub localizations: Vec<UiStringLocalizationInput>,
}

/// One localized value of a UI string key (admin read shape).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UiStringLocalizationResponse {
    pub id: Uuid,
    pub locale_id: Uuid,
    pub value: String,
    pub translation_status: TranslationStatus,
}

/// A UI string key with every localization (admin read shape).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UiStringResponse {
    pub id: Uuid,
    pub key: String,
    pub localizations: Vec<UiStringLocalizationResponse>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_request(key: &str, value: &str) -> CreateUiStringRequest {
        CreateUiStringRequest {
            key: key.to_string(),
            localizations: vec![UiStringLocalizationInput {
                locale_id: Uuid::new_v4(),
                value: value.to_string(),
            }],
        }
    }

    #[test]
    fn accepts_namespaced_keys() {
        for key in [
            "blog.min_read",
            "nav.aria.toggle_dark",
            "footer-links",
            "a1",
        ] {
            assert!(create_request(key, "value").validate().is_ok(), "{key}");
        }
    }

    #[test]
    fn rejects_malformed_keys() {
        for key in [
            "Blog.MinRead",
            "double..dot",
            ".leading",
            "trailing.",
            "spa ce",
            "",
        ] {
            assert!(create_request(key, "value").validate().is_err(), "{key}");
        }
    }

    #[test]
    fn rejects_over_length_key_and_value() {
        assert!(
            create_request(&"a".repeat(129), "value")
                .validate()
                .is_err()
        );
        assert!(
            create_request("ok.key", &"v".repeat(1001))
                .validate()
                .is_err()
        );
        assert!(
            create_request(&"a".repeat(128), &"v".repeat(1000))
                .validate()
                .is_ok()
        );
    }

    #[test]
    fn update_key_is_optional() {
        let req = UpdateUiStringRequest {
            key: None,
            localizations: vec![],
        };
        assert!(req.validate().is_ok());

        let renamed = UpdateUiStringRequest {
            key: Some("UPPER".to_string()),
            localizations: vec![],
        };
        assert!(renamed.validate().is_err());
    }
}
