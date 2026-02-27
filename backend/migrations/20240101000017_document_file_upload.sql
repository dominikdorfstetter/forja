-- Migration: Document File Upload Support
-- Description: Allow documents to store uploaded files as binary blobs (BYTEA)

ALTER TABLE documents
    ALTER COLUMN url DROP NOT NULL,
    ADD COLUMN file_data BYTEA,
    ADD COLUMN file_name TEXT,
    ADD COLUMN file_size BIGINT,
    ADD COLUMN mime_type TEXT;

-- A document must be either a link (url) or an uploaded file (file_data), but not both
ALTER TABLE documents ADD CONSTRAINT chk_document_source
    CHECK (
        (url IS NOT NULL AND file_data IS NULL)
        OR (url IS NULL AND file_data IS NOT NULL
            AND file_name IS NOT NULL AND file_size IS NOT NULL AND mime_type IS NOT NULL)
    );

-- Uploaded files must not exceed 10MB
ALTER TABLE documents ADD CONSTRAINT chk_document_file_size
    CHECK (file_size IS NULL OR file_size <= 10485760);
