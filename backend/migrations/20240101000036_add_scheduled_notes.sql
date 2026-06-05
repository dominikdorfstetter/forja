-- Add scheduling support to quick-post notes

ALTER TABLE ap_notes ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'published';
ALTER TABLE ap_notes ADD COLUMN scheduled_at TIMESTAMPTZ;
