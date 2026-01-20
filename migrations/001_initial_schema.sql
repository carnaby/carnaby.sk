-- Initial database schema for carnaby.sk
-- Creates categories and videos tables with initial data

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

-- Create videos table
CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_videos_category_id ON videos(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

-- Insert default categories
INSERT OR IGNORE INTO categories (name) VALUES ('Dodo');
INSERT OR IGNORE INTO categories (name) VALUES ('Carnaby');

-- Insert Dodo videos (acoustic folk, storyteller ballads, Americana)
INSERT INTO videos (url, category_id) VALUES 
    ('QBLRyxhDCS4', (SELECT id FROM categories WHERE name = 'Dodo')),
    ('vTHAbkEvymM', (SELECT id FROM categories WHERE name = 'Dodo')),
    ('qeUB6Yj1PYo', (SELECT id FROM categories WHERE name = 'Dodo')),
    ('AVzGSWEkyeQ', (SELECT id FROM categories WHERE name = 'Dodo')),
    ('Hnabg1NAyKA', (SELECT id FROM categories WHERE name = 'Dodo')),
    ('0l4kWpAK9p8', (SELECT id FROM categories WHERE name = 'Dodo')),
    ('HcxvUN3IvVg', (SELECT id FROM categories WHERE name = 'Dodo')),
    ('p1_pl_fIBiQ', (SELECT id FROM categories WHERE name = 'Dodo')),
    ('2I_El8MJYXQ', (SELECT id FROM categories WHERE name = 'Dodo')),
    ('rde5giz3TGc', (SELECT id FROM categories WHERE name = 'Dodo')),
    ('zQeCIiAf0fY', (SELECT id FROM categories WHERE name = 'Dodo'));

-- Insert Carnaby videos (retro synth-pop, euro-disco)
INSERT INTO videos (url, category_id) VALUES 
    ('vFd6XrV4vRE', (SELECT id FROM categories WHERE name = 'Carnaby')),
    ('AMajbzPky6g', (SELECT id FROM categories WHERE name = 'Carnaby')),
    ('CqujYRiQo84', (SELECT id FROM categories WHERE name = 'Carnaby')),
    ('YJDaKFMqKfc', (SELECT id FROM categories WHERE name = 'Carnaby')),
    ('sj4UZDRy2W0', (SELECT id FROM categories WHERE name = 'Carnaby'));
