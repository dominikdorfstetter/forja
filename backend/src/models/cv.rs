//! CV/Resume model — pure data structs.
//!
//! All SQL lives in [`repos::cv_repo`](crate::repos::cv_repo).

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, utoipa::ToSchema)]
#[sqlx(type_name = "cv_entry_type", rename_all = "lowercase")]
#[derive(Default)]
pub enum CvEntryType {
    #[default]
    Work,
    Education,
    Volunteer,
    Certification,
    Project,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, utoipa::ToSchema)]
#[sqlx(type_name = "skill_category", rename_all = "lowercase")]
pub enum SkillCategory {
    Programming,
    Framework,
    Database,
    Devops,
    Language,
    #[sqlx(rename = "soft_skill")]
    SoftSkill,
    Tool,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Skill {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub category: Option<SkillCategory>,
    pub icon: Option<String>,
    pub proficiency_level: Option<i16>,
    pub is_global: bool,
    pub is_deleted: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SkillLocalization {
    pub id: Uuid,
    pub skill_id: Uuid,
    pub locale_id: Uuid,
    pub display_name: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CvEntryLocalization {
    pub id: Uuid,
    pub cv_entry_id: Uuid,
    pub locale_id: Uuid,
    pub position: String,
    pub description: Option<String>,
    pub achievements: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CvEntry {
    pub id: Uuid,
    pub content_id: Option<Uuid>,
    pub company: String,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cv_entry_type_serialization() {
        let entry_type = CvEntryType::Education;
        let json = serde_json::to_string(&entry_type).unwrap();
        assert_eq!(json, "\"Education\"");
    }

    #[test]
    fn test_skill_category_serialization() {
        let category = SkillCategory::Programming;
        let json = serde_json::to_string(&category).unwrap();
        assert_eq!(json, "\"Programming\"");
    }
}
