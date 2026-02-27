-- Migration: Drop old user management tables
-- The users table and user_sites table are replaced by Clerk + site_memberships.

-- Drop foreign keys from api_keys that reference users
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_user_id_fkey;
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_created_by_fkey;

-- Drop old tables
DROP TABLE IF EXISTS user_sites CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop old enum
DROP TYPE IF EXISTS user_role CASCADE;
