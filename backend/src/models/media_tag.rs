use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::media_tag::SiteTagItem;
use crate::errors::ApiError;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct MediaTag {
    pub media_file_id: Uuid,
    pub tag: String,
    pub created_at: DateTime<Utc>,
}

/// Maximum number of tags per media file
const MAX_TAGS_PER_MEDIA: usize = 50;
/// Maximum length of a single tag
const MAX_TAG_LENGTH: usize = 50;

impl MediaTag {
    /// Normalize a tag: lowercase, trimmed, non-empty, within length limit.
    /// Returns None if the tag is invalid after normalization.
    pub fn normalize(tag: &str) -> Option<String> {
        let normalized = tag.trim().to_lowercase();
        if normalized.is_empty() || normalized.len() > MAX_TAG_LENGTH {
            None
        } else {
            Some(normalized)
        }
    }

    /// Normalize and deduplicate a list of tags.
    /// Returns an error if too many tags after deduplication.
    pub fn normalize_tags(tags: &[String]) -> Result<Vec<String>, ApiError> {
        let mut normalized: Vec<String> = tags.iter().filter_map(|t| Self::normalize(t)).collect();
        normalized.sort();
        normalized.dedup();

        if normalized.len() > MAX_TAGS_PER_MEDIA {
            return Err(ApiError::bad_request(format!(
                "Too many tags: {} (max {})",
                normalized.len(),
                MAX_TAGS_PER_MEDIA
            ))
            .with_code(crate::errors::codes::MEDIA_TOO_MANY_TAGS));
        }
        Ok(normalized)
    }

    /// Get all tags for a media file.
    pub async fn find_by_media_id(
        pool: &PgPool,
        media_file_id: Uuid,
    ) -> Result<Vec<String>, ApiError> {
        let rows = sqlx::query_scalar::<_, String>(
            "SELECT tag FROM media_tags WHERE media_file_id = $1 ORDER BY tag",
        )
        .bind(media_file_id)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    /// Batch-fetch tags for multiple media files.
    /// Returns a map of media_file_id -> Vec<tag>.
    pub async fn find_by_media_ids(
        pool: &PgPool,
        ids: &[Uuid],
    ) -> Result<std::collections::HashMap<Uuid, Vec<String>>, ApiError> {
        if ids.is_empty() {
            return Ok(std::collections::HashMap::new());
        }

        let rows = sqlx::query_as::<_, (Uuid, String)>(
            "SELECT media_file_id, tag FROM media_tags WHERE media_file_id = ANY($1) ORDER BY tag",
        )
        .bind(ids)
        .fetch_all(pool)
        .await?;

        let mut map: std::collections::HashMap<Uuid, Vec<String>> =
            std::collections::HashMap::new();
        for (id, tag) in rows {
            map.entry(id).or_default().push(tag);
        }
        Ok(map)
    }

    /// Replace all tags for a media file (delete + insert in a transaction).
    pub async fn replace_for_media(
        pool: &PgPool,
        media_file_id: Uuid,
        tags: &[String],
    ) -> Result<Vec<String>, ApiError> {
        let normalized = Self::normalize_tags(tags)?;

        let mut tx = pool.begin().await?;

        sqlx::query("DELETE FROM media_tags WHERE media_file_id = $1")
            .bind(media_file_id)
            .execute(&mut *tx)
            .await?;

        for tag in &normalized {
            sqlx::query("INSERT INTO media_tags (media_file_id, tag) VALUES ($1, $2)")
                .bind(media_file_id)
                .bind(tag)
                .execute(&mut *tx)
                .await?;
        }

        tx.commit().await?;
        Ok(normalized)
    }

    /// Get all distinct tags for a site with usage counts, optionally filtered by prefix.
    pub async fn find_for_site(
        pool: &PgPool,
        site_id: Uuid,
        prefix: Option<&str>,
        limit: Option<i64>,
    ) -> Result<Vec<SiteTagItem>, ApiError> {
        let limit = limit.unwrap_or(100).min(200);

        if let Some(prefix) = prefix {
            let pattern = format!("{}%", prefix.trim().to_lowercase());
            let rows = sqlx::query_as::<_, SiteTagItem>(
                r#"
                SELECT mt.tag, COUNT(DISTINCT mt.media_file_id) as count
                FROM media_tags mt
                INNER JOIN media_sites ms ON mt.media_file_id = ms.media_file_id
                INNER JOIN media_files mf ON mt.media_file_id = mf.id
                WHERE ms.site_id = $1
                  AND mf.is_deleted = FALSE
                  AND mt.tag LIKE $2
                GROUP BY mt.tag
                ORDER BY count DESC, mt.tag
                LIMIT $3
                "#,
            )
            .bind(site_id)
            .bind(&pattern)
            .bind(limit)
            .fetch_all(pool)
            .await?;
            Ok(rows)
        } else {
            let rows = sqlx::query_as::<_, SiteTagItem>(
                r#"
                SELECT mt.tag, COUNT(DISTINCT mt.media_file_id) as count
                FROM media_tags mt
                INNER JOIN media_sites ms ON mt.media_file_id = ms.media_file_id
                INNER JOIN media_files mf ON mt.media_file_id = mf.id
                WHERE ms.site_id = $1
                  AND mf.is_deleted = FALSE
                GROUP BY mt.tag
                ORDER BY count DESC, mt.tag
                LIMIT $2
                "#,
            )
            .bind(site_id)
            .bind(limit)
            .fetch_all(pool)
            .await?;
            Ok(rows)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_trims_and_lowercases() {
        assert_eq!(
            MediaTag::normalize("  Landscape  "),
            Some("landscape".into())
        );
    }

    #[test]
    fn normalize_rejects_empty() {
        assert_eq!(MediaTag::normalize("   "), None);
        assert_eq!(MediaTag::normalize(""), None);
    }

    #[test]
    fn normalize_rejects_too_long() {
        let long = "a".repeat(51);
        assert_eq!(MediaTag::normalize(&long), None);
    }

    #[test]
    fn normalize_tags_deduplicates_and_sorts() {
        let tags = vec![
            "Hero".into(),
            "landscape".into(),
            "hero".into(),
            " Blog ".into(),
        ];
        let result = MediaTag::normalize_tags(&tags).unwrap();
        assert_eq!(result, vec!["blog", "hero", "landscape"]);
    }

    #[test]
    fn normalize_tags_rejects_too_many() {
        let tags: Vec<String> = (0..51).map(|i| format!("tag{i}")).collect();
        assert!(MediaTag::normalize_tags(&tags).is_err());
    }
}
