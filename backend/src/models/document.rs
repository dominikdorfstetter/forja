//! Document models — pure data structs.
//!
//! All SQL lives in [`repos::document_repo`](crate::repos::document_repo).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DocumentFolder {
    pub id: Uuid,
    pub site_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub name: String,
    pub display_order: i16,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Document {
    pub id: Uuid,
    pub site_id: Uuid,
    pub folder_id: Option<Uuid>,
    pub url: Option<String>,
    pub document_type: String,
    pub display_order: i16,
    pub file_name: Option<String>,
    pub file_size: Option<i64>,
    pub mime_type: Option<String>,
    pub is_private: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[sqlx(default)]
    pub private_access_expires_at: Option<DateTime<Utc>>,
    #[sqlx(default)]
    pub private_failed_attempt_count: i32,
    #[sqlx(default)]
    pub private_locked_until: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct DocumentEncryptionMeta {
    pub is_private: bool,
    pub password_hash: Option<String>,
    pub encryption_salt: Option<Vec<u8>>,
    pub encryption_nonce: Option<Vec<u8>>,
    pub encrypted_dek: Option<Vec<u8>>,
    pub encryption_key_version: Option<i16>,
    pub private_access_expires_at: Option<DateTime<Utc>>,
    pub private_failed_attempt_count: i32,
    pub private_locked_until: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DocumentLocalization {
    pub id: Uuid,
    pub document_id: Uuid,
    pub locale_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BlogDocument {
    pub id: Uuid,
    pub blog_id: Uuid,
    pub document_id: Uuid,
    pub display_order: i16,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BlogDocumentDetail {
    pub id: Uuid,
    pub blog_id: Uuid,
    pub document_id: Uuid,
    pub display_order: i16,
    pub url: Option<String>,
    pub document_type: String,
    pub file_name: Option<String>,
    pub has_file: bool,
    pub created_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_document_folder_serialization() {
        let folder = DocumentFolder {
            id: Uuid::new_v4(),
            site_id: Uuid::new_v4(),
            parent_id: None,
            name: "Guides".to_string(),
            display_order: 0,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&folder).unwrap();
        assert!(json.contains("\"name\":\"Guides\""));
    }
}
