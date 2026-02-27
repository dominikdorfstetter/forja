//! Media model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::media::{
    AddMediaMetadataRequest, MediaSearchParams, UpdateMediaMetadataRequest, UpdateMediaRequest,
    UploadMediaRequest,
};
use crate::errors::ApiError;

/// Storage provider enum matching PostgreSQL
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, utoipa::ToSchema)]
#[sqlx(type_name = "storage_provider", rename_all = "lowercase")]
#[derive(Default)]
pub enum StorageProvider {
    #[default]
    Local,
    Cloudinary,
    S3,
    Gcs,
    Azure,
}

/// Media variant type enum matching PostgreSQL
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, utoipa::ToSchema)]
#[sqlx(type_name = "media_variant_type", rename_all = "lowercase")]
pub enum MediaVariantType {
    Original,
    Thumbnail,
    Small,
    Medium,
    Large,
    Webp,
    Avif,
}

/// Media file model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MediaFile {
    pub id: Uuid,
    pub filename: String,
    pub original_filename: String,
    pub mime_type: String,
    pub file_size: i64,
    pub storage_provider: StorageProvider,
    pub storage_path: String,
    pub public_url: Option<String>,
    pub checksum: Option<String>,
    pub width: Option<i16>,
    pub height: Option<i16>,
    pub duration: Option<i32>,
    pub uploaded_by: Option<Uuid>,
    pub environment_id: Option<Uuid>,
    pub is_global: bool,
    pub folder_id: Option<Uuid>,
    pub is_deleted: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Media variant model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MediaVariant {
    pub id: Uuid,
    pub media_file_id: Uuid,
    pub variant_name: MediaVariantType,
    pub width: i16,
    pub height: i16,
    pub file_size: i32,
    pub storage_path: String,
    pub public_url: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Media metadata (localized)
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MediaMetadata {
    pub id: Uuid,
    pub media_file_id: Uuid,
    pub locale_id: Uuid,
    pub alt_text: Option<String>,
    pub caption: Option<String>,
    pub title: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Media file with variants for API response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaWithVariants {
    pub id: Uuid,
    pub filename: String,
    pub original_filename: String,
    pub mime_type: String,
    pub file_size: i64,
    pub storage_provider: StorageProvider,
    pub public_url: Option<String>,
    pub width: Option<i16>,
    pub height: Option<i16>,
    pub duration: Option<i32>,
    pub is_global: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub variants: Vec<MediaVariant>,
}

impl MediaFile {
    /// Find all media files for a site
    pub async fn find_all_for_site(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Self>, ApiError> {
        let media = sqlx::query_as::<_, Self>(
            r#"
            SELECT m.id, m.filename, m.original_filename, m.mime_type, m.file_size,
                   m.storage_provider, m.storage_path, m.public_url, m.checksum,
                   m.width, m.height, m.duration, m.uploaded_by, m.environment_id,
                   m.is_global, m.folder_id, m.is_deleted, m.created_at, m.updated_at
            FROM media_files m
            INNER JOIN media_sites ms ON m.id = ms.media_file_id
            WHERE ms.site_id = $1 AND m.is_deleted = FALSE
            ORDER BY m.created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(site_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok(media)
    }

    /// Find media file by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let media = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, filename, original_filename, mime_type, file_size,
                   storage_provider, storage_path, public_url, checksum,
                   width, height, duration, uploaded_by, environment_id,
                   is_global, folder_id, is_deleted, created_at, updated_at
            FROM media_files
            WHERE id = $1 AND is_deleted = FALSE
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Media file with ID {} not found", id)))?;

        Ok(media)
    }

    /// Find media with variants
    pub async fn find_with_variants(
        pool: &PgPool,
        id: Uuid,
    ) -> Result<MediaWithVariants, ApiError> {
        let media = Self::find_by_id(pool, id).await?;
        let variants = MediaVariant::find_for_media(pool, id).await?;

        Ok(MediaWithVariants {
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
            variants,
        })
    }

    /// Find by checksum (for deduplication)
    pub async fn find_by_checksum(pool: &PgPool, checksum: &str) -> Result<Option<Self>, ApiError> {
        let media = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, filename, original_filename, mime_type, file_size,
                   storage_provider, storage_path, public_url, checksum,
                   width, height, duration, uploaded_by, environment_id,
                   is_global, folder_id, is_deleted, created_at, updated_at
            FROM media_files
            WHERE checksum = $1 AND is_deleted = FALSE
            "#,
        )
        .bind(checksum)
        .fetch_optional(pool)
        .await?;

        Ok(media)
    }

    /// Search media files for a site with optional filters.
    /// Uses `QueryBuilder` because the combination of 3 optional filters
    /// (search text, MIME category, folder) would require 8 static queries.
    pub async fn search_for_site(
        pool: &PgPool,
        site_id: Uuid,
        params: &MediaSearchParams,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Self>, ApiError> {
        let mut qb = sqlx::QueryBuilder::<sqlx::Postgres>::new(
            "SELECT DISTINCT m.id, m.filename, m.original_filename, m.mime_type, m.file_size, \
             m.storage_provider, m.storage_path, m.public_url, m.checksum, \
             m.width, m.height, m.duration, m.uploaded_by, m.environment_id, \
             m.is_global, m.folder_id, m.is_deleted, m.created_at, m.updated_at \
             FROM media_files m \
             INNER JOIN media_sites ms ON m.id = ms.media_file_id",
        );

        // LEFT JOIN metadata only when searching text (alt_text, caption, title live there)
        let search_pat = params.search_pattern();
        if search_pat.is_some() {
            qb.push(" LEFT JOIN media_metadata mm ON m.id = mm.media_file_id");
        }

        qb.push(" WHERE ms.site_id = ");
        qb.push_bind(site_id);
        qb.push(" AND m.is_deleted = FALSE");

        if let Some(ref pat) = search_pat {
            qb.push(" AND (m.filename ILIKE ");
            qb.push_bind(pat.clone());
            qb.push(" OR m.original_filename ILIKE ");
            qb.push_bind(pat.clone());
            qb.push(" OR mm.alt_text ILIKE ");
            qb.push_bind(pat.clone());
            qb.push(" OR mm.caption ILIKE ");
            qb.push_bind(pat.clone());
            qb.push(" OR mm.title ILIKE ");
            qb.push_bind(pat.clone());
            qb.push(")");
        }

        if let Some(ref prefix) = params.mime_prefix() {
            qb.push(" AND m.mime_type LIKE ");
            qb.push_bind(prefix.clone());
        }

        if let Some(folder_id) = params.folder_id {
            qb.push(" AND m.folder_id = ");
            qb.push_bind(folder_id);
        }

        qb.push(" ORDER BY m.created_at DESC LIMIT ");
        qb.push_bind(limit);
        qb.push(" OFFSET ");
        qb.push_bind(offset);

        let media = qb.build_query_as::<Self>().fetch_all(pool).await?;

        Ok(media)
    }

    /// Count media files for a site with the same optional filters as `search_for_site`.
    pub async fn count_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        params: &MediaSearchParams,
    ) -> Result<i64, ApiError> {
        let mut qb = sqlx::QueryBuilder::<sqlx::Postgres>::new(
            "SELECT COUNT(DISTINCT m.id) FROM media_files m \
             INNER JOIN media_sites ms ON m.id = ms.media_file_id",
        );

        let search_pat = params.search_pattern();
        if search_pat.is_some() {
            qb.push(" LEFT JOIN media_metadata mm ON m.id = mm.media_file_id");
        }

        qb.push(" WHERE ms.site_id = ");
        qb.push_bind(site_id);
        qb.push(" AND m.is_deleted = FALSE");

        if let Some(ref pat) = search_pat {
            qb.push(" AND (m.filename ILIKE ");
            qb.push_bind(pat.clone());
            qb.push(" OR m.original_filename ILIKE ");
            qb.push_bind(pat.clone());
            qb.push(" OR mm.alt_text ILIKE ");
            qb.push_bind(pat.clone());
            qb.push(" OR mm.caption ILIKE ");
            qb.push_bind(pat.clone());
            qb.push(" OR mm.title ILIKE ");
            qb.push_bind(pat.clone());
            qb.push(")");
        }

        if let Some(ref prefix) = params.mime_prefix() {
            qb.push(" AND m.mime_type LIKE ");
            qb.push_bind(prefix.clone());
        }

        if let Some(folder_id) = params.folder_id {
            qb.push(" AND m.folder_id = ");
            qb.push_bind(folder_id);
        }

        let row: (i64,) = qb.build_query_as().fetch_one(pool).await?;

        Ok(row.0)
    }

    /// Count media files for a site
    pub async fn count_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*)
            FROM media_files m
            INNER JOIN media_sites ms ON m.id = ms.media_file_id
            WHERE ms.site_id = $1 AND m.is_deleted = FALSE
            "#,
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;

        Ok(row.0)
    }

    /// Create a new media file record
    pub async fn create(pool: &PgPool, req: UploadMediaRequest) -> Result<Self, ApiError> {
        let mut tx = pool.begin().await?;

        let media = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO media_files (filename, original_filename, mime_type, file_size,
                                    storage_provider, storage_path, public_url,
                                    width, height, duration, is_global, folder_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id, filename, original_filename, mime_type, file_size,
                      storage_provider, storage_path, public_url, checksum,
                      width, height, duration, uploaded_by, environment_id,
                      is_global, folder_id, is_deleted, created_at, updated_at
            "#,
        )
        .bind(&req.filename)
        .bind(&req.original_filename)
        .bind(&req.mime_type)
        .bind(req.file_size)
        .bind(&req.storage_provider)
        .bind(&req.storage_path)
        .bind(&req.public_url)
        .bind(req.width)
        .bind(req.height)
        .bind(req.duration)
        .bind(req.is_global)
        .bind(req.folder_id)
        .fetch_one(&mut *tx)
        .await?;

        // Insert media_sites associations
        for site_id in &req.site_ids {
            sqlx::query("INSERT INTO media_sites (media_file_id, site_id) VALUES ($1, $2)")
                .bind(media.id)
                .bind(site_id)
                .execute(&mut *tx)
                .await?;
        }

        tx.commit().await?;

        Ok(media)
    }

    /// Update media file metadata
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdateMediaRequest,
    ) -> Result<Self, ApiError> {
        let media = sqlx::query_as::<_, Self>(
            r#"
            UPDATE media_files
            SET filename = COALESCE($2, filename),
                public_url = COALESCE($3, public_url),
                is_global = COALESCE($4, is_global),
                folder_id = COALESCE($5, folder_id),
                updated_at = NOW()
            WHERE id = $1 AND is_deleted = FALSE
            RETURNING id, filename, original_filename, mime_type, file_size,
                      storage_provider, storage_path, public_url, checksum,
                      width, height, duration, uploaded_by, environment_id,
                      is_global, folder_id, is_deleted, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&req.filename)
        .bind(&req.public_url)
        .bind(req.is_global)
        .bind(req.folder_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Media file with ID {} not found", id)))?;

        Ok(media)
    }

    /// Create a new media file from an actual upload (server-side detection)
    #[allow(clippy::too_many_arguments)]
    pub async fn create_from_upload(
        pool: &PgPool,
        filename: &str,
        original_filename: &str,
        mime_type: &str,
        file_size: i64,
        storage_provider: StorageProvider,
        storage_path: &str,
        public_url: &str,
        checksum: &str,
        width: Option<i32>,
        height: Option<i32>,
        uploaded_by: Option<Uuid>,
        is_global: bool,
        folder_id: Option<Uuid>,
        site_ids: Vec<Uuid>,
    ) -> Result<Self, ApiError> {
        let mut tx = pool.begin().await?;

        let media = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO media_files (filename, original_filename, mime_type, file_size,
                                    storage_provider, storage_path, public_url, checksum,
                                    width, height, uploaded_by, is_global, folder_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id, filename, original_filename, mime_type, file_size,
                      storage_provider, storage_path, public_url, checksum,
                      width, height, duration, uploaded_by, environment_id,
                      is_global, folder_id, is_deleted, created_at, updated_at
            "#,
        )
        .bind(filename)
        .bind(original_filename)
        .bind(mime_type)
        .bind(file_size)
        .bind(&storage_provider)
        .bind(storage_path)
        .bind(public_url)
        .bind(checksum)
        .bind(width.map(|v| v as i16))
        .bind(height.map(|v| v as i16))
        .bind(uploaded_by)
        .bind(is_global)
        .bind(folder_id)
        .fetch_one(&mut *tx)
        .await?;

        for site_id in &site_ids {
            sqlx::query("INSERT INTO media_sites (media_file_id, site_id) VALUES ($1, $2)")
                .bind(media.id)
                .bind(site_id)
                .execute(&mut *tx)
                .await?;
        }

        tx.commit().await?;
        Ok(media)
    }

    /// Soft delete media file
    pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query(
            r#"
            UPDATE media_files
            SET is_deleted = TRUE, updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!(
                "Media file with ID {} not found",
                id
            )));
        }

        Ok(())
    }
}

impl MediaVariant {
    /// Batch-insert generated variants for a media file
    pub async fn create_batch(
        pool: &PgPool,
        media_file_id: Uuid,
        variants: Vec<crate::services::image_service::GeneratedVariant>,
    ) -> Result<Vec<Self>, ApiError> {
        let mut results = Vec::with_capacity(variants.len());

        for v in variants {
            let variant = sqlx::query_as::<_, Self>(
                r#"
                INSERT INTO media_variants (media_file_id, variant_name, width, height, file_size, storage_path, public_url)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id, media_file_id, variant_name, width, height, file_size, storage_path, public_url, created_at
                "#,
            )
            .bind(media_file_id)
            .bind(&v.variant_type)
            .bind(v.width as i16)
            .bind(v.height as i16)
            .bind(v.file_size as i32)
            .bind(&v.storage_path)
            .bind(&v.public_url)
            .fetch_one(pool)
            .await?;

            results.push(variant);
        }

        Ok(results)
    }

    /// Find variants for a media file
    pub async fn find_for_media(pool: &PgPool, media_file_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let variants = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, media_file_id, variant_name, width, height, file_size,
                   storage_path, public_url, created_at
            FROM media_variants
            WHERE media_file_id = $1
            ORDER BY variant_name ASC
            "#,
        )
        .bind(media_file_id)
        .fetch_all(pool)
        .await?;

        Ok(variants)
    }
}

impl MediaMetadata {
    /// Find metadata for a media file and locale
    pub async fn find_for_media_locale(
        pool: &PgPool,
        media_file_id: Uuid,
        locale_id: Uuid,
    ) -> Result<Option<Self>, ApiError> {
        let metadata = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, media_file_id, locale_id, alt_text, caption, title,
                   created_at, updated_at
            FROM media_metadata
            WHERE media_file_id = $1 AND locale_id = $2
            "#,
        )
        .bind(media_file_id)
        .bind(locale_id)
        .fetch_optional(pool)
        .await?;

        Ok(metadata)
    }

    /// Find all metadata for a media file
    pub async fn find_all_for_media(
        pool: &PgPool,
        media_file_id: Uuid,
    ) -> Result<Vec<Self>, ApiError> {
        let metadata = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, media_file_id, locale_id, alt_text, caption, title,
                   created_at, updated_at
            FROM media_metadata
            WHERE media_file_id = $1
            "#,
        )
        .bind(media_file_id)
        .fetch_all(pool)
        .await?;

        Ok(metadata)
    }

    /// Create metadata for a media file
    pub async fn create(
        pool: &PgPool,
        media_file_id: Uuid,
        req: AddMediaMetadataRequest,
    ) -> Result<Self, ApiError> {
        let metadata = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO media_metadata (media_file_id, locale_id, alt_text, caption, title)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, media_file_id, locale_id, alt_text, caption, title,
                      created_at, updated_at
            "#,
        )
        .bind(media_file_id)
        .bind(req.locale_id)
        .bind(&req.alt_text)
        .bind(&req.caption)
        .bind(&req.title)
        .fetch_one(pool)
        .await?;

        Ok(metadata)
    }

    /// Update metadata
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdateMediaMetadataRequest,
    ) -> Result<Self, ApiError> {
        let metadata = sqlx::query_as::<_, Self>(
            r#"
            UPDATE media_metadata
            SET alt_text = COALESCE($2, alt_text),
                caption = COALESCE($3, caption),
                title = COALESCE($4, title),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, media_file_id, locale_id, alt_text, caption, title,
                      created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&req.alt_text)
        .bind(&req.caption)
        .bind(&req.title)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Media metadata with ID {} not found", id)))?;

        Ok(metadata)
    }

    /// Delete metadata
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM media_metadata WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!(
                "Media metadata with ID {} not found",
                id
            )));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_storage_provider_serialization() {
        let provider = StorageProvider::S3;
        let json = serde_json::to_string(&provider).unwrap();
        assert_eq!(json, "\"S3\"");
    }

    #[test]
    fn test_storage_provider_default() {
        let provider = StorageProvider::default();
        assert_eq!(provider, StorageProvider::Local);
    }

    #[test]
    fn test_media_variant_type_serialization() {
        let variant = MediaVariantType::Thumbnail;
        let json = serde_json::to_string(&variant).unwrap();
        assert_eq!(json, "\"Thumbnail\"");
    }
}
