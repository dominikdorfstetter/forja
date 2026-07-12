//! Legal repositories: SQL for `LegalDocument`, `LegalDocumentLocalization`,
//! `LegalGroup`, and `LegalItem`. Phase 2 of #520.

use sqlx::{PgConnection, PgExecutor, PgPool};
use uuid::Uuid;

use crate::dto::legal::{
    CreateLegalDocumentRequest, CreateLegalGroupRequest, CreateLegalItemRequest,
    UpdateLegalDocumentRequest, UpdateLegalGroupRequest, UpdateLegalItemRequest,
};
use crate::errors::ApiError;
use crate::errors::codes;
use crate::models::content::{Content, ContentLocalization, ContentStatus};
use crate::models::legal::{
    LegalDocType, LegalDocument, LegalDocumentLocalization, LegalDocumentWithContent, LegalGroup,
    LegalItem,
};
use crate::repos::content_query::ContentQuery;
use crate::services::content_service::ContentService;
use crate::utils::list_params::ListParams;

/// Columns the legal-document list free-text search scans, aliased for
/// `ContentQuery` (entity table = `e`). Hard-coded — never user input.
const LEGAL_SEARCH_COLUMNS: &[&str] = &["e.cookie_name"];

/// Repository for `LegalDocument` SQL queries.
pub struct LegalDocumentRepo;

impl LegalDocumentRepo {
    pub async fn count_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        ContentQuery::new("legal_documents", site_id)
            .use_entity_soft_delete()
            .count_only(pool)
            .await
    }

    pub async fn count_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        search: Option<&str>,
    ) -> Result<i64, ApiError> {
        // legal_documents tracks soft-delete on its own table, so opt into
        // .use_entity_soft_delete() (e.is_deleted, not c.is_deleted).
        let mut query = ContentQuery::new("legal_documents", site_id).use_entity_soft_delete();
        if let Some(s) = search {
            query = query.with_search(LEGAL_SEARCH_COLUMNS, s);
        }
        query.count_only(pool).await
    }

    pub async fn find_all_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        params: &ListParams,
    ) -> Result<Vec<LegalDocumentWithContent>, ApiError> {
        let (limit, offset) = params.limit_offset();
        let order_col = match params.sort.field_or("created_at") {
            "created_at" => "e.created_at",
            "updated_at" => "e.updated_at",
            "document_type" => "e.document_type",
            _ => "e.created_at",
        };

        let mut query = ContentQuery::new("legal_documents", site_id)
            .use_entity_soft_delete()
            .order_by_dir(order_col, params.sort.sort_dir.as_deref())
            .paginate(limit, offset);
        if let Some(s) = params.search_ref() {
            query = query.with_search(LEGAL_SEARCH_COLUMNS, s);
        }

        let (rows, _) = query.execute::<LegalDocumentWithContent>(pool).await?;
        Ok(rows)
    }

    pub async fn find_published_for_site(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<LegalDocument>, ApiError> {
        let (rows, _) = ContentQuery::new("legal_documents", site_id)
            .use_entity_soft_delete()
            .published_only()
            .order_by("e.document_type ASC")
            .paginate(limit, offset)
            .execute::<LegalDocument>(pool)
            .await?;
        Ok(rows)
    }

    pub async fn find_all_for_site(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<LegalDocument>, ApiError> {
        let (rows, _) = ContentQuery::new("legal_documents", site_id)
            .use_entity_soft_delete()
            .order_by("e.document_type ASC")
            .paginate(limit, offset)
            .execute::<LegalDocument>(pool)
            .await?;
        Ok(rows)
    }

    /// Generic over the executor so create/update can build their return
    /// value on a `&mut *tx` mid-transaction (#863); normal callers pass
    /// `&PgPool`.
    pub async fn find_by_id<'e, E>(executor: E, id: Uuid) -> Result<LegalDocument, ApiError>
    where
        E: PgExecutor<'e>,
    {
        let document = sqlx::query_as::<_, LegalDocument>(
            r#"
            SELECT id, content_id, cookie_name, document_type,
                   version, parent_version_id,
                   created_at, updated_at, is_deleted, deleted_at
            FROM legal_documents
            WHERE id = $1 AND is_deleted = FALSE
            "#,
        )
        .bind(id)
        .fetch_optional(executor)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Legal document with ID {} not found", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("legal_doc")
        })?;

        Ok(document)
    }

    pub async fn resolve_site_id(pool: &PgPool, id: Uuid) -> Result<Uuid, ApiError> {
        let doc = Self::find_by_id(pool, id).await?;
        let content_id = doc
            .content_id
            .ok_or_else(|| ApiError::bad_request("Legal document has no content_id"))?;
        let site_ids = Content::find_site_ids(pool, content_id).await?;
        site_ids
            .into_iter()
            .next()
            .ok_or_else(|| ApiError::bad_request("Legal document is not associated with any site"))
    }

    pub async fn find_by_type_for_site(
        pool: &PgPool,
        site_id: Uuid,
        doc_type: LegalDocType,
    ) -> Result<LegalDocument, ApiError> {
        let document = sqlx::query_as::<_, LegalDocument>(
            r#"
            SELECT ld.id, ld.content_id, ld.cookie_name, ld.document_type,
                   ld.version, ld.parent_version_id,
                   ld.created_at, ld.updated_at, ld.is_deleted, ld.deleted_at
            FROM legal_documents ld
            INNER JOIN contents c ON ld.content_id = c.id
            INNER JOIN content_sites cs ON c.id = cs.content_id
            WHERE cs.site_id = $1 AND ld.document_type = $2 AND ld.is_deleted = FALSE
            "#,
        )
        .bind(site_id)
        .bind(doc_type)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found("Legal document not found")
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("legal_doc")
        })?;

        Ok(document)
    }

    pub async fn find_by_slug_for_site(
        pool: &PgPool,
        site_id: Uuid,
        slug: &str,
    ) -> Result<LegalDocument, ApiError> {
        let document = sqlx::query_as::<_, LegalDocument>(
            r#"
            SELECT ld.id, ld.content_id, ld.cookie_name, ld.document_type,
                   ld.version, ld.parent_version_id,
                   ld.created_at, ld.updated_at, ld.is_deleted, ld.deleted_at
            FROM legal_documents ld
            INNER JOIN contents c ON ld.content_id = c.id
            INNER JOIN content_sites cs ON c.id = cs.content_id
            WHERE cs.site_id = $1 AND c.slug = $2 AND ld.is_deleted = FALSE
            "#,
        )
        .bind(site_id)
        .bind(slug)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Legal document with slug '{}' not found", slug))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("legal_doc")
        })?;

        Ok(document)
    }

    /// Create a legal document + spine row atomically on the caller's tx
    /// connection (#863).
    pub async fn create(
        conn: &mut PgConnection,
        req: CreateLegalDocumentRequest,
        created_by: Option<&str>,
    ) -> Result<LegalDocument, ApiError> {
        let content_id = ContentService::create_content(
            &mut *conn,
            "legal_document",
            None,
            &req.status,
            &req.site_ids,
            None,
            None,
            created_by,
        )
        .await?;

        let document = sqlx::query_as::<_, LegalDocument>(
            r#"
            INSERT INTO legal_documents (content_id, cookie_name, document_type)
            VALUES ($1, $2, $3)
            RETURNING id, content_id, cookie_name, document_type,
                      version, parent_version_id,
                      created_at, updated_at, is_deleted, deleted_at
            "#,
        )
        .bind(content_id)
        .bind(&req.cookie_name)
        .bind(&req.document_type)
        .fetch_one(&mut *conn)
        .await?;

        Ok(document)
    }

    /// Update a legal document + spine row atomically on the caller's tx
    /// connection (#863).
    pub async fn update(
        conn: &mut PgConnection,
        id: Uuid,
        req: UpdateLegalDocumentRequest,
    ) -> Result<LegalDocument, ApiError> {
        let existing = Self::find_by_id(&mut *conn, id).await?;

        if let Some(content_id) = existing.content_id {
            ContentService::update_content(
                &mut *conn,
                content_id,
                None,
                req.status.as_ref(),
                None,
                None,
            )
            .await?;
        }

        let document = sqlx::query_as::<_, LegalDocument>(
            r#"
            UPDATE legal_documents
            SET cookie_name = COALESCE($2, cookie_name),
                document_type = COALESCE($3, document_type),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, content_id, cookie_name, document_type,
                      version, parent_version_id,
                      created_at, updated_at, is_deleted, deleted_at
            "#,
        )
        .bind(id)
        .bind(&req.cookie_name)
        .bind(&req.document_type)
        .fetch_optional(&mut *conn)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Legal document with ID {} not found", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("legal_doc")
        })?;

        Ok(document)
    }

    pub async fn soft_delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query(
            r#"
            UPDATE legal_documents
            SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW()
            WHERE id = $1 AND is_deleted = FALSE
            "#,
        )
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(
                ApiError::not_found(format!("Legal document with ID {} not found", id))
                    .with_code(codes::ENTITY_NOT_FOUND)
                    .with_entity_type("legal_doc"),
            );
        }

        Ok(())
    }

    pub async fn restore(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query(
            r#"
            UPDATE legal_documents
            SET is_deleted = FALSE, deleted_at = NULL, updated_at = NOW()
            WHERE id = $1 AND is_deleted = TRUE
            "#,
        )
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::not_found(format!(
                "Legal document with ID {} not found or not deleted",
                id
            ))
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type("legal_doc"));
        }

        Ok(())
    }

    pub async fn permanent_delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let doc = sqlx::query_as::<_, (Option<Uuid>,)>(
            "SELECT content_id FROM legal_documents WHERE id = $1 AND is_deleted = TRUE",
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Legal document with ID {} not found in trash", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("legal_doc")
        })?;

        sqlx::query("DELETE FROM legal_documents WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if let Some(content_id) = doc.0 {
            let _ = sqlx::query("DELETE FROM contents WHERE id = $1")
                .bind(content_id)
                .execute(pool)
                .await;
        }

        Ok(())
    }

    pub async fn find_deleted_by_id(pool: &PgPool, id: Uuid) -> Result<LegalDocument, ApiError> {
        sqlx::query_as::<_, LegalDocument>(
            r#"
            SELECT id, content_id, cookie_name, document_type,
                   version, parent_version_id,
                   created_at, updated_at, is_deleted, deleted_at
            FROM legal_documents
            WHERE id = $1 AND is_deleted = TRUE
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Legal document with ID {} not found in trash", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("legal_doc")
        })
    }

    pub async fn resolve_site_id_any(pool: &PgPool, id: Uuid) -> Result<Uuid, ApiError> {
        let row = sqlx::query_as::<_, (Uuid,)>(
            r#"
            SELECT cs.site_id
            FROM legal_documents ld
            INNER JOIN contents c ON ld.content_id = c.id
            INNER JOIN content_sites cs ON c.id = cs.content_id
            WHERE ld.id = $1
            LIMIT 1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!(
                "Legal document with ID {} has no site association",
                id
            ))
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type("legal_doc")
        })?;

        Ok(row.0)
    }

    pub async fn clone_document(
        pool: &PgPool,
        source_id: Uuid,
        site_ids: Vec<Uuid>,
        created_by: Option<&str>,
    ) -> Result<LegalDocument, ApiError> {
        let source = Self::find_by_id(pool, source_id).await?;
        let source_content_id = source
            .content_id
            .ok_or_else(|| ApiError::bad_request("Source document has no content_id"))?;

        let new_cookie = format!("{}_copy", source.cookie_name);

        // Clone is outside #863's create/update scope; preserve its prior
        // semantics (spine row atomic on its own) by committing the spine
        // insert in a short-lived tx before the entity insert.
        let content_id = {
            let mut tx = pool.begin().await?;
            let cid = ContentService::create_content(
                &mut tx,
                "legal_document",
                None,
                &ContentStatus::Draft,
                &site_ids,
                None,
                None,
                created_by,
            )
            .await?;
            tx.commit().await?;
            cid
        };

        let document = sqlx::query_as::<_, LegalDocument>(
            r#"
            INSERT INTO legal_documents (content_id, cookie_name, document_type)
            VALUES ($1, $2, $3)
            RETURNING id, content_id, cookie_name, document_type,
                      version, parent_version_id,
                      created_at, updated_at, is_deleted, deleted_at
            "#,
        )
        .bind(content_id)
        .bind(&new_cookie)
        .bind(&source.document_type)
        .fetch_one(pool)
        .await?;

        let localizations =
            ContentLocalization::find_all_for_content(pool, source_content_id).await?;
        for loc in &localizations {
            ContentLocalization::create(
                pool,
                content_id,
                loc.locale_id,
                &loc.title,
                loc.subtitle.as_deref(),
                loc.excerpt.as_deref(),
                loc.body.as_deref(),
                loc.meta_title.as_deref(),
                loc.meta_description.as_deref(),
            )
            .await?;
        }

        let groups = LegalGroupRepo::find_for_document(pool, source_id).await?;
        for group in &groups {
            let new_group = sqlx::query_as::<_, LegalGroup>(
                r#"
                INSERT INTO legal_groups (legal_document_id, cookie_name, display_order, is_required, default_enabled)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, legal_document_id, cookie_name, display_order, is_required, default_enabled, created_at
                "#,
            )
            .bind(document.id)
            .bind(&group.cookie_name)
            .bind(group.display_order)
            .bind(group.is_required)
            .bind(group.default_enabled)
            .fetch_one(pool)
            .await?;

            let items = LegalItemRepo::find_for_group(pool, group.id).await?;
            for item in &items {
                sqlx::query(
                    "INSERT INTO legal_items (legal_group_id, cookie_name, display_order, is_required) VALUES ($1, $2, $3, $4)",
                )
                .bind(new_group.id)
                .bind(&item.cookie_name)
                .bind(item.display_order)
                .bind(item.is_required)
                .execute(pool)
                .await?;
            }

            let group_locs =
                LegalDocumentLocalizationRepo::find_for_document(pool, group.id).await?;
            for loc in &group_locs {
                sqlx::query(
                    "INSERT INTO legal_document_localizations (legal_document_id, locale_id, title, intro) VALUES ($1, $2, $3, $4)",
                )
                .bind(new_group.id)
                .bind(loc.locale_id)
                .bind(&loc.title)
                .bind(&loc.intro)
                .execute(pool)
                .await?;
            }
        }

        Ok(document)
    }

    pub async fn find_versions(pool: &PgPool, id: Uuid) -> Result<Vec<LegalDocument>, ApiError> {
        let doc = Self::find_by_id(pool, id).await?;
        let mut root_id = doc.id;
        let mut current = doc;
        while let Some(parent_id) = current.parent_version_id {
            current = Self::find_by_id(pool, parent_id).await?;
            root_id = current.id;
        }
        let versions: Vec<LegalDocument> = sqlx::query_as(
            r#"
            WITH RECURSIVE version_chain AS (
                SELECT id, content_id, cookie_name, document_type, version, parent_version_id,
                       created_at, updated_at, is_deleted, deleted_at
                FROM legal_documents
                WHERE id = $1 AND is_deleted = FALSE
                UNION ALL
                SELECT ld.id, ld.content_id, ld.cookie_name, ld.document_type, ld.version, ld.parent_version_id,
                       ld.created_at, ld.updated_at, ld.is_deleted, ld.deleted_at
                FROM legal_documents ld
                INNER JOIN version_chain vc ON ld.parent_version_id = vc.id
                WHERE ld.is_deleted = FALSE
            )
            SELECT id, content_id, cookie_name, document_type, version, parent_version_id,
                   created_at, updated_at, is_deleted, deleted_at
            FROM version_chain ORDER BY version DESC
            "#,
        )
        .bind(root_id)
        .fetch_all(pool)
        .await?;
        Ok(versions)
    }

    pub async fn create_new_version(
        pool: &PgPool,
        source_id: Uuid,
        site_ids: Vec<Uuid>,
        created_by: Option<&str>,
    ) -> Result<LegalDocument, ApiError> {
        let source = Self::find_by_id(pool, source_id).await?;
        if source.is_deleted {
            return Err(
                ApiError::not_found("Cannot create version from deleted document")
                    .with_code(codes::LEGAL_VERSION_SOURCE_DELETED),
            );
        }
        let mut new_doc = Self::clone_document(pool, source_id, site_ids, created_by).await?;
        let next_version = source.version + 1;
        sqlx::query(
            "UPDATE legal_documents SET version = $1, parent_version_id = $2 WHERE id = $3",
        )
        .bind(next_version)
        .bind(source_id)
        .bind(new_doc.id)
        .execute(pool)
        .await?;
        new_doc.version = next_version;
        new_doc.parent_version_id = Some(source_id);
        Ok(new_doc)
    }
}

/// Repository for `LegalDocumentLocalization`.
pub struct LegalDocumentLocalizationRepo;

impl LegalDocumentLocalizationRepo {
    pub async fn find_for_document(
        pool: &PgPool,
        document_id: Uuid,
    ) -> Result<Vec<LegalDocumentLocalization>, ApiError> {
        let localizations = sqlx::query_as::<_, LegalDocumentLocalization>(
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

/// Repository for `LegalGroup`.
pub struct LegalGroupRepo;

impl LegalGroupRepo {
    pub async fn find_for_document(
        pool: &PgPool,
        document_id: Uuid,
    ) -> Result<Vec<LegalGroup>, ApiError> {
        let groups = sqlx::query_as::<_, LegalGroup>(
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

    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<LegalGroup, ApiError> {
        let group = sqlx::query_as::<_, LegalGroup>(
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
        .ok_or_else(|| {
            ApiError::not_found(format!("Legal group with ID {} not found", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("legal_group")
        })?;

        Ok(group)
    }

    pub async fn create(
        pool: &PgPool,
        document_id: Uuid,
        req: CreateLegalGroupRequest,
    ) -> Result<LegalGroup, ApiError> {
        let group = sqlx::query_as::<_, LegalGroup>(
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

    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdateLegalGroupRequest,
    ) -> Result<LegalGroup, ApiError> {
        let group = sqlx::query_as::<_, LegalGroup>(
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
        .ok_or_else(|| ApiError::not_found(format!("Legal group with ID {} not found", id)).with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("legal_group"))?;

        Ok(group)
    }

    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM legal_groups WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(
                ApiError::not_found(format!("Legal group with ID {} not found", id))
                    .with_code(codes::ENTITY_NOT_FOUND)
                    .with_entity_type("legal_group"),
            );
        }

        Ok(())
    }
}

/// Repository for `LegalItem`.
pub struct LegalItemRepo;

impl LegalItemRepo {
    pub async fn find_for_group(pool: &PgPool, group_id: Uuid) -> Result<Vec<LegalItem>, ApiError> {
        let items = sqlx::query_as::<_, LegalItem>(
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

    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<LegalItem, ApiError> {
        let item = sqlx::query_as::<_, LegalItem>(
            r#"
            SELECT id, legal_group_id, cookie_name, display_order, is_required, created_at
            FROM legal_items
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Legal item with ID {} not found", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("legal_item")
        })?;

        Ok(item)
    }

    pub async fn create(
        pool: &PgPool,
        group_id: Uuid,
        req: CreateLegalItemRequest,
    ) -> Result<LegalItem, ApiError> {
        let item = sqlx::query_as::<_, LegalItem>(
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

    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdateLegalItemRequest,
    ) -> Result<LegalItem, ApiError> {
        let item = sqlx::query_as::<_, LegalItem>(
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
        .ok_or_else(|| {
            ApiError::not_found(format!("Legal item with ID {} not found", id))
                .with_code(codes::ENTITY_NOT_FOUND)
                .with_entity_type("legal_item")
        })?;

        Ok(item)
    }

    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM legal_items WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(
                ApiError::not_found(format!("Legal item with ID {} not found", id))
                    .with_code(codes::ENTITY_NOT_FOUND)
                    .with_entity_type("legal_item"),
            );
        }

        Ok(())
    }
}
