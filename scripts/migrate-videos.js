/**
 * Video Migration Script
 * Migrates existing videos from videos table to posts table
 * 
 * What this does:
 * 1. Fetches all videos from the videos table
 * 2. For each video, creates a post with:
 *    - YouTube ID
 *    - Category mapping
 *    - Placeholder title (you'll fill in manually)
 *    - Status: draft (so you can review before publishing)
 *    - Language: sk (default)
 * 3. Downloads YouTube thumbnail automatically
 * 4. Links to appropriate category
 */

// Load environment variables from .env file
require('dotenv').config();

const { Pool } = require('pg');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'carnaby',
    user: process.env.DB_USER || 'carnaby',
    password: process.env.DB_PASSWORD
});

// Helper function to download YouTube thumbnail
function downloadYouTubeThumbnail(videoId, savePath) {
    return new Promise((resolve, reject) => {
        const url = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        const filePath = path.join(savePath, `yt-${videoId}.jpg`);
        const file = fs.createWriteStream(filePath);

        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download thumbnail: ${response.statusCode}`));
                return;
            }

            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(`/thumbnails/yt-${videoId}.jpg`);
            });
        }).on('error', (err) => {
            fs.unlink(filePath, () => { }); // Delete incomplete file
            reject(err);
        });
    });
}

// Helper function to generate slug
function generateSlug(title) {
    return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .trim()
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-'); // Remove consecutive hyphens
}

async function migrateVideos() {
    const client = await pool.connect();

    try {
        console.log('🚀 Starting video migration...\n');

        // Get admin user ID (assuming first user is admin)
        const adminResult = await client.query(
            "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
        );

        if (adminResult.rows.length === 0) {
            throw new Error('No admin user found. Please create an admin user first.');
        }

        const adminId = adminResult.rows[0].id;
        console.log(`✅ Found admin user: ID ${adminId}\n`);

        // Fetch all videos with their categories
        const videosResult = await client.query(`
            SELECT v.id, v.url, c.id as category_id, c.name as category_name
            FROM videos v
            JOIN categories c ON v.category_id = c.id
            ORDER BY v.id
        `);

        const videos = videosResult.rows;
        console.log(`📹 Found ${videos.length} videos to migrate\n`);

        // Create thumbnails directory if it doesn't exist
        const thumbnailsDir = path.join(__dirname, '../public/thumbnails');
        if (!fs.existsSync(thumbnailsDir)) {
            fs.mkdirSync(thumbnailsDir, { recursive: true });
        }

        let successCount = 0;
        let errorCount = 0;

        // Migrate each video
        for (const video of videos) {
            try {
                const youtubeId = video.url;
                const title = `Video ${video.id} - ${video.category_name}`;
                const slug = generateSlug(title);

                console.log(`📝 Migrating: ${title} (${youtubeId})`);

                // Download thumbnail
                let thumbnailPath = null;
                try {
                    thumbnailPath = await downloadYouTubeThumbnail(youtubeId, thumbnailsDir);
                    console.log(`   ✅ Downloaded thumbnail: ${thumbnailPath}`);
                } catch (err) {
                    console.log(`   ⚠️  Failed to download thumbnail: ${err.message}`);
                }

                // Insert post
                const insertResult = await client.query(`
                    INSERT INTO posts (
                        title, slug, youtube_id, thumbnail_path,
                        author_id, status, language, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                    RETURNING id
                `, [title, slug, youtubeId, thumbnailPath, adminId, 'draft', 'sk']);

                const postId = insertResult.rows[0].id;

                // Link to category
                await client.query(`
                    INSERT INTO post_categories (post_id, category_id)
                    VALUES ($1, $2)
                `, [postId, video.category_id]);

                console.log(`   ✅ Created post ID: ${postId}`);
                console.log(`   ✅ Linked to category: ${video.category_name}\n`);

                successCount++;
            } catch (err) {
                console.error(`   ❌ Error migrating video ${video.id}: ${err.message}\n`);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log('📊 Migration Summary:');
        console.log(`   ✅ Successfully migrated: ${successCount}`);
        console.log(`   ❌ Failed: ${errorCount}`);
        console.log(`   📝 Total: ${videos.length}`);
        console.log('='.repeat(50) + '\n');

        console.log('🎉 Migration complete!');
        console.log('📝 Next steps:');
        console.log('   1. Go to http://localhost:3000/admin/posts');
        console.log('   2. Edit each post to add proper titles and descriptions');
        console.log('   3. Change status from "draft" to "published" when ready\n');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run migration
migrateVideos().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
