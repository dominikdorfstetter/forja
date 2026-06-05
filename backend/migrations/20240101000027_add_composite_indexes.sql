-- Composite index for activity log pagination (site-scoped, newest-first)
-- Existing single-column indexes (idx_audit_logs_site, idx_audit_logs_created)
-- cannot satisfy both filter and sort in one scan.
CREATE INDEX IF NOT EXISTS idx_audit_logs_site_created
  ON audit_logs(site_id, created_at DESC);
