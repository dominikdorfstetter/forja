//! Site locale DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::dto::validated::ValidatedDto;
use crate::models::locale::TextDirection;
use crate::models::site_locale::SiteLocaleWithDetails;

/// Request to add a locale to a site
#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, ToSchema)]
#[schema(description = "Add a locale to a site")]
pub struct AddSiteLocaleRequest {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub locale_id: Uuid,

    #[schema(example = false)]
    pub is_default: bool,

    #[schema(example = "en")]
    #[validate(length(max = 10, message = "URL prefix cannot exceed 10 characters"))]
    pub url_prefix: Option<String>,
}

/// Request to update a site locale assignment
#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, ToSchema)]
#[schema(description = "Update a site locale assignment")]
pub struct UpdateSiteLocaleRequest {
    #[schema(example = true)]
    pub is_default: Option<bool>,

    #[schema(example = true)]
    pub is_active: Option<bool>,

    #[schema(example = "en")]
    #[validate(length(max = 10, message = "URL prefix cannot exceed 10 characters"))]
    pub url_prefix: Option<String>,
}

/// Locale input for bulk assignment during site creation
#[derive(Debug, Clone, Deserialize, Validate, ToSchema)]
#[schema(description = "Locale input for site creation")]
pub struct SiteLocaleInput {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub locale_id: Uuid,

    #[schema(example = true)]
    pub is_default: bool,

    #[schema(example = "en")]
    #[validate(length(max = 10, message = "URL prefix cannot exceed 10 characters"))]
    pub url_prefix: Option<String>,
}

/// Canonical site-locale contract — see issue #742.
///
/// A row from `site_locales` joined with its `locales` row, denormalised
/// for client convenience. This shape is what every `/sites/.../locales`
/// endpoint returns; consumers should mirror these field names exactly.
///
/// # Identity
///
/// The natural key is the composite `(site_id, locale_id)`. There is
/// **no** top-level `id` field — a given locale can be attached to many
/// sites, and a given site can carry many locales.
///
/// # Fields
///
/// - `site_id` — composite-key half #1; which site this assignment belongs to.
/// - `locale_id` — composite-key half #2; which locale is attached.
/// - `is_default` — exactly one row per site has this set to `true`. The
///   default locale's `url_prefix` is conventionally `null` (the site root
///   serves the default locale without a prefix).
/// - `is_active` — when `false`, the locale is configured but not
///   currently served. Consumers should usually filter to `is_active = true`.
/// - `url_prefix` — path segment that selects this locale (e.g. `"en"`,
///   `"de-at"`). `Option<String>` because the default locale typically
///   has no prefix; non-default rows should always carry one.
/// - `created_at` — when the assignment was created (UTC).
/// - `code` — BCP-47 locale code (e.g. `"en"`, `"de-AT"`), denormalised
///   from `locales.code`.
/// - `name` — English-language label (e.g. `"English"`, `"Austrian German"`),
///   denormalised from `locales.name`.
/// - `native_name` — locale's own name (e.g. `"Deutsch (Österreich)"`),
///   denormalised from `locales.native_name`. Nullable for locales
///   without a defined native form.
/// - `direction` — `ltr` or `rtl`, typed as the `TextDirection` enum.
///   **Note the field name is `direction`, not `text_direction`** — consumers
///   that invented `text_direction` are drifting from the canonical shape.
///
/// # Stability
///
/// Field names here are the canonical contract; renaming any of them is a
/// breaking change. Adding a field is non-breaking. Out of scope for #742:
/// introducing a top-level `id` or renaming `direction` — the composite
/// key and enum-typed direction are deliberate.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(description = "Site locale assignment with denormalised locale \
    details. Identity is the composite `(site_id, locale_id)` — no \
    top-level `id`. Direction is `direction` (an `ltr` / `rtl` enum), \
    NOT `text_direction`. `url_prefix` is nullable; the default locale \
    conventionally has none. `code`, `name`, `native_name`, and \
    `direction` are denormalised from the `locales` row for client \
    convenience. See issue #742 for the canonical contract.")]
pub struct SiteLocaleResponse {
    /// Composite-key half #1 — which site this assignment belongs to.
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub site_id: Uuid,

    /// Composite-key half #2 — which locale is attached.
    #[schema(example = "660e8400-e29b-41d4-a716-446655440000")]
    pub locale_id: Uuid,

    /// Exactly one row per site has this set to `true`.
    #[schema(example = true)]
    pub is_default: bool,

    /// Configured-but-not-served when `false`. Consumers usually filter to `true`.
    #[schema(example = true)]
    pub is_active: bool,

    /// Path segment selecting this locale. Nullable for the default
    /// locale (which is served at the site root without a prefix).
    #[schema(example = "en")]
    pub url_prefix: Option<String>,

    #[schema(example = "2024-01-15T10:30:00Z")]
    pub created_at: DateTime<Utc>,

    /// BCP-47 locale code, denormalised from `locales.code`.
    #[schema(example = "en")]
    pub code: String,

    /// English-language label, denormalised from `locales.name`.
    #[schema(example = "English")]
    pub name: String,

    /// Locale's own name, denormalised from `locales.native_name`.
    #[schema(example = "English")]
    pub native_name: Option<String>,

    /// `ltr` or `rtl`. The field name is `direction` (not
    /// `text_direction`) — see issue #742.
    pub direction: TextDirection,
}

impl From<SiteLocaleWithDetails> for SiteLocaleResponse {
    fn from(sld: SiteLocaleWithDetails) -> Self {
        Self {
            site_id: sld.site_id,
            locale_id: sld.locale_id,
            is_default: sld.is_default,
            is_active: sld.is_active,
            url_prefix: sld.url_prefix,
            created_at: sld.created_at,
            code: sld.code,
            name: sld.name,
            native_name: sld.native_name,
            direction: sld.direction,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use validator::Validate;

    #[test]
    fn test_add_site_locale_request_valid() {
        let req = AddSiteLocaleRequest {
            locale_id: Uuid::new_v4(),
            is_default: false,
            url_prefix: Some("en".to_string()),
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_add_site_locale_request_prefix_too_long() {
        let req = AddSiteLocaleRequest {
            locale_id: Uuid::new_v4(),
            is_default: false,
            url_prefix: Some("a".repeat(11)),
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_update_site_locale_request_valid() {
        let req = UpdateSiteLocaleRequest {
            is_default: Some(true),
            is_active: None,
            url_prefix: None,
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_site_locale_input_valid() {
        let input = SiteLocaleInput {
            locale_id: Uuid::new_v4(),
            is_default: true,
            url_prefix: Some("de".to_string()),
        };
        assert!(input.validate().is_ok());
    }

    #[test]
    fn test_site_locale_response_from_with_details() {
        let details = SiteLocaleWithDetails {
            site_id: Uuid::new_v4(),
            locale_id: Uuid::new_v4(),
            is_default: true,
            is_active: true,
            url_prefix: Some("en".to_string()),
            created_at: Utc::now(),
            code: "en".to_string(),
            name: "English".to_string(),
            native_name: Some("English".to_string()),
            direction: TextDirection::Ltr,
        };

        let response = SiteLocaleResponse::from(details.clone());
        assert_eq!(response.code, "en");
        assert_eq!(response.name, "English");
        assert!(response.is_default);
    }
}
