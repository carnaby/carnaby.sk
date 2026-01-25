-- Add language support to posts table
-- Option 1: Simple language column approach

-- Add language column with default 'sk'
ALTER TABLE posts ADD COLUMN language VARCHAR(5) DEFAULT 'sk' NOT NULL;

-- Create index for efficient language filtering
CREATE INDEX idx_posts_language ON posts(language);

-- Update existing posts to have 'sk' language
UPDATE posts SET language = 'sk' WHERE language IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN posts.language IS 'Language code (sk, en, etc.) - each post is in one language';
