-- Add focal point columns to media_files for responsive image cropping.
-- Values are normalized 0.0–1.0 (top-left origin). Default 0.5 = center.
ALTER TABLE media_files
    ADD COLUMN focal_x REAL NOT NULL DEFAULT 0.5,
    ADD COLUMN focal_y REAL NOT NULL DEFAULT 0.5;

-- Constrain to valid range
ALTER TABLE media_files
    ADD CONSTRAINT media_files_focal_x_range CHECK (focal_x >= 0.0 AND focal_x <= 1.0),
    ADD CONSTRAINT media_files_focal_y_range CHECK (focal_y >= 0.0 AND focal_y <= 1.0);
