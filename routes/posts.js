const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const https = require('https');

// PostgreSQL connection pool
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'carnaby',
    user: process.env.DB_USER || 'carnaby',
    password: process.env.DB_PASSWORD
});

// Multer configuration for thumbnail uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../public/thumbnails');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'thumb-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// Helper function to generate slug from title
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

// Helper function to download YouTube thumbnail
function downloadYouTubeThumbnail(videoId, savePath) {
    return new Promise((resolve, reject) => {
        const url = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        const filePath = path.join(savePath, `yt-${videoId}.jpg`);
        const file = require('fs').createWriteStream(filePath);

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
            require('fs').unlink(filePath, () => { }); // Delete incomplete file
            reject(err);
        });
    });
}

// GET /api/posts - Get all posts with optional filters
router.get('/', async (req, res) => {
    try {
        const { status, category, featured, language, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT 
                p.*,
                u.display_name as author_name,
                u.email as author_email,
                COALESCE(
                    json_agg(
                        json_build_object('id', c.id, 'name', c.name, 'slug', c.slug)
                    ) FILTER (WHERE c.id IS NOT NULL),
                    '[]'
                ) as categories
            FROM posts p
            LEFT JOIN users u ON p.author_id = u.id
            LEFT JOIN post_categories pc ON p.id = pc.post_id
            LEFT JOIN categories c ON pc.category_id = c.id
            WHERE 1=1
        `;

        const params = [];
        let paramIndex = 1;

        if (status) {
            query += ` AND p.status = $${paramIndex++}`;
            params.push(status);
        }

        if (category) {
            query += ` AND c.slug = $${paramIndex++}`;
            params.push(category);
        }

        if (featured !== undefined) {
            query += ` AND p.is_featured = $${paramIndex++}`;
            params.push(featured === 'true');
        }

        if (language) {
            query += ` AND p.language = $${paramIndex++}`;
            params.push(language);
        }

        query += `
            GROUP BY p.id, u.display_name, u.email
            ORDER BY p.is_featured DESC, p.published_at DESC NULLS LAST, p.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;

        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows,
            total: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch posts'
        });
    }
});

// GET /api/posts/by-id/:id - Get single post by ID (for editing)
router.get('/by-id/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT 
                p.*,
                u.display_name as author_name,
                u.email as author_email,
                COALESCE(
                    json_agg(
                        json_build_object('id', c.id, 'name', c.name, 'slug', c.slug)
                    ) FILTER (WHERE c.id IS NOT NULL),
                    '[]'
                ) as categories
            FROM posts p
            LEFT JOIN users u ON p.author_id = u.id
            LEFT JOIN post_categories pc ON p.id = pc.post_id
            LEFT JOIN categories c ON pc.category_id = c.id
            WHERE p.id = $1
            GROUP BY p.id, u.display_name, u.email
        `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Post not found'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching post by ID:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch post'
        });
    }
});

// GET /api/posts/:slug - Get single post by slug
router.get('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;

        const query = `
            SELECT 
                p.*,
                u.display_name as author_name,
                u.email as author_email,
                COALESCE(
                    json_agg(
                        json_build_object('id', c.id, 'name', c.name, 'slug', c.slug)
                    ) FILTER (WHERE c.id IS NOT NULL),
                    '[]'
                ) as categories
            FROM posts p
            LEFT JOIN users u ON p.author_id = u.id
            LEFT JOIN post_categories pc ON p.id = pc.post_id
            LEFT JOIN categories c ON pc.category_id = c.id
            WHERE p.slug = $1
            GROUP BY p.id, u.display_name, u.email
        `;

        const result = await pool.query(query, [slug]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Post not found'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch post'
        });
    }
});

// POST /api/posts - Create new post (admin only)
router.post('/', async (req, res) => {
    try {
        // Check if user is authenticated and is admin
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const {
            title,
            slug: customSlug,
            content,
            excerpt,
            youtube_id,
            soundcloud_url,
            status = 'draft',
            is_featured = false,
            meta_description,
            categories = []
        } = req.body;

        if (!title) {
            return res.status(400).json({
                success: false,
                error: 'Title is required'
            });
        }

        // Generate slug if not provided
        const slug = customSlug || generateSlug(title);

        // Set published_at if status is 'published'
        const published_at = status === 'published' ? new Date() : null;

        // Insert post
        const insertQuery = `
            INSERT INTO posts (
                title, slug, content, excerpt, youtube_id, soundcloud_url,
                author_id, status, is_featured, meta_description, published_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `;

        const result = await pool.query(insertQuery, [
            title, slug, content, excerpt, youtube_id, soundcloud_url,
            req.user.id, status, is_featured, meta_description, published_at
        ]);

        const post = result.rows[0];

        // Insert categories
        if (categories.length > 0) {
            const categoryInserts = categories.map((categoryId, index) => {
                return pool.query(
                    'INSERT INTO post_categories (post_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [post.id, categoryId]
                );
            });
            await Promise.all(categoryInserts);
        }

        res.status(201).json({
            success: true,
            data: post
        });
    } catch (error) {
        console.error('Error creating post:', error);

        if (error.code === '23505') { // Unique violation
            return res.status(400).json({
                success: false,
                error: 'A post with this slug already exists'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to create post'
        });
    }
});

// PUT /api/posts/:id - Update post (admin only)
router.put('/:id', async (req, res) => {
    try {
        // Check if user is authenticated and is admin
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const { id } = req.params;
        const {
            title,
            slug,
            content,
            excerpt,
            thumbnail_path,
            youtube_id,
            soundcloud_url,
            status,
            is_featured,
            meta_description,
            categories = []
        } = req.body;

        // Check if post exists
        const existingPost = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
        if (existingPost.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Post not found'
            });
        }

        // Update published_at if status changed to 'published'
        let published_at = existingPost.rows[0].published_at;
        if (status === 'published' && existingPost.rows[0].status !== 'published') {
            published_at = new Date();
        }

        // Update post
        const updateQuery = `
            UPDATE posts SET
                title = COALESCE($1, title),
                slug = COALESCE($2, slug),
                content = COALESCE($3, content),
                excerpt = COALESCE($4, excerpt),
                thumbnail_path = COALESCE($5, thumbnail_path),
                youtube_id = COALESCE($6, youtube_id),
                soundcloud_url = COALESCE($7, soundcloud_url),
                status = COALESCE($8, status),
                is_featured = COALESCE($9, is_featured),
                meta_description = COALESCE($10, meta_description),
                published_at = COALESCE($11, published_at)
            WHERE id = $12
            RETURNING *
        `;

        const result = await pool.query(updateQuery, [
            title, slug, content, excerpt, thumbnail_path, youtube_id,
            soundcloud_url, status, is_featured, meta_description,
            published_at, id
        ]);

        // Update categories
        if (categories.length >= 0) {
            // Delete existing categories
            await pool.query('DELETE FROM post_categories WHERE post_id = $1', [id]);

            // Insert new categories
            if (categories.length > 0) {
                const categoryInserts = categories.map((categoryId) => {
                    return pool.query(
                        'INSERT INTO post_categories (post_id, category_id) VALUES ($1, $2)',
                        [id, categoryId]
                    );
                });
                await Promise.all(categoryInserts);
            }
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update post'
        });
    }
});

// DELETE /api/posts/:id - Delete post (admin only)
router.delete('/:id', async (req, res) => {
    try {
        // Check if user is authenticated and is admin
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const { id } = req.params;

        // Check if post exists
        const existingPost = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
        if (existingPost.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Post not found'
            });
        }

        // Delete post (categories will be deleted automatically due to CASCADE)
        await pool.query('DELETE FROM posts WHERE id = $1', [id]);

        // Delete thumbnail file if exists
        if (existingPost.rows[0].thumbnail_path) {
            const thumbnailPath = path.join(__dirname, '../public', existingPost.rows[0].thumbnail_path);
            try {
                await fs.unlink(thumbnailPath);
            } catch (err) {
                console.warn('Failed to delete thumbnail file:', err);
            }
        }

        res.json({
            success: true,
            message: 'Post deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete post'
        });
    }
});

// POST /api/posts/:id/upload-thumbnail - Upload thumbnail (admin only)
router.post('/:id/upload-thumbnail', upload.single('thumbnail'), async (req, res) => {
    try {
        // Check if user is authenticated and is admin
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const { id } = req.params;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        const thumbnailPath = `/thumbnails/${req.file.filename}`;

        // Update post with new thumbnail path
        const result = await pool.query(
            'UPDATE posts SET thumbnail_path = $1 WHERE id = $2 RETURNING *',
            [thumbnailPath, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Post not found'
            });
        }

        res.json({
            success: true,
            data: {
                thumbnail_path: thumbnailPath
            }
        });
    } catch (error) {
        console.error('Error uploading thumbnail:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload thumbnail'
        });
    }
});

// POST /api/posts/:id/thumbnail-from-youtube - Download thumbnail from YouTube (admin only)
router.post('/:id/thumbnail-from-youtube', async (req, res) => {
    try {
        // Check if user is authenticated and is admin
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const { id } = req.params;

        // Get post
        const postResult = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
        if (postResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Post not found'
            });
        }

        const post = postResult.rows[0];

        if (!post.youtube_id) {
            return res.status(400).json({
                success: false,
                error: 'Post does not have a YouTube ID'
            });
        }

        // Download thumbnail
        const uploadDir = path.join(__dirname, '../public/thumbnails');
        await fs.mkdir(uploadDir, { recursive: true });

        const thumbnailPath = await downloadYouTubeThumbnail(post.youtube_id, uploadDir);

        // Update post
        const result = await pool.query(
            'UPDATE posts SET thumbnail_path = $1 WHERE id = $2 RETURNING *',
            [thumbnailPath, id]
        );

        res.json({
            success: true,
            data: {
                thumbnail_path: thumbnailPath
            }
        });
    } catch (error) {
        console.error('Error downloading YouTube thumbnail:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to download YouTube thumbnail'
        });
    }
});

// POST /api/posts/:id/increment-views - Increment view count
router.post('/:id/increment-views', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'UPDATE posts SET view_count = view_count + 1 WHERE id = $1 RETURNING view_count',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Post not found'
            });
        }

        res.json({
            success: true,
            data: {
                view_count: result.rows[0].view_count
            }
        });
    } catch (error) {
        console.error('Error incrementing view count:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to increment view count'
        });
    }
});

// GET /api/categories - Get all categories
router.get('/categories/all', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM categories ORDER BY name');

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch categories'
        });
    }
});

module.exports = router;
