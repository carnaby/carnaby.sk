const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const { runMigrations } = require('./migrations/migration-runner');

const app = express();
const PORT = 3000;

// Database path (configurable via environment variable)
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'database.sqlite');

// Run migrations before starting server
console.log('🚀 Starting carnaby.sk server...');
try {
    runMigrations();
} catch (error) {
    console.error('❌ Migration failed, cannot start server:', error);
    process.exit(1);
}

// Initialize database connection
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency and data integrity
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('wal_autocheckpoint = 1000');
console.log('✅ Database connected with WAL mode');

// Serve static files from the current directory
app.use(express.static(__dirname));

// API endpoint to get all videos
app.get('/api/videos', (req, res) => {
    try {
        // Get all videos with category names
        const videos = db.prepare(`
            SELECT v.id, v.url, c.name as category
            FROM videos v
            JOIN categories c ON v.category_id = c.id
            ORDER BY v.id
        `).all();

        // Group videos by category
        const groupedVideos = videos.reduce((acc, video) => {
            if (!acc[video.category]) {
                acc[video.category] = [];
            }
            acc[video.category].push({
                id: video.id,
                url: video.url
            });
            return acc;
        }, {});

        res.json({
            success: true,
            data: groupedVideos,
            total: videos.length
        });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch videos'
        });
    }
});

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');

    // Checkpoint WAL file before closing
    try {
        db.pragma('wal_checkpoint(TRUNCATE)');
        console.log('✅ WAL checkpoint completed');
    } catch (error) {
        console.error('⚠️  WAL checkpoint failed:', error.message);
    }

    db.close();
    console.log('✅ Database connection closed');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down...');

    // Checkpoint WAL file before closing
    try {
        db.pragma('wal_checkpoint(TRUNCATE)');
        console.log('✅ WAL checkpoint completed');
    } catch (error) {
        console.error('⚠️  WAL checkpoint failed:', error.message);
    }

    db.close();
    console.log('✅ Database connection closed');
    process.exit(0);
});
