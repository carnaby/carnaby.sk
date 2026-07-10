-- Mini legacy (v1) schema + fixture data for migrate-legacy's integration smoke test
-- (Task 24's rehearsal drives the real dump instead -- this is a cheap standalone check).
--
-- A stripped-down version of the v1 Express/EJS-era schema -- see
-- `git show carnaby-sk-origin:migrations/002_create_users_table.sql` (and 003/004/005/006/007/008)
-- for the full history. Only the columns migrate.ts actually reads are included.
--
-- Run against the disposable `carnaby_legacy` database:
--   docker exec -i carnaby-db-local psql -U carnaby -d carnaby_legacy < tools/migrate-legacy/fixtures/legacy-mini.sql

DROP TABLE IF EXISTS post_translations, post_categories, posts, categories, users CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  google_id VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  role VARCHAR(50) DEFAULT 'user'
);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  slug TEXT UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT,
  excerpt TEXT,
  thumbnail_path TEXT,
  youtube_id TEXT,
  soundcloud_url TEXT,
  author_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP,
  view_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  is_featured BOOLEAN DEFAULT false,
  meta_description TEXT,
  language VARCHAR(5) DEFAULT 'sk' NOT NULL
);

CREATE TABLE post_categories (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, category_id)
);

CREATE TABLE post_translations (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  language VARCHAR(5) NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  excerpt TEXT,
  meta_description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_id, language)
);

-- 2 users: one Google-login admin (mirrors migration 003's dodusik@gmail.com admin bootstrap),
-- one plain listener with no avatar.
INSERT INTO users (google_id, email, display_name, avatar_url, role) VALUES
  ('google-admin-1', 'dodusik@gmail.com', 'Dodo Admin', 'https://example.com/avatar-admin.png', 'admin'),
  ('google-user-2', 'listener@example.com', 'Casual Listener', NULL, 'user');

-- 2 categories: one slug overlaps a v2 canonical category ('dodo'), the other is legacy-only --
-- exercises the "insert extra legacy categories after seed()" path.
INSERT INTO categories (name, slug, description) VALUES
  ('Dodo', 'dodo', 'Legacy dodo category description'),
  ('Legacy Extra', 'legacy-extra', 'A category that only ever existed in v1');

-- Post 1: draft, content lives ONLY in the posts row's own legacy columns (no post_translations
-- rows at all) -- exercises the synthesis rule. thumbnail_path has a legacy directory prefix to
-- exercise basename stripping end-to-end.
INSERT INTO posts (title, slug, content, excerpt, thumbnail_path, youtube_id, soundcloud_url, author_id,
                    published_at, view_count, status, is_featured, meta_description, language)
VALUES ('Draft Only In Legacy Columns', 'draft-legacy-only',
        'Content that lives only in posts.content, never copied to post_translations.',
        'Draft excerpt', '/thumbnails/originals/draft-thumb.jpg', NULL, NULL, 1,
        NULL, 0, 'draft', false, 'draft meta description', 'sk');

-- Post 2: published, WITH real sk+en post_translations rows that differ from -- and must win
-- over -- the post's own (stale) legacy columns.
INSERT INTO posts (title, slug, content, excerpt, thumbnail_path, youtube_id, soundcloud_url, author_id,
                    published_at, view_count, status, is_featured, meta_description, language)
VALUES ('Stale Legacy Title (should not be used)', 'published-with-translations',
        'Stale legacy content (should not be used)', 'Stale legacy excerpt', 'thumb2.jpg',
        'dQw4w9WgXcQ', NULL, 1, '2024-05-01 12:00:00', 42, 'published', true,
        'stale legacy meta', 'sk');

-- Post 3: has a 'cs' post_translations row (unsupported language -> WARN + skip) but no sk row,
-- and its own legacy columns ARE populated in 'sk' -- so a sk translation gets synthesized too.
INSERT INTO posts (title, slug, content, excerpt, thumbnail_path, youtube_id, soundcloud_url, author_id,
                    published_at, view_count, status, is_featured, meta_description, language)
VALUES ('Weird Language Post', 'weird-language-post',
        'Slovak content living on the post row itself.', 'Weird post excerpt', NULL, NULL,
        'https://soundcloud.com/example/track', 2, '2023-11-15 09:30:00', 7, 'published', false,
        'weird post meta', 'sk');

INSERT INTO post_categories (post_id, category_id) VALUES
  (1, 1),
  (2, 1),
  (2, 2),
  (3, 2);

INSERT INTO post_translations (post_id, language, title, content, excerpt, meta_description) VALUES
  (2, 'sk', 'Publikovany Titulok SK', 'Skutocny SK obsah z post_translations.', 'SK excerpt', 'SK meta'),
  (2, 'en', 'Published Title EN', 'Real EN content from post_translations.', 'EN excerpt', 'EN meta'),
  (3, 'cs', 'Divny Jazyk (cs)', 'Content in an unsupported language row.', NULL, NULL);
