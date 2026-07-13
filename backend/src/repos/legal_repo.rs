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
use crate::utils::slugify;

/// Columns the legal-document list free-text search scans, aliased for
/// `ContentQuery` (entity table = `e`). Hard-coded — never user input.
const LEGAL_SEARCH_COLUMNS: &[&str] = &["e.cookie_name"];

/// House-style conflict for a per-site legal slug collision.
fn slug_taken_error(slug: &str) -> ApiError {
    ApiError::conflict(format!(
        "A document with slug '{slug}' already exists on this site"
    ))
    .with_code(codes::ENTITY_SLUG_TAKEN)
    .with_entity_type("legal_doc")
}

/// True when `e` is a Postgres unique violation on the named constraint.
fn is_unique_violation(e: &sqlx::Error, constraint: &str) -> bool {
    matches!(
        e,
        sqlx::Error::Database(db)
            if db.code().as_deref() == Some("23505")
                && db.constraint() == Some(constraint)
    )
}

/// Map a legal document type — accepted either as the API PascalCase name
/// (`"CookieConsent"`) or as the Postgres enum text (`"cookie_consent"`) — to
/// the canonical enum text. Returns `None` for unrecognised values so
/// `ContentQuery` can reject them as a 400 at execute time.
fn normalize_legal_doc_type(raw: &str) -> Option<&'static str> {
    match raw {
        "CookieConsent" | "cookie_consent" => Some("cookie_consent"),
        "PrivacyPolicy" | "privacy_policy" => Some("privacy_policy"),
        "TermsOfService" | "terms_of_service" => Some("terms_of_service"),
        "Imprint" | "imprint" => Some("imprint"),
        "Disclaimer" | "disclaimer" => Some("disclaimer"),
        _ => None,
    }
}

/// Filters accepted by the legal-document admin list (and its count). Bundled
/// so the list and count paths can't drift apart — both go through
/// [`apply_legal_filters`], mirroring `apply_blog_filters`.
#[derive(Debug, Default, Clone, Copy)]
pub struct LegalListFilters<'a> {
    pub search: Option<&'a str>,
    pub status: Option<&'a str>,
    pub exclude_status: Option<&'a str>,
    pub exclude_document_type: Option<&'a str>,
}

/// Apply the shared legal list filters (search, status, exclude-status,
/// exclude-document-type) onto a `ContentQuery`. Status and document-type
/// values arrive as the API value and are normalized inside `ContentQuery` at
/// execute time. Shared by the list and count paths so both stay in lock-step.
fn apply_legal_filters(mut query: ContentQuery, filters: LegalListFilters<'_>) -> ContentQuery {
    if let Some(s) = filters.search {
        query = query.with_search(LEGAL_SEARCH_COLUMNS, s);
    }
    if let Some(s) = filters.status {
        query = query.with_status([s]);
    }
    if let Some(s) = filters.exclude_status {
        query = query.exclude_status(s);
    }
    if let Some(t) = filters.exclude_document_type {
        query =
            query.exclude_entity_filter_norm("e.document_type::text", t, normalize_legal_doc_type);
    }
    query
}

/// Repository for `LegalDocument` SQL queries.
pub struct LegalDocumentRepo;

impl LegalDocumentRepo {
    pub async fn count_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        ContentQuery::new("legal_documents", site_id)
            .use_entity_soft_delete()
            .count_only(pool)
            .await
    }

    /// Count legal documents for a site with the admin list filters applied.
    ///
    /// Shares filter assembly with [`Self::find_all_for_site_filtered`] via
    /// [`apply_legal_filters`], so the count always matches the listed rows.
    pub async fn count_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        filters: LegalListFilters<'_>,
    ) -> Result<i64, ApiError> {
        // legal_documents tracks soft-delete on its own table, so opt into
        // .use_entity_soft_delete() (e.is_deleted, not c.is_deleted).
        let query = apply_legal_filters(
            ContentQuery::new("legal_documents", site_id).use_entity_soft_delete(),
            filters,
        );
        query.count_only(pool).await
    }

    pub async fn find_all_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        params: &ListParams,
        filters: LegalListFilters<'_>,
    ) -> Result<Vec<LegalDocumentWithContent>, ApiError> {
        let (limit, offset) = params.limit_offset();
        let order_col = match params.sort.field_or("created_at") {
            "created_at" => "e.created_at",
            "updated_at" => "e.updated_at",
            "document_type" => "e.document_type",
            _ => "e.created_at",
        };

        let query = apply_legal_filters(
            ContentQuery::new("legal_documents", site_id)
                .use_entity_soft_delete()
                .order_by_dir(order_col, params.sort.sort_dir.as_deref())
                .paginate(limit, offset),
            filters,
        );

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

    /// Resolve the public legal document for a `(site, slug)` pair.
    ///
    /// The canonical slug lives on the version-chain's original row (new
    /// versions carry a NULL slug). Given that slug owner, this returns the
    /// **currently-published** version in the chain — the highest version
    /// number whose content status is `published` — so publishing a new
    /// version supersedes the old one at the same URL, while the old version
    /// is preserved as history. Falls back to the slug owner itself when no
    /// version in the chain is published (e.g. the document is still a draft).
    pub async fn find_by_slug_for_site(
        pool: &PgPool,
        site_id: Uuid,
        slug: &str,
    ) -> Result<LegalDocument, ApiError> {
        let owner = sqlx::query_as::<_, LegalDocument>(
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

        // Highest-versioned published document in the slug owner's chain.
        let published = sqlx::query_as::<_, LegalDocument>(
            r#"
            WITH RECURSIVE chain AS (
                SELECT id, content_id, cookie_name, document_type, version, parent_version_id,
                       created_at, updated_at, is_deleted, deleted_at
                FROM legal_documents
                WHERE id = $1 AND is_deleted = FALSE
                UNION ALL
                SELECT ld.id, ld.content_id, ld.cookie_name, ld.document_type, ld.version,
                       ld.parent_version_id, ld.created_at, ld.updated_at, ld.is_deleted,
                       ld.deleted_at
                FROM legal_documents ld
                INNER JOIN chain ON ld.parent_version_id = chain.id
                WHERE ld.is_deleted = FALSE
            )
            SELECT chain.id, chain.content_id, chain.cookie_name, chain.document_type,
                   chain.version, chain.parent_version_id,
                   chain.created_at, chain.updated_at, chain.is_deleted, chain.deleted_at
            FROM chain
            INNER JOIN contents c ON chain.content_id = c.id
            WHERE c.status = 'published'
            ORDER BY chain.version DESC
            LIMIT 1
            "#,
        )
        .bind(owner.id)
        .fetch_optional(pool)
        .await?;

        Ok(published.unwrap_or(owner))
    }

    /// Create a legal document + spine row atomically on the caller's tx
    /// connection (#863). The chain root's canonical slug is the request
    /// slug, falling back to the document type's kebab-case default; it is
    /// unique per site and mirrored into `content_sites.site_specific_slug`
    /// (the #762 join-table uniqueness mechanism).
    pub async fn create(
        conn: &mut PgConnection,
        req: CreateLegalDocumentRequest,
        created_by: Option<&str>,
    ) -> Result<LegalDocument, ApiError> {
        let slug = req
            .slug
            .clone()
            .unwrap_or_else(|| req.document_type.default_slug().to_string());
        if slugify::slug_in_use(&mut *conn, &slug, &req.site_ids, None).await? {
            return Err(slug_taken_error(&slug));
        }

        let content_id = ContentService::create_content(
            &mut *conn,
            "legal_document",
            Some(&slug),
            &req.status,
            &req.site_ids,
            None,
            None,
            created_by,
        )
        .await?;
        Self::mirror_site_slug(&mut *conn, content_id, Some(&slug)).await?;

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

    /// Mirror a content's slug into `content_sites.site_specific_slug`, where
    /// the partial unique index from migration 70 enforces per-site
    /// uniqueness at the database level. Maps a lost race on that index to
    /// the same conflict error as the pre-check.
    async fn mirror_site_slug(
        conn: &mut PgConnection,
        content_id: Uuid,
        slug: Option<&str>,
    ) -> Result<(), ApiError> {
        sqlx::query("UPDATE content_sites SET site_specific_slug = $2 WHERE content_id = $1")
            .bind(content_id)
            .bind(slug)
            .execute(conn)
            .await
            .map_err(|e| match slug {
                Some(s) if is_unique_violation(&e, "idx_content_sites_site_slug") => {
                    slug_taken_error(s)
                }
                _ => e.into(),
            })?;
        Ok(())
    }

    /// Walk `parent_version_id` up to the version-chain root. Slug ownership
    /// and by-slug resolution both hang off the root.
    async fn chain_root(conn: &mut PgConnection, id: Uuid) -> Result<LegalDocument, ApiError> {
        let mut root = Self::find_by_id(&mut *conn, id).await?;
        while let Some(parent_id) = root.parent_version_id {
            root = Self::find_by_id(&mut *conn, parent_id).await?;
        }
        Ok(root)
    }

    /// True when any version in the chain rooted at `root_id` has ever been
    /// published (`contents.published_at` survives unpublish, so this is a
    /// permanent property of the chain).
    async fn chain_ever_published(
        conn: &mut PgConnection,
        root_id: Uuid,
    ) -> Result<bool, ApiError> {
        let published: bool = sqlx::query_scalar(
            r#"
            WITH RECURSIVE chain AS (
                SELECT id, content_id, parent_version_id
                FROM legal_documents
                WHERE id = $1
                UNION ALL
                SELECT ld.id, ld.content_id, ld.parent_version_id
                FROM legal_documents ld
                INNER JOIN chain ON ld.parent_version_id = chain.id
            )
            SELECT EXISTS(
                SELECT 1 FROM chain
                INNER JOIN contents c ON c.id = chain.content_id
                WHERE c.published_at IS NOT NULL
            )
            "#,
        )
        .bind(root_id)
        .fetch_one(conn)
        .await?;
        Ok(published)
    }

    /// Move the chain's canonical slug (owned by the root's content row) to
    /// `new_slug`. Allowed only while no version of the chain has ever been
    /// published — published `/legal/{slug}` URLs are permanent.
    async fn set_chain_slug(
        conn: &mut PgConnection,
        id: Uuid,
        new_slug: &str,
    ) -> Result<(), ApiError> {
        let root = Self::chain_root(&mut *conn, id).await?;
        let content_id = root
            .content_id
            .ok_or_else(|| ApiError::bad_request("Legal document has no content_id"))?;

        let current: Option<String> = sqlx::query_scalar("SELECT slug FROM contents WHERE id = $1")
            .bind(content_id)
            .fetch_one(&mut *conn)
            .await?;
        if current.as_deref() == Some(new_slug) {
            return Ok(());
        }

        if Self::chain_ever_published(&mut *conn, root.id).await? {
            return Err(ApiError::conflict(
                "The slug of a legal document is locked once any version has been published",
            )
            .with_code(codes::LEGAL_SLUG_IMMUTABLE)
            .with_entity_type("legal_doc"));
        }

        let site_ids: Vec<Uuid> =
            sqlx::query_scalar("SELECT site_id FROM content_sites WHERE content_id = $1")
                .bind(content_id)
                .fetch_all(&mut *conn)
                .await?;
        if slugify::slug_in_use(&mut *conn, new_slug, &site_ids, Some(content_id)).await? {
            return Err(slug_taken_error(new_slug));
        }

        sqlx::query("UPDATE contents SET slug = $2, updated_at = NOW() WHERE id = $1")
            .bind(content_id)
            .bind(new_slug)
            .execute(&mut *conn)
            .await?;
        Self::mirror_site_slug(&mut *conn, content_id, Some(new_slug)).await
    }

    /// Update a legal document + spine row atomically on the caller's tx
    /// connection (#863).
    pub async fn update(
        conn: &mut PgConnection,
        id: Uuid,
        req: UpdateLegalDocumentRequest,
    ) -> Result<LegalDocument, ApiError> {
        let existing = Self::find_by_id(&mut *conn, id).await?;

        if let Some(new_slug) = req.slug.as_deref() {
            Self::set_chain_slug(&mut *conn, id, new_slug).await?;
        }

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
        let mut tx = pool.begin().await?;

        let result = sqlx::query(
            r#"
            UPDATE legal_documents
            SET is_deleted = FALSE, deleted_at = NULL, updated_at = NOW()
            WHERE id = $1 AND is_deleted = TRUE
            "#,
        )
        .bind(id)
        .execute(&mut *tx)
        .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::not_found(format!(
                "Legal document with ID {} not found or not deleted",
                id
            ))
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type("legal_doc"));
        }

        Self::backfill_chain_root_slug(&mut tx, id).await?;

        tx.commit().await?;
        Ok(())
    }

    /// Give a restored chain whose root has no slug the canonical one it
    /// would have received at create time (migration 076 only backfilled
    /// live roots, and the post-publish immutability guard blocks a manual
    /// rename): document-type kebab, per-site collision → cookie_name
    /// suffix, then an id fragment as a last resort. Mirrors the slug into
    /// `content_sites.site_specific_slug` like every other slug write.
    async fn backfill_chain_root_slug(conn: &mut PgConnection, id: Uuid) -> Result<(), ApiError> {
        let root = sqlx::query_as::<_, (Uuid, Uuid, String, LegalDocType, Option<String>)>(
            r#"
            WITH RECURSIVE chain AS (
                SELECT id, content_id, cookie_name, document_type, parent_version_id
                FROM legal_documents
                WHERE id = $1
                UNION ALL
                SELECT ld.id, ld.content_id, ld.cookie_name, ld.document_type,
                       ld.parent_version_id
                FROM legal_documents ld
                INNER JOIN chain ON chain.parent_version_id = ld.id
            )
            SELECT chain.id, chain.content_id, chain.cookie_name, chain.document_type, c.slug
            FROM chain
            INNER JOIN contents c ON c.id = chain.content_id
            WHERE chain.parent_version_id IS NULL
            "#,
        )
        .bind(id)
        .fetch_optional(&mut *conn)
        .await?;

        let Some((root_id, content_id, cookie_name, document_type, slug)) = root else {
            return Ok(());
        };
        if slug.is_some() {
            return Ok(());
        }

        let site_ids: Vec<Uuid> =
            sqlx::query_scalar("SELECT site_id FROM content_sites WHERE content_id = $1")
                .bind(content_id)
                .fetch_all(&mut *conn)
                .await?;

        let base = document_type.default_slug();
        let mut candidate = base.to_string();
        if slugify::slug_in_use(&mut *conn, &candidate, &site_ids, Some(content_id)).await? {
            let cookie_suffix = slugify::slugify(&cookie_name);
            if !cookie_suffix.is_empty() {
                candidate = format!("{base}-{cookie_suffix}");
            }
        }
        if slugify::slug_in_use(&mut *conn, &candidate, &site_ids, Some(content_id)).await? {
            candidate = format!("{candidate}-{}", &root_id.to_string()[..8]);
        }

        sqlx::query("UPDATE contents SET slug = $2, updated_at = NOW() WHERE id = $1")
            .bind(content_id)
            .bind(&candidate)
            .execute(&mut *conn)
            .await?;
        Self::mirror_site_slug(&mut *conn, content_id, Some(&candidate)).await
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

    /// True when the version chain containing `id` resolves to a chain root
    /// associated with `site_id` (the site-scoped match the migration-77
    /// nav-link conversion used). Soft-deleted versions still count — this
    /// checks site membership, not visibility, so a reference to a trashed
    /// same-site document validates while a cross-site one never does.
    pub async fn chain_root_on_site(
        pool: &PgPool,
        id: Uuid,
        site_id: Uuid,
    ) -> Result<bool, ApiError> {
        let on_site: bool = sqlx::query_scalar(
            r#"
            WITH RECURSIVE chain AS (
                SELECT ld.id, ld.content_id, ld.parent_version_id
                FROM legal_documents ld
                WHERE ld.id = $1
                UNION ALL
                SELECT parent.id, parent.content_id, parent.parent_version_id
                FROM legal_documents parent
                INNER JOIN chain ON chain.parent_version_id = parent.id
            )
            SELECT EXISTS(
                SELECT 1
                FROM chain
                INNER JOIN content_sites cs ON cs.content_id = chain.content_id
                WHERE chain.parent_version_id IS NULL AND cs.site_id = $2
            )
            "#,
        )
        .bind(id)
        .bind(site_id)
        .fetch_one(pool)
        .await?;
        Ok(on_site)
    }

    /// Duplicate a legal document as a *separate* document (the `/clone`
    /// endpoint): the copy takes a distinct `_copy` cookie name, a fresh
    /// `-copy`-suffixed slug (its own chain root), and its own fresh content
    /// row, so it is an independent document — not a version.
    pub async fn clone_document(
        pool: &PgPool,
        source_id: Uuid,
        site_ids: Vec<Uuid>,
        created_by: Option<&str>,
    ) -> Result<LegalDocument, ApiError> {
        let source = Self::find_by_id(pool, source_id).await?;
        let new_cookie = format!("{}_copy", source.cookie_name);

        let mut conn = pool.acquire().await?;
        let root = Self::chain_root(&mut conn, source_id).await?;
        drop(conn);
        let root_slug: Option<String> = match root.content_id {
            Some(cid) => {
                sqlx::query_scalar("SELECT slug FROM contents WHERE id = $1")
                    .bind(cid)
                    .fetch_one(pool)
                    .await?
            }
            None => None,
        };
        let new_slug = match root_slug {
            Some(base) => Some(ContentService::generate_unique_slug(pool, &base, &site_ids).await?),
            None => None,
        };

        Self::clone_document_with_cookie(
            pool, source_id, site_ids, created_by, new_cookie, new_slug,
        )
        .await
    }

    /// Deep-copy a legal document's content, localizations, groups and items
    /// into a new Draft content row under `new_cookie`. Shared by the public
    /// `/clone` (which renames and takes a fresh slug) and version creation
    /// (which preserves the cookie name and passes no slug — versions resolve
    /// through their chain root's slug).
    async fn clone_document_with_cookie(
        pool: &PgPool,
        source_id: Uuid,
        site_ids: Vec<Uuid>,
        created_by: Option<&str>,
        new_cookie: String,
        new_slug: Option<String>,
    ) -> Result<LegalDocument, ApiError> {
        let source = Self::find_by_id(pool, source_id).await?;
        let source_content_id = source
            .content_id
            .ok_or_else(|| ApiError::bad_request("Source document has no content_id"))?;

        // Clone is outside #863's create/update scope; preserve its prior
        // semantics (spine row atomic on its own) by committing the spine
        // insert in a short-lived tx before the entity insert.
        let content_id = {
            let mut tx = pool.begin().await?;
            let cid = ContentService::create_content(
                &mut tx,
                "legal_document",
                new_slug.as_deref(),
                &ContentStatus::Draft,
                &site_ids,
                None,
                None,
                created_by,
            )
            .await?;
            Self::mirror_site_slug(&mut tx, cid, new_slug.as_deref()).await?;
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

    /// True when the legal document's content is currently `Published`.
    /// A published legal document is an immutable record — its text must not
    /// be edited in place; callers fork a new version instead (#140).
    pub async fn is_published(pool: &PgPool, document_id: Uuid) -> Result<bool, ApiError> {
        let published: Option<bool> = sqlx::query_scalar(
            r#"
            SELECT c.status = 'published'
            FROM legal_documents ld
            INNER JOIN contents c ON ld.content_id = c.id
            WHERE ld.id = $1 AND ld.is_deleted = FALSE
            "#,
        )
        .bind(document_id)
        .fetch_optional(pool)
        .await?;
        Ok(published.unwrap_or(false))
    }

    /// Same as [`is_published`], resolved from a content-localization id — the
    /// legal-text edit endpoints are keyed by localization, not document.
    pub async fn is_published_for_localization(
        pool: &PgPool,
        localization_id: Uuid,
    ) -> Result<bool, ApiError> {
        let published: Option<bool> = sqlx::query_scalar(
            r#"
            SELECT c.status = 'published'
            FROM content_localizations cl
            INNER JOIN contents c ON cl.content_id = c.id
            WHERE cl.id = $1
            "#,
        )
        .bind(localization_id)
        .fetch_optional(pool)
        .await?;
        Ok(published.unwrap_or(false))
    }

    /// After a version is published, archive every *other* currently-published
    /// version in the same chain so exactly one version is ever live
    /// ("supersede"). Publishing an older version therefore rolls back — it
    /// becomes live and the newer one is superseded. Returns how many versions
    /// were superseded. The admin's Active list (which excludes Archived) then
    /// shows one row per document; superseded versions remain as history.
    pub async fn supersede_other_published_versions(
        pool: &PgPool,
        published_id: Uuid,
    ) -> Result<u64, ApiError> {
        // Walk to the chain root so the recursive descent covers every version.
        let mut root = Self::find_by_id(pool, published_id).await?;
        while let Some(parent_id) = root.parent_version_id {
            root = Self::find_by_id(pool, parent_id).await?;
        }

        let result = sqlx::query(
            r#"
            WITH RECURSIVE chain AS (
                SELECT id, content_id, parent_version_id
                FROM legal_documents
                WHERE id = $1 AND is_deleted = FALSE
                UNION ALL
                SELECT ld.id, ld.content_id, ld.parent_version_id
                FROM legal_documents ld
                INNER JOIN chain ON ld.parent_version_id = chain.id
                WHERE ld.is_deleted = FALSE
            )
            UPDATE contents
            SET status = 'archived', updated_at = NOW()
            WHERE id IN (SELECT content_id FROM chain WHERE id <> $2)
              AND status = 'published'
            "#,
        )
        .bind(root.id)
        .bind(published_id)
        .execute(pool)
        .await?;

        Ok(result.rows_affected())
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
        // A version preserves the document's identity — same cookie name,
        // no slug of its own (resolution goes through the chain root) —
        // unlike `/clone`, which renames to a distinct `_copy` document.
        let mut new_doc = Self::clone_document_with_cookie(
            pool,
            source_id,
            site_ids,
            created_by,
            source.cookie_name.clone(),
            None,
        )
        .await?;
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
