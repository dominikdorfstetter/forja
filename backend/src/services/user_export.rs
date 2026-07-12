//! GDPR Art. 20 export assembly for Clerk users (#3).
//!
//! One builder produces the complete `UserDataExportResponse` for a Clerk
//! user id, shared by the self-service `/auth/export` endpoint and the
//! admin DSR-fulfilment endpoint — the actor UUID is derived from the
//! Clerk id, so no live session of the exported user is needed.

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::AppState;
use crate::dto::audit::{AuditLogResponse, ChangeHistoryResponse};
use crate::dto::auth::{
    AuthoredContentSummary, ExportAiUsageRecord, ExportApiKeyRecord, ExportMediaRecord,
    ProfileResponse, UserDataExportResponse,
};
use crate::dto::help_state::HelpStateResponse;
use crate::dto::notification::NotificationResponse;
use crate::dto::onboarding::OnboardingResponse;
use crate::dto::site_membership::MembershipSummary;
use crate::dto::user_preferences::UserPreferencesResponse;
use crate::errors::ApiError;
use crate::guards::auth_guard::CLERK_UUID_NAMESPACE;
use crate::models::api_key::ApiKeyPermission;
use crate::models::audit::AuditLog;
use crate::models::notification::Notification;
use crate::models::site_membership::SiteMembership;
use crate::models::user_preferences::UserPreferences;
use crate::repos::user_data_repo;
use crate::services::clerk_service::ClerkApiUser;

fn epoch_millis_to_datetime(ms: i64) -> DateTime<Utc> {
    DateTime::from_timestamp_millis(ms).unwrap_or_default()
}

/// The Clerk-shaped profile section. Also used by `/auth/profile` for
/// Clerk actors so the self view and the export stay identical.
pub fn clerk_profile(
    clerk_user_id: &str,
    clerk_user: Option<&ClerkApiUser>,
    memberships: Option<Vec<MembershipSummary>>,
    is_system_admin: Option<bool>,
) -> ProfileResponse {
    let (email, name, image_url, role, created_at, last_sign_in_at) = match clerk_user {
        Some(user) => (
            user.primary_email(),
            Some(user.display_name()),
            user.image_url.clone(),
            user.cms_role(),
            Some(epoch_millis_to_datetime(user.created_at)),
            user.last_sign_in_at.map(epoch_millis_to_datetime),
        ),
        None => (None, None, None, "read".to_string(), None, None),
    };

    ProfileResponse {
        id: clerk_user_id.to_string(),
        email,
        name,
        image_url,
        role,
        permission: ApiKeyPermission::Read,
        site_id: None,
        auth_method: "clerk_jwt".to_string(),
        created_at,
        last_sign_in_at,
        memberships,
        is_system_admin,
    }
}

/// Assemble the full data export for a Clerk user: profile, memberships,
/// audit/change trails, API keys, media uploads, AI usage, preferences,
/// notifications and authored-content summary.
pub async fn build_clerk_user_export(
    state: &AppState,
    clerk_user_id: &str,
) -> Result<UserDataExportResponse, ApiError> {
    let actor_uuid = Uuid::new_v5(&CLERK_UUID_NAMESPACE, clerk_user_id.as_bytes());

    let clerk_user = match state.clerk_service.as_ref() {
        Some(clerk) => Some(clerk.get_user(clerk_user_id).await?),
        None => None,
    };

    let memberships: Vec<MembershipSummary> =
        SiteMembership::find_summaries_for_user(&state.db, clerk_user_id)
            .await?
            .into_iter()
            .map(MembershipSummary::from)
            .collect();
    let is_system_admin = SiteMembership::is_system_admin(&state.db, clerk_user_id).await?;

    let profile = clerk_profile(
        clerk_user_id,
        clerk_user.as_ref(),
        Some(memberships.clone()),
        Some(is_system_admin),
    );

    let audit_logs: Vec<AuditLogResponse> = AuditLog::find_for_user(&state.db, actor_uuid, 1000, 0)
        .await?
        .into_iter()
        .map(AuditLogResponse::from)
        .collect();

    let api_keys: Vec<ExportApiKeyRecord> =
        user_data_repo::api_keys_for_user(&state.db, actor_uuid)
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
        user_data_repo::change_history_for_user(&state.db, actor_uuid, 1000)
            .await?
            .into_iter()
            .map(ChangeHistoryResponse::from)
            .collect();

    let media: Vec<ExportMediaRecord> = user_data_repo::media_for_user(&state.db, actor_uuid)
        .await?
        .into_iter()
        .map(ExportMediaRecord::from)
        .collect();

    let ai_usage: Vec<ExportAiUsageRecord> =
        user_data_repo::ai_usage_for_user(&state.db, actor_uuid, 1000)
            .await?
            .into_iter()
            .map(ExportAiUsageRecord::from)
            .collect();

    let effective = UserPreferences::get_effective(&state.db, clerk_user_id).await?;
    let preferences = Some(UserPreferencesResponse::from_json(&effective));
    let onboarding = Some(OnboardingResponse::from_json(&effective));
    let help_state = Some(HelpStateResponse::from_json(&effective));

    let notifications: Vec<NotificationResponse> =
        Notification::find_recent_for_recipient(&state.db, clerk_user_id, 1000)
            .await
            .unwrap_or_default()
            .into_iter()
            .map(NotificationResponse::from)
            .collect();

    let authored_content = user_data_repo::authored_content_counts(&state.db, clerk_user_id)
        .await
        .ok()
        .map(|counts| AuthoredContentSummary {
            blogs: counts.blogs,
            pages: counts.pages,
            documents: counts.documents,
            legal_docs: counts.legal_docs,
        });

    Ok(UserDataExportResponse {
        profile,
        audit_logs,
        api_keys,
        change_history,
        media,
        ai_usage,
        memberships: Some(memberships),
        preferences,
        notifications: Some(notifications),
        onboarding,
        help_state,
        authored_content,
        exported_at: Utc::now(),
    })
}
