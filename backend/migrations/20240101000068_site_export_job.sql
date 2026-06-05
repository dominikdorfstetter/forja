-- Site export-job queue (issue #716, epic #708).
-- Async export foundation: POST /sites/{id}/export enqueues a job here;
-- the SiteExportWorker (#717) picks up 'queued' rows, builds the ZIP,
-- and flips them to 'ready' (or 'failed'). Mirrors the enum+table shape
-- of …041_webhook_retry_queue. Additive only — never edit.

CREATE TYPE site_export_status AS ENUM ('queued', 'running', 'ready', 'failed');

CREATE TABLE site_export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    status site_export_status NOT NULL DEFAULT 'queued',
    -- Actor (auth.id) that requested the export. No FK, mirroring the
    -- nullable audit_logs.user_id convention.
    requested_by UUID,
    -- storage_path + download_token are NULL until the worker finishes.
    -- storage_path locates the ZIP in object/media storage so the
    -- download route can stream it and the retention sweep can purge it;
    -- download_token is the unguessable bearer the signed link carries.
    storage_path TEXT,
    download_token TEXT,
    expires_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Worker dequeue + the "already an active job for this site" guard both
-- filter on the active statuses ordered by age.
CREATE INDEX idx_site_export_jobs_active ON site_export_jobs(site_id, created_at)
    WHERE status IN ('queued', 'running');
-- Retention sweep reclaims ready artifacts past their expiry.
CREATE INDEX idx_site_export_jobs_expiry ON site_export_jobs(expires_at)
    WHERE status = 'ready';
