//! SEO fallback utilities
//!
//! Pure functions for applying site-level SEO defaults to content
//! that lacks custom metadata.

use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::content::LocalizationResponse;
use crate::errors::ApiError;
use crate::models::media::MediaFile;
use crate::models::site::Site;
use crate::models::site_settings::{
    KEY_SEO_DEFAULT_DESCRIPTION, KEY_SEO_DEFAULT_OG_IMAGE_ID, KEY_SEO_TITLE_TEMPLATE, SiteSetting,
};

/// Apply title template and default description to localizations
/// that don't have custom SEO metadata.
///
/// - `meta_title`: if None/empty, rendered from `title_template`
///   by substituting `{{title}}` and `{{site_name}}`
/// - `meta_description`: if None/empty, filled with `default_description`
pub fn apply_seo_fallbacks(
    localizations: &mut [LocalizationResponse],
    title_template: &str,
    default_description: &str,
    site_name: &str,
) {
    for loc in localizations.iter_mut() {
        if loc.meta_title.as_ref().is_none_or(|s| s.is_empty()) {
            let rendered = render_title_template(title_template, &loc.title, site_name);
            if !rendered.is_empty() {
                loc.meta_title = Some(rendered);
            }
        }
        if loc.meta_description.as_ref().is_none_or(|s| s.is_empty())
            && !default_description.is_empty()
        {
            loc.meta_description = Some(default_description.to_string());
        }
    }
}

/// Substitute `{{title}}` and `{{site_name}}` placeholders in a template.
pub fn render_title_template(template: &str, title: &str, site_name: &str) -> String {
    template
        .replace("{{title}}", title)
        .replace("{{site_name}}", site_name)
}

/// Resolve the OG image URL using the cascade:
/// 1. Content cover image (looked up by UUID)
/// 2. Site-level default OG image (looked up by UUID)
/// 3. Site logo URL
///
/// Returns `None` if all sources are missing or stale.
pub async fn resolve_og_image_url(
    pool: &PgPool,
    cover_image_id: Option<Uuid>,
    default_og_image_id: Option<&str>,
    site_logo_url: Option<&str>,
) -> Option<String> {
    // 1. Cover image
    if let Some(id) = cover_image_id
        && let Ok(media) = MediaFile::find_by_id(pool, id).await
        && let Some(url) = media.public_url
    {
        return Some(url);
    }

    // 2. Default OG image from settings
    if let Some(id_str) = default_og_image_id
        && let Ok(id) = Uuid::parse_str(id_str)
        && let Ok(media) = MediaFile::find_by_id(pool, id).await
        && let Some(url) = media.public_url
    {
        return Some(url);
    }
    // Stale UUID — degrade gracefully, don't return broken URL

    // 3. Site logo as last resort
    site_logo_url
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
}

/// The site-level SEO envelope for one detail response: the three SEO
/// settings plus the site name and logo, loaded once.
///
/// Collapses the SEO half of the detail-response builder that was duplicated
/// verbatim across the blog and page handlers: three separate
/// `SiteSetting::get_value` round-trips, then `apply_seo_fallbacks`, then
/// `resolve_og_image_url`. [`load`](Self::load) batches the three reads into
/// one query; [`apply`](Self::apply) and [`og_image_url`](Self::og_image_url)
/// wrap the two pure/IO steps.
pub struct SeoContext {
    title_template: String,
    default_description: String,
    default_og_image_id: Option<String>,
    site_name: String,
    site_logo_url: Option<String>,
}

impl SeoContext {
    /// Load the envelope for a site — one batched `get_many` for the three SEO
    /// keys, plus the site's own name and logo.
    pub async fn load(pool: &PgPool, site: &Site) -> Result<Self, ApiError> {
        let settings = SiteSetting::get_many(
            pool,
            site.id,
            &[
                KEY_SEO_TITLE_TEMPLATE,
                KEY_SEO_DEFAULT_DESCRIPTION,
                KEY_SEO_DEFAULT_OG_IMAGE_ID,
            ],
        )
        .await?;

        let as_owned = |key: &str| {
            settings
                .get(key)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string()
        };

        Ok(Self {
            title_template: as_owned(KEY_SEO_TITLE_TEMPLATE),
            default_description: as_owned(KEY_SEO_DEFAULT_DESCRIPTION),
            default_og_image_id: settings
                .get(KEY_SEO_DEFAULT_OG_IMAGE_ID)
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            site_name: site.name.clone(),
            site_logo_url: site.logo_url.clone(),
        })
    }

    /// Fill missing `meta_title` / `meta_description` on each localization
    /// from the site templates (delegates to [`apply_seo_fallbacks`]).
    pub fn apply(&self, localizations: &mut [LocalizationResponse]) {
        apply_seo_fallbacks(
            localizations,
            &self.title_template,
            &self.default_description,
            &self.site_name,
        );
    }

    /// Resolve the OG image URL via the cover → default-OG → logo cascade
    /// (delegates to [`resolve_og_image_url`]).
    pub async fn og_image_url(
        &self,
        pool: &PgPool,
        cover_image_id: Option<Uuid>,
    ) -> Option<String> {
        resolve_og_image_url(
            pool,
            cover_image_id,
            self.default_og_image_id.as_deref(),
            self.site_logo_url.as_deref(),
        )
        .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use uuid::Uuid;

    fn make_localization(
        title: &str,
        meta_title: Option<&str>,
        meta_description: Option<&str>,
    ) -> LocalizationResponse {
        LocalizationResponse {
            id: Uuid::new_v4(),
            content_id: Uuid::new_v4(),
            locale_id: Uuid::new_v4(),
            title: title.to_string(),
            subtitle: None,
            excerpt: None,
            body: None,
            meta_title: meta_title.map(|s| s.to_string()),
            meta_description: meta_description.map(|s| s.to_string()),
            translation_status: crate::models::content::TranslationStatus::Approved,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn test_render_title_template_basic() {
        let result = render_title_template("{{title}} | {{site_name}}", "My Post", "My Site");
        assert_eq!(result, "My Post | My Site");
    }

    #[test]
    fn test_render_title_template_title_only() {
        let result = render_title_template("{{title}}", "My Post", "My Site");
        assert_eq!(result, "My Post");
    }

    #[test]
    fn test_render_title_template_no_placeholders() {
        let result = render_title_template("Static Title", "My Post", "My Site");
        assert_eq!(result, "Static Title");
    }

    #[test]
    fn test_render_title_template_empty() {
        let result = render_title_template("", "My Post", "My Site");
        assert_eq!(result, "");
    }

    #[test]
    fn test_apply_seo_fallbacks_fills_empty_meta() {
        let mut locs = vec![make_localization("My Post", None, None)];
        apply_seo_fallbacks(
            &mut locs,
            "{{title}} | {{site_name}}",
            "Default desc",
            "My Site",
        );
        assert_eq!(locs[0].meta_title.as_deref(), Some("My Post | My Site"));
        assert_eq!(locs[0].meta_description.as_deref(), Some("Default desc"));
    }

    #[test]
    fn test_apply_seo_fallbacks_preserves_existing_meta() {
        let mut locs = vec![make_localization(
            "My Post",
            Some("Custom Title"),
            Some("Custom Desc"),
        )];
        apply_seo_fallbacks(
            &mut locs,
            "{{title}} | {{site_name}}",
            "Default desc",
            "My Site",
        );
        assert_eq!(locs[0].meta_title.as_deref(), Some("Custom Title"));
        assert_eq!(locs[0].meta_description.as_deref(), Some("Custom Desc"));
    }

    #[test]
    fn test_apply_seo_fallbacks_fills_empty_string_meta() {
        let mut locs = vec![make_localization("My Post", Some(""), Some(""))];
        apply_seo_fallbacks(
            &mut locs,
            "{{title}} | {{site_name}}",
            "Default desc",
            "My Site",
        );
        assert_eq!(locs[0].meta_title.as_deref(), Some("My Post | My Site"));
        assert_eq!(locs[0].meta_description.as_deref(), Some("Default desc"));
    }

    #[test]
    fn test_apply_seo_fallbacks_empty_default_description_stays_none() {
        let mut locs = vec![make_localization("My Post", None, None)];
        apply_seo_fallbacks(&mut locs, "{{title}} | {{site_name}}", "", "My Site");
        assert_eq!(locs[0].meta_title.as_deref(), Some("My Post | My Site"));
        assert!(locs[0].meta_description.is_none());
    }

    #[test]
    fn test_apply_seo_fallbacks_empty_template_no_title() {
        let mut locs = vec![make_localization("My Post", None, None)];
        apply_seo_fallbacks(&mut locs, "", "Default desc", "My Site");
        // Empty template renders to empty string, so meta_title stays None
        assert!(locs[0].meta_title.is_none());
    }

    #[test]
    fn test_apply_seo_fallbacks_multiple_localizations() {
        let mut locs = vec![
            make_localization("Post EN", Some("Custom EN"), None),
            make_localization("Post DE", None, None),
        ];
        apply_seo_fallbacks(
            &mut locs,
            "{{title}} - {{site_name}}",
            "Fallback desc",
            "Site",
        );
        // EN: custom title preserved, description filled
        assert_eq!(locs[0].meta_title.as_deref(), Some("Custom EN"));
        assert_eq!(locs[0].meta_description.as_deref(), Some("Fallback desc"));
        // DE: both filled from defaults
        assert_eq!(locs[1].meta_title.as_deref(), Some("Post DE - Site"));
        assert_eq!(locs[1].meta_description.as_deref(), Some("Fallback desc"));
    }

    #[test]
    fn test_seo_context_apply_fills_missing_meta() {
        let ctx = SeoContext {
            title_template: "{{title}} | {{site_name}}".to_string(),
            default_description: "Default desc".to_string(),
            default_og_image_id: None,
            site_name: "My Site".to_string(),
            site_logo_url: None,
        };
        let mut locs = vec![
            make_localization("My Post", None, None),
            make_localization("Done", Some("Custom"), Some("Kept")),
        ];

        ctx.apply(&mut locs);

        // Missing meta filled from the templates...
        assert_eq!(locs[0].meta_title.as_deref(), Some("My Post | My Site"));
        assert_eq!(locs[0].meta_description.as_deref(), Some("Default desc"));
        // ...existing meta preserved.
        assert_eq!(locs[1].meta_title.as_deref(), Some("Custom"));
        assert_eq!(locs[1].meta_description.as_deref(), Some("Kept"));
    }
}
