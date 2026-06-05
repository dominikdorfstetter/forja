//! Parse + post-process AI provider responses into `AiGenerateResponse`.
//!
//! Extracted from the `ai_service` orchestrator (issue #928): JSON sanitisation,
//! XML-tag extraction, lenient key-based extraction, the per-action response
//! builder, and SEO/body post-processing. Pure functions over the provider's
//! raw text — unit-testable without a network call.

use crate::dto::ai::{AiAction, AiGenerateResponse};
use crate::errors::{codes, ApiError};

pub(crate) fn extract_xml_field(s: &str, tag: &str) -> Option<String> {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");
    let start = s.find(&open)?;
    let end = s.find(&close)?;
    if end <= start {
        return None;
    }
    let raw = s[start + open.len()..end].trim();
    Some(unescape_json_string(raw))
}

/// Extract all occurrences of a repeated XML tag (e.g. multiple `<outline>` elements).
pub(crate) fn extract_all_xml_fields(s: &str, tag: &str) -> Vec<String> {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");
    let mut results = Vec::new();
    let mut search_from = 0;
    while let Some(start) = s[search_from..].find(&open) {
        let abs_start = search_from + start + open.len();
        if let Some(end) = s[abs_start..].find(&close) {
            let text = s[abs_start..abs_start + end].trim().to_string();
            if !text.is_empty() {
                results.push(text);
            }
            search_from = abs_start + end + close.len();
        } else {
            break;
        }
    }
    results
}

/// Try to parse the AI response as XML-tagged output.
/// Returns None if no recognized XML tags are found.
pub(crate) fn parse_xml_response(content: &str, action: &AiAction) -> Option<AiGenerateResponse> {
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
                ..Default::default()
            })
        }
        AiAction::Excerpt => {
            let exc = x("excerpt")?;
            Some(AiGenerateResponse {
                excerpt: Some(exc),
                ..Default::default()
            })
        }
        AiAction::Translate => {
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
                ..Default::default()
            })
        }
        AiAction::DraftOutline => {
            let title = x("title");
            let subtitle = x("subtitle");
            // Collect all <outline> tags
            let outline = extract_all_xml_fields(content, "outline");
            if title.is_none() && outline.is_empty() {
                return None;
            }
            Some(AiGenerateResponse {
                title,
                subtitle,
                outline: Some(outline),
                ..Default::default()
            })
        }
        AiAction::DraftPost => {
            let body = x("body");
            body.as_ref()?;
            let excerpt = x("excerpt");
            let mt = x("meta_title");
            let md = x("meta_description");
            Some(AiGenerateResponse {
                body,
                excerpt,
                meta_title: mt,
                meta_description: md,
                ..Default::default()
            })
        }
        AiAction::SectionContent => {
            let title = x("title");
            let text = x("text");
            let button_text = x("button_text");
            if title.is_none() && text.is_none() && button_text.is_none() {
                return None;
            }
            Some(AiGenerateResponse {
                title,
                text,
                button_text,
                ..Default::default()
            })
        }
        AiAction::BlogTags => {
            let tags = extract_all_xml_fields(content, "tag");
            if tags.is_empty() {
                return None;
            }
            Some(AiGenerateResponse {
                tags: Some(tags),
                ..Default::default()
            })
        }
        // Vision actions use parse_vision_response, not XML
        AiAction::AutoTag | AiAction::AltText | AiAction::ImageCaption | AiAction::ImageTitle => {
            None
        }
    }
}

pub(crate) fn sanitize_json_strings(s: &str) -> String {
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

pub(crate) fn parse_ai_response(
    content: &str,
    action: &AiAction,
) -> Result<AiGenerateResponse, ApiError> {
    // 1. Try strict JSON parsing (handles well-formed output from json_object mode)
    let sanitized = sanitize_json_strings(content);
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&sanitized) {
        return Ok(postprocess_response(build_response(&json, action), action));
    }

    // 2. Try XML tag extraction (handles local/Anthropic models with XML prompts)
    if let Some(response) = parse_xml_response(content, action) {
        return Ok(postprocess_response(response, action));
    }

    // 3. Fall back to lenient key-based extraction for models that produce
    // unescaped quotes in values (e.g. code blocks with string literals)
    let fields = extract_fields_lenient(content);
    if fields.is_empty() {
        return Err(ApiError::internal(format!(
            "AI response contains no recognizable fields. Raw: {content}"
        ))
        .with_code(codes::AI_RESPONSE_PARSE_FAILED));
    }

    let json = serde_json::Value::Object(fields);
    Ok(postprocess_response(build_response(&json, action), action))
}

/// Clean up the parsed AI response:
/// - Strip leading horizontal rules and whitespace from body
/// - Downgrade any h1 headings to h2
/// - Derive excerpt from body if missing
pub(crate) fn postprocess_response(
    mut resp: AiGenerateResponse,
    action: &AiAction,
) -> AiGenerateResponse {
    // SEO truncation applies to all actions that may return meta fields
    truncate_seo_fields(&mut resp);

    if !matches!(action, AiAction::DraftPost) {
        return resp;
    }

    if let Some(ref mut body) = resp.body {
        // Strip leading horizontal rules (--- or ***) and surrounding whitespace
        let mut s = body.trim().to_string();
        while s.starts_with("---") || s.starts_with("***") || s.starts_with("___") {
            s = s
                .trim_start_matches("---")
                .trim_start_matches("***")
                .trim_start_matches("___")
                .trim_start()
                .to_string();
        }

        // Downgrade # headings to ## (only at line start)
        let lines: Vec<String> = s
            .lines()
            .map(|line| {
                if line.starts_with("# ") && !line.starts_with("## ") {
                    format!("#{line}")
                } else {
                    line.to_string()
                }
            })
            .collect();
        s = lines.join("\n");

        *body = s;
    }

    // Derive excerpt from body if missing
    if resp.excerpt.as_ref().is_none_or(|e| e.trim().is_empty()) {
        if let Some(ref body) = resp.body {
            // Take the first non-heading, non-empty paragraph
            let first_para = body
                .split("\n\n")
                .map(|p| p.trim())
                .find(|p| !p.is_empty() && !p.starts_with('#'));
            if let Some(para) = first_para {
                // Truncate to ~200 chars at a sentence boundary
                let excerpt = if para.len() <= 200 {
                    para.to_string()
                } else if let Some(end) = para[..200].rfind(". ") {
                    format!("{}.", &para[..end])
                } else {
                    format!("{}...", &para[..197])
                };
                resp.excerpt = Some(excerpt);
            }
        }
    }

    resp
}

/// Hard-truncate SEO fields to their maximum allowed lengths.
/// Models frequently exceed the character limits specified in prompts,
/// so this acts as a safety net for meta_title (60) and meta_description (160).
pub(crate) fn truncate_seo_fields(resp: &mut AiGenerateResponse) {
    if let Some(ref mut mt) = resp.meta_title {
        if mt.len() > 60 {
            // Try to break at a word boundary
            let truncated = &mt[..60];
            *mt = match truncated.rfind(' ') {
                Some(pos) if pos > 40 => truncated[..pos].to_string(),
                _ => truncated.to_string(),
            };
        }
    }
    if let Some(ref mut md) = resp.meta_description {
        if md.len() > 160 {
            let truncated = &md[..160];
            *md = match truncated.rfind(". ") {
                Some(pos) if pos > 100 => format!("{}.", &truncated[..pos]),
                _ => match truncated.rfind(' ') {
                    Some(pos) if pos > 120 => format!("{}...", &truncated[..pos]),
                    _ => format!("{}...", &truncated[..157]),
                },
            };
        }
    }
}

pub(crate) fn build_response(json: &serde_json::Value, action: &AiAction) -> AiGenerateResponse {
    let s = |key: &str| json.get(key).and_then(|v| v.as_str()).map(String::from);

    match action {
        AiAction::Seo => AiGenerateResponse {
            meta_title: s("meta_title"),
            meta_description: s("meta_description"),
            ..Default::default()
        },
        AiAction::Excerpt => AiGenerateResponse {
            excerpt: s("excerpt"),
            ..Default::default()
        },
        AiAction::Translate | AiAction::DraftPost => AiGenerateResponse {
            meta_title: s("meta_title"),
            meta_description: s("meta_description"),
            excerpt: s("excerpt"),
            title: s("title"),
            subtitle: s("subtitle"),
            body: s("body"),
            ..Default::default()
        },
        AiAction::DraftOutline => {
            let outline = json.get("outline").and_then(|v| v.as_array()).map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            });
            AiGenerateResponse {
                title: s("title"),
                subtitle: s("subtitle"),
                meta_title: None,
                meta_description: None,
                excerpt: None,
                body: None,
                outline,
                ..Default::default()
            }
        }
        AiAction::SectionContent => AiGenerateResponse {
            title: s("title"),
            text: s("text"),
            button_text: s("button_text"),
            ..Default::default()
        },
        AiAction::BlogTags => {
            let tags = json.get("tags").and_then(|v| v.as_array()).map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            });
            AiGenerateResponse {
                tags,
                ..Default::default()
            }
        }
        // Vision actions use parse_vision_response, not build_response
        AiAction::AutoTag | AiAction::AltText | AiAction::ImageCaption | AiAction::ImageTitle => {
            AiGenerateResponse::default()
        }
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
    "text",
    "button_text",
];

pub(crate) fn extract_fields_lenient(raw: &str) -> serde_json::Map<String, serde_json::Value> {
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
            serde_json::Value::String(unescape_json_string(value)),
        );
    }

    result
}

/// Convert literal JSON escape sequences (backslash-n, backslash-t, etc.)
/// to their actual characters. Needed when extracting values outside of
/// serde_json's normal parsing (lenient extractor, XML extractor).
pub(crate) fn unescape_json_string(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars();
    while let Some(c) = chars.next() {
        if c == '\\' {
            match chars.next() {
                Some('n') => result.push('\n'),
                Some('r') => result.push('\r'),
                Some('t') => result.push('\t'),
                Some('\\') => result.push('\\'),
                Some('"') => result.push('"'),
                Some(other) => {
                    result.push('\\');
                    result.push(other);
                }
                None => result.push('\\'),
            }
        } else {
            result.push(c);
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_ai_response_handles_strict_json_seo() {
        // Tracer (#928): a well-formed JSON SEO payload parses without a network
        // call, straight to the typed response.
        let raw = r#"{"meta_title": "Hello", "meta_description": "A short description"}"#;
        let resp = parse_ai_response(raw, &AiAction::Seo).expect("json parses");
        assert_eq!(resp.meta_title.as_deref(), Some("Hello"));
        assert_eq!(
            resp.meta_description.as_deref(),
            Some("A short description")
        );
    }

    #[test]
    fn parse_ai_response_handles_xml_tagged_seo() {
        // Local/Anthropic XML-tagged output parses via the XML extractor.
        let raw = "<meta_title>Hello</meta_title>\n<meta_description>Desc here</meta_description>";
        let resp = parse_ai_response(raw, &AiAction::Seo).expect("xml parses");
        assert_eq!(resp.meta_title.as_deref(), Some("Hello"));
        assert_eq!(resp.meta_description.as_deref(), Some("Desc here"));
    }

    #[test]
    fn parse_ai_response_errors_on_unrecognizable_output() {
        let err = parse_ai_response("just some prose with no fields", &AiAction::Seo);
        // SEO accepts missing fields via lenient extraction → no fields → error.
        assert!(err.is_err());
    }
}
