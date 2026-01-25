-- Create junction table for many-to-many relationship between posts and categories
-- Allows a post to belong to multiple categories

CREATE TABLE IF NOT EXISTS post_categories (
  post_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (post_id, category_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_post_categories_post_id ON post_categories(post_id);
CREATE INDEX IF NOT EXISTS idx_post_categories_category_id ON post_categories(category_id);

