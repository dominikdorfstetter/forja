-- Self-hosted ALTCHA as a bot-protection mode (#768).
--
-- The #608 framework assumed a single model: a remote vendor verifier
-- (`verify_url` + secret, POST `secret+response`, read `{success}`).
-- Self-hosted ALTCHA breaks that assumption — there is no verify URL; the
-- server issues an HMAC-signed proof-of-work challenge and verifies the
-- solved payload in-process. To support both without a vendor lock-in we add
-- a `mode` discriminator and repurpose the existing encrypted-secret columns
-- as the ALTCHA HMAC key (no new key-management surface).

-- Verification mode. 'remote' = vendor siteverify URL (#608); 'altcha' =
-- self-hosted proof-of-work verified locally.
CREATE TYPE bot_protection_mode AS ENUM ('altcha', 'remote');

-- Add the column with DEFAULT 'remote' so every PRE-EXISTING row backfills to
-- the behavior it already had (a vendor verifier). Then flip the default to
-- 'altcha' so NEW sites enabling protection get the GDPR-clean default.
ALTER TABLE site_bot_protection
    ADD COLUMN mode bot_protection_mode NOT NULL DEFAULT 'remote';
ALTER TABLE site_bot_protection
    ALTER COLUMN mode SET DEFAULT 'altcha';

-- ALTCHA mode has no verify URL — make it nullable. Remote-mode rows keep it.
ALTER TABLE site_bot_protection
    ALTER COLUMN verify_url DROP NOT NULL;

-- ALTCHA proof-of-work tuning (null/ignored in remote mode). max_number caps
-- the PoW search space (higher = harder for the visitor's browser);
-- expiry_seconds bounds how long an issued challenge stays valid.
ALTER TABLE site_bot_protection
    ADD COLUMN altcha_max_number BIGINT,
    ADD COLUMN altcha_expiry_seconds INTEGER;

-- Single-use replay guard for solved ALTCHA challenges (#768b).
--
-- altcha-lib-rs verifies HMAC + expiry but does NOT track consumed
-- challenges, so a captured solved payload could be replayed until it
-- expires. We record each accepted challenge's salt and reject a second
-- submission carrying the same salt. Rows are pruned once past expires_at.
CREATE TABLE altcha_consumed_challenge (
    salt        TEXT PRIMARY KEY,
    site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supports the TTL cleanup sweep (DELETE WHERE expires_at < NOW()).
CREATE INDEX idx_altcha_consumed_expires ON altcha_consumed_challenge(expires_at);
