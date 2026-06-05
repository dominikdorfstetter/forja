-- Migration: Skills trash recovery (#818)
-- Description: Give the `skills` table a `deleted_at` stamp so soft-deleted
-- skills can be surfaced in Trash, restored, and purged by the cleanup
-- worker after the retention window — consistent with social_links,
-- navigation, and content. `skills.is_deleted` already exists; this only
-- adds the timestamp and a partial index for the trash queries.

ALTER TABLE skills
    ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE INDEX idx_skills_deleted ON skills (deleted_at) WHERE is_deleted = TRUE;

-- Backfill: any skills already soft-deleted before this migration have no
-- deleted_at. Stamp them as of now so they enter the 30-day retention window
-- (rather than being invisible forever, which is the bug this closes).
UPDATE skills
SET deleted_at = NOW()
WHERE is_deleted = TRUE AND deleted_at IS NULL;
