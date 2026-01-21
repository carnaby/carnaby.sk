// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const initializePassport = require('./config/passport');
const authRoutes = require('./routes/auth');
const { runMigrations } = require('./migrations/migration-runner');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection pool
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'carnaby',
    user: process.env.DB_USER || 'carnaby',
    password: process.env.DB_PASSWORD
});

// Run migrations before starting server
console.log('🚀 Starting carnaby.sk server...');
runMigrations()
    .then(() => {
        console.log('✅ Migrations completed');
        startServer();
    })
    .catch(error => {
        console.error('❌ Migration failed, cannot start server:', error);
        process.exit(1);
    });

function startServer() {
    // Test database connection
    pool.query('SELECT NOW()', (err, res) => {
        if (err) {
            console.error('❌ Database connection failed:', err);
            process.exit(1);
        }
        console.log('✅ Database connected (PostgreSQL)');
    });

    // Trust proxy - Required for Synology reverse proxy
    // This allows Express to trust the X-Forwarded-* headers
    app.set('trust proxy', 1);

    // Initialize Passport with database pool
    const passport = initializePassport(pool);

    // Session configuration with PostgreSQL store
    app.use(session({
        store: new pgSession({
            pool: pool,
            tableName: 'session', // Table name for sessions
            createTableIfMissing: true
        }),
        secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            httpOnly: true,
            secure: 'auto', // Auto-detect based on connection (works with reverse proxy)
            sameSite: 'lax'
        }
    }));

    console.log('✅ Session store configured (PostgreSQL)');

    // Initialize Passport
    app.use(passport.initialize());
    app.use(passport.session());
    console.log('✅ Passport initialized');

    // Serve static files from the current directory
    app.use(express.static(__dirname));

    // Authentication routes
    app.use('/auth', authRoutes);

    // API endpoint to get all videos
    app.get('/api/videos', async (req, res) => {
        try {
            // Get all videos with category names
            const result = await pool.query(`
                SELECT v.id, v.url, c.name as category
                FROM videos v
                JOIN categories c ON v.category_id = c.id
                ORDER BY v.id
            `);

            // Group videos by category
            const groupedVideos = result.rows.reduce((acc, video) => {
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
                total: result.rows.length
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

    async function shutdown() {
        console.log('\n🛑 Shutting down gracefully...');

        try {
            await pool.end();
            console.log('✅ Database pool closed');
        } catch (error) {
            console.error('⚠️  Database pool close failed:', error.message);
        }

        process.exit(0);
    }
}
