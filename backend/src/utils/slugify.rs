//! Slug generation and uniqueness utilities
//!
//! Generates URL-friendly slugs from titles with proper Unicode
//! transliteration and site-scoped uniqueness enforcement.

use sqlx::PgConnection;
use uuid::Uuid;

use crate::errors::ApiError;

/// Generate a URL-friendly slug from a title.
///
/// - Transliterates non-ASCII characters (ü → u, é → e, ß → ss)
/// - Lowercases, replaces non-alphanumeric with hyphens
/// - Collapses consecutive hyphens, trims leading/trailing
/// - Truncates to 80 characters
pub fn slugify(title: &str) -> String {
    let raw = slug::slugify(title);
    // slug crate handles transliteration + lowercasing + hyphenation
    // Truncate to 80 chars at a hyphen boundary if possible
    if raw.len() <= 80 {
        return raw;
    }
    match raw[..80].rfind('-') {
        Some(pos) if pos > 20 => raw[..pos].to_string(),
        _ => raw[..80].to_string(),
    }
}

/// Generate a unique slug within a site scope.
///
/// Checks the `contents` table (via `content_sites` join) for collisions.
/// Appends `-2`, `-3`, etc. on collision, up to 99 attempts.
///
/// Runs on the caller's `&mut PgConnection` so it participates in the same
/// create transaction as the spine + entity inserts (#863).
pub async fn generate_unique_slug(
    conn: &mut PgConnection,
    base_slug: &str,
    site_ids: &[Uuid],
) -> Result<String, ApiError> {
    if site_ids.is_empty() {
        return Ok(base_slug.to_string());
    }

    // Check if base slug is available
    if !slug_exists(&mut *conn, base_slug, site_ids).await? {
        return Ok(base_slug.to_string());
    }

    // Try suffixed variants
    for n in 2..=99 {
        let candidate = format!("{}-{}", base_slug, n);
        if !slug_exists(&mut *conn, &candidate, site_ids).await? {
            return Ok(candidate);
        }
    }

    Err(ApiError::bad_request(format!(
        "Cannot generate unique slug from '{}' — too many collisions",
        base_slug
    )))
}

/// Check if a slug exists within any of the given sites.
async fn slug_exists(
    conn: &mut PgConnection,
    slug: &str,
    site_ids: &[Uuid],
) -> Result<bool, ApiError> {
    let exists: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM contents c
            JOIN content_sites cs ON cs.content_id = c.id
            WHERE c.slug = $1
              AND cs.site_id = ANY($2)
              AND c.is_deleted = FALSE
        )
        "#,
    )
    .bind(slug)
    .bind(site_ids)
    .fetch_one(&mut *conn)
    .await?;

    Ok(exists)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_slugify_basic() {
        assert_eq!(slugify("Hello World"), "hello-world");
    }

    #[test]
    fn test_slugify_unicode() {
        assert_eq!(slugify("Über die Brücke"), "uber-die-brucke");
    }

    #[test]
    fn test_slugify_accents() {
        assert_eq!(slugify("café résumé"), "cafe-resume");
    }

    #[test]
    fn test_slugify_special_chars() {
        assert_eq!(slugify("Hello & World! #2"), "hello-world-2");
    }

    #[test]
    fn test_slugify_consecutive_hyphens() {
        assert_eq!(slugify("hello---world"), "hello-world");
    }

    #[test]
    fn test_slugify_leading_trailing() {
        assert_eq!(slugify("  hello world  "), "hello-world");
    }

    #[test]
    fn test_slugify_empty() {
        assert_eq!(slugify(""), "");
    }

    #[test]
    fn test_slugify_long_title() {
        let long = "a".repeat(100);
        let result = slugify(&long);
        assert!(result.len() <= 80);
    }

    #[test]
    fn test_slugify_german() {
        // ü, ö, ä, ß transliteration
        let result = slugify("Straße nach München");
        assert!(result.contains("strasse") || result.contains("strass"));
        assert!(result.contains("munchen") || result.contains("muenchen"));
    }

    #[test]
    fn test_slugify_numbers() {
        assert_eq!(slugify("Top 10 Tips for 2025"), "top-10-tips-for-2025");
    }
}
