//! CV DTOs

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use validator::Validate;

use crate::models::content::ContentStatus;
use crate::models::cv::{CvEntry, CvEntryType, Skill, SkillCategory};
use crate::utils::pagination::Paginated;
use crate::utils::validation::{validate_slug, validate_url};

/// Request to create a skill
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
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

    pub category: Option<SkillCategory>,

    #[validate(length(max = 200, message = "Icon cannot exceed 200 characters"))]
    pub icon: Option<String>,

    #[validate(range(
        min = 0,
        max = 100,
        message = "Proficiency level must be between 0 and 100"
    ))]
    pub proficiency_level: Option<i16>,

    #[serde(default)]
    pub is_global: bool,

    /// Site IDs to associate this skill with
    #[validate(length(min = 1, message = "At least one site ID is required"))]
    pub site_ids: Vec<Uuid>,
}

/// Request to update a skill
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
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

    pub category: Option<SkillCategory>,

    #[validate(length(max = 200, message = "Icon cannot exceed 200 characters"))]
    pub icon: Option<String>,

    #[validate(range(
        min = 0,
        max = 100,
        message = "Proficiency level must be between 0 and 100"
    ))]
    pub proficiency_level: Option<i16>,

    pub is_global: Option<bool>,
}

/// Request to create a CV entry
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
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

    pub company_logo_id: Option<Uuid>,

    #[validate(length(
        min = 1,
        max = 200,
        message = "Location must be between 1 and 200 characters"
    ))]
    pub location: String,

    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,

    #[serde(default)]
    pub is_current: bool,

    #[serde(default)]
    pub entry_type: CvEntryType,

    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: i16,

    #[serde(default)]
    pub status: ContentStatus,

    /// Site IDs to associate this entry with
    #[validate(length(min = 1, message = "At least one site ID is required"))]
    pub site_ids: Vec<Uuid>,
}

/// Request to update a CV entry
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
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

    pub company_logo_id: Option<Uuid>,

    #[validate(length(
        min = 1,
        max = 200,
        message = "Location must be between 1 and 200 characters"
    ))]
    pub location: Option<String>,

    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub is_current: Option<bool>,
    pub entry_type: Option<CvEntryType>,

    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: Option<i16>,

    pub status: Option<ContentStatus>,
}

/// Skill response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Skill details")]
pub struct SkillResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "Rust")]
    pub name: String,
    #[schema(example = "rust")]
    pub slug: String,
    pub category: Option<SkillCategory>,
    pub icon: Option<String>,
    pub proficiency_level: Option<i16>,
}

impl From<Skill> for SkillResponse {
    fn from(skill: Skill) -> Self {
        Self {
            id: skill.id,
            name: skill.name,
            slug: skill.slug,
            category: skill.category,
            icon: skill.icon,
            proficiency_level: skill.proficiency_level,
        }
    }
}

/// CV entry response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "CV entry details")]
pub struct CvEntryResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "Acme Corp")]
    pub company: String,
    #[schema(example = "https://acme.com")]
    pub company_url: Option<String>,
    pub company_logo_id: Option<Uuid>,
    pub location: String,
    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    pub is_current: bool,
    pub entry_type: CvEntryType,
    pub display_order: i16,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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
        }
    }
}

/// Paginated CV entry list response
pub type PaginatedCvEntries = Paginated<CvEntryResponse>;

/// Paginated skill list response
pub type PaginatedSkills = Paginated<SkillResponse>;

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_skill_response_serialization() {
        let skill = SkillResponse {
            id: Uuid::new_v4(),
            name: "Rust".to_string(),
            slug: "rust".to_string(),
            category: Some(SkillCategory::Programming),
            icon: Some("rust.svg".to_string()),
            proficiency_level: Some(4),
        };

        let json = serde_json::to_string(&skill).unwrap();
        assert!(json.contains("\"name\":\"Rust\""));
    }

    #[test]
    fn test_cv_entry_response_serialization() {
        let entry = CvEntryResponse {
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
        };

        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("\"company\":\"Acme Corp\""));
    }

    // --- CreateSkillRequest validation tests ---

    #[test]
    fn test_create_skill_request_valid() {
        let request = CreateSkillRequest {
            name: "Rust".to_string(),
            slug: "rust".to_string(),
            category: Some(SkillCategory::Programming),
            icon: Some("rust-icon".to_string()),
            proficiency_level: Some(85),
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
            proficiency_level: Some(90),
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
        };
        assert!(request.validate().is_ok());
    }
}
