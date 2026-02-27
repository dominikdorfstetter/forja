//! Authentication handlers
//!
//! Endpoints for profile, data export, and account management.

use chrono::{DateTime, Utc};
use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::Route;

use crate::dto::audit::{AuditLogResponse, ChangeHistoryResponse};
use crate::dto::auth::{
    AuthInfoResponse, ExportApiKeyRecord, ProfileResponse, UserDataExportResponse,
};
use crate::dto::site_membership::{MembershipSummary, MembershipWithSite};
use crate::guards::auth_guard::{AuthSource, AuthenticatedKey};
use crate::models::audit::{AuditLog, ChangeHistory};
use crate::models::site_membership::SiteMembership;
use crate::AppState;

/// Fetch membership summaries for a Clerk user
async fn fetch_memberships(
    state: &AppState,
    clerk_user_id: &str,
) -> Result<Vec<MembershipSummary>, crate::errors::ApiError> {
    let rows: Vec<MembershipWithSite> = sqlx::query_as(
        r#"
        SELECT sm.site_id, s.name AS site_name, s.slug AS site_slug, sm.role
        FROM site_memberships sm
        JOIN sites s ON s.id = sm.site_id AND s.is_deleted = FALSE
        WHERE sm.clerk_user_id = $1
        ORDER BY s.name ASC
        "#,
    )
    .bind(clerk_user_id)
    .fetch_all(&state.db)
    .await?;

    Ok(rows.into_iter().map(MembershipSummary::from).collect())
}

/// Get the permission level and site restriction of the current API key.
///
/// Accessible by ANY valid API key or Clerk JWT (Read, Write, Admin, Master).
#[utoipa::path(
    tag = "Auth",
    operation_id = "get_auth_me",
    description = "Return the permission level, optional site restriction, and memberships of the authenticated user",
    security(("api_key" = []), ("bearer_auth" = [])),
    responses(
        (status = 200, description = "Current auth info", body = AuthInfoResponse),
        (status = 401, description = "Missing or invalid credentials")
    )
)]
#[get("/auth/me")]
pub async fn get_me(
    auth: AuthenticatedKey,
    state: &rocket::State<AppState>,
) -> Result<Json<AuthInfoResponse>, crate::errors::ApiError> {
    let (auth_method, clerk_user_id, memberships, is_system_admin) = match &auth.auth_source {
        AuthSource::ApiKey => ("api_key".to_string(), None, None, None),
        AuthSource::ClerkJwt { clerk_user_id } => {
            let memberships = fetch_memberships(state.inner(), clerk_user_id).await?;
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
        permission: auth.permission,
        site_id: auth.site_id,
        auth_method,
        clerk_user_id,
        memberships,
        is_system_admin,
    }))
}

/// Helper: convert epoch millis to DateTime<Utc>
fn epoch_millis_to_datetime(ms: i64) -> DateTime<Utc> {
    DateTime::from_timestamp_millis(ms).unwrap_or_default()
}

/// Helper: build a ProfileResponse from auth context + optional Clerk user data
fn build_profile(
    auth: &AuthenticatedKey,
    clerk_user: Option<&crate::services::clerk_service::ClerkApiUser>,
    memberships: Option<Vec<MembershipSummary>>,
    is_system_admin: Option<bool>,
) -> ProfileResponse {
    let (auth_method, id, email, name, image_url, role, created_at, last_sign_in_at) =
        match (&auth.auth_source, clerk_user) {
            (AuthSource::ClerkJwt { clerk_user_id }, Some(user)) => (
                "clerk_jwt".to_string(),
                clerk_user_id.clone(),
                user.primary_email(),
                Some(user.display_name()),
                user.image_url.clone(),
                user.cms_role(),
                Some(epoch_millis_to_datetime(user.created_at)),
                user.last_sign_in_at.map(epoch_millis_to_datetime),
            ),
            (AuthSource::ClerkJwt { clerk_user_id }, None) => (
                "clerk_jwt".to_string(),
                clerk_user_id.clone(),
                None,
                None,
                None,
                format!("{:?}", auth.permission).to_lowercase(),
                None,
                None,
            ),
            (AuthSource::ApiKey, _) => (
                "api_key".to_string(),
                auth.id.to_string(),
                None,
                None,
                None,
                format!("{:?}", auth.permission).to_lowercase(),
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
        permission: auth.permission,
        site_id: auth.site_id,
        auth_method,
        created_at,
        last_sign_in_at,
        memberships,
        is_system_admin,
    }
}

/// Get the full profile of the authenticated user.
///
/// For Clerk users, includes Clerk profile data (email, name, avatar, timestamps).
/// For API key users, returns permission and key info.
#[utoipa::path(
    tag = "Auth",
    operation_id = "get_auth_profile",
    description = "Return the full profile of the authenticated user",
    security(("api_key" = []), ("bearer_auth" = [])),
    responses(
        (status = 200, description = "User profile", body = ProfileResponse),
        (status = 401, description = "Missing or invalid credentials")
    )
)]
#[get("/auth/profile")]
pub async fn get_profile(
    auth: AuthenticatedKey,
    state: &rocket::State<AppState>,
) -> Result<Json<ProfileResponse>, crate::errors::ApiError> {
    let (clerk_user, memberships, is_system_admin) = match &auth.auth_source {
        AuthSource::ClerkJwt { clerk_user_id } => {
            let user = if let Some(ref clerk) = state.clerk_service {
                Some(clerk.get_user(clerk_user_id).await?)
            } else {
                None
            };
            let memberships = fetch_memberships(state.inner(), clerk_user_id).await?;
            let is_admin = SiteMembership::is_system_admin(&state.db, clerk_user_id).await?;
            (user, Some(memberships), Some(is_admin))
        }
        AuthSource::ApiKey => (None, None, None),
    };

    Ok(Json(build_profile(
        &auth,
        clerk_user.as_ref(),
        memberships,
        is_system_admin,
    )))
}

/// Export all data associated with the authenticated user.
///
/// Returns profile info, audit logs, API keys, change history, and memberships.
/// Intended for GDPR data portability compliance.
#[utoipa::path(
    tag = "Auth",
    operation_id = "export_user_data",
    description = "Export all data associated with the authenticated user (GDPR data portability)",
    security(("api_key" = []), ("bearer_auth" = [])),
    responses(
        (status = 200, description = "User data export", body = UserDataExportResponse),
        (status = 401, description = "Missing or invalid credentials")
    )
)]
#[get("/auth/export")]
pub async fn export_user_data(
    auth: AuthenticatedKey,
    state: &rocket::State<AppState>,
) -> Result<Json<UserDataExportResponse>, crate::errors::ApiError> {
    // Build profile
    let (clerk_user, memberships, is_system_admin) = match &auth.auth_source {
        AuthSource::ClerkJwt { clerk_user_id } => {
            let user = if let Some(ref clerk) = state.clerk_service {
                Some(clerk.get_user(clerk_user_id).await?)
            } else {
                None
            };
            let memberships = fetch_memberships(state.inner(), clerk_user_id).await?;
            let is_admin = SiteMembership::is_system_admin(&state.db, clerk_user_id).await?;
            (user, Some(memberships.clone()), Some(is_admin))
        }
        AuthSource::ApiKey => (None, None, None),
    };
    let profile = build_profile(
        &auth,
        clerk_user.as_ref(),
        memberships.clone(),
        is_system_admin,
    );

    // Fetch audit logs for this user (limit 1000)
    let audit_logs: Vec<AuditLogResponse> = AuditLog::find_for_user(&state.db, auth.id, 1000, 0)
        .await?
        .into_iter()
        .map(AuditLogResponse::from)
        .collect();

    // Fetch API keys owned by or created by this user
    let api_keys: Vec<ExportApiKeyRecord> = sqlx::query_as::<
        _,
        (
            uuid::Uuid,
            String,
            crate::models::api_key::ApiKeyPermission,
            Option<uuid::Uuid>,
            crate::models::api_key::ApiKeyStatus,
            DateTime<Utc>,
        ),
    >(
        r#"
        SELECT id, name, permission, site_id, status, created_at
        FROM api_keys
        WHERE user_id = $1 OR created_by = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(auth.id)
    .fetch_all(&state.db)
    .await?
    .into_iter()
    .map(
        |(id, name, permission, site_id, status, created_at)| ExportApiKeyRecord {
            id,
            name,
            permission,
            site_id,
            status: format!("{:?}", status),
            created_at,
        },
    )
    .collect();

    // Fetch change history entries by this user (limit 1000)
    let change_history: Vec<ChangeHistoryResponse> = sqlx::query_as::<_, ChangeHistory>(
        r#"
        SELECT id, site_id, entity_type, entity_id, field_name,
               old_value, new_value, changed_by, changed_at
        FROM change_history
        WHERE changed_by = $1
        ORDER BY changed_at DESC
        LIMIT 1000
        "#,
    )
    .bind(auth.id)
    .fetch_all(&state.db)
    .await?
    .into_iter()
    .map(ChangeHistoryResponse::from)
    .collect();

    Ok(Json(UserDataExportResponse {
        profile,
        audit_logs,
        api_keys,
        change_history,
        memberships,
        exported_at: Utc::now(),
    }))
}

/// Delete the authenticated user's account.
///
/// For Clerk users: blocks if user is sole owner of any site. Deletes memberships,
/// then the Clerk user, and cleans up CMS references.
/// For API key users: returns 400 (account deletion only available for Clerk users).
#[utoipa::path(
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
#[delete("/auth/account")]
pub async fn delete_account(
    auth: AuthenticatedKey,
    state: &rocket::State<AppState>,
) -> Result<Status, crate::errors::ApiError> {
    let clerk_user_id = match &auth.auth_source {
        AuthSource::ClerkJwt { clerk_user_id } => clerk_user_id.clone(),
        AuthSource::ApiKey => {
            return Err(crate::errors::ApiError::BadRequest(
                "Account deletion is only available for Clerk-authenticated users".to_string(),
            ));
        }
    };

    // Block deletion if user is sole owner of any site
    let owned_sites = SiteMembership::find_owned_sites(&state.db, &clerk_user_id).await?;
    for site_id in &owned_sites {
        let has_other =
            SiteMembership::site_has_other_owner(&state.db, *site_id, &clerk_user_id).await?;
        if !has_other {
            return Err(crate::errors::ApiError::Conflict(
                format!(
                    "You are the sole owner of site {}. Transfer ownership before deleting your account.",
                    site_id
                ),
            ));
        }
    }

    let clerk = state.clerk_service.as_ref().ok_or_else(|| {
        crate::errors::ApiError::Internal("Clerk service not configured".to_string())
    })?;

    // Delete the user from Clerk
    clerk.delete_user(&clerk_user_id).await?;

    // Delete all memberships
    SiteMembership::delete_all_for_clerk_user(&state.db, &clerk_user_id).await?;

    // Remove from system_admins
    sqlx::query("DELETE FROM system_admins WHERE clerk_user_id = $1")
        .bind(&clerk_user_id)
        .execute(&state.db)
        .await?;

    // Clean up associated CMS data: nullify user references
    let user_uuid = auth.id;

    sqlx::query("UPDATE api_keys SET user_id = NULL WHERE user_id = $1")
        .bind(user_uuid)
        .execute(&state.db)
        .await?;

    sqlx::query("UPDATE api_keys SET created_by = NULL WHERE created_by = $1")
        .bind(user_uuid)
        .execute(&state.db)
        .await?;

    sqlx::query("UPDATE audit_logs SET user_id = NULL WHERE user_id = $1")
        .bind(user_uuid)
        .execute(&state.db)
        .await?;

    sqlx::query("UPDATE change_history SET changed_by = NULL WHERE changed_by = $1")
        .bind(user_uuid)
        .execute(&state.db)
        .await?;

    Ok(Status::NoContent)
}

/// Collect auth routes
pub fn routes() -> Vec<Route> {
    routes![get_me, get_profile, export_user_data, delete_account]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::guards::auth_guard::AuthSource;
    use crate::models::api_key::ApiKeyPermission;

    // --- epoch_millis_to_datetime ---

    #[test]
    fn epoch_millis_known_timestamp() {
        // 2025-01-15 12:00:00 UTC = 1736942400000 ms
        let dt = epoch_millis_to_datetime(1736942400000);
        assert_eq!(
            dt.format("%Y-%m-%d %H:%M:%S").to_string(),
            "2025-01-15 12:00:00"
        );
    }

    #[test]
    fn epoch_millis_zero_returns_epoch() {
        let dt = epoch_millis_to_datetime(0);
        assert_eq!(dt, DateTime::<Utc>::default());
    }

    #[test]
    fn epoch_millis_negative_graceful() {
        // Negative timestamps should either produce a valid date or the default
        let dt = epoch_millis_to_datetime(-1000);
        // Should not panic; -1000ms = 1969-12-31T23:59:59Z
        assert!(dt.timestamp() <= 0);
    }

    // --- build_profile ---

    #[test]
    fn build_profile_api_key_source() {
        let auth = AuthenticatedKey {
            id: uuid::Uuid::new_v4(),
            permission: ApiKeyPermission::Write,
            site_id: Some(uuid::Uuid::new_v4()),
            auth_source: AuthSource::ApiKey,
        };
        let profile = build_profile(&auth, None, None, None);
        assert_eq!(profile.auth_method, "api_key");
        assert_eq!(profile.role, "write");
        assert!(profile.email.is_none());
        assert!(profile.name.is_none());
    }

    #[test]
    fn build_profile_clerk_jwt_no_clerk_user() {
        let auth = AuthenticatedKey {
            id: uuid::Uuid::new_v4(),
            permission: ApiKeyPermission::Read,
            site_id: None,
            auth_source: AuthSource::ClerkJwt {
                clerk_user_id: "user_test123".to_string(),
            },
        };
        let profile = build_profile(&auth, None, None, None);
        assert_eq!(profile.auth_method, "clerk_jwt");
        assert_eq!(profile.id, "user_test123");
        assert!(profile.email.is_none());
        assert!(profile.name.is_none());
        assert_eq!(profile.role, "read");
    }
}
