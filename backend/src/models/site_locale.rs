//! Site locale model
//!
//! Per-site language/locale assignments (junction table between sites and locales).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::models::locale::TextDirection;

/// Site locale junction row
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SiteLocale {
    pub site_id: Uuid,
    pub locale_id: Uuid,
    pub is_default: bool,
    pub is_active: bool,
    pub url_prefix: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Site locale with joined locale details
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SiteLocaleWithDetails {
    pub site_id: Uuid,
    pub locale_id: Uuid,
    pub is_default: bool,
    pub is_active: bool,
    pub url_prefix: Option<String>,
    pub created_at: DateTime<Utc>,
    pub code: String,
    pub name: String,
    pub native_name: Option<String>,
    pub direction: TextDirection,
}

impl SiteLocale {
    /// Find all locales for a site with locale details
    pub async fn find_all_for_site(
        pool: &PgPool,
        site_id: Uuid,
    ) -> Result<Vec<SiteLocaleWithDetails>, ApiError> {
        let rows = sqlx::query_as::<_, SiteLocaleWithDetails>(
            r#"
            SELECT sl.site_id, sl.locale_id, sl.is_default, sl.is_active, sl.url_prefix, sl.created_at,
                   l.code, l.name, l.native_name, l.direction
            FROM site_locales sl
            JOIN locales l ON l.id = sl.locale_id
            WHERE sl.site_id = $1
            ORDER BY sl.is_default DESC, l.code ASC
            "#,
        )
        .bind(site_id)
        .fetch_all(pool)
        .await?;

        Ok(rows)
    }

    /// Find a single site-locale assignment
    pub async fn find_one(pool: &PgPool, site_id: Uuid, locale_id: Uuid) -> Result<Self, ApiError> {
        let row = sqlx::query_as::<_, Self>(
            r#"
            SELECT site_id, locale_id, is_default, is_active, url_prefix, created_at
            FROM site_locales
            WHERE site_id = $1 AND locale_id = $2
            "#,
        )
        .bind(site_id)
        .bind(locale_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::NotFound(format!(
                "Locale {} not assigned to site {}",
                locale_id, site_id
            ))
        })?;

        Ok(row)
    }

    /// Count locales for a site
    pub async fn count_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let (count,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM site_locales WHERE site_id = $1")
                .bind(site_id)
                .fetch_one(pool)
                .await?;
        Ok(count)
    }

    /// Add a locale to a site
    pub async fn add(
        pool: &PgPool,
        site_id: Uuid,
        locale_id: Uuid,
        is_default: bool,
        url_prefix: Option<&str>,
    ) -> Result<Self, ApiError> {
        let mut tx = pool.begin().await?;

        // If setting as default, clear old default
        if is_default {
            sqlx::query(
                "UPDATE site_locales SET is_default = FALSE WHERE site_id = $1 AND is_default = TRUE",
            )
            .bind(site_id)
            .execute(&mut *tx)
            .await?;
        }

        let row = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO site_locales (site_id, locale_id, is_default, url_prefix)
            VALUES ($1, $2, $3, $4)
            RETURNING site_id, locale_id, is_default, is_active, url_prefix, created_at
            "#,
        )
        .bind(site_id)
        .bind(locale_id)
        .bind(is_default)
        .bind(url_prefix)
        .fetch_one(&mut *tx)
        .await?;

        // Sync sites.default_locale_id if setting as default
        if is_default {
            sqlx::query(
                "UPDATE sites SET default_locale_id = $2, updated_at = NOW() WHERE id = $1",
            )
            .bind(site_id)
            .bind(locale_id)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(row)
    }

    /// Update a site locale assignment
    pub async fn update(
        pool: &PgPool,
        site_id: Uuid,
        locale_id: Uuid,
        is_default: Option<bool>,
        is_active: Option<bool>,
        url_prefix: Option<Option<&str>>,
    ) -> Result<Self, ApiError> {
        let mut tx = pool.begin().await?;

        // If setting as default, clear old default first
        if is_default == Some(true) {
            sqlx::query(
                "UPDATE site_locales SET is_default = FALSE WHERE site_id = $1 AND is_default = TRUE",
            )
            .bind(site_id)
            .execute(&mut *tx)
            .await?;
        }

        let row = sqlx::query_as::<_, Self>(
            r#"
            UPDATE site_locales
            SET is_default = COALESCE($3, is_default),
                is_active = COALESCE($4, is_active),
                url_prefix = CASE WHEN $5 THEN $6 ELSE url_prefix END
            WHERE site_id = $1 AND locale_id = $2
            RETURNING site_id, locale_id, is_default, is_active, url_prefix, created_at
            "#,
        )
        .bind(site_id)
        .bind(locale_id)
        .bind(is_default)
        .bind(is_active)
        .bind(url_prefix.is_some()) // $5: whether to update url_prefix
        .bind(url_prefix.flatten()) // $6: the new value (or NULL)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| {
            ApiError::NotFound(format!(
                "Locale {} not assigned to site {}",
                locale_id, site_id
            ))
        })?;

        // Sync sites.default_locale_id if changed
        if is_default == Some(true) {
            sqlx::query(
                "UPDATE sites SET default_locale_id = $2, updated_at = NOW() WHERE id = $1",
            )
            .bind(site_id)
            .bind(locale_id)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(row)
    }

    /// Remove a locale from a site (validates count > 1 and not default)
    pub async fn remove(pool: &PgPool, site_id: Uuid, locale_id: Uuid) -> Result<(), ApiError> {
        // Check that it exists and is not the default
        let existing = Self::find_one(pool, site_id, locale_id).await?;
        if existing.is_default {
            return Err(ApiError::BadRequest(
                "Cannot remove the default language. Change the default first.".into(),
            ));
        }

        // Check count
        let count = Self::count_for_site(pool, site_id).await?;
        if count <= 1 {
            return Err(ApiError::Conflict(
                "Cannot remove the last language from a site".into(),
            ));
        }

        let result = sqlx::query("DELETE FROM site_locales WHERE site_id = $1 AND locale_id = $2")
            .bind(site_id)
            .bind(locale_id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!(
                "Locale {} not assigned to site {}",
                locale_id, site_id
            )));
        }

        Ok(())
    }

    /// Set a locale as the default for a site (atomic: clear old + set new + sync sites table)
    pub async fn set_default(
        pool: &PgPool,
        site_id: Uuid,
        locale_id: Uuid,
    ) -> Result<(), ApiError> {
        // Verify the locale is assigned to the site
        Self::find_one(pool, site_id, locale_id).await?;

        let mut tx = pool.begin().await?;

        // Clear old default
        sqlx::query(
            "UPDATE site_locales SET is_default = FALSE WHERE site_id = $1 AND is_default = TRUE",
        )
        .bind(site_id)
        .execute(&mut *tx)
        .await?;

        // Set new default
        sqlx::query(
            "UPDATE site_locales SET is_default = TRUE WHERE site_id = $1 AND locale_id = $2",
        )
        .bind(site_id)
        .bind(locale_id)
        .execute(&mut *tx)
        .await?;

        // Sync sites.default_locale_id
        sqlx::query("UPDATE sites SET default_locale_id = $2, updated_at = NOW() WHERE id = $1")
            .bind(site_id)
            .bind(locale_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok(())
    }

    /// Bulk insert locales for a site (used during site creation)
    pub async fn bulk_insert(
        pool: &PgPool,
        site_id: Uuid,
        locales: &[(Uuid, bool, Option<String>)], // (locale_id, is_default, url_prefix)
    ) -> Result<(), ApiError> {
        let mut tx = pool.begin().await?;

        for (locale_id, is_default, url_prefix) in locales {
            sqlx::query(
                r#"
                INSERT INTO site_locales (site_id, locale_id, is_default, url_prefix)
                VALUES ($1, $2, $3, $4)
                "#,
            )
            .bind(site_id)
            .bind(locale_id)
            .bind(is_default)
            .bind(url_prefix.as_deref())
            .execute(&mut *tx)
            .await?;
        }

        // Set sites.default_locale_id to the default locale
        if let Some((default_locale_id, _, _)) =
            locales.iter().find(|(_, is_default, _)| *is_default)
        {
            sqlx::query(
                "UPDATE sites SET default_locale_id = $2, updated_at = NOW() WHERE id = $1",
            )
            .bind(site_id)
            .bind(default_locale_id)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_site_locale_struct_fields() {
        let now = Utc::now();
        let sl = SiteLocale {
            site_id: Uuid::new_v4(),
            locale_id: Uuid::new_v4(),
            is_default: true,
            is_active: true,
            url_prefix: Some("en".to_string()),
            created_at: now,
        };
        assert!(sl.is_default);
        assert!(sl.is_active);
        assert_eq!(sl.url_prefix, Some("en".to_string()));
    }

    #[test]
    fn test_site_locale_with_details_struct_fields() {
        let now = Utc::now();
        let sld = SiteLocaleWithDetails {
            site_id: Uuid::new_v4(),
            locale_id: Uuid::new_v4(),
            is_default: false,
            is_active: true,
            url_prefix: None,
            created_at: now,
            code: "de".to_string(),
            name: "German".to_string(),
            native_name: Some("Deutsch".to_string()),
            direction: TextDirection::Ltr,
        };
        assert_eq!(sld.code, "de");
        assert_eq!(sld.name, "German");
        assert_eq!(sld.native_name, Some("Deutsch".to_string()));
        assert_eq!(sld.direction, TextDirection::Ltr);
    }
}
