-- Migration: Change created_by/updated_by/deleted_by from UUID to TEXT
-- The old users table (which these FK'd to) was dropped in migration 20.
-- Clerk user IDs are strings, not UUIDs.

-- Drop orphaned FK constraints (users table no longer exists)
ALTER TABLE contents DROP CONSTRAINT IF EXISTS contents_created_by_fkey;
ALTER TABLE contents DROP CONSTRAINT IF EXISTS contents_updated_by_fkey;
ALTER TABLE contents DROP CONSTRAINT IF EXISTS contents_deleted_by_fkey;

-- Widen columns from UUID to TEXT
ALTER TABLE contents ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
ALTER TABLE contents ALTER COLUMN updated_by TYPE TEXT USING updated_by::TEXT;
ALTER TABLE contents ALTER COLUMN deleted_by TYPE TEXT USING deleted_by::TEXT;

-- Backfill NULL created_by with the site owner's clerk_user_id
UPDATE contents
SET created_by = sub.clerk_user_id
FROM (
    SELECT cs.content_id, sm.clerk_user_id
    FROM content_sites cs
    JOIN site_memberships sm ON sm.site_id = cs.site_id AND sm.role = 'owner'
) sub
WHERE contents.id = sub.content_id
  AND contents.created_by IS NULL;

-- Index for ownership lookups
CREATE INDEX IF NOT EXISTS idx_contents_created_by ON contents(created_by) WHERE created_by IS NOT NULL;
