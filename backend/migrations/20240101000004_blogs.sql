-- Migration: Blog System
-- Description: Blog-specific tables and relationships

-- ============================================
-- BLOG TABLES
-- ============================================

-- Blog-specific data
CREATE TABLE blogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE UNIQUE,
    author TEXT NOT NULL,
    published_date DATE NOT NULL,
    reading_time_minutes SMALLINT,
    cover_image_id UUID REFERENCES media_files(id),
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    allow_comments BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Blog Attachments (downloadable files)
CREATE TABLE blog_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
    media_file_id UUID NOT NULL REFERENCES media_files(id),
    display_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Blog External Links
CREATE TABLE blog_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    alt_text TEXT,
    display_order SMALLINT NOT NULL DEFAULT 0,
    is_external BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Blog Photos Gallery
CREATE TABLE blog_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
    media_file_id UUID NOT NULL REFERENCES media_files(id),
    display_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_blogs_content ON blogs(content_id);
CREATE INDEX idx_blogs_date ON blogs(published_date DESC);
CREATE INDEX idx_blogs_featured ON blogs(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_blog_attachments_blog ON blog_attachments(blog_id);
CREATE INDEX idx_blog_links_blog ON blog_links(blog_id);
CREATE INDEX idx_blog_photos_blog ON blog_photos(blog_id);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_blogs_updated_at BEFORE UPDATE ON blogs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
