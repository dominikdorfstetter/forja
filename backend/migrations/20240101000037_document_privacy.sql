-- Add privacy and encryption support for documents.
-- When is_private = TRUE, file_data contains AES-256-GCM ciphertext
-- derived from the user-supplied password via Argon2id.

ALTER TABLE documents
    ADD COLUMN is_private        BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN password_hash     TEXT,
    ADD COLUMN encryption_salt   BYTEA,
    ADD COLUMN encryption_nonce  BYTEA,
    ADD COLUMN encrypted_dek     BYTEA,
    ADD COLUMN encryption_key_version SMALLINT;

-- Enforce: private documents must have all encryption metadata
ALTER TABLE documents
    ADD CONSTRAINT chk_document_privacy CHECK (
        (is_private = FALSE)
        OR (
            is_private = TRUE
            AND password_hash IS NOT NULL
            AND encryption_salt IS NOT NULL
            AND encryption_nonce IS NOT NULL
        )
    );

-- Index for quick lookup of private documents (useful for admin key-rotation queries)
CREATE INDEX idx_documents_private ON documents (is_private) WHERE is_private = TRUE;
