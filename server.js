const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = 3000;

// Initialize database
const db = new Database(path.join(__dirname, 'videos.db'));

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
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
});
