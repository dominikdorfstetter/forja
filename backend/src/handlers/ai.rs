//! AI content assist handlers

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{delete, get, post, put, routes, Route, State};
use uuid::Uuid;
use validator::Validate;

use crate::dto::ai::*;
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::guards::module_guard::{AiModule, ModuleGuard};
use crate::models::ai_config::SiteAiConfig;
use crate::models::audit::AuditAction;
use crate::models::site_membership::SiteRole;
use crate::services::{ai_service, audit_service, encryption};
use crate::AppState;

/// Get AI configuration for a site
#[utoipa::path(
    tag = "AI",
    operation_id = "get_ai_config",
    description = "Get AI configuration for a site (API key is masked)",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "AI configuration", body = AiConfigResponse),
        (status = 404, description = "No AI configuration found", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
    ),
    security(("bearer_auth" = []), ("api_key" = []))
)]
#[get("/sites/<site_id>/ai/config")]
pub async fn get_ai_config(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
) -> Result<Json<AiConfigResponse>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Admin)
        .await?;

    let config = SiteAiConfig::find_by_site_id(&state.db, site_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("No AI configuration found for this site".into()))?;

    let key = encryption::resolve_key(&state.settings.security.ai_encryption_key)?;
    let api_key_plain =
        encryption::decrypt(&config.api_key_encrypted, &config.api_key_nonce, &key)?;

    Ok(Json(AiConfigResponse {
        id: config.id,
        site_id: config.site_id,
        provider_name: config.provider_name,
        base_url: config.base_url,
        api_key_masked: encryption::mask_api_key(&api_key_plain),
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        system_prompts: config.system_prompts,
        updated_at: config.updated_at.to_rfc3339(),
    }))
}

/// Create or update AI configuration
#[utoipa::path(
    tag = "AI",
    operation_id = "upsert_ai_config",
    description = "Create or update AI configuration for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body = CreateAiConfigRequest,
    responses(
        (status = 200, description = "AI configuration saved", body = AiConfigResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
    ),
    security(("bearer_auth" = []), ("api_key" = []))
)]
#[put("/sites/<site_id>/ai/config", data = "<req>")]
pub async fn upsert_ai_config(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
    req: Json<CreateAiConfigRequest>,
) -> Result<Json<AiConfigResponse>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Admin)
        .await?;

    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {e}")))?;

    let api_key_plain = req.api_key.as_deref().unwrap_or("");
    let key = encryption::resolve_key(&state.settings.security.ai_encryption_key)?;
    let (encrypted, nonce) = encryption::encrypt(api_key_plain, &key)?;

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
    )
    .await?;

    let api_key_masked = encryption::mask_api_key(api_key_plain);

    audit_service::log_action(
        &state.db,
        Some(site_id),
        Some(auth.0.id),
        AuditAction::Update,
        "ai_config",
        config.id,
        None,
    )
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
        updated_at: config.updated_at.to_rfc3339(),
    }))
}

/// Delete AI configuration
#[utoipa::path(
    tag = "AI",
    operation_id = "delete_ai_config",
    description = "Remove AI configuration for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 204, description = "AI configuration removed"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
    ),
    security(("bearer_auth" = []), ("api_key" = []))
)]
#[delete("/sites/<site_id>/ai/config")]
pub async fn delete_ai_config(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
) -> Result<Status, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Admin)
        .await?;

    SiteAiConfig::delete_by_site_id(&state.db, site_id).await?;

    Ok(Status::NoContent)
}

/// Test AI provider connection
#[utoipa::path(
    tag = "AI",
    operation_id = "test_ai_connection",
    description = "Test the AI provider connection by sending a small prompt",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Connection test result", body = AiTestResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
    ),
    security(("bearer_auth" = []), ("api_key" = []))
)]
#[post("/sites/<site_id>/ai/test")]
pub async fn test_ai_connection(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
) -> Result<Json<AiTestResponse>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Admin)
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

/// Generate AI content
#[utoipa::path(
    tag = "AI",
    operation_id = "generate_ai_content",
    description = "Generate AI-assisted content (SEO, excerpt, or translation)",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body = AiGenerateRequest,
    responses(
        (status = 200, description = "Generated content", body = AiGenerateResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 429, description = "Rate limited", body = ProblemDetails),
    ),
    security(("bearer_auth" = []), ("api_key" = []))
)]
#[post("/sites/<site_id>/ai/generate", data = "<req>")]
pub async fn generate_ai_content(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
    req: Json<AiGenerateRequest>,
    _module: ModuleGuard<AiModule>,
) -> Result<Json<AiGenerateResponse>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Author)
        .await?;

    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {e}")))?;

    if matches!(req.action, AiAction::Translate) && req.target_locale.is_none() {
        return Err(ApiError::BadRequest(
            "target_locale is required for translate action".into(),
        ));
    }

    let result = ai_service::generate(
        &state.db,
        site_id,
        &state.settings.security.ai_encryption_key,
        &req,
    )
    .await?;

    audit_service::log_action(
        &state.db,
        Some(site_id),
        Some(auth.0.id),
        AuditAction::Create,
        "ai_generation",
        uuid::Uuid::new_v4(),
        Some(serde_json::json!({
            "action": format!("{:?}", req.action),
        })),
    )
    .await;

    Ok(Json(result))
}

/// List available models from a provider
#[utoipa::path(
    tag = "AI",
    operation_id = "list_ai_models",
    description = "List available models from an AI provider (for auto-discovery)",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body = ListModelsRequest,
    responses(
        (status = 200, description = "Available models", body = ListModelsResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
    ),
    security(("bearer_auth" = []), ("api_key" = []))
)]
#[post("/sites/<site_id>/ai/models", data = "<req>")]
pub async fn list_ai_models(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
    req: Json<ListModelsRequest>,
) -> Result<Json<ListModelsResponse>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Admin)
        .await?;

    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {e}")))?;

    let models =
        ai_service::list_models(&req.base_url, req.api_key.as_deref(), &req.provider_name).await?;

    Ok(Json(ListModelsResponse { models }))
}

pub fn routes() -> Vec<Route> {
    routes![
        get_ai_config,
        upsert_ai_config,
        delete_ai_config,
        test_ai_connection,
        generate_ai_content,
        list_ai_models
    ]
}
