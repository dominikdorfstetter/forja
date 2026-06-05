-- Add version tracking to legal_documents
ALTER TABLE legal_documents
    ADD COLUMN version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN parent_version_id UUID REFERENCES legal_documents(id) ON DELETE SET NULL;

-- Index for version chain lookups
CREATE INDEX idx_legal_documents_parent_version ON legal_documents(parent_version_id)
    WHERE parent_version_id IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN legal_documents.version IS 'Version number, incremented on each new version';
COMMENT ON COLUMN legal_documents.parent_version_id IS 'Points to the previous version of this document';
