-- Media tags — free-form tags on media files for organization and discovery.
-- Tags are stored lowercase/trimmed; normalization happens at the API layer.

CREATE TABLE media_tags (
    media_file_id UUID NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
    tag           TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (media_file_id, tag)
);

-- Fast prefix queries for autocomplete (e.g. WHERE tag LIKE 'land%')
CREATE INDEX idx_media_tags_tag ON media_tags(tag);

-- Fast lookup of all tags for a given media file
CREATE INDEX idx_media_tags_media_file ON media_tags(media_file_id);
