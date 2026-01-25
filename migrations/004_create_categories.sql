-- Update categories table for organizing posts
-- Add slug and description columns to existing table

-- Add slug column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='categories' AND column_name='slug') THEN
    ALTER TABLE categories ADD COLUMN slug TEXT UNIQUE;
  END IF;
END $$;

-- Add description column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='categories' AND column_name='description') THEN
    ALTER TABLE categories ADD COLUMN description TEXT;
  END IF;
END $$;

-- Add created_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='categories' AND column_name='created_at') THEN
    ALTER TABLE categories ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- Update existing categories with slugs
UPDATE categories SET slug = LOWER(name) WHERE slug IS NULL;

-- Create index for slug lookups if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- Insert default categories if they don't exist
INSERT INTO categories (name, slug, description) VALUES 
  ('Dodo', 'dodo', 'Dodo category'),
  ('Carnaby', 'carnaby', 'Carnaby category')
ON CONFLICT (name) DO NOTHING;

