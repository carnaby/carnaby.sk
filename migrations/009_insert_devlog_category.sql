-- Insert DevLog category for production
INSERT INTO categories (name, slug, description) VALUES 
  ('DevLog', 'devlog', 'Development logs and tech notes')
ON CONFLICT (name) DO NOTHING;
