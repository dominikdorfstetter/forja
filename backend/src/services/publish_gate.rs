//! Publish-gate validation
//!
//! Validates content completeness before allowing status transition
//! to Published. Returns blocking errors (prevent publish) and
//! non-blocking warnings (informational).

use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::models::content::ContentLocalization;
use crate::repos::page_repo::PageSectionRepo;
use crate::services::localization_lifecycle;

/// A validation issue found during publish-gate checks.
#[derive(Debug, Clone, Serialize)]
pub(crate) struct ValidationIssue {
    pub field: String,
    pub rule: String,
    pub message: String,
}

/// Result of publish-gate validation.
#[derive(Debug, Clone, Serialize)]
pub(crate) struct PublishGateResult {
    /// Blocking errors — content cannot be published
    pub errors: Vec<ValidationIssue>,
    /// Non-blocking warnings — content can be published but should be improved
    pub warnings: Vec<ValidationIssue>,
}

impl PublishGateResult {
    pub(crate) fn is_blocked(&self) -> bool {
        !self.errors.is_empty()
    }
}

/// Map a gate result to the canonical publish-gate outcome: a blocked gate
/// becomes a `VALIDATION_ERROR` 400 carrying the joined blocking messages, so
/// the request fails fast before any audit/webhook side effects. Shared by the
/// per-entity `ContentEntity::validate_publish_gate` overrides (#865).
pub(crate) fn enforce(gate: PublishGateResult) -> Result<(), ApiError> {
    if gate.is_blocked() {
        let messages: Vec<String> = gate.errors.iter().map(|e| e.message.clone()).collect();
        return Err(ApiError::bad_request(messages.join("; "))
            .with_code(crate::errors::codes::VALIDATION_ERROR));
    }
    Ok(())
}

/// Validate a blog post for publishing.
///
/// Checks:
/// - At least one localization with a non-empty title
/// - At least one localization with a non-empty body
/// - Warning if no meta_title is set
pub(crate) async fn validate_blog_for_publish(
    pool: &PgPool,
    content_id: Uuid,
) -> Result<PublishGateResult, ApiError> {
    let localizations = ContentLocalization::find_all_for_content(pool, content_id).await?;

    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    validate_localizations(&localizations, &mut errors, &mut warnings);

    validate_body_required(&localizations, &mut errors, "Blog post");

    validate_default_filled(pool, content_id, &localizations, true, &mut errors).await?;

    Ok(PublishGateResult { errors, warnings })
}

/// Validate a page for publishing.
///
/// Checks:
/// - At least one localization with a non-empty title
/// - At least one section exists
/// - Warning if no meta_title is set
pub(crate) async fn validate_page_for_publish(
    pool: &PgPool,
    content_id: Uuid,
    page_id: Uuid,
) -> Result<PublishGateResult, ApiError> {
    let localizations = ContentLocalization::find_all_for_content(pool, content_id).await?;

    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    validate_localizations(&localizations, &mut errors, &mut warnings);

    // Page-specific: must have at least one section
    let sections = PageSectionRepo::find_for_page(pool, page_id).await?;
    if sections.is_empty() {
        errors.push(ValidationIssue {
            field: "sections".to_string(),
            rule: "required_for_publish".to_string(),
            message: "Page must have at least one section before publishing".to_string(),
        });
    }

    validate_default_filled(pool, content_id, &localizations, false, &mut errors).await?;

    Ok(PublishGateResult { errors, warnings })
}

/// Shared localization validation for all content types.
fn validate_localizations(
    localizations: &[ContentLocalization],
    errors: &mut Vec<ValidationIssue>,
    warnings: &mut Vec<ValidationIssue>,
) {
    if localizations.is_empty() {
        errors.push(ValidationIssue {
            field: "localizations".to_string(),
            rule: "required_for_publish".to_string(),
            message: "Content must have at least one localization before publishing".to_string(),
        });
        return;
    }

    // Must have at least one localization with a title
    let has_title = localizations.iter().any(|l| !l.title.trim().is_empty());
    if !has_title {
        errors.push(ValidationIssue {
            field: "title".to_string(),
            rule: "required_for_publish".to_string(),
            message: "Content must have a title before publishing".to_string(),
        });
    }

    // Warning: no meta_title set
    let has_meta_title = localizations
        .iter()
        .any(|l| l.meta_title.as_ref().is_some_and(|t| !t.trim().is_empty()));
    if !has_meta_title {
        warnings.push(ValidationIssue {
            field: "meta_title".to_string(),
            rule: "recommended".to_string(),
            message: "Adding a meta title improves SEO".to_string(),
        });
    }
}

/// Shared body validation for content types that require a body (blogs, legal docs).
fn validate_body_required(
    localizations: &[ContentLocalization],
    errors: &mut Vec<ValidationIssue>,
    entity_label: &str,
) {
    let has_body = localizations
        .iter()
        .any(|l| l.body.as_ref().is_some_and(|b| !b.trim().is_empty()));
    if !has_body {
        errors.push(ValidationIssue {
            field: "body".to_string(),
            rule: "required_for_publish".to_string(),
            message: format!("{} must have content before publishing", entity_label),
        });
    }
}

/// Validate a legal document for publishing.
///
/// Checks:
/// - At least one localization with a non-empty title
/// - At least one content localization with a non-empty body
/// - Warning if no meta_title is set
pub(crate) async fn validate_legal_for_publish(
    pool: &PgPool,
    content_id: Uuid,
) -> Result<PublishGateResult, ApiError> {
    let localizations = ContentLocalization::find_all_for_content(pool, content_id).await?;

    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    validate_localizations(&localizations, &mut errors, &mut warnings);
    validate_body_required(&localizations, &mut errors, "Legal document");

    validate_default_filled(pool, content_id, &localizations, true, &mut errors).await?;

    Ok(PublishGateResult { errors, warnings })
}

/// Default-locale gate: the default `site_locale` of every Site the content
/// belongs to must be *filled out* at publish time — a localization row with
/// a non-empty title (and non-empty body when `require_body`). Non-default
/// locales are optional: readers fall back to the default per ADR 0002
/// (`utils::locale_resolver`). Delegates the default-locale lookup to the
/// lifecycle so the rule is owned in one place across blog / page / legal.
async fn validate_default_filled(
    pool: &PgPool,
    content_id: Uuid,
    localizations: &[ContentLocalization],
    require_body: bool,
    errors: &mut Vec<ValidationIssue>,
) -> Result<(), ApiError> {
    let defaults = localization_lifecycle::default_locale_ids(pool, content_id).await?;
    check_default_locales(&defaults, localizations, require_body, errors);
    Ok(())
}

/// Pure core of [`validate_default_filled`]: push an error for each default
/// locale that is missing a localization or whose title (or body, when
/// `require_body`) is empty. No I/O.
fn check_default_locales(
    defaults: &[localization_lifecycle::DefaultLocale],
    localizations: &[ContentLocalization],
    require_body: bool,
    errors: &mut Vec<ValidationIssue>,
) {
    for default in defaults {
        match localizations
            .iter()
            .find(|l| l.locale_id == default.locale_id)
        {
            None => errors.push(ValidationIssue {
                field: "localizations".to_string(),
                rule: "default_locale_required".to_string(),
                message: format!(
                    "The default locale ({}) must have a localization before publishing",
                    default.code
                ),
            }),
            Some(loc) => {
                if loc.title.trim().is_empty() {
                    errors.push(ValidationIssue {
                        field: "title".to_string(),
                        rule: "default_locale_required".to_string(),
                        message: format!(
                            "The default locale ({}) must have a title before publishing",
                            default.code
                        ),
                    });
                }
                if require_body && loc.body.as_ref().is_none_or(|b| b.trim().is_empty()) {
                    errors.push(ValidationIssue {
                        field: "body".to_string(),
                        rule: "default_locale_required".to_string(),
                        message: format!(
                            "The default locale ({}) must have content before publishing",
                            default.code
                        ),
                    });
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use uuid::Uuid;

    fn make_localization(
        title: &str,
        body: Option<&str>,
        meta_title: Option<&str>,
    ) -> ContentLocalization {
        ContentLocalization {
            id: Uuid::new_v4(),
            content_id: Uuid::new_v4(),
            locale_id: Uuid::new_v4(),
            title: title.to_string(),
            subtitle: None,
            excerpt: None,
            body: body.map(|b| b.to_string()),
            meta_title: meta_title.map(|m| m.to_string()),
            meta_description: None,
            translation_status: crate::models::content::TranslationStatus::Approved,
            translated_by: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn test_validate_empty_localizations() {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();
        validate_localizations(&[], &mut errors, &mut warnings);
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].field, "localizations");
    }

    #[test]
    fn test_validate_no_title() {
        let locs = vec![make_localization("", Some("body"), None)];
        let mut errors = Vec::new();
        let mut warnings = Vec::new();
        validate_localizations(&locs, &mut errors, &mut warnings);
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].field, "title");
    }

    #[test]
    fn test_validate_valid_content() {
        let locs = vec![make_localization(
            "My Post",
            Some("Hello world"),
            Some("SEO Title"),
        )];
        let mut errors = Vec::new();
        let mut warnings = Vec::new();
        validate_localizations(&locs, &mut errors, &mut warnings);
        assert!(errors.is_empty());
        assert!(warnings.is_empty());
    }

    #[test]
    fn test_validate_missing_meta_title_warns() {
        let locs = vec![make_localization("My Post", Some("Hello"), None)];
        let mut errors = Vec::new();
        let mut warnings = Vec::new();
        validate_localizations(&locs, &mut errors, &mut warnings);
        assert!(errors.is_empty());
        assert_eq!(warnings.len(), 1);
        assert_eq!(warnings[0].field, "meta_title");
        assert_eq!(warnings[0].rule, "recommended");
    }

    #[test]
    fn test_validate_body_required_with_body() {
        let locs = vec![make_localization("Title", Some("Some body"), None)];
        let mut errors = Vec::new();
        validate_body_required(&locs, &mut errors, "Blog post");
        assert!(errors.is_empty());
    }

    #[test]
    fn test_validate_body_required_without_body() {
        let locs = vec![make_localization("Title", None, None)];
        let mut errors = Vec::new();
        validate_body_required(&locs, &mut errors, "Legal document");
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].field, "body");
        assert_eq!(errors[0].rule, "required_for_publish");
        assert!(errors[0].message.contains("Legal document"));
    }

    #[test]
    fn test_validate_body_required_empty_body() {
        let locs = vec![make_localization("Title", Some("   "), None)];
        let mut errors = Vec::new();
        validate_body_required(&locs, &mut errors, "Blog post");
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].field, "body");
    }

    #[test]
    fn test_publish_gate_result_blocked() {
        let result = PublishGateResult {
            errors: vec![ValidationIssue {
                field: "body".to_string(),
                rule: "required".to_string(),
                message: "Body required".to_string(),
            }],
            warnings: vec![],
        };
        assert!(result.is_blocked());
    }

    #[test]
    fn test_publish_gate_result_not_blocked() {
        let result = PublishGateResult {
            errors: vec![],
            warnings: vec![ValidationIssue {
                field: "meta_title".to_string(),
                rule: "recommended".to_string(),
                message: "SEO hint".to_string(),
            }],
        };
        assert!(!result.is_blocked());
    }

    fn default_locale(locale_id: Uuid, code: &str) -> localization_lifecycle::DefaultLocale {
        localization_lifecycle::DefaultLocale {
            locale_id,
            code: code.to_string(),
        }
    }

    fn loc_for(locale_id: Uuid, title: &str, body: Option<&str>) -> ContentLocalization {
        ContentLocalization {
            locale_id,
            ..make_localization(title, body, None)
        }
    }

    // #781: a complete default locale is all that publish requires —
    // non-default locales are optional (readers fall back to the default).
    #[test]
    fn test_default_filled_complete_passes() {
        let de = Uuid::new_v4();
        let defaults = vec![default_locale(de, "de")];
        let locs = vec![loc_for(de, "Titel", Some("Inhalt"))];
        let mut errors = Vec::new();
        check_default_locales(&defaults, &locs, true, &mut errors);
        assert!(errors.is_empty());
    }

    // Missing en/es localizations no longer block publish when the default
    // (de) is filled — the exact production deadlock from #781.
    #[test]
    fn test_default_filled_ignores_missing_non_default_locales() {
        let de = Uuid::new_v4();
        let defaults = vec![default_locale(de, "de")];
        // Only the default exists; en/es are simply absent.
        let locs = vec![loc_for(de, "Titel", Some("Inhalt"))];
        let mut errors = Vec::new();
        check_default_locales(&defaults, &locs, true, &mut errors);
        assert!(errors.is_empty());
    }

    #[test]
    fn test_default_filled_missing_default_blocks() {
        let de = Uuid::new_v4();
        let defaults = vec![default_locale(de, "de")];
        // Default locale has no localization at all (an unrelated locale does).
        let locs = vec![loc_for(Uuid::new_v4(), "Title", Some("Body"))];
        let mut errors = Vec::new();
        check_default_locales(&defaults, &locs, true, &mut errors);
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].field, "localizations");
        assert_eq!(errors[0].rule, "default_locale_required");
        assert!(errors[0].message.contains("de"));
    }

    #[test]
    fn test_default_filled_empty_title_blocks() {
        let de = Uuid::new_v4();
        let defaults = vec![default_locale(de, "de")];
        let locs = vec![loc_for(de, "   ", Some("Inhalt"))];
        let mut errors = Vec::new();
        check_default_locales(&defaults, &locs, true, &mut errors);
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].field, "title");
    }

    #[test]
    fn test_default_filled_empty_body_blocks_when_required() {
        let de = Uuid::new_v4();
        let defaults = vec![default_locale(de, "de")];
        let locs = vec![loc_for(de, "Titel", None)];
        let mut errors = Vec::new();
        check_default_locales(&defaults, &locs, true, &mut errors);
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].field, "body");
    }

    // Pages have no body (content lives in sections), so require_body=false.
    #[test]
    fn test_default_filled_empty_body_allowed_when_not_required() {
        let de = Uuid::new_v4();
        let defaults = vec![default_locale(de, "de")];
        let locs = vec![loc_for(de, "Titel", None)];
        let mut errors = Vec::new();
        check_default_locales(&defaults, &locs, false, &mut errors);
        assert!(errors.is_empty());
    }

    // No default configured (edge case): the default check is silent — the
    // generic at-least-one-localization floor still applies elsewhere.
    #[test]
    fn test_default_filled_no_defaults_is_silent() {
        let locs = vec![loc_for(Uuid::new_v4(), "Title", Some("Body"))];
        let mut errors = Vec::new();
        check_default_locales(&[], &locs, true, &mut errors);
        assert!(errors.is_empty());
    }

    // Multi-site: each Site's default must be filled; one missing blocks.
    #[test]
    fn test_default_filled_multi_site_one_missing_blocks() {
        let de = Uuid::new_v4();
        let en = Uuid::new_v4();
        let defaults = vec![default_locale(de, "de"), default_locale(en, "en")];
        let locs = vec![loc_for(de, "Titel", Some("Inhalt"))]; // en default absent
        let mut errors = Vec::new();
        check_default_locales(&defaults, &locs, true, &mut errors);
        assert_eq!(errors.len(), 1);
        assert!(errors[0].message.contains("en"));
    }
}
