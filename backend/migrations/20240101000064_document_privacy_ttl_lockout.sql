-- Adds TTL + 3-attempt lockout columns for private documents (#694).
-- All columns are additive; defaults preserve existing behaviour (no TTL,
-- not locked, zero failed attempts) for every existing row.

ALTER TABLE documents
    ADD COLUMN private_access_expires_at   TIMESTAMPTZ NULL,
    ADD COLUMN private_failed_attempt_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN private_locked_until         TIMESTAMPTZ NULL;

-- Quick lookup for admin "locked documents" views. Partial index so the
-- bookkeeping cost is paid only by locked rows.
CREATE INDEX idx_documents_locked
    ON documents (private_locked_until)
    WHERE private_locked_until IS NOT NULL;
