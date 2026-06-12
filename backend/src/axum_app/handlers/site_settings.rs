//! Axum port of `crate::handlers::site_settings`. Five endpoints for
//! per-site settings + per-site/system storage views.

use axum::extract::{Path, State};
use axum::response::Json;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::dto::site_settings::{
    PreviewTemplate, SiteOverviewEntry, SiteSettingsResponse, SiteStorageSummary,
    SitesOverviewResponse, StorageUsageResponse, SystemStorageOverviewResponse,
    UpdateSiteSettingsRequest,
};
use crate::dto::validated::ValidatedJson;
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::actor::Actor;
use crate::guards::auth_guard::{MasterKey, ReadKey};
use crate::models::audit::AuditAction;
use crate::models::media::MediaFile;
use crate::models::site::Site;
use crate::models::site_settings::SiteSetting;
use crate::repos::document_repo::DocumentRepo;
use crate::services::audited_mutation::AuditedEntity;
use crate::services::permission_service::{Permission, PermissionService};
use crate::AppState;

/// Inject built-in preview templates (prepended), deduping by URL so the
/// stored list never accumulates copies of built-ins from past saves.
fn inject_built_in_templates(response: &mut SiteSettingsResponse, state: &AppState) {
    let built_in = state.settings.preview.templates();
    if !built_in.is_empty() {
        let built_in_urls: std::collections::HashSet<&str> =
            built_in.iter().map(|t| t.url.as_str()).collect();

        response
            .preview_templates
            .retain(|t| !built_in_urls.contains(t.url.as_str()));

        let mut all_templates: Vec<PreviewTemplate> = built_in
            .into_iter()
            .map(|t| PreviewTemplate {
                name: t.name,
                url: t.url,
                is_builtin: true,
            })
            .collect();
        all_templates.append(&mut response.preview_templates);
        response.preview_templates = all_templates;
    }
}

/// Strip built-in URLs out of the user-submitted template list so the
/// upsert only stores user-defined entries.
fn strip_built_in_templates(templates: &mut Vec<PreviewTemplate>, state: &AppState) {
    let built_in_urls: std::collections::HashSet<String> = state
        .settings
        .preview
        .templates()
        .iter()
        .map(|t| t.url.clone())
        .collect();
    templates.retain(|t| !built_in_urls.contains(&t.url));
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/settings",
    tag = "Site Settings",
    operation_id = "get_site_settings",
    description = "Get effective settings for a site (defaults merged with DB values)",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Site settings", body = SiteSettingsResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_site_settings(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<SiteSettingsResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("settings", "read"),
    )
    .await?;
    Site::find_by_id(&state.db, site_id).await?;

    let map = SiteSetting::get_effective_settings(&state.db, site_id).await?;
    let mut response = SiteSettingsResponse::from_map(&map);
    inject_built_in_templates(&mut response, &state);
    Ok(Json(response))
}

#[utoipa::path(
    put,
    path = "/sites/{site_id}/settings",
    tag = "Site Settings",
    operation_id = "update_site_settings",
    description = "Update site settings (upserts provided fields, returns full settings)",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = UpdateSiteSettingsRequest, description = "Settings to update"),
    responses(
        (status = 200, description = "Updated site settings", body = SiteSettingsResponse),
        (status = 400, description = "Malformed request body", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails),
        (status = 422, description = "Validation failed (e.g. data_retention_days outside 30–3650)", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn update_site_settings(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: Actor,
    ValidatedJson(req): ValidatedJson<UpdateSiteSettingsRequest>,
) -> Result<Json<SiteSettingsResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth,
        site_id,
        &Permission::new("settings", "update"),
    )
    .await?;
    Site::find_by_id(&state.db, site_id).await?;

    let mut req = req.into_inner();

    if let Some(ref mut templates) = req.preview_templates {
        strip_built_in_templates(templates, &state);
    }

    for (key, value, is_sensitive) in req.to_settings_vec() {
        SiteSetting::upsert(&state.db, site_id, key, value, is_sensitive).await?;
    }

    let changed_keys: Vec<&str> = req.to_settings_vec().iter().map(|(k, _, _)| *k).collect();
    AuditedEntity::audit_only("site_settings")
        .mutate(AuditAction::SettingsUpdate, site_id)
        .site(site_id)
        .actor(auth.id)
        .metadata(serde_json::json!({ "changed_keys": changed_keys }))
        .execute(&state.db)
        .await;

    let map = SiteSetting::get_effective_settings(&state.db, site_id).await?;
    let mut response = SiteSettingsResponse::from_map(&map);
    inject_built_in_templates(&mut response, &state);
    Ok(Json(response))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/storage",
    tag = "Site Settings",
    operation_id = "get_storage_usage",
    description = "Get storage usage and quota for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Storage usage", body = StorageUsageResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_storage_usage(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<StorageUsageResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("settings", "read"),
    )
    .await?;
    Site::find_by_id(&state.db, site_id).await?;

    let media_bytes = MediaFile::total_storage_for_site(&state.db, site_id).await?;
    let document_bytes = DocumentRepo::total_storage_for_site(&state.db, site_id).await?;
    let total_bytes = media_bytes + document_bytes;

    let quota_bytes = SiteSetting::get_value(
        &state.db,
        site_id,
        crate::models::site_settings::KEY_STORAGE_QUOTA_BYTES,
    )
    .await?
    .as_i64()
    .unwrap_or(1_073_741_824);

    let usage_percent = if quota_bytes > 0 {
        (total_bytes as f64 / quota_bytes as f64) * 100.0
    } else {
        0.0
    };

    Ok(Json(StorageUsageResponse {
        site_id: site_id.to_string(),
        media_bytes,
        document_bytes,
        total_bytes,
        quota_bytes,
        usage_percent,
    }))
}

#[utoipa::path(
    get,
    path = "/admin/storage",
    tag = "Site Settings",
    operation_id = "get_system_storage_overview",
    description = "Get storage usage across all sites (system admin only)",
    responses(
        (status = 200, description = "System storage overview", body = SystemStorageOverviewResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_system_storage_overview(
    State(state): State<AppState>,
    _auth: MasterKey,
) -> Result<Json<SystemStorageOverviewResponse>, ApiError> {
    let sites = Site::find_all(&state.db).await?;

    let mut summaries = Vec::with_capacity(sites.len());
    let mut total_bytes: i64 = 0;
    let mut total_quota: i64 = 0;

    for site in &sites {
        let media_bytes = MediaFile::total_storage_for_site(&state.db, site.id).await?;
        let document_bytes = DocumentRepo::total_storage_for_site(&state.db, site.id).await?;
        let site_total = media_bytes + document_bytes;

        let quota_bytes = SiteSetting::get_value(
            &state.db,
            site.id,
            crate::models::site_settings::KEY_STORAGE_QUOTA_BYTES,
        )
        .await?
        .as_i64()
        .unwrap_or(1_073_741_824);

        let usage_percent = if quota_bytes > 0 {
            (site_total as f64 / quota_bytes as f64) * 100.0
        } else {
            0.0
        };

        total_bytes += site_total;
        total_quota += quota_bytes;

        summaries.push(SiteStorageSummary {
            site_id: site.id.to_string(),
            site_name: site.name.clone(),
            total_bytes: site_total,
            quota_bytes,
            usage_percent,
        });
    }

    Ok(Json(SystemStorageOverviewResponse {
        sites: summaries,
        total_bytes,
        total_quota_bytes: total_quota,
    }))
}

#[utoipa::path(
    get,
    path = "/admin/sites/overview",
    tag = "Site Settings",
    operation_id = "get_sites_overview",
    description = "Get an overview of all sites with maintenance mode, storage, and member count (system admin only)",
    responses(
        (status = 200, description = "Sites overview", body = SitesOverviewResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_sites_overview(
    State(state): State<AppState>,
    _auth: MasterKey,
) -> Result<Json<SitesOverviewResponse>, ApiError> {
    let sites = Site::find_all(&state.db).await?;

    let mut entries = Vec::with_capacity(sites.len());
    for site in &sites {
        let maintenance_mode = SiteSetting::get_value(
            &state.db,
            site.id,
            crate::models::site_settings::KEY_MAINTENANCE_MODE,
        )
        .await?
        .as_bool()
        .unwrap_or(false);

        let member_count =
            crate::models::site_membership::SiteMembership::count_for_site(&state.db, site.id)
                .await?;

        let media_bytes = MediaFile::total_storage_for_site(&state.db, site.id).await?;
        let document_bytes = DocumentRepo::total_storage_for_site(&state.db, site.id).await?;
        let total_storage_bytes = media_bytes + document_bytes;

        let storage_quota_bytes = SiteSetting::get_value(
            &state.db,
            site.id,
            crate::models::site_settings::KEY_STORAGE_QUOTA_BYTES,
        )
        .await?
        .as_i64()
        .unwrap_or(1_073_741_824);

        let storage_usage_percent = if storage_quota_bytes > 0 {
            (total_storage_bytes as f64 / storage_quota_bytes as f64) * 100.0
        } else {
            0.0
        };

        entries.push(SiteOverviewEntry {
            site_id: site.id.to_string(),
            site_name: site.name.clone(),
            slug: site.slug.clone(),
            is_active: site.is_active,
            maintenance_mode,
            member_count,
            total_storage_bytes,
            storage_quota_bytes,
            storage_usage_percent,
            created_at: site.created_at.to_rfc3339(),
        });
    }

    let total_sites = entries.len();
    Ok(Json(SitesOverviewResponse {
        sites: entries,
        total_sites,
    }))
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(get_site_settings, update_site_settings))
        .routes(routes!(get_storage_usage))
        .routes(routes!(get_system_storage_overview))
        .routes(routes!(get_sites_overview))
}
