-- Create post_translations table for multi-language support
CREATE TABLE IF NOT EXISTS post_translations (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    language VARCHAR(5) NOT NULL, -- 'en', 'sk', etc.
    title TEXT NOT NULL,
    content TEXT,
    excerpt TEXT,
    meta_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, language)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_post_translations_lookup ON post_translations(post_id, language);

-- Migrate existing content to 'sk' translation (since current content is Slovak)
INSERT INTO post_translations (post_id, language, title, content, excerpt, meta_description, created_at, updated_at)
SELECT 
    id, 
    'sk', 
    title, 
    content, 
    excerpt, 
    meta_description, 
    created_at, 
    updated_at 
FROM posts;

-- We KEEP the columns in 'posts' table temporarily as fallback/cache 
-- or we can choose to drop them later. For now, we will make them nullable 
-- if they were not already, but they serve as the "canonical" or "default" (untranslated) version if needed.
-- However, to force usage of translations, we should eventually ignore them.
-- For this migration, we won't drop them to prevent data loss during transition.

-- Trigger to update updated_at on translations
CREATE TRIGGER update_post_translations_updated_at_trigger
BEFORE UPDATE ON post_translations
FOR EACH ROW
EXECUTE FUNCTION update_posts_updated_at();
