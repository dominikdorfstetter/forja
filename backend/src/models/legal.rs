//! Legal model — pure data structs.
//!
//! All SQL lives in [`repos::legal_repo`](crate::repos::legal_repo).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::content::ContentStatus;

/// Legal document type enum matching PostgreSQL
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, utoipa::ToSchema)]
#[sqlx(type_name = "legal_doc_type", rename_all = "lowercase")]
pub enum LegalDocType {
    #[sqlx(rename = "cookie_consent")]
    CookieConsent,
    #[sqlx(rename = "privacy_policy")]
    PrivacyPolicy,
    #[sqlx(rename = "terms_of_service")]
    TermsOfService,
    Imprint,
    Disclaimer,
}

impl LegalDocType {
    /// Kebab-cased canonical slug derived from the document type — the
    /// default `contents.slug` for a legal chain root when none is given
    /// (e.g. `PrivacyPolicy` → `privacy-policy`).
    pub fn default_slug(&self) -> &'static str {
        match self {
            Self::CookieConsent => "cookie-consent",
            Self::PrivacyPolicy => "privacy-policy",
            Self::TermsOfService => "terms-of-service",
            Self::Imprint => "imprint",
            Self::Disclaimer => "disclaimer",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LegalDocument {
    pub id: Uuid,
    pub content_id: Option<Uuid>,
    pub cookie_name: String,
    pub document_type: LegalDocType,
    pub version: i32,
    pub parent_version_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_deleted: bool,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct LegalDocumentWithContent {
    pub id: Uuid,
    pub content_id: Option<Uuid>,
    pub cookie_name: String,
    pub document_type: LegalDocType,
    pub version: i32,
    pub parent_version_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_deleted: bool,
    pub deleted_at: Option<DateTime<Utc>>,
    pub status: Option<ContentStatus>,
    pub slug: Option<String>,
    pub publish_start: Option<DateTime<Utc>>,
    pub publish_end: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LegalDocumentLocalization {
    pub id: Uuid,
    pub legal_document_id: Uuid,
    pub locale_id: Uuid,
    pub title: String,
    pub intro: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LegalGroup {
    pub id: Uuid,
    pub legal_document_id: Uuid,
    pub cookie_name: String,
    pub display_order: i16,
    pub is_required: bool,
    pub default_enabled: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LegalItem {
    pub id: Uuid,
    pub legal_group_id: Uuid,
    pub cookie_name: String,
    pub display_order: i16,
    pub is_required: bool,
    pub created_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_legal_doc_type_serialization() {
        let doc_type = LegalDocType::PrivacyPolicy;
        let json = serde_json::to_string(&doc_type).unwrap();
        assert_eq!(json, "\"PrivacyPolicy\"");
    }
}
