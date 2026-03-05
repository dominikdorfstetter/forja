-- User preferences table
-- Stores per-user preferences as a JSONB column (one row per Clerk user).
-- Adding new preference fields requires only DTO changes, not a new migration.

CREATE TABLE IF NOT EXISTS user_preferences (
    clerk_user_id TEXT PRIMARY KEY,
    preferences   JSONB NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reuse the existing trigger function for updated_at
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
