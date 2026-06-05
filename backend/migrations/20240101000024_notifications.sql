-- In-app notifications for editorial workflow
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    recipient_clerk_id TEXT NOT NULL,
    actor_clerk_id TEXT,
    notification_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_clerk_id, site_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(recipient_clerk_id, site_id) WHERE is_read = FALSE;
