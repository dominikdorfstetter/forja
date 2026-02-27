//! Legal DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use validator::Validate;

use crate::models::content::ContentStatus;
use crate::models::legal::{LegalDocType, LegalDocument, LegalGroup, LegalItem};
use crate::utils::pagination::Paginated;

/// Request to create a legal document
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Create a legal document")]
pub struct CreateLegalDocumentRequest {
    #[schema(example = "cookie_consent")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Cookie name must be between 1 and 100 characters"
    ))]
    pub cookie_name: String,

    #[schema(example = "CookieConsent")]
    pub document_type: LegalDocType,

    #[serde(default)]
    pub status: ContentStatus,

    /// Site IDs to associate this legal document with
    #[validate(length(min = 1, message = "At least one site ID is required"))]
    pub site_ids: Vec<Uuid>,
}

/// Request to update a legal document
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update a legal document")]
pub struct UpdateLegalDocumentRequest {
    #[schema(example = "cookie_consent_v2")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Cookie name must be between 1 and 100 characters"
    ))]
    pub cookie_name: Option<String>,

    pub document_type: Option<LegalDocType>,

    pub status: Option<ContentStatus>,
}

/// Request to create a legal group
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Create a legal consent group")]
pub struct CreateLegalGroupRequest {
    #[schema(example = "analytics_cookies")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Cookie name must be between 1 and 100 characters"
    ))]
    pub cookie_name: String,

    #[schema(example = 1)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: i16,

    #[schema(example = false)]
    #[serde(default)]
    pub is_required: bool,

    #[schema(example = false)]
    #[serde(default)]
    pub default_enabled: bool,
}

/// Request to update a legal group
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update a legal consent group")]
pub struct UpdateLegalGroupRequest {
    #[schema(example = "analytics_cookies_v2")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Cookie name must be between 1 and 100 characters"
    ))]
    pub cookie_name: Option<String>,

    #[schema(example = 2)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: Option<i16>,

    #[schema(example = false)]
    pub is_required: Option<bool>,

    #[schema(example = true)]
    pub default_enabled: Option<bool>,
}

/// Request to create a legal item
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Create a legal consent item")]
pub struct CreateLegalItemRequest {
    #[schema(example = "google_analytics")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Cookie name must be between 1 and 100 characters"
    ))]
    pub cookie_name: String,

    #[schema(example = 0)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: i16,

    #[schema(example = false)]
    #[serde(default)]
    pub is_required: bool,
}

/// Request to update a legal item
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update a legal consent item")]
pub struct UpdateLegalItemRequest {
    #[schema(example = "google_analytics_v2")]
    #[validate(length(
        min = 1,
        max = 100,
        message = "Cookie name must be between 1 and 100 characters"
    ))]
    pub cookie_name: Option<String>,

    #[schema(example = 1)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: Option<i16>,

    #[schema(example = false)]
    pub is_required: Option<bool>,
}

/// Legal document response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Legal document details")]
pub struct LegalDocumentResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "cookie_consent")]
    pub cookie_name: String,
    #[schema(example = "CookieConsent")]
    pub document_type: LegalDocType,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<LegalDocument> for LegalDocumentResponse {
    fn from(doc: LegalDocument) -> Self {
        Self {
            id: doc.id,
            cookie_name: doc.cookie_name,
            document_type: doc.document_type,
            created_at: doc.created_at,
            updated_at: doc.updated_at,
        }
    }
}

/// Legal group response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Legal group details")]
pub struct LegalGroupResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "analytics_cookies")]
    pub cookie_name: String,
    #[schema(example = 1)]
    pub display_order: i16,
    #[schema(example = false)]
    pub is_required: bool,
    #[schema(example = false)]
    pub default_enabled: bool,
}

impl From<LegalGroup> for LegalGroupResponse {
    fn from(group: LegalGroup) -> Self {
        Self {
            id: group.id,
            cookie_name: group.cookie_name,
            display_order: group.display_order,
            is_required: group.is_required,
            default_enabled: group.default_enabled,
        }
    }
}

/// Legal item response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Legal item details")]
pub struct LegalItemResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "google_analytics")]
    pub cookie_name: String,
    #[schema(example = 0)]
    pub display_order: i16,
    #[schema(example = false)]
    pub is_required: bool,
}

impl From<LegalItem> for LegalItemResponse {
    fn from(item: LegalItem) -> Self {
        Self {
            id: item.id,
            cookie_name: item.cookie_name,
            display_order: item.display_order,
            is_required: item.is_required,
        }
    }
}

/// Full legal document with groups and items
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Legal document with groups and items")]
pub struct LegalDocumentWithGroups {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "cookie_consent")]
    pub cookie_name: String,
    #[schema(example = "CookieConsent")]
    pub document_type: LegalDocType,
    pub groups: Vec<LegalGroupWithItems>,
}

/// Legal group with items
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Legal group with items")]
pub struct LegalGroupWithItems {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "analytics_cookies")]
    pub cookie_name: String,
    #[schema(example = 1)]
    pub display_order: i16,
    #[schema(example = false)]
    pub is_required: bool,
    #[schema(example = false)]
    pub default_enabled: bool,
    pub items: Vec<LegalItemResponse>,
}

/// Legal document localization response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Legal document localization")]
pub struct LegalDocLocalizationResponse {
    pub id: Uuid,
    pub locale_id: Uuid,
    pub title: String,
    pub intro: Option<String>,
}

/// Legal document detail with localizations (for frontend rendering)
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Legal document with localizations")]
pub struct LegalDocumentDetailResponse {
    pub id: Uuid,
    pub cookie_name: String,
    pub document_type: LegalDocType,
    pub localizations: Vec<LegalDocLocalizationResponse>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Paginated legal document list response
pub type PaginatedLegalDocuments = Paginated<LegalDocumentResponse>;

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_legal_document_response_serialization() {
        let doc = LegalDocumentResponse {
            id: Uuid::new_v4(),
            cookie_name: "cookie_consent".to_string(),
            document_type: LegalDocType::CookieConsent,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&doc).unwrap();
        assert!(json.contains("\"document_type\":\"CookieConsent\""));
    }

    // --- CreateLegalDocumentRequest validation tests ---

    #[test]
    fn test_create_legal_document_valid() {
        let request = CreateLegalDocumentRequest {
            cookie_name: "cookie_consent".to_string(),
            document_type: LegalDocType::CookieConsent,
            status: ContentStatus::Draft,
            site_ids: vec![Uuid::new_v4()],
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_legal_document_empty_cookie_name() {
        let request = CreateLegalDocumentRequest {
            cookie_name: "".to_string(),
            document_type: LegalDocType::CookieConsent,
            status: ContentStatus::Draft,
            site_ids: vec![Uuid::new_v4()],
        };
        let result = request.validate();
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .field_errors()
            .contains_key("cookie_name"));
    }

    #[test]
    fn test_create_legal_document_cookie_name_too_long() {
        let request = CreateLegalDocumentRequest {
            cookie_name: "a".repeat(101),
            document_type: LegalDocType::CookieConsent,
            status: ContentStatus::Draft,
            site_ids: vec![Uuid::new_v4()],
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_legal_document_empty_site_ids() {
        let request = CreateLegalDocumentRequest {
            cookie_name: "cookie_consent".to_string(),
            document_type: LegalDocType::CookieConsent,
            status: ContentStatus::Draft,
            site_ids: vec![],
        };
        let result = request.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().field_errors().contains_key("site_ids"));
    }

    // --- UpdateLegalDocumentRequest validation tests ---

    #[test]
    fn test_update_legal_document_valid() {
        let request = UpdateLegalDocumentRequest {
            cookie_name: Some("cookie_consent_v2".to_string()),
            document_type: None,
            status: Some(ContentStatus::Published),
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_update_legal_document_all_none() {
        let request = UpdateLegalDocumentRequest {
            cookie_name: None,
            document_type: None,
            status: None,
        };
        assert!(request.validate().is_ok());
    }

    // --- CreateLegalGroupRequest validation tests ---

    #[test]
    fn test_create_legal_group_valid() {
        let request = CreateLegalGroupRequest {
            cookie_name: "analytics_cookies".to_string(),
            display_order: 1,
            is_required: false,
            default_enabled: false,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_legal_group_empty_cookie_name() {
        let request = CreateLegalGroupRequest {
            cookie_name: "".to_string(),
            display_order: 0,
            is_required: false,
            default_enabled: false,
        };
        let result = request.validate();
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .field_errors()
            .contains_key("cookie_name"));
    }

    #[test]
    fn test_create_legal_group_display_order_out_of_range() {
        let request = CreateLegalGroupRequest {
            cookie_name: "analytics_cookies".to_string(),
            display_order: 10000,
            is_required: false,
            default_enabled: false,
        };
        assert!(request.validate().is_err());
    }

    // --- UpdateLegalGroupRequest validation tests ---

    #[test]
    fn test_update_legal_group_valid() {
        let request = UpdateLegalGroupRequest {
            cookie_name: Some("updated_cookies".to_string()),
            display_order: Some(2),
            is_required: None,
            default_enabled: Some(true),
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_update_legal_group_all_none() {
        let request = UpdateLegalGroupRequest {
            cookie_name: None,
            display_order: None,
            is_required: None,
            default_enabled: None,
        };
        assert!(request.validate().is_ok());
    }

    // --- CreateLegalItemRequest validation tests ---

    #[test]
    fn test_create_legal_item_valid() {
        let request = CreateLegalItemRequest {
            cookie_name: "google_analytics".to_string(),
            display_order: 0,
            is_required: false,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_legal_item_empty_cookie_name() {
        let request = CreateLegalItemRequest {
            cookie_name: "".to_string(),
            display_order: 0,
            is_required: false,
        };
        let result = request.validate();
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .field_errors()
            .contains_key("cookie_name"));
    }

    #[test]
    fn test_create_legal_item_display_order_out_of_range() {
        let request = CreateLegalItemRequest {
            cookie_name: "google_analytics".to_string(),
            display_order: -1,
            is_required: false,
        };
        assert!(request.validate().is_err());
    }

    // --- UpdateLegalItemRequest validation tests ---

    #[test]
    fn test_update_legal_item_valid() {
        let request = UpdateLegalItemRequest {
            cookie_name: Some("google_analytics_v2".to_string()),
            display_order: Some(1),
            is_required: Some(false),
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_update_legal_item_all_none() {
        let request = UpdateLegalItemRequest {
            cookie_name: None,
            display_order: None,
            is_required: None,
        };
        assert!(request.validate().is_ok());
    }
}
