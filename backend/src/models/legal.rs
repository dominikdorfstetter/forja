//! Legal model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::legal::{
    CreateLegalDocumentRequest, CreateLegalGroupRequest, CreateLegalItemRequest,
    UpdateLegalDocumentRequest, UpdateLegalGroupRequest, UpdateLegalItemRequest,
};
use crate::errors::ApiError;
use crate::services::content_service::ContentService;

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

/// Legal document model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LegalDocument {
    pub id: Uuid,
    pub content_id: Option<Uuid>,
    pub cookie_name: String,
    pub document_type: LegalDocType,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Legal document localization
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LegalDocumentLocalization {
    pub id: Uuid,
    pub legal_document_id: Uuid,
    pub locale_id: Uuid,
    pub title: String,
    pub intro: Option<String>,
}

impl LegalDocumentLocalization {
    /// Find all localizations for a legal document
    pub async fn find_for_document(
        pool: &PgPool,
        document_id: Uuid,
    ) -> Result<Vec<Self>, ApiError> {
        let localizations = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, legal_document_id, locale_id, title, intro
            FROM legal_document_localizations
            WHERE legal_document_id = $1
            "#,
        )
        .bind(document_id)
        .fetch_all(pool)
        .await?;

        Ok(localizations)
    }
}

/// Legal group (consent group)
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

/// Legal item (individual consent item)
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LegalItem {
    pub id: Uuid,
    pub legal_group_id: Uuid,
    pub cookie_name: String,
    pub display_order: i16,
    pub is_required: bool,
    pub created_at: DateTime<Utc>,
}

impl LegalDocument {
    /// Count legal documents for a site
    pub async fn count_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM legal_documents ld INNER JOIN contents c ON ld.content_id = c.id INNER JOIN content_sites cs ON c.id = cs.content_id WHERE cs.site_id = $1 AND c.is_deleted = FALSE"
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;
        Ok(row.0)
    }

    /// Find all legal documents for a site
    pub async fn find_all_for_site(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Self>, ApiError> {
        let documents = sqlx::query_as::<_, Self>(
            r#"
            SELECT ld.id, ld.content_id, ld.cookie_name, ld.document_type,
                   ld.created_at, ld.updated_at
            FROM legal_documents ld
            INNER JOIN contents c ON ld.content_id = c.id
            INNER JOIN content_sites cs ON c.id = cs.content_id
            WHERE cs.site_id = $1 AND c.is_deleted = FALSE
            ORDER BY ld.document_type ASC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(site_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok(documents)
    }

    /// Find legal document by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let document = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, content_id, cookie_name, document_type, created_at, updated_at
            FROM legal_documents
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Legal document with ID {} not found", id)))?;

        Ok(document)
    }

    /// Find legal document by type for a site
    pub async fn find_by_type_for_site(
        pool: &PgPool,
        site_id: Uuid,
        doc_type: LegalDocType,
    ) -> Result<Self, ApiError> {
        let document = sqlx::query_as::<_, Self>(
            r#"
            SELECT ld.id, ld.content_id, ld.cookie_name, ld.document_type,
                   ld.created_at, ld.updated_at
            FROM legal_documents ld
            INNER JOIN contents c ON ld.content_id = c.id
            INNER JOIN content_sites cs ON c.id = cs.content_id
            WHERE cs.site_id = $1 AND ld.document_type = $2 AND c.is_deleted = FALSE
            "#,
        )
        .bind(site_id)
        .bind(doc_type)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound("Legal document not found".to_string()))?;

        Ok(document)
    }

    /// Find legal document by content slug for a site
    pub async fn find_by_slug_for_site(
        pool: &PgPool,
        site_id: Uuid,
        slug: &str,
    ) -> Result<Self, ApiError> {
        let document = sqlx::query_as::<_, Self>(
            r#"
            SELECT ld.id, ld.content_id, ld.cookie_name, ld.document_type,
                   ld.created_at, ld.updated_at
            FROM legal_documents ld
            INNER JOIN contents c ON ld.content_id = c.id
            INNER JOIN content_sites cs ON c.id = cs.content_id
            WHERE cs.site_id = $1 AND c.slug = $2 AND c.is_deleted = FALSE
            "#,
        )
        .bind(site_id)
        .bind(slug)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::NotFound(format!("Legal document with slug '{}' not found", slug))
        })?;

        Ok(document)
    }

    /// Create a legal document with associated content
    pub async fn create(pool: &PgPool, req: CreateLegalDocumentRequest) -> Result<Self, ApiError> {
        let content_id = ContentService::create_content(
            pool,
            "legal",
            None,
            &req.status,
            &req.site_ids,
            None,
            None,
        )
        .await?;

        let document = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO legal_documents (content_id, cookie_name, document_type)
            VALUES ($1, $2, $3)
            RETURNING id, content_id, cookie_name, document_type, created_at, updated_at
            "#,
        )
        .bind(content_id)
        .bind(&req.cookie_name)
        .bind(&req.document_type)
        .fetch_one(pool)
        .await?;

        Ok(document)
    }

    /// Update a legal document
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdateLegalDocumentRequest,
    ) -> Result<Self, ApiError> {
        let existing = Self::find_by_id(pool, id).await?;

        if let Some(content_id) = existing.content_id {
            ContentService::update_content(pool, content_id, None, req.status.as_ref(), None, None)
                .await?;
        }

        let document = sqlx::query_as::<_, Self>(
            r#"
            UPDATE legal_documents
            SET cookie_name = COALESCE($2, cookie_name),
                document_type = COALESCE($3, document_type),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, content_id, cookie_name, document_type, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&req.cookie_name)
        .bind(&req.document_type)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Legal document with ID {} not found", id)))?;

        Ok(document)
    }

    /// Soft delete a legal document (via content)
    pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let doc = Self::find_by_id(pool, id).await?;
        if let Some(content_id) = doc.content_id {
            ContentService::soft_delete_content(pool, content_id).await
        } else {
            Err(ApiError::BadRequest(
                "Legal document has no content_id".to_string(),
            ))
        }
    }
}

impl LegalGroup {
    /// Find groups for a document
    pub async fn find_for_document(
        pool: &PgPool,
        document_id: Uuid,
    ) -> Result<Vec<Self>, ApiError> {
        let groups = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, legal_document_id, cookie_name, display_order,
                   is_required, default_enabled, created_at
            FROM legal_groups
            WHERE legal_document_id = $1
            ORDER BY display_order ASC
            "#,
        )
        .bind(document_id)
        .fetch_all(pool)
        .await?;

        Ok(groups)
    }

    /// Find group by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let group = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, legal_document_id, cookie_name, display_order,
                   is_required, default_enabled, created_at
            FROM legal_groups
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Legal group with ID {} not found", id)))?;

        Ok(group)
    }

    /// Create a legal group
    pub async fn create(
        pool: &PgPool,
        document_id: Uuid,
        req: CreateLegalGroupRequest,
    ) -> Result<Self, ApiError> {
        let group = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO legal_groups (legal_document_id, cookie_name, display_order, is_required, default_enabled)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, legal_document_id, cookie_name, display_order, is_required, default_enabled, created_at
            "#,
        )
        .bind(document_id)
        .bind(&req.cookie_name)
        .bind(req.display_order)
        .bind(req.is_required)
        .bind(req.default_enabled)
        .fetch_one(pool)
        .await?;

        Ok(group)
    }

    /// Update a legal group
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdateLegalGroupRequest,
    ) -> Result<Self, ApiError> {
        let group = sqlx::query_as::<_, Self>(
            r#"
            UPDATE legal_groups
            SET cookie_name = COALESCE($2, cookie_name),
                display_order = COALESCE($3, display_order),
                is_required = COALESCE($4, is_required),
                default_enabled = COALESCE($5, default_enabled)
            WHERE id = $1
            RETURNING id, legal_document_id, cookie_name, display_order, is_required, default_enabled, created_at
            "#,
        )
        .bind(id)
        .bind(&req.cookie_name)
        .bind(req.display_order)
        .bind(req.is_required)
        .bind(req.default_enabled)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Legal group with ID {} not found", id)))?;

        Ok(group)
    }

    /// Delete a legal group (hard delete, cascades to items)
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM legal_groups WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!(
                "Legal group with ID {} not found",
                id
            )));
        }

        Ok(())
    }
}

impl LegalItem {
    /// Find items for a group
    pub async fn find_for_group(pool: &PgPool, group_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let items = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, legal_group_id, cookie_name, display_order, is_required, created_at
            FROM legal_items
            WHERE legal_group_id = $1
            ORDER BY display_order ASC
            "#,
        )
        .bind(group_id)
        .fetch_all(pool)
        .await?;

        Ok(items)
    }

    /// Find item by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let item = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, legal_group_id, cookie_name, display_order, is_required, created_at
            FROM legal_items
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Legal item with ID {} not found", id)))?;

        Ok(item)
    }

    /// Create a legal item
    pub async fn create(
        pool: &PgPool,
        group_id: Uuid,
        req: CreateLegalItemRequest,
    ) -> Result<Self, ApiError> {
        let item = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO legal_items (legal_group_id, cookie_name, display_order, is_required)
            VALUES ($1, $2, $3, $4)
            RETURNING id, legal_group_id, cookie_name, display_order, is_required, created_at
            "#,
        )
        .bind(group_id)
        .bind(&req.cookie_name)
        .bind(req.display_order)
        .bind(req.is_required)
        .fetch_one(pool)
        .await?;

        Ok(item)
    }

    /// Update a legal item
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdateLegalItemRequest,
    ) -> Result<Self, ApiError> {
        let item = sqlx::query_as::<_, Self>(
            r#"
            UPDATE legal_items
            SET cookie_name = COALESCE($2, cookie_name),
                display_order = COALESCE($3, display_order),
                is_required = COALESCE($4, is_required)
            WHERE id = $1
            RETURNING id, legal_group_id, cookie_name, display_order, is_required, created_at
            "#,
        )
        .bind(id)
        .bind(&req.cookie_name)
        .bind(req.display_order)
        .bind(req.is_required)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Legal item with ID {} not found", id)))?;

        Ok(item)
    }

    /// Delete a legal item (hard delete)
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM legal_items WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!(
                "Legal item with ID {} not found",
                id
            )));
        }

        Ok(())
    }
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
