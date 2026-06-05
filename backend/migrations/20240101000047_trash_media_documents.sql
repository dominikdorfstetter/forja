-- Enable soft-delete for documents (currently hard-deleted).
ALTER TABLE documents
    ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN deleted_at TIMESTAMPTZ;

-- Add deleted_at timestamp to media_files (has is_deleted but no timestamp).
ALTER TABLE media_files
    ADD COLUMN deleted_at TIMESTAMPTZ;

-- Index for efficient trash queries on both tables.
CREATE INDEX idx_documents_deleted ON documents (is_deleted) WHERE is_deleted = TRUE;
CREATE INDEX idx_media_files_deleted_at ON media_files (deleted_at) WHERE is_deleted = TRUE;
