//! AI content assist DTOs

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

/// AI action types
#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
#[schema(example = "seo")]
pub enum AiAction {
    Seo,
    Excerpt,
    Translate,
    /// Generate a blog outline from an idea
    DraftOutline,
    /// Generate a full blog post from a title + outline
    DraftPost,
}

/// Request to generate AI content
#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct AiGenerateRequest {
    #[schema(example = "seo")]
    pub action: AiAction,
    #[validate(length(min = 1, max = 50000))]
    #[schema(example = "# My Blog Post\n\nThis is a blog post about Rust and WebAssembly...")]
    pub content: String,
    /// Required for translate action — the target locale code (e.g. "de", "fr")
    #[schema(example = "de")]
    pub target_locale: Option<String>,
}

/// Response from AI content generation
#[derive(Debug, Default, Serialize, ToSchema)]
pub struct AiGenerateResponse {
    #[schema(example = "Rust & WebAssembly: A Practical Guide")]
    pub meta_title: Option<String>,
    #[schema(
        example = "Learn how to build fast, safe web applications using Rust and WebAssembly."
    )]
    pub meta_description: Option<String>,
    #[schema(example = "A hands-on guide to building web apps with Rust and WebAssembly.")]
    pub excerpt: Option<String>,
    #[schema(example = "Getting Started with Rust and WebAssembly")]
    pub title: Option<String>,
    #[schema(example = "A practical introduction for web developers")]
    pub subtitle: Option<String>,
    #[schema(
        example = "# Introduction\n\nRust and WebAssembly together offer a powerful combination..."
    )]
    pub body: Option<String>,
    /// Outline bullet points (draft_outline action only)
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = json!(["Introduction to Rust", "Setting up WebAssembly", "Building your first module", "Deployment strategies"]))]
    pub outline: Option<Vec<String>>,
}

/// Request to create or update AI config
#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateAiConfigRequest {
    #[validate(length(min = 1, max = 100))]
    #[schema(example = "openai")]
    pub provider_name: String,
    #[validate(length(min = 1, max = 500))]
    #[schema(example = "https://api.openai.com/v1")]
    pub base_url: String,
    /// Optional — local providers like LM Studio or Ollama don't require an API key
    #[validate(length(max = 500))]
    #[schema(example = "sk-proj-abc123def456")]
    pub api_key: Option<String>,
    #[validate(length(min = 1, max = 200))]
    #[schema(example = "gpt-4o")]
    pub model: String,
    #[schema(example = 0.7)]
    pub temperature: Option<f64>,
    #[schema(example = 4096)]
    pub max_tokens: Option<i32>,
    #[schema(example = json!({"seo": "You are an SEO expert.", "excerpt": "You write concise summaries."}))]
    pub system_prompts: Option<serde_json::Value>,
}

/// Response for AI config (API key masked)
#[derive(Debug, Serialize, ToSchema)]
pub struct AiConfigResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "660e8400-e29b-41d4-a716-446655440000")]
    pub site_id: Uuid,
    #[schema(example = "openai")]
    pub provider_name: String,
    #[schema(example = "https://api.openai.com/v1")]
    pub base_url: String,
    #[schema(example = "sk-proj-****f456")]
    pub api_key_masked: String,
    #[schema(example = "gpt-4o")]
    pub model: String,
    #[schema(example = 0.7)]
    pub temperature: f64,
    #[schema(example = 4096)]
    pub max_tokens: i32,
    #[schema(example = json!({"seo": "You are an SEO expert.", "excerpt": "You write concise summaries."}))]
    pub system_prompts: serde_json::Value,
    #[schema(example = "2025-01-15T10:30:00Z")]
    pub updated_at: String,
}

/// Response from AI connection test
#[derive(Debug, Serialize, ToSchema)]
pub struct AiTestResponse {
    #[schema(example = true)]
    pub success: bool,
    #[schema(example = "Connection successful — model responded in 245ms")]
    pub message: String,
}

/// Request to list available models from a provider
#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct ListModelsRequest {
    #[validate(length(min = 1, max = 500))]
    #[schema(example = "https://api.openai.com/v1")]
    pub base_url: String,
    #[schema(example = "sk-proj-abc123def456")]
    pub api_key: Option<String>,
    #[validate(length(min = 1, max = 100))]
    #[schema(example = "openai")]
    pub provider_name: String,
}

/// Response listing available models
#[derive(Debug, Serialize, ToSchema)]
pub struct ListModelsResponse {
    #[schema(example = json!(["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"]))]
    pub models: Vec<String>,
}
