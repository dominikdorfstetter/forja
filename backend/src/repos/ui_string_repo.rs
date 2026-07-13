//! UI Strings persistence (consumer-feedback roadmap §1).
//!
//! Owns every SQL query touching `ui_strings` and
//! `ui_string_localizations`, including the auto-outdated rule: when an
//! update changes the site-default locale's value for a key, every locale
//! row for that key NOT in the same payload flips to
//! `translation_status = 'outdated'` inside the same transaction (payload
//! locales are fresh against the new default by definition). Localization
//! reads are ordered
//! `locale.code ASC` so `utils::locale_resolver` can apply the ADR 0002
//! chain (exact → site default → first-by-code) without re-sorting.

use std::collections::BTreeMap;

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::{PgExecutor, PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::dto::ui_strings::{UI_STRINGS_MAX_KEYS_PER_SITE, UiStringLocalizationInput};
use crate::errors::{ApiError, codes};
use crate::models::content::TranslationStatus;
use crate::utils::locale_resolver::{LocaleResolution, resolve_localization};

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct UiStringRow {
    pub id: Uuid,
    pub site_id: Uuid,
    pub key: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct UiStringLocalizationRow {
    pub id: Uuid,
    pub ui_string_id: Uuid,
    pub locale_id: Uuid,
    pub value: String,
    pub translation_status: TranslationStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// One (key, locale, value) triple for the public flat-map read.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct UiStringValueRow {
    pub key: String,
    pub locale_id: Uuid,
    pub value: String,
}

fn not_found(id: Uuid) -> ApiError {
    ApiError::not_found(format!("UI string with ID {id} not found"))
        .with_code(codes::ERR_STRINGS_NOT_FOUND)
        .with_entity_type("ui_string")
}

/// The 500-key-per-site cap error, shared by the handler's fast-path check
/// and the authoritative in-transaction re-check in [`UiStringRepo::create`].
pub fn limit_exceeded() -> ApiError {
    ApiError::validation(format!(
        "A site can hold at most {UI_STRINGS_MAX_KEYS_PER_SITE} UI string keys"
    ))
    .with_code(codes::ERR_STRINGS_LIMIT_EXCEEDED)
}

fn map_key_taken(e: sqlx::Error) -> ApiError {
    match &e {
        sqlx::Error::Database(db)
            if db.code().as_deref() == Some("23505")
                && db.constraint() == Some("ui_strings_site_id_key_key") =>
        {
            ApiError::conflict("Another UI string on this site already uses this key")
                .with_code(codes::ERR_STRINGS_KEY_TAKEN)
        }
        _ => e.into(),
    }
}

/// Insert or update one localization row. A changed value resets the status
/// to `pending`; so does an unchanged value on an `outdated` row — an
/// explicit upsert is a translator confirming the translation is current.
async fn upsert_localization(
    tx: &mut Transaction<'_, Postgres>,
    ui_string_id: Uuid,
    input: &UiStringLocalizationInput,
) -> Result<(), ApiError> {
    sqlx::query(
        r#"
        INSERT INTO ui_string_localizations (ui_string_id, locale_id, value)
        VALUES ($1, $2, $3)
        ON CONFLICT (ui_string_id, locale_id) DO UPDATE SET
            value = EXCLUDED.value,
            translation_status = CASE
                WHEN ui_string_localizations.value IS DISTINCT FROM EXCLUDED.value
                    OR ui_string_localizations.translation_status = 'outdated'::translation_status
                    THEN 'pending'::translation_status
                ELSE ui_string_localizations.translation_status
            END,
            updated_at = NOW()
        "#,
    )
    .bind(ui_string_id)
    .bind(input.locale_id)
    .bind(&input.value)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub struct UiStringRepo;

impl UiStringRepo {
    /// Generic over the executor so [`Self::create`] can re-check the key
    /// cap on its own transaction; normal callers pass `&PgPool`.
    pub async fn count_for_site<'e, E>(executor: E, site_id: Uuid) -> Result<i64, ApiError>
    where
        E: PgExecutor<'e>,
    {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM ui_strings WHERE site_id = $1")
            .bind(site_id)
            .fetch_one(executor)
            .await?;
        Ok(count)
    }

    pub async fn list_for_site(pool: &PgPool, site_id: Uuid) -> Result<Vec<UiStringRow>, ApiError> {
        let rows = sqlx::query_as::<_, UiStringRow>(
            "SELECT id, site_id, key, created_at, updated_at
             FROM ui_strings WHERE site_id = $1 ORDER BY key ASC",
        )
        .bind(site_id)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    pub async fn find_for_site(
        pool: &PgPool,
        site_id: Uuid,
        id: Uuid,
    ) -> Result<UiStringRow, ApiError> {
        sqlx::query_as::<_, UiStringRow>(
            "SELECT id, site_id, key, created_at, updated_at
             FROM ui_strings WHERE id = $1 AND site_id = $2",
        )
        .bind(id)
        .bind(site_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| not_found(id))
    }

    /// Every localization of every key on the site, ordered by
    /// `locale.code ASC` within each key.
    pub async fn localizations_for_site(
        pool: &PgPool,
        site_id: Uuid,
    ) -> Result<Vec<UiStringLocalizationRow>, ApiError> {
        let rows = sqlx::query_as::<_, UiStringLocalizationRow>(
            r#"
            SELECT usl.id, usl.ui_string_id, usl.locale_id, usl.value,
                   usl.translation_status, usl.created_at, usl.updated_at
            FROM ui_string_localizations usl
            JOIN ui_strings us ON us.id = usl.ui_string_id
            JOIN locales l ON l.id = usl.locale_id
            WHERE us.site_id = $1
            ORDER BY usl.ui_string_id, l.code ASC
            "#,
        )
        .bind(site_id)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    pub async fn localizations_for_string(
        pool: &PgPool,
        ui_string_id: Uuid,
    ) -> Result<Vec<UiStringLocalizationRow>, ApiError> {
        let rows = sqlx::query_as::<_, UiStringLocalizationRow>(
            r#"
            SELECT usl.id, usl.ui_string_id, usl.locale_id, usl.value,
                   usl.translation_status, usl.created_at, usl.updated_at
            FROM ui_string_localizations usl
            JOIN locales l ON l.id = usl.locale_id
            WHERE usl.ui_string_id = $1
            ORDER BY l.code ASC
            "#,
        )
        .bind(ui_string_id)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    /// Create a key with its initial localizations. The 500-key cap is
    /// enforced here, inside the transaction, behind a per-site
    /// `pg_advisory_xact_lock` — concurrent creates on the same site
    /// serialize, so racing requests can never overshoot the cap (the
    /// handler's pool-side pre-check is only a fast path).
    pub async fn create(
        pool: &PgPool,
        site_id: Uuid,
        key: &str,
        localizations: &[UiStringLocalizationInput],
    ) -> Result<UiStringRow, ApiError> {
        let mut tx = pool.begin().await?;

        sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)")
            .bind(format!("ui_strings:{site_id}"))
            .execute(&mut *tx)
            .await?;
        if Self::count_for_site(&mut *tx, site_id).await? >= UI_STRINGS_MAX_KEYS_PER_SITE {
            return Err(limit_exceeded());
        }

        let row = sqlx::query_as::<_, UiStringRow>(
            "INSERT INTO ui_strings (site_id, key) VALUES ($1, $2)
             RETURNING id, site_id, key, created_at, updated_at",
        )
        .bind(site_id)
        .bind(key)
        .fetch_one(&mut *tx)
        .await
        .map_err(map_key_taken)?;

        for input in localizations {
            upsert_localization(&mut tx, row.id, input).await?;
        }

        tx.commit().await?;
        Ok(row)
    }

    /// Rename the key (when `key` is `Some`) and upsert the given
    /// localizations. When the payload changes the site-default locale's
    /// value, every locale row NOT upserted in the same payload flips to
    /// `outdated` in the same transaction.
    pub async fn update(
        pool: &PgPool,
        site_id: Uuid,
        id: Uuid,
        key: Option<&str>,
        localizations: &[UiStringLocalizationInput],
    ) -> Result<UiStringRow, ApiError> {
        let mut tx = pool.begin().await?;

        sqlx::query_as::<_, UiStringRow>(
            "SELECT id, site_id, key, created_at, updated_at
             FROM ui_strings WHERE id = $1 AND site_id = $2 FOR UPDATE",
        )
        .bind(id)
        .bind(site_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| not_found(id))?;

        let default_locale_id: Option<Uuid> = sqlx::query_scalar(
            "SELECT locale_id FROM site_locales WHERE site_id = $1 AND is_default = TRUE",
        )
        .bind(site_id)
        .fetch_optional(&mut *tx)
        .await?;

        let default_input =
            default_locale_id.and_then(|d| localizations.iter().find(|l| l.locale_id == d));
        let default_changed = match default_input {
            Some(input) => {
                let stored: Option<String> = sqlx::query_scalar(
                    "SELECT value FROM ui_string_localizations
                     WHERE ui_string_id = $1 AND locale_id = $2",
                )
                .bind(id)
                .bind(input.locale_id)
                .fetch_optional(&mut *tx)
                .await?;
                stored.as_deref() != Some(input.value.as_str())
            }
            None => false,
        };

        for input in localizations {
            upsert_localization(&mut tx, id, input).await?;
        }

        if default_changed {
            let payload_locale_ids: Vec<Uuid> = localizations.iter().map(|l| l.locale_id).collect();
            sqlx::query(
                "UPDATE ui_string_localizations
                 SET translation_status = 'outdated', updated_at = NOW()
                 WHERE ui_string_id = $1 AND locale_id <> ALL($2)",
            )
            .bind(id)
            .bind(&payload_locale_ids)
            .execute(&mut *tx)
            .await?;
        }

        let row = sqlx::query_as::<_, UiStringRow>(
            "UPDATE ui_strings SET key = COALESCE($2, key), updated_at = NOW()
             WHERE id = $1 RETURNING id, site_id, key, created_at, updated_at",
        )
        .bind(id)
        .bind(key)
        .fetch_one(&mut *tx)
        .await
        .map_err(map_key_taken)?;

        tx.commit().await?;
        Ok(row)
    }

    pub async fn delete(pool: &PgPool, site_id: Uuid, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM ui_strings WHERE id = $1 AND site_id = $2")
            .bind(id)
            .bind(site_id)
            .execute(pool)
            .await?;
        if result.rows_affected() == 0 {
            return Err(not_found(id));
        }
        Ok(())
    }

    /// Every (key, locale, value) triple on the site, ordered by key then
    /// `locale.code ASC` — the input shape for [`resolve_flat_map`].
    pub async fn localized_values_for_site(
        pool: &PgPool,
        site_id: Uuid,
    ) -> Result<Vec<UiStringValueRow>, ApiError> {
        let rows = sqlx::query_as::<_, UiStringValueRow>(
            r#"
            SELECT us.key, usl.locale_id, usl.value
            FROM ui_strings us
            JOIN ui_string_localizations usl ON usl.ui_string_id = us.id
            JOIN locales l ON l.id = usl.locale_id
            WHERE us.site_id = $1
            ORDER BY us.key ASC, l.code ASC
            "#,
        )
        .bind(site_id)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }
}

/// Fold locale-ordered value rows into the public `{key: value}` map, one
/// resolved value per key via the ADR 0002 chain. Keys without any
/// localization never appear in the input (inner join) and are omitted.
pub fn resolve_flat_map(
    rows: &[UiStringValueRow],
    resolution: LocaleResolution,
) -> BTreeMap<String, String> {
    let (requested_id, default_id) = resolution;
    rows.chunk_by(|a, b| a.key == b.key)
        .filter_map(|group| {
            resolve_localization(group, |r| r.locale_id, requested_id, default_id)
                .map(|hit| (hit.key.clone(), hit.value.clone()))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(key: &str, locale_id: Uuid, value: &str) -> UiStringValueRow {
        UiStringValueRow {
            key: key.to_string(),
            locale_id,
            value: value.to_string(),
        }
    }

    #[test]
    fn resolves_exact_match_per_key() {
        let de = Uuid::new_v4();
        let en = Uuid::new_v4();
        let rows = [row("a.key", de, "DE"), row("a.key", en, "EN")];

        let map = resolve_flat_map(&rows, (Some(en), Some(de)));

        assert_eq!(map.get("a.key").map(String::as_str), Some("EN"));
    }

    #[test]
    fn falls_back_to_default_then_first() {
        let de = Uuid::new_v4();
        let en = Uuid::new_v4();
        let missing = Uuid::new_v4();
        let rows = [
            row("has.default", de, "DE"),
            row("no.default", en, "EN-first"),
        ];

        let map = resolve_flat_map(&rows, (Some(missing), Some(de)));

        assert_eq!(map.get("has.default").map(String::as_str), Some("DE"));
        assert_eq!(map.get("no.default").map(String::as_str), Some("EN-first"));
    }

    #[test]
    fn empty_input_yields_empty_map() {
        let map = resolve_flat_map(&[], (None, None));
        assert!(map.is_empty());
    }
}
