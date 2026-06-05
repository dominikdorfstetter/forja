//! Preview service configuration
//!
//! Configures built-in preview templates that are automatically available
//! to all sites. These are injected into site settings responses alongside
//! any user-configured templates.

use serde::Deserialize;

/// A built-in preview template registered via configuration.
#[derive(Debug, Clone)]
pub struct BuiltInTemplate {
    pub name: String,
    pub url: String,
}

/// Preview configuration
#[derive(Debug, Clone, Default, Deserialize)]
pub struct PreviewConfig {
    /// Comma-separated list of built-in preview templates in `name|url` format.
    /// Example: `Blog|http://preview:4321,Portfolio|http://portfolio:3000`
    #[serde(default)]
    pub built_in_templates: String,
}

impl PreviewConfig {
    /// Parse the built-in templates string into structured entries.
    pub fn templates(&self) -> Vec<BuiltInTemplate> {
        if self.built_in_templates.is_empty() {
            return Vec::new();
        }

        self.built_in_templates
            .split(',')
            .filter_map(|entry| {
                let entry = entry.trim();
                let (name, url) = entry.split_once('|')?;
                let name = name.trim();
                let url = url.trim();
                if name.is_empty() || url.is_empty() {
                    return None;
                }
                Some(BuiltInTemplate {
                    name: name.to_string(),
                    url: url.to_string(),
                })
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_templates() {
        let config = PreviewConfig::default();
        assert!(config.templates().is_empty());
    }

    #[test]
    fn test_single_template() {
        let config = PreviewConfig {
            built_in_templates: "Blog|http://preview:4321".to_string(),
        };
        let templates = config.templates();
        assert_eq!(templates.len(), 1);
        assert_eq!(templates[0].name, "Blog");
        assert_eq!(templates[0].url, "http://preview:4321");
    }

    #[test]
    fn test_multiple_templates() {
        let config = PreviewConfig {
            built_in_templates: "Blog|http://preview:4321,Portfolio|http://portfolio:3000"
                .to_string(),
        };
        let templates = config.templates();
        assert_eq!(templates.len(), 2);
        assert_eq!(templates[0].name, "Blog");
        assert_eq!(templates[1].name, "Portfolio");
    }

    #[test]
    fn test_whitespace_handling() {
        let config = PreviewConfig {
            built_in_templates: " Blog | http://preview:4321 , Portfolio | http://portfolio:3000 "
                .to_string(),
        };
        let templates = config.templates();
        assert_eq!(templates.len(), 2);
        assert_eq!(templates[0].url, "http://preview:4321");
    }

    #[test]
    fn test_invalid_entries_skipped() {
        let config = PreviewConfig {
            built_in_templates: "Blog|http://preview:4321,invalid,|empty,name|".to_string(),
        };
        let templates = config.templates();
        assert_eq!(templates.len(), 1);
        assert_eq!(templates[0].name, "Blog");
    }
}
