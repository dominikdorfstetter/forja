//! AI content assist DTOs

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

/// AI action types
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AiAction {
    Seo,
    Excerpt,
    Translate,
}

/// Request to generate AI content
#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct AiGenerateRequest {
    pub action: AiAction,
    #[validate(length(min = 1, max = 50000))]
    pub content: String,
    /// Required for translate action — the target locale code (e.g. "de", "fr")
    pub target_locale: Option<String>,
}

/// Response from AI content generation
#[derive(Debug, Serialize, ToSchema)]
pub struct AiGenerateResponse {
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub excerpt: Option<String>,
    pub title: Option<String>,
    pub subtitle: Option<String>,
    pub body: Option<String>,
}

/// Request to create or update AI config
#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateAiConfigRequest {
    #[validate(length(min = 1, max = 100))]
    pub provider_name: String,
    #[validate(length(min = 1, max = 500))]
    pub base_url: String,
    /// Optional — local providers like LM Studio or Ollama don't require an API key
    #[validate(length(max = 500))]
    pub api_key: Option<String>,
    #[validate(length(min = 1, max = 200))]
    pub model: String,
    pub temperature: Option<f64>,
    pub max_tokens: Option<i32>,
    pub system_prompts: Option<serde_json::Value>,
}

/// Response for AI config (API key masked)
#[derive(Debug, Serialize, ToSchema)]
pub struct AiConfigResponse {
    pub id: Uuid,
    pub site_id: Uuid,
    pub provider_name: String,
    pub base_url: String,
    pub api_key_masked: String,
    pub model: String,
    pub temperature: f64,
    pub max_tokens: i32,
    pub system_prompts: serde_json::Value,
    pub updated_at: String,
}

/// Response from AI connection test
#[derive(Debug, Serialize, ToSchema)]
pub struct AiTestResponse {
    pub success: bool,
    pub message: String,
}

/// Request to list available models from a provider
#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct ListModelsRequest {
    #[validate(length(min = 1, max = 500))]
    pub base_url: String,
    pub api_key: Option<String>,
    #[validate(length(min = 1, max = 100))]
    pub provider_name: String,
}

/// Response listing available models
#[derive(Debug, Serialize, ToSchema)]
pub struct ListModelsResponse {
    pub models: Vec<String>,
}
