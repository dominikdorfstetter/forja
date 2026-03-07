//! AI content generation service — proxies requests to OpenAI-compatible providers.

use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::ai::{AiAction, AiGenerateRequest, AiGenerateResponse};
use crate::errors::ApiError;
use crate::models::ai_config::SiteAiConfig;
use crate::services::encryption;

// ── OpenAI-compatible types ────────────────────────────────────────

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f64,
    max_tokens: i32,
    response_format: Option<ResponseFormat>,
}

#[derive(Debug, Serialize)]
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

// ── Default system prompts ─────────────────────────────────────────

fn default_system_prompt(action: &AiAction, target_locale: Option<&str>) -> String {
    match action {
        AiAction::Seo => {
            "You are an SEO expert. Generate an SEO-optimized meta title (max 60 characters) \
             and meta description (max 160 characters) from the provided blog content. \
             Respond with ONLY valid JSON in this exact format: \
             {\"meta_title\": \"...\", \"meta_description\": \"...\"}"
                .to_string()
        }
        AiAction::Excerpt => {
            "You are a content editor. Generate a concise 1-2 sentence excerpt that \
             summarizes the key points of the provided blog content. \
             Respond with ONLY valid JSON in this exact format: \
             {\"excerpt\": \"...\"}"
                .to_string()
        }
        AiAction::Translate => {
            let locale = target_locale.unwrap_or("en");
            format!(
                "You are a professional translator. Translate the following content to {locale}. \
                 Maintain the original tone, style, and markdown formatting. \
                 Respond with ONLY valid JSON in this exact format: \
                 {{\"title\": \"...\", \"subtitle\": \"...\", \"excerpt\": \"...\", \
                 \"body\": \"...\", \"meta_title\": \"...\", \"meta_description\": \"...\"}}"
            )
        }
    }
}

// ── Public API ─────────────────────────────────────────────────────

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

    let action_key = match &request.action {
        AiAction::Seo => "seo",
        AiAction::Excerpt => "excerpt",
        AiAction::Translate => "translate",
    };
    let system_prompt = config
        .system_prompts
        .get(action_key)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            default_system_prompt(&request.action, request.target_locale.as_deref())
        });

    let chat_request = ChatCompletionRequest {
        model: config.model.clone(),
        messages: vec![
            ChatMessage {
                role: "system".to_string(),
                content: system_prompt,
            },
            ChatMessage {
                role: "user".to_string(),
                content: request.content.clone(),
            },
        ],
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        response_format: Some(ResponseFormat {
            format_type: "json_object".to_string(),
        }),
    };

    let base_url = config.base_url.trim_end_matches('/');
    let url = format!("{base_url}/v1/chat/completions");

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Content-Type", "application/json")
        .json(&chat_request)
        .send()
        .await
        .map_err(|e| ApiError::ServiceUnavailable(format!("AI provider request failed: {e}")))?;

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

    let content = completion
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_default();

    parse_ai_response(&content, &request.action)
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

    let base_url = config.base_url.trim_end_matches('/');
    let url = format!("{base_url}/v1/chat/completions");

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Content-Type", "application/json")
        .json(&chat_request)
        .send()
        .await
        .map_err(|e| ApiError::ServiceUnavailable(format!("AI provider request failed: {e}")))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(ApiError::ServiceUnavailable(format!(
            "AI provider returned {status}: {body}"
        )));
    }

    Ok(())
}

fn parse_ai_response(content: &str, action: &AiAction) -> Result<AiGenerateResponse, ApiError> {
    let json: serde_json::Value = serde_json::from_str(content).map_err(|e| {
        ApiError::Internal(format!("AI returned invalid JSON: {e}. Raw: {content}"))
    })?;

    Ok(match action {
        AiAction::Seo => AiGenerateResponse {
            meta_title: json
                .get("meta_title")
                .and_then(|v| v.as_str())
                .map(String::from),
            meta_description: json
                .get("meta_description")
                .and_then(|v| v.as_str())
                .map(String::from),
            excerpt: None,
            title: None,
            subtitle: None,
            body: None,
        },
        AiAction::Excerpt => AiGenerateResponse {
            meta_title: None,
            meta_description: None,
            excerpt: json
                .get("excerpt")
                .and_then(|v| v.as_str())
                .map(String::from),
            title: None,
            subtitle: None,
            body: None,
        },
        AiAction::Translate => AiGenerateResponse {
            meta_title: json
                .get("meta_title")
                .and_then(|v| v.as_str())
                .map(String::from),
            meta_description: json
                .get("meta_description")
                .and_then(|v| v.as_str())
                .map(String::from),
            excerpt: json
                .get("excerpt")
                .and_then(|v| v.as_str())
                .map(String::from),
            title: json.get("title").and_then(|v| v.as_str()).map(String::from),
            subtitle: json
                .get("subtitle")
                .and_then(|v| v.as_str())
                .map(String::from),
            body: json.get("body").and_then(|v| v.as_str()).map(String::from),
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn test_default_system_prompt_seo() {
        let prompt = default_system_prompt(&AiAction::Seo, None);
        assert!(prompt.contains("meta title"));
        assert!(prompt.contains("60 characters"));
    }

    #[test]
    fn test_default_system_prompt_translate_with_locale() {
        let prompt = default_system_prompt(&AiAction::Translate, Some("de"));
        assert!(prompt.contains("to de"));
    }
}
