//! Site archive builder (issue #717, epic #708).
//!
//! Gathers one site's full state into a single JSON document — the shape
//! referenced by closed #219: `site / settings / locales / content /
//! taxonomy / navigation / social_links` plus `forja_version` and
//! `exported_at`. The [`crate::services::site_export_worker`] wraps this
//! JSON together with the site-owned media bytes into one ZIP.
//!
//! Every domain is read through its existing model/repo finder so the
//! archive stays consistent with what the admin API itself returns;
//! localization sets (which have no per-site finder) are aggregated in
//! SQL to a JSON array, avoiding bespoke row structs.

use std::future::Future;

use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::models::navigation::NavigationItem;
use crate::models::navigation_menu::NavigationMenu;
use crate::models::site::Site;
use crate::models::site_locale::SiteLocale;
use crate::models::site_settings::SiteSetting;
use crate::models::social::SocialLink;
use crate::models::taxonomy::{Category, Tag};
use crate::repos::blog_repo::BlogRepo;
use crate::repos::page_repo::PageRepo;

/// A site-owned media file the worker must also bundle (bytes) into the
/// ZIP. Doubles as the archive's `media` manifest entry.
#[derive(Debug, Clone, Serialize)]
pub struct OwnedMedia {
    pub id: Uuid,
    pub filename: String,
    pub original_filename: String,
    pub mime_type: String,
    pub file_size: i64,
    pub storage_path: String,
}

/// Site-owned media (mirrors the `media_sites.is_owner = TRUE` ownership
/// rule used by `site_content_reset`). Media merely *shared* into the
/// site is owned elsewhere and is not exported.
pub async fn gather_owned_media(pool: &PgPool, site_id: Uuid) -> Result<Vec<OwnedMedia>, ApiError> {
    let rows = sqlx::query_as::<_, (Uuid, String, String, String, i64, String)>(
        "SELECT mf.id, mf.filename, mf.original_filename, mf.mime_type, \
                mf.file_size, mf.storage_path \
         FROM media_files mf \
         JOIN media_sites ms ON mf.id = ms.media_file_id \
         WHERE ms.site_id = $1 AND ms.is_owner = TRUE AND mf.is_deleted = FALSE \
         ORDER BY mf.created_at ASC",
    )
    .bind(site_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(
            |(id, filename, original_filename, mime_type, file_size, storage_path)| OwnedMedia {
                id,
                filename,
                original_filename,
                mime_type,
                file_size,
                storage_path,
            },
        )
        .collect())
}

/// Build the full JSON archive for `site_id`. `media` is the already
/// gathered owned-media list (passed in so the worker reads it once for
/// both the manifest here and the byte-bundling).
pub async fn build_archive(
    pool: &PgPool,
    site_id: Uuid,
    media: &[OwnedMedia],
) -> Result<serde_json::Value, ApiError> {
    let site = Site::find_by_id(pool, site_id).await?;
    let settings = SiteSetting::find_all_for_site(pool, site_id).await?;
    let locales = SiteLocale::find_all_for_site(pool, site_id).await?;

    let blogs =
        paginate_all(|limit, offset| BlogRepo::find_all_for_site(pool, site_id, limit, offset))
            .await?;
    let pages =
        paginate_all(|limit, offset| PageRepo::find_all_for_site(pool, site_id, limit, offset))
            .await?;
    let content_localizations = jsonb_agg(
        pool,
        site_id,
        "SELECT COALESCE(jsonb_agg(cl.*), '[]'::jsonb) \
         FROM content_localizations cl \
         JOIN content_sites cs ON cl.content_id = cs.content_id \
         WHERE cs.site_id = $1",
    )
    .await?;

    let tags =
        paginate_all(|limit, offset| Tag::find_all_for_site(pool, site_id, limit, offset)).await?;
    let categories = Category::find_all_for_site(pool, site_id).await?;
    let tag_localizations = jsonb_agg(
        pool,
        site_id,
        "SELECT COALESCE(jsonb_agg(tl.*), '[]'::jsonb) \
         FROM tag_localizations tl \
         JOIN tag_sites ts ON tl.tag_id = ts.tag_id \
         WHERE ts.site_id = $1",
    )
    .await?;
    let category_localizations = jsonb_agg(
        pool,
        site_id,
        "SELECT COALESCE(jsonb_agg(cl.*), '[]'::jsonb) \
         FROM category_localizations cl \
         JOIN category_sites cs ON cl.category_id = cs.category_id \
         WHERE cs.site_id = $1",
    )
    .await?;

    let menus = NavigationMenu::find_all_for_site(pool, site_id).await?;
    let nav_items = NavigationItem::find_all_for_site_admin(pool, site_id).await?;
    let nav_item_localizations = jsonb_agg(
        pool,
        site_id,
        "SELECT COALESCE(jsonb_agg(nil.*), '[]'::jsonb) \
         FROM navigation_item_localizations nil \
         JOIN navigation_items ni ON nil.navigation_item_id = ni.id \
         WHERE ni.site_id = $1",
    )
    .await?;

    let social_links = SocialLink::find_all_for_site_admin(pool, site_id).await?;

    Ok(serde_json::json!({
        "forja_version": env!("CARGO_PKG_VERSION"),
        "exported_at": chrono::Utc::now().to_rfc3339(),
        "site": site,
        "settings": settings,
        "locales": locales,
        "content": {
            "blogs": blogs,
            "pages": pages,
            "localizations": content_localizations,
        },
        "taxonomy": {
            "tags": tags,
            "tag_localizations": tag_localizations,
            "categories": categories,
            "category_localizations": category_localizations,
        },
        "navigation": {
            "menus": menus,
            "items": nav_items,
            "item_localizations": nav_item_localizations,
        },
        "social_links": social_links,
        "media": media,
    }))
}

/// Drain every page of a `(limit, offset) -> Vec<T>` finder so the export
/// never silently truncates a large site. Shared by blogs/pages/tags.
async fn paginate_all<T, F, Fut>(mut fetch: F) -> Result<Vec<T>, ApiError>
where
    F: FnMut(i64, i64) -> Fut,
    Fut: Future<Output = Result<Vec<T>, ApiError>>,
{
    const PAGE: i64 = 500;
    let mut all = Vec::new();
    let mut offset = 0;
    loop {
        let mut page = fetch(PAGE, offset).await?;
        let got = page.len() as i64;
        all.append(&mut page);
        if got < PAGE {
            break;
        }
        offset += PAGE;
    }
    Ok(all)
}

/// Run a `SELECT COALESCE(jsonb_agg(...), '[]')` site-scoped query and
/// return the JSON array. Keeps localization sets out of bespoke structs.
async fn jsonb_agg(pool: &PgPool, site_id: Uuid, sql: &str) -> Result<serde_json::Value, ApiError> {
    let v = sqlx::query_scalar::<_, serde_json::Value>(sql)
        .bind(site_id)
        .fetch_one(pool)
        .await?;
    Ok(v)
}
