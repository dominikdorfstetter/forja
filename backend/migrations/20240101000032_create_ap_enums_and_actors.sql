-- ActivityPub Federation: enums and actors table

-- Enums
CREATE TYPE ap_signature_algorithm AS ENUM ('rsa-sha256', 'ed25519');
CREATE TYPE ap_follower_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE ap_activity_direction AS ENUM ('in', 'out');
CREATE TYPE ap_activity_status AS ENUM ('pending', 'done', 'failed');
CREATE TYPE ap_delivery_status AS ENUM ('pending', 'done', 'failed', 'dead');
CREATE TYPE ap_comment_status AS ENUM ('pending', 'approved', 'rejected', 'spam');

-- Actors (one per site)
CREATE TABLE ap_actors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    preferred_username VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    summary TEXT,
    avatar_url TEXT,
    header_url TEXT,
    rsa_private_key BYTEA NOT NULL,
    rsa_private_key_nonce BYTEA NOT NULL,
    rsa_public_key TEXT NOT NULL,
    ed25519_private_key BYTEA,
    ed25519_private_key_nonce BYTEA,
    ed25519_public_key TEXT,
    signature_algorithm ap_signature_algorithm NOT NULL DEFAULT 'rsa-sha256',
    inbox_url TEXT NOT NULL,
    outbox_url TEXT NOT NULL,
    followers_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_ap_actors_site UNIQUE (site_id),
    CONSTRAINT chk_ed25519_keys CHECK (
        signature_algorithm != 'ed25519'
        OR (ed25519_private_key IS NOT NULL AND ed25519_private_key_nonce IS NOT NULL AND ed25519_public_key IS NOT NULL)
    )
);

CREATE INDEX idx_ap_actors_site_id ON ap_actors(site_id);
