//! Federation settings admin endpoints

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;
use validator::Validate;

use crate::dto::federation::requests::UpdateFederationSettingsRequest;
use crate::dto::federation::responses::FederationSettingsResponse;
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::guards::federation_guard::{can_admin_federation, can_manage_federation};
use crate::guards::module_guard::{FederationModule, ModuleGuard};
use crate::models::federation::actor::{self, ApActor};
use crate::models::federation::types::ApSignatureAlgorithm;
use crate::models::site::Site;
use crate::models::site_membership::SiteRole;
use crate::models::site_settings::{self, SiteSetting};
use crate::services::encryption;
use crate::services::federation::key_management;
use crate::AppState;

/// Build a FederationSettingsResponse from site settings and optional actor.
async fn build_settings_response(
    state: &AppState,
    site_id: Uuid,
) -> Result<FederationSettingsResponse, ApiError> {
    let enabled = SiteSetting::get_value(
        &state.db,
        site_id,
        site_settings::KEY_MODULE_FEDERATION_ENABLED,
    )
    .await?
    .as_bool()
    .unwrap_or(false);

    let sig_algo = SiteSetting::get_value(
        &state.db,
        site_id,
        site_settings::KEY_FEDERATION_SIGNATURE_ALGO,
    )
    .await?
    .as_str()
    .unwrap_or("rsa-sha256")
    .to_string();

    let mod_mode = SiteSetting::get_value(
        &state.db,
        site_id,
        site_settings::KEY_FEDERATION_MODERATION_MODE,
    )
    .await?
    .as_str()
    .unwrap_or("manual")
    .to_string();

    let auto_pub = SiteSetting::get_value(
        &state.db,
        site_id,
        site_settings::KEY_FEDERATION_AUTO_PUBLISH,
    )
    .await?
    .as_bool()
    .unwrap_or(false);

    let (actor_uri, webfinger_address, summary) = if enabled {
        let actor = ApActor::find_by_site_id(&state.db, site_id).await?;
        if let Some(actor) = actor {
            let site = Site::find_by_id(&state.db, site_id).await?;
            let domain: String = sqlx::query_scalar(
                "SELECT domain FROM site_domains WHERE site_id = $1 AND is_primary = TRUE AND environment = 'production' LIMIT 1"
            )
            .bind(site_id)
            .fetch_optional(&state.db)
            .await?
            .unwrap_or_else(|| "localhost".to_string());

            let uri = actor.actor_uri(&domain, &site.slug);
            let wf = format!("{}@{}", site.slug, domain);
            let sum = actor.summary.clone();
            (Some(uri), Some(wf), sum)
        } else {
            (None, None, None)
        }
    } else {
        (None, None, None)
    };

    Ok(FederationSettingsResponse {
        enabled,
        signature_algorithm: sig_algo,
        moderation_mode: mod_mode,
        auto_publish: auto_pub,
        actor_uri,
        webfinger_address,
        summary,
    })
}

/// Get federation settings for a site
#[utoipa::path(
    tag = "Federation",
    operation_id = "get_federation_settings",
    description = "Get federation settings for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Federation settings", body = FederationSettingsResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/federation/settings")]
pub async fn get_settings(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
) -> Result<Json<FederationSettingsResponse>, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Reviewer)
        .await?;
    if !can_manage_federation(&role) {
        return Err(ApiError::forbidden(
            "Insufficient role to view federation settings",
        ));
    }

    Site::find_by_id(&state.db, site_id).await?;

    let response = build_settings_response(state.inner(), site_id).await?;
    Ok(Json(response))
}

/// Update federation settings for a site
#[utoipa::path(
    tag = "Federation",
    operation_id = "update_federation_settings",
    description = "Update federation settings for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = UpdateFederationSettingsRequest, description = "Settings to update"),
    responses(
        (status = 200, description = "Updated federation settings", body = FederationSettingsResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[put("/sites/<site_id>/federation/settings", data = "<body>")]
pub async fn update_settings(
    state: &State<AppState>,
    site_id: Uuid,
    body: Json<UpdateFederationSettingsRequest>,
    auth: ReadKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Json<FederationSettingsResponse>, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Admin)
        .await?;
    if !can_manage_federation(&role) {
        return Err(ApiError::forbidden(
            "Insufficient role to manage federation settings",
        ));
    }

    Site::find_by_id(&state.db, site_id).await?;

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::bad_request(format!("Validation error: {e}")))?;

    // Upsert each provided field
    if let Some(algo) = &req.signature_algorithm {
        SiteSetting::upsert(
            &state.db,
            site_id,
            site_settings::KEY_FEDERATION_SIGNATURE_ALGO,
            serde_json::json!(algo),
            false,
        )
        .await?;
    }
    if let Some(mode) = &req.moderation_mode {
        SiteSetting::upsert(
            &state.db,
            site_id,
            site_settings::KEY_FEDERATION_MODERATION_MODE,
            serde_json::json!(mode),
            false,
        )
        .await?;
    }
    if let Some(auto) = req.auto_publish {
        SiteSetting::upsert(
            &state.db,
            site_id,
            site_settings::KEY_FEDERATION_AUTO_PUBLISH,
            serde_json::json!(auto),
            false,
        )
        .await?;
    }
    if let Some(ref summary) = req.summary {
        let summary_val = if summary.is_empty() {
            None
        } else {
            Some(summary.as_str())
        };
        ApActor::update_summary(&state.db, site_id, summary_val).await?;
    }

    let response = build_settings_response(state.inner(), site_id).await?;
    Ok(Json(response))
}

/// Enable federation for a site
///
/// Generates RSA + Ed25519 keypairs, encrypts private keys, creates the
/// ActivityPub actor, and enables the federation module.
#[utoipa::path(
    tag = "Federation",
    operation_id = "enable_federation",
    description = "Enable federation for a site (Owner only). Generates actor keypairs.",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Federation enabled", body = FederationSettingsResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails),
        (status = 409, description = "Federation already enabled", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/sites/<site_id>/federation/enable")]
pub async fn enable_federation(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
) -> Result<Json<FederationSettingsResponse>, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Owner)
        .await?;
    if !can_admin_federation(&role) {
        return Err(ApiError::forbidden(
            "Only site owners can enable federation",
        ));
    }

    let site = Site::find_by_id(&state.db, site_id).await?;

    // Check if already enabled
    let already = SiteSetting::get_value(
        &state.db,
        site_id,
        site_settings::KEY_MODULE_FEDERATION_ENABLED,
    )
    .await?
    .as_bool()
    .unwrap_or(false);
    if already {
        return Err(ApiError::conflict(
            "Federation is already enabled for this site",
        ));
    }

    // Generate RSA keypair
    let (rsa_private_der, rsa_public_pem) = key_management::generate_rsa_keypair()?;

    // Generate Ed25519 keypair
    let (_ed_private, _ed_public) = key_management::generate_ed25519_keypair()?;

    // Encrypt RSA private key
    let enc_key = encryption::resolve_key(&state.settings.security.ai_encryption_key)?;
    let (rsa_enc, rsa_nonce) = key_management::encrypt_private_key(&rsa_private_der, &enc_key)?;

    // Look up the production domain
    let domain: String = sqlx::query_scalar(
        "SELECT domain FROM site_domains WHERE site_id = $1 AND is_primary = TRUE AND environment = 'production' LIMIT 1"
    )
    .bind(site_id)
    .fetch_optional(&state.db)
    .await?
    .unwrap_or_else(|| "localhost".to_string());

    let (inbox_url, outbox_url, followers_url) = actor::generate_urls(&domain, &site.slug);

    // Create actor
    ApActor::create(
        &state.db,
        site_id,
        &site.slug,
        &site.name,
        site.description.as_deref(),
        &rsa_enc,
        &rsa_nonce,
        &rsa_public_pem,
        ApSignatureAlgorithm::RsaSha256,
        &inbox_url,
        &outbox_url,
        &followers_url,
    )
    .await?;

    // Enable module
    SiteSetting::upsert(
        &state.db,
        site_id,
        site_settings::KEY_MODULE_FEDERATION_ENABLED,
        serde_json::json!(true),
        false,
    )
    .await?;

    tracing::info!(site_id = %site_id, "Federation enabled");

    let response = build_settings_response(state.inner(), site_id).await?;
    Ok(Json(response))
}

/// Disable federation for a site
#[utoipa::path(
    tag = "Federation",
    operation_id = "disable_federation",
    description = "Disable federation for a site (Owner only). Actor data is preserved.",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 204, description = "Federation disabled"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/sites/<site_id>/federation/disable")]
pub async fn disable_federation(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Owner)
        .await?;
    if !can_admin_federation(&role) {
        return Err(ApiError::forbidden(
            "Only site owners can disable federation",
        ));
    }

    Site::find_by_id(&state.db, site_id).await?;

    SiteSetting::upsert(
        &state.db,
        site_id,
        site_settings::KEY_MODULE_FEDERATION_ENABLED,
        serde_json::json!(false),
        false,
    )
    .await?;

    tracing::info!(site_id = %site_id, "Federation disabled");

    Ok(Status::NoContent)
}

/// Rotate federation keys for a site
#[utoipa::path(
    tag = "Federation",
    operation_id = "rotate_federation_keys",
    description = "Rotate the cryptographic keys for the site's ActivityPub actor (Owner only).",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 204, description = "Keys rotated successfully"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found or federation not enabled", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/sites/<site_id>/federation/rotate-keys")]
pub async fn rotate_keys(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Status, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Owner)
        .await?;
    if !can_admin_federation(&role) {
        return Err(ApiError::forbidden(
            "Only site owners can rotate federation keys",
        ));
    }

    let site = Site::find_by_id(&state.db, site_id).await?;

    // Ensure actor exists
    let _actor = ApActor::find_by_site_id(&state.db, site_id)
        .await?
        .ok_or_else(|| ApiError::not_found("No ActivityPub actor to rotate keys for"))?;

    // Generate new RSA keypair
    let (rsa_private_der, rsa_public_pem) = key_management::generate_rsa_keypair()?;

    let enc_key = encryption::resolve_key(&state.settings.security.ai_encryption_key)?;
    let (rsa_enc, rsa_nonce) = key_management::encrypt_private_key(&rsa_private_der, &enc_key)?;

    // Delete old actor and create new one with fresh keys
    ApActor::delete_by_site_id(&state.db, site_id).await?;

    let domain: String = sqlx::query_scalar(
        "SELECT domain FROM site_domains WHERE site_id = $1 AND is_primary = TRUE AND environment = 'production' LIMIT 1"
    )
    .bind(site_id)
    .fetch_optional(&state.db)
    .await?
    .unwrap_or_else(|| "localhost".to_string());

    let (inbox_url, outbox_url, followers_url) = actor::generate_urls(&domain, &site.slug);

    ApActor::create(
        &state.db,
        site_id,
        &site.slug,
        &site.name,
        site.description.as_deref(),
        &rsa_enc,
        &rsa_nonce,
        &rsa_public_pem,
        ApSignatureAlgorithm::RsaSha256,
        &inbox_url,
        &outbox_url,
        &followers_url,
    )
    .await?;

    tracing::info!(site_id = %site_id, "Federation keys rotated");

    Ok(Status::NoContent)
}

/// Collect admin settings routes
pub fn routes() -> Vec<Route> {
    routes![
        get_settings,
        update_settings,
        enable_federation,
        disable_federation,
        rotate_keys
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(
            routes.len(),
            5,
            "Should have 5 federation admin settings routes"
        );
    }
}
