//! Sitemap XML generation. Public endpoint for search-engine consumption,
//! mounted at `/api/v1/sites/{slug}/sitemap.xml`. Aggregates published
//! blog posts, pages, and legal documents into one XML doc with
//! `<xhtml:link rel="alternate" hreflang>` entries for multi-locale sites.

use chrono::{DateTime, Utc};

use axum::extract::{Path, State};
use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE};
use axum::http::HeaderValue;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

use crate::errors::codes;
use crate::errors::ApiError;
use crate::models::content::ContentLocalization;
use crate::models::legal::LegalDocType;
use crate::models::site::Site;
use crate::models::site_locale::{SiteLocale, SiteLocaleWithDetails};
use crate::repos::blog_repo::BlogRepo;
use crate::repos::legal_repo::LegalDocumentRepo;
use crate::repos::page_repo::PageRepo;
use crate::AppState;

const SITEMAP_MAX_URLS: i64 = 50_000;

struct SitemapUrl {
    loc: String,
    lastmod: DateTime<Utc>,
    changefreq: &'static str,
    priority: &'static str,
    alternates: Vec<SitemapAlternate>,
}

struct SitemapAlternate {
    hreflang: String,
    href: String,
}

async fn build_site_sitemap_xml(state: &AppState, slug: &str) -> Result<String, ApiError> {
    let site = Site::find_by_slug(&state.db, slug).await?;

    let base_url = site.base_url.ok_or_else(|| {
        ApiError::not_found("Set a Site URL before generating a sitemap.".to_string())
            .with_code(codes::RESOURCE_NOT_FOUND)
    })?;
    let base_url = base_url.trim_end_matches('/');

    let locales = SiteLocale::find_all_for_site(&state.db, site.id).await?;
    let active_locales: Vec<_> = locales.into_iter().filter(|l| l.is_active).collect();

    let mut urls = Vec::new();

    let blogs = BlogRepo::find_published_for_site(&state.db, site.id, SITEMAP_MAX_URLS, 0).await?;
    for blog in &blogs {
        if let Some(slug) = &blog.slug {
            let localizations =
                ContentLocalization::find_all_for_content(&state.db, blog.content_id).await?;
            let alternates = build_alternates(
                base_url,
                &format!("/blog/{slug}"),
                &localizations,
                &active_locales,
            );
            urls.push(SitemapUrl {
                loc: format!("{base_url}/blog/{slug}"),
                lastmod: blog.updated_at,
                changefreq: "weekly",
                priority: "0.6",
                alternates,
            });
        }
    }

    let pages = PageRepo::find_published_for_site(&state.db, site.id, SITEMAP_MAX_URLS, 0).await?;
    for page in &pages {
        let route = page.route.trim_start_matches('/');
        let localizations =
            ContentLocalization::find_all_for_content(&state.db, page.content_id).await?;
        let alternates = build_alternates(
            base_url,
            &format!("/{route}"),
            &localizations,
            &active_locales,
        );
        urls.push(SitemapUrl {
            loc: format!("{base_url}/{route}"),
            lastmod: page.updated_at,
            changefreq: "monthly",
            priority: "0.8",
            alternates,
        });
    }

    let legal_docs =
        LegalDocumentRepo::find_published_for_site(&state.db, site.id, SITEMAP_MAX_URLS, 0).await?;
    for doc in &legal_docs {
        let type_slug = legal_type_to_slug(&doc.document_type);
        let alternates = if let Some(content_id) = doc.content_id {
            let localizations =
                ContentLocalization::find_all_for_content(&state.db, content_id).await?;
            build_alternates(
                base_url,
                &format!("/legal/{type_slug}"),
                &localizations,
                &active_locales,
            )
        } else {
            Vec::new()
        };
        urls.push(SitemapUrl {
            loc: format!("{base_url}/legal/{type_slug}"),
            lastmod: doc.updated_at,
            changefreq: "yearly",
            priority: "0.4",
            alternates,
        });
    }

    Ok(build_sitemap_xml(&urls))
}

/// Empty when the site has only one locale or the content has no
/// translations in active locales.
fn build_alternates(
    base_url: &str,
    path: &str,
    localizations: &[ContentLocalization],
    active_locales: &[SiteLocaleWithDetails],
) -> Vec<SitemapAlternate> {
    if active_locales.len() <= 1 {
        return Vec::new();
    }

    let mut alternates = Vec::new();
    for locale in active_locales {
        let has_translation = localizations
            .iter()
            .any(|l| l.locale_id == locale.locale_id);
        if !has_translation {
            continue;
        }

        let href = match &locale.url_prefix {
            Some(prefix) if !prefix.is_empty() => format!("{base_url}/{prefix}{path}"),
            _ => format!("{base_url}{path}"),
        };

        alternates.push(SitemapAlternate {
            hreflang: locale.code.clone(),
            href,
        });
    }

    alternates
}

fn legal_type_to_slug(doc_type: &LegalDocType) -> &'static str {
    match doc_type {
        LegalDocType::CookieConsent => "cookie-consent",
        LegalDocType::PrivacyPolicy => "privacy-policy",
        LegalDocType::TermsOfService => "terms-of-service",
        LegalDocType::Imprint => "imprint",
        LegalDocType::Disclaimer => "disclaimer",
    }
}

fn build_sitemap_xml(urls: &[SitemapUrl]) -> String {
    let has_alternates = urls.iter().any(|u| !u.alternates.is_empty());

    let mut xml = String::with_capacity(urls.len() * 300);
    xml.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    xml.push_str("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"");
    if has_alternates {
        xml.push_str("\n        xmlns:xhtml=\"http://www.w3.org/1999/xhtml\"");
    }
    xml.push_str(">\n");

    for url in urls {
        xml.push_str("  <url>\n");
        xml.push_str(&format!("    <loc>{}</loc>\n", xml_escape(&url.loc)));
        xml.push_str(&format!(
            "    <lastmod>{}</lastmod>\n",
            url.lastmod.format("%Y-%m-%dT%H:%M:%S+00:00")
        ));
        xml.push_str(&format!(
            "    <changefreq>{}</changefreq>\n",
            url.changefreq
        ));
        xml.push_str(&format!("    <priority>{}</priority>\n", url.priority));

        for alt in &url.alternates {
            xml.push_str(&format!(
                "    <xhtml:link rel=\"alternate\" hreflang=\"{}\" href=\"{}\"/>\n",
                xml_escape(&alt.hreflang),
                xml_escape(&alt.href),
            ));
        }

        xml.push_str("  </url>\n");
    }

    xml.push_str("</urlset>\n");
    xml
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[utoipa::path(
    get,
    path = "/sites/{slug}/sitemap.xml",
    tag = "Sites",
    operation_id = "get_sitemap",
    description = "Get an XML sitemap of all published content for a site. Public endpoint for search engine consumption.",
    params(("slug" = String, Path, description = "URL-friendly site identifier")),
    responses(
        (status = 200, description = "XML sitemap", content_type = "application/xml"),
        (status = 404, description = "Site not found or base_url not configured", body = crate::errors::ProblemDetails)
    )
)]
async fn get_sitemap(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<([(axum::http::HeaderName, HeaderValue); 2], String), ApiError> {
    let xml = build_site_sitemap_xml(&state, &slug).await?;
    Ok((
        [
            (CONTENT_TYPE, HeaderValue::from_static("application/xml")),
            (
                CACHE_CONTROL,
                HeaderValue::from_static("public, max-age=3600"),
            ),
        ],
        xml,
    ))
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(routes!(get_sitemap))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn make_url(
        loc: &str,
        lastmod: DateTime<Utc>,
        changefreq: &'static str,
        priority: &'static str,
        alternates: Vec<SitemapAlternate>,
    ) -> SitemapUrl {
        SitemapUrl {
            loc: loc.to_string(),
            lastmod,
            changefreq,
            priority,
            alternates,
        }
    }

    #[test]
    fn build_xml_basic() {
        let ts = Utc.with_ymd_and_hms(2025, 6, 15, 10, 30, 0).unwrap();
        let urls = vec![make_url(
            "https://example.com/blog/hello",
            ts,
            "weekly",
            "0.6",
            vec![],
        )];

        let xml = build_sitemap_xml(&urls);
        assert!(xml.starts_with("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"));
        assert!(xml.contains("<loc>https://example.com/blog/hello</loc>"));
        assert!(xml.contains("<lastmod>2025-06-15T10:30:00+00:00</lastmod>"));
        assert!(xml.contains("</urlset>"));
        assert!(!xml.contains("xmlns:xhtml"));
    }

    #[test]
    fn build_xml_with_alternates() {
        let ts = Utc.with_ymd_and_hms(2025, 1, 1, 0, 0, 0).unwrap();
        let urls = vec![make_url(
            "https://example.com/about",
            ts,
            "monthly",
            "0.8",
            vec![
                SitemapAlternate {
                    hreflang: "en".to_string(),
                    href: "https://example.com/about".to_string(),
                },
                SitemapAlternate {
                    hreflang: "de".to_string(),
                    href: "https://example.com/de/about".to_string(),
                },
            ],
        )];

        let xml = build_sitemap_xml(&urls);
        assert!(xml.contains("xmlns:xhtml=\"http://www.w3.org/1999/xhtml\""));
        assert!(xml.contains(
            "<xhtml:link rel=\"alternate\" hreflang=\"en\" href=\"https://example.com/about\"/>"
        ));
    }

    #[test]
    fn build_xml_empty() {
        let xml = build_sitemap_xml(&[]);
        assert!(xml.contains("<urlset"));
        assert!(xml.contains("</urlset>"));
        assert!(!xml.contains("<url>"));
    }

    #[test]
    fn xml_escape_special_chars() {
        assert_eq!(xml_escape("a&b"), "a&amp;b");
        assert_eq!(xml_escape("<tag>"), "&lt;tag&gt;");
        assert_eq!(xml_escape("he said \"hi\""), "he said &quot;hi&quot;");
        assert_eq!(xml_escape("it's"), "it&apos;s");
    }

    #[test]
    fn legal_slugs_round_trip() {
        assert_eq!(
            legal_type_to_slug(&LegalDocType::CookieConsent),
            "cookie-consent"
        );
        assert_eq!(
            legal_type_to_slug(&LegalDocType::PrivacyPolicy),
            "privacy-policy"
        );
        assert_eq!(
            legal_type_to_slug(&LegalDocType::TermsOfService),
            "terms-of-service"
        );
        assert_eq!(legal_type_to_slug(&LegalDocType::Imprint), "imprint");
        assert_eq!(legal_type_to_slug(&LegalDocType::Disclaimer), "disclaimer");
    }
}
