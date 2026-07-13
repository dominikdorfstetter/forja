//! UI Strings handlers (consumer-feedback roadmap §1). Admin CRUD over
//! the site-scoped key→string dictionary plus the public consumer read:
//! a flat `{key: value}` map resolved for one required `?locale=` via the
//! ADR 0002 fallback chain. The public read is cached per (site, locale)
//! through `response_cache`; every write path invalidates the site.

use std::collections::{BTreeMap, HashMap};

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::Json;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::AppState;
use crate::axum_app::extractors::ResolveLocale;
use crate::dto::ui_strings::{
    CreateUiStringRequest, UI_STRINGS_MAX_KEYS_PER_SITE, UiStringLocalizationResponse,
    UiStringResponse, UpdateUiStringRequest,
};
use crate::dto::validated::ValidatedJson;
use crate::errors::codes;
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::{ReadKey, WriteKey};
use crate::models::audit::AuditAction;
use crate::repos::ui_string_repo::{
    UiStringLocalizationRow, UiStringRepo, UiStringRow, limit_exceeded, resolve_flat_map,
};
use crate::services::audited_mutation::AuditedEntity;
use crate::services::permission_service::{Permission, PermissionService};
use crate::services::response_cache;
use crate::utils::locale_resolver::resolve_ids_for_site;

/// UI strings audit and fire `ui_string.*` webhooks.
const UI_STRING: AuditedEntity = AuditedEntity::with_webhooks("ui_string", "ui_string");

fn to_response(row: UiStringRow, localizations: Vec<UiStringLocalizationRow>) -> UiStringResponse {
    UiStringResponse {
        id: row.id,
        key: row.key,
        localizations: localizations
            .into_iter()
            .map(|l| UiStringLocalizationResponse {
                id: l.id,
                locale_id: l.locale_id,
                value: l.value,
                translation_status: l.translation_status,
            })
            .collect(),
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/strings/entries",
    tag = "UI Strings",
    operation_id = "list_ui_string_entries",
    description = "List every UI string key with all localizations (admin read for per-locale completeness)",
    params(("site_id" = Uuid, Path, description = "The UUID of the site")),
    responses(
        (status = 200, description = "UI string entries", body = Vec<UiStringResponse>),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_ui_string_entries(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<Vec<UiStringResponse>>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("ui_string", "read"),
    )
    .await?;
    let rows = UiStringRepo::list_for_site(&state.db, site_id).await?;

    let mut locs_by_string: HashMap<Uuid, Vec<UiStringLocalizationRow>> = HashMap::new();
    for loc in UiStringRepo::localizations_for_site(&state.db, site_id).await? {
        locs_by_string
            .entry(loc.ui_string_id)
            .or_default()
            .push(loc);
    }

    let responses = rows
        .into_iter()
        .map(|row| {
            let locs = locs_by_string.remove(&row.id).unwrap_or_default();
            to_response(row, locs)
        })
        .collect();
    Ok(Json(responses))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/strings",
    tag = "UI Strings",
    operation_id = "get_site_ui_strings",
    description = "Resolved UI strings for one locale as a flat key → value map. One value per key via the ADR 0002 fallback chain (exact match → site default → first-by-code); keys without any localization are omitted. Unknown locale codes fall back silently.",
    params(
        ("site_id" = Uuid, Path, description = "The UUID of the site"),
        ("locale" = String, Query, description = "Locale code to resolve values for (required)")
    ),
    responses(
        (status = 200, description = "Flat map of key → resolved value", body = BTreeMap<String, String>),
        (status = 400, description = "Missing locale query parameter", body = ProblemDetails),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_site_ui_strings(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    locale: ResolveLocale,
    auth: ReadKey,
) -> Result<Json<BTreeMap<String, String>>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("site", "read"),
    )
    .await?;
    let Some(code) = locale.0 else {
        return Err(ApiError::bad_request(
            "The locale query parameter is required (e.g. ?locale=en)",
        )
        .with_code(codes::ERR_STRINGS_LOCALE_REQUIRED));
    };

    // Identical per (site, locale) → cacheable after the key check.
    let response = response_cache::cached(
        &state.redis,
        &response_cache::key(site_id, &format!("strings:loc:{code}")),
        || async {
            let resolution = resolve_ids_for_site(Some(&code), &state.db, site_id)
                .await?
                .unwrap_or((None, None));
            let rows = UiStringRepo::localized_values_for_site(&state.db, site_id).await?;
            Ok(resolve_flat_map(&rows, resolution))
        },
    )
    .await?;
    Ok(Json(response))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/strings",
    tag = "UI Strings",
    operation_id = "create_ui_string",
    description = "Create a UI string key with its initial localizations (max 500 keys per site)",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = CreateUiStringRequest, description = "UI string data"),
    responses(
        (status = 201, description = "UI string created", body = UiStringResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 409, description = "Key already exists on this site", body = ProblemDetails),
        (status = 422, description = "Validation error or key limit reached", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn create_ui_string(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<CreateUiStringRequest>,
) -> Result<(StatusCode, Json<UiStringResponse>), ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("ui_string", "create"),
    )
    .await?;
    // Fast path only — the authoritative, race-free check runs inside the
    // repo's create transaction under a per-site advisory lock.
    if UiStringRepo::count_for_site(&state.db, site_id).await? >= UI_STRINGS_MAX_KEYS_PER_SITE {
        return Err(limit_exceeded());
    }
    let body = body.into_inner();

    let row = UiStringRepo::create(&state.db, site_id, &body.key, &body.localizations).await?;
    let locs = UiStringRepo::localizations_for_string(&state.db, row.id).await?;

    UI_STRING
        .mutate(AuditAction::Create, row.id)
        .site(site_id)
        .actor(auth.0.id)
        .payload(serde_json::json!({"type": "ui_string", "key": row.key}))
        .execute(&state.db)
        .await;
    response_cache::invalidate_site(site_id).await;
    Ok((StatusCode::CREATED, Json(to_response(row, locs))))
}

#[utoipa::path(
    put,
    path = "/sites/{site_id}/strings/{id}",
    tag = "UI Strings",
    operation_id = "update_ui_string",
    description = "Rename a UI string key, upsert localizations, and/or remove localizations by locale. Changing the site-default locale's value flips every other locale to translation_status=outdated; the default locale's row cannot be removed.",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("id" = Uuid, Path, description = "UI string UUID")
    ),
    request_body(content = UpdateUiStringRequest, description = "UI string update data"),
    responses(
        (status = 200, description = "UI string updated", body = UiStringResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "UI string not found", body = ProblemDetails),
        (status = 409, description = "Key already exists on this site", body = ProblemDetails),
        (status = 422, description = "Validation error, removal of the default locale, or locale in both localizations and removed_locale_ids", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn update_ui_string(
    State(state): State<AppState>,
    Path((site_id, id)): Path<(Uuid, Uuid)>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<UpdateUiStringRequest>,
) -> Result<Json<UiStringResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("ui_string", "update"),
    )
    .await?;
    let existing = UiStringRepo::find_for_site(&state.db, site_id, id).await?;
    let old = serde_json::to_value(&existing).ok();
    let body = body.into_inner();

    let row = UiStringRepo::update(
        &state.db,
        site_id,
        id,
        body.key.as_deref(),
        &body.localizations,
        body.removed_locale_ids.as_deref().unwrap_or_default(),
    )
    .await?;
    let locs = UiStringRepo::localizations_for_string(&state.db, row.id).await?;

    let change_diff = match (old, serde_json::to_value(&row)) {
        (Some(old), Ok(new)) => Some((old, new)),
        _ => None,
    };
    UI_STRING
        .mutate(AuditAction::Update, id)
        .site(site_id)
        .actor(auth.0.id)
        .payload(serde_json::json!({"type": "ui_string", "key": row.key}))
        .maybe_diff(change_diff)
        .execute(&state.db)
        .await;
    response_cache::invalidate_site(site_id).await;
    Ok(Json(to_response(row, locs)))
}

#[utoipa::path(
    delete,
    path = "/sites/{site_id}/strings/{id}",
    tag = "UI Strings",
    operation_id = "delete_ui_string",
    description = "Delete a UI string key and all its localizations",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("id" = Uuid, Path, description = "UI string UUID")
    ),
    responses(
        (status = 204, description = "UI string deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "UI string not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn delete_ui_string(
    State(state): State<AppState>,
    Path((site_id, id)): Path<(Uuid, Uuid)>,
    auth: WriteKey,
) -> Result<StatusCode, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("ui_string", "delete"),
    )
    .await?;
    let existing = UiStringRepo::find_for_site(&state.db, site_id, id).await?;
    UiStringRepo::delete(&state.db, site_id, id).await?;

    UI_STRING
        .mutate(AuditAction::Delete, id)
        .site(site_id)
        .actor(auth.0.id)
        .payload(serde_json::json!({"type": "ui_string", "key": existing.key}))
        .execute(&state.db)
        .await;
    response_cache::invalidate_site(site_id).await;
    Ok(StatusCode::NO_CONTENT)
}

/// `/strings/entries` (literal trailing segment) is registered ahead of
/// `/strings/{id}` so matchit resolves it first.
pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_ui_string_entries))
        .routes(routes!(get_site_ui_strings, create_ui_string))
        .routes(routes!(update_ui_string, delete_ui_string))
}
