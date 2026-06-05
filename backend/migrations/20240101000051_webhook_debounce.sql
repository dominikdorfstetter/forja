-- Add debounce support to webhooks (#400)

-- Debounce window: 0 = immediate dispatch (default, backwards compatible)
ALTER TABLE webhooks ADD COLUMN debounce_seconds INTEGER NOT NULL DEFAULT 0;

-- Dispatch buffer for debounced webhooks
CREATE TABLE webhook_dispatch_buffer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    site_id UUID NOT NULL,
    events JSONB NOT NULL DEFAULT '[]'::jsonb,
    flush_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'buffering',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dispatch_buffer_flush ON webhook_dispatch_buffer(flush_at)
    WHERE status = 'buffering';
CREATE INDEX idx_dispatch_buffer_webhook ON webhook_dispatch_buffer(webhook_id);

-- Partial unique index for upsert: only one buffering row per webhook
CREATE UNIQUE INDEX idx_dispatch_buffer_webhook_buffering
    ON webhook_dispatch_buffer(webhook_id)
    WHERE status = 'buffering';

-- Add constraint for debounce range
ALTER TABLE webhooks ADD CONSTRAINT chk_debounce_range
    CHECK (debounce_seconds >= 0 AND debounce_seconds <= 300);
