-- Migration: Retention purge indexes (#19)
-- Description: The data-retention purge deletes audit_logs / change_history
-- rows per site below a timestamp cutoff (WHERE site_id = $1 AND <ts> < $2).
-- Both tables only had single-column indexes on site_id and the timestamp;
-- composite (site_id, timestamp) indexes let the purge resolve each site's
-- expired range directly instead of intersecting or scanning.

CREATE INDEX IF NOT EXISTS idx_audit_logs_site_created
    ON audit_logs(site_id, created_at)
    WHERE site_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_change_history_site_changed_at
    ON change_history(site_id, changed_at)
    WHERE site_id IS NOT NULL;
