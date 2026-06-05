//! Excerpt computation from content body
//!
//! Strips HTML/Markdown, collapses whitespace, and truncates at a
//! word boundary to produce clean excerpts for listings and feeds.

/// Default maximum excerpt length in characters.
pub const DEFAULT_EXCERPT_LEN: usize = 160;

/// Compute a clean excerpt from a content body.
///
/// 1. Strips HTML tags
/// 2. Strips common Markdown syntax (headings, bold, italic, links, images)
/// 3. Collapses whitespace
/// 4. Truncates at the nearest word boundary to `max_len`
/// 5. Appends `…` if truncated
pub fn compute_excerpt(body: &str, max_len: usize) -> String {
    if body.is_empty() {
        return String::new();
    }

    let stripped = strip_markup(body);
    let collapsed = collapse_whitespace(&stripped);
    let trimmed = collapsed.trim();

    if trimmed.len() <= max_len {
        return trimmed.to_string();
    }

    // Find the last space before max_len to break at word boundary
    let truncated = &trimmed[..max_len];
    let break_pos = truncated.rfind(' ').unwrap_or(max_len);

    // Avoid very short excerpts if the word boundary is too early
    let pos = if break_pos < max_len / 2 {
        max_len
    } else {
        break_pos
    };

    format!("{}…", trimmed[..pos].trim_end())
}

/// Strip HTML tags from a string, inserting spaces for block-level tags.
fn strip_html(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut in_tag = false;

    for c in s.chars() {
        match c {
            '<' => {
                in_tag = true;
                // Insert space to prevent words merging across tags
                if !result.is_empty() && !result.ends_with(' ') {
                    result.push(' ');
                }
            }
            '>' => in_tag = false,
            _ if !in_tag => result.push(c),
            _ => {}
        }
    }

    result
}

/// Strip common Markdown syntax.
fn strip_markdown(s: &str) -> String {
    let mut result = s.to_string();

    // Remove images: ![alt](url)
    result = regex_replace(&result, r"!\[[^\]]*\]\([^)]*\)", "");
    // Convert links to text: [text](url) → text
    result = regex_replace(&result, r"\[([^\]]*)\]\([^)]*\)", "$1");
    // Remove headings: # ## ### etc.
    result = regex_replace(&result, r"(?m)^#{1,6}\s+", "");
    // Remove bold/italic markers
    result = result.replace("***", "");
    result = result.replace("**", "");
    result = result.replace('*', "");
    result = result.replace("___", "");
    result = result.replace("__", "");
    // Remove code blocks
    result = regex_replace(&result, r"```[\s\S]*?```", "");
    result = regex_replace(&result, r"`[^`]+`", "");
    // Remove blockquotes
    result = regex_replace(&result, r"(?m)^>\s*", "");
    // Remove horizontal rules
    result = regex_replace(&result, r"(?m)^---+\s*$", "");
    result = regex_replace(&result, r"(?m)^\*\*\*+\s*$", "");
    // Remove list markers
    result = regex_replace(&result, r"(?m)^[\s]*[-*+]\s+", "");
    result = regex_replace(&result, r"(?m)^[\s]*\d+\.\s+", "");

    result
}

/// Simple regex replacement helper.
fn regex_replace(s: &str, pattern: &str, replacement: &str) -> String {
    regex::Regex::new(pattern)
        .map(|re| re.replace_all(s, replacement).to_string())
        .unwrap_or_else(|_| s.to_string())
}

/// Strip both HTML and Markdown.
fn strip_markup(s: &str) -> String {
    let no_html = strip_html(s);
    strip_markdown(&no_html)
}

/// Collapse consecutive whitespace (spaces, tabs, newlines) into single spaces.
fn collapse_whitespace(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut prev_whitespace = false;

    for c in s.chars() {
        if c.is_whitespace() {
            if !prev_whitespace {
                result.push(' ');
            }
            prev_whitespace = true;
        } else {
            result.push(c);
            prev_whitespace = false;
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_plain_text_short() {
        let result = compute_excerpt("Hello world", 160);
        assert_eq!(result, "Hello world");
    }

    #[test]
    fn test_plain_text_truncated() {
        let long = "word ".repeat(100);
        let result = compute_excerpt(&long, 50);
        assert!(result.len() <= 55); // 50 + "…"
        assert!(result.ends_with('…'));
        assert!(!result.contains("  ")); // no double spaces
    }

    #[test]
    fn test_word_boundary() {
        let result = compute_excerpt("The quick brown fox jumps over the lazy dog", 20);
        // Should break at a word boundary, not mid-word
        assert!(result.ends_with('…'));
        assert!(!result.ends_with("ju…")); // not mid-word
    }

    #[test]
    fn test_html_stripped() {
        let html = "<h1>Title</h1><p>Hello <strong>world</strong>!</p>";
        let result = compute_excerpt(html, 160);
        assert!(result.contains("Title"));
        assert!(result.contains("Hello"));
        assert!(result.contains("world"));
        assert!(!result.contains('<'));
    }

    #[test]
    fn test_markdown_stripped() {
        let md =
            "# My Post\n\nThis is **bold** and *italic* text.\n\n[Click here](https://example.com)";
        let result = compute_excerpt(md, 160);
        assert!(result.contains("My Post"));
        assert!(result.contains("bold"));
        assert!(result.contains("italic"));
        assert!(result.contains("Click here"));
        assert!(!result.contains('#'));
        assert!(!result.contains("**"));
        assert!(!result.contains("https://"));
    }

    #[test]
    fn test_image_stripped() {
        let md = "Before ![alt text](https://example.com/img.png) after";
        let result = compute_excerpt(md, 160);
        assert_eq!(result, "Before after");
    }

    #[test]
    fn test_empty_body() {
        assert_eq!(compute_excerpt("", 160), "");
    }

    #[test]
    fn test_whitespace_collapsed() {
        let result = compute_excerpt("hello   \n\n  world   ", 160);
        assert_eq!(result, "hello world");
    }

    #[test]
    fn test_code_block_stripped() {
        let md = "Before\n```rust\nfn main() {}\n```\nAfter";
        let result = compute_excerpt(md, 160);
        assert!(result.contains("Before"));
        assert!(result.contains("After"));
        assert!(!result.contains("fn main"));
    }

    #[test]
    fn test_default_len() {
        assert_eq!(DEFAULT_EXCERPT_LEN, 160);
    }
}
