const Database = require('better-sqlite3');
const path = require('path');

// Create/open database
const db = new Database(path.join(__dirname, 'videos.db'));

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS videos (
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

// Get Dodo category ID
const dodoCategory = db.prepare('SELECT id FROM categories WHERE name = ?').get('Dodo');

// Existing YouTube video URLs from index.html
const existingVideos = [
  'vFd6XrV4vRE',
  'QBLRyxhDCS4',
  'vTHAbkEvymM',
  'qeUB6Yj1PYo',
  'AMajbzPky6g',
  'AVzGSWEkyeQ',
  'Hnabg1NAyKA',
  '0l4kWpAK9p8',
  'HcxvUN3IvVg',
  'p1_pl_fIBiQ',
  '2I_El8MJYXQ',
  'CqujYRiQo84',
  'YJDaKFMqKfc',
  'sj4UZDRy2W0',
  'rde5giz3TGc',
  'zQeCIiAf0fY'
];

// Check if videos already exist
const videoCount = db.prepare('SELECT COUNT(*) as count FROM videos').get();

if (videoCount.count === 0) {
  // Insert videos into Dodo category
  const insertVideo = db.prepare('INSERT INTO videos (url, category_id) VALUES (?, ?)');

  const insertMany = db.transaction((videos) => {
    for (const videoUrl of videos) {
      insertVideo.run(videoUrl, dodoCategory.id);
    }
  });

  insertMany(existingVideos);
  console.log(`✅ Database initialized with ${existingVideos.length} videos in Dodo category`);
} else {
  console.log('✅ Database already contains videos');
}

db.close();
console.log('✅ Database setup complete');
