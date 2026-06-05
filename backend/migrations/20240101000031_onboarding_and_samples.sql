-- Migration: Add sample content flag to blogs + onboarding progress tracking
-- Part of: Guided first content creation (#50)

-- 1. Add is_sample flag to blogs table
ALTER TABLE blogs ADD COLUMN is_sample BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for efficient "delete all samples" and "count samples" queries
CREATE INDEX idx_blogs_is_sample ON blogs (is_sample) WHERE is_sample = TRUE;

-- 2. Onboarding progress table — tracks per-user, per-site checklist completion
CREATE TABLE onboarding_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id TEXT NOT NULL,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    step_key TEXT NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (clerk_user_id, site_id, step_key)
);

CREATE INDEX idx_onboarding_progress_user_site ON onboarding_progress (clerk_user_id, site_id);
