//! Trash repository: the per-site list + count queries for soft-deleted
//! items, unioned across every entity type that participates in Trash.
//!
//! Extracted from `axum_app::handlers::trash` so the union can be tested
//! against a real database without standing up the full HTTP + auth stack.
//! `services::trash_service` owns permission resolution + audit for the
//! restore / permanent-delete paths; this repo owns the read SQL.
//!
//! Entity-id contract: blog/page/legal/social/menu/menu_item/media/document
//! return their own primary key; **project** and **cv_entry** return their
//! *content id* (so restore routes through `ContentService::restore_content`),
//! while **skill** returns its own `skills.id`.

use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::trash::TrashItem;
use crate::errors::ApiError;

pub struct TrashRepo;

impl TrashRepo {
    /// List one bounded page of soft-deleted items for a site, newest-deleted
    /// first. `limit`/`offset` bound the outer query over the UNION so the full
    /// result set is never materialized; pair with [`TrashRepo::count`] for the
    /// total. A site reset (#714) can dump an entire site's content into trash,
    /// so this is a real memory edge, not a theoretical one.
    pub async fn list(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<TrashItem>, ApiError> {
        let items = sqlx::query_as::<_, TrashItem>(
            r#"
            SELECT id, entity_type, title, slug, deleted_at, site_id
            FROM (
                SELECT c.id, et.name AS entity_type,
                       cl.title,
                       c.slug, c.deleted_at, cs.site_id
                FROM contents c
                INNER JOIN content_sites cs ON c.id = cs.content_id
                INNER JOIN entity_types et ON c.entity_type_id = et.id
                LEFT JOIN LATERAL (
                    SELECT title FROM content_localizations
                    WHERE content_id = c.id
                    ORDER BY created_at ASC
                    LIMIT 1
                ) cl ON TRUE
                WHERE cs.site_id = $1 AND c.is_deleted = TRUE
                  AND et.name IN ('blog', 'page')

                UNION ALL

                -- Portfolio projects (content spine, title from project_localizations).
                SELECT c.id, 'project' AS entity_type,
                       COALESCE(pl.title, c.slug) AS title,
                       c.slug, c.deleted_at, cs.site_id
                FROM projects p
                INNER JOIN contents c ON p.content_id = c.id
                INNER JOIN content_sites cs ON c.id = cs.content_id
                LEFT JOIN LATERAL (
                    SELECT title FROM project_localizations
                    WHERE project_id = p.id
                    ORDER BY locale_id ASC
                    LIMIT 1
                ) pl ON TRUE
                WHERE cs.site_id = $1 AND c.is_deleted = TRUE

                UNION ALL

                -- CV entries (content spine; no slug, title from company).
                SELECT c.id, 'cv_entry' AS entity_type,
                       e.company AS title,
                       NULL AS slug,
                       c.deleted_at, cs.site_id
                FROM cv_entries e
                INNER JOIN contents c ON e.content_id = c.id
                INNER JOIN content_sites cs ON c.id = cs.content_id
                WHERE cs.site_id = $1 AND c.is_deleted = TRUE

                UNION ALL

                SELECT m.id, 'media' AS entity_type,
                       m.original_filename AS title,
                       m.filename AS slug,
                       m.deleted_at, ms.site_id
                FROM media_files m
                INNER JOIN media_sites ms ON m.id = ms.media_file_id
                WHERE ms.site_id = $1 AND m.is_deleted = TRUE

                UNION ALL

                SELECT d.id, 'document' AS entity_type,
                       COALESCE(dl.name, d.file_name, d.url) AS title,
                       d.file_name AS slug,
                       d.deleted_at, d.site_id
                FROM documents d
                LEFT JOIN LATERAL (
                    SELECT name FROM document_localizations
                    WHERE document_id = d.id
                    ORDER BY created_at ASC
                    LIMIT 1
                ) dl ON TRUE
                WHERE d.site_id = $1 AND d.is_deleted = TRUE

                UNION ALL

                SELECT ld.id, 'legal' AS entity_type,
                       COALESCE(ldl.title, ld.cookie_name) AS title,
                       ld.cookie_name AS slug,
                       ld.deleted_at, cs.site_id
                FROM legal_documents ld
                INNER JOIN contents c ON ld.content_id = c.id
                INNER JOIN content_sites cs ON c.id = cs.content_id
                LEFT JOIN LATERAL (
                    SELECT title FROM legal_document_localizations
                    WHERE legal_document_id = ld.id
                    LIMIT 1
                ) ldl ON TRUE
                WHERE cs.site_id = $1 AND ld.is_deleted = TRUE

                UNION ALL

                SELECT sl.id, 'social' AS entity_type,
                       sl.title,
                       sl.url AS slug,
                       sl.deleted_at, sl.site_id
                FROM social_links sl
                WHERE sl.site_id = $1 AND sl.is_deleted = TRUE

                UNION ALL

                SELECT nm.id, 'menu' AS entity_type,
                       COALESCE(nml.name, nm.slug) AS title,
                       nm.slug,
                       nm.deleted_at, nm.site_id
                FROM navigation_menus nm
                LEFT JOIN LATERAL (
                    SELECT name FROM navigation_menu_localizations
                    WHERE navigation_menu_id = nm.id
                    LIMIT 1
                ) nml ON TRUE
                WHERE nm.site_id = $1 AND nm.is_deleted = TRUE

                UNION ALL

                SELECT ni.id, 'menu_item' AS entity_type,
                       COALESCE(nil.title, ni.external_url, ni.icon) AS title,
                       NULL AS slug,
                       ni.deleted_at, ni.site_id
                FROM navigation_items ni
                INNER JOIN navigation_menus nm ON nm.id = ni.menu_id
                LEFT JOIN LATERAL (
                    SELECT title FROM navigation_item_localizations
                    WHERE navigation_item_id = ni.id
                    LIMIT 1
                ) nil ON TRUE
                WHERE ni.site_id = $1 AND ni.is_deleted = TRUE AND nm.is_deleted = FALSE

                UNION ALL

                -- Skills (own table; reusable across sites via skill_sites).
                SELECT s.id, 'skill' AS entity_type,
                       s.name AS title,
                       s.slug,
                       s.deleted_at, ss.site_id
                FROM skills s
                INNER JOIN skill_sites ss ON s.id = ss.skill_id
                WHERE ss.site_id = $1 AND s.is_deleted = TRUE
            ) AS trash_items
            ORDER BY deleted_at DESC NULLS LAST
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(site_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok(items)
    }

    /// Count every soft-deleted item for a site (sidebar badge).
    pub async fn count(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as(
            r#"
            SELECT (
                (SELECT COUNT(*)
                 FROM contents c
                 INNER JOIN content_sites cs ON c.id = cs.content_id
                 INNER JOIN entity_types et ON c.entity_type_id = et.id
                 WHERE cs.site_id = $1 AND c.is_deleted = TRUE
                   AND et.name IN ('blog', 'page'))
                +
                (SELECT COUNT(*)
                 FROM projects p
                 INNER JOIN contents c ON p.content_id = c.id
                 INNER JOIN content_sites cs ON c.id = cs.content_id
                 WHERE cs.site_id = $1 AND c.is_deleted = TRUE)
                +
                (SELECT COUNT(*)
                 FROM cv_entries e
                 INNER JOIN contents c ON e.content_id = c.id
                 INNER JOIN content_sites cs ON c.id = cs.content_id
                 WHERE cs.site_id = $1 AND c.is_deleted = TRUE)
                +
                (SELECT COUNT(*)
                 FROM media_files m
                 INNER JOIN media_sites ms ON m.id = ms.media_file_id
                 WHERE ms.site_id = $1 AND m.is_deleted = TRUE)
                +
                (SELECT COUNT(*)
                 FROM documents
                 WHERE site_id = $1 AND is_deleted = TRUE)
                +
                (SELECT COUNT(*)
                 FROM legal_documents ld
                 INNER JOIN contents c ON ld.content_id = c.id
                 INNER JOIN content_sites cs ON c.id = cs.content_id
                 WHERE cs.site_id = $1 AND ld.is_deleted = TRUE)
                +
                (SELECT COUNT(*)
                 FROM social_links
                 WHERE site_id = $1 AND is_deleted = TRUE)
                +
                (SELECT COUNT(*)
                 FROM navigation_menus
                 WHERE site_id = $1 AND is_deleted = TRUE)
                +
                (SELECT COUNT(*)
                 FROM navigation_items ni
                 INNER JOIN navigation_menus nm ON nm.id = ni.menu_id
                 WHERE ni.site_id = $1 AND ni.is_deleted = TRUE AND nm.is_deleted = FALSE)
                +
                (SELECT COUNT(*)
                 FROM skills s
                 INNER JOIN skill_sites ss ON s.id = ss.skill_id
                 WHERE ss.site_id = $1 AND s.is_deleted = TRUE)
            )
            "#,
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;

        Ok(row.0)
    }
}
