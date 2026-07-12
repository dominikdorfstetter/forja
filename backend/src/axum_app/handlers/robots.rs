//! Axum port of `crate::handlers::robots`. Single public endpoint that
//! materializes a site's `robots_txt_rules` setting into the canonical
//! text format. Mounted under `/api/v1`, so the public path is
//! `/api/v1/sites/{slug}/robots.txt`.
//!
//! Rendering logic (`render_robots_txt`) is reused from the Rocket
//! handler — the function is already pub and pure, no duplication needed.

use axum::extract::{Path, State};
use axum::http::HeaderValue;
use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE};
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

use crate::AppState;
use crate::dto::site_settings::{RobotsTxtDirective, RobotsTxtRule};
use crate::errors::ApiError;
use crate::models::site::Site;
use crate::models::site_settings::{KEY_ROBOTS_TXT_RULES, SiteSetting};

/// Render structured robots.txt rules into the standard text format.
///
/// If `base_url` is provided, appends a `Sitemap:` directive pointing
/// to `<base_url>/sitemap.xml`.
pub fn render_robots_txt(rules: &[RobotsTxtRule], base_url: Option<&str>) -> String {
    let mut output = String::new();

    for (i, rule) in rules.iter().enumerate() {
        if i > 0 {
            output.push('\n');
        }
        output.push_str(&format!("User-agent: {}\n", rule.user_agent));
        for directive in &rule.rules {
            output.push_str(&format!("{}: {}\n", directive.directive, directive.path));
        }
    }

    if let Some(url) = base_url {
        let url = url.trim_end_matches('/');
        if !output.is_empty() {
            output.push('\n');
        }
        output.push_str(&format!("Sitemap: {}/sitemap.xml\n", url));
    }

    output
}

#[utoipa::path(
    get,
    path = "/sites/{slug}/robots.txt",
    tag = "Sites",
    operation_id = "get_robots_txt",
    description = "Get the robots.txt file for a site. Public endpoint for search engine consumption.",
    params(("slug" = String, Path, description = "URL-friendly site identifier")),
    responses(
        (status = 200, description = "robots.txt content", content_type = "text/plain"),
        (status = 404, description = "Site not found", body = crate::errors::ProblemDetails)
    )
)]
async fn get_robots_txt(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<([(axum::http::HeaderName, HeaderValue); 2], String), ApiError> {
    let site = Site::find_by_slug(&state.db, &slug).await?;

    let rules_value = SiteSetting::get_value(&state.db, site.id, KEY_ROBOTS_TXT_RULES).await?;
    let rules: Vec<RobotsTxtRule> =
        serde_json::from_value(rules_value).unwrap_or_else(|_| default_rules());

    let rendered = render_robots_txt(&rules, site.base_url.as_deref());

    Ok((
        [
            (CONTENT_TYPE, HeaderValue::from_static("text/plain")),
            (
                CACHE_CONTROL,
                HeaderValue::from_static("public, max-age=3600"),
            ),
        ],
        rendered,
    ))
}

/// Default rules used when a site has no `robots_txt_rules` setting or
/// the stored JSON fails to deserialize. Mirrors the Rocket handler.
fn default_rules() -> Vec<RobotsTxtRule> {
    vec![RobotsTxtRule {
        user_agent: "*".to_string(),
        rules: vec![RobotsTxtDirective {
            directive: "Allow".to_string(),
            path: "/".to_string(),
        }],
    }]
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(routes!(get_robots_txt))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_default_rules_no_base_url() {
        let output = render_robots_txt(&default_rules(), None);
        assert_eq!(output, "User-agent: *\nAllow: /\n");
    }

    #[test]
    fn render_default_rules_with_base_url() {
        let output = render_robots_txt(&default_rules(), Some("https://example.com"));
        assert_eq!(
            output,
            "User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml\n"
        );
    }

    #[test]
    fn render_strips_trailing_slash_from_base_url() {
        let output = render_robots_txt(&default_rules(), Some("https://example.com/"));
        assert!(output.contains("Sitemap: https://example.com/sitemap.xml\n"));
    }

    #[test]
    fn render_multiple_user_agents() {
        let rules = vec![
            RobotsTxtRule {
                user_agent: "*".to_string(),
                rules: vec![RobotsTxtDirective {
                    directive: "Allow".to_string(),
                    path: "/".to_string(),
                }],
            },
            RobotsTxtRule {
                user_agent: "Googlebot".to_string(),
                rules: vec![
                    RobotsTxtDirective {
                        directive: "Allow".to_string(),
                        path: "/".to_string(),
                    },
                    RobotsTxtDirective {
                        directive: "Disallow".to_string(),
                        path: "/admin".to_string(),
                    },
                ],
            },
        ];
        let output = render_robots_txt(&rules, None);
        assert_eq!(
            output,
            "User-agent: *\nAllow: /\n\nUser-agent: Googlebot\nAllow: /\nDisallow: /admin\n"
        );
    }

    #[test]
    fn render_empty_rules_no_base_url() {
        assert_eq!(render_robots_txt(&[], None), "");
    }

    #[test]
    fn render_empty_rules_with_base_url() {
        assert_eq!(
            render_robots_txt(&[], Some("https://example.com")),
            "Sitemap: https://example.com/sitemap.xml\n"
        );
    }
}
