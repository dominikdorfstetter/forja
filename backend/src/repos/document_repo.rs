//! Document repositories: SQL for `DocumentFolder`, `Document`,
//! `DocumentLocalization`, and `BlogDocument`. Phase 2 of #520.

use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::document::{
    CreateDocumentFolderRequest, CreateDocumentLocalizationRequest, CreateDocumentRequest,
    UpdateDocumentFolderRequest, UpdateDocumentLocalizationRequest, UpdateDocumentRequest,
};
use crate::errors::codes;
use crate::errors::ApiError;
use crate::models::document::{
    BlogDocument, BlogDocumentDetail, Document, DocumentEncryptionMeta, DocumentFolder,
    DocumentLocalization,
};
use crate::utils::list_params::ListParams;

pub struct DocumentFolderRepo;

impl DocumentFolderRepo {
    pub async fn find_all_for_site(
        pool: &PgPool,
        site_id: Uuid,
    ) -> Result<Vec<DocumentFolder>, ApiError> {
        let folders = sqlx::query_as::<_, DocumentFolder>(
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

    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<DocumentFolder, ApiError> {
        let folder = sqlx::query_as::<_, DocumentFolder>(
            r#"
            SELECT id, site_id, parent_id, name, display_order, created_at, updated_at
            FROM document_folders
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Document folder with ID {} not found", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("document_folder")
        })?;

        Ok(folder)
    }

    pub async fn create(
        pool: &PgPool,
        site_id: Uuid,
        req: CreateDocumentFolderRequest,
    ) -> Result<DocumentFolder, ApiError> {
        let folder = sqlx::query_as::<_, DocumentFolder>(
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
    ) -> Result<DocumentFolder, ApiError> {
        let folder = sqlx::query_as::<_, DocumentFolder>(
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
        .ok_or_else(|| {
            ApiError::not_found(format!("Document folder with ID {} not found", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("document_folder")
        })?;

        Ok(folder)
    }

    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM document_folders WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(
                ApiError::not_found(format!("Document folder with ID {} not found", id))
                    .with_code(codes::ENTITY_NOT_FOUND)
                    .with_entity_type("document_folder"),
            );
        }

        Ok(())
    }
}

pub struct DocumentRepo;

impl DocumentRepo {
    pub async fn get_max_file_size(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let val = crate::models::site_settings::SiteSetting::get_value(
            pool,
            site_id,
            crate::models::site_settings::KEY_MAX_DOCUMENT_FILE_SIZE,
        )
        .await?;
        Ok(val.as_i64().unwrap_or(10_485_760))
    }

    pub async fn total_storage_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as(
            r#"
            SELECT COALESCE(SUM(file_size), 0)::BIGINT
            FROM documents
            WHERE site_id = $1 AND is_deleted = FALSE
            "#,
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;

        Ok(row.0)
    }

    pub async fn count_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        folder_id: Option<Uuid>,
        search: Option<&str>,
    ) -> Result<i64, ApiError> {
        let mut where_clauses = vec![
            "d.site_id = $1".to_string(),
            "d.is_deleted = FALSE".to_string(),
        ];
        let mut bind_idx = 2u32;

        if search.is_some() {
            where_clauses.push(format!("d.file_name ILIKE '%' || ${bind_idx} || '%'"));
            bind_idx += 1;
        }

        if folder_id.is_some() {
            where_clauses.push(format!("d.folder_id = ${bind_idx}"));
            bind_idx += 1;
        }
        let _ = bind_idx;

        let sql = format!(
            "SELECT COUNT(*) FROM documents d WHERE {}",
            where_clauses.join(" AND "),
        );

        let mut query = sqlx::query_as::<_, (i64,)>(&sql).bind(site_id);

        if let Some(s) = search {
            query = query.bind(s);
        }
        if let Some(fid) = folder_id {
            query = query.bind(fid);
        }

        let row = query.fetch_one(pool).await?;
        Ok(row.0)
    }

    pub async fn find_all_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        folder_id: Option<Uuid>,
        params: &ListParams,
    ) -> Result<Vec<Document>, ApiError> {
        let (limit, offset) = params.limit_offset();

        let mut where_clauses = vec![
            "d.site_id = $1".to_string(),
            "d.is_deleted = FALSE".to_string(),
        ];
        let mut bind_idx = 4u32;

        if params.search_ref().is_some() {
            where_clauses.push(format!("d.file_name ILIKE '%' || ${bind_idx} || '%'"));
            bind_idx += 1;
        }

        if folder_id.is_some() {
            where_clauses.push(format!("d.folder_id = ${bind_idx}"));
            bind_idx += 1;
        }
        let _ = bind_idx;

        let order_col = match params.sort.field_or("created_at") {
            "file_name" => "d.file_name",
            _ => "d.created_at",
        };

        let sql = format!(
            r#"
            SELECT d.id, d.site_id, d.folder_id, d.url, d.document_type, d.display_order,
                   d.file_name, d.file_size, d.mime_type, d.is_private,
                   d.created_at, d.updated_at,
                   d.private_access_expires_at,
                   d.private_failed_attempt_count,
                   d.private_locked_until
            FROM documents d
            WHERE {}
            ORDER BY {}
            LIMIT $2 OFFSET $3
            "#,
            where_clauses.join(" AND "),
            params.sort.order_clause(order_col),
        );

        let mut query = sqlx::query_as::<_, Document>(&sql)
            .bind(site_id)
            .bind(limit)
            .bind(offset);

        if let Some(s) = params.search_ref() {
            query = query.bind(s);
        }
        if let Some(fid) = folder_id {
            query = query.bind(fid);
        }

        let documents = query.fetch_all(pool).await?;
        Ok(documents)
    }

    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Document, ApiError> {
        let doc = sqlx::query_as::<_, Document>(
            r#"
            SELECT id, site_id, folder_id, url, document_type, display_order,
                   file_name, file_size, mime_type, is_private,
                   created_at, updated_at,
                   private_access_expires_at,
                   private_failed_attempt_count,
                   private_locked_until
            FROM documents
            WHERE id = $1 AND is_deleted = FALSE
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Document with ID {} not found", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("document")
        })?;

        Ok(doc)
    }

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
        .ok_or_else(|| {
            ApiError::not_found(format!("No uploaded file for document {}", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("document")
        })?;

        Ok(row)
    }

    /// Resolve a document's `site_id`, or `None` if the document doesn't exist.
    pub async fn find_site_id(pool: &PgPool, id: Uuid) -> Result<Option<Uuid>, ApiError> {
        let row: Option<(Uuid,)> = sqlx::query_as("SELECT site_id FROM documents WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await?;
        Ok(row.map(|r| r.0))
    }

    /// Resolve the `site_id` of a *trashed* (soft-deleted) document, or `None`.
    pub async fn find_trashed_site_id(pool: &PgPool, id: Uuid) -> Result<Option<Uuid>, ApiError> {
        let row: Option<(Uuid,)> =
            sqlx::query_as("SELECT site_id FROM documents WHERE id = $1 AND is_deleted = TRUE")
                .bind(id)
                .fetch_optional(pool)
                .await?;
        Ok(row.map(|r| r.0))
    }

    pub async fn create(
        pool: &PgPool,
        site_id: Uuid,
        req: &CreateDocumentRequest,
        file_data: Option<Vec<u8>>,
    ) -> Result<Document, ApiError> {
        let doc = sqlx::query_as::<_, Document>(
            r#"
            INSERT INTO documents (site_id, folder_id, url, document_type, display_order,
                                   file_data, file_name, file_size, mime_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, site_id, folder_id, url, document_type, display_order,
                      file_name, file_size, mime_type, is_private,
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
    ) -> Result<Document, ApiError> {
        let doc = if file_data.is_some() {
            sqlx::query_as::<_, Document>(
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
                          file_name, file_size, mime_type, is_private,
                          created_at, updated_at
                "#,
            )
            .bind(id)
            .bind(&req.url)
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
            sqlx::query_as::<_, Document>(
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
                          file_name, file_size, mime_type, is_private,
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
            sqlx::query_as::<_, Document>(
                r#"
                UPDATE documents
                SET url = COALESCE($2, url),
                    document_type = COALESCE($3, document_type),
                    folder_id = COALESCE($4, folder_id),
                    display_order = COALESCE($5, display_order),
                    updated_at = NOW()
                WHERE id = $1
                RETURNING id, site_id, folder_id, url, document_type, display_order,
                          file_name, file_size, mime_type, is_private,
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

        doc.ok_or_else(|| {
            ApiError::not_found(format!("Document with ID {} not found", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("document")
        })
    }

    pub async fn find_encryption_meta(
        pool: &PgPool,
        id: Uuid,
    ) -> Result<Option<DocumentEncryptionMeta>, ApiError> {
        let meta = sqlx::query_as::<_, DocumentEncryptionMeta>(
            r#"
            SELECT is_private, password_hash, encryption_salt, encryption_nonce,
                   encrypted_dek, encryption_key_version,
                   private_access_expires_at, private_failed_attempt_count,
                   private_locked_until
            FROM documents
            WHERE id = $1 AND file_data IS NOT NULL
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;

        Ok(meta)
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn set_privacy(
        pool: &PgPool,
        id: Uuid,
        ciphertext: &[u8],
        password_hash: &str,
        salt: &[u8],
        nonce: &[u8],
        encrypted_dek: Option<&[u8]>,
        key_version: Option<i16>,
        expires_at: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Result<(), ApiError> {
        sqlx::query(
            r#"
            UPDATE documents
            SET file_data = $2,
                is_private = TRUE,
                password_hash = $3,
                encryption_salt = $4,
                encryption_nonce = $5,
                encrypted_dek = $6,
                encryption_key_version = $7,
                private_access_expires_at = $8,
                private_failed_attempt_count = 0,
                private_locked_until = NULL,
                updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(ciphertext)
        .bind(password_hash)
        .bind(salt)
        .bind(nonce)
        .bind(encrypted_dek)
        .bind(key_version)
        .bind(expires_at)
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn remove_privacy(pool: &PgPool, id: Uuid, plaintext: &[u8]) -> Result<(), ApiError> {
        sqlx::query(
            r#"
            UPDATE documents
            SET file_data = $2,
                is_private = FALSE,
                password_hash = NULL,
                encryption_salt = NULL,
                encryption_nonce = NULL,
                encrypted_dek = NULL,
                encryption_key_version = NULL,
                private_access_expires_at = NULL,
                private_failed_attempt_count = 0,
                private_locked_until = NULL,
                updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(plaintext)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Atomically increments the failed-attempt counter and, when the
    /// resulting count is `>= threshold`, sets `private_locked_until` to a
    /// far-future sentinel so the document stays locked until an admin
    /// unlocks it. Returns the new count and whether the row is now
    /// locked, in one round-trip — no read-modify-write race.
    pub async fn record_failed_password_attempt(
        pool: &PgPool,
        id: Uuid,
        threshold: i32,
    ) -> Result<(i32, bool), ApiError> {
        let row: (i32, Option<chrono::DateTime<chrono::Utc>>) = sqlx::query_as(
            r#"
            UPDATE documents
            SET private_failed_attempt_count = private_failed_attempt_count + 1,
                private_locked_until = CASE
                    WHEN private_failed_attempt_count + 1 >= $2
                    THEN TIMESTAMPTZ '9999-12-31 23:59:59+00'
                    ELSE private_locked_until
                END,
                updated_at = NOW()
            WHERE id = $1
            RETURNING private_failed_attempt_count, private_locked_until
            "#,
        )
        .bind(id)
        .bind(threshold)
        .fetch_one(pool)
        .await?;

        Ok((row.0, row.1.is_some()))
    }

    /// Resets the failed-attempt counter to 0. Called after a successful
    /// password verification. Does not touch `private_locked_until` —
    /// once locked, only admin unlock can clear it.
    pub async fn reset_failed_password_attempts(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        sqlx::query(
            r#"
            UPDATE documents
            SET private_failed_attempt_count = 0,
                updated_at = NOW()
            WHERE id = $1
              AND private_failed_attempt_count > 0
            "#,
        )
        .bind(id)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Clears the lockout flag and resets the failed-attempt counter.
    /// Returns true if the row was locked before the call. Used to
    /// distinguish 204 (cleared) from 409 ERR_DOCUMENT_NOT_LOCKED (no-op).
    pub async fn clear_lockout(pool: &PgPool, id: Uuid) -> Result<bool, ApiError> {
        let result = sqlx::query(
            r#"
            UPDATE documents
            SET private_failed_attempt_count = 0,
                private_locked_until = NULL,
                updated_at = NOW()
            WHERE id = $1
              AND private_locked_until IS NOT NULL
            "#,
        )
        .bind(id)
        .execute(pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn update_encrypted_dek(
        pool: &PgPool,
        id: Uuid,
        new_encrypted_dek: &[u8],
        new_key_version: i16,
    ) -> Result<(), ApiError> {
        sqlx::query(
            r#"
            UPDATE documents
            SET encrypted_dek = $2,
                encryption_key_version = $3,
                updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(new_encrypted_dek)
        .bind(new_key_version)
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn count_pending_rotation(
        pool: &PgPool,
        current_version: i16,
    ) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*)
            FROM documents
            WHERE is_private = TRUE
              AND encrypted_dek IS NOT NULL
              AND (encryption_key_version IS NULL OR encryption_key_version < $1)
            "#,
        )
        .bind(current_version)
        .fetch_one(pool)
        .await?;

        Ok(row.0)
    }

    pub async fn find_pending_rotation(
        pool: &PgPool,
        current_version: i16,
        limit: i64,
    ) -> Result<Vec<(Uuid, Vec<u8>)>, ApiError> {
        let rows: Vec<(Uuid, Vec<u8>)> = sqlx::query_as(
            r#"
            SELECT id, encrypted_dek
            FROM documents
            WHERE is_private = TRUE
              AND encrypted_dek IS NOT NULL
              AND (encryption_key_version IS NULL OR encryption_key_version < $1)
            LIMIT $2
            "#,
        )
        .bind(current_version)
        .bind(limit)
        .fetch_all(pool)
        .await?;

        Ok(rows)
    }

    pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query(
            r#"
            UPDATE documents
            SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW()
            WHERE id = $1 AND is_deleted = FALSE
            "#,
        )
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(
                ApiError::not_found(format!("Document with ID {} not found", id))
                    .with_code(codes::ENTITY_NOT_FOUND)
                    .with_entity_type("document"),
            );
        }

        Ok(())
    }

    pub async fn restore(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query(
            r#"
            UPDATE documents
            SET is_deleted = FALSE, deleted_at = NULL, updated_at = NOW()
            WHERE id = $1 AND is_deleted = TRUE
            "#,
        )
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::not_found(format!(
                "Document with ID {} not found or not deleted",
                id
            ))
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type("document"));
        }

        Ok(())
    }

    pub async fn permanent_delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM document_localizations WHERE document_id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        let result = sqlx::query("DELETE FROM documents WHERE id = $1 AND is_deleted = TRUE")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(
                ApiError::not_found(format!("Document with ID {} not found in trash", id))
                    .with_code(codes::ENTITY_NOT_FOUND)
                    .with_entity_type("document"),
            );
        }

        Ok(())
    }
}

pub struct DocumentLocalizationRepo;

impl DocumentLocalizationRepo {
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<DocumentLocalization, ApiError> {
        let loc = sqlx::query_as::<_, DocumentLocalization>(
            r#"
            SELECT id, document_id, locale_id, name, description, created_at, updated_at
            FROM document_localizations
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Document localization with ID {} not found", id))
                .with_code(codes::ENTITY_LOCALIZATION_NOT_FOUND)
                .with_entity_type("document")
        })?;

        Ok(loc)
    }

    pub async fn find_all_for_document(
        pool: &PgPool,
        document_id: Uuid,
    ) -> Result<Vec<DocumentLocalization>, ApiError> {
        let locs = sqlx::query_as::<_, DocumentLocalization>(
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
    ) -> Result<DocumentLocalization, ApiError> {
        let loc = sqlx::query_as::<_, DocumentLocalization>(
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
    ) -> Result<DocumentLocalization, ApiError> {
        let loc = sqlx::query_as::<_, DocumentLocalization>(
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
            ApiError::not_found(format!("Document localization with ID {} not found", id))
                .with_code(codes::ENTITY_LOCALIZATION_NOT_FOUND)
                .with_entity_type("document")
        })?;

        Ok(loc)
    }

    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM document_localizations WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::not_found(format!(
                "Document localization with ID {} not found",
                id
            ))
            .with_code(codes::ENTITY_LOCALIZATION_NOT_FOUND)
            .with_entity_type("document"));
        }

        Ok(())
    }
}

pub struct BlogDocumentRepo;

impl BlogDocumentRepo {
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
    ) -> Result<BlogDocument, ApiError> {
        let bd = sqlx::query_as::<_, BlogDocument>(
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
            return Err(ApiError::not_found("Blog-document association not found"));
        }

        Ok(())
    }
}
