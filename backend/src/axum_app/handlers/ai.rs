//! Axum port of `crate::handlers::ai`. 6 endpoints for AI provider
//! configuration + content generation. Mounted under `/api/v1`.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::Json;
use base64::Engine;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::AppState;
use crate::dto::ai::{
    AiAction, AiConfigResponse, AiGenerateRequest, AiGenerateResponse, AiTestResponse,
    CreateAiConfigRequest, ListModelsRequest, ListModelsResponse,
};
use crate::dto::validated::ValidatedJson;
use crate::errors::{ApiError, ProblemDetails, codes};
use crate::guards::auth_guard::{AdminKey, ReadKey, WriteKey};
use crate::guards::module_guard::{AiModule, ModuleGuard};
use crate::models::ai_config::SiteAiConfig;
use crate::models::audit::AuditAction;
use crate::models::media::{MediaFile, MediaVariant};
use crate::services::audited_mutation::AuditedEntity;
use crate::services::permission_service::{Permission, PermissionService};
use crate::services::url_validation;
use crate::services::{ai_service, encryption};

#[utoipa::path(
    get,
    path = "/sites/{site_id}/ai/config",
    tag = "AI",
    operation_id = "get_ai_config",
    description = "Get AI configuration for a site (API key is masked). Returns null if not configured.",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "AI configuration (null if not configured)", body = Option<AiConfigResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("bearer_auth" = []), ("api_key" = []))
)]
async fn get_ai_config(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<Option<AiConfigResponse>>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("settings", "read"),
    )
    .await?;

    let config = match SiteAiConfig::find_by_site_id(&state.db, site_id).await? {
        Some(config) => config,
        None => return Ok(Json(None)),
    };

    let key = encryption::resolve_key(&state.settings.security.ai_encryption_key)?;
    let api_key_plain =
        encryption::decrypt(&config.api_key_encrypted, &config.api_key_nonce, &key)?;

    Ok(Json(Some(AiConfigResponse {
        id: config.id,
        site_id: config.site_id,
        provider_name: config.provider_name,
        base_url: config.base_url,
        api_key_masked: encryption::mask_api_key(&api_key_plain),
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        system_prompts: config.system_prompts,
        task_configs: config.task_configs,
        updated_at: config.updated_at.to_rfc3339(),
    })))
}

#[utoipa::path(
    put,
    path = "/sites/{site_id}/ai/config",
    tag = "AI",
    operation_id = "upsert_ai_config",
    description = "Create or update AI configuration for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body = CreateAiConfigRequest,
    responses(
        (status = 200, description = "AI configuration saved", body = AiConfigResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("bearer_auth" = []), ("api_key" = []))
)]
async fn upsert_ai_config(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: AdminKey,
    ValidatedJson(req): ValidatedJson<CreateAiConfigRequest>,
) -> Result<Json<AiConfigResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("settings", "update"),
    )
    .await?;

    if !state.settings.is_development() {
        url_validation::validate_target_url(&req.base_url)
            .await
            .map_err(|e| e.with_code(codes::AI_URL_SSRF))?;
    }

    let key = encryption::resolve_key(&state.settings.security.ai_encryption_key)?;
    let (encrypted, nonce) = if let Some(ref api_key) = req.api_key {
        encryption::encrypt(api_key, &key)?
    } else {
        match SiteAiConfig::find_by_site_id(&state.db, site_id).await? {
            Some(existing) => (existing.api_key_encrypted, existing.api_key_nonce),
            None => encryption::encrypt("", &key)?,
        }
    };

    let config = SiteAiConfig::upsert(
        &state.db,
        site_id,
        &req.provider_name,
        &req.base_url,
        &encrypted,
        &nonce,
        &req.model,
        req.temperature.unwrap_or(0.7),
        req.max_tokens.unwrap_or(1024),
        &req.system_prompts.clone().unwrap_or(serde_json::json!({})),
        &req.task_configs.clone().unwrap_or(serde_json::json!({})),
    )
    .await?;

    let api_key_plain = encryption::decrypt(&encrypted, &nonce, &key)?;
    let api_key_masked = encryption::mask_api_key(&api_key_plain);

    AuditedEntity::audit_only("ai_config")
        .mutate(AuditAction::Update, config.id)
        .site(site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;

    Ok(Json(AiConfigResponse {
        id: config.id,
        site_id: config.site_id,
        provider_name: config.provider_name,
        base_url: config.base_url,
        api_key_masked,
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        system_prompts: config.system_prompts,
        task_configs: config.task_configs,
        updated_at: config.updated_at.to_rfc3339(),
    }))
}

#[utoipa::path(
    delete,
    path = "/sites/{site_id}/ai/config",
    tag = "AI",
    operation_id = "delete_ai_config",
    description = "Remove AI configuration for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 204, description = "AI configuration removed"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("bearer_auth" = []), ("api_key" = []))
)]
async fn delete_ai_config(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: AdminKey,
) -> Result<StatusCode, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("settings", "update"),
    )
    .await?;

    SiteAiConfig::delete_by_site_id(&state.db, site_id).await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/ai/test",
    tag = "AI",
    operation_id = "test_ai_connection",
    description = "Test the AI provider connection by sending a small prompt",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Connection test result", body = AiTestResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("bearer_auth" = []), ("api_key" = []))
)]
async fn test_ai_connection(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: AdminKey,
) -> Result<Json<AiTestResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("settings", "update"),
    )
    .await?;

    match ai_service::test_connection(
        &state.db,
        site_id,
        &state.settings.security.ai_encryption_key,
    )
    .await
    {
        Ok(()) => Ok(Json(AiTestResponse {
            success: true,
            message: "Connection successful — AI provider responded correctly.".into(),
        })),
        Err(e) => Ok(Json(AiTestResponse {
            success: false,
            message: format!("Connection failed: {e}"),
        })),
    }
}

/// Guard an outbound vision `image_url` against SSRF before it is forwarded to
/// the AI provider. Inlined `data:` URLs carry their own bytes (no fetch
/// happens) and are exempt; every other URL must resolve only to public IPs,
/// reusing the same DNS-pinning validator and `AI_URL_SSRF` code as `base_url`.
async fn validate_vision_image_url(image_url: &str) -> Result<(), ApiError> {
    if image_url.starts_with("data:") {
        return Ok(());
    }
    url_validation::validate_target_url(image_url)
        .await
        .map_err(|e| e.with_code(codes::AI_URL_SSRF))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/ai/generate",
    tag = "AI",
    operation_id = "generate_ai_content",
    description = "Generate AI-assisted content (SEO, excerpt, or translation)",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body = AiGenerateRequest,
    responses(
        (status = 200, description = "Generated content", body = AiGenerateResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 429, description = "Rate limited", body = ProblemDetails)
    ),
    security(("bearer_auth" = []), ("api_key" = []))
)]
async fn generate_ai_content(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
    _module: ModuleGuard<AiModule>,
    ValidatedJson(req): ValidatedJson<AiGenerateRequest>,
) -> Result<Json<AiGenerateResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("settings", "update"),
    )
    .await?;

    let mut req = req.into_inner();

    if !matches!(
        req.action,
        AiAction::AutoTag
            | AiAction::AltText
            | AiAction::ImageCaption
            | AiAction::ImageTitle
            | AiAction::SectionContent
    ) && req.content.is_empty()
    {
        return Err(
            ApiError::bad_request("content is required for text actions")
                .with_code(codes::BAD_REQUEST),
        );
    }

    if matches!(req.action, AiAction::SectionContent) {
        let ctx = req.section_context.as_ref().ok_or_else(|| {
            ApiError::bad_request("section_context is required for section_content action")
                .with_code(codes::AI_SECTION_CONTEXT_INSUFFICIENT)
        })?;
        if ctx.section_type.trim().is_empty() {
            return Err(
                ApiError::bad_request("section_context.section_type must not be empty")
                    .with_code(codes::AI_SECTION_TYPE_UNKNOWN),
            );
        }
    }

    if matches!(req.action, AiAction::Translate) && req.target_locale.is_none() {
        return Err(
            ApiError::bad_request("target_locale is required for translate action")
                .with_code(codes::AI_TRANSLATE_INVALID),
        );
    }

    if matches!(
        req.action,
        AiAction::AutoTag | AiAction::AltText | AiAction::ImageCaption | AiAction::ImageTitle
    ) && req.image_url.is_none()
    {
        return Err(
            ApiError::bad_request("image_url is required for vision actions")
                .with_code(codes::AI_VISION_MISSING_IMAGE),
        );
    }

    if matches!(
        req.action,
        AiAction::AutoTag | AiAction::AltText | AiAction::ImageCaption | AiAction::ImageTitle
    ) {
        if let Some(ref image_url) = req.image_url.clone()
            && let Ok(Some(media)) = MediaFile::find_by_public_url(&state.db, image_url).await
            && let Ok(variants) = MediaVariant::find_for_media(&state.db, media.id).await
        {
            let preferred = [
                crate::models::media::MediaVariantType::Medium,
                crate::models::media::MediaVariantType::Small,
                crate::models::media::MediaVariantType::Thumbnail,
            ];
            let variant = preferred
                .iter()
                .find_map(|name| variants.iter().find(|v| &v.variant_name == name));

            if let Some(v) = variant
                && let Ok((bytes, content_type)) = state.storage.fetch(&v.storage_path).await
            {
                let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                let mime = if content_type.is_empty() {
                    media.mime_type.clone()
                } else {
                    content_type
                };
                req.image_url = Some(format!("data:{mime};base64,{b64}"));
                tracing::debug!(
                    "Using base64 {:?} variant ({} bytes) instead of full-res URL for vision AI",
                    v.variant_name,
                    bytes.len()
                );
            }
        }

        // Internal media was just inlined as a base64 data: URL above. Any URL
        // still pointing outward must pass the SSRF guard before we hand it to
        // the provider — mirrors the base_url check in upsert/test config.
        if !state.settings.is_development()
            && let Some(ref image_url) = req.image_url
        {
            validate_vision_image_url(image_url).await?;
        }
    }

    let result = ai_service::generate(
        &state.db,
        site_id,
        &state.settings.security.ai_encryption_key,
        &req,
        Some(&auth.0),
    )
    .await?;

    AuditedEntity::audit_only("ai_generation")
        .mutate(AuditAction::Create, uuid::Uuid::new_v4())
        .site(site_id)
        .actor(auth.0.id)
        .metadata(serde_json::json!({
            "action": format!("{:?}", req.action),
        }))
        .execute(&state.db)
        .await;

    Ok(Json(result))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/ai/models",
    tag = "AI",
    operation_id = "list_ai_models",
    description = "List available models from an AI provider (for auto-discovery)",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body = ListModelsRequest,
    responses(
        (status = 200, description = "Available models", body = ListModelsResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("bearer_auth" = []), ("api_key" = []))
)]
async fn list_ai_models(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(req): ValidatedJson<ListModelsRequest>,
) -> Result<Json<ListModelsResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("settings", "read"),
    )
    .await?;

    if !state.settings.is_development() {
        url_validation::validate_target_url(&req.base_url)
            .await
            .map_err(|e| e.with_code(codes::AI_URL_SSRF))?;
    }

    let api_key = match req.api_key.as_deref() {
        Some(k) if !k.is_empty() => Some(k.to_string()),
        _ => {
            if let Some(config) = SiteAiConfig::find_by_site_id(&state.db, site_id).await? {
                let key = encryption::resolve_key(&state.settings.security.ai_encryption_key)?;
                let decrypted =
                    encryption::decrypt(&config.api_key_encrypted, &config.api_key_nonce, &key)?;
                if decrypted.is_empty() {
                    None
                } else {
                    Some(decrypted)
                }
            } else {
                None
            }
        }
    };

    let models =
        ai_service::list_models(&req.base_url, api_key.as_deref(), &req.provider_name).await?;

    Ok(Json(ListModelsResponse { models }))
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(get_ai_config, upsert_ai_config, delete_ai_config))
        .routes(routes!(test_ai_connection))
        .routes(routes!(generate_ai_content))
        .routes(routes!(list_ai_models))
}

#[cfg(test)]
mod tests {
    use super::validate_vision_image_url;
    use crate::errors::codes;

    #[tokio::test]
    async fn blocks_cloud_metadata_endpoint() {
        let err = validate_vision_image_url("http://169.254.169.254/latest/meta-data/")
            .await
            .expect_err("link-local metadata endpoint must be rejected");
        assert_eq!(err.code(), codes::AI_URL_SSRF);
    }

    #[tokio::test]
    async fn blocks_localhost() {
        let err = validate_vision_image_url("http://localhost:8000/internal")
            .await
            .expect_err("localhost must be rejected");
        assert_eq!(err.code(), codes::AI_URL_SSRF);
    }

    #[tokio::test]
    async fn blocks_private_range() {
        let err = validate_vision_image_url("http://192.168.1.1/secret.png")
            .await
            .expect_err("RFC1918 address must be rejected");
        assert_eq!(err.code(), codes::AI_URL_SSRF);
    }

    #[tokio::test]
    async fn allows_inlined_data_url_without_fetch() {
        // Internal media is converted to a base64 data: URL before this guard;
        // it carries its own bytes, so no SSRF fetch is possible — exempt it.
        let result =
            validate_vision_image_url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB")
                .await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn allows_public_https_image_url() {
        // Does real DNS resolution — mirrors url_validation's public-URL test.
        let result = validate_vision_image_url("https://example.com/photo.png").await;
        assert!(result.is_ok());
    }
}
