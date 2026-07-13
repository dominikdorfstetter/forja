-- First-class legal-document references on navigation items
-- (consumer-feedback roadmap §4).
--
-- Nav items previously faked legal links as free-text external_url
-- ('/legal/{cookie_name}'), which 404s whenever cookie_name diverges from
-- the resolver's contents.slug. A real FK survives renames and purges.

ALTER TABLE navigation_items
    ADD COLUMN legal_document_id UUID REFERENCES legal_documents(id) ON DELETE SET NULL;

CREATE INDEX idx_navigation_items_legal_doc
    ON navigation_items(legal_document_id)
 WHERE legal_document_id IS NOT NULL;

-- Items may now carry ZERO link targets: a page purge or legal-document
-- purge (both ON DELETE SET NULL) must never fail a CHECK re-evaluation.
-- Exactly-one-of-three moves fully into the write path (validate_link);
-- the public tree query filters target-less items, the admin list shows
-- them as broken links to repair.
ALTER TABLE navigation_items DROP CONSTRAINT chk_nav_target;

-- Convert wizard-era free-text links: '/legal/{x}' where x matches a
-- same-site legal chain-root's slug (or its cookie_name, which the old
-- wizard embedded) becomes a first-class reference. Slug matches win over
-- cookie_name matches. Unmatched '/legal/…' URLs were already broken
-- (404) — count them and leave them untouched.
DO $$
DECLARE
    r RECORD;
    root_id UUID;
    converted INTEGER := 0;
    leftovers INTEGER;
BEGIN
    FOR r IN
        SELECT ni.id, ni.site_id, substring(ni.external_url FROM 8) AS target
        FROM navigation_items ni
        WHERE ni.external_url LIKE '/legal/%'
    LOOP
        SELECT ld.id INTO root_id
        FROM legal_documents ld
        INNER JOIN contents c ON c.id = ld.content_id
        INNER JOIN content_sites cs ON cs.content_id = c.id
        WHERE cs.site_id = r.site_id
          AND ld.parent_version_id IS NULL
          AND ld.is_deleted = FALSE
          AND (c.slug = r.target OR ld.cookie_name = r.target)
        ORDER BY (c.slug = r.target) DESC, ld.created_at
        LIMIT 1;

        IF root_id IS NOT NULL THEN
            UPDATE navigation_items
            SET legal_document_id = root_id,
                external_url = NULL,
                updated_at = NOW()
            WHERE id = r.id;
            converted := converted + 1;
        END IF;
    END LOOP;

    SELECT COUNT(*) INTO leftovers
    FROM navigation_items
    WHERE external_url LIKE '/legal/%';

    RAISE NOTICE 'navigation_items: % /legal/… link(s) converted to legal_document_id, % unconverted (no matching same-site legal document — already broken) left untouched',
        converted, leftovers;
END $$;
