-- Add body column to content_localizations for markdown content
ALTER TABLE content_localizations ADD COLUMN IF NOT EXISTS body TEXT;

-- Add header_image_id to blogs for separate header image
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS header_image_id UUID REFERENCES media_files(id);
