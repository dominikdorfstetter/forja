//! AI content generation service — proxies requests to OpenAI-compatible or Anthropic providers.

use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::ai::{AiAction, AiGenerateRequest, AiGenerateResponse};
use crate::errors::ApiError;
use crate::models::ai_config::SiteAiConfig;
use crate::services::encryption;

// ── Provider detection ───────────────────────────────────────────

#[derive(Debug, PartialEq)]
enum Provider {
    OpenAiCompatible,
    Anthropic,
}

fn detect_provider(base_url: &str, provider_name: &str) -> Provider {
    let url_lower = base_url.to_lowercase();
    let name_lower = provider_name.to_lowercase();
    if url_lower.contains("anthropic.com")
        || name_lower.contains("claude")
        || name_lower.contains("anthropic")
    {
        Provider::Anthropic
    } else {
        Provider::OpenAiCompatible
    }
}

// ── OpenAI-compatible types ──────────────────────────────────────

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f64,
    max_tokens: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_format: Option<ResponseFormat>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct ResponseFormat {
    #[serde(rename = "type")]
    format_type: String,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatMessageResponse,
}

#[derive(Debug, Deserialize)]
struct ChatMessageResponse {
    content: String,
}

// ── Anthropic types ──────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: i32,
    system: String,
    messages: Vec<AnthropicMessage>,
}

#[derive(Debug, Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
}

#[derive(Debug, Deserialize)]
struct AnthropicContent {
    text: String,
}

// ── Default system prompts ───────────────────────────────────────

// Content-only prompts (format instructions are appended separately via format_suffix)
pub const DEFAULT_PROMPT_SEO: &str =
    "You are an SEO expert. Generate an SEO-optimized meta title (max 60 characters) \
and meta description (max 160 characters) from the provided blog content.";

pub const DEFAULT_PROMPT_EXCERPT: &str =
    "You are a content editor. Generate a concise 1-2 sentence excerpt that \
summarizes the key points of the provided blog content.";

const DEFAULT_PROMPT_TRANSLATE_PREFIX: &str =
    "You are a professional translator. Translate the following content to ";
const DEFAULT_PROMPT_TRANSLATE_SUFFIX: &str =
    ". Maintain the original tone, style, and markdown formatting.";

// Output format suffixes — appended to ALL prompts (custom or default) based on provider
const JSON_FORMAT_SEO: &str = "\nRespond with ONLY valid JSON in this exact format: \
{\"meta_title\": \"...\", \"meta_description\": \"...\"}";

const JSON_FORMAT_EXCERPT: &str = "\nRespond with ONLY valid JSON in this exact format: \
{\"excerpt\": \"...\"}";

const JSON_FORMAT_TRANSLATE: &str = "\nRespond with ONLY valid JSON in this exact format: \
{\"title\": \"...\", \"subtitle\": \"...\", \"excerpt\": \"...\", \
\"body\": \"...\", \"meta_title\": \"...\", \"meta_description\": \"...\"}";

const XML_FORMAT_SEO: &str = "\nRespond using ONLY these XML tags, with no other text:\n\
<meta_title>your meta title here</meta_title>\n\
<meta_description>your meta description here</meta_description>";

const XML_FORMAT_EXCERPT: &str = "\nRespond using ONLY this XML tag, with no other text:\n\
<excerpt>your excerpt here</excerpt>";

const XML_FORMAT_TRANSLATE: &str = "\nRespond using ONLY these XML tags, with no other text:\n\
<title>translated title</title>\n\
<subtitle>translated subtitle</subtitle>\n\
<excerpt>translated excerpt</excerpt>\n\
<body>translated body (keep markdown)</body>\n\
<meta_title>translated meta title</meta_title>\n\
<meta_description>translated meta description</meta_description>";

fn default_content_prompt(action: &AiAction, target_locale: Option<&str>) -> String {
    match action {
        AiAction::Seo => DEFAULT_PROMPT_SEO.to_string(),
        AiAction::Excerpt => DEFAULT_PROMPT_EXCERPT.to_string(),
        AiAction::Translate => {
            let locale = target_locale.unwrap_or("en");
            format!("{DEFAULT_PROMPT_TRANSLATE_PREFIX}{locale}{DEFAULT_PROMPT_TRANSLATE_SUFFIX}")
        }
    }
}

/// Returns the output format suffix based on provider type and action.
/// Always appended to the system prompt (custom or default) so the model
/// knows how to structure its response.
fn format_suffix(action: &AiAction, use_json: bool) -> &'static str {
    if use_json {
        match action {
            AiAction::Seo => JSON_FORMAT_SEO,
            AiAction::Excerpt => JSON_FORMAT_EXCERPT,
            AiAction::Translate => JSON_FORMAT_TRANSLATE,
        }
    } else {
        match action {
            AiAction::Seo => XML_FORMAT_SEO,
            AiAction::Excerpt => XML_FORMAT_EXCERPT,
            AiAction::Translate => XML_FORMAT_TRANSLATE,
        }
    }
}

pub fn default_prompt_translate_for_locale(locale: &str) -> String {
    format!("{DEFAULT_PROMPT_TRANSLATE_PREFIX}{locale}{DEFAULT_PROMPT_TRANSLATE_SUFFIX}")
}

/// Strip any existing JSON or XML format instructions from a custom prompt.
/// Users may have saved prompts containing old "Respond with ONLY valid JSON..." text.
fn strip_format_instructions(prompt: &str) -> &str {
    // Find the last sentence boundary before any format instruction
    let markers = [
        "\nRespond with ONLY",
        "\nRespond using ONLY",
        "Respond with ONLY valid JSON",
        "Respond using ONLY these XML",
    ];
    let mut end = prompt.len();
    for marker in &markers {
        if let Some(pos) = prompt.find(marker) {
            end = end.min(pos);
        }
    }
    prompt[..end].trim_end()
}

// ── Provider-specific calls ──────────────────────────────────────

struct OpenAiCallParams<'a> {
    base_url: &'a str,
    api_key: &'a str,
    model: &'a str,
    system_prompt: &'a str,
    user_content: &'a str,
    temperature: f64,
    max_tokens: i32,
    use_json_mode: bool,
}

async fn call_openai_compatible(params: &OpenAiCallParams<'_>) -> Result<String, ApiError> {
    let response_format = if params.use_json_mode {
        Some(ResponseFormat {
            format_type: "json_object".to_string(),
        })
    } else {
        None
    };

    let chat_request = ChatCompletionRequest {
        model: params.model.to_string(),
        messages: vec![
            ChatMessage {
                role: "system".to_string(),
                content: params.system_prompt.to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: params.user_content.to_string(),
            },
        ],
        temperature: params.temperature,
        max_tokens: params.max_tokens,
        response_format,
    };

    let url = format!(
        "{}/v1/chat/completions",
        params.base_url.trim_end_matches('/')
    );

    let client = reqwest::Client::new();
    let mut req = client.post(&url).header("Content-Type", "application/json");
    if !params.api_key.is_empty() {
        req = req.header("Authorization", format!("Bearer {}", params.api_key));
    }
    let response =
        req.json(&chat_request).send().await.map_err(|e| {
            ApiError::ServiceUnavailable(format!("AI provider request failed: {e}"))
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(ApiError::ServiceUnavailable(format!(
            "AI provider returned {status}: {body}"
        )));
    }

    let completion: ChatCompletionResponse = response
        .json()
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to parse AI response: {e}")))?;

    Ok(completion
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_default())
}

async fn call_anthropic(
    base_url: &str,
    api_key: &str,
    model: &str,
    system_prompt: &str,
    user_content: &str,
    max_tokens: i32,
) -> Result<String, ApiError> {
    let request = AnthropicRequest {
        model: model.to_string(),
        max_tokens,
        system: system_prompt.to_string(),
        messages: vec![AnthropicMessage {
            role: "user".to_string(),
            content: user_content.to_string(),
        }],
    };

    let url = format!("{}/v1/messages", base_url.trim_end_matches('/'));

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| ApiError::ServiceUnavailable(format!("Anthropic request failed: {e}")))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(ApiError::ServiceUnavailable(format!(
            "Anthropic returned {status}: {body}"
        )));
    }

    let result: AnthropicResponse = response
        .json()
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to parse Anthropic response: {e}")))?;

    Ok(result
        .content
        .first()
        .map(|c| c.text.clone())
        .unwrap_or_default())
}

/// Extract JSON from model output, handling thinking tags, code fences, and preamble.
fn extract_json(s: &str) -> String {
    let mut text = s.to_string();

    // Strip <think>...</think> blocks (thinking/reasoning models)
    while let Some(start) = text.find("<think>") {
        if let Some(end) = text.find("</think>") {
            text = format!("{}{}", &text[..start], &text[end + 8..]);
        } else {
            // Unclosed <think> — strip everything from <think> onwards
            text = text[..start].to_string();
            break;
        }
    }

    let trimmed = text.trim();

    // Strip code fences
    let trimmed = if let Some(rest) = trimmed.strip_prefix("```json") {
        rest.strip_suffix("```").unwrap_or(rest).trim()
    } else if let Some(rest) = trimmed.strip_prefix("```") {
        rest.strip_suffix("```").unwrap_or(rest).trim()
    } else {
        trimmed
    };

    // If it already looks like JSON, return it
    if trimmed.starts_with('{') {
        return trimmed.to_string();
    }

    // Last resort: find the first { and last } to extract embedded JSON
    if let Some(start) = trimmed.find('{') {
        if let Some(end) = trimmed.rfind('}') {
            return trimmed[start..=end].to_string();
        }
    }

    trimmed.to_string()
}

// ── XML tag extraction ──────────────────────────────────────────

/// Extract a single field value from `<tag>...</tag>` in the response.
fn extract_xml_field(s: &str, tag: &str) -> Option<String> {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");
    let start = s.find(&open)?;
    let end = s.find(&close)?;
    if end <= start {
        return None;
    }
    Some(s[start + open.len()..end].trim().to_string())
}

/// Try to parse the AI response as XML-tagged output.
/// Returns None if no recognized XML tags are found.
fn parse_xml_response(content: &str, action: &AiAction) -> Option<AiGenerateResponse> {
    let x = |tag: &str| extract_xml_field(content, tag);

    match action {
        AiAction::Seo => {
            let mt = x("meta_title");
            let md = x("meta_description");
            if mt.is_none() && md.is_none() {
                return None;
            }
            Some(AiGenerateResponse {
                meta_title: mt,
                meta_description: md,
                excerpt: None,
                title: None,
                subtitle: None,
                body: None,
            })
        }
        AiAction::Excerpt => {
            let exc = x("excerpt")?;
            Some(AiGenerateResponse {
                meta_title: None,
                meta_description: None,
                excerpt: Some(exc),
                title: None,
                subtitle: None,
                body: None,
            })
        }
        AiAction::Translate => {
            // At least one field must be present
            let title = x("title");
            let subtitle = x("subtitle");
            let excerpt = x("excerpt");
            let body = x("body");
            let mt = x("meta_title");
            let md = x("meta_description");
            if title.is_none() && body.is_none() {
                return None;
            }
            Some(AiGenerateResponse {
                meta_title: mt,
                meta_description: md,
                excerpt,
                title,
                subtitle,
                body,
            })
        }
    }
}

// ── OpenAI model list types ──────────────────────────────────────

#[derive(Debug, Deserialize)]
struct OpenAiModelsResponse {
    data: Vec<OpenAiModel>,
}

#[derive(Debug, Deserialize)]
struct OpenAiModel {
    id: String,
}

// ── Ollama model list types ─────────────────────────────────────

#[derive(Debug, Deserialize)]
struct OllamaTagsResponse {
    models: Vec<OllamaModel>,
}

#[derive(Debug, Deserialize)]
struct OllamaModel {
    name: String,
}

// ── Static model lists ──────────────────────────────────────────

const ANTHROPIC_MODELS: &[&str] = &[
    "claude-opus-4-20250514",
    "claude-sonnet-4-20250514",
    "claude-haiku-4-20250506",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
];

// ── Provider sub-type detection ─────────────────────────────────

fn is_ollama(base_url: &str, provider_name: &str) -> bool {
    let url_lower = base_url.to_lowercase();
    let name_lower = provider_name.to_lowercase();
    name_lower.contains("ollama") || url_lower.contains(":11434")
}

/// Local providers (LM Studio, Ollama, etc.) often don't support `response_format`.
fn is_local_provider(base_url: &str) -> bool {
    let url_lower = base_url.to_lowercase();
    url_lower.contains("localhost")
        || url_lower.contains("127.0.0.1")
        || url_lower.contains("0.0.0.0")
}

// ── Public API ───────────────────────────────────────────────────

/// List available models from a provider (without needing a saved config).
pub async fn list_models(
    base_url: &str,
    api_key: Option<&str>,
    provider_name: &str,
) -> Result<Vec<String>, ApiError> {
    let provider = detect_provider(base_url, provider_name);

    match provider {
        Provider::Anthropic => Ok(ANTHROPIC_MODELS.iter().map(|s| s.to_string()).collect()),
        Provider::OpenAiCompatible => {
            if is_ollama(base_url, provider_name) {
                match list_models_ollama(base_url).await {
                    Ok(models) if !models.is_empty() => Ok(models),
                    _ => list_models_openai_compatible(base_url, api_key).await,
                }
            } else {
                list_models_openai_compatible(base_url, api_key).await
            }
        }
    }
}

async fn list_models_openai_compatible(
    base_url: &str,
    api_key: Option<&str>,
) -> Result<Vec<String>, ApiError> {
    let url = format!("{}/v1/models", base_url.trim_end_matches('/'));
    let client = reqwest::Client::new();
    let mut req = client.get(&url);
    if let Some(key) = api_key {
        if !key.is_empty() {
            req = req.header("Authorization", format!("Bearer {key}"));
        }
    }

    let response = req
        .send()
        .await
        .map_err(|e| ApiError::ServiceUnavailable(format!("Failed to list models: {e}")))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(ApiError::ServiceUnavailable(format!(
            "Model listing returned {status}: {body}"
        )));
    }

    let result: OpenAiModelsResponse = response
        .json()
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to parse models response: {e}")))?;

    let mut models: Vec<String> = result.data.into_iter().map(|m| m.id).collect();
    models.sort();
    Ok(models)
}

async fn list_models_ollama(base_url: &str) -> Result<Vec<String>, ApiError> {
    let url = format!("{}/api/tags", base_url.trim_end_matches('/'));
    let client = reqwest::Client::new();
    let response =
        client.get(&url).send().await.map_err(|e| {
            ApiError::ServiceUnavailable(format!("Failed to list Ollama models: {e}"))
        })?;

    if !response.status().is_success() {
        return Err(ApiError::ServiceUnavailable(
            "Ollama tags endpoint returned an error".into(),
        ));
    }

    let result: OllamaTagsResponse = response
        .json()
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to parse Ollama tags response: {e}")))?;

    let mut models: Vec<String> = result.models.into_iter().map(|m| m.name).collect();
    models.sort();
    Ok(models)
}

/// Generate AI content for a site.
pub async fn generate(
    pool: &PgPool,
    site_id: Uuid,
    encryption_key: &str,
    request: &AiGenerateRequest,
) -> Result<AiGenerateResponse, ApiError> {
    let config = SiteAiConfig::find_by_site_id(pool, site_id)
        .await?
        .ok_or_else(|| ApiError::BadRequest("AI is not configured for this site".into()))?;

    let key = encryption::resolve_key(encryption_key)?;
    let api_key = encryption::decrypt(&config.api_key_encrypted, &config.api_key_nonce, &key)?;

    let provider = detect_provider(&config.base_url, &config.provider_name);
    // Only use JSON mode for cloud OpenAI-compatible providers (they support response_format)
    let use_json_mode =
        provider == Provider::OpenAiCompatible && !is_local_provider(&config.base_url);

    // Translations use parallel field-by-field requests for reliability
    if request.action == AiAction::Translate {
        tracing::info!("Using parallel field-by-field translation");
        return generate_translate_parallel(&config, &api_key, &provider, request).await;
    }

    let action_key = match &request.action {
        AiAction::Seo => "seo",
        AiAction::Excerpt => "excerpt",
        AiAction::Translate => unreachable!(),
    };

    // Build system prompt: content instructions + format suffix
    // Custom prompts get old format instructions stripped before appending the correct format
    let content_prompt = config
        .system_prompts
        .get(action_key)
        .and_then(|v| v.as_str())
        .map(|s| strip_format_instructions(s).to_string())
        .unwrap_or_else(|| default_content_prompt(&request.action, None));
    let system_prompt = format!(
        "{content_prompt}{}",
        format_suffix(&request.action, use_json_mode)
    );

    let raw = match provider {
        Provider::OpenAiCompatible => {
            call_openai_compatible(&OpenAiCallParams {
                base_url: &config.base_url,
                api_key: &api_key,
                model: &config.model,
                system_prompt: &system_prompt,
                user_content: &request.content,
                temperature: config.temperature,
                max_tokens: config.max_tokens,
                use_json_mode,
            })
            .await?
        }
        Provider::Anthropic => {
            call_anthropic(
                &config.base_url,
                &api_key,
                &config.model,
                &system_prompt,
                &request.content,
                config.max_tokens,
            )
            .await?
        }
    };

    // Extract JSON from model output (handles thinking tags, code fences, preamble)
    let content = extract_json(&raw);
    parse_ai_response(&content, &request.action)
}

/// Translate content field-by-field in parallel.
/// Each field gets its own simple "translate this text" request,
/// so the model never has to produce structured output.
async fn generate_translate_parallel(
    config: &SiteAiConfig,
    api_key: &str,
    provider: &Provider,
    request: &AiGenerateRequest,
) -> Result<AiGenerateResponse, ApiError> {
    let locale = request.target_locale.as_deref().unwrap_or("en");

    // Parse the incoming content as JSON with individual fields
    let fields: serde_json::Value = serde_json::from_str(&request.content).map_err(|e| {
        ApiError::BadRequest(format!("Translation request content must be JSON: {e}"))
    })?;

    let field_names = [
        "title",
        "subtitle",
        "excerpt",
        "body",
        "meta_title",
        "meta_description",
    ];

    // Collect non-empty fields to translate
    let tasks: Vec<(&str, String)> = field_names
        .iter()
        .filter_map(|&name| {
            fields
                .get(name)
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(|s| (name, s.to_string()))
        })
        .collect();

    if tasks.is_empty() {
        return Err(ApiError::BadRequest(
            "No content fields to translate".into(),
        ));
    }

    let system_prompt = format!(
        "You are a professional translator. Translate the following text to {locale}. \
         Maintain the original tone, style, and any markdown formatting. \
         Output ONLY the translated text, nothing else — no labels, no explanations."
    );

    // Send all translation requests in parallel
    let futures: Vec<_> = tasks
        .iter()
        .map(|(_, text)| translate_single_field(config, api_key, provider, &system_prompt, text))
        .collect();

    let results = futures::future::join_all(futures).await;

    // Assemble results into the response
    let mut response = AiGenerateResponse {
        meta_title: None,
        meta_description: None,
        excerpt: None,
        title: None,
        subtitle: None,
        body: None,
    };

    for ((name, original), result) in tasks.iter().zip(results) {
        let translated = result?;
        tracing::info!(
            "Translated field '{}': '{}' → '{}'",
            name,
            &original[..original.len().min(50)],
            &translated[..translated.len().min(80)]
        );
        match *name {
            "title" => response.title = Some(translated),
            "subtitle" => response.subtitle = Some(translated),
            "excerpt" => response.excerpt = Some(translated),
            "body" => response.body = Some(translated),
            "meta_title" => response.meta_title = Some(translated),
            "meta_description" => response.meta_description = Some(translated),
            _ => {}
        }
    }

    Ok(response)
}

/// Translate a single text field. Returns the raw translated text.
async fn translate_single_field(
    config: &SiteAiConfig,
    api_key: &str,
    provider: &Provider,
    system_prompt: &str,
    text: &str,
) -> Result<String, ApiError> {
    let raw = match provider {
        Provider::OpenAiCompatible => {
            call_openai_compatible(&OpenAiCallParams {
                base_url: &config.base_url,
                api_key,
                model: &config.model,
                system_prompt,
                user_content: text,
                temperature: config.temperature,
                max_tokens: config.max_tokens,
                // Never use json_mode for plain text translation
                use_json_mode: false,
            })
            .await?
        }
        Provider::Anthropic => {
            call_anthropic(
                &config.base_url,
                api_key,
                &config.model,
                system_prompt,
                text,
                config.max_tokens,
            )
            .await?
        }
    };

    // Strip any thinking tags or code fences the model might wrap the translation in
    let cleaned = extract_json(&raw);
    // If it looks like JSON (model ignored instructions), try to extract the value
    if cleaned.starts_with('{') {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&cleaned) {
            // Return the first string value found
            if let Some(obj) = json.as_object() {
                for (_, v) in obj {
                    if let Some(s) = v.as_str() {
                        return Ok(s.to_string());
                    }
                }
            }
        }
    }
    Ok(cleaned)
}

/// Test connection to AI provider.
pub async fn test_connection(
    pool: &PgPool,
    site_id: Uuid,
    encryption_key: &str,
) -> Result<(), ApiError> {
    let config = SiteAiConfig::find_by_site_id(pool, site_id)
        .await?
        .ok_or_else(|| ApiError::BadRequest("AI is not configured for this site".into()))?;

    let key = encryption::resolve_key(encryption_key)?;
    let api_key = encryption::decrypt(&config.api_key_encrypted, &config.api_key_nonce, &key)?;

    let provider = detect_provider(&config.base_url, &config.provider_name);
    let base_url = config.base_url.trim_end_matches('/');

    let client = reqwest::Client::new();

    match provider {
        Provider::OpenAiCompatible => {
            let chat_request = ChatCompletionRequest {
                model: config.model.clone(),
                messages: vec![ChatMessage {
                    role: "user".to_string(),
                    content: "Say hello in one word.".to_string(),
                }],
                temperature: 0.0,
                max_tokens: 10,
                response_format: None,
            };

            let mut req = client
                .post(format!("{base_url}/v1/chat/completions"))
                .header("Content-Type", "application/json");
            if !api_key.is_empty() {
                req = req.header("Authorization", format!("Bearer {api_key}"));
            }
            let response = req.json(&chat_request).send().await.map_err(|e| {
                ApiError::ServiceUnavailable(format!("AI provider request failed: {e}"))
            })?;

            if !response.status().is_success() {
                let status = response.status();
                let body = response.text().await.unwrap_or_default();
                return Err(ApiError::ServiceUnavailable(format!(
                    "AI provider returned {status}: {body}"
                )));
            }
        }
        Provider::Anthropic => {
            let request = AnthropicRequest {
                model: config.model.clone(),
                max_tokens: 10,
                system: "Respond with one word.".to_string(),
                messages: vec![AnthropicMessage {
                    role: "user".to_string(),
                    content: "Say hello.".to_string(),
                }],
            };

            let response = client
                .post(format!("{base_url}/v1/messages"))
                .header("x-api-key", &api_key)
                .header("anthropic-version", "2023-06-01")
                .header("Content-Type", "application/json")
                .json(&request)
                .send()
                .await
                .map_err(|e| {
                    ApiError::ServiceUnavailable(format!("Anthropic request failed: {e}"))
                })?;

            if !response.status().is_success() {
                let status = response.status();
                let body = response.text().await.unwrap_or_default();
                return Err(ApiError::ServiceUnavailable(format!(
                    "Anthropic returned {status}: {body}"
                )));
            }
        }
    }

    Ok(())
}

/// Escape literal control characters inside JSON string values.
/// Local models often produce JSON with raw newlines in strings, which is invalid JSON.
fn sanitize_json_strings(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut in_string = false;
    let mut escape_next = false;

    for c in s.chars() {
        if in_string {
            if escape_next {
                result.push(c);
                escape_next = false;
                continue;
            }
            match c {
                '"' => {
                    in_string = false;
                    result.push(c);
                }
                '\\' => {
                    escape_next = true;
                    result.push(c);
                }
                c if c.is_control() => match c {
                    '\n' => result.push_str("\\n"),
                    '\r' => result.push_str("\\r"),
                    '\t' => result.push_str("\\t"),
                    _ => {}
                },
                _ => result.push(c),
            }
        } else {
            if c == '"' {
                in_string = true;
            }
            result.push(c);
        }
    }

    result
}

fn parse_ai_response(content: &str, action: &AiAction) -> Result<AiGenerateResponse, ApiError> {
    // 1. Try strict JSON parsing (handles well-formed output from json_object mode)
    let sanitized = sanitize_json_strings(content);
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&sanitized) {
        return Ok(build_response(&json, action));
    }

    // 2. Try XML tag extraction (handles local/Anthropic models with XML prompts)
    if let Some(response) = parse_xml_response(content, action) {
        return Ok(response);
    }

    // 3. Fall back to lenient key-based extraction for models that produce
    // unescaped quotes in values (e.g. code blocks with string literals)
    let fields = extract_fields_lenient(content);
    if fields.is_empty() {
        return Err(ApiError::Internal(format!(
            "AI response contains no recognizable fields. Raw: {content}"
        )));
    }

    let json = serde_json::Value::Object(fields);
    Ok(build_response(&json, action))
}

fn build_response(json: &serde_json::Value, action: &AiAction) -> AiGenerateResponse {
    let s = |key: &str| json.get(key).and_then(|v| v.as_str()).map(String::from);

    match action {
        AiAction::Seo => AiGenerateResponse {
            meta_title: s("meta_title"),
            meta_description: s("meta_description"),
            excerpt: None,
            title: None,
            subtitle: None,
            body: None,
        },
        AiAction::Excerpt => AiGenerateResponse {
            meta_title: None,
            meta_description: None,
            excerpt: s("excerpt"),
            title: None,
            subtitle: None,
            body: None,
        },
        AiAction::Translate => AiGenerateResponse {
            meta_title: s("meta_title"),
            meta_description: s("meta_description"),
            excerpt: s("excerpt"),
            title: s("title"),
            subtitle: s("subtitle"),
            body: s("body"),
        },
    }
}

/// Extract field values using known key names as delimiters.
/// Handles models that produce unescaped quotes inside string values.
const KNOWN_KEYS: &[&str] = &[
    "meta_title",
    "meta_description",
    "title",
    "subtitle",
    "excerpt",
    "body",
];

fn extract_fields_lenient(raw: &str) -> serde_json::Map<String, serde_json::Value> {
    let mut key_positions: Vec<(&str, usize)> = Vec::new();

    for &key in KNOWN_KEYS {
        // Match "key": " with optional whitespace
        let pattern = format!("\"{key}\": \"");
        if let Some(pos) = raw.find(&pattern) {
            key_positions.push((key, pos + pattern.len()));
        } else {
            let pattern2 = format!("\"{key}\":\"");
            if let Some(pos) = raw.find(&pattern2) {
                key_positions.push((key, pos + pattern2.len()));
            }
        }
    }

    key_positions.sort_by_key(|&(_, pos)| pos);

    let mut result = serde_json::Map::new();

    for (i, &(key, value_start)) in key_positions.iter().enumerate() {
        let search_end = if i + 1 < key_positions.len() {
            // Find where the next key's `"key"` pattern starts
            let next_key = key_positions[i + 1].0;
            let next_pattern = format!("\"{next_key}\"");
            raw.find(&next_pattern).unwrap_or(raw.len())
        } else {
            raw.len()
        };

        let slice = &raw[value_start..search_end];

        // The value ends at the last `"` in this slice (the closing quote before the next key or `}`)
        let value = if let Some(last_quote) = slice.rfind('"') {
            &slice[..last_quote]
        } else {
            slice.trim()
        };

        result.insert(
            key.to_string(),
            serde_json::Value::String(value.to_string()),
        );
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_provider_openai() {
        assert_eq!(
            detect_provider("https://api.openai.com", "OpenAI"),
            Provider::OpenAiCompatible
        );
    }

    #[test]
    fn test_detect_provider_mistral() {
        assert_eq!(
            detect_provider("https://api.mistral.ai", "Mistral"),
            Provider::OpenAiCompatible
        );
    }

    #[test]
    fn test_detect_provider_anthropic_by_url() {
        assert_eq!(
            detect_provider("https://api.anthropic.com", "My Provider"),
            Provider::Anthropic
        );
    }

    #[test]
    fn test_detect_provider_anthropic_by_name_claude() {
        assert_eq!(
            detect_provider("https://custom.proxy.com", "Claude"),
            Provider::Anthropic
        );
    }

    #[test]
    fn test_detect_provider_anthropic_by_name_anthropic() {
        assert_eq!(
            detect_provider("https://custom.proxy.com", "Anthropic"),
            Provider::Anthropic
        );
    }

    #[test]
    fn test_detect_provider_generic() {
        assert_eq!(
            detect_provider("https://my-llm-proxy.com", "Custom LLM"),
            Provider::OpenAiCompatible
        );
    }

    #[test]
    fn test_extract_json_code_fences() {
        let input = "```json\n{\"key\": \"value\"}\n```";
        assert_eq!(extract_json(input), "{\"key\": \"value\"}");
    }

    #[test]
    fn test_extract_json_plain_fences() {
        let input = "```\n{\"key\": \"value\"}\n```";
        assert_eq!(extract_json(input), "{\"key\": \"value\"}");
    }

    #[test]
    fn test_extract_json_plain() {
        let input = "{\"key\": \"value\"}";
        assert_eq!(extract_json(input), "{\"key\": \"value\"}");
    }

    #[test]
    fn test_extract_json_thinking_tags() {
        let input = "<think>Let me think about this...\nOk I got it.</think>\n{\"key\": \"value\"}";
        assert_eq!(extract_json(input), "{\"key\": \"value\"}");
    }

    #[test]
    fn test_extract_json_thinking_with_code_fences() {
        let input = "<think>Reasoning here</think>\n```json\n{\"key\": \"value\"}\n```";
        assert_eq!(extract_json(input), "{\"key\": \"value\"}");
    }

    #[test]
    fn test_extract_json_preamble_text() {
        let input = "Here is the result:\n{\"key\": \"value\"}";
        assert_eq!(extract_json(input), "{\"key\": \"value\"}");
    }

    #[test]
    fn test_parse_seo_response() {
        let json = r#"{"meta_title": "My Title", "meta_description": "My description"}"#;
        let result = parse_ai_response(json, &AiAction::Seo).unwrap();
        assert_eq!(result.meta_title.unwrap(), "My Title");
        assert_eq!(result.meta_description.unwrap(), "My description");
        assert!(result.excerpt.is_none());
    }

    #[test]
    fn test_parse_excerpt_response() {
        let json = r#"{"excerpt": "A short summary."}"#;
        let result = parse_ai_response(json, &AiAction::Excerpt).unwrap();
        assert_eq!(result.excerpt.unwrap(), "A short summary.");
        assert!(result.meta_title.is_none());
    }

    #[test]
    fn test_parse_translate_response() {
        let json = r#"{"title": "Titel", "body": "Inhalt", "meta_title": "SEO Titel", "meta_description": "SEO Beschreibung"}"#;
        let result = parse_ai_response(json, &AiAction::Translate).unwrap();
        assert_eq!(result.title.unwrap(), "Titel");
        assert_eq!(result.body.unwrap(), "Inhalt");
    }

    #[test]
    fn test_parse_invalid_json() {
        let result = parse_ai_response("not json", &AiAction::Seo);
        assert!(result.is_err());
    }

    #[test]
    fn test_sanitize_json_literal_newlines_in_strings() {
        // Simulates local model output with literal newlines inside string values
        let input = "{\n  \"title\": \"Hello\",\n  \"body\": \"Line one\nLine two\nLine three\"\n}";
        let sanitized = sanitize_json_strings(input);
        let parsed: serde_json::Value = serde_json::from_str(&sanitized).unwrap();
        assert_eq!(parsed["title"].as_str().unwrap(), "Hello");
        // After sanitization + parsing, literal newlines become actual \n characters
        assert!(parsed["body"]
            .as_str()
            .unwrap()
            .contains("Line one\nLine two"));
    }

    #[test]
    fn test_sanitize_preserves_escaped_sequences() {
        let input = r#"{"body": "already escaped\\nnewline"}"#;
        let sanitized = sanitize_json_strings(input);
        let parsed: serde_json::Value = serde_json::from_str(&sanitized).unwrap();
        assert_eq!(
            parsed["body"].as_str().unwrap(),
            "already escaped\\nnewline"
        );
    }

    #[test]
    fn test_parse_response_with_literal_newlines() {
        // End-to-end: raw model output with literal newlines parses correctly
        let raw =
            "{\n  \"meta_title\": \"My Title\",\n  \"meta_description\": \"Line 1\nLine 2\"\n}";
        let result = parse_ai_response(raw, &AiAction::Seo).unwrap();
        assert_eq!(result.meta_title.unwrap(), "My Title");
        assert!(result.meta_description.unwrap().contains("Line 1"));
    }

    #[test]
    fn test_parse_response_with_unescaped_quotes() {
        // Simulates local model output with code containing unescaped quotes
        let raw = r#"{
  "meta_title": "My Title",
  "meta_description": "A description with "quotes" inside"
}"#;
        let result = parse_ai_response(raw, &AiAction::Seo).unwrap();
        assert_eq!(result.meta_title.unwrap(), "My Title");
        assert!(result.meta_description.unwrap().contains("quotes"));
    }

    #[test]
    fn test_lenient_parser_with_code_block() {
        // Simulates translate output with code containing unescaped quotes
        let raw = r#"{
  "title": "Hello World",
  "subtitle": "A test",
  "excerpt": "Summary",
  "body": "Some code: println!("hello") and more text",
  "meta_title": "SEO Title",
  "meta_description": "SEO Desc"
}"#;
        let result = parse_ai_response(raw, &AiAction::Translate).unwrap();
        assert_eq!(result.title.unwrap(), "Hello World");
        assert!(result.body.unwrap().contains("println"));
        assert_eq!(result.meta_title.unwrap(), "SEO Title");
        assert_eq!(result.meta_description.unwrap(), "SEO Desc");
    }

    #[test]
    fn test_extract_xml_field_simple() {
        let input = "<title>Hello World</title>";
        assert_eq!(extract_xml_field(input, "title").unwrap(), "Hello World");
    }

    #[test]
    fn test_extract_xml_field_with_whitespace() {
        let input = "<excerpt>\n  A short summary.\n</excerpt>";
        assert_eq!(
            extract_xml_field(input, "excerpt").unwrap(),
            "A short summary."
        );
    }

    #[test]
    fn test_extract_xml_field_missing() {
        let input = "<title>Hello</title>";
        assert!(extract_xml_field(input, "body").is_none());
    }

    #[test]
    fn test_extract_xml_field_with_markdown() {
        let input = "<body>## Heading\n\nSome **bold** text with `code` and \"quotes\"</body>";
        let result = extract_xml_field(input, "body").unwrap();
        assert!(result.contains("**bold**"));
        assert!(result.contains("\"quotes\""));
    }

    #[test]
    fn test_parse_xml_seo_response() {
        let input = "<meta_title>My SEO Title</meta_title>\n<meta_description>A great description for SEO</meta_description>";
        let result = parse_xml_response(input, &AiAction::Seo).unwrap();
        assert_eq!(result.meta_title.unwrap(), "My SEO Title");
        assert_eq!(
            result.meta_description.unwrap(),
            "A great description for SEO"
        );
    }

    #[test]
    fn test_parse_xml_excerpt_response() {
        let input = "<excerpt>This is a concise summary of the article.</excerpt>";
        let result = parse_xml_response(input, &AiAction::Excerpt).unwrap();
        assert_eq!(
            result.excerpt.unwrap(),
            "This is a concise summary of the article."
        );
    }

    #[test]
    fn test_parse_xml_translate_response() {
        let input = "<title>Titel</title>\n<subtitle>Untertitel</subtitle>\n<excerpt>Zusammenfassung</excerpt>\n<body>Der Inhalt mit **Markdown**</body>\n<meta_title>SEO Titel</meta_title>\n<meta_description>SEO Beschreibung</meta_description>";
        let result = parse_xml_response(input, &AiAction::Translate).unwrap();
        assert_eq!(result.title.unwrap(), "Titel");
        assert_eq!(result.subtitle.unwrap(), "Untertitel");
        assert_eq!(result.excerpt.unwrap(), "Zusammenfassung");
        assert_eq!(result.body.unwrap(), "Der Inhalt mit **Markdown**");
        assert_eq!(result.meta_title.unwrap(), "SEO Titel");
        assert_eq!(result.meta_description.unwrap(), "SEO Beschreibung");
    }

    #[test]
    fn test_parse_xml_with_thinking_tags() {
        // Models may still include <think> blocks before XML output
        let input = "<think>Let me translate this...</think>\n<meta_title>My Title</meta_title>\n<meta_description>My Desc</meta_description>";
        let cleaned = extract_json(input);
        // extract_json strips <think>, then we try XML
        let result = parse_xml_response(&cleaned, &AiAction::Seo).unwrap();
        assert_eq!(result.meta_title.unwrap(), "My Title");
    }

    #[test]
    fn test_parse_xml_no_tags_returns_none() {
        let input = "Just some random text without any XML tags.";
        assert!(parse_xml_response(input, &AiAction::Seo).is_none());
    }

    #[test]
    fn test_parse_response_prefers_json_over_xml() {
        // If valid JSON is present, it should be used even if XML tags also exist
        let input = r#"{"meta_title": "JSON Title", "meta_description": "JSON Desc"}"#;
        let result = parse_ai_response(input, &AiAction::Seo).unwrap();
        assert_eq!(result.meta_title.unwrap(), "JSON Title");
    }

    #[test]
    fn test_parse_response_falls_back_to_xml() {
        // Invalid JSON but valid XML tags
        let input = "Here is the result:\n<meta_title>XML Title</meta_title>\n<meta_description>XML Desc</meta_description>";
        let result = parse_ai_response(input, &AiAction::Seo).unwrap();
        assert_eq!(result.meta_title.unwrap(), "XML Title");
        assert_eq!(result.meta_description.unwrap(), "XML Desc");
    }

    #[test]
    fn test_xml_translate_with_code_in_body() {
        // This is the key advantage: code with quotes doesn't break XML parsing
        let input = "<title>Hello World</title>\n<subtitle>A test</subtitle>\n<excerpt>Summary</excerpt>\n<body>Some code: `println!(\"hello\")` and more text</body>\n<meta_title>SEO Title</meta_title>\n<meta_description>SEO Desc</meta_description>";
        let result = parse_xml_response(input, &AiAction::Translate).unwrap();
        assert_eq!(result.title.unwrap(), "Hello World");
        assert!(result.body.unwrap().contains("println"));
        assert_eq!(result.meta_title.unwrap(), "SEO Title");
        assert_eq!(result.meta_description.unwrap(), "SEO Desc");
    }

    #[test]
    fn test_content_prompt_seo() {
        let prompt = default_content_prompt(&AiAction::Seo, None);
        assert!(prompt.contains("meta title"));
        assert!(prompt.contains("60 characters"));
    }

    #[test]
    fn test_format_suffix_json_seo() {
        let suffix = format_suffix(&AiAction::Seo, true);
        assert!(suffix.contains("JSON"));
        assert!(suffix.contains("meta_title"));
    }

    #[test]
    fn test_format_suffix_xml_seo() {
        let suffix = format_suffix(&AiAction::Seo, false);
        assert!(suffix.contains("<meta_title>"));
        assert!(suffix.contains("XML"));
    }

    #[test]
    fn test_format_suffix_json_translate() {
        let suffix = format_suffix(&AiAction::Translate, true);
        assert!(suffix.contains("JSON"));
        assert!(suffix.contains("body"));
    }

    #[test]
    fn test_format_suffix_xml_translate() {
        let suffix = format_suffix(&AiAction::Translate, false);
        assert!(suffix.contains("<title>"));
        assert!(suffix.contains("<body>"));
    }

    #[test]
    fn test_combined_prompt_json() {
        let content = default_content_prompt(&AiAction::Seo, None);
        let full = format!("{content}{}", format_suffix(&AiAction::Seo, true));
        assert!(full.contains("SEO expert"));
        assert!(full.contains("JSON"));
    }

    #[test]
    fn test_combined_prompt_xml() {
        let content = default_content_prompt(&AiAction::Translate, Some("de"));
        let full = format!("{content}{}", format_suffix(&AiAction::Translate, false));
        assert!(full.contains("to de"));
        assert!(full.contains("<title>"));
    }

    #[test]
    fn test_strip_format_instructions_json() {
        let prompt =
            "You are an SEO expert.\nRespond with ONLY valid JSON in this exact format: {}";
        assert_eq!(strip_format_instructions(prompt), "You are an SEO expert.");
    }

    #[test]
    fn test_strip_format_instructions_xml() {
        let prompt =
            "You are a translator.\nRespond using ONLY these XML tags:\n<title>...</title>";
        assert_eq!(strip_format_instructions(prompt), "You are a translator.");
    }

    #[test]
    fn test_strip_format_instructions_none() {
        let prompt = "You are a content editor. Generate a summary.";
        assert_eq!(strip_format_instructions(prompt), prompt);
    }

    #[test]
    fn test_is_ollama_by_port() {
        assert!(is_ollama("http://localhost:11434", "My LLM"));
    }

    #[test]
    fn test_is_ollama_by_name() {
        assert!(is_ollama("http://my-server:8080", "Ollama"));
    }

    #[test]
    fn test_is_not_ollama() {
        assert!(!is_ollama("http://localhost:1234", "LM Studio"));
    }

    #[test]
    fn test_is_local_provider() {
        assert!(is_local_provider("http://localhost:1234"));
        assert!(is_local_provider("http://127.0.0.1:11434"));
        assert!(!is_local_provider("https://api.openai.com"));
        assert!(!is_local_provider("https://api.anthropic.com"));
    }

    #[test]
    fn test_anthropic_models_static_list() {
        assert!(!ANTHROPIC_MODELS.is_empty());
        assert!(ANTHROPIC_MODELS.iter().any(|m| m.contains("claude")));
    }
}
