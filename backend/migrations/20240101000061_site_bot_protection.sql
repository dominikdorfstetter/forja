-- Per-site bot-protection / captcha verification config (#608).
--
-- Forja is a headless CMS, so it doesn't choose a captcha vendor. Each site
-- admin pastes the vendor's siteverify URL plus their per-site secret. At
-- submission time the backend POSTs `secret + response` (URL-form-encoded)
-- to `verify_url` and parses `{ success: bool }` from the response — a
-- shape all major providers (Cloudflare Turnstile, hCaptcha, reCAPTCHA,
-- Friendly Captcha, …) share.
--
-- `provider_label` is a free-text UI hint ("Turnstile", "hCaptcha", …) —
-- it is *never* used as a code-path branch; the verify_url is the single
-- source of truth for where to POST.
--
-- The secret is encrypted at rest with the existing
-- DOCUMENT_ENCRYPTION_KEY (same pattern as `webhooks.secret`).
CREATE TABLE site_bot_protection (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    provider_label VARCHAR(100) NOT NULL,
    verify_url VARCHAR(500) NOT NULL,
    secret_encrypted BYTEA NOT NULL,
    secret_nonce BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (site_id)
);

CREATE INDEX idx_site_bot_protection_site_id ON site_bot_protection(site_id);
