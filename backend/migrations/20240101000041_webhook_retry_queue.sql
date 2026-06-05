-- Webhook retry queue for exponential backoff delivery
-- Mirrors the ap_delivery_queue pattern from federation.

CREATE TYPE webhook_retry_status AS ENUM ('pending', 'retrying', 'done', 'dead');

CREATE TABLE webhook_retry_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    first_delivery_id UUID REFERENCES webhook_deliveries(id) ON DELETE SET NULL,
    status webhook_retry_status NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 6,
    last_attempt_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ DEFAULT NOW(),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_retry_queue_pending ON webhook_retry_queue(next_retry_at)
    WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_webhook_retry_queue_webhook ON webhook_retry_queue(webhook_id);
