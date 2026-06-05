//! Project DTOs

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use validator::Validate;

use crate::dto::validated::ValidatedDto;
use crate::models::content::ContentStatus;
use crate::models::project::{
    ProjectLink, ProjectLinkType, ProjectLocalization, ProjectMediaItem, ProjectWithContent,
};
use crate::utils::pagination::Paginated;
use crate::utils::validation::{validate_slug, validate_url};

/// Request to create a project link
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Create a project link")]
pub struct CreateProjectLinkRequest {
    #[schema(example = "GitHub Repository")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Label must be between 1 and 100 characters"
    ))]
    pub label: String,

    #[schema(example = "https://github.com/example/project")]
    #[validate(length(
        min = 1,
        max = 2000,
        message = "URL must be between 1 and 2000 characters"
    ))]
    #[validate(custom(function = "validate_url"))]
    pub url: String,

    #[schema(example = "Repository")]
    #[serde(default)]
    pub link_type: Option<ProjectLinkType>,

    #[schema(example = "github")]
    #[validate(length(max = 50, message = "Icon cannot exceed 50 characters"))]
    pub icon: Option<String>,

    #[schema(example = 0)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: Option<i16>,
}

/// Request to specify a media attachment for a project
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Project media attachment")]
pub struct ProjectMediaRequest {
    #[schema(example = "880e8400-e29b-41d4-a716-446655440000")]
    pub media_id: Uuid,

    #[schema(example = 0)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: Option<i16>,

    #[schema(example = false)]
    #[serde(default)]
    pub is_cover: Option<bool>,
}

/// Request to create/update a project localization
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Project localization input")]
pub struct CreateProjectLocalizationRequest {
    pub locale_id: Uuid,

    #[validate(length(
        min = 1,
        max = 255,
        message = "Title must be between 1 and 255 characters"
    ))]
    pub title: String,

    #[validate(length(max = 500, message = "Short description cannot exceed 500 characters"))]
    pub short_description: Option<String>,

    pub description: Option<String>,
}

/// Request to create a project
#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, utoipa::ToSchema)]
#[schema(description = "Create a project")]
pub struct CreateProjectRequest {
    #[schema(example = "my-awesome-project")]
    #[validate(length(
        min = 1,
        max = 255,
        message = "Slug must be between 1 and 255 characters"
    ))]
    #[validate(custom(function = "validate_slug"))]
    pub slug: String,

    #[schema(example = 0)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    #[serde(default)]
    pub display_order: Option<i16>,

    #[schema(example = false)]
    #[serde(default)]
    pub is_featured: Option<bool>,

    #[schema(example = "2023-01-15")]
    pub start_date: Option<NaiveDate>,

    #[schema(example = "2024-06-30")]
    pub end_date: Option<NaiveDate>,

    #[schema(example = false)]
    #[serde(default)]
    pub is_ongoing: Option<bool>,

    #[schema(example = "Draft")]
    #[serde(default)]
    pub status: ContentStatus,

    /// Site IDs to associate this project with
    #[schema(example = json!(["660e8400-e29b-41d4-a716-446655440000"]))]
    #[validate(length(min = 1, message = "At least one site ID is required"))]
    pub site_ids: Vec<Uuid>,

    pub localizations: Option<Vec<CreateProjectLocalizationRequest>>,
    pub links: Option<Vec<CreateProjectLinkRequest>>,
    pub media: Option<Vec<ProjectMediaRequest>>,

    #[schema(example = json!(["550e8400-e29b-41d4-a716-446655440000"]))]
    pub skill_ids: Option<Vec<Uuid>>,

    #[schema(example = json!(["770e8400-e29b-41d4-a716-446655440000"]))]
    pub cv_entry_ids: Option<Vec<Uuid>>,
}

/// Request to update a project
#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, utoipa::ToSchema)]
#[schema(description = "Update a project")]
pub struct UpdateProjectRequest {
    #[schema(example = "updated-project-slug")]
    #[validate(length(
        min = 1,
        max = 255,
        message = "Slug must be between 1 and 255 characters"
    ))]
    #[validate(custom(function = "validate_slug"))]
    pub slug: Option<String>,

    #[schema(example = 1)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: Option<i16>,

    #[schema(example = true)]
    pub is_featured: Option<bool>,

    #[schema(example = "2023-03-01")]
    pub start_date: Option<NaiveDate>,

    #[schema(example = "2024-12-31")]
    pub end_date: Option<NaiveDate>,

    #[schema(example = false)]
    pub is_ongoing: Option<bool>,

    #[schema(example = "Published")]
    pub status: Option<ContentStatus>,

    pub localizations: Option<Vec<CreateProjectLocalizationRequest>>,
    pub links: Option<Vec<CreateProjectLinkRequest>>,
    pub media: Option<Vec<ProjectMediaRequest>>,

    #[schema(example = json!(["550e8400-e29b-41d4-a716-446655440000"]))]
    pub skill_ids: Option<Vec<Uuid>>,

    #[schema(example = json!(["770e8400-e29b-41d4-a716-446655440000"]))]
    pub cv_entry_ids: Option<Vec<Uuid>>,
}

/// Project link response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Project link details")]
pub struct ProjectLinkResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "GitHub Repository")]
    pub label: String,
    #[schema(example = "https://github.com/example/project")]
    pub url: String,
    pub link_type: ProjectLinkType,
    #[schema(example = "github")]
    pub icon: Option<String>,
    #[schema(example = 0)]
    pub display_order: i16,
}

impl From<ProjectLink> for ProjectLinkResponse {
    fn from(link: ProjectLink) -> Self {
        Self {
            id: link.id,
            label: link.label,
            url: link.url,
            link_type: link.link_type,
            icon: link.icon,
            display_order: link.display_order,
        }
    }
}

/// Project media item response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Project media attachment")]
pub struct ProjectMediaResponse {
    #[schema(example = "880e8400-e29b-41d4-a716-446655440000")]
    pub media_id: Uuid,
    #[schema(example = 0)]
    pub display_order: i16,
    #[schema(example = false)]
    pub is_cover: bool,
}

impl From<ProjectMediaItem> for ProjectMediaResponse {
    fn from(item: ProjectMediaItem) -> Self {
        Self {
            media_id: item.media_id,
            display_order: item.display_order,
            is_cover: item.is_cover,
        }
    }
}

/// Project localization response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Project localization")]
pub struct ProjectLocalizationResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "660e8400-e29b-41d4-a716-446655440000")]
    pub locale_id: Uuid,
    #[schema(example = "My Awesome Project")]
    pub title: String,
    #[schema(example = "A brief summary of the project")]
    pub short_description: Option<String>,
    #[schema(example = "Full project description with details...")]
    pub description: Option<String>,
}

impl From<ProjectLocalization> for ProjectLocalizationResponse {
    fn from(loc: ProjectLocalization) -> Self {
        Self {
            id: loc.id,
            locale_id: loc.locale_id,
            title: loc.title,
            short_description: loc.short_description,
            description: loc.description,
        }
    }
}

/// Project response (list shape).
///
/// Lightweight: scalar fields + linkage IDs (`skill_ids`) + localized text.
/// Intentionally excludes `links[]` and `media[]` — fetch
/// `GET /projects/{id}` for the full relational graph. See
/// `docs/adr/0001-project-list-detail-asymmetry.md`.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Project list item: scalars + linkage IDs + localized \
    text. For the full relational graph (links, media, cv_entry_ids), use the \
    detail endpoint. The list/detail split is intentional — see \
    docs/adr/0001-project-list-detail-asymmetry.md.")]
pub struct ProjectResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "my-awesome-project")]
    pub slug: String,
    #[schema(example = 0)]
    pub display_order: i16,
    #[schema(example = false)]
    pub is_featured: bool,
    #[schema(example = "2023-01-15")]
    pub start_date: Option<NaiveDate>,
    #[schema(example = "2024-06-30")]
    pub end_date: Option<NaiveDate>,
    #[schema(example = false)]
    pub is_ongoing: bool,
    pub status: ContentStatus,
    #[schema(example = "2024-03-15T12:00:00Z")]
    pub published_at: Option<DateTime<Utc>>,
    #[schema(example = "2024-01-15T10:30:00Z")]
    pub created_at: DateTime<Utc>,
    #[schema(example = "2024-06-01T08:00:00Z")]
    pub updated_at: DateTime<Utc>,
    /// Skill IDs linked to the project. Always present — empty array when
    /// no skills are linked.
    #[schema(example = json!(["550e8400-e29b-41d4-a716-446655440000"]))]
    pub skill_ids: Vec<Uuid>,
    /// Localized title and descriptions. Always present; empty when the
    /// project has no localizations yet (never `null`).
    pub localizations: Vec<ProjectLocalizationResponse>,
}

impl From<ProjectWithContent> for ProjectResponse {
    fn from(project: ProjectWithContent) -> Self {
        Self {
            id: project.id,
            slug: project.slug,
            display_order: project.display_order,
            is_featured: project.is_featured,
            start_date: project.start_date,
            end_date: project.end_date,
            is_ongoing: project.is_ongoing,
            status: project.status,
            published_at: project.published_at,
            created_at: project.created_at,
            updated_at: project.updated_at,
            skill_ids: Vec::new(),
            localizations: Vec::new(),
        }
    }
}

impl ProjectResponse {
    /// Attach the linked skill IDs to this response. Use after constructing
    /// via `From<ProjectWithContent>` to populate the bulk-fetched IDs.
    pub fn with_skill_ids(mut self, skill_ids: Vec<Uuid>) -> Self {
        self.skill_ids = skill_ids;
        self
    }

    /// Attach the per-locale rows to this response. Use after constructing
    /// via `From<ProjectWithContent>` to populate the bulk-fetched rows.
    pub fn with_localizations(mut self, localizations: Vec<ProjectLocalizationResponse>) -> Self {
        self.localizations = localizations;
        self
    }
}

/// Project detail response — adds the relational graph kept off the list
/// endpoint.
///
/// Inherits all list-shape fields from `ProjectResponse` via `#[serde(flatten)]`
/// (`skill_ids`, `localizations`, …), then adds the collections held back from
/// the list for payload-size reasons: `links`, `media`, `cv_entry_ids`. The
/// asymmetry is intentional — see `docs/adr/0001-project-list-detail-asymmetry.md`.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Project detail: list-shape fields (inherited) plus \
    the relational graph held off the list endpoint — links, media, \
    cv_entry_ids. The list/detail split is intentional; see \
    docs/adr/0001-project-list-detail-asymmetry.md.")]
pub struct ProjectDetailResponse {
    #[serde(flatten)]
    pub project: ProjectResponse,
    pub links: Vec<ProjectLinkResponse>,
    pub media: Vec<ProjectMediaResponse>,
    pub cv_entry_ids: Vec<Uuid>,
}

/// Paginated project list response
pub type PaginatedProjects = Paginated<ProjectResponse>;

/// Request to batch-reorder projects
#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, utoipa::ToSchema)]
#[schema(description = "Batch reorder projects")]
pub struct ReorderProjectsRequest {
    #[validate(nested)]
    pub items: Vec<crate::dto::social::ReorderItem>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    fn sample_project_response() -> ProjectResponse {
        ProjectResponse {
            id: Uuid::new_v4(),
            slug: "my-project".to_string(),
            display_order: 0,
            is_featured: true,
            start_date: Some(NaiveDate::from_ymd_opt(2023, 1, 15).unwrap()),
            end_date: None,
            is_ongoing: true,
            status: ContentStatus::Published,
            published_at: Some(Utc::now()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            skill_ids: Vec::new(),
            localizations: Vec::new(),
        }
    }

    #[test]
    fn test_project_response_serialization() {
        let project = sample_project_response();
        let json = serde_json::to_string(&project).unwrap();
        assert!(json.contains("\"slug\":\"my-project\""));
        assert!(json.contains("\"is_featured\":true"));
        assert!(
            json.contains("\"localizations\":[]"),
            "ProjectResponse must always carry localizations[], never null/missing",
        );
    }

    #[test]
    fn test_project_detail_inherits_localizations_via_flatten() {
        let loc = ProjectLocalizationResponse {
            id: Uuid::new_v4(),
            locale_id: Uuid::new_v4(),
            title: "T".to_string(),
            short_description: None,
            description: None,
        };
        let detail = ProjectDetailResponse {
            project: sample_project_response().with_localizations(vec![loc]),
            links: vec![],
            media: vec![],
            cv_entry_ids: vec![],
        };
        let v: serde_json::Value = serde_json::to_value(&detail).unwrap();
        let arr = v
            .get("localizations")
            .and_then(|x| x.as_array())
            .expect("localizations present at flat level via #[serde(flatten)]");
        assert_eq!(
            arr.len(),
            1,
            "no duplication — exactly one localizations array"
        );
    }

    // Issue #738 — list endpoint must surface skill_ids on every item.
    #[test]
    fn project_response_serializes_empty_skill_ids_as_empty_array() {
        let project = sample_project_response();
        let json = serde_json::to_string(&project).unwrap();
        assert!(
            json.contains("\"skill_ids\":[]"),
            "expected skill_ids:[] in JSON, got: {json}"
        );
    }

    #[test]
    fn project_response_serializes_populated_skill_ids() {
        let s1 = Uuid::new_v4();
        let s2 = Uuid::new_v4();
        let mut project = sample_project_response();
        project.skill_ids = vec![s1, s2];
        let json = serde_json::to_string(&project).unwrap();
        assert!(json.contains(&s1.to_string()));
        assert!(json.contains(&s2.to_string()));
    }

    // Issue #738 — skill_ids must not appear twice (would happen if both
    // ProjectResponse and ProjectDetailResponse declared the field while
    // ProjectDetailResponse uses #[serde(flatten)]).
    #[test]
    fn project_detail_response_has_exactly_one_skill_ids_key() {
        let detail = ProjectDetailResponse {
            project: sample_project_response(),
            links: vec![],
            media: vec![],
            cv_entry_ids: vec![],
        };
        let json = serde_json::to_string(&detail).unwrap();
        let occurrences = json.matches("\"skill_ids\"").count();
        assert_eq!(
            occurrences, 1,
            "expected exactly one skill_ids key, got {occurrences} in: {json}"
        );
    }

    // --- CreateProjectRequest validation tests ---

    #[test]
    fn test_create_project_request_valid() {
        let request = CreateProjectRequest {
            slug: "my-awesome-project".to_string(),
            display_order: Some(0),
            is_featured: Some(false),
            start_date: Some(NaiveDate::from_ymd_opt(2023, 1, 15).unwrap()),
            end_date: None,
            is_ongoing: Some(true),
            status: ContentStatus::Draft,
            site_ids: vec![Uuid::new_v4()],
            localizations: None,
            links: None,
            media: None,
            skill_ids: None,
            cv_entry_ids: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_project_request_empty_slug() {
        let request = CreateProjectRequest {
            slug: "".to_string(),
            display_order: None,
            is_featured: None,
            start_date: None,
            end_date: None,
            is_ongoing: None,
            status: ContentStatus::Draft,
            site_ids: vec![Uuid::new_v4()],
            localizations: None,
            links: None,
            media: None,
            skill_ids: None,
            cv_entry_ids: None,
        };
        let result = request.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().field_errors().contains_key("slug"));
    }

    #[test]
    fn test_create_project_request_invalid_slug() {
        let request = CreateProjectRequest {
            slug: "Invalid Slug!".to_string(),
            display_order: None,
            is_featured: None,
            start_date: None,
            end_date: None,
            is_ongoing: None,
            status: ContentStatus::Draft,
            site_ids: vec![Uuid::new_v4()],
            localizations: None,
            links: None,
            media: None,
            skill_ids: None,
            cv_entry_ids: None,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_project_request_empty_site_ids() {
        let request = CreateProjectRequest {
            slug: "valid-slug".to_string(),
            display_order: None,
            is_featured: None,
            start_date: None,
            end_date: None,
            is_ongoing: None,
            status: ContentStatus::Draft,
            site_ids: vec![],
            localizations: None,
            links: None,
            media: None,
            skill_ids: None,
            cv_entry_ids: None,
        };
        let result = request.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().field_errors().contains_key("site_ids"));
    }

    // --- CreateProjectLinkRequest validation tests ---

    #[test]
    fn test_create_project_link_request_valid() {
        let request = CreateProjectLinkRequest {
            label: "GitHub".to_string(),
            url: "https://github.com/example".to_string(),
            link_type: None,
            icon: Some("github".to_string()),
            display_order: Some(0),
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_project_link_request_empty_label() {
        let request = CreateProjectLinkRequest {
            label: "".to_string(),
            url: "https://github.com/example".to_string(),
            link_type: None,
            icon: None,
            display_order: None,
        };
        let result = request.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().field_errors().contains_key("label"));
    }
}
