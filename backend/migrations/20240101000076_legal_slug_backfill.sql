-- Legal slug canonicalization (consumer-feedback roadmap §4, prerequisite).
--
-- Admin-created legal documents were inserted with a NULL contents.slug
-- (the repo passed slug=None), making them unreachable via the public
-- /legal/{slug} resolver. Backfill every version-chain ROOT
-- (parent_version_id IS NULL) that lacks a slug with the kebab-cased
-- document_type (privacy_policy → privacy-policy); on a per-site collision,
-- suffix with the kebab-cased cookie_name, then a short id fragment as a
-- last resort. Only roots need slugs — by-slug resolution walks the chain
-- from the root (legal_repo::find_by_slug_for_site), and version clones
-- keep their NULL slug.
--
-- Per-site uniqueness follows the #762 join-table mechanism: the root slug
-- is mirrored into content_sites.site_specific_slug, where the partial
-- unique index idx_content_sites_site_slug (migration 70) enforces
-- (site_id, slug) uniqueness at the database level. Rows whose slug would
-- collide on a shared site keep a NULL site_specific_slug (pre-existing
-- condition; the write-path check still guards new mutations).

DO $$
DECLARE
    r RECORD;
    candidate TEXT;
    fallback TEXT;
BEGIN
    FOR r IN
        SELECT ld.id, ld.content_id, ld.cookie_name,
               ld.document_type::text AS doc_type, c.slug
        FROM legal_documents ld
        INNER JOIN contents c ON c.id = ld.content_id
        WHERE ld.parent_version_id IS NULL
          AND ld.is_deleted = FALSE
        ORDER BY ld.created_at, ld.id
    LOOP
        candidate := r.slug;

        IF candidate IS NULL THEN
            candidate := replace(r.doc_type, '_', '-');

            IF EXISTS (
                SELECT 1
                FROM content_sites my
                INNER JOIN content_sites other
                    ON other.site_id = my.site_id
                   AND other.content_id <> my.content_id
                INNER JOIN contents oc ON oc.id = other.content_id
                WHERE my.content_id = r.content_id
                  AND ((oc.slug = candidate AND oc.is_deleted = FALSE)
                       OR other.site_specific_slug = candidate)
            ) THEN
                fallback := trim(both '-' from
                    regexp_replace(lower(r.cookie_name), '[^a-z0-9]+', '-', 'g'));
                candidate := candidate || '-' || fallback;
            END IF;

            IF EXISTS (
                SELECT 1
                FROM content_sites my
                INNER JOIN content_sites other
                    ON other.site_id = my.site_id
                   AND other.content_id <> my.content_id
                INNER JOIN contents oc ON oc.id = other.content_id
                WHERE my.content_id = r.content_id
                  AND ((oc.slug = candidate AND oc.is_deleted = FALSE)
                       OR other.site_specific_slug = candidate)
            ) THEN
                candidate := candidate || '-' || left(r.id::text, 8);
            END IF;

            UPDATE contents
            SET slug = candidate, updated_at = NOW()
            WHERE id = r.content_id;
        END IF;

        UPDATE content_sites cs
        SET site_specific_slug = candidate
        WHERE cs.content_id = r.content_id
          AND cs.site_specific_slug IS NULL
          AND NOT EXISTS (
                SELECT 1 FROM content_sites cs2
                WHERE cs2.site_id = cs.site_id
                  AND cs2.site_specific_slug = candidate
                  AND cs2.content_id <> cs.content_id
          );
    END LOOP;
END $$;
