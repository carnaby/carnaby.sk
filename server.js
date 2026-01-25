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

    // Serve static files from public directory (for thumbnails, etc.)
    app.use(express.static(path.join(__dirname, 'public')));

    // Serve static files from the current directory
    app.use(express.static(__dirname));

    // Body parser middleware for JSON
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Authentication routes
    app.use('/auth', authRoutes);

    // Login page
    app.get('/login', (req, res) => {
        if (req.isAuthenticated()) {
            return res.redirect('/admin');
        }
        res.sendFile(path.join(__dirname, 'login.html'));
    });

    // Admin routes
    const adminRoutes = require('./routes/admin');
    app.use('/admin', adminRoutes);

    // Posts API routes
    const postsRoutes = require('./routes/posts');
    app.use('/api/posts', postsRoutes);





    // API endpoint to get all published posts (replaces videos)
    // Maintains backward compatibility with same response format
    app.get('/api/videos', async (req, res) => {
        try {
            // Get all published posts with their categories
            const result = await pool.query(`
                SELECT 
                    p.id,
                    p.youtube_id as url,
                    p.title,
                    p.slug,
                    p.thumbnail_path,
                    COALESCE(
                        json_agg(
                            c.name
                        ) FILTER (WHERE c.id IS NOT NULL),
                        '[]'
                    ) as categories
                FROM posts p
                LEFT JOIN post_categories pc ON p.id = pc.post_id
                LEFT JOIN categories c ON pc.category_id = c.id
                WHERE p.status = 'published' AND p.youtube_id IS NOT NULL
                GROUP BY p.id, p.youtube_id, p.title, p.slug, p.thumbnail_path
                ORDER BY p.created_at DESC
            `);

            // Group posts by category (maintaining old format)
            const groupedVideos = {};
            result.rows.forEach(post => {
                const categories = post.categories || [];
                categories.forEach(category => {
                    if (!groupedVideos[category]) {
                        groupedVideos[category] = [];
                    }
                    groupedVideos[category].push({
                        id: post.id,
                        url: post.url, // youtube_id
                        title: post.title,
                        slug: post.slug,
                        thumbnail: post.thumbnail_path
                    });
                });
            });

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

    // Serve post detail page
    app.get('/posts/:slug', (req, res) => {
        res.sendFile(path.join(__dirname, 'post.html'));
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
