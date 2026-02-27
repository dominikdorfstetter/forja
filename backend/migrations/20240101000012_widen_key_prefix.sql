-- Widen key_prefix column to accommodate actual prefix lengths
-- Generated prefixes are "dk_" + 8 hex chars = 11 chars
ALTER TABLE api_keys ALTER COLUMN key_prefix TYPE VARCHAR(20);
