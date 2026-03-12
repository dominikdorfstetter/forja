//! AI configuration model

use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;

#[derive(Debug, Clone, sqlx::FromRow, Serialize, Deserialize)]
pub struct SiteAiConfig {
    pub id: Uuid,
    pub site_id: Uuid,
    pub provider_name: String,
    pub base_url: String,
    pub api_key_encrypted: Vec<u8>,
    pub api_key_nonce: Vec<u8>,
    pub model: String,
    pub temperature: f64,
    pub max_tokens: i32,
    pub system_prompts: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl SiteAiConfig {
    pub async fn find_by_site_id(pool: &PgPool, site_id: Uuid) -> Result<Option<Self>, ApiError> {
        sqlx::query_as::<_, Self>("SELECT * FROM site_ai_configs WHERE site_id = $1")
            .bind(site_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| ApiError::database(e.to_string()))
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn upsert(
        pool: &PgPool,
        site_id: Uuid,
        provider_name: &str,
        base_url: &str,
        api_key_encrypted: &[u8],
        api_key_nonce: &[u8],
        model: &str,
        temperature: f64,
        max_tokens: i32,
        system_prompts: &serde_json::Value,
    ) -> Result<Self, ApiError> {
        sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO site_ai_configs (site_id, provider_name, base_url, api_key_encrypted, api_key_nonce, model, temperature, max_tokens, system_prompts)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (site_id) DO UPDATE SET
                provider_name = EXCLUDED.provider_name,
                base_url = EXCLUDED.base_url,
                api_key_encrypted = EXCLUDED.api_key_encrypted,
                api_key_nonce = EXCLUDED.api_key_nonce,
                model = EXCLUDED.model,
                temperature = EXCLUDED.temperature,
                max_tokens = EXCLUDED.max_tokens,
                system_prompts = EXCLUDED.system_prompts,
                updated_at = NOW()
            RETURNING *
            "#,
        )
        .bind(site_id)
        .bind(provider_name)
        .bind(base_url)
        .bind(api_key_encrypted)
        .bind(api_key_nonce)
        .bind(model)
        .bind(temperature)
        .bind(max_tokens)
        .bind(system_prompts)
        .fetch_one(pool)
        .await
        .map_err(|e| ApiError::database(e.to_string()))
    }

    pub async fn delete_by_site_id(pool: &PgPool, site_id: Uuid) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM site_ai_configs WHERE site_id = $1")
            .bind(site_id)
            .execute(pool)
            .await
            .map_err(|e| ApiError::database(e.to_string()))?;
        Ok(())
    }
}
