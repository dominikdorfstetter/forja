//! Document DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::models::document::{BlogDocumentDetail, Document, DocumentFolder, DocumentLocalization};
use crate::utils::pagination::Paginated;
use crate::utils::validation::validate_url;

// ============================================
// FOLDER DTOs
// ============================================

#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Create a document folder")]
pub struct CreateDocumentFolderRequest {
    #[schema(example = "Guides")]
    #[validate(length(
        min = 1,
        max = 200,
        message = "Name must be between 1 and 200 characters"
    ))]
    pub name: String,

    pub parent_id: Option<Uuid>,

    #[schema(example = 0)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: i16,
}

#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update a document folder")]
pub struct UpdateDocumentFolderRequest {
    #[schema(example = "Updated Guides")]
    #[validate(length(
        min = 1,
        max = 200,
        message = "Name must be between 1 and 200 characters"
    ))]
    pub name: Option<String>,

    pub parent_id: Option<Uuid>,

    #[schema(example = 1)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: Option<i16>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Document folder details")]
pub struct DocumentFolderResponse {
    pub id: Uuid,
    pub site_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub name: String,
    pub display_order: i16,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<DocumentFolder> for DocumentFolderResponse {
    fn from(f: DocumentFolder) -> Self {
        Self {
            id: f.id,
            site_id: f.site_id,
            parent_id: f.parent_id,
            name: f.name,
            display_order: f.display_order,
            created_at: f.created_at,
            updated_at: f.updated_at,
        }
    }
}

// ============================================
// DOCUMENT DTOs
// ============================================

#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Create a document (either URL or file upload, not both)")]
pub struct CreateDocumentRequest {
    #[schema(example = "https://example.com/guide.pdf")]
    #[validate(length(
        min = 1,
        max = 2000,
        message = "URL must be between 1 and 2000 characters"
    ))]
    pub url: Option<String>,

    /// Base64-encoded file data (mutually exclusive with url)
    pub file_data: Option<String>,

    /// Original file name (required when file_data is provided)
    pub file_name: Option<String>,

    /// File size in bytes (required when file_data is provided)
    pub file_size: Option<i64>,

    /// MIME type of the file (required when file_data is provided)
    pub mime_type: Option<String>,

    #[schema(example = "pdf")]
    #[validate(length(
        min = 1,
        max = 50,
        message = "Document type must be between 1 and 50 characters"
    ))]
    pub document_type: String,

    pub folder_id: Option<Uuid>,

    #[schema(example = 0)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: i16,
}

impl CreateDocumentRequest {
    /// Custom validation: must have url XOR file_data.
    /// `max_file_size` is the per-site configurable limit in bytes.
    pub fn validate_source(&self, max_file_size: i64) -> Result<(), String> {
        let has_url = self.url.is_some();
        let has_file = self.file_data.is_some();

        if !has_url && !has_file {
            return Err("Either 'url' or 'file_data' must be provided".to_string());
        }
        if has_url && has_file {
            return Err("Cannot provide both 'url' and 'file_data'".to_string());
        }

        if has_url {
            if let Some(ref url) = self.url {
                validate_url(url).map_err(|e| e.message.unwrap_or_default().to_string())?;
            }
        }

        if has_file {
            if self.file_name.is_none() {
                return Err("'file_name' is required when uploading a file".to_string());
            }
            if self.file_size.is_none() {
                return Err("'file_size' is required when uploading a file".to_string());
            }
            if self.mime_type.is_none() {
                return Err("'mime_type' is required when uploading a file".to_string());
            }
            if let Some(size) = self.file_size {
                if size <= 0 {
                    return Err("'file_size' must be positive".to_string());
                }
                if size > max_file_size {
                    return Err(format!(
                        "File size ({} bytes) exceeds site maximum of {} bytes",
                        size, max_file_size
                    ));
                }
            }
        }

        Ok(())
    }
}

#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update a document")]
pub struct UpdateDocumentRequest {
    #[schema(example = "https://example.com/updated-guide.pdf")]
    #[validate(length(
        min = 1,
        max = 2000,
        message = "URL must be between 1 and 2000 characters"
    ))]
    pub url: Option<String>,

    /// Base64-encoded file data (replaces existing file or switches from URL to file)
    pub file_data: Option<String>,

    /// Original file name (required when file_data is provided)
    pub file_name: Option<String>,

    /// File size in bytes (required when file_data is provided)
    pub file_size: Option<i64>,

    /// MIME type of the file (required when file_data is provided)
    pub mime_type: Option<String>,

    #[schema(example = "pdf")]
    #[validate(length(
        min = 1,
        max = 50,
        message = "Document type must be between 1 and 50 characters"
    ))]
    pub document_type: Option<String>,

    pub folder_id: Option<Uuid>,

    #[schema(example = 1)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    pub display_order: Option<i16>,
}

impl UpdateDocumentRequest {
    /// Custom validation for update.
    /// `max_file_size` is the per-site configurable limit in bytes.
    pub fn validate_source(&self, max_file_size: i64) -> Result<(), String> {
        let has_url = self.url.is_some();
        let has_file = self.file_data.is_some();

        if has_url && has_file {
            return Err("Cannot provide both 'url' and 'file_data'".to_string());
        }

        if has_url {
            if let Some(ref url) = self.url {
                validate_url(url).map_err(|e| e.message.unwrap_or_default().to_string())?;
            }
        }

        if has_file {
            if self.file_name.is_none() {
                return Err("'file_name' is required when uploading a file".to_string());
            }
            if self.file_size.is_none() {
                return Err("'file_size' is required when uploading a file".to_string());
            }
            if self.mime_type.is_none() {
                return Err("'mime_type' is required when uploading a file".to_string());
            }
            if let Some(size) = self.file_size {
                if size <= 0 {
                    return Err("'file_size' must be positive".to_string());
                }
                if size > max_file_size {
                    return Err(format!(
                        "File size ({} bytes) exceeds site maximum of {} bytes",
                        size, max_file_size
                    ));
                }
            }
        }

        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Document details")]
pub struct DocumentResponse {
    pub id: Uuid,
    pub site_id: Uuid,
    pub folder_id: Option<Uuid>,
    pub url: Option<String>,
    pub document_type: String,
    pub display_order: i16,
    pub file_name: Option<String>,
    pub file_size: Option<i64>,
    pub mime_type: Option<String>,
    pub has_file: bool,
    pub localizations: Vec<DocumentLocalizationResponse>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl DocumentResponse {
    pub fn from_parts(doc: Document, localizations: Vec<DocumentLocalization>) -> Self {
        let has_file = doc.file_name.is_some();
        Self {
            id: doc.id,
            site_id: doc.site_id,
            folder_id: doc.folder_id,
            url: doc.url,
            document_type: doc.document_type,
            display_order: doc.display_order,
            file_name: doc.file_name,
            file_size: doc.file_size,
            mime_type: doc.mime_type,
            has_file,
            localizations: localizations
                .into_iter()
                .map(DocumentLocalizationResponse::from)
                .collect(),
            created_at: doc.created_at,
            updated_at: doc.updated_at,
        }
    }
}

/// Simpler document list item (without localizations)
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Document summary for lists")]
pub struct DocumentListItem {
    pub id: Uuid,
    pub site_id: Uuid,
    pub folder_id: Option<Uuid>,
    pub url: Option<String>,
    pub document_type: String,
    pub display_order: i16,
    pub file_name: Option<String>,
    pub file_size: Option<i64>,
    pub mime_type: Option<String>,
    pub has_file: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Document> for DocumentListItem {
    fn from(doc: Document) -> Self {
        let has_file = doc.file_name.is_some();
        Self {
            id: doc.id,
            site_id: doc.site_id,
            folder_id: doc.folder_id,
            url: doc.url,
            document_type: doc.document_type,
            display_order: doc.display_order,
            file_name: doc.file_name,
            file_size: doc.file_size,
            mime_type: doc.mime_type,
            has_file,
            created_at: doc.created_at,
            updated_at: doc.updated_at,
        }
    }
}

// ============================================
// LOCALIZATION DTOs
// ============================================

#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Create a document localization")]
pub struct CreateDocumentLocalizationRequest {
    pub locale_id: Uuid,

    #[schema(example = "Getting Started Guide")]
    #[validate(length(
        min = 1,
        max = 500,
        message = "Name must be between 1 and 500 characters"
    ))]
    pub name: String,

    #[schema(example = "A comprehensive guide to getting started")]
    #[validate(length(max = 2000, message = "Description cannot exceed 2000 characters"))]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update a document localization")]
pub struct UpdateDocumentLocalizationRequest {
    #[schema(example = "Updated Guide Name")]
    #[validate(length(
        min = 1,
        max = 500,
        message = "Name must be between 1 and 500 characters"
    ))]
    pub name: Option<String>,

    #[schema(example = "Updated description")]
    #[validate(length(max = 2000, message = "Description cannot exceed 2000 characters"))]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Document localization details")]
pub struct DocumentLocalizationResponse {
    pub id: Uuid,
    pub document_id: Uuid,
    pub locale_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<DocumentLocalization> for DocumentLocalizationResponse {
    fn from(loc: DocumentLocalization) -> Self {
        Self {
            id: loc.id,
            document_id: loc.document_id,
            locale_id: loc.locale_id,
            name: loc.name,
            description: loc.description,
            created_at: loc.created_at,
            updated_at: loc.updated_at,
        }
    }
}

// ============================================
// BLOG-DOCUMENT DTOs
// ============================================

#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Assign a document to a blog")]
pub struct AssignBlogDocumentRequest {
    pub document_id: Uuid,

    #[schema(example = 0)]
    #[validate(range(
        min = 0,
        max = 9999,
        message = "Display order must be between 0 and 9999"
    ))]
    #[serde(default)]
    pub display_order: i16,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Blog document attachment details")]
pub struct BlogDocumentResponse {
    pub id: Uuid,
    pub blog_id: Uuid,
    pub document_id: Uuid,
    pub display_order: i16,
    pub url: Option<String>,
    pub document_type: String,
    pub file_name: Option<String>,
    pub has_file: bool,
    pub localizations: Vec<DocumentLocalizationResponse>,
    pub created_at: DateTime<Utc>,
}

impl BlogDocumentResponse {
    pub fn from_parts(
        detail: BlogDocumentDetail,
        localizations: Vec<DocumentLocalization>,
    ) -> Self {
        Self {
            id: detail.id,
            blog_id: detail.blog_id,
            document_id: detail.document_id,
            display_order: detail.display_order,
            url: detail.url,
            document_type: detail.document_type,
            file_name: detail.file_name,
            has_file: detail.has_file,
            localizations: localizations
                .into_iter()
                .map(DocumentLocalizationResponse::from)
                .collect(),
            created_at: detail.created_at,
        }
    }
}

/// Paginated document list response
pub type PaginatedDocuments = Paginated<DocumentListItem>;

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    const TEST_MAX_FILE_SIZE: i64 = 10 * 1024 * 1024; // 10 MB default

    #[test]
    fn test_create_document_request_valid_url() {
        let request = CreateDocumentRequest {
            url: Some("https://example.com/guide.pdf".to_string()),
            file_data: None,
            file_name: None,
            file_size: None,
            mime_type: None,
            document_type: "pdf".to_string(),
            folder_id: None,
            display_order: 0,
        };
        assert!(request.validate().is_ok());
        assert!(request.validate_source(TEST_MAX_FILE_SIZE).is_ok());
    }

    #[test]
    fn test_create_document_request_valid_file() {
        let request = CreateDocumentRequest {
            url: None,
            file_data: Some("SGVsbG8=".to_string()),
            file_name: Some("test.pdf".to_string()),
            file_size: Some(5),
            mime_type: Some("application/pdf".to_string()),
            document_type: "pdf".to_string(),
            folder_id: None,
            display_order: 0,
        };
        assert!(request.validate().is_ok());
        assert!(request.validate_source(TEST_MAX_FILE_SIZE).is_ok());
    }

    #[test]
    fn test_create_document_request_neither_url_nor_file() {
        let request = CreateDocumentRequest {
            url: None,
            file_data: None,
            file_name: None,
            file_size: None,
            mime_type: None,
            document_type: "pdf".to_string(),
            folder_id: None,
            display_order: 0,
        };
        assert!(request.validate_source(TEST_MAX_FILE_SIZE).is_err());
    }

    #[test]
    fn test_create_document_request_both_url_and_file() {
        let request = CreateDocumentRequest {
            url: Some("https://example.com/doc.pdf".to_string()),
            file_data: Some("SGVsbG8=".to_string()),
            file_name: Some("test.pdf".to_string()),
            file_size: Some(5),
            mime_type: Some("application/pdf".to_string()),
            document_type: "pdf".to_string(),
            folder_id: None,
            display_order: 0,
        };
        assert!(request.validate_source(TEST_MAX_FILE_SIZE).is_err());
    }

    #[test]
    fn test_create_document_request_file_too_large() {
        let request = CreateDocumentRequest {
            url: None,
            file_data: Some("SGVsbG8=".to_string()),
            file_name: Some("huge.pdf".to_string()),
            file_size: Some(11 * 1024 * 1024), // 11 MB
            mime_type: Some("application/pdf".to_string()),
            document_type: "pdf".to_string(),
            folder_id: None,
            display_order: 0,
        };
        assert!(request.validate_source(TEST_MAX_FILE_SIZE).is_err());
    }

    #[test]
    fn test_create_document_request_file_within_custom_limit() {
        let request = CreateDocumentRequest {
            url: None,
            file_data: Some("SGVsbG8=".to_string()),
            file_name: Some("big.pdf".to_string()),
            file_size: Some(15 * 1024 * 1024), // 15 MB
            mime_type: Some("application/pdf".to_string()),
            document_type: "pdf".to_string(),
            folder_id: None,
            display_order: 0,
        };
        // 15 MB exceeds default 10 MB limit
        assert!(request.validate_source(TEST_MAX_FILE_SIZE).is_err());
        // But passes with a 20 MB custom limit
        assert!(request.validate_source(20 * 1024 * 1024).is_ok());
    }

    #[test]
    fn test_create_document_request_file_missing_fields() {
        let request = CreateDocumentRequest {
            url: None,
            file_data: Some("SGVsbG8=".to_string()),
            file_name: None,
            file_size: None,
            mime_type: None,
            document_type: "pdf".to_string(),
            folder_id: None,
            display_order: 0,
        };
        assert!(request.validate_source(TEST_MAX_FILE_SIZE).is_err());
    }

    #[test]
    fn test_create_document_request_invalid_url() {
        let request = CreateDocumentRequest {
            url: Some("not-a-url".to_string()),
            file_data: None,
            file_name: None,
            file_size: None,
            mime_type: None,
            document_type: "pdf".to_string(),
            folder_id: None,
            display_order: 0,
        };
        assert!(request.validate_source(TEST_MAX_FILE_SIZE).is_err());
    }

    #[test]
    fn test_create_document_request_empty_type() {
        let request = CreateDocumentRequest {
            url: Some("https://example.com/doc.pdf".to_string()),
            file_data: None,
            file_name: None,
            file_size: None,
            mime_type: None,
            document_type: "".to_string(),
            folder_id: None,
            display_order: 0,
        };
        assert!(request.validate().is_err());
    }

    #[test]
    fn test_create_folder_request_valid() {
        let request = CreateDocumentFolderRequest {
            name: "Guides".to_string(),
            parent_id: None,
            display_order: 0,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_localization_request_valid() {
        let request = CreateDocumentLocalizationRequest {
            locale_id: Uuid::new_v4(),
            name: "Getting Started".to_string(),
            description: Some("A guide to getting started".to_string()),
        };
        assert!(request.validate().is_ok());
    }
}
