//! Favicon DTOs

use serde::{Deserialize, Serialize};

/// A single favicon variant with its URL and dimensions
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct FaviconVariant {
    pub name: String,
    pub url: String,
    pub width: u32,
    pub height: u32,
}

/// Response for GET /api/v1/sites/<site_id>/favicon
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct FaviconResponse {
    pub variants: Vec<FaviconVariant>,
    /// Ready-to-paste HTML for the <head> section
    pub head_snippet: String,
}

/// Render the HTML <head> snippet for favicon variants.
///
/// Uses the absolute URLs from variant entries so the snippet points
/// to the Forja API where the files are hosted.
pub fn render_head_snippet(variants: &[FaviconVariant], theme_color: &str) -> String {
    let mut lines = Vec::new();

    for v in variants {
        match v.name.as_str() {
            "favicon.ico" => {
                lines.push(format!(
                    r#"<link rel="icon" type="image/x-icon" href="{}">"#,
                    v.url
                ));
            }
            "favicon-16x16.png" => {
                lines.push(format!(
                    r#"<link rel="icon" type="image/png" sizes="16x16" href="{}">"#,
                    v.url
                ));
            }
            "favicon-32x32.png" => {
                lines.push(format!(
                    r#"<link rel="icon" type="image/png" sizes="32x32" href="{}">"#,
                    v.url
                ));
            }
            "apple-touch-icon.png" => {
                lines.push(format!(
                    r#"<link rel="apple-touch-icon" sizes="180x180" href="{}">"#,
                    v.url
                ));
            }
            _ => {}
        }
    }

    lines.push(format!(
        r#"<meta name="theme-color" content="{}">"#,
        theme_color
    ));

    lines.join("\n")
}

/// Make a variant URL absolute by prepending the public base URL
/// if the URL is a relative path.
pub fn ensure_absolute_url(url: &str, public_url: &str) -> String {
    if url.starts_with("http://") || url.starts_with("https://") {
        url.to_string()
    } else {
        let base = public_url.trim_end_matches('/');
        let path = if url.starts_with('/') {
            url.to_string()
        } else {
            format!("/{url}")
        };
        format!("{base}{path}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_variants() -> Vec<FaviconVariant> {
        vec![
            FaviconVariant {
                name: "favicon.ico".to_string(),
                url: "https://api.example.com/files/site_favicons/abc/favicon.ico".to_string(),
                width: 48,
                height: 48,
            },
            FaviconVariant {
                name: "favicon-16x16.png".to_string(),
                url: "https://api.example.com/files/site_favicons/abc/favicon-16x16.png"
                    .to_string(),
                width: 16,
                height: 16,
            },
            FaviconVariant {
                name: "favicon-32x32.png".to_string(),
                url: "https://api.example.com/files/site_favicons/abc/favicon-32x32.png"
                    .to_string(),
                width: 32,
                height: 32,
            },
            FaviconVariant {
                name: "apple-touch-icon.png".to_string(),
                url: "https://api.example.com/files/site_favicons/abc/apple-touch-icon.png"
                    .to_string(),
                width: 180,
                height: 180,
            },
        ]
    }

    #[test]
    fn test_render_head_snippet_uses_absolute_urls() {
        let snippet = render_head_snippet(&sample_variants(), "#4a90d9");
        assert!(snippet.contains("https://api.example.com/files/site_favicons/abc/favicon.ico"));
        assert!(
            snippet.contains("https://api.example.com/files/site_favicons/abc/favicon-32x32.png")
        );
        assert!(snippet
            .contains("https://api.example.com/files/site_favicons/abc/apple-touch-icon.png"));
        assert!(snippet.contains("content=\"#4a90d9\""));
    }

    #[test]
    fn test_render_head_snippet_empty_variants() {
        let snippet = render_head_snippet(&[], "#ffffff");
        assert!(snippet.contains("theme-color"));
        assert!(!snippet.contains("icon"));
    }

    #[test]
    fn test_ensure_absolute_url_already_absolute() {
        assert_eq!(
            ensure_absolute_url(
                "https://cdn.example.com/file.png",
                "https://api.example.com"
            ),
            "https://cdn.example.com/file.png"
        );
    }

    #[test]
    fn test_ensure_absolute_url_relative_path() {
        assert_eq!(
            ensure_absolute_url("/uploads/file.png", "https://api.example.com"),
            "https://api.example.com/uploads/file.png"
        );
    }

    #[test]
    fn test_ensure_absolute_url_no_leading_slash() {
        assert_eq!(
            ensure_absolute_url("uploads/file.png", "https://api.example.com"),
            "https://api.example.com/uploads/file.png"
        );
    }
}
