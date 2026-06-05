use crate::dto::validated::ValidatedDto;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

/// Request to replace all tags on a media file
#[derive(Debug, Clone, Deserialize, Validate, ValidatedDto, ToSchema)]
#[schema(description = "Replace all tags on a media file")]
pub struct UpdateMediaTagsRequest {
    /// List of tags (lowercase, trimmed, max 50 chars each, max 50 tags)
    #[schema(example = json!(["landscape", "hero", "blog"]))]
    pub tags: Vec<String>,
}

/// Response containing tags for a media file
#[derive(Debug, Clone, Serialize, ToSchema)]
#[schema(description = "Tags for a media file")]
pub struct MediaTagsResponse {
    pub tags: Vec<String>,
}

/// A single tag with its usage count across a site
#[derive(Debug, Clone, Serialize, ToSchema, sqlx::FromRow)]
pub struct SiteTagItem {
    #[schema(example = "landscape")]
    pub tag: String,
    /// Number of media files using this tag on this site
    #[schema(example = 42)]
    pub count: i64,
}

/// Response containing all distinct tags for a site
#[derive(Debug, Clone, Serialize, ToSchema)]
#[schema(description = "All distinct tags used on a site with usage counts")]
pub struct SiteTagsResponse {
    pub tags: Vec<SiteTagItem>,
}
