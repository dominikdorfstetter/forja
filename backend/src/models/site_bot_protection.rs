//! Per-site bot-protection / captcha verification config (#608, #768).
//!
//! Two verification modes share one row:
//! - `Remote` (#608): admin pastes a vendor siteverify URL + secret; Forja
//!   POSTs the token there. Vendor-agnostic by design.
//! - `Altcha` (#768): self-hosted proof-of-work. `verify_url` is null and the
//!   encrypted-secret columns hold the ALTCHA HMAC key instead of a vendor
//!   secret. Verification happens in-process — no outbound call.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::forms::BotProtectionMode;
use crate::errors::ApiError;
use crate::services::encryption;

/// Default PoW search-space ceiling for ALTCHA challenges. ~50k keeps solve
/// time on a modern browser well under a second while still costing a bot
/// real CPU per submission.
pub const DEFAULT_ALTCHA_MAX_NUMBER: i64 = 50_000;

/// Default challenge validity window. Short enough to bound replay exposure,
/// long enough that a visitor can fill the form before the challenge expires.
pub const DEFAULT_ALTCHA_EXPIRY_SECONDS: i32 = 300;

/// One row in `site_bot_protection`.
///
/// `secret_encrypted` is AES-256-GCM ciphertext using the
/// `DOCUMENT_ENCRYPTION_KEY`; `secret_nonce` is the per-row nonce. In `Remote`
/// mode it holds the vendor secret; in `Altcha` mode it holds the HMAC key.
/// Either way the encryption pattern matches `Webhook::secret` so we don't
/// introduce a parallel key-management surface.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SiteBotProtection {
    pub id: Uuid,
    pub site_id: Uuid,
    pub mode: BotProtectionMode,
    pub provider_label: String,
    /// Null in `Altcha` mode; the vendor siteverify URL in `Remote` mode.
    pub verify_url: Option<String>,
    pub secret_encrypted: Vec<u8>,
    pub secret_nonce: Vec<u8>,
    /// ALTCHA PoW ceiling; null/ignored in `Remote` mode.
    pub altcha_max_number: Option<i64>,
    /// ALTCHA challenge validity window in seconds; null/ignored in `Remote`.
    pub altcha_expiry_seconds: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Inputs for an upsert. Carrying a struct keeps the call site readable as the
/// field set grows across modes, and lets the handler express "this is an
/// ALTCHA row" vs "this is a remote row" without a long positional argument
/// list.
pub struct UpsertParams<'a> {
    pub mode: BotProtectionMode,
    pub provider_label: &'a str,
    /// Required in `Remote` mode, ignored in `Altcha` mode.
    pub verify_url: Option<&'a str>,
    /// The plaintext secret (vendor secret or ALTCHA HMAC key) to encrypt.
    pub secret_plaintext: &'a str,
    pub altcha_max_number: Option<i64>,
    pub altcha_expiry_seconds: Option<i32>,
}

impl SiteBotProtection {
    /// Effective PoW ceiling, falling back to the default when unset.
    pub fn effective_max_number(&self) -> i64 {
        self.altcha_max_number.unwrap_or(DEFAULT_ALTCHA_MAX_NUMBER)
    }

    /// Effective challenge validity window, falling back to the default.
    pub fn effective_expiry_seconds(&self) -> i32 {
        self.altcha_expiry_seconds
            .unwrap_or(DEFAULT_ALTCHA_EXPIRY_SECONDS)
    }

    /// Fetch the config row for a site, or `None` if the site hasn't set one
    /// up yet. Callers decide whether absence is an error (e.g. submission
    /// to a Mandatory form) or a no-op (e.g. submission to a None-protection
    /// form).
    pub async fn find_for_site(
        pool: &PgPool,
        site_id: Uuid,
    ) -> Result<Option<SiteBotProtection>, ApiError> {
        let row = sqlx::query_as::<_, SiteBotProtection>(
            r#"
            SELECT id, site_id, mode, provider_label, verify_url,
                   secret_encrypted, secret_nonce,
                   altcha_max_number, altcha_expiry_seconds,
                   created_at, updated_at
              FROM site_bot_protection
             WHERE site_id = $1
            "#,
        )
        .bind(site_id)
        .fetch_optional(pool)
        .await?;
        Ok(row)
    }

    /// Insert-or-update the site's config. The secret is encrypted before
    /// persistence using the supplied key (same pattern as webhook secrets).
    /// Returns the stored row (with re-encrypted ciphertext, fresh nonce).
    pub async fn upsert(
        pool: &PgPool,
        site_id: Uuid,
        params: UpsertParams<'_>,
        encryption_key: &[u8; 32],
    ) -> Result<SiteBotProtection, ApiError> {
        let (ciphertext, nonce) = encryption::encrypt(params.secret_plaintext, encryption_key)?;
        let row = sqlx::query_as::<_, SiteBotProtection>(
            r#"
            INSERT INTO site_bot_protection
                (site_id, mode, provider_label, verify_url,
                 secret_encrypted, secret_nonce,
                 altcha_max_number, altcha_expiry_seconds)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (site_id) DO UPDATE
               SET mode                  = EXCLUDED.mode,
                   provider_label        = EXCLUDED.provider_label,
                   verify_url            = EXCLUDED.verify_url,
                   secret_encrypted      = EXCLUDED.secret_encrypted,
                   secret_nonce          = EXCLUDED.secret_nonce,
                   altcha_max_number     = EXCLUDED.altcha_max_number,
                   altcha_expiry_seconds = EXCLUDED.altcha_expiry_seconds,
                   updated_at            = NOW()
            RETURNING id, site_id, mode, provider_label, verify_url,
                      secret_encrypted, secret_nonce,
                      altcha_max_number, altcha_expiry_seconds,
                      created_at, updated_at
            "#,
        )
        .bind(site_id)
        .bind(params.mode)
        .bind(params.provider_label)
        .bind(params.verify_url)
        .bind(&ciphertext)
        .bind(&nonce)
        .bind(params.altcha_max_number)
        .bind(params.altcha_expiry_seconds)
        .fetch_one(pool)
        .await?;
        Ok(row)
    }

    /// Remove the site's config. Idempotent: returns `Ok(())` even when
    /// nothing was deleted, so callers don't have to distinguish "never
    /// configured" from "just deleted".
    pub async fn delete_for_site(pool: &PgPool, site_id: Uuid) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM site_bot_protection WHERE site_id = $1")
            .bind(site_id)
            .execute(pool)
            .await?;
        Ok(())
    }

    /// Decrypt the stored secret with the supplied AES-256-GCM key. In
    /// `Altcha` mode this is the HMAC key; in `Remote` mode the vendor secret.
    pub fn decrypt_secret(&self, key: &[u8; 32]) -> Result<String, ApiError> {
        encryption::decrypt(&self.secret_encrypted, &self.secret_nonce, key)
    }
}

/// Single-use guard for solved ALTCHA challenges (#768b).
///
/// `altcha-lib-rs` verifies HMAC + expiry but does not track consumption, so
/// a captured payload could be replayed until it expires. We record each
/// accepted challenge's salt; a second submission carrying the same salt is
/// rejected. Rows past `expires_at` are pruned by `prune_expired`.
pub struct ConsumedChallenge;

impl ConsumedChallenge {
    /// Record a salt as consumed. Returns `true` if this was the first use
    /// (insert succeeded) and `false` if the salt was already recorded — i.e.
    /// a replay. The `ON CONFLICT DO NOTHING` makes the check atomic against
    /// concurrent submissions of the same payload.
    pub async fn try_consume(
        pool: &PgPool,
        site_id: Uuid,
        salt: &str,
        expires_at: DateTime<Utc>,
    ) -> Result<bool, ApiError> {
        let result = sqlx::query(
            r#"
            INSERT INTO altcha_consumed_challenge (salt, site_id, expires_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (salt) DO NOTHING
            "#,
        )
        .bind(salt)
        .bind(site_id)
        .bind(expires_at)
        .execute(pool)
        .await?;
        Ok(result.rows_affected() == 1)
    }

    /// Delete consumed-challenge rows whose validity window has passed. Safe
    /// to call opportunistically — expired challenges fail verification on
    /// their own, so this only reclaims storage.
    pub async fn prune_expired(pool: &PgPool) -> Result<u64, ApiError> {
        let result = sqlx::query("DELETE FROM altcha_consumed_challenge WHERE expires_at < NOW()")
            .execute(pool)
            .await?;
        Ok(result.rows_affected())
    }
}
