//! Authentication DTOs

use chrono::{DateTime, Utc};
use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::dto::audit::{AuditLogResponse, ChangeHistoryResponse};
use crate::dto::site_membership::MembershipSummary;
use crate::models::api_key::ApiKeyPermission;

/// Response for GET /auth/me
#[derive(Debug, Serialize, ToSchema)]
pub struct AuthInfoResponse {
    #[schema(example = "Read")]
    pub permission: ApiKeyPermission,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "e3a1f5c2-4b8d-4e0a-9c6f-1d2e3f4a5b6c")]
    pub site_id: Option<Uuid>,
    /// "api_key" or "clerk_jwt"
    #[schema(example = "clerk_jwt")]
    pub auth_method: String,
    /// Clerk user ID (only present for Clerk JWT auth)
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "user_2abc123def456")]
    pub clerk_user_id: Option<String>,
    /// Site memberships (only present for Clerk JWT auth)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memberships: Option<Vec<MembershipSummary>>,
    /// Whether the user is a system admin
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = false)]
    pub is_system_admin: Option<bool>,
    /// Whether the server is running in demo mode
    #[schema(example = true)]
    pub demo_mode: bool,
}

/// Response for GET /auth/profile
#[derive(Debug, Serialize, ToSchema)]
pub struct ProfileResponse {
    #[schema(example = "user_2abc123def456")]
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "jane@example.com")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "Jane Doe")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "https://img.clerk.com/abc123")]
    pub image_url: Option<String>,
    #[schema(example = "admin")]
    pub role: String,
    #[schema(example = "Read")]
    pub permission: ApiKeyPermission,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "e3a1f5c2-4b8d-4e0a-9c6f-1d2e3f4a5b6c")]
    pub site_id: Option<Uuid>,
    /// "api_key" or "clerk_jwt"
    #[schema(example = "clerk_jwt")]
    pub auth_method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "2024-01-15T10:30:00Z")]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "2024-06-01T08:00:00Z")]
    pub last_sign_in_at: Option<DateTime<Utc>>,
    /// Site memberships (only present for Clerk JWT auth)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memberships: Option<Vec<MembershipSummary>>,
    /// Whether the user is a system admin
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = false)]
    pub is_system_admin: Option<bool>,
}

/// A single API key record for data export
#[derive(Debug, Serialize, ToSchema)]
pub struct ExportApiKeyRecord {
    #[schema(example = "e3a1f5c2-4b8d-4e0a-9c6f-1d2e3f4a5b6c")]
    pub id: Uuid,
    #[schema(example = "Production API Key")]
    pub name: String,
    #[schema(example = "Read")]
    pub permission: ApiKeyPermission,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "e3a1f5c2-4b8d-4e0a-9c6f-1d2e3f4a5b6c")]
    pub site_id: Option<Uuid>,
    #[schema(example = "active")]
    pub status: String,
    #[schema(example = "2024-01-15T10:30:00Z")]
    pub created_at: DateTime<Utc>,
}

/// Response for GET /auth/guest — demo guest API key
#[derive(Debug, Serialize, ToSchema)]
pub struct GuestTokenResponse {
    /// The randomly-generated guest API key for read-only demo access
    #[schema(example = "dk_a1b2c3d4_e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0")]
    pub api_key: String,
    /// The demo site ID
    #[schema(example = "e3a1f5c2-4b8d-4e0a-9c6f-1d2e3f4a5b6c")]
    pub site_id: String,
    /// The demo site name
    #[schema(example = "John Forja")]
    pub site_name: String,
    /// The demo site slug
    #[schema(example = "john-forja")]
    pub site_slug: String,
}

/// Summary of content authored by the user
#[derive(Debug, Serialize, ToSchema)]
pub struct AuthoredContentSummary {
    pub blogs: i64,
    pub pages: i64,
    pub documents: i64,
    pub legal_docs: i64,
}

/// Response for GET /auth/export — all user-related data
#[derive(Debug, Serialize, ToSchema)]
pub struct UserDataExportResponse {
    pub profile: ProfileResponse,
    pub audit_logs: Vec<AuditLogResponse>,
    pub api_keys: Vec<ExportApiKeyRecord>,
    pub change_history: Vec<ChangeHistoryResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memberships: Option<Vec<MembershipSummary>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preferences: Option<crate::dto::user_preferences::UserPreferencesResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notifications: Option<Vec<crate::dto::notification::NotificationResponse>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub onboarding: Option<crate::dto::onboarding::OnboardingResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub help_state: Option<crate::dto::help_state::HelpStateResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub authored_content: Option<AuthoredContentSummary>,
    #[schema(example = "2024-06-15T12:00:00Z")]
    pub exported_at: DateTime<Utc>,
}
