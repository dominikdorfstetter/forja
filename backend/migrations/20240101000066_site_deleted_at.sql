-- Site soft-delete grace window (issue #711, epic #708).
-- Mirrors the deleted_at convention used by content/media/legal so the
-- shared 30-day TrashCleanupWorker can purge expired soft-deleted sites.
-- Additive only — never edit; backfill is unnecessary (NULL = not deleted).

ALTER TABLE sites ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- Supports the purge sweep and the grace-window restore list, both of
-- which filter on (is_deleted = TRUE AND deleted_at <cmp> cutoff).
CREATE INDEX IF NOT EXISTS idx_sites_deleted_at
    ON sites (deleted_at)
    WHERE is_deleted = TRUE;
