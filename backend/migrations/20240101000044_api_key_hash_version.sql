-- Add hash_version column to track which hashing algorithm was used.
-- Version 1 = SHA-256 (legacy), Version 2 = Argon2id (current).
ALTER TABLE api_keys ADD COLUMN hash_version SMALLINT NOT NULL DEFAULT 1;
