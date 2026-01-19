const Database = require('better-sqlite3');
const path = require('path');

// Create/open database
const db = new Database(path.join(__dirname, 'videos.db'));

// Drop existing tables to ensure clean state
db.exec(`
  DROP TABLE IF EXISTS videos;
  DROP TABLE IF EXISTS categories;
`);

// Create tables
db.exec(`
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );
`);

// Insert categories
const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
insertCategory.run('Dodo');
insertCategory.run('Carnaby');

// Get category IDs
const dodoCategory = db.prepare('SELECT id FROM categories WHERE name = ?').get('Dodo');
const carnabyCategory = db.prepare('SELECT id FROM categories WHERE name = ?').get('Carnaby');

// Dodo videos (acoustic folk, storyteller ballads, Americana)
const dodoVideos = [
  'QBLRyxhDCS4',
  'vTHAbkEvymM',
  'qeUB6Yj1PYo',
  'AVzGSWEkyeQ',
  'Hnabg1NAyKA',
  '0l4kWpAK9p8',
  'HcxvUN3IvVg',
  'p1_pl_fIBiQ',
  '2I_El8MJYXQ',
  'rde5giz3TGc',
  'zQeCIiAf0fY'
];

// Carnaby videos (retro synth-pop, euro-disco)
const carnabyVideos = [
  'vFd6XrV4vRE',
  'AMajbzPky6g',
  'CqujYRiQo84',
  'YJDaKFMqKfc',
  'sj4UZDRy2W0'
];

// Insert videos
const insertVideo = db.prepare('INSERT INTO videos (url, category_id) VALUES (?, ?)');

const insertMany = db.transaction((videos, categoryId) => {
  for (const videoUrl of videos) {
    insertVideo.run(videoUrl, categoryId);
  }
});

// Insert Dodo videos
insertMany(dodoVideos, dodoCategory.id);
// Insert Carnaby videos
insertMany(carnabyVideos, carnabyCategory.id);

console.log(`✅ Database initialized with ${dodoVideos.length} Dodo videos and ${carnabyVideos.length} Carnaby videos`);

db.close();
console.log('✅ Database setup complete');
