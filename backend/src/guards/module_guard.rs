//! Module guard
//!
//! Generic request guard that checks whether a content module is enabled
//! for the site identified by the `site_id` route parameter.

use std::marker::PhantomData;

use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::codes;
use crate::errors::ApiError;
use crate::models::site_settings::SiteSetting;

/// Marker trait for content modules.
/// Each module defines its setting key, display name, and default state.
pub trait ModuleMarker: Send + Sync + 'static {
    const SETTING_KEY: &'static str;
    const MODULE_NAME: &'static str;
    const DEFAULT_ENABLED: bool;
}

// ── Module markers ──────────────────────────────────────────────────

pub struct BlogModule;
impl ModuleMarker for BlogModule {
    const SETTING_KEY: &'static str = "module_blog_enabled";
    const MODULE_NAME: &'static str = "blog";
    const DEFAULT_ENABLED: bool = true;
}

pub struct PagesModule;
impl ModuleMarker for PagesModule {
    const SETTING_KEY: &'static str = "module_pages_enabled";
    const MODULE_NAME: &'static str = "pages";
    const DEFAULT_ENABLED: bool = true;
}

pub struct PortfolioModule;
impl ModuleMarker for PortfolioModule {
    const SETTING_KEY: &'static str = "module_portfolio_enabled";
    const MODULE_NAME: &'static str = "portfolio";
    const DEFAULT_ENABLED: bool = false;
}

/// Backward-compatible alias for CvModule
pub type CvModule = PortfolioModule;

pub struct LegalModule;
impl ModuleMarker for LegalModule {
    const SETTING_KEY: &'static str = "module_legal_enabled";
    const MODULE_NAME: &'static str = "legal";
    const DEFAULT_ENABLED: bool = false;
}

pub struct DocumentsModule;
impl ModuleMarker for DocumentsModule {
    const SETTING_KEY: &'static str = "module_documents_enabled";
    const MODULE_NAME: &'static str = "documents";
    const DEFAULT_ENABLED: bool = false;
}

pub struct AiModule;
impl ModuleMarker for AiModule {
    const SETTING_KEY: &'static str = "module_ai_enabled";
    const MODULE_NAME: &'static str = "ai";
    const DEFAULT_ENABLED: bool = false;
}

pub struct FormsModule;
impl ModuleMarker for FormsModule {
    const SETTING_KEY: &'static str = "module_forms_enabled";
    const MODULE_NAME: &'static str = "forms";
    const DEFAULT_ENABLED: bool = false;
}

/// User-defined content types ("Collections", #789). Off by default — a
/// site opts in before the schema-builder and entry APIs become reachable.
pub struct CollectionsModule;
impl ModuleMarker for CollectionsModule {
    const SETTING_KEY: &'static str = "module_collections_enabled";
    const MODULE_NAME: &'static str = "collections";
    const DEFAULT_ENABLED: bool = false;
}

// ── Guard struct ────────────────────────────────────────────────────

/// Request guard that rejects requests when the content module is disabled.
///
/// Use as a handler parameter for routes with `site_id` in the path:
/// ```ignore
/// fn list_blogs(state: &State<AppState>, site_id: Uuid, _module: ModuleGuard<BlogModule>) { ... }
/// ```
///
/// For routes that resolve `site_id` from an entity, call the static check:
/// ```ignore
/// ModuleGuard::<BlogModule>::check(&state.db, resolved_site_id).await?;
/// ```
pub struct ModuleGuard<M: ModuleMarker> {
    _marker: PhantomData<M>,
}

impl<M: ModuleMarker> ModuleGuard<M> {
    /// Construct a successful guard marker. Used by framework adapters
    /// (Rocket `FromRequest`, Axum `FromRequestParts`) after a passing
    /// `check()` call. The struct itself carries no runtime data — the
    /// type parameter `M` is the proof.
    pub fn new() -> Self {
        Self {
            _marker: PhantomData,
        }
    }

    /// Check whether the module is enabled for the given site.
    /// Use this for handlers that don't have `site_id` in the route path.
    pub async fn check(pool: &PgPool, site_id: Uuid) -> Result<(), ApiError> {
        let value = SiteSetting::get_value(pool, site_id, M::SETTING_KEY).await?;
        let enabled = value.as_bool().unwrap_or(M::DEFAULT_ENABLED);
        if !enabled {
            return Err(ApiError::forbidden(format!(
                "The '{}' module is not enabled for this site",
                M::MODULE_NAME
            ))
            .with_code(codes::MODULE_NOT_ENABLED));
        }
        Ok(())
    }
}

impl<M: ModuleMarker> Default for ModuleGuard<M> {
    fn default() -> Self {
        Self::new()
    }
}

/// Extract `site_id` UUID from the request URI path.
/// Looks for `/sites/<uuid>/...` pattern.
#[cfg(test)]
fn extract_site_id_from_path(path: &str) -> Option<Uuid> {
    let segments: Vec<&str> = path.split('/').collect();
    for (i, seg) in segments.iter().enumerate() {
        if *seg == "sites" {
            if let Some(next) = segments.get(i + 1) {
                return Uuid::parse_str(next).ok();
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_site_id_from_path() {
        let uuid = "550e8400-e29b-41d4-a716-446655440000";
        let path = format!("/api/v1/sites/{}/blogs", uuid);
        let result = extract_site_id_from_path(&path);
        assert_eq!(result, Some(Uuid::parse_str(uuid).unwrap()));
    }

    #[test]
    fn test_extract_site_id_no_sites_segment() {
        let result = extract_site_id_from_path("/api/v1/blogs/some-id");
        assert!(result.is_none());
    }

    #[test]
    fn test_extract_site_id_invalid_uuid() {
        let result = extract_site_id_from_path("/api/v1/sites/not-a-uuid/blogs");
        assert!(result.is_none());
    }

    #[test]
    fn test_extract_site_id_sites_at_end() {
        let result = extract_site_id_from_path("/api/v1/sites");
        assert!(result.is_none());
    }

    #[test]
    #[allow(clippy::assertions_on_constants)]
    fn test_module_markers() {
        assert_eq!(BlogModule::SETTING_KEY, "module_blog_enabled");
        assert_eq!(BlogModule::MODULE_NAME, "blog");
        assert!(BlogModule::DEFAULT_ENABLED);

        assert_eq!(PagesModule::SETTING_KEY, "module_pages_enabled");
        assert_eq!(PagesModule::MODULE_NAME, "pages");
        assert!(PagesModule::DEFAULT_ENABLED);

        assert_eq!(PortfolioModule::SETTING_KEY, "module_portfolio_enabled");
        assert_eq!(PortfolioModule::MODULE_NAME, "portfolio");
        assert!(!PortfolioModule::DEFAULT_ENABLED);

        assert_eq!(LegalModule::SETTING_KEY, "module_legal_enabled");
        assert_eq!(LegalModule::MODULE_NAME, "legal");
        assert!(!LegalModule::DEFAULT_ENABLED);

        assert_eq!(DocumentsModule::SETTING_KEY, "module_documents_enabled");
        assert_eq!(DocumentsModule::MODULE_NAME, "documents");
        assert!(!DocumentsModule::DEFAULT_ENABLED);

        assert_eq!(AiModule::SETTING_KEY, "module_ai_enabled");
        assert_eq!(AiModule::MODULE_NAME, "ai");
        assert!(!AiModule::DEFAULT_ENABLED);

        assert_eq!(FormsModule::SETTING_KEY, "module_forms_enabled");
        assert_eq!(FormsModule::MODULE_NAME, "forms");
        assert!(!FormsModule::DEFAULT_ENABLED);
    }
}
