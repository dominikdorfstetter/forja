//! HTML sanitization for ActivityPub federation content.
//!
//! Uses ammonia with a strict allowlist of safe tags to prevent XSS
//! and other injection attacks from federated content.

use std::collections::{HashMap, HashSet};

/// Sanitize HTML input with a strict allowlist.
///
/// Allowed tags: `p`, `a`, `em`, `strong`, `code`, `blockquote`, `ul`, `ol`, `li`.
/// Links are restricted to `http`/`https` schemes and get `rel="nofollow noopener"`.
/// Everything else (scripts, iframes, event handlers, etc.) is stripped.
pub fn sanitize_html(input: &str) -> String {
    let mut allowed_tags = HashSet::new();
    for tag in &[
        "p",
        "a",
        "em",
        "strong",
        "code",
        "blockquote",
        "ul",
        "ol",
        "li",
    ] {
        allowed_tags.insert(*tag);
    }

    let mut allowed_attrs = HashMap::new();
    let mut a_attrs = HashSet::new();
    a_attrs.insert("href");
    allowed_attrs.insert("a", a_attrs);

    let mut url_schemes = HashSet::new();
    url_schemes.insert("https");
    url_schemes.insert("http");

    ammonia::Builder::default()
        .tags(allowed_tags)
        .tag_attributes(allowed_attrs)
        .url_schemes(url_schemes)
        .link_rel(Some("nofollow noopener"))
        .strip_comments(true)
        .clean(input)
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strips_script_tags() {
        let input = "<p>Hello</p><script>alert('xss')</script>";
        let result = sanitize_html(input);
        assert!(!result.contains("<script>"));
        assert!(!result.contains("alert"));
        assert!(result.contains("<p>Hello</p>"));
    }

    #[test]
    fn test_strips_event_handlers() {
        let input = r#"<p onmouseover="alert('xss')">Hello</p>"#;
        let result = sanitize_html(input);
        assert!(!result.contains("onmouseover"));
        assert!(result.contains("<p>"));
        assert!(result.contains("Hello"));
    }

    #[test]
    fn test_allows_safe_tags() {
        let input =
            "<p>Text</p><em>italic</em><strong>bold</strong><code>code</code><blockquote>quote</blockquote><ul><li>item</li></ul><ol><li>item</li></ol>";
        let result = sanitize_html(input);
        assert!(result.contains("<p>"));
        assert!(result.contains("<em>"));
        assert!(result.contains("<strong>"));
        assert!(result.contains("<code>"));
        assert!(result.contains("<blockquote>"));
        assert!(result.contains("<ul>"));
        assert!(result.contains("<ol>"));
        assert!(result.contains("<li>"));
    }

    #[test]
    fn test_allows_links_with_href_only() {
        let input = r#"<a href="https://example.com" class="danger" id="x">link</a>"#;
        let result = sanitize_html(input);
        assert!(result.contains("href=\"https://example.com\""));
        assert!(!result.contains("class="));
        assert!(!result.contains("id="));
        assert!(result.contains("rel=\"nofollow noopener\""));
    }

    #[test]
    fn test_strips_javascript_urls() {
        let input = r#"<a href="javascript:alert('xss')">click</a>"#;
        let result = sanitize_html(input);
        assert!(!result.contains("javascript:"));
    }

    #[test]
    fn test_strips_iframes() {
        let input = r#"<iframe src="https://evil.com"></iframe><p>safe</p>"#;
        let result = sanitize_html(input);
        assert!(!result.contains("<iframe"));
        assert!(result.contains("<p>safe</p>"));
    }

    #[test]
    fn test_strips_img_tags() {
        let input = r#"<img src="https://example.com/tracking.gif" /><p>text</p>"#;
        let result = sanitize_html(input);
        assert!(!result.contains("<img"));
        assert!(result.contains("<p>text</p>"));
    }

    #[test]
    fn test_strips_style_tags() {
        let input = "<style>body { display: none }</style><p>visible</p>";
        let result = sanitize_html(input);
        assert!(!result.contains("<style>"));
        assert!(result.contains("<p>visible</p>"));
    }

    #[test]
    fn test_plain_text_passthrough() {
        let input = "Hello, world!";
        let result = sanitize_html(input);
        assert_eq!(result, "Hello, world!");
    }
}
