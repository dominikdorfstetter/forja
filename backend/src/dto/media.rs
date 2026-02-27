//! Media DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::models::media::{
    MediaFile, MediaVariant, MediaVariantType, MediaWithVariants, StorageProvider,
};
use crate::utils::pagination::Paginated;
use crate::utils::validation::validate_url;

/// Allowed MIME types for media upload
pub const ALL_ALLOWED_MIMES: &[&str] = &[
    // Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/avif",
    "image/svg+xml",
    // Documents
    "application/pdf",
    "text/plain",
    "text/markdown",
    // Videos
    "video/mp4",
    "video/webm",
    // Audio
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
];

/// Maximum file size (50MB)
pub const MAX_FILE_SIZE: i64 = 50 * 1024 * 1024;

/// Request to upload media
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Upload media file")]
pub struct UploadMediaRequest {
    #[schema(example = "hero-banner.jpg")]
    #[validate(length(
        min = 1,
        max = 255,
        message = "Filename must be between 1 and 255 characters"
    ))]
    pub filename: String,

    #[schema(example = "my-photo.jpg")]
    #[validate(length(
        min = 1,
        max = 255,
        message = "Original filename must be between 1 and 255 characters"
    ))]
    pub original_filename: String,

    #[schema(example = "image/jpeg")]
    #[validate(custom(function = "validate_mime_type"))]
    pub mime_type: String,

    #[schema(example = 1024000)]
    #[validate(range(
        min = 1,
        max = 52428800,
        message = "File size must be between 1 byte and 50MB"
    ))]
    pub file_size: i64,

    #[serde(default)]
    pub storage_provider: StorageProvider,

    #[schema(example = "/uploads/2024/hero-banner.jpg")]
    #[validate(length(
        min = 1,
        max = 1000,
        message = "Storage path must be between 1 and 1000 characters"
    ))]
    pub storage_path: String,

    #[schema(example = "https://cdn.example.com/hero-banner.jpg")]
    #[validate(length(max = 2000, message = "Public URL cannot exceed 2000 characters"))]
    #[validate(custom(function = "validate_url"))]
    pub public_url: Option<String>,

    #[schema(example = 1920)]
    #[validate(range(min = 1, max = 32767, message = "Width must be between 1 and 32767"))]
    pub width: Option<i16>,

    #[schema(example = 1080)]
    #[validate(range(min = 1, max = 32767, message = "Height must be between 1 and 32767"))]
    pub height: Option<i16>,

    #[schema(example = 120)]
    #[validate(range(
        min = 0,
        max = 86400,
        message = "Duration must be between 0 and 86400 seconds"
    ))]
    pub duration: Option<i32>,

    #[schema(example = false)]
    #[serde(default)]
    pub is_global: bool,

    /// Folder to place media file in
    pub folder_id: Option<Uuid>,

    /// Site IDs to associate this media with
    #[validate(length(min = 1, message = "At least one site ID is required"))]
    pub site_ids: Vec<Uuid>,
}

/// Validate MIME type is in allowed list
fn validate_mime_type(mime: &str) -> Result<(), validator::ValidationError> {
    if !ALL_ALLOWED_MIMES.contains(&mime) {
        let mut err = validator::ValidationError::new("invalid_mime_type");
        err.message = Some(format!("MIME type '{}' is not allowed", mime).into());
        return Err(err);
    }
    Ok(())
}

/// Request to update media metadata
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update media metadata")]
pub struct UpdateMediaRequest {
    #[schema(example = "updated-banner.jpg")]
    #[validate(length(
        min = 1,
        max = 255,
        message = "Filename must be between 1 and 255 characters"
    ))]
    pub filename: Option<String>,

    #[schema(example = "https://cdn.example.com/updated-banner.jpg")]
    #[validate(length(max = 2000, message = "Public URL cannot exceed 2000 characters"))]
    #[validate(custom(function = "validate_url"))]
    pub public_url: Option<String>,

    #[schema(example = true)]
    pub is_global: Option<bool>,

    /// Folder to place media file in
    pub folder_id: Option<Uuid>,
}

/// Request to add media metadata (alt text, caption, etc.)
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Add media metadata")]
pub struct AddMediaMetadataRequest {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub locale_id: Uuid,

    #[schema(example = "A beautiful sunset over the ocean")]
    #[validate(length(max = 500, message = "Alt text cannot exceed 500 characters"))]
    pub alt_text: Option<String>,

    #[schema(example = "Photo taken in Hawaii, 2024")]
    #[validate(length(max = 1000, message = "Caption cannot exceed 1000 characters"))]
    pub caption: Option<String>,

    #[schema(example = "Sunset")]
    #[validate(length(max = 200, message = "Title cannot exceed 200 characters"))]
    pub title: Option<String>,
}

/// Request to update media metadata
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update media metadata")]
pub struct UpdateMediaMetadataRequest {
    #[schema(example = "Updated alt text")]
    #[validate(length(max = 500, message = "Alt text cannot exceed 500 characters"))]
    pub alt_text: Option<String>,

    #[schema(example = "Updated caption")]
    #[validate(length(max = 1000, message = "Caption cannot exceed 1000 characters"))]
    pub caption: Option<String>,

    #[schema(example = "Updated Title")]
    #[validate(length(max = 200, message = "Title cannot exceed 200 characters"))]
    pub title: Option<String>,
}

/// Media metadata response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Media metadata per locale")]
pub struct MediaMetadataResponse {
    pub id: Uuid,
    pub locale_id: Uuid,
    pub alt_text: Option<String>,
    pub caption: Option<String>,
    pub title: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<crate::models::media::MediaMetadata> for MediaMetadataResponse {
    fn from(m: crate::models::media::MediaMetadata) -> Self {
        Self {
            id: m.id,
            locale_id: m.locale_id,
            alt_text: m.alt_text,
            caption: m.caption,
            title: m.title,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

/// Media list item response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Media file summary for lists")]
pub struct MediaListItem {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "hero-banner.jpg")]
    pub filename: String,
    #[schema(example = "my-photo.jpg")]
    pub original_filename: String,
    #[schema(example = "image/jpeg")]
    pub mime_type: String,
    #[schema(example = 1024000)]
    pub file_size: i64,
    #[schema(example = "https://cdn.example.com/hero-banner.jpg")]
    pub public_url: Option<String>,
    #[schema(example = 1920)]
    pub width: Option<i16>,
    #[schema(example = 1080)]
    pub height: Option<i16>,
    #[schema(example = false)]
    pub is_global: bool,
    pub folder_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

impl From<MediaFile> for MediaListItem {
    fn from(media: MediaFile) -> Self {
        Self {
            id: media.id,
            filename: media.filename,
            original_filename: media.original_filename,
            mime_type: media.mime_type,
            file_size: media.file_size,
            public_url: media.public_url,
            width: media.width,
            height: media.height,
            is_global: media.is_global,
            folder_id: media.folder_id,
            created_at: media.created_at,
        }
    }
}

/// Media variant response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Media variant details")]
pub struct MediaVariantResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "Thumbnail")]
    pub variant_name: MediaVariantType,
    #[schema(example = 150)]
    pub width: i16,
    #[schema(example = 150)]
    pub height: i16,
    #[schema(example = 10240)]
    pub file_size: i32,
    #[schema(example = "https://cdn.example.com/thumb.jpg")]
    pub public_url: Option<String>,
}

impl From<MediaVariant> for MediaVariantResponse {
    fn from(variant: MediaVariant) -> Self {
        Self {
            id: variant.id,
            variant_name: variant.variant_name,
            width: variant.width,
            height: variant.height,
            file_size: variant.file_size,
            public_url: variant.public_url,
        }
    }
}

/// Full media response with variants
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Full media file with variants")]
pub struct MediaResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "hero-banner.jpg")]
    pub filename: String,
    #[schema(example = "my-photo.jpg")]
    pub original_filename: String,
    #[schema(example = "image/jpeg")]
    pub mime_type: String,
    #[schema(example = 1024000)]
    pub file_size: i64,
    pub storage_provider: StorageProvider,
    #[schema(example = "https://cdn.example.com/hero-banner.jpg")]
    pub public_url: Option<String>,
    #[schema(example = 1920)]
    pub width: Option<i16>,
    #[schema(example = 1080)]
    pub height: Option<i16>,
    #[schema(example = 120)]
    pub duration: Option<i32>,
    #[schema(example = false)]
    pub is_global: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub variants: Vec<MediaVariantResponse>,
}

impl From<MediaWithVariants> for MediaResponse {
    fn from(media: MediaWithVariants) -> Self {
        Self {
            id: media.id,
            filename: media.filename,
            original_filename: media.original_filename,
            mime_type: media.mime_type,
            file_size: media.file_size,
            storage_provider: media.storage_provider,
            public_url: media.public_url,
            width: media.width,
            height: media.height,
            duration: media.duration,
            is_global: media.is_global,
            created_at: media.created_at,
            updated_at: media.updated_at,
            variants: media
                .variants
                .into_iter()
                .map(MediaVariantResponse::from)
                .collect(),
        }
    }
}

/// Paginated media list response
pub type PaginatedMedia = Paginated<MediaListItem>;

/// Search/filter parameters for the media list endpoint
#[derive(Debug, Clone, Default)]
pub struct MediaSearchParams {
    pub search: Option<String>,
    pub mime_category: Option<String>,
    pub folder_id: Option<Uuid>,
}

impl MediaSearchParams {
    /// Wraps the search term in `%…%` for ILIKE queries.
    pub fn search_pattern(&self) -> Option<String> {
        self.search
            .as_deref()
            .filter(|s| !s.is_empty())
            .map(|s| format!("%{}%", s))
    }

    /// Converts a human-friendly category ("image", "video", "audio", "document")
    /// into a SQL LIKE prefix such as `image/%`.
    /// "document" maps to `application/%` so PDFs etc. are included.
    pub fn mime_prefix(&self) -> Option<String> {
        self.mime_category.as_deref().map(|c| match c {
            "document" => "application/%".to_string(),
            other => format!("{}/%", other),
        })
    }

    /// Returns true when no filters are set (plain list).
    pub fn has_filters(&self) -> bool {
        self.search_pattern().is_some() || self.mime_prefix().is_some() || self.folder_id.is_some()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_upload_media_request_valid() {
        let request = UploadMediaRequest {
            filename: "image.jpg".to_string(),
            original_filename: "my-photo.jpg".to_string(),
            mime_type: "image/jpeg".to_string(),
            file_size: 1024000,
            storage_provider: StorageProvider::Local,
            storage_path: "/uploads/2024/image.jpg".to_string(),
            public_url: Some("https://cdn.example.com/image.jpg".to_string()),
            width: Some(1920),
            height: Some(1080),
            duration: None,
            is_global: false,
            site_ids: vec![Uuid::new_v4()],
            folder_id: None,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_upload_media_request_invalid_mime() {
        let request = UploadMediaRequest {
            filename: "malware.exe".to_string(),
            original_filename: "totally-safe.exe".to_string(),
            mime_type: "application/x-executable".to_string(),
            file_size: 1024,
            storage_provider: StorageProvider::Local,
            storage_path: "/uploads/malware.exe".to_string(),
            public_url: None,
            width: None,
            height: None,
            duration: None,
            is_global: false,
            site_ids: vec![Uuid::new_v4()],
            folder_id: None,
        };
        let result = request.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_upload_media_request_file_too_large() {
        let request = UploadMediaRequest {
            filename: "huge.mp4".to_string(),
            original_filename: "huge-video.mp4".to_string(),
            mime_type: "video/mp4".to_string(),
            file_size: 100 * 1024 * 1024, // 100MB - too large
            storage_provider: StorageProvider::Local,
            storage_path: "/uploads/huge.mp4".to_string(),
            public_url: None,
            width: None,
            height: None,
            duration: None,
            is_global: false,
            site_ids: vec![Uuid::new_v4()],
            folder_id: None,
        };
        let result = request.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_upload_media_request_no_sites() {
        let request = UploadMediaRequest {
            filename: "image.jpg".to_string(),
            original_filename: "my-photo.jpg".to_string(),
            mime_type: "image/jpeg".to_string(),
            file_size: 1024,
            storage_provider: StorageProvider::Local,
            storage_path: "/uploads/image.jpg".to_string(),
            public_url: None,
            width: None,
            height: None,
            duration: None,
            is_global: false,
            site_ids: vec![],
            folder_id: None,
        };
        let result = request.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_add_media_metadata_request_valid() {
        let request = AddMediaMetadataRequest {
            locale_id: Uuid::new_v4(),
            alt_text: Some("A beautiful sunset".to_string()),
            caption: Some("Photo taken in Hawaii".to_string()),
            title: Some("Sunset".to_string()),
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_media_list_item_serialization() {
        let item = MediaListItem {
            id: Uuid::new_v4(),
            filename: "image.jpg".to_string(),
            original_filename: "my-photo.jpg".to_string(),
            mime_type: "image/jpeg".to_string(),
            file_size: 1024000,
            public_url: Some("https://cdn.example.com/image.jpg".to_string()),
            width: Some(1920),
            height: Some(1080),
            is_global: false,
            created_at: Utc::now(),
            folder_id: None,
        };

        let json = serde_json::to_string(&item).unwrap();
        assert!(json.contains("\"mime_type\":\"image/jpeg\""));
        assert!(json.contains("\"width\":1920"));
    }

    #[test]
    fn test_media_variant_response_serialization() {
        let variant = MediaVariantResponse {
            id: Uuid::new_v4(),
            variant_name: MediaVariantType::Thumbnail,
            width: 150,
            height: 150,
            file_size: 10240,
            public_url: Some("https://cdn.example.com/thumb.jpg".to_string()),
        };

        let json = serde_json::to_string(&variant).unwrap();
        assert!(json.contains("\"variant_name\":\"Thumbnail\""));
    }
}
