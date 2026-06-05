-- Add secret_nonce column for encrypted webhook secrets (#535)
--
-- Webhook HMAC signing secrets are now stored encrypted with AES-256-GCM
-- using the DOCUMENT_ENCRYPTION_KEY. The per-row nonce ensures identical
-- plaintext secrets produce different ciphertexts.
--
-- When secret_nonce is NULL, the secret is legacy plaintext (backward
-- compatible with webhooks created before this migration). New webhooks
-- created after this migration will have the secret encrypted and nonce set.
ALTER TABLE webhooks ADD COLUMN secret_nonce BYTEA;
