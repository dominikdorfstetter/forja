-- Rescope slug uniqueness from global → per-site for projects, skills, tags,
-- categories. Issue #762.
--
-- Before: slug was UNIQUE across the whole table (or, for categories, UNIQUE
-- per parent_id), which blocked any second tenant from re-using a slug.
-- After: uniqueness is enforced on the *_sites join table over
-- (site_id, site_specific_slug), matching the pattern already established by
-- content_sites and by the forms module (#580).
--
-- Semantic change: soft-deleted entities (is_deleted = TRUE) continue to
-- reserve their slug under the owning site. The previous global indexes used
-- `WHERE NOT is_deleted` to release the namespace on soft-delete; partial
-- indexes on a join table can't express that without a trigger. Hard-delete
-- the row to release the slug.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. projects (mediated by content_sites — already has site_specific_slug)
-- ---------------------------------------------------------------------------

UPDATE content_sites cs
SET site_specific_slug = p.slug
FROM projects p
WHERE cs.content_id = p.content_id
  AND cs.is_owner = TRUE
  AND cs.site_specific_slug IS NULL;

DO $$
DECLARE
    dup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO dup_count FROM (
        SELECT site_id, site_specific_slug
          FROM content_sites
         WHERE site_specific_slug IS NOT NULL
         GROUP BY site_id, site_specific_slug
        HAVING COUNT(*) > 1
    ) d;
    IF dup_count > 0 THEN
        RAISE EXCEPTION
            'content_sites would violate (site_id, site_specific_slug) uniqueness in % groups',
            dup_count;
    END IF;
END $$;

CREATE UNIQUE INDEX idx_content_sites_site_slug
    ON content_sites (site_id, site_specific_slug)
 WHERE site_specific_slug IS NOT NULL;

DROP INDEX idx_projects_slug;

-- ---------------------------------------------------------------------------
-- 2. skills (mediated by skill_sites — site_specific_slug did not exist)
-- ---------------------------------------------------------------------------

ALTER TABLE skill_sites ADD COLUMN site_specific_slug CITEXT;

UPDATE skill_sites ss
SET site_specific_slug = s.slug
FROM skills s
WHERE ss.skill_id = s.id
  AND ss.is_owner = TRUE;

DO $$
DECLARE
    dup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO dup_count FROM (
        SELECT site_id, site_specific_slug
          FROM skill_sites
         WHERE site_specific_slug IS NOT NULL
         GROUP BY site_id, site_specific_slug
        HAVING COUNT(*) > 1
    ) d;
    IF dup_count > 0 THEN
        RAISE EXCEPTION
            'skill_sites would violate (site_id, site_specific_slug) uniqueness in % groups',
            dup_count;
    END IF;
END $$;

CREATE UNIQUE INDEX idx_skill_sites_site_slug
    ON skill_sites (site_id, site_specific_slug)
 WHERE site_specific_slug IS NOT NULL;

ALTER TABLE skills DROP CONSTRAINT skills_slug_key;

-- ---------------------------------------------------------------------------
-- 3. tags (mediated by tag_sites)
-- ---------------------------------------------------------------------------

ALTER TABLE tag_sites ADD COLUMN site_specific_slug CITEXT;

UPDATE tag_sites ts
SET site_specific_slug = t.slug
FROM tags t
WHERE ts.tag_id = t.id
  AND ts.is_owner = TRUE;

DO $$
DECLARE
    dup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO dup_count FROM (
        SELECT site_id, site_specific_slug
          FROM tag_sites
         WHERE site_specific_slug IS NOT NULL
         GROUP BY site_id, site_specific_slug
        HAVING COUNT(*) > 1
    ) d;
    IF dup_count > 0 THEN
        RAISE EXCEPTION
            'tag_sites would violate (site_id, site_specific_slug) uniqueness in % groups',
            dup_count;
    END IF;
END $$;

CREATE UNIQUE INDEX idx_tag_sites_site_slug
    ON tag_sites (site_id, site_specific_slug)
 WHERE site_specific_slug IS NOT NULL;

ALTER TABLE tags DROP CONSTRAINT tags_slug_key;

-- ---------------------------------------------------------------------------
-- 4. categories (mediated by category_sites; previous constraint scoped by
--    parent_id rather than site, so two sites at the same hierarchy level
--    still collided)
-- ---------------------------------------------------------------------------

ALTER TABLE category_sites ADD COLUMN site_specific_slug CITEXT;

UPDATE category_sites cs
SET site_specific_slug = c.slug
FROM categories c
WHERE cs.category_id = c.id
  AND cs.is_owner = TRUE;

DO $$
DECLARE
    dup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO dup_count FROM (
        SELECT site_id, site_specific_slug
          FROM category_sites
         WHERE site_specific_slug IS NOT NULL
         GROUP BY site_id, site_specific_slug
        HAVING COUNT(*) > 1
    ) d;
    IF dup_count > 0 THEN
        RAISE EXCEPTION
            'category_sites would violate (site_id, site_specific_slug) uniqueness in % groups',
            dup_count;
    END IF;
END $$;

CREATE UNIQUE INDEX idx_category_sites_site_slug
    ON category_sites (site_id, site_specific_slug)
 WHERE site_specific_slug IS NOT NULL;

ALTER TABLE categories DROP CONSTRAINT categories_parent_id_slug_key;

COMMIT;
