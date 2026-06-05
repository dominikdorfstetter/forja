//! AI content assist DTOs

use crate::dto::validated::ValidatedDto;
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
    /// Auto-tag media using vision model
    AutoTag,
    /// Generate alt-text for images using vision model
    AltText,
    /// Generate a descriptive caption for an image using vision model
    ImageCaption,
    /// Generate a title for an image using vision model
    ImageTitle,
    /// Generate initial content (title / text / button_text) for a page section
    SectionContent,
    /// Suggest tags for a blog post from its body text. Prefers existing site
    /// tags over inventing new ones — the [`BlogTagContext::existing_tags`]
    /// list is fed to the model and matched case-insensitively on the way out.
    BlogTags,
}

/// Page-section generation context.
///
/// Required for [`AiAction::SectionContent`]. The model uses `section_type` to
/// decide structure (Hero vs FAQ vs CTA) and the page context to keep the
/// generated copy on-topic with the rest of the page.
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct SectionContext {
    /// Section type — must match the backend `SectionType` enum (e.g. "hero", "faq").
    #[schema(example = "hero")]
    pub section_type: String,
    /// Page title for context (in the target locale when known).
    #[schema(example = "Pricing")]
    pub page_title: Option<String>,
    /// Page route for context (e.g. "/about").
    #[schema(example = "/pricing")]
    pub page_route: Option<String>,
    /// Section types already on the page, in display order — helps avoid
    /// duplicating angle/wording across sections.
    #[schema(example = json!(["hero", "features"]))]
    #[serde(default)]
    pub existing_section_types: Vec<String>,
}

/// Blog auto-tagging context.
///
/// Required for [`AiAction::BlogTags`]. The model receives `existing_tags` as
/// preferred-vocabulary anchoring so it reuses canonical slugs (e.g. `rust`)
/// instead of inventing near-duplicates (`Rust`, `rust-lang`). Post-processing
/// matches returned slugs against this list case-insensitively.
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct BlogTagContext {
    /// Slugs of tags that already exist on the site. The model is instructed
    /// to prefer these over inventing new tags.
    #[schema(example = json!(["rust", "web", "tutorial"]))]
    #[serde(default)]
    pub existing_tags: Vec<String>,
}

/// Request to generate AI content
#[derive(Debug, Deserialize, Validate, ValidatedDto, ToSchema)]
pub struct AiGenerateRequest {
    #[schema(example = "seo")]
    pub action: AiAction,
    /// Content to process. Required for text actions; optional for vision actions (auto_tag, alt_text).
    #[validate(length(max = 50000))]
    #[schema(example = "# My Blog Post\n\nThis is a blog post about Rust and WebAssembly...")]
    pub content: String,
    /// Required for translate action — the target locale code (e.g. "de", "fr")
    #[schema(example = "de")]
    pub target_locale: Option<String>,
    /// Image URL for vision tasks (auto_tag, alt_text)
    #[validate(length(max = 2000))]
    #[schema(example = "https://example.com/image.jpg")]
    pub image_url: Option<String>,
    /// Page-section context — required for the `section_content` action.
    pub section_context: Option<SectionContext>,
    /// Blog-tag context — used by the `blog_tags` action to bias suggestions
    /// toward existing site tags. Optional; if absent the model produces
    /// suggestions purely from content.
    pub blog_tag_context: Option<BlogTagContext>,
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
    /// Generated tags (auto_tag action only)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    /// Generated alt text (alt_text action only)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alt_text: Option<String>,
    /// Section body text (section_content action only) — matches
    /// `PageSectionLocalization.text` so the frontend can pipe it straight in.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    /// Section button label (section_content action only) — matches
    /// `PageSectionLocalization.button_text`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub button_text: Option<String>,
}

/// Request to create or update AI config
#[derive(Debug, Deserialize, Validate, ValidatedDto, ToSchema)]
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
    /// Per-task model overrides (optional). Keys are action names (e.g. "seo", "tagging").
    /// Each value can have "model", "temperature", and/or "max_tokens".
    #[schema(example = json!({"seo": {"model": "gpt-4o-mini", "temperature": 0.5}}))]
    pub task_configs: Option<serde_json::Value>,
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
    #[schema(example = json!({"seo": {"model": "gpt-4o-mini", "temperature": 0.5}}))]
    pub task_configs: serde_json::Value,
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
#[derive(Debug, Deserialize, Validate, ValidatedDto, ToSchema)]
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
