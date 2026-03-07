//! Module guard
//!
//! Generic request guard that checks whether a content module is enabled
//! for the site identified by the `site_id` route parameter.

use std::marker::PhantomData;

use rocket::http::Status;
use rocket::request::{FromRequest, Outcome, Request};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::models::site_settings::SiteSetting;
use crate::AppState;

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

pub struct CvModule;
impl ModuleMarker for CvModule {
    const SETTING_KEY: &'static str = "module_cv_enabled";
    const MODULE_NAME: &'static str = "cv";
    const DEFAULT_ENABLED: bool = false;
}

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
    /// Check whether the module is enabled for the given site.
    /// Use this for handlers that don't have `site_id` in the route path.
    pub async fn check(pool: &PgPool, site_id: Uuid) -> Result<(), ApiError> {
        let value = SiteSetting::get_value(pool, site_id, M::SETTING_KEY).await?;
        let enabled = value.as_bool().unwrap_or(M::DEFAULT_ENABLED);
        if !enabled {
            return Err(ApiError::Forbidden(format!(
                "The '{}' module is not enabled for this site",
                M::MODULE_NAME
            )));
        }
        Ok(())
    }
}

/// Extract `site_id` UUID from the request URI path.
/// Looks for `/sites/<uuid>/...` pattern.
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

#[rocket::async_trait]
impl<'r, M: ModuleMarker> FromRequest<'r> for ModuleGuard<M> {
    type Error = ApiError;

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let path = request.uri().path().as_str();
        let site_id = match extract_site_id_from_path(path) {
            Some(id) => id,
            None => {
                return Outcome::Error((
                    Status::InternalServerError,
                    ApiError::Internal("ModuleGuard requires site_id in route path".to_string()),
                ));
            }
        };

        let state = match request.rocket().state::<AppState>() {
            Some(s) => s,
            None => {
                return Outcome::Error((
                    Status::InternalServerError,
                    ApiError::Internal("Application state not found".to_string()),
                ));
            }
        };

        match Self::check(&state.db, site_id).await {
            Ok(()) => Outcome::Success(ModuleGuard {
                _marker: PhantomData,
            }),
            Err(e) => Outcome::Error((Status::Forbidden, e)),
        }
    }
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
    fn test_module_markers() {
        assert_eq!(BlogModule::SETTING_KEY, "module_blog_enabled");
        assert_eq!(BlogModule::MODULE_NAME, "blog");
        assert!(BlogModule::DEFAULT_ENABLED);

        assert_eq!(PagesModule::SETTING_KEY, "module_pages_enabled");
        assert_eq!(PagesModule::MODULE_NAME, "pages");
        assert!(PagesModule::DEFAULT_ENABLED);

        assert_eq!(CvModule::SETTING_KEY, "module_cv_enabled");
        assert_eq!(CvModule::MODULE_NAME, "cv");
        assert!(!CvModule::DEFAULT_ENABLED);

        assert_eq!(LegalModule::SETTING_KEY, "module_legal_enabled");
        assert_eq!(LegalModule::MODULE_NAME, "legal");
        assert!(!LegalModule::DEFAULT_ENABLED);

        assert_eq!(DocumentsModule::SETTING_KEY, "module_documents_enabled");
        assert_eq!(DocumentsModule::MODULE_NAME, "documents");
        assert!(!DocumentsModule::DEFAULT_ENABLED);
    }
}
