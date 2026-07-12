//! Axum port of `crate::handlers::auth`. 12 endpoints for self-service
//! profile/preferences/onboarding/help-state plus GDPR data export, demo
//! guest token, and account deletion.

use crate::AppState;
use crate::dto::audit::{AuditLogResponse, ChangeHistoryResponse};
use crate::dto::auth::{
    AuthInfoResponse, AuthoredContentSummary, ExportAiUsageRecord, ExportApiKeyRecord,
    ExportMediaRecord, GuestTokenResponse, ProfileResponse, UserDataExportResponse,
};
use crate::dto::help_state::{HelpStateResponse, UpdateHelpStateRequest};
use crate::dto::notification::NotificationResponse;
use crate::dto::onboarding::{CompleteOnboardingRequest, OnboardingResponse};
use crate::dto::pii_inventory::{PiiInventoryEntity, PiiInventoryField, PiiInventoryResponse};
use crate::dto::site_membership::MembershipSummary;
use crate::dto::user_preferences::{UpdateUserPreferencesRequest, UserPreferencesResponse};
use crate::errors::codes;
use crate::guards::actor::{Actor, ActorKind};
use crate::models::api_key::ApiKeyPermission;
use crate::models::audit::AuditLog;
use crate::models::notification::Notification;
use crate::models::site_membership::SiteMembership;
use crate::models::user_preferences::UserPreferences;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::Json;
use chrono::{DateTime, Utc};
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

async fn fetch_memberships(
    state: &AppState,
    clerk_user_id: &str,
) -> Result<Vec<MembershipSummary>, crate::errors::ApiError> {
    let rows = SiteMembership::find_summaries_for_user(&state.db, clerk_user_id).await?;

    if rows.is_empty() && state.settings.demo_mode {
        // Only auto-join if the user explicitly opted in via preferences.
        let prefs = UserPreferences::get_effective(&state.db, clerk_user_id).await?;
        let opted_in = prefs
            .get(crate::models::user_preferences::KEY_DEMO_SITE_OPTED_IN)
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        if opted_in
            && let Ok(demo_site) =
                crate::models::site::Site::find_by_slug(&state.db, "john-forja").await
        {
            let existing =
                SiteMembership::find_by_clerk_user_and_site(&state.db, clerk_user_id, demo_site.id)
                    .await
                    .unwrap_or(None);

            if existing.is_none() {
                match SiteMembership::create(
                    &state.db,
                    clerk_user_id,
                    demo_site.id,
                    &crate::models::site_membership::SiteRole::Viewer,
                    None,
                )
                .await
                {
                    Ok(_) => {
                        tracing::info!(
                            "Demo mode: auto-joined user {} to demo site",
                            clerk_user_id
                        );
                        let new_rows =
                            SiteMembership::find_summaries_for_user(&state.db, clerk_user_id)
                                .await?;
                        return Ok(new_rows.into_iter().map(MembershipSummary::from).collect());
                    }
                    Err(e) => {
                        tracing::warn!("Demo mode: failed to auto-join user: {}", e);
                    }
                }
            }
        }
    }

    Ok(rows.into_iter().map(MembershipSummary::from).collect())
}

fn epoch_millis_to_datetime(ms: i64) -> DateTime<Utc> {
    DateTime::from_timestamp_millis(ms).unwrap_or_default()
}

fn build_profile(
    auth: &Actor,
    clerk_user: Option<&crate::services::clerk_service::ClerkApiUser>,
    memberships: Option<Vec<MembershipSummary>>,
    is_system_admin: Option<bool>,
) -> ProfileResponse {
    use crate::guards::actor::ActorKind;
    let (auth_method, id, email, name, image_url, role, created_at, last_sign_in_at) =
        match (&auth.kind, clerk_user) {
            (ActorKind::Clerk { clerk_user_id }, Some(user)) => (
                "clerk_jwt".to_string(),
                clerk_user_id.clone(),
                user.primary_email(),
                Some(user.display_name()),
                user.image_url.clone(),
                user.cms_role(),
                Some(epoch_millis_to_datetime(user.created_at)),
                user.last_sign_in_at.map(epoch_millis_to_datetime),
            ),
            (ActorKind::Clerk { clerk_user_id }, None) => (
                "clerk_jwt".to_string(),
                clerk_user_id.clone(),
                None,
                None,
                None,
                "read".to_string(),
                None,
                None,
            ),
            (ActorKind::ApiKey { permission, .. }, _) => (
                "api_key".to_string(),
                auth.id.to_string(),
                None,
                None,
                None,
                format!("{:?}", permission).to_lowercase(),
                None,
                None,
            ),
            (ActorKind::Preview { .. }, _) => (
                "preview_token".to_string(),
                auth.id.to_string(),
                None,
                None,
                None,
                "read".to_string(),
                None,
                None,
            ),
        };

    ProfileResponse {
        id,
        email,
        name,
        image_url,
        role,
        permission: auth.api_key_permission().unwrap_or(ApiKeyPermission::Read),
        site_id: auth.scoped_site_id(),
        auth_method,
        created_at,
        last_sign_in_at,
        memberships,
        is_system_admin,
    }
}

#[utoipa::path(
    get,
    path = "/auth/me",
    tag = "Auth",
    operation_id = "get_auth_me",
    description = "Return the permission level, optional site restriction, and memberships of the authenticated user",
    security(("api_key" = []), ("bearer_auth" = [])),
    responses(
        (status = 200, description = "Current auth info", body = AuthInfoResponse),
        (status = 401, description = "Missing or invalid credentials")
    )
)]
async fn get_me(
    State(state): State<AppState>,
    auth: Actor,
) -> Result<Json<AuthInfoResponse>, crate::errors::ApiError> {
    use crate::guards::actor::ActorKind;
    let (auth_method, clerk_user_id, memberships, is_system_admin) = match &auth.kind {
        ActorKind::ApiKey { .. } => ("api_key".to_string(), None, None, None),
        ActorKind::Preview { .. } => ("preview_token".to_string(), None, None, None),
        ActorKind::Clerk { clerk_user_id } => {
            let memberships = fetch_memberships(&state, clerk_user_id).await?;
            let is_admin = SiteMembership::is_system_admin(&state.db, clerk_user_id).await?;
            (
                "clerk_jwt".to_string(),
                Some(clerk_user_id.clone()),
                Some(memberships),
                Some(is_admin),
            )
        }
    };

    Ok(Json(AuthInfoResponse {
        permission: auth.api_key_permission().unwrap_or(ApiKeyPermission::Read),
        site_id: auth.scoped_site_id(),
        auth_method,
        clerk_user_id,
        memberships,
        is_system_admin,
        demo_mode: state.settings.demo_mode,
    }))
}

#[utoipa::path(
    get,
    path = "/auth/profile",
    tag = "Auth",
    operation_id = "get_auth_profile",
    description = "Return the full profile of the authenticated user",
    security(("api_key" = []), ("bearer_auth" = [])),
    responses(
        (status = 200, description = "User profile", body = ProfileResponse),
        (status = 401, description = "Missing or invalid credentials")
    )
)]
async fn get_profile(
    State(state): State<AppState>,
    auth: Actor,
) -> Result<Json<ProfileResponse>, crate::errors::ApiError> {
    use crate::guards::actor::ActorKind;
    let (clerk_user, memberships, is_system_admin) = match &auth.kind {
        ActorKind::Clerk { clerk_user_id } => {
            let user = if let Some(ref clerk) = state.clerk_service {
                Some(clerk.get_user(clerk_user_id).await?)
            } else {
                None
            };
            let memberships = fetch_memberships(&state, clerk_user_id).await?;
            let is_admin = SiteMembership::is_system_admin(&state.db, clerk_user_id).await?;
            (user, Some(memberships), Some(is_admin))
        }
        ActorKind::ApiKey { .. } | ActorKind::Preview { .. } => (None, None, None),
    };

    Ok(Json(build_profile(
        &auth,
        clerk_user.as_ref(),
        memberships,
        is_system_admin,
    )))
}

#[utoipa::path(
    get,
    path = "/auth/pii-inventory",
    tag = "Auth",
    operation_id = "get_pii_inventory",
    description = "GDPR Art. 15 transparency view: every identity-bearing field Forja's built-in entities process, with purpose, lawful basis, erasure behavior, and the caller's live record count per field (counts are null for non-Clerk actors)",
    security(("api_key" = []), ("bearer_auth" = [])),
    responses(
        (status = 200, description = "PII inventory", body = PiiInventoryResponse),
        (status = 401, description = "Missing or invalid credentials")
    )
)]
async fn get_pii_inventory(
    State(state): State<AppState>,
    auth: Actor,
) -> Result<Json<PiiInventoryResponse>, crate::errors::ApiError> {
    let counts = match &auth.kind {
        ActorKind::Clerk { clerk_user_id } => Some(
            crate::repos::user_data_repo::pii_record_counts(&state.db, clerk_user_id, auth.id)
                .await?,
        ),
        ActorKind::ApiKey { .. } | ActorKind::Preview { .. } => None,
    };

    let count_for = |table: &str, field: &str| -> Option<i64> {
        counts
            .as_ref()?
            .iter()
            .find(|c| c.table == table && c.field == field)
            .map(|c| c.record_count)
    };

    let entities = crate::models::builtin_pii::REGISTRY
        .iter()
        .map(|entity| PiiInventoryEntity {
            table: entity.table.to_string(),
            description: entity.description.to_string(),
            fields: entity
                .fields
                .iter()
                .map(|field| PiiInventoryField {
                    field: field.field.to_string(),
                    purpose: field.purpose.to_string(),
                    legal_basis: field.legal_basis.to_string(),
                    retention_behavior: field.retention_behavior.as_str().to_string(),
                    record_count: count_for(entity.table, field.field),
                })
                .collect(),
        })
        .collect();

    Ok(Json(PiiInventoryResponse {
        generated_at: Utc::now(),
        entities,
    }))
}

#[utoipa::path(
    get,
    path = "/auth/export",
    tag = "Auth",
    operation_id = "export_user_data",
    description = "Export all data associated with the authenticated user (GDPR data portability)",
    security(("api_key" = []), ("bearer_auth" = [])),
    responses(
        (status = 200, description = "User data export", body = UserDataExportResponse),
        (status = 401, description = "Missing or invalid credentials")
    )
)]
async fn export_user_data(
    State(state): State<AppState>,
    auth: Actor,
) -> Result<Json<UserDataExportResponse>, crate::errors::ApiError> {
    let (clerk_user, memberships, is_system_admin) = match &auth.kind {
        ActorKind::Clerk { clerk_user_id } => {
            let user = if let Some(ref clerk) = state.clerk_service {
                Some(clerk.get_user(clerk_user_id).await?)
            } else {
                None
            };
            let memberships = fetch_memberships(&state, clerk_user_id).await?;
            let is_admin = SiteMembership::is_system_admin(&state.db, clerk_user_id).await?;
            (user, Some(memberships.clone()), Some(is_admin))
        }
        ActorKind::ApiKey { .. } | ActorKind::Preview { .. } => (None, None, None),
    };
    let profile = build_profile(
        &auth,
        clerk_user.as_ref(),
        memberships.clone(),
        is_system_admin,
    );

    let audit_logs: Vec<AuditLogResponse> = AuditLog::find_for_user(&state.db, auth.id, 1000, 0)
        .await?
        .into_iter()
        .map(AuditLogResponse::from)
        .collect();

    let api_keys: Vec<ExportApiKeyRecord> =
        crate::repos::user_data_repo::api_keys_for_user(&state.db, auth.id)
            .await?
            .into_iter()
            .map(|row| ExportApiKeyRecord {
                id: row.id,
                name: row.name,
                permission: row.permission,
                site_id: row.site_id,
                status: format!("{:?}", row.status),
                created_at: row.created_at,
            })
            .collect();

    let change_history: Vec<ChangeHistoryResponse> =
        crate::repos::user_data_repo::change_history_for_user(&state.db, auth.id, 1000)
            .await?
            .into_iter()
            .map(ChangeHistoryResponse::from)
            .collect();

    let media: Vec<ExportMediaRecord> =
        crate::repos::user_data_repo::media_for_user(&state.db, auth.id)
            .await?
            .into_iter()
            .map(ExportMediaRecord::from)
            .collect();

    let ai_usage: Vec<ExportAiUsageRecord> =
        crate::repos::user_data_repo::ai_usage_for_user(&state.db, auth.id, 1000)
            .await?
            .into_iter()
            .map(ExportAiUsageRecord::from)
            .collect();

    let (preferences, notifications, onboarding, help_state, authored_content) = match &auth.kind {
        ActorKind::Clerk { clerk_user_id } => {
            let effective = UserPreferences::get_effective(&state.db, clerk_user_id).await?;
            let prefs = Some(UserPreferencesResponse::from_json(&effective));
            let onb = Some(OnboardingResponse::from_json(&effective));
            let help = Some(HelpStateResponse::from_json(&effective));

            let notifs: Vec<NotificationResponse> =
                Notification::find_recent_for_recipient(&state.db, clerk_user_id, 1000)
                    .await
                    .unwrap_or_default()
                    .into_iter()
                    .map(NotificationResponse::from)
                    .collect();

            let authored =
                crate::repos::user_data_repo::authored_content_counts(&state.db, clerk_user_id)
                    .await
                    .ok()
                    .map(|counts| AuthoredContentSummary {
                        blogs: counts.blogs,
                        pages: counts.pages,
                        documents: counts.documents,
                        legal_docs: counts.legal_docs,
                    });

            (prefs, Some(notifs), onb, help, authored)
        }
        ActorKind::ApiKey { .. } | ActorKind::Preview { .. } => (None, None, None, None, None),
    };

    Ok(Json(UserDataExportResponse {
        profile,
        audit_logs,
        api_keys,
        change_history,
        media,
        ai_usage,
        memberships,
        preferences,
        notifications,
        onboarding,
        help_state,
        authored_content,
        exported_at: Utc::now(),
    }))
}

/// Resolve the caller to a Clerk user ID or fail with the standard
/// "only available for Clerk-authenticated users" error. Five endpoints
/// in this bundle gate themselves the same way; this helper avoids the
/// boilerplate duplication.
fn require_clerk<'a>(auth: &'a Actor, kind: &str) -> Result<&'a str, crate::errors::ApiError> {
    match &auth.kind {
        ActorKind::Clerk { clerk_user_id } => Ok(clerk_user_id),
        ActorKind::ApiKey { .. } | ActorKind::Preview { .. } => {
            Err(crate::errors::ApiError::bad_request(format!(
                "{} is only available for Clerk-authenticated users",
                kind
            ))
            .with_code(codes::BAD_REQUEST))
        }
    }
}

#[utoipa::path(
    get,
    path = "/auth/preferences",
    tag = "Auth",
    operation_id = "get_preferences",
    description = "Return the effective preferences for the authenticated user",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "User preferences", body = UserPreferencesResponse),
        (status = 400, description = "Only available for Clerk-authenticated users"),
        (status = 401, description = "Missing or invalid credentials")
    )
)]
async fn get_preferences(
    State(state): State<AppState>,
    auth: Actor,
) -> Result<Json<UserPreferencesResponse>, crate::errors::ApiError> {
    let clerk_user_id = require_clerk(&auth, "Preferences")?;
    let effective = UserPreferences::get_effective(&state.db, clerk_user_id).await?;
    Ok(Json(UserPreferencesResponse::from_json(&effective)))
}

#[utoipa::path(
    put,
    path = "/auth/preferences",
    tag = "Auth",
    operation_id = "update_preferences",
    description = "Update the authenticated user's preferences (partial update)",
    security(("bearer_auth" = [])),
    request_body = UpdateUserPreferencesRequest,
    responses(
        (status = 200, description = "Updated preferences", body = UserPreferencesResponse),
        (status = 400, description = "Validation error or not a Clerk user"),
        (status = 401, description = "Missing or invalid credentials")
    )
)]
async fn update_preferences(
    State(state): State<AppState>,
    auth: Actor,
    crate::dto::validated::ValidatedJson(body): crate::dto::validated::ValidatedJson<
        UpdateUserPreferencesRequest,
    >,
) -> Result<Json<UserPreferencesResponse>, crate::errors::ApiError> {
    let clerk_user_id = require_clerk(&auth, "Preferences")?.to_string();
    let partial = body.to_json();
    let effective = UserPreferences::upsert(&state.db, &clerk_user_id, partial).await?;
    Ok(Json(UserPreferencesResponse::from_json(&effective)))
}

#[utoipa::path(
    get,
    path = "/auth/onboarding",
    tag = "Auth",
    operation_id = "get_onboarding",
    description = "Return the onboarding survey state for the authenticated user",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Onboarding state", body = OnboardingResponse),
        (status = 400, description = "Only available for Clerk-authenticated users"),
        (status = 401, description = "Missing or invalid credentials")
    )
)]
async fn get_onboarding(
    State(state): State<AppState>,
    auth: Actor,
) -> Result<Json<OnboardingResponse>, crate::errors::ApiError> {
    let clerk_user_id = require_clerk(&auth, "Onboarding")?;
    let effective = UserPreferences::get_effective(&state.db, clerk_user_id).await?;
    Ok(Json(OnboardingResponse::from_json(&effective)))
}

#[utoipa::path(
    put,
    path = "/auth/onboarding",
    tag = "Auth",
    operation_id = "complete_onboarding",
    description = "Complete the onboarding survey with user type and content intents",
    security(("bearer_auth" = [])),
    request_body = CompleteOnboardingRequest,
    responses(
        (status = 200, description = "Updated onboarding state", body = OnboardingResponse),
        (status = 400, description = "Validation error or not a Clerk user"),
        (status = 401, description = "Missing or invalid credentials")
    )
)]
async fn complete_onboarding(
    State(state): State<AppState>,
    auth: Actor,
    crate::dto::validated::ValidatedJson(body): crate::dto::validated::ValidatedJson<
        CompleteOnboardingRequest,
    >,
) -> Result<Json<OnboardingResponse>, crate::errors::ApiError> {
    let clerk_user_id = require_clerk(&auth, "Onboarding")?.to_string();
    let partial = body.to_json();
    let effective = UserPreferences::upsert(&state.db, &clerk_user_id, partial).await?;
    Ok(Json(OnboardingResponse::from_json(&effective)))
}

#[utoipa::path(
    get,
    path = "/auth/help-state",
    tag = "Auth",
    operation_id = "get_help_state",
    description = "Return the help system state for the authenticated user",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Help state", body = HelpStateResponse),
        (status = 400, description = "Only available for Clerk-authenticated users"),
        (status = 401, description = "Missing or invalid credentials")
    )
)]
async fn get_help_state(
    State(state): State<AppState>,
    auth: Actor,
) -> Result<Json<HelpStateResponse>, crate::errors::ApiError> {
    let clerk_user_id = require_clerk(&auth, "Help state")?;
    let effective = UserPreferences::get_effective(&state.db, clerk_user_id).await?;
    Ok(Json(HelpStateResponse::from_json(&effective)))
}

#[utoipa::path(
    patch,
    path = "/auth/help-state",
    tag = "Auth",
    operation_id = "update_help_state",
    description = "Update the authenticated user's help system state (partial update)",
    security(("bearer_auth" = [])),
    request_body = UpdateHelpStateRequest,
    responses(
        (status = 200, description = "Updated help state", body = HelpStateResponse),
        (status = 400, description = "Validation error or not a Clerk user"),
        (status = 401, description = "Missing or invalid credentials")
    )
)]
async fn update_help_state(
    State(state): State<AppState>,
    auth: Actor,
    crate::dto::validated::ValidatedJson(body): crate::dto::validated::ValidatedJson<
        UpdateHelpStateRequest,
    >,
) -> Result<Json<HelpStateResponse>, crate::errors::ApiError> {
    let clerk_user_id = require_clerk(&auth, "Help state")?.to_string();
    let effective = UserPreferences::get_effective(&state.db, &clerk_user_id).await?;
    let current = HelpStateResponse::from_json(&effective);

    let partial = body.to_json(&current.hotspots_seen, &current.field_help_seen);
    let updated = UserPreferences::upsert(&state.db, &clerk_user_id, partial).await?;
    Ok(Json(HelpStateResponse::from_json(&updated)))
}

#[utoipa::path(
    post,
    path = "/auth/help-state/reset",
    tag = "Auth",
    operation_id = "reset_help_state",
    description = "Reset the authenticated user's help system state to defaults",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Reset help state", body = HelpStateResponse),
        (status = 400, description = "Only available for Clerk-authenticated users"),
        (status = 401, description = "Missing or invalid credentials")
    )
)]
async fn reset_help_state(
    State(state): State<AppState>,
    auth: Actor,
) -> Result<Json<HelpStateResponse>, crate::errors::ApiError> {
    let clerk_user_id = require_clerk(&auth, "Help state")?;
    let partial = UpdateHelpStateRequest::reset_json();
    let updated = UserPreferences::upsert(&state.db, clerk_user_id, partial).await?;
    Ok(Json(HelpStateResponse::from_json(&updated)))
}

#[utoipa::path(
    get,
    path = "/auth/guest",
    tag = "Auth",
    operation_id = "get_guest_token",
    description = "Get a read-only guest API key for the demo site (only available when DEMO_MODE=true)",
    responses(
        (status = 200, description = "Guest API key for demo site", body = GuestTokenResponse),
        (status = 404, description = "Demo mode not enabled or demo site not found")
    )
)]
async fn get_guest_token(
    State(state): State<AppState>,
) -> Result<Json<GuestTokenResponse>, crate::errors::ApiError> {
    if !state.settings.demo_mode {
        return Err(
            crate::errors::ApiError::not_found("Demo mode is not enabled")
                .with_code(codes::RESOURCE_NOT_FOUND),
        );
    }

    let demo_key = state.demo_guest_key.get().ok_or_else(|| {
        crate::errors::ApiError::internal("Demo guest key not initialised at boot")
            .with_code(codes::INTERNAL_ERROR)
    })?;

    // Derive prefix from the generated key: "dk_XXXXXXXX_..." → prefix is "dk_XXXXXXXX"
    let key_prefix = demo_key
        .find('_')
        .and_then(|first| {
            demo_key[first + 1..]
                .find('_')
                .map(|second| first + 1 + second)
        })
        .map(|pos| &demo_key[..pos])
        .unwrap_or("dk_guest");

    let demo_site = crate::models::site::Site::find_by_slug(&state.db, "john-forja").await?;

    // Hash with Argon2id (the current algorithm), not SHA-256
    let key_hash = crate::models::api_key::ApiKey::hash_key(demo_key);

    crate::models::api_key::ApiKey::upsert_demo_guest_key(
        &state.db,
        &key_hash,
        key_prefix,
        demo_site.id,
    )
    .await?;

    Ok(Json(GuestTokenResponse {
        api_key: demo_key.clone(),
        site_id: demo_site.id.to_string(),
        site_name: demo_site.name,
        site_slug: demo_site.slug,
    }))
}

#[utoipa::path(
    delete,
    path = "/auth/account",
    tag = "Auth",
    operation_id = "delete_account",
    description = "Delete the authenticated user's account and clean up associated data",
    security(("bearer_auth" = [])),
    responses(
        (status = 204, description = "Account deleted successfully"),
        (status = 400, description = "Account deletion only available for Clerk users"),
        (status = 401, description = "Missing or invalid credentials"),
        (status = 409, description = "User is sole owner of one or more sites")
    )
)]
async fn delete_account(
    State(state): State<AppState>,
    auth: Actor,
) -> Result<StatusCode, crate::errors::ApiError> {
    let clerk_user_id = match &auth.kind {
        ActorKind::Clerk { clerk_user_id } => clerk_user_id.clone(),
        ActorKind::ApiKey { .. } | ActorKind::Preview { .. } => {
            return Err(crate::errors::ApiError::bad_request(
                "Account deletion is only available for Clerk-authenticated users",
            )
            .with_code(codes::BAD_REQUEST));
        }
    };

    let owned_sites = SiteMembership::find_owned_sites(&state.db, &clerk_user_id).await?;
    for site_id in &owned_sites {
        let has_other =
            SiteMembership::site_has_other_owner(&state.db, *site_id, &clerk_user_id).await?;
        if !has_other {
            return Err(crate::errors::ApiError::conflict(
                format!(
                    "You are the sole owner of site {}. Transfer ownership before deleting your account.",
                    site_id
                ),
            ).with_code(codes::AUTH_ACCOUNT_SOLE_OWNER));
        }
    }

    let clerk = state.clerk_service.as_ref().ok_or_else(|| {
        crate::errors::ApiError::internal("Clerk service not configured")
            .with_code(codes::AUTH_CLERK_NOT_CONFIGURED)
    })?;

    clerk.delete_user(&clerk_user_id).await?;

    crate::repos::user_data_repo::erase_user_records(&state.db, &clerk_user_id, auth.id).await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/auth/demo/join",
    tag = "Auth",
    operation_id = "join_demo_site",
    description = "Opt into the demo site. Sets the demo_site_opted_in preference and creates a Viewer membership on the john-forja demo site.",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Joined demo site", body = AuthInfoResponse),
        (status = 404, description = "Demo mode not enabled or demo site not found"),
        (status = 409, description = "Already a member of the demo site")
    )
)]
async fn join_demo_site(
    State(state): State<AppState>,
    auth: Actor,
) -> Result<Json<AuthInfoResponse>, crate::errors::ApiError> {
    if !state.settings.demo_mode {
        return Err(
            crate::errors::ApiError::not_found("Demo mode is not enabled")
                .with_code(codes::RESOURCE_NOT_FOUND),
        );
    }

    let clerk_user_id = require_clerk(&auth, "Join demo site")?;

    let demo_site = crate::models::site::Site::find_by_slug(&state.db, "john-forja").await?;

    let existing =
        SiteMembership::find_by_clerk_user_and_site(&state.db, clerk_user_id, demo_site.id).await?;
    if existing.is_some() {
        // Already a member — just ensure the preference is set
        UserPreferences::upsert(
            &state.db,
            clerk_user_id,
            serde_json::json!({
                crate::models::user_preferences::KEY_DEMO_SITE_OPTED_IN: true
            }),
        )
        .await?;
    } else {
        SiteMembership::create(
            &state.db,
            clerk_user_id,
            demo_site.id,
            &crate::models::site_membership::SiteRole::Viewer,
            None,
        )
        .await?;
        UserPreferences::upsert(
            &state.db,
            clerk_user_id,
            serde_json::json!({
                crate::models::user_preferences::KEY_DEMO_SITE_OPTED_IN: true
            }),
        )
        .await?;
    }

    let memberships = fetch_memberships(&state, clerk_user_id).await?;
    let is_admin = SiteMembership::is_system_admin(&state.db, clerk_user_id).await?;

    Ok(Json(AuthInfoResponse {
        permission: auth.api_key_permission().unwrap_or(ApiKeyPermission::Read),
        site_id: auth.scoped_site_id(),
        auth_method: "clerk_jwt".to_string(),
        clerk_user_id: Some(clerk_user_id.to_string()),
        memberships: Some(memberships),
        is_system_admin: Some(is_admin),
        demo_mode: state.settings.demo_mode,
    }))
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(get_me))
        .routes(routes!(get_profile))
        .routes(routes!(export_user_data))
        .routes(routes!(get_pii_inventory))
        .routes(routes!(get_preferences, update_preferences))
        .routes(routes!(get_onboarding, complete_onboarding))
        .routes(routes!(get_help_state, update_help_state))
        .routes(routes!(reset_help_state))
        .routes(routes!(get_guest_token))
        .routes(routes!(join_demo_site))
        .routes(routes!(delete_account))
}
