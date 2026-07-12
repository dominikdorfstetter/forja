//! Forms module HTTP handlers (#581).
//!
//! 11 endpoints behind `ModuleGuard<FormsModule>`: form list/create/get/
//! update/delete, get-by-slug, template list/create/get/update/delete.
//! Permission gating via `permission_service` on `form` and `form_template`
//! resources; audit log entries written for every mutation.
//!
//! Auth note: admin write endpoints use `ReadKey` (any authenticated
//! identity) and rely on `PermissionService::require` for role-based
//! authorization. `WriteKey` is an API-key-tier gate that always rejects
//! Clerk JWT users — using it here would block site Owners on the admin
//! SPA, since their Clerk JWT carries `ApiKeyPermission::Read` regardless
//! of their site role. The role-based check (e.g. `form:create`) is the
//! correct gate and is enforced inside each handler.

use crate::AppState;
use crate::axum_app::extractors::{ClientIp, CurrentSite};
use crate::dto::forms::{
    AltchaChallengeResponse, BotProtectionMode, CreateFormRequest, CreateFormTemplateRequest,
    CreateSubmissionNoteRequest, FormDetailResponse, FormSubmissionStatus, FormTemplateResponse,
    LookupSubmissionRequest, PaginatedFormTemplates, PaginatedForms, PaginatedSubmissions,
    PublicFormFieldResponse, PublicFormResponse, SelfServiceLookupResponse,
    SelfServiceSubmissionResponse, SiteBotProtectionResponse, SubmissionDetailResponse,
    SubmissionNoteResponse, SubmissionStatusCounts, SubmitFormRequest, SubmitFormResponse,
    UpdateFormRequest, UpdateFormTemplateRequest, UpdateSubmissionStatusRequest,
    UpsertSiteBotProtectionRequest,
};
use crate::dto::validated::ValidatedJson;
use crate::errors::{ApiError, ProblemDetails, codes};
use crate::guards::auth_guard::ReadKey;
use crate::guards::module_guard::{FormsModule, ModuleGuard};
use crate::models::audit::AuditAction;
use crate::models::forms::{Form, FormTemplate};
use crate::models::site_bot_protection::{ConsumedChallenge, SiteBotProtection, UpsertParams};
use crate::repos::form_submission_repo;
use crate::services::audited_mutation::AuditedEntity;
use crate::services::permission_service::{Permission, PermissionService};
use crate::services::{altcha_service, bot_protection_service, encryption};
use crate::utils::list_params::ListParams;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::Json;
use chrono::{Duration, Utc};
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
struct ListQuery {
    page: Option<i64>,
    page_size: Option<i64>,
    search: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
}

// ── Form endpoints ──────────────────────────────────────────────────────

#[utoipa::path(
    get,
    path = "/sites/{site_id}/forms",
    tag = "Forms",
    operation_id = "list_forms",
    description = "List forms for a site (paginated)",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page (default 1)"),
        ("page_size" = Option<i64>, Query, description = "Page size (default 10)")
    ),
    responses(
        (status = 200, body = PaginatedForms),
        (status = 403, body = ProblemDetails),
    ),
    security(("api_key" = []))
)]
async fn list_forms(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<ListQuery>,
    auth: ReadKey,
    _module: ModuleGuard<FormsModule>,
) -> Result<Json<PaginatedForms>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("form", "read"),
    )
    .await?;
    let params = ListParams::new(q.page, q.page_size, q.search, q.sort_by, q.sort_dir);
    let (items, total) = Form::list_for_site(&state.db, site_id, &params).await?;
    Ok(Json(params.paginate(items, total)))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/forms",
    tag = "Forms",
    operation_id = "create_form",
    description = "Create a new form (optionally from a template)",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = CreateFormRequest, description = "Form definition"),
    responses(
        (status = 201, body = FormDetailResponse),
        (status = 400, body = ProblemDetails),
        (status = 403, body = ProblemDetails),
        (status = 409, body = ProblemDetails),
    ),
    security(("api_key" = []))
)]
async fn create_form(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
    _module: ModuleGuard<FormsModule>,
    ValidatedJson(body): ValidatedJson<CreateFormRequest>,
) -> Result<(StatusCode, Json<FormDetailResponse>), ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("form", "create"),
    )
    .await?;

    let form = Form::create(&state.db, site_id, body.into_inner()).await?;
    AuditedEntity::audit_only("form")
        .mutate(AuditAction::Create, form.id)
        .site(site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;
    Ok((StatusCode::CREATED, Json(form)))
}

#[utoipa::path(
    get,
    path = "/forms/{id}",
    tag = "Forms",
    operation_id = "get_form",
    description = "Get a form with its fields",
    params(("id" = Uuid, Path, description = "Form UUID")),
    responses(
        (status = 200, body = FormDetailResponse),
        (status = 404, body = ProblemDetails),
    ),
    security(("api_key" = []))
)]
async fn get_form(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<FormDetailResponse>, ApiError> {
    let form = Form::find_by_id(&state.db, id).await?;
    ModuleGuard::<FormsModule>::check(&state.db, form.site_id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        form.site_id,
        &Permission::new("form", "read"),
    )
    .await?;
    Ok(Json(form))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/forms/by-slug/{slug}",
    tag = "Forms",
    operation_id = "get_form_by_slug",
    description = "Look up a form by slug within a site",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("slug" = String, Path, description = "Form slug")
    ),
    responses(
        (status = 200, body = FormDetailResponse),
        (status = 404, body = ProblemDetails),
    ),
    security(("api_key" = []))
)]
async fn get_form_by_slug(
    State(state): State<AppState>,
    Path((site_id, slug)): Path<(Uuid, String)>,
    auth: ReadKey,
    _module: ModuleGuard<FormsModule>,
) -> Result<Json<FormDetailResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("form", "read"),
    )
    .await?;
    let form = Form::find_by_slug(&state.db, site_id, &slug).await?;
    Ok(Json(form))
}

#[utoipa::path(
    put,
    path = "/forms/{id}",
    tag = "Forms",
    operation_id = "update_form",
    description = "Update a form (optionally replacing the field set)",
    params(("id" = Uuid, Path, description = "Form UUID")),
    request_body(content = UpdateFormRequest, description = "Partial form update"),
    responses(
        (status = 200, body = FormDetailResponse),
        (status = 400, body = ProblemDetails),
        (status = 403, body = ProblemDetails),
        (status = 404, body = ProblemDetails),
        (status = 409, body = ProblemDetails),
    ),
    security(("api_key" = []))
)]
async fn update_form(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
    ValidatedJson(body): ValidatedJson<UpdateFormRequest>,
) -> Result<Json<FormDetailResponse>, ApiError> {
    let existing = Form::find_by_id(&state.db, id).await?;
    ModuleGuard::<FormsModule>::check(&state.db, existing.site_id).await?;
    // Use "update", "any" because the handler doesn't distinguish ownership;
    // ownership-scoped enforcement lives on submissions, not forms themselves.
    PermissionService::require(
        &state.db,
        &auth.0,
        existing.site_id,
        &Permission::new("form", "update"),
    )
    .await?;

    let form = Form::update(&state.db, id, body.into_inner()).await?;
    AuditedEntity::audit_only("form")
        .mutate(AuditAction::Update, id)
        .site(existing.site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;
    Ok(Json(form))
}

#[utoipa::path(
    delete,
    path = "/forms/{id}",
    tag = "Forms",
    operation_id = "delete_form",
    description = "Soft-delete a form",
    params(("id" = Uuid, Path, description = "Form UUID")),
    responses(
        (status = 204),
        (status = 404, body = ProblemDetails),
    ),
    security(("api_key" = []))
)]
async fn delete_form(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
) -> Result<StatusCode, ApiError> {
    let existing = Form::find_by_id(&state.db, id).await?;
    ModuleGuard::<FormsModule>::check(&state.db, existing.site_id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        existing.site_id,
        &Permission::new("form", "delete"),
    )
    .await?;

    Form::delete(&state.db, id).await?;
    AuditedEntity::audit_only("form")
        .mutate(AuditAction::Delete, id)
        .site(existing.site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;
    Ok(StatusCode::NO_CONTENT)
}

// ── Template endpoints ──────────────────────────────────────────────────

#[utoipa::path(
    get,
    path = "/sites/{site_id}/form-templates",
    tag = "Forms",
    operation_id = "list_form_templates",
    description = "List form templates for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, body = PaginatedFormTemplates),
        (status = 403, body = ProblemDetails),
    ),
    security(("api_key" = []))
)]
async fn list_form_templates(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<ListQuery>,
    auth: ReadKey,
    _module: ModuleGuard<FormsModule>,
) -> Result<Json<PaginatedFormTemplates>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("form_template", "read"),
    )
    .await?;
    let params = ListParams::new(q.page, q.page_size, q.search, q.sort_by, q.sort_dir);
    let (items, total) = FormTemplate::list_for_site(&state.db, site_id, &params).await?;
    Ok(Json(params.paginate(items, total)))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/form-templates",
    tag = "Forms",
    operation_id = "create_form_template",
    description = "Create a form template (copy-on-create preset)",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = CreateFormTemplateRequest, description = "Template definition"),
    responses(
        (status = 201, body = FormTemplateResponse),
        (status = 400, body = ProblemDetails),
        (status = 403, body = ProblemDetails),
        (status = 409, body = ProblemDetails),
    ),
    security(("api_key" = []))
)]
async fn create_form_template(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
    _module: ModuleGuard<FormsModule>,
    ValidatedJson(body): ValidatedJson<CreateFormTemplateRequest>,
) -> Result<(StatusCode, Json<FormTemplateResponse>), ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("form_template", "create"),
    )
    .await?;

    let tmpl = FormTemplate::create(&state.db, site_id, body.into_inner()).await?;
    AuditedEntity::audit_only("form_template")
        .mutate(AuditAction::Create, tmpl.id)
        .site(site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;
    Ok((StatusCode::CREATED, Json(tmpl)))
}

#[utoipa::path(
    get,
    path = "/form-templates/{id}",
    tag = "Forms",
    operation_id = "get_form_template",
    params(("id" = Uuid, Path, description = "Template UUID")),
    responses(
        (status = 200, body = FormTemplateResponse),
        (status = 404, body = ProblemDetails),
    ),
    security(("api_key" = []))
)]
async fn get_form_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<FormTemplateResponse>, ApiError> {
    let tmpl = FormTemplate::find_by_id(&state.db, id).await?;
    ModuleGuard::<FormsModule>::check(&state.db, tmpl.site_id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        tmpl.site_id,
        &Permission::new("form_template", "read"),
    )
    .await?;
    Ok(Json(tmpl))
}

#[utoipa::path(
    put,
    path = "/form-templates/{id}",
    tag = "Forms",
    operation_id = "update_form_template",
    params(("id" = Uuid, Path, description = "Template UUID")),
    request_body(content = UpdateFormTemplateRequest, description = "Partial update"),
    responses(
        (status = 200, body = FormTemplateResponse),
        (status = 400, body = ProblemDetails),
        (status = 403, body = ProblemDetails),
        (status = 404, body = ProblemDetails),
        (status = 409, body = ProblemDetails),
    ),
    security(("api_key" = []))
)]
async fn update_form_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
    ValidatedJson(body): ValidatedJson<UpdateFormTemplateRequest>,
) -> Result<Json<FormTemplateResponse>, ApiError> {
    let existing = FormTemplate::find_by_id(&state.db, id).await?;
    ModuleGuard::<FormsModule>::check(&state.db, existing.site_id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        existing.site_id,
        &Permission::new("form_template", "update"),
    )
    .await?;

    let tmpl = FormTemplate::update(&state.db, id, body.into_inner()).await?;
    AuditedEntity::audit_only("form_template")
        .mutate(AuditAction::Update, id)
        .site(existing.site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;
    Ok(Json(tmpl))
}

#[utoipa::path(
    delete,
    path = "/form-templates/{id}",
    tag = "Forms",
    operation_id = "delete_form_template",
    params(("id" = Uuid, Path, description = "Template UUID")),
    responses(
        (status = 204),
        (status = 404, body = ProblemDetails),
    ),
    security(("api_key" = []))
)]
async fn delete_form_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
) -> Result<StatusCode, ApiError> {
    let existing = FormTemplate::find_by_id(&state.db, id).await?;
    ModuleGuard::<FormsModule>::check(&state.db, existing.site_id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        existing.site_id,
        &Permission::new("form_template", "delete"),
    )
    .await?;

    FormTemplate::delete(&state.db, id).await?;
    AuditedEntity::audit_only("form_template")
        .mutate(AuditAction::Delete, id)
        .site(existing.site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;
    Ok(StatusCode::NO_CONTENT)
}

// ── Public submission endpoints (#582) ──────────────────────────────────

#[derive(Debug, Deserialize)]
struct PublicFormQuery {
    /// Locale code (e.g. `de`) or UUID. When set and a matching localization
    /// row exists, localized text overrides the canonical values.
    locale: Option<String>,
}

#[utoipa::path(
    get,
    path = "/public/forms/{slug}",
    tag = "Forms (public)",
    operation_id = "public_get_form",
    description = "Fetch a form definition for rendering. Site resolved \
                   from the X-Site-Domain header. No authentication. \
                   Inactive forms return 404 to avoid leaking their existence. \
                   When `?locale=` is set (code or UUID), localized text \
                   overrides canonical values where translations exist; \
                   unknown locales fall through to the default.",
    params(
        ("slug" = String, Path, description = "Form slug"),
        ("locale" = Option<String>, Query, description = "Locale code or UUID"),
    ),
    responses(
        (status = 200, body = PublicFormResponse),
        (status = 404, body = ProblemDetails),
        (status = 429, body = ProblemDetails),
    ),
)]
async fn public_get_form(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    Query(q): Query<PublicFormQuery>,
    site: CurrentSite,
) -> Result<Json<PublicFormResponse>, ApiError> {
    let site_id = site.0.id;
    ModuleGuard::<FormsModule>::check(&state.db, site_id).await?;
    let form = Form::find_by_slug(&state.db, site_id, &slug).await?;
    if !form.is_active {
        // Don't distinguish inactive vs missing — same 404 surface.
        return Err(ApiError::not_found("Form not found")
            .with_code(crate::errors::codes::ENTITY_NOT_FOUND)
            .with_entity_type("form"));
    }

    let locale_id = match q.locale.as_deref() {
        Some(s) => resolve_locale_id(&state.db, s).await?,
        None => None,
    };

    let form_loc = locale_id.and_then(|lid| {
        form.localizations
            .iter()
            .find(|l| l.locale_id == lid)
            .cloned()
    });

    let fields = form
        .fields
        .into_iter()
        .map(|f| {
            let field_loc = locale_id
                .and_then(|lid| f.localizations.iter().find(|l| l.locale_id == lid).cloned());
            PublicFormFieldResponse {
                id: f.id,
                label: f.label.clone(),
                display_label: field_loc
                    .as_ref()
                    .and_then(|l| l.display_label.clone())
                    .unwrap_or(f.label),
                field_type: f.field_type,
                placeholder: field_loc
                    .as_ref()
                    .and_then(|l| l.placeholder.clone())
                    .or(f.placeholder),
                help_text: field_loc
                    .as_ref()
                    .and_then(|l| l.help_text.clone())
                    .or(f.help_text),
                validation: f.validation,
                options: f.options,
                is_required: f.is_required,
                display_order: f.display_order,
            }
        })
        .collect();

    Ok(Json(PublicFormResponse {
        id: form.id,
        site_id: form.site_id,
        name: form_loc
            .as_ref()
            .and_then(|l| l.name.clone())
            .unwrap_or(form.name),
        slug: form.slug,
        description: form_loc
            .as_ref()
            .and_then(|l| l.description.clone())
            .or(form.description),
        consent_required: form.consent_required,
        consent_text: form_loc.and_then(|l| l.consent_text).or(form.consent_text),
        bot_protection: form.bot_protection,
        fields,
    }))
}

/// Resolve a locale identifier — accepts either a UUID or a code like "de".
/// Returns Ok(None) when the locale is unknown (silent fallback to default).
async fn resolve_locale_id(
    pool: &sqlx::PgPool,
    identifier: &str,
) -> Result<Option<Uuid>, ApiError> {
    crate::models::locale::Locale::find_id_by_id_or_code(pool, identifier).await
}

#[utoipa::path(
    post,
    path = "/public/forms/{slug}/submit",
    tag = "Forms (public)",
    operation_id = "public_submit_form",
    description = "Submit a form. Returns the reference code visitors use \
                   for self-service lookup / delete. IP-rate-limited.",
    params(("slug" = String, Path, description = "Form slug")),
    request_body(content = SubmitFormRequest, description = "Submission payload"),
    responses(
        (status = 201, body = SubmitFormResponse),
        (status = 400, body = ProblemDetails, description = "Validation, consent, or bot-protection failure"),
        (status = 404, body = ProblemDetails),
        (status = 429, body = ProblemDetails),
    ),
)]
async fn public_submit_form(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    site: CurrentSite,
    ClientIp(client_ip): ClientIp,
    crate::dto::validated::ValidatedJson(body): crate::dto::validated::ValidatedJson<
        SubmitFormRequest,
    >,
) -> Result<(StatusCode, Json<SubmitFormResponse>), ApiError> {
    let site_id = site.0.id;
    ModuleGuard::<FormsModule>::check(&state.db, site_id).await?;
    let form = Form::find_by_slug(&state.db, site_id, &slug).await?;

    // Forja is headless — it doesn't know which vendor the site uses, so the
    // verifier proxies the token to whatever provider URL the site admin
    // configured. Fails closed on missing config / provider outage so a
    // verifier disruption can't turn into a bypass.
    let bot_check = SiteBotProtectionCheck {
        state: &state,
        site_id,
        client_ip: &client_ip,
    };
    let (submission_id, reference_code) = crate::services::form_submission_service::submit(
        &state.db,
        &form,
        body.into_inner(),
        &bot_check,
    )
    .await?;
    Ok((
        StatusCode::CREATED,
        Json(SubmitFormResponse {
            submission_id,
            reference_code,
        }),
    ))
}

/// Production `BotProtectionCheck` adapter: resolves the site's config and
/// dispatches by mode. `Altcha` verifies the proof-of-work locally (no
/// outbound call) and enforces single use; `Remote` proxies the token to the
/// vendor verifier (#608). Every error branch maps to a Forms-domain
/// `codes::FORM_BOT_PROTECTION_*` so the vocabulary stays inside this module.
///
/// `verify` is only invoked for `Mandatory` forms (the gate lives in
/// `form_submission_service::submit`), so loading the config here never
/// penalizes unprotected forms.
struct SiteBotProtectionCheck<'a> {
    state: &'a AppState,
    site_id: Uuid,
    client_ip: &'a str,
}

impl SiteBotProtectionCheck<'_> {
    /// Self-hosted ALTCHA: verify the PoW signature + expiry against the
    /// site's HMAC key in-process, then record the challenge salt so the same
    /// solved payload can't be replayed within its validity window (#768b).
    async fn verify_altcha(
        &self,
        config: &SiteBotProtection,
        token: &str,
        hmac_key: &str,
    ) -> Result<(), ApiError> {
        let salt = altcha_service::verify(token, hmac_key)?;
        let expires_at = Utc::now() + Duration::seconds(config.effective_expiry_seconds() as i64);
        let first_use =
            ConsumedChallenge::try_consume(&self.state.db, self.site_id, &salt, expires_at).await?;
        if !first_use {
            return Err(
                ApiError::bad_request("Bot protection payload has already been used")
                    .with_code(codes::FORM_BOT_PROTECTION_INVALID),
            );
        }
        Ok(())
    }

    /// Remote vendor verifier (#608): proxy the token to the configured
    /// siteverify URL.
    async fn verify_remote(
        &self,
        config: &SiteBotProtection,
        token: &str,
        secret: &str,
    ) -> Result<(), ApiError> {
        let verify_url = config.verify_url.as_deref().ok_or_else(|| {
            ApiError::service_unavailable(
                "This form requires bot protection but the remote verifier has no URL configured",
            )
            .with_code(codes::FORM_BOT_PROTECTION_NOT_CONFIGURED)
        })?;
        let ip_hint = if self.client_ip.is_empty() || self.client_ip == "unknown" {
            None
        } else {
            Some(self.client_ip)
        };
        bot_protection_service::verify(verify_url, secret, token, ip_hint).await
    }
}

#[async_trait::async_trait]
impl crate::services::form_submission_service::BotProtectionCheck for SiteBotProtectionCheck<'_> {
    async fn verify(&self, req: &SubmitFormRequest) -> Result<(), ApiError> {
        let token = req
            .bot_protection_token
            .as_deref()
            .filter(|s| !s.is_empty())
            .ok_or_else(|| {
                ApiError::bad_request("Bot protection token required for this form")
                    .with_code(codes::FORM_BOT_PROTECTION_MISSING)
            })?;

        let config = SiteBotProtection::find_for_site(&self.state.db, self.site_id)
            .await?
            .ok_or_else(|| {
                ApiError::service_unavailable(
                    "This form requires bot protection but the site has not configured a verifier",
                )
                .with_code(codes::FORM_BOT_PROTECTION_NOT_CONFIGURED)
            })?;

        let key = encryption::resolve_key(&self.state.settings.security.document_encryption_key)?;
        let secret = config.decrypt_secret(&key)?;

        match config.mode {
            BotProtectionMode::Altcha => self.verify_altcha(&config, token, &secret).await,
            BotProtectionMode::Remote => self.verify_remote(&config, token, &secret).await,
        }
    }
}

#[utoipa::path(
    get,
    path = "/public/forms/{slug}/altcha-challenge",
    tag = "Forms (public)",
    operation_id = "public_altcha_challenge",
    description = "Issue a fresh, single-use, HMAC-signed ALTCHA challenge for \
                   a form whose site uses self-hosted ALTCHA bot protection. \
                   The widget solves it and submits the solution as \
                   `bot_protection_token`. Returns 409 when the site is not in \
                   ALTCHA mode.",
    params(("slug" = String, Path, description = "Form slug")),
    responses(
        (status = 200, body = AltchaChallengeResponse),
        (status = 404, body = ProblemDetails),
        (status = 409, body = ProblemDetails, description = "Site is not configured for self-hosted ALTCHA"),
        (status = 429, body = ProblemDetails),
    ),
)]
async fn public_altcha_challenge(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    site: CurrentSite,
) -> Result<Json<AltchaChallengeResponse>, ApiError> {
    let site_id = site.0.id;
    ModuleGuard::<FormsModule>::check(&state.db, site_id).await?;

    // The form must exist (and be active) for the site — same 404 surface as
    // the public form-fetch endpoint, so we don't leak form existence.
    let form = Form::find_by_slug(&state.db, site_id, &slug).await?;
    if !form.is_active {
        return Err(ApiError::not_found("Form not found")
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type("form"));
    }

    let config = SiteBotProtection::find_for_site(&state.db, site_id)
        .await?
        .filter(|c| matches!(c.mode, BotProtectionMode::Altcha))
        .ok_or_else(|| {
            ApiError::conflict("This form's site is not configured for self-hosted ALTCHA")
                .with_code(codes::FORM_BOT_PROTECTION_NOT_CONFIGURED)
        })?;

    let key = encryption::resolve_key(&state.settings.security.document_encryption_key)?;
    let hmac_key = config.decrypt_secret(&key)?;

    let challenge_json = altcha_service::create_challenge_json(
        &hmac_key,
        config.effective_max_number(),
        config.effective_expiry_seconds(),
    )?;
    let challenge: AltchaChallengeResponse =
        serde_json::from_str(&challenge_json).map_err(|e| {
            ApiError::internal(format!("ALTCHA challenge serialization failed: {e}"))
                .with_code(codes::INTERNAL_ERROR)
        })?;
    Ok(Json(challenge))
}

// ── Site bot-protection admin endpoints (#608) ──────────────────────────

#[utoipa::path(
    get,
    path = "/sites/{site_id}/bot-protection",
    tag = "Forms",
    operation_id = "get_site_bot_protection",
    description = "Get the site's captcha verifier config (without the secret). \
                   Returns 404 when the site has not configured one yet.",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, body = SiteBotProtectionResponse),
        (status = 403, body = ProblemDetails),
        (status = 404, body = ProblemDetails),
    ),
    security(("api_key" = []))
)]
async fn get_site_bot_protection(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
    _module: ModuleGuard<FormsModule>,
) -> Result<Json<SiteBotProtectionResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("form", "read"),
    )
    .await?;
    let row = SiteBotProtection::find_for_site(&state.db, site_id)
        .await?
        .ok_or_else(|| {
            ApiError::not_found("No bot protection configured for this site")
                .with_code(codes::FORM_BOT_PROTECTION_NOT_CONFIGURED)
        })?;
    Ok(Json(bot_protection_response(row)))
}

/// Build the admin response from a stored row. Never includes the secret /
/// HMAC key — only the mode, label, and mode-specific public params.
fn bot_protection_response(row: SiteBotProtection) -> SiteBotProtectionResponse {
    SiteBotProtectionResponse {
        site_id: row.site_id,
        mode: row.mode,
        provider_label: row.provider_label,
        verify_url: row.verify_url,
        altcha_max_number: row.altcha_max_number,
        altcha_expiry_seconds: row.altcha_expiry_seconds,
        configured: true,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

#[utoipa::path(
    put,
    path = "/sites/{site_id}/bot-protection",
    tag = "Forms",
    operation_id = "upsert_site_bot_protection",
    description = "Insert or replace the site's captcha verifier config. \
                   The verify URL is validated against the SSRF guard on \
                   every submission, not at write time, so a misconfigured \
                   URL fails at submit rather than at save.",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = UpsertSiteBotProtectionRequest),
    responses(
        (status = 200, body = SiteBotProtectionResponse),
        (status = 400, body = ProblemDetails),
        (status = 403, body = ProblemDetails),
    ),
    security(("api_key" = []))
)]
async fn upsert_site_bot_protection(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
    _module: ModuleGuard<FormsModule>,
    crate::dto::validated::ValidatedJson(body): crate::dto::validated::ValidatedJson<
        UpsertSiteBotProtectionRequest,
    >,
) -> Result<Json<SiteBotProtectionResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("form", "update"),
    )
    .await?;
    let body = body.into_inner();

    let key = encryption::resolve_key(&state.settings.security.document_encryption_key)?;
    let existing = SiteBotProtection::find_for_site(&state.db, site_id).await?;

    // Resolve the secret to store. In ALTCHA mode the "secret" is the HMAC key;
    // an admin-supplied value always wins, then an explicit rotate, then the
    // existing key is preserved (so incidental saves don't invalidate live
    // challenges), and only a fresh enable auto-generates one.
    let secret_plaintext = match (body.mode, body.secret.as_deref()) {
        (_, Some(s)) if !s.is_empty() => s.to_string(),
        (BotProtectionMode::Altcha, _) => {
            let regenerate = body.regenerate_key.unwrap_or(false);
            match existing.as_ref() {
                Some(row) if row.mode == BotProtectionMode::Altcha && !regenerate => {
                    row.decrypt_secret(&key)?
                }
                _ => altcha_service::generate_hmac_key(),
            }
        }
        // Remote-without-secret is rejected by `validate_for_mode`; this arm is
        // unreachable in practice but keeps the match total.
        (BotProtectionMode::Remote, _) => altcha_service::generate_hmac_key(),
    };

    let default_label = match body.mode {
        BotProtectionMode::Altcha => "ALTCHA (self-hosted)",
        BotProtectionMode::Remote => "Custom captcha vendor",
    };
    let provider_label = body
        .provider_label
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or(default_label);

    let row = SiteBotProtection::upsert(
        &state.db,
        site_id,
        UpsertParams {
            mode: body.mode,
            provider_label,
            // Only persist the verify URL in remote mode; ALTCHA leaves it null.
            verify_url: match body.mode {
                BotProtectionMode::Remote => body.verify_url.as_deref(),
                BotProtectionMode::Altcha => None,
            },
            secret_plaintext: &secret_plaintext,
            altcha_max_number: body.altcha_max_number,
            altcha_expiry_seconds: body.altcha_expiry_seconds,
        },
        &key,
    )
    .await?;
    AuditedEntity::audit_only("site_bot_protection")
        .mutate(AuditAction::Update, row.id)
        .site(site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;
    Ok(Json(bot_protection_response(row)))
}

#[utoipa::path(
    delete,
    path = "/sites/{site_id}/bot-protection",
    tag = "Forms",
    operation_id = "delete_site_bot_protection",
    description = "Remove the site's captcha verifier config. Idempotent.",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 204),
        (status = 403, body = ProblemDetails),
    ),
    security(("api_key" = []))
)]
async fn delete_site_bot_protection(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
    _module: ModuleGuard<FormsModule>,
) -> Result<StatusCode, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("form", "delete"),
    )
    .await?;
    SiteBotProtection::delete_for_site(&state.db, site_id).await?;
    AuditedEntity::audit_only("site_bot_protection")
        .mutate(AuditAction::Delete, site_id)
        .site(site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;
    Ok(StatusCode::NO_CONTENT)
}

// ── Self-service endpoints (#584) ───────────────────────────────────────

#[utoipa::path(
    post,
    path = "/public/submissions/lookup",
    tag = "Forms (public)",
    operation_id = "public_lookup_submission",
    description = "Confirm a reference code exists within the calling site. \
                   Returns only status + submitted-at — never field data — \
                   for confirmation surfaces that shouldn't disclose visitor \
                   input. Site is resolved from the X-Site-Domain header; \
                   cross-tenant probes return 404.",
    request_body(content = LookupSubmissionRequest, description = "Reference code lookup"),
    responses(
        (status = 200, body = SelfServiceLookupResponse),
        (status = 404, body = ProblemDetails),
        (status = 410, body = ProblemDetails),
        (status = 429, body = ProblemDetails),
    ),
)]
async fn public_lookup_submission(
    State(state): State<AppState>,
    site: CurrentSite,
    Json(body): Json<LookupSubmissionRequest>,
) -> Result<Json<SelfServiceLookupResponse>, ApiError> {
    let (status, created_at) =
        form_submission_repo::lookup_by_reference_code(&state.db, &body.reference_code, site.0.id)
            .await?;
    Ok(Json(SelfServiceLookupResponse { status, created_at }))
}

#[utoipa::path(
    get,
    path = "/public/submissions/{reference_code}",
    tag = "Forms (public)",
    operation_id = "public_get_submission",
    description = "Visitor's full view of their own submission. Site is \
                   resolved from the X-Site-Domain header; reference codes \
                   are tenant-scoped, so a code from one site cannot be \
                   read from another.",
    params(("reference_code" = String, Path, description = "Reference code")),
    responses(
        (status = 200, body = SelfServiceSubmissionResponse),
        (status = 404, body = ProblemDetails),
        (status = 410, body = ProblemDetails),
        (status = 429, body = ProblemDetails),
    ),
)]
async fn public_get_submission(
    State(state): State<AppState>,
    Path(reference_code): Path<String>,
    site: CurrentSite,
) -> Result<Json<SelfServiceSubmissionResponse>, ApiError> {
    let row =
        form_submission_repo::get_by_reference_code(&state.db, &reference_code, site.0.id).await?;
    Ok(Json(SelfServiceSubmissionResponse {
        reference_code: row.reference_code,
        status: row.status,
        data: row.data,
        consent_given: row.consent_given,
        consent_text_at_submission: row.consent_text_at_submission,
        created_at: row.created_at,
    }))
}

#[utoipa::path(
    delete,
    path = "/public/submissions/{reference_code}",
    tag = "Forms (public)",
    operation_id = "public_delete_submission",
    description = "Self-service delete: soft-deletes the submission. \
                   Returns 410 if it was already deleted (idempotent). \
                   Site is resolved from the X-Site-Domain header; \
                   cross-tenant codes return 404.",
    params(("reference_code" = String, Path, description = "Reference code")),
    responses(
        (status = 204),
        (status = 404, body = ProblemDetails),
        (status = 410, body = ProblemDetails),
        (status = 429, body = ProblemDetails),
    ),
)]
async fn public_delete_submission(
    State(state): State<AppState>,
    Path(reference_code): Path<String>,
    site: CurrentSite,
) -> Result<StatusCode, ApiError> {
    form_submission_repo::delete_by_reference_code(&state.db, &reference_code, site.0.id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Submission management endpoints (#583) ──────────────────────────────

#[derive(Debug, Deserialize)]
struct ListSubmissionsQuery {
    page: Option<i64>,
    page_size: Option<i64>,
    status: Option<FormSubmissionStatus>,
}

#[utoipa::path(
    get,
    path = "/forms/{form_id}/submissions",
    tag = "Form Submissions",
    operation_id = "list_submissions",
    description = "List submissions for a form (paginated, filterable by status)",
    params(
        ("form_id" = Uuid, Path, description = "Form UUID"),
        ("page" = Option<i64>, Query, description = "Page (default 1)"),
        ("page_size" = Option<i64>, Query, description = "Page size (default 10)"),
        ("status" = Option<String>, Query, description = "Filter by status: new, in_review, resolved, archived")
    ),
    responses(
        (status = 200, body = PaginatedSubmissions),
        (status = 403, body = ProblemDetails),
        (status = 404, body = ProblemDetails),
    ),
    security(("api_key" = []))
)]
async fn list_submissions(
    State(state): State<AppState>,
    Path(form_id): Path<Uuid>,
    Query(q): Query<ListSubmissionsQuery>,
    auth: ReadKey,
) -> Result<Json<PaginatedSubmissions>, ApiError> {
    let form = Form::find_by_id(&state.db, form_id).await?;
    ModuleGuard::<FormsModule>::check(&state.db, form.site_id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        form.site_id,
        &Permission::new("form_submission", "read"),
    )
    .await?;

    let params = ListParams::new(q.page, q.page_size, None, None, None);
    let (items, total) =
        form_submission_repo::list_for_form(&state.db, form_id, q.status, &params).await?;
    Ok(Json(params.paginate(items, total)))
}

#[utoipa::path(
    get,
    path = "/forms/{form_id}/submissions/status-counts",
    tag = "Form Submissions",
    operation_id = "submission_status_counts",
    description = "Counts of submissions by status for a form",
    params(("form_id" = Uuid, Path, description = "Form UUID")),
    responses(
        (status = 200, body = SubmissionStatusCounts),
        (status = 403, body = ProblemDetails),
        (status = 404, body = ProblemDetails),
    ),
    security(("api_key" = []))
)]
async fn submission_status_counts(
    State(state): State<AppState>,
    Path(form_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<SubmissionStatusCounts>, ApiError> {
    let form = Form::find_by_id(&state.db, form_id).await?;
    ModuleGuard::<FormsModule>::check(&state.db, form.site_id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        form.site_id,
        &Permission::new("form_submission", "read"),
    )
    .await?;
    Ok(Json(
        form_submission_repo::status_counts(&state.db, form_id).await?,
    ))
}

#[utoipa::path(
    get,
    path = "/submissions/{id}",
    tag = "Form Submissions",
    operation_id = "get_submission",
    description = "Get a single submission with its notes and status history",
    params(("id" = Uuid, Path, description = "Submission UUID")),
    responses(
        (status = 200, body = SubmissionDetailResponse),
        (status = 404, body = ProblemDetails),
    ),
    security(("api_key" = []))
)]
async fn get_submission(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<SubmissionDetailResponse>, ApiError> {
    let form_id = form_submission_repo::find_form_id_by_submission(&state.db, id).await?;
    let form = Form::find_by_id(&state.db, form_id).await?;
    ModuleGuard::<FormsModule>::check(&state.db, form.site_id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        form.site_id,
        &Permission::new("form_submission", "read"),
    )
    .await?;
    Ok(Json(form_submission_repo::get_detail(&state.db, id).await?))
}

#[utoipa::path(
    put,
    path = "/submissions/{id}/status",
    tag = "Form Submissions",
    operation_id = "update_submission_status",
    description = "Change a submission's status, with state-machine enforcement",
    params(("id" = Uuid, Path, description = "Submission UUID")),
    request_body(content = UpdateSubmissionStatusRequest, description = "Target status"),
    responses(
        (status = 200, body = SubmissionDetailResponse),
        (status = 400, body = ProblemDetails),
        (status = 404, body = ProblemDetails),
    ),
    security(("api_key" = []))
)]
async fn update_submission_status(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
    ValidatedJson(body): ValidatedJson<UpdateSubmissionStatusRequest>,
) -> Result<Json<SubmissionDetailResponse>, ApiError> {
    let form_id = form_submission_repo::find_form_id_by_submission(&state.db, id).await?;
    let form = Form::find_by_id(&state.db, form_id).await?;
    ModuleGuard::<FormsModule>::check(&state.db, form.site_id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        form.site_id,
        &Permission::new("form_submission", "update"),
    )
    .await?;
    let body = body.into_inner();
    let actor_clerk_id = clerk_id_from_auth(&auth.0);
    form_submission_repo::update_status(&state.db, id, body.status, actor_clerk_id.as_deref())
        .await?;
    Ok(Json(form_submission_repo::get_detail(&state.db, id).await?))
}

#[utoipa::path(
    delete,
    path = "/submissions/{id}",
    tag = "Form Submissions",
    operation_id = "delete_submission",
    description = "Soft-delete a submission",
    params(("id" = Uuid, Path, description = "Submission UUID")),
    responses(
        (status = 204),
        (status = 404, body = ProblemDetails),
    ),
    security(("api_key" = []))
)]
async fn delete_submission(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
) -> Result<StatusCode, ApiError> {
    let form_id = form_submission_repo::find_form_id_by_submission(&state.db, id).await?;
    let form = Form::find_by_id(&state.db, form_id).await?;
    ModuleGuard::<FormsModule>::check(&state.db, form.site_id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        form.site_id,
        &Permission::new("form_submission", "delete"),
    )
    .await?;
    form_submission_repo::soft_delete(&state.db, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/submissions/{id}/notes",
    tag = "Form Submissions",
    operation_id = "create_submission_note",
    description = "Append a triage note to a submission",
    params(("id" = Uuid, Path, description = "Submission UUID")),
    request_body(content = CreateSubmissionNoteRequest, description = "Note body"),
    responses(
        (status = 201, body = SubmissionNoteResponse),
        (status = 404, body = ProblemDetails),
    ),
    security(("api_key" = []))
)]
async fn create_submission_note(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
    ValidatedJson(body): ValidatedJson<CreateSubmissionNoteRequest>,
) -> Result<(StatusCode, Json<SubmissionNoteResponse>), ApiError> {
    let form_id = form_submission_repo::find_form_id_by_submission(&state.db, id).await?;
    let form = Form::find_by_id(&state.db, form_id).await?;
    ModuleGuard::<FormsModule>::check(&state.db, form.site_id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        form.site_id,
        &Permission::new("form_submission", "update"),
    )
    .await?;
    let actor_clerk_id = clerk_id_from_auth(&auth.0);
    let note =
        form_submission_repo::add_note(&state.db, id, actor_clerk_id.as_deref(), body.into_inner())
            .await?;
    Ok((StatusCode::CREATED, Json(note)))
}

#[utoipa::path(
    delete,
    path = "/submissions/{id}/notes/{note_id}",
    tag = "Form Submissions",
    operation_id = "delete_submission_note",
    description = "Delete a submission note",
    params(
        ("id" = Uuid, Path, description = "Submission UUID"),
        ("note_id" = Uuid, Path, description = "Note UUID")
    ),
    responses(
        (status = 204),
        (status = 404, body = ProblemDetails),
    ),
    security(("api_key" = []))
)]
async fn delete_submission_note(
    State(state): State<AppState>,
    Path((id, note_id)): Path<(Uuid, Uuid)>,
    auth: ReadKey,
) -> Result<StatusCode, ApiError> {
    let form_id = form_submission_repo::find_form_id_by_submission(&state.db, id).await?;
    let form = Form::find_by_id(&state.db, form_id).await?;
    ModuleGuard::<FormsModule>::check(&state.db, form.site_id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        form.site_id,
        &Permission::new("form_submission", "update"),
    )
    .await?;
    form_submission_repo::delete_note(&state.db, id, note_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

fn clerk_id_from_auth(auth: &crate::guards::actor::Actor) -> Option<String> {
    auth.clerk_user_id().map(|s| s.to_string())
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_forms, create_form))
        .routes(routes!(get_form_by_slug))
        .routes(routes!(get_form, update_form, delete_form))
        .routes(routes!(list_form_templates, create_form_template))
        .routes(routes!(
            get_form_template,
            update_form_template,
            delete_form_template
        ))
        .routes(routes!(public_get_form))
        .routes(routes!(public_altcha_challenge))
        .routes(routes!(public_submit_form))
        .routes(routes!(public_lookup_submission))
        .routes(routes!(public_get_submission, public_delete_submission))
        .routes(routes!(list_submissions))
        .routes(routes!(submission_status_counts))
        .routes(routes!(get_submission, delete_submission))
        .routes(routes!(update_submission_status))
        .routes(routes!(create_submission_note))
        .routes(routes!(delete_submission_note))
        .routes(routes!(
            get_site_bot_protection,
            upsert_site_bot_protection,
            delete_site_bot_protection
        ))
}
