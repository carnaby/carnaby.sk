// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const session = require('express-session');
const SqliteStore = require('better-sqlite3-session-store')(session);
const initializePassport = require('./config/passport');
const authRoutes = require('./routes/auth');
const { runMigrations } = require('./migrations/migration-runner');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Initialize Passport with database connection
const passport = initializePassport(db);

// Session configuration
app.use(session({
    store: new SqliteStore({
        client: db,
        expired: {
            clear: true,
            intervalMs: 900000 // Clear expired sessions every 15 minutes
        }
    }),
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'lax'
    }
}));

console.log('✅ Session store configured');

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());
console.log('✅ Passport initialized');

// Serve static files from the current directory
app.use(express.static(__dirname));

// Authentication routes
app.use('/auth', authRoutes);

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
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
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
}
