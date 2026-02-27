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
    pub permission: ApiKeyPermission,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub site_id: Option<Uuid>,
    /// "api_key" or "clerk_jwt"
    pub auth_method: String,
    /// Clerk user ID (only present for Clerk JWT auth)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub clerk_user_id: Option<String>,
    /// Site memberships (only present for Clerk JWT auth)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memberships: Option<Vec<MembershipSummary>>,
    /// Whether the user is a system admin
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_system_admin: Option<bool>,
}

/// Response for GET /auth/profile
#[derive(Debug, Serialize, ToSchema)]
pub struct ProfileResponse {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    pub role: String,
    pub permission: ApiKeyPermission,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub site_id: Option<Uuid>,
    /// "api_key" or "clerk_jwt"
    pub auth_method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_sign_in_at: Option<DateTime<Utc>>,
    /// Site memberships (only present for Clerk JWT auth)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memberships: Option<Vec<MembershipSummary>>,
    /// Whether the user is a system admin
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_system_admin: Option<bool>,
}

/// A single API key record for data export
#[derive(Debug, Serialize, ToSchema)]
pub struct ExportApiKeyRecord {
    pub id: Uuid,
    pub name: String,
    pub permission: ApiKeyPermission,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub site_id: Option<Uuid>,
    pub status: String,
    pub created_at: DateTime<Utc>,
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
    pub exported_at: DateTime<Utc>,
}
