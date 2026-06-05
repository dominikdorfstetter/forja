-- Enable soft-delete for legal_documents, social_links, navigation_menus, and navigation_items.

-- Legal documents
ALTER TABLE legal_documents
    ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE INDEX idx_legal_documents_deleted ON legal_documents (deleted_at) WHERE is_deleted = TRUE;

-- Sync existing soft-deleted legal docs from the contents table.
UPDATE legal_documents
SET is_deleted = TRUE, deleted_at = c.deleted_at
FROM contents c
WHERE legal_documents.content_id = c.id AND c.is_deleted = TRUE;

-- Social links
ALTER TABLE social_links
    ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE INDEX idx_social_links_deleted ON social_links (deleted_at) WHERE is_deleted = TRUE;

-- Navigation menus
ALTER TABLE navigation_menus
    ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE INDEX idx_navigation_menus_deleted ON navigation_menus (deleted_at) WHERE is_deleted = TRUE;

-- Navigation items
ALTER TABLE navigation_items
    ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE INDEX idx_navigation_items_deleted ON navigation_items (deleted_at) WHERE is_deleted = TRUE;
