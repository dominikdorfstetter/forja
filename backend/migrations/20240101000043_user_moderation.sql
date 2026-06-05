-- User moderation: suspension and ban support
-- Keyed by clerk_user_id since Forja delegates user identity to Clerk.

CREATE TYPE user_moderation_status AS ENUM ('active', 'suspended', 'banned');

CREATE TABLE user_moderation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id TEXT NOT NULL UNIQUE,
    status user_moderation_status NOT NULL DEFAULT 'active',
    status_reason TEXT,
    status_changed_at TIMESTAMPTZ,
    status_changed_by TEXT,              -- clerk_user_id of admin who acted
    suspension_expires_at TIMESTAMPTZ,   -- NULL for bans, set for suspensions
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_moderation_clerk ON user_moderation(clerk_user_id);
CREATE INDEX idx_user_moderation_status ON user_moderation(status) WHERE status != 'active';
CREATE INDEX idx_user_moderation_suspension_expiry ON user_moderation(suspension_expires_at)
    WHERE status = 'suspended' AND suspension_expires_at IS NOT NULL;
