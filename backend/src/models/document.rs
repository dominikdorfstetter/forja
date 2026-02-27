//! Document models

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::document::{
    CreateDocumentFolderRequest, CreateDocumentLocalizationRequest, CreateDocumentRequest,
    UpdateDocumentFolderRequest, UpdateDocumentLocalizationRequest, UpdateDocumentRequest,
};
use crate::errors::ApiError;

/// Document folder model
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

impl DocumentFolder {
    pub async fn find_all_for_site(pool: &PgPool, site_id: Uuid) -> Result<Vec<Self>, ApiError> {
        let folders = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, parent_id, name, display_order, created_at, updated_at
            FROM document_folders
            WHERE site_id = $1
            ORDER BY display_order ASC, name ASC
            "#,
        )
        .bind(site_id)
        .fetch_all(pool)
        .await?;

        Ok(folders)
    }

    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let folder = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, parent_id, name, display_order, created_at, updated_at
            FROM document_folders
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Document folder with ID {} not found", id)))?;

        Ok(folder)
    }

    pub async fn create(
        pool: &PgPool,
        site_id: Uuid,
        req: CreateDocumentFolderRequest,
    ) -> Result<Self, ApiError> {
        let folder = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO document_folders (site_id, parent_id, name, display_order)
            VALUES ($1, $2, $3, $4)
            RETURNING id, site_id, parent_id, name, display_order, created_at, updated_at
            "#,
        )
        .bind(site_id)
        .bind(req.parent_id)
        .bind(&req.name)
        .bind(req.display_order)
        .fetch_one(pool)
        .await?;

        Ok(folder)
    }

    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdateDocumentFolderRequest,
    ) -> Result<Self, ApiError> {
        let folder = sqlx::query_as::<_, Self>(
            r#"
            UPDATE document_folders
            SET name = COALESCE($2, name),
                parent_id = COALESCE($3, parent_id),
                display_order = COALESCE($4, display_order),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, site_id, parent_id, name, display_order, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&req.name)
        .bind(req.parent_id)
        .bind(req.display_order)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Document folder with ID {} not found", id)))?;

        Ok(folder)
    }

    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM document_folders WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!(
                "Document folder with ID {} not found",
                id
            )));
        }

        Ok(())
    }
}

/// Document model (excludes file_data to keep list queries lightweight)
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
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Document {
    /// Fetch the per-site max document file size from site_settings.
    /// Falls back to the default (10 MB) if not configured.
    pub async fn get_max_file_size(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let val = crate::models::site_settings::SiteSetting::get_value(
            pool,
            site_id,
            crate::models::site_settings::KEY_MAX_DOCUMENT_FILE_SIZE,
        )
        .await?;
        Ok(val.as_i64().unwrap_or(10_485_760))
    }

    /// Count documents for a site, optionally filtered by folder
    pub async fn count_for_site(
        pool: &PgPool,
        site_id: Uuid,
        folder_id: Option<Uuid>,
    ) -> Result<i64, ApiError> {
        let row: (i64,) = if let Some(fid) = folder_id {
            sqlx::query_as("SELECT COUNT(*) FROM documents WHERE site_id = $1 AND folder_id = $2")
                .bind(site_id)
                .bind(fid)
                .fetch_one(pool)
                .await?
        } else {
            sqlx::query_as("SELECT COUNT(*) FROM documents WHERE site_id = $1")
                .bind(site_id)
                .fetch_one(pool)
                .await?
        };
        Ok(row.0)
    }

    pub async fn find_all_for_site(
        pool: &PgPool,
        site_id: Uuid,
        folder_id: Option<Uuid>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Self>, ApiError> {
        let documents = if let Some(fid) = folder_id {
            sqlx::query_as::<_, Self>(
                r#"
                SELECT id, site_id, folder_id, url, document_type, display_order,
                       file_name, file_size, mime_type,
                       created_at, updated_at
                FROM documents
                WHERE site_id = $1 AND folder_id = $2
                ORDER BY display_order ASC, created_at DESC
                LIMIT $3 OFFSET $4
                "#,
            )
            .bind(site_id)
            .bind(fid)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?
        } else {
            sqlx::query_as::<_, Self>(
                r#"
                SELECT id, site_id, folder_id, url, document_type, display_order,
                       file_name, file_size, mime_type,
                       created_at, updated_at
                FROM documents
                WHERE site_id = $1
                ORDER BY display_order ASC, created_at DESC
                LIMIT $2 OFFSET $3
                "#,
            )
            .bind(site_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?
        };

        Ok(documents)
    }

    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let doc = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, folder_id, url, document_type, display_order,
                   file_name, file_size, mime_type,
                   created_at, updated_at
            FROM documents
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Document with ID {} not found", id)))?;

        Ok(doc)
    }

    /// Fetch the binary file_data, file_name, and mime_type for download
    pub async fn find_file_data(
        pool: &PgPool,
        id: Uuid,
    ) -> Result<(Vec<u8>, String, String), ApiError> {
        let row = sqlx::query_as::<_, (Vec<u8>, String, String)>(
            r#"
            SELECT file_data, file_name, mime_type
            FROM documents
            WHERE id = $1 AND file_data IS NOT NULL
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No uploaded file for document {}", id)))?;

        Ok(row)
    }

    pub async fn create(
        pool: &PgPool,
        site_id: Uuid,
        req: &CreateDocumentRequest,
        file_data: Option<Vec<u8>>,
    ) -> Result<Self, ApiError> {
        let doc = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO documents (site_id, folder_id, url, document_type, display_order,
                                   file_data, file_name, file_size, mime_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, site_id, folder_id, url, document_type, display_order,
                      file_name, file_size, mime_type,
                      created_at, updated_at
            "#,
        )
        .bind(site_id)
        .bind(req.folder_id)
        .bind(&req.url)
        .bind(&req.document_type)
        .bind(req.display_order)
        .bind(file_data.as_deref())
        .bind(&req.file_name)
        .bind(req.file_size)
        .bind(&req.mime_type)
        .fetch_one(pool)
        .await?;

        Ok(doc)
    }

    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: &UpdateDocumentRequest,
        file_data: Option<Vec<u8>>,
        clear_file: bool,
    ) -> Result<Self, ApiError> {
        // If a new file is being uploaded, we set file columns.
        // If clear_file is true (switching to URL mode), we clear file columns.
        // Otherwise, we use COALESCE to keep existing values.
        let doc = if file_data.is_some() {
            // Uploading a new file: clear url, set file columns
            sqlx::query_as::<_, Self>(
                r#"
                UPDATE documents
                SET url = NULL,
                    document_type = COALESCE($3, document_type),
                    folder_id = COALESCE($4, folder_id),
                    display_order = COALESCE($5, display_order),
                    file_data = $6,
                    file_name = $7,
                    file_size = $8,
                    mime_type = $9,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING id, site_id, folder_id, url, document_type, display_order,
                          file_name, file_size, mime_type,
                          created_at, updated_at
                "#,
            )
            .bind(id)
            .bind(&req.url) // $2 unused but keeps param numbering consistent
            .bind(&req.document_type)
            .bind(req.folder_id)
            .bind(req.display_order)
            .bind(file_data.as_deref())
            .bind(&req.file_name)
            .bind(req.file_size)
            .bind(&req.mime_type)
            .fetch_optional(pool)
            .await?
        } else if clear_file {
            // Switching to URL mode: set url, clear file columns
            sqlx::query_as::<_, Self>(
                r#"
                UPDATE documents
                SET url = $2,
                    document_type = COALESCE($3, document_type),
                    folder_id = COALESCE($4, folder_id),
                    display_order = COALESCE($5, display_order),
                    file_data = NULL,
                    file_name = NULL,
                    file_size = NULL,
                    mime_type = NULL,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING id, site_id, folder_id, url, document_type, display_order,
                          file_name, file_size, mime_type,
                          created_at, updated_at
                "#,
            )
            .bind(id)
            .bind(&req.url)
            .bind(&req.document_type)
            .bind(req.folder_id)
            .bind(req.display_order)
            .fetch_optional(pool)
            .await?
        } else {
            // Normal update (no file change)
            sqlx::query_as::<_, Self>(
                r#"
                UPDATE documents
                SET url = COALESCE($2, url),
                    document_type = COALESCE($3, document_type),
                    folder_id = COALESCE($4, folder_id),
                    display_order = COALESCE($5, display_order),
                    updated_at = NOW()
                WHERE id = $1
                RETURNING id, site_id, folder_id, url, document_type, display_order,
                          file_name, file_size, mime_type,
                          created_at, updated_at
                "#,
            )
            .bind(id)
            .bind(&req.url)
            .bind(&req.document_type)
            .bind(req.folder_id)
            .bind(req.display_order)
            .fetch_optional(pool)
            .await?
        };

        doc.ok_or_else(|| ApiError::NotFound(format!("Document with ID {} not found", id)))
    }

    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM documents WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!(
                "Document with ID {} not found",
                id
            )));
        }

        Ok(())
    }
}

/// Document localization model
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

impl DocumentLocalization {
    pub async fn find_all_for_document(
        pool: &PgPool,
        document_id: Uuid,
    ) -> Result<Vec<Self>, ApiError> {
        let locs = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, document_id, locale_id, name, description, created_at, updated_at
            FROM document_localizations
            WHERE document_id = $1
            ORDER BY created_at ASC
            "#,
        )
        .bind(document_id)
        .fetch_all(pool)
        .await?;

        Ok(locs)
    }

    pub async fn create(
        pool: &PgPool,
        document_id: Uuid,
        req: CreateDocumentLocalizationRequest,
    ) -> Result<Self, ApiError> {
        let loc = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO document_localizations (document_id, locale_id, name, description)
            VALUES ($1, $2, $3, $4)
            RETURNING id, document_id, locale_id, name, description, created_at, updated_at
            "#,
        )
        .bind(document_id)
        .bind(req.locale_id)
        .bind(&req.name)
        .bind(&req.description)
        .fetch_one(pool)
        .await?;

        Ok(loc)
    }

    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdateDocumentLocalizationRequest,
    ) -> Result<Self, ApiError> {
        let loc = sqlx::query_as::<_, Self>(
            r#"
            UPDATE document_localizations
            SET name = COALESCE($2, name),
                description = COALESCE($3, description),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, document_id, locale_id, name, description, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&req.name)
        .bind(&req.description)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::NotFound(format!("Document localization with ID {} not found", id))
        })?;

        Ok(loc)
    }

    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM document_localizations WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!(
                "Document localization with ID {} not found",
                id
            )));
        }

        Ok(())
    }
}

/// Blog-Document junction model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BlogDocument {
    pub id: Uuid,
    pub blog_id: Uuid,
    pub document_id: Uuid,
    pub display_order: i16,
    pub created_at: DateTime<Utc>,
}

/// Blog document with full details for API response
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

impl BlogDocument {
    pub async fn find_all_for_blog(
        pool: &PgPool,
        blog_id: Uuid,
    ) -> Result<Vec<BlogDocumentDetail>, ApiError> {
        let docs = sqlx::query_as::<_, BlogDocumentDetail>(
            r#"
            SELECT bd.id, bd.blog_id, bd.document_id, bd.display_order,
                   d.url, d.document_type, d.file_name,
                   (d.file_data IS NOT NULL) AS has_file,
                   bd.created_at
            FROM blog_documents bd
            INNER JOIN documents d ON bd.document_id = d.id
            WHERE bd.blog_id = $1
            ORDER BY bd.display_order ASC
            "#,
        )
        .bind(blog_id)
        .fetch_all(pool)
        .await?;

        Ok(docs)
    }

    pub async fn assign(
        pool: &PgPool,
        blog_id: Uuid,
        document_id: Uuid,
        display_order: i16,
    ) -> Result<Self, ApiError> {
        let bd = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO blog_documents (blog_id, document_id, display_order)
            VALUES ($1, $2, $3)
            RETURNING id, blog_id, document_id, display_order, created_at
            "#,
        )
        .bind(blog_id)
        .bind(document_id)
        .bind(display_order)
        .fetch_one(pool)
        .await?;

        Ok(bd)
    }

    pub async fn unassign(pool: &PgPool, blog_id: Uuid, document_id: Uuid) -> Result<(), ApiError> {
        let result =
            sqlx::query("DELETE FROM blog_documents WHERE blog_id = $1 AND document_id = $2")
                .bind(blog_id)
                .bind(document_id)
                .execute(pool)
                .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(
                "Blog-document association not found".to_string(),
            ));
        }

        Ok(())
    }
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

    #[test]
    fn test_document_serialization_with_url() {
        let doc = Document {
            id: Uuid::new_v4(),
            site_id: Uuid::new_v4(),
            folder_id: None,
            url: Some("https://example.com/doc.pdf".to_string()),
            document_type: "pdf".to_string(),
            display_order: 0,
            file_name: None,
            file_size: None,
            mime_type: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&doc).unwrap();
        assert!(json.contains("\"document_type\":\"pdf\""));
        assert!(json.contains("\"url\":\"https://example.com/doc.pdf\""));
    }

    #[test]
    fn test_document_serialization_with_file() {
        let doc = Document {
            id: Uuid::new_v4(),
            site_id: Uuid::new_v4(),
            folder_id: None,
            url: None,
            document_type: "pdf".to_string(),
            display_order: 0,
            file_name: Some("report.pdf".to_string()),
            file_size: Some(1024),
            mime_type: Some("application/pdf".to_string()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&doc).unwrap();
        assert!(json.contains("\"file_name\":\"report.pdf\""));
        assert!(json.contains("\"file_size\":1024"));
    }
}
