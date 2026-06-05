//! RSS 2.0 feed generation for a site's published blog posts.
//!
//! Extracted from `handlers::blog::rss_feed` so the channel assembly (fetch
//! published blogs → load localizations → compute excerpts → build items) is
//! testable without an HTTP round-trip. The handler is now a thin wrapper that
//! renders the returned XML.

use chrono::Utc;
use rss::{ChannelBuilder, GuidBuilder, ItemBuilder};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::models::content::ContentLocalization;
use crate::models::site::Site;
use crate::repos::blog_repo::BlogRepo;
use crate::utils::excerpt::{compute_excerpt, DEFAULT_EXCERPT_LEN};

/// Maximum number of posts in the feed.
const RSS_MAX_ITEMS: i64 = 50;

/// Build the RSS 2.0 feed XML for `site_id`'s most recent published posts.
pub async fn generate_rss(pool: &PgPool, site_id: Uuid) -> Result<String, ApiError> {
    let site = Site::find_by_id(pool, site_id).await?;

    let base_url = Site::primary_production_domain(pool, site_id)
        .await?
        .map(|d| format!("https://{d}"))
        .unwrap_or_default();

    let blogs = BlogRepo::find_published_for_site(pool, site_id, RSS_MAX_ITEMS, 0).await?;

    let mut items = Vec::with_capacity(blogs.len());
    for blog in &blogs {
        let localizations =
            ContentLocalization::find_all_for_content(pool, blog.content_id).await?;
        let loc = match localizations.first() {
            Some(l) => l,
            None => continue,
        };

        let description = loc
            .excerpt
            .clone()
            .filter(|e| !e.trim().is_empty())
            .or_else(|| {
                loc.body
                    .as_ref()
                    .map(|b| compute_excerpt(b, DEFAULT_EXCERPT_LEN))
            })
            .unwrap_or_default();

        let link = blog
            .slug
            .as_ref()
            .map(|s| format!("{base_url}/blog/{s}"))
            .unwrap_or_default();

        let guid = GuidBuilder::default()
            .value(blog.id.to_string())
            .permalink(false)
            .build();

        let pub_date = blog
            .published_date
            .and_hms_opt(0, 0, 0)
            .zip(chrono::FixedOffset::east_opt(0))
            .and_then(|(dt, utc)| dt.and_local_timezone(utc).single())
            .map(|dt| dt.to_rfc2822());

        let item = ItemBuilder::default()
            .title(Some(loc.title.clone()))
            .link(Some(link))
            .description(Some(description))
            .author(Some(blog.author.clone()))
            .guid(Some(guid))
            .pub_date(pub_date)
            .build();

        items.push(item);
    }

    let channel = ChannelBuilder::default()
        .title(&site.name)
        .link(&base_url)
        .description(site.description.unwrap_or_default())
        .language(Some("en".to_string()))
        .last_build_date(Some(Utc::now().to_rfc2822()))
        .generator(Some("Forja".to_string()))
        .items(items)
        .build();

    Ok(channel.to_string())
}
