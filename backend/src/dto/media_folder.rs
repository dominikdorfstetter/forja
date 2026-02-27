//! Media folder DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::models::media_folder::MediaFolder;

#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Create a media folder")]
pub struct CreateMediaFolderRequest {
    #[schema(example = "Photos")]
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
#[schema(description = "Update a media folder")]
pub struct UpdateMediaFolderRequest {
    #[schema(example = "Updated Photos")]
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
#[schema(description = "Media folder details")]
pub struct MediaFolderResponse {
    pub id: Uuid,
    pub site_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub name: String,
    pub display_order: i16,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<MediaFolder> for MediaFolderResponse {
    fn from(f: MediaFolder) -> Self {
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

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_create_media_folder_request_valid() {
        let request = CreateMediaFolderRequest {
            name: "Photos".to_string(),
            parent_id: None,
            display_order: 0,
        };
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_media_folder_request_empty_name() {
        let request = CreateMediaFolderRequest {
            name: "".to_string(),
            parent_id: None,
            display_order: 0,
        };
        assert!(request.validate().is_err());
    }
}
