-- Create posts table for blog/video posts
-- Replaces embedded YouTube videos with a proper content management system

CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  
  -- Content
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,  -- URL-friendly version of title
  content TEXT,  -- Markdown content
  excerpt TEXT,  -- Short description for previews and SEO
  
  -- Media
  thumbnail_path TEXT,  -- Path to thumbnail image (e.g., "/thumbnails/post-123.jpg")
  youtube_id TEXT,  -- YouTube video ID (e.g., "dQw4w9WgXcQ")
  soundcloud_url TEXT,  -- SoundCloud embed URL or track URL
  
  -- Metadata
  author_id INTEGER NOT NULL,  -- User who created the post
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP,  -- When published (NULL = draft)
  
  -- Statistics
  view_count INTEGER DEFAULT 0,  -- Number of views
  
  -- Status
  status TEXT DEFAULT 'draft',  -- 'draft', 'published', 'archived'
  is_featured BOOLEAN DEFAULT false,  -- Featured/pinned posts
  
  -- SEO
  meta_description TEXT,  -- SEO meta description
  
  FOREIGN KEY (author_id) REFERENCES users(id)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_is_featured ON posts(is_featured);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_posts_updated_at_trigger
BEFORE UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION update_posts_updated_at();

