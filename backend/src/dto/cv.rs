//! CV DTOs

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use validator::Validate;

use crate::dto::validated::ValidatedDto;
use crate::models::content::ContentStatus;
use crate::models::cv::{CvEntry, CvEntryLocalization, CvEntryType, Skill, SkillCategory};
use crate::utils::pagination::Paginated;
use crate::utils::validation::{validate_slug, validate_url};

/// Request to create a skill
#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, utoipa::ToSchema)]
#[schema(description = "Create a skill")]
pub struct CreateSkillRequest {
    #[schema(example = "Rust")]
    #[validate(length(
        min = 1,
        max = 200,
        message = "Name must be between 1 and 200 characters"
    ))]
    pub name: String,

    #[schema(example = "rust")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Slug must be between 1 and 100 characters"
    ))]
    #[validate(custom(function = "validate_slug"))]
    pub slug: String,

    #[schema(example = "Programming")]
    pub category: Option<SkillCategory>,

    #[schema(example = "devicon-rust-plain")]
    #[validate(length(max = 200, message = "Icon cannot exceed 200 characters"))]
    pub icon: Option<String>,

    #[schema(example = 4)]
    #[validate(range(
        min = 1,
        max = 5,
        message = "Proficiency level must be between 1 and 5"
    ))]
    pub proficiency_level: Option<i16>,

    #[schema(example = false)]
    #[serde(default)]
    pub is_global: bool,

    /// Site IDs to associate this skill with
    #[schema(example = json!(["660e8400-e29b-41d4-a716-446655440000"]))]
    #[validate(length(min = 1, message = "At least one site ID is required"))]
    pub site_ids: Vec<Uuid>,
}

/// Request to update a skill
#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, utoipa::ToSchema)]
#[schema(description = "Update a skill")]
pub struct UpdateSkillRequest {
    #[schema(example = "TypeScript")]
    #[validate(length(
        min = 1,
        max = 200,
        message = "Name must be between 1 and 200 characters"
    ))]
    pub name: Option<String>,

    #[schema(example = "typescript")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Slug must be between 1 and 100 characters"
    ))]
    #[validate(custom(function = "validate_slug"))]
    pub slug: Option<String>,

    #[schema(example = "Framework")]
    pub category: Option<SkillCategory>,

    #[schema(example = "devicon-typescript-plain")]
    #[validate(length(max = 200, message = "Icon cannot exceed 200 characters"))]
    pub icon: Option<String>,

    #[schema(example = 5)]
    #[validate(range(
        min = 1,
        max = 5,
        message = "Proficiency level must be between 1 and 5"
    ))]
    pub proficiency_level: Option<i16>,

    #[schema(example = true)]
    pub is_global: Option<bool>,
}

/// Request to create a CV entry
#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, utoipa::ToSchema)]
#[schema(description = "Create a CV entry")]
pub struct CreateCvEntryRequest {
    #[schema(example = "Acme Corp")]
    #[validate(length(
        min = 1,
        max = 200,
        message = "Company must be between 1 and 200 characters"
    ))]
    pub company: String,

    #[schema(example = "https://acme.com")]
    #[validate(length(max = 2000, message = "Company URL cannot exceed 2000 characters"))]
    #[validate(custom(function = "validate_url"))]
    pub company_url: Option<String>,

    #[schema(example = "770e8400-e29b-41d4-a716-446655440000")]
    pub company_logo_id: Option<Uuid>,

    #[schema(example = "Vienna, Austria")]
    #[validate(length(
        min = 1,
        max = 200,
        message = "Location must be between 1 and 200 characters"
    ))]
    pub location: String,

    #[schema(example = "2020-01-15")]
    pub start_date: NaiveDate,
    #[schema(example = "2023-06-30")]
    pub end_date: Option<NaiveDate>,

    #[schema(example = false)]
    #[serde(default)]
    pub is_current: bool,

    #[schema(example = "Work")]
    #[serde(default)]
    pub entry_type: CvEntryType,

    #[schema(example = 1)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: i16,

    #[schema(example = "Draft")]
    #[serde(default)]
    pub status: ContentStatus,

    /// Site IDs to associate this entry with
    #[schema(example = json!(["660e8400-e29b-41d4-a716-446655440000"]))]
    #[validate(length(min = 1, message = "At least one site ID is required"))]
    pub site_ids: Vec<Uuid>,

    pub localizations: Option<Vec<CvEntryLocalizationInput>>,
    pub skill_ids: Option<Vec<Uuid>>,
}

/// Request to update a CV entry
#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, utoipa::ToSchema)]
#[schema(description = "Update a CV entry")]
pub struct UpdateCvEntryRequest {
    #[schema(example = "Updated Corp")]
    #[validate(length(
        min = 1,
        max = 200,
        message = "Company must be between 1 and 200 characters"
    ))]
    pub company: Option<String>,

    #[schema(example = "https://updated-corp.com")]
    #[validate(length(max = 2000, message = "Company URL cannot exceed 2000 characters"))]
    #[validate(custom(function = "validate_url"))]
    pub company_url: Option<String>,

    #[schema(example = "770e8400-e29b-41d4-a716-446655440000")]
    pub company_logo_id: Option<Uuid>,

    #[schema(example = "Berlin, Germany")]
    #[validate(length(
        min = 1,
        max = 200,
        message = "Location must be between 1 and 200 characters"
    ))]
    pub location: Option<String>,

    #[schema(example = "2020-03-01")]
    pub start_date: Option<NaiveDate>,
    #[schema(example = "2024-01-01")]
    pub end_date: Option<NaiveDate>,
    #[schema(example = true)]
    pub is_current: Option<bool>,
    #[schema(example = "Education")]
    pub entry_type: Option<CvEntryType>,

    #[schema(example = 2)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: Option<i16>,

    #[schema(example = "Published")]
    pub status: Option<ContentStatus>,

    pub localizations: Option<Vec<CvEntryLocalizationInput>>,
    pub skill_ids: Option<Vec<Uuid>>,
}

/// Input for CV entry localization
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "CV entry localization input")]
pub struct CvEntryLocalizationInput {
    pub locale_id: Uuid,

    #[validate(length(
        min = 1,
        max = 255,
        message = "Position must be between 1 and 255 characters"
    ))]
    pub position: String,

    pub description: Option<String>,

    pub achievements: Option<serde_json::Value>,
}

/// CV entry localization response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "CV entry localization details")]
pub struct CvEntryLocalizationResponse {
    pub id: Uuid,
    pub locale_id: Uuid,
    pub position: String,
    pub description: Option<String>,
    pub achievements: Option<serde_json::Value>,
}

impl From<CvEntryLocalization> for CvEntryLocalizationResponse {
    fn from(loc: CvEntryLocalization) -> Self {
        Self {
            id: loc.id,
            locale_id: loc.locale_id,
            position: loc.position,
            description: loc.description,
            achievements: loc.achievements,
        }
    }
}

/// CV entry detail response. Inherits `localizations` and `skill_ids` from
/// the flattened `CvEntryResponse` — no extra fields. The detail endpoint
/// exists for symmetry with other content types; the list/detail shapes
/// are intentionally identical for CV entries.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "CV entry detail. Same shape as CvEntryResponse — \
    list and detail expose the full relational graph because CV pages \
    are bounded and small.")]
pub struct CvEntryDetailResponse {
    #[serde(flatten)]
    pub entry: CvEntryResponse,
}

/// Per-locale skill name + description. Returned inside `SkillResponse.localizations[]`.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Localized skill name and description for a single locale")]
pub struct SkillLocalizationResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "660e8400-e29b-41d4-a716-446655440000")]
    pub locale_id: Uuid,
    #[schema(example = "Rost")]
    pub name: String,
    #[schema(example = "Systemprogrammiersprache mit Speichersicherheit")]
    pub description: Option<String>,
}

impl From<crate::models::cv::SkillLocalization> for SkillLocalizationResponse {
    fn from(loc: crate::models::cv::SkillLocalization) -> Self {
        Self {
            id: loc.id,
            locale_id: loc.locale_id,
            name: loc.display_name,
            description: loc.description,
        }
    }
}

/// Skill response. `name` is the admin/default label; `localizations[]`
/// carries per-locale display names + descriptions. Consumers should
/// prefer the localized entry for the active site locale and fall back
/// to `name` (or the site default locale) when no match exists.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Skill details, including per-locale display names")]
pub struct SkillResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "Rust")]
    pub name: String,
    #[schema(example = "rust")]
    pub slug: String,
    pub category: Option<SkillCategory>,
    #[schema(example = "devicon-rust-plain")]
    pub icon: Option<String>,
    #[schema(example = 85)]
    pub proficiency_level: Option<i16>,
    /// Per-locale display names. Empty array when no localizations exist
    /// (never `null`). Clients pick the matching locale and fall back per
    /// their own rules.
    pub localizations: Vec<SkillLocalizationResponse>,
}

impl From<(Skill, Vec<crate::models::cv::SkillLocalization>)> for SkillResponse {
    fn from((skill, localizations): (Skill, Vec<crate::models::cv::SkillLocalization>)) -> Self {
        Self {
            id: skill.id,
            name: skill.name,
            slug: skill.slug,
            category: skill.category,
            icon: skill.icon,
            proficiency_level: skill.proficiency_level,
            localizations: localizations
                .into_iter()
                .map(SkillLocalizationResponse::from)
                .collect(),
        }
    }
}

/// CV entry response.
///
/// Carries the per-locale text and linked skill IDs so consumers can render
/// a localized CV list in a single round-trip — no per-entry detail
/// fan-out. Empty arrays (never `null` / missing) when nothing is linked.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "CV entry details. Always carries localizations[] and \
        skill_ids[] (empty arrays when nothing is linked) so consumers can \
        render a localized list without per-entry detail fetches.")]
pub struct CvEntryResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "Acme Corp")]
    pub company: String,
    #[schema(example = "https://acme.com")]
    pub company_url: Option<String>,
    #[schema(example = "770e8400-e29b-41d4-a716-446655440000")]
    pub company_logo_id: Option<Uuid>,
    #[schema(example = "Vienna, Austria")]
    pub location: String,
    #[schema(example = "2020-01-15")]
    pub start_date: NaiveDate,
    #[schema(example = "2023-06-30")]
    pub end_date: Option<NaiveDate>,
    #[schema(example = true)]
    pub is_current: bool,
    pub entry_type: CvEntryType,
    #[schema(example = 1)]
    pub display_order: i16,
    #[schema(example = "2024-01-15T10:30:00Z")]
    pub created_at: DateTime<Utc>,
    #[schema(example = "2024-06-01T08:00:00Z")]
    pub updated_at: DateTime<Utc>,
    /// Per-locale position + description. Always present; empty when the
    /// entry has no localizations yet (never `null`).
    pub localizations: Vec<CvEntryLocalizationResponse>,
    /// Skill IDs linked to this CV entry. Always present — empty array
    /// when no skills are linked.
    #[schema(example = json!(["550e8400-e29b-41d4-a716-446655440000"]))]
    pub skill_ids: Vec<Uuid>,
}

impl From<CvEntry> for CvEntryResponse {
    fn from(entry: CvEntry) -> Self {
        Self {
            id: entry.id,
            company: entry.company,
            company_url: entry.company_url,
            company_logo_id: entry.company_logo_id,
            location: entry.location,
            start_date: entry.start_date,
            end_date: entry.end_date,
            is_current: entry.is_current,
            entry_type: entry.entry_type,
            display_order: entry.display_order,
            created_at: entry.created_at,
            updated_at: entry.updated_at,
            localizations: Vec::new(),
            skill_ids: Vec::new(),
        }
    }
}

impl CvEntryResponse {
    /// Attach the per-locale rows to this response. Use after constructing
    /// via `From<CvEntry>` to populate the bulk-fetched rows.
    pub fn with_localizations(mut self, localizations: Vec<CvEntryLocalizationResponse>) -> Self {
        self.localizations = localizations;
        self
    }

    /// Attach the linked skill IDs to this response. Use after constructing
    /// via `From<CvEntry>` to populate the bulk-fetched IDs.
    pub fn with_skill_ids(mut self, skill_ids: Vec<Uuid>) -> Self {
        self.skill_ids = skill_ids;
        self
    }
}

/// Paginated CV entry list response
pub type PaginatedCvEntries = Paginated<CvEntryResponse>;

/// Paginated skill list response
pub type PaginatedSkills = Paginated<SkillResponse>;

/// Request to batch-reorder CV entries
#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, utoipa::ToSchema)]
#[schema(description = "Batch reorder CV entries")]
pub struct ReorderCvEntriesRequest {
    #[validate(nested)]
    pub items: Vec<crate::dto::social::ReorderItem>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    // Compile-time proof that the skill request bodies flow through the
    // ValidatedJson seam (issue #828): this only type-checks if both DTOs
    // implement ValidatedDto. The existing `test_create_skill_request_*`
    // cases below already guard the field-level validation behaviour.
    #[test]
    fn skill_requests_opt_into_the_validated_seam() {
        fn assert_seam<T: crate::dto::validated::ValidatedDto>() {}
        assert_seam::<CreateSkillRequest>();
        assert_seam::<UpdateSkillRequest>();
    }

    #[test]
    fn test_skill_response_serialization() {
        let skill = SkillResponse {
            id: Uuid::new_v4(),
            name: "Rust".to_string(),
            slug: "rust".to_string(),
            category: Some(SkillCategory::Programming),
            icon: Some("rust.svg".to_string()),
            proficiency_level: Some(4),
            localizations: vec![],
        };

        let json = serde_json::to_string(&skill).unwrap();
        assert!(json.contains("\"name\":\"Rust\""));
    }

    #[test]
    fn skill_response_maps_localizations_correctly() {
        use crate::models::cv::SkillLocalization;
        use chrono::Utc;

        let skill_id = Uuid::new_v4();
        let de_locale = Uuid::new_v4();
        let en_locale = Uuid::new_v4();

        let skill = Skill {
            id: skill_id,
            name: "Rust".to_string(),
            slug: "rust".to_string(),
            category: Some(SkillCategory::Programming),
            icon: None,
            proficiency_level: Some(4),
            is_global: false,
            is_deleted: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        let de = SkillLocalization {
            id: Uuid::new_v4(),
            skill_id,
            locale_id: de_locale,
            display_name: "Rost".to_string(),
            description: Some("Systemprogrammiersprache".to_string()),
        };
        let en = SkillLocalization {
            id: Uuid::new_v4(),
            skill_id,
            locale_id: en_locale,
            display_name: "Rust".to_string(),
            description: None,
        };

        let response = SkillResponse::from((skill, vec![de.clone(), en.clone()]));

        assert_eq!(response.localizations.len(), 2);
        assert_eq!(response.localizations[0].id, de.id);
        assert_eq!(response.localizations[0].locale_id, de_locale);
        assert_eq!(response.localizations[0].name, "Rost");
        assert_eq!(
            response.localizations[0].description.as_deref(),
            Some("Systemprogrammiersprache")
        );
        assert_eq!(response.localizations[1].locale_id, en_locale);
        assert_eq!(response.localizations[1].name, "Rust");
        assert!(response.localizations[1].description.is_none());
    }

    #[test]
    fn skill_response_with_no_localizations_serializes_empty_array() {
        let skill = Skill {
            id: Uuid::new_v4(),
            name: "Rust".to_string(),
            slug: "rust".to_string(),
            category: None,
            icon: None,
            proficiency_level: None,
            is_global: false,
            is_deleted: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let response = SkillResponse::from((skill, vec![]));
        let json = serde_json::to_value(&response).unwrap();

        assert_eq!(json["localizations"], serde_json::json!([]));
    }

    fn sample_cv_entry_response() -> CvEntryResponse {
        CvEntryResponse {
            id: Uuid::new_v4(),
            company: "Acme Corp".to_string(),
            company_url: Some("https://acme.com".to_string()),
            company_logo_id: None,
            location: "Vienna, Austria".to_string(),
            start_date: NaiveDate::from_ymd_opt(2020, 1, 1).unwrap(),
            end_date: None,
            is_current: true,
            entry_type: CvEntryType::Work,
            display_order: 1,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            localizations: Vec::new(),
            skill_ids: Vec::new(),
        }
    }

    #[test]
    fn test_cv_entry_response_serialization() {
        let entry = sample_cv_entry_response();
        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("\"company\":\"Acme Corp\""));
    }

    // Issue #741 — list endpoint must surface localizations[] + skill_ids[]
    // on every item, always present (never null / missing).
    #[test]
    fn cv_entry_response_serializes_empty_localizations_and_skill_ids() {
        let entry = sample_cv_entry_response();
        let json = serde_json::to_string(&entry).unwrap();
        assert!(
            json.contains("\"localizations\":[]"),
            "CvEntryResponse must always carry localizations[], got: {json}"
        );
        assert!(
            json.contains("\"skill_ids\":[]"),
            "CvEntryResponse must always carry skill_ids[], got: {json}"
        );
    }

    #[test]
    fn cv_entry_response_with_helpers_populate_fields() {
        let loc = CvEntryLocalizationResponse {
            id: Uuid::new_v4(),
            locale_id: Uuid::new_v4(),
            position: "Senior Engineer".to_string(),
            description: Some("Built things.".to_string()),
            achievements: None,
        };
        let s1 = Uuid::new_v4();
        let s2 = Uuid::new_v4();

        let entry = sample_cv_entry_response()
            .with_localizations(vec![loc.clone()])
            .with_skill_ids(vec![s1, s2]);

        assert_eq!(entry.localizations.len(), 1);
        assert_eq!(entry.localizations[0].position, "Senior Engineer");
        assert_eq!(entry.skill_ids, vec![s1, s2]);
    }

    // Issue #741 — CvEntryDetailResponse inherits the new fields via
    // #[serde(flatten)]; declaring them again would produce duplicate JSON keys.
    #[test]
    fn cv_entry_detail_response_has_exactly_one_localizations_and_skill_ids_key() {
        let detail = CvEntryDetailResponse {
            entry: sample_cv_entry_response(),
        };
        let json = serde_json::to_string(&detail).unwrap();
        assert_eq!(
            json.matches("\"localizations\"").count(),
            1,
            "expected exactly one localizations key in: {json}"
        );
        assert_eq!(
            json.matches("\"skill_ids\"").count(),
            1,
            "expected exactly one skill_ids key in: {json}"
        );
    }

    #[test]
    fn cv_entry_localization_response_from_model_maps_all_fields() {
        use crate::models::cv::CvEntryLocalization;
        let row = CvEntryLocalization {
            id: Uuid::new_v4(),
            cv_entry_id: Uuid::new_v4(),
            locale_id: Uuid::new_v4(),
            position: "CTO".to_string(),
            description: Some("desc".to_string()),
            achievements: Some(serde_json::json!(["a", "b"])),
        };
        let r = CvEntryLocalizationResponse::from(row.clone());
        assert_eq!(r.id, row.id);
        assert_eq!(r.locale_id, row.locale_id);
        assert_eq!(r.position, "CTO");
        assert_eq!(r.description.as_deref(), Some("desc"));
        assert_eq!(r.achievements, Some(serde_json::json!(["a", "b"])));
    }

    // --- CreateSkillRequest validation tests ---

    #[test]
    fn test_create_skill_request_valid() {
        let request = CreateSkillRequest {
            name: "Rust".to_string(),
            slug: "rust".to_string(),
            category: Some(SkillCategory::Programming),
            icon: Some("rust-icon".to_string()),
            proficiency_level: Some(5),
            is_global: false,
            site_ids: vec![Uuid::new_v4()],
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_skill_request_empty_name() {
        let request = CreateSkillRequest {
            name: "".to_string(),
            slug: "rust".to_string(),
            category: None,
            icon: None,
            proficiency_level: None,
            is_global: false,
            site_ids: vec![Uuid::new_v4()],
        };
        let result = request.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().field_errors().contains_key("name"));
    }

    #[test]
    fn test_create_skill_request_slug_too_long() {
        let request = CreateSkillRequest {
            name: "Rust".to_string(),
            slug: "a".repeat(101),
            category: None,
            icon: None,
            proficiency_level: None,
            is_global: false,
            site_ids: vec![Uuid::new_v4()],
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_skill_request_invalid_slug() {
        let request = CreateSkillRequest {
            name: "Rust".to_string(),
            slug: "Invalid Slug!".to_string(),
            category: None,
            icon: None,
            proficiency_level: None,
            is_global: false,
            site_ids: vec![Uuid::new_v4()],
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_skill_request_proficiency_too_high() {
        let request = CreateSkillRequest {
            name: "Rust".to_string(),
            slug: "rust".to_string(),
            category: None,
            icon: None,
            proficiency_level: Some(101),
            is_global: false,
            site_ids: vec![Uuid::new_v4()],
        };
        let result = request.validate();
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .field_errors()
            .contains_key("proficiency_level"));
    }

    #[test]
    fn test_create_skill_request_proficiency_negative() {
        let request = CreateSkillRequest {
            name: "Rust".to_string(),
            slug: "rust".to_string(),
            category: None,
            icon: None,
            proficiency_level: Some(-1),
            is_global: false,
            site_ids: vec![Uuid::new_v4()],
        };
        assert!(request.validate().is_err());
    }

    // Regression for #838: proficiency is a 1–5 star rating. The DTO once
    // validated 0–100, so values 6–100 passed validation and then failed the
    // DB CHECK (1–5) with an opaque "Data constraint violation". The DTO must
    // now reject the same boundary the database does.
    fn skill_request_with_proficiency(level: i16) -> CreateSkillRequest {
        CreateSkillRequest {
            name: "Rust".to_string(),
            slug: "rust".to_string(),
            category: None,
            icon: None,
            proficiency_level: Some(level),
            is_global: false,
            site_ids: vec![Uuid::new_v4()],
        }
    }

    #[test]
    fn test_create_skill_request_rejects_proficiency_above_five() {
        let result = skill_request_with_proficiency(6).validate();
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .field_errors()
            .contains_key("proficiency_level"));
    }

    #[test]
    fn test_create_skill_request_rejects_proficiency_below_one() {
        let result = skill_request_with_proficiency(0).validate();
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .field_errors()
            .contains_key("proficiency_level"));
    }

    #[test]
    fn test_create_skill_request_accepts_proficiency_min_boundary() {
        assert!(skill_request_with_proficiency(1).validate().is_ok());
    }

    #[test]
    fn test_create_skill_request_accepts_proficiency_max_boundary() {
        assert!(skill_request_with_proficiency(5).validate().is_ok());
    }

    #[test]
    fn test_create_skill_request_empty_site_ids() {
        let request = CreateSkillRequest {
            name: "Rust".to_string(),
            slug: "rust".to_string(),
            category: None,
            icon: None,
            proficiency_level: None,
            is_global: false,
            site_ids: vec![],
        };
        let result = request.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().field_errors().contains_key("site_ids"));
    }

    // --- UpdateSkillRequest validation tests ---

    #[test]
    fn test_update_skill_request_valid_partial() {
        let request = UpdateSkillRequest {
            name: Some("TypeScript".to_string()),
            slug: None,
            category: None,
            icon: None,
            proficiency_level: Some(5),
            is_global: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_update_skill_request_all_none() {
        let request = UpdateSkillRequest {
            name: None,
            slug: None,
            category: None,
            icon: None,
            proficiency_level: None,
            is_global: None,
        };
        assert!(request.validate().is_ok());
    }

    // --- CreateCvEntryRequest validation tests ---

    #[test]
    fn test_create_cv_entry_request_valid() {
        let request = CreateCvEntryRequest {
            company: "Acme Corp".to_string(),
            company_url: Some("https://acme.com".to_string()),
            company_logo_id: None,
            location: "Vienna, Austria".to_string(),
            start_date: NaiveDate::from_ymd_opt(2020, 1, 1).unwrap(),
            end_date: None,
            is_current: true,
            entry_type: CvEntryType::Work,
            display_order: 1,
            status: ContentStatus::Published,
            site_ids: vec![Uuid::new_v4()],
            localizations: None,
            skill_ids: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_cv_entry_request_empty_company() {
        let request = CreateCvEntryRequest {
            company: "".to_string(),
            company_url: None,
            company_logo_id: None,
            location: "Vienna".to_string(),
            start_date: NaiveDate::from_ymd_opt(2020, 1, 1).unwrap(),
            end_date: None,
            is_current: false,
            entry_type: CvEntryType::Work,
            display_order: 0,
            status: ContentStatus::Draft,
            site_ids: vec![Uuid::new_v4()],
            localizations: None,
            skill_ids: None,
        };
        let result = request.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().field_errors().contains_key("company"));
    }

    #[test]
    fn test_create_cv_entry_request_invalid_company_url() {
        let request = CreateCvEntryRequest {
            company: "Acme Corp".to_string(),
            company_url: Some("not-a-url".to_string()),
            company_logo_id: None,
            location: "Vienna".to_string(),
            start_date: NaiveDate::from_ymd_opt(2020, 1, 1).unwrap(),
            end_date: None,
            is_current: false,
            entry_type: CvEntryType::Work,
            display_order: 0,
            status: ContentStatus::Draft,
            site_ids: vec![Uuid::new_v4()],
            localizations: None,
            skill_ids: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_cv_entry_request_display_order_out_of_range() {
        let request = CreateCvEntryRequest {
            company: "Acme Corp".to_string(),
            company_url: None,
            company_logo_id: None,
            location: "Vienna".to_string(),
            start_date: NaiveDate::from_ymd_opt(2020, 1, 1).unwrap(),
            end_date: None,
            is_current: false,
            entry_type: CvEntryType::Work,
            display_order: 10000,
            status: ContentStatus::Draft,
            site_ids: vec![Uuid::new_v4()],
            localizations: None,
            skill_ids: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_cv_entry_request_empty_site_ids() {
        let request = CreateCvEntryRequest {
            company: "Acme Corp".to_string(),
            company_url: None,
            company_logo_id: None,
            location: "Vienna".to_string(),
            start_date: NaiveDate::from_ymd_opt(2020, 1, 1).unwrap(),
            end_date: None,
            is_current: false,
            entry_type: CvEntryType::Work,
            display_order: 0,
            status: ContentStatus::Draft,
            site_ids: vec![],
            localizations: None,
            skill_ids: None,
        };
        let result = request.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().field_errors().contains_key("site_ids"));
    }

    // --- UpdateCvEntryRequest validation tests ---

    #[test]
    fn test_update_cv_entry_request_valid_partial() {
        let request = UpdateCvEntryRequest {
            company: Some("New Corp".to_string()),
            company_url: None,
            company_logo_id: None,
            location: None,
            start_date: None,
            end_date: None,
            is_current: Some(false),
            entry_type: None,
            display_order: Some(5),
            status: None,
            localizations: None,
            skill_ids: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_update_cv_entry_request_all_none() {
        let request = UpdateCvEntryRequest {
            company: None,
            company_url: None,
            company_logo_id: None,
            location: None,
            start_date: None,
            end_date: None,
            is_current: None,
            entry_type: None,
            display_order: None,
            status: None,
            localizations: None,
            skill_ids: None,
        };
        assert!(request.validate().is_ok());
    }
}
