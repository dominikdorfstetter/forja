//! Vision/multimodal response parsing (issue #929).
//!
//! Turns a vision provider's raw text (JSON or loose) into an
//! `AiGenerateResponse` for the auto-tag / alt-text / caption / title actions.
//! Pure of the provider seam and the network.

use crate::dto::ai::{AiAction, AiGenerateResponse};
use crate::errors::ApiError;

pub(crate) fn parse_vision_response(
    raw: &str,
    action: &AiAction,
) -> Result<AiGenerateResponse, ApiError> {
    let cleaned = extract_json(raw);

    // Try JSON parse first
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&cleaned) {
        match action {
            AiAction::AutoTag => {
                let tags = v.get("tags").and_then(|t| t.as_array()).map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                });
                return Ok(AiGenerateResponse {
                    tags,
                    ..Default::default()
                });
            }
            AiAction::AltText => {
                let alt = v.get("alt_text").and_then(|t| t.as_str()).map(String::from);
                return Ok(AiGenerateResponse {
                    alt_text: alt,
                    ..Default::default()
                });
            }
            AiAction::ImageCaption => {
                let caption = v.get("caption").and_then(|t| t.as_str()).map(String::from);
                return Ok(AiGenerateResponse {
                    subtitle: caption,
                    ..Default::default()
                });
            }
            AiAction::ImageTitle => {
                let title = v.get("title").and_then(|t| t.as_str()).map(String::from);
                return Ok(AiGenerateResponse {
                    title,
                    ..Default::default()
                });
            }
            _ => {}
        }
    }

    // Fallback: extract from raw text
    match action {
        AiAction::AutoTag => {
            // Try to find JSON array in the text
            if let Some(start) = cleaned.find('[') {
                if let Some(end) = cleaned.rfind(']') {
                    if let Ok(arr) = serde_json::from_str::<Vec<String>>(&cleaned[start..=end]) {
                        return Ok(AiGenerateResponse {
                            tags: Some(arr),
                            ..Default::default()
                        });
                    }
                }
            }
            Ok(AiGenerateResponse {
                tags: Some(
                    cleaned
                        .split(',')
                        .map(|s| s.trim().trim_matches('"').to_lowercase())
                        .collect(),
                ),
                ..Default::default()
            })
        }
        AiAction::AltText => Ok(AiGenerateResponse {
            alt_text: Some(cleaned.trim().trim_matches('"').to_string()),
            ..Default::default()
        }),
        AiAction::ImageCaption => Ok(AiGenerateResponse {
            subtitle: Some(extract_json_string_value(&cleaned, "caption")),
            ..Default::default()
        }),
        AiAction::ImageTitle => Ok(AiGenerateResponse {
            title: Some(extract_json_string_value(&cleaned, "title")),
            ..Default::default()
        }),
        _ => Ok(AiGenerateResponse::default()),
    }
}

/// Extract JSON from model output, handling thinking tags, code fences, and preamble.
pub(crate) fn extract_json(s: &str) -> String {
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

/// Extract a string value from potentially malformed JSON text.
/// Falls back to stripping JSON noise from the raw text.
pub(crate) fn extract_json_string_value(text: &str, key: &str) -> String {
    let needle = format!("\"{key}\"");
    if let Some(key_pos) = text.find(&needle) {
        // Find the colon after the key
        let after_key = &text[key_pos + needle.len()..];
        if let Some(colon_pos) = after_key.find(':') {
            let after_colon = after_key[colon_pos + 1..].trim_start();
            // If the value starts with a quote, extract the quoted string
            if let Some(value_body) = after_colon.strip_prefix('"') {
                // Find the closing quote (handle escaped quotes)
                let mut end = 0;
                let chars: Vec<char> = value_body.chars().collect();
                while end < chars.len() {
                    if chars[end] == '\\' {
                        end += 2; // skip escaped char
                    } else if chars[end] == '"' {
                        break;
                    } else {
                        end += 1;
                    }
                }
                let byte_end = value_body
                    .char_indices()
                    .nth(end)
                    .map(|(i, _)| i)
                    .unwrap_or(value_body.len());
                return value_body[..byte_end].to_string();
            }
        }
    }
    // Fallback: strip common JSON artifacts
    text.trim()
        .trim_matches(|c| c == '{' || c == '}' || c == '"')
        .trim()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_vision_response_reads_alt_text_json() {
        // Tracer (#929): a vision JSON payload parses to alt_text without a network call.
        let raw = r#"{"alt_text": "A golden retriever on a beach"}"#;
        let resp = parse_vision_response(raw, &AiAction::AltText).expect("parses");
        assert_eq!(
            resp.alt_text.as_deref(),
            Some("A golden retriever on a beach")
        );
    }

    #[test]
    fn extract_json_strips_markdown_fences() {
        let fenced = "```json\n{\"alt_text\": \"x\"}\n```";
        assert!(extract_json(fenced).contains("\"alt_text\""));
    }
}
