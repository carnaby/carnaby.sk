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
        const uploadDir = path.join(__dirname, '../public/thumbnails/originals');
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
async function downloadYouTubeThumbnail(videoId, savePath) {
    // Ensure directory exists
    try {
        await fs.mkdir(savePath, { recursive: true });
    } catch (error) {
        console.error('Error creating directory:', error);
        throw error;
    }

    return new Promise((resolve, reject) => {
        const url = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        const filePath = path.join(savePath, `yt-${videoId}.jpg`);

        try {
            const file = require('fs').createWriteStream(filePath);

            file.on('error', (err) => {
                console.error('File write stream error:', err);
                reject(err);
            });

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
                console.error('HTTPS request error:', err);
                require('fs').unlink(filePath, () => { }); // Delete incomplete file
                reject(err);
            });
        } catch (error) {
            reject(error);
        }
    });
}

// GET /api/posts - Get all posts with optional filters
// GET /api/posts - Get all posts with optional filters
router.get('/', async (req, res) => {
    try {
        const {
            status,
            category,
            featured,
            language = 'en', // Default to English as per user preference
            limit = 50,
            page = 1,
            sortBy = 'created_at',
            order = 'DESC'
        } = req.query;

        // Calculate offset from page and limit
        const limitVal = parseInt(limit);
        const pageVal = parseInt(page);
        const offsetVal = (pageVal - 1) * limitVal;

        // Validation for sorting
        const allowedSortColumns = ['title', 'status', 'published_at', 'views', 'created_at', 'view_count'];
        let sortCol = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';

        // Map frontend sort keys to database columns
        if (sortCol === 'views') sortCol = 'view_count';
        if (sortCol === 'date') sortCol = 'created_at';

        const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // Base query conditions
        let whereConditions = ['1=1'];
        const params = [];
        let paramIndex = 1;

        if (status) {
            whereConditions.push(`p.status = $${paramIndex++}`);
            params.push(status);
        }

        if (category) {
            whereConditions.push(`c.slug = $${paramIndex++}`);
            params.push(category);
        }

        if (featured !== undefined) {
            whereConditions.push(`p.is_featured = $${paramIndex++}`);
            params.push(featured === 'true');
        }

        // Language filter is applied at the JOIN level usually, or selection level
        // Here we select the specific translation.

        const whereClause = whereConditions.join(' AND ');

        // 1. Get Total Count
        const countQuery = `
            SELECT COUNT(DISTINCT p.id) 
            FROM posts p
            LEFT JOIN post_categories pc ON p.id = pc.post_id
            LEFT JOIN categories c ON pc.category_id = c.id
            WHERE ${whereClause}
        `;

        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);

        // 2. Get Data with Translation Fallback
        // Priority: 
        // 1. Translation in requested 'language'
        // 2. Translation in 'en' (default)
        // 3. Original column in 'posts' (legacy fallback)
        const query = `
            SELECT 
                p.id, p.slug, p.thumbnail_path, p.youtube_id, p.soundcloud_url, 
                p.author_id, p.created_at, p.updated_at, p.published_at, 
                p.view_count, p.status, p.is_featured,
                
                -- Title Fallback
                COALESCE(pt_req.title, pt_en.title, p.title) as title,
                
                -- Content Fallback
                COALESCE(pt_req.content, pt_en.content, p.content) as content,
                
                -- Excerpt Fallback
                COALESCE(pt_req.excerpt, pt_en.excerpt, p.excerpt) as excerpt,

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
            
            -- Join requested language
            LEFT JOIN post_translations pt_req ON p.id = pt_req.post_id AND pt_req.language = $${paramIndex}
            
            -- Join default language (EN)
            LEFT JOIN post_translations pt_en ON p.id = pt_en.post_id AND pt_en.language = 'en'
            
            WHERE ${whereClause}
            GROUP BY p.id, u.display_name, u.email, pt_req.title, pt_req.content, pt_req.excerpt, pt_en.title, pt_en.content, pt_en.excerpt
            ORDER BY p.${sortCol} ${sortOrder} NULLS LAST
            LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
        `;

        // Add language, limit, offset params
        const dataParams = [...params, language, limitVal, offsetVal];
        const result = await pool.query(query, dataParams);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                total,
                page: pageVal,
                limit: limitVal,
                totalPages: Math.ceil(total / limitVal)
            }
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
            WITH post_cats AS (
                SELECT pc.post_id, 
                       json_agg(json_build_object('id', c.id, 'name', c.name, 'slug', c.slug)) as categories
                FROM post_categories pc
                JOIN categories c ON pc.category_id = c.id
                WHERE pc.post_id = $1
                GROUP BY pc.post_id
            ),
            post_trans AS (
                SELECT post_id, 
                       json_object_agg(
                           language,
                           json_build_object(
                               'title', title,
                               'content', content,
                               'excerpt', excerpt,
                               'meta_description', meta_description
                           )
                       ) as translations
                FROM post_translations
                WHERE post_id = $1
                GROUP BY post_id
            )
            SELECT 
                p.*,
                u.display_name as author_name,
                u.email as author_email,
                COALESCE(pc.categories, '[]'::json) as categories,
                COALESCE(pt.translations, '{}'::json) as translations
            FROM posts p
            LEFT JOIN users u ON p.author_id = u.id
            LEFT JOIN post_cats pc ON p.id = pc.post_id
            LEFT JOIN post_trans pt ON p.id = pt.post_id
            WHERE p.id = $1
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

        const { language = 'en' } = req.query; // Language param

        const query = `
            SELECT 
                p.id, p.slug, p.thumbnail_path, p.youtube_id, p.soundcloud_url, 
                p.author_id, p.created_at, p.updated_at, p.published_at, 
                p.view_count, p.status, p.is_featured,
                
                -- Title Fallback
                COALESCE(pt_req.title, pt_en.title, p.title) as title,
                
                -- Content Fallback
                COALESCE(pt_req.content, pt_en.content, p.content) as content,
                
                -- Excerpt Fallback
                COALESCE(pt_req.excerpt, pt_en.excerpt, p.excerpt) as excerpt,
                
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
            
             -- Join requested language
            LEFT JOIN post_translations pt_req ON p.id = pt_req.post_id AND pt_req.language = $2
            
            -- Join default language (EN)
            LEFT JOIN post_translations pt_en ON p.id = pt_en.post_id AND pt_en.language = 'en'
            
            WHERE p.slug = $1
            GROUP BY p.id, u.display_name, u.email, pt_req.title, pt_req.content, pt_req.excerpt, pt_en.title, pt_en.content, pt_en.excerpt
        `;

        const result = await pool.query(query, [slug, language]);

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
    const client = await pool.connect();
    try {
        // Check if user is authenticated and is admin
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const {
            translations = {}, // { en: {title, content...}, sk: {title, content...} }
            slug: customSlug,
            youtube_id,
            soundcloud_url,
            status = 'draft',
            is_featured = false,
            categories = []
        } = req.body;

        // Validation: Need at least one language with a title
        const langs = Object.keys(translations);
        if (langs.length === 0 || !translations[langs[0]].title) {
            return res.status(400).json({
                success: false,
                error: 'At least one language with a title is required'
            });
        }

        // Pick primary content for main table Legacy columns (prefer EN, then SK, then first avail)
        const primaryLang = translations['en'] ? 'en' : (translations['sk'] ? 'sk' : langs[0]);
        const primaryContent = translations[primaryLang];

        // Generate slug if not provided
        const slug = customSlug || generateSlug(primaryContent.title);

        // Set published_at if status is 'published'
        const published_at = status === 'published' ? new Date() : null;

        await client.query('BEGIN');

        // Insert post (with fallback content in legacy columns)
        const insertQuery = `
            INSERT INTO posts (
                title, slug, content, excerpt, youtube_id, soundcloud_url,
                author_id, status, is_featured, meta_description, published_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `;

        const result = await client.query(insertQuery, [
            primaryContent.title, slug, primaryContent.content, primaryContent.excerpt, youtube_id, soundcloud_url,
            req.user.id, status, is_featured, primaryContent.meta_description, published_at
        ]);

        const post = result.rows[0];

        // Insert translations
        for (const [lang, data] of Object.entries(translations)) {
            if (!data.title) continue; // Skip incomplete
            await client.query(
                `INSERT INTO post_translations (post_id, language, title, content, excerpt, meta_description)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (post_id, language) DO UPDATE SET
                    title = EXCLUDED.title,
                    content = EXCLUDED.content,
                    excerpt = EXCLUDED.excerpt,
                    meta_description = EXCLUDED.meta_description`,
                [post.id, lang, data.title, data.content, data.excerpt, data.meta_description]
            );
        }

        // Insert categories
        if (categories.length > 0) {
            const categoryInserts = categories.map((categoryId) => {
                return client.query(
                    'INSERT INTO post_categories (post_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [post.id, categoryId]
                );
            });
            await Promise.all(categoryInserts);
        }

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            data: post
        });
    } catch (error) {
        await client.query('ROLLBACK');
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
    } finally {
        client.release();
    }
});

// PUT /api/posts/:id - Update post (admin only)
router.put('/:id', async (req, res) => {
    const client = await pool.connect();
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
            translations = {}, // { en: {title...}, sk: {title...} }
            slug,
            thumbnail_path,
            youtube_id,
            soundcloud_url,
            status,
            is_featured,
            categories = []
        } = req.body;

        // Check if post exists
        const existingPost = await client.query('SELECT * FROM posts WHERE id = $1', [id]);
        if (existingPost.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Post not found'
            });
        }

        // Determine primary content for legacy updates (prefer EN, then SK, then whatever came in)
        // If translations are provided, use them. If not, fallback to existing to avoid nulling out.
        const langs = Object.keys(translations);
        let primaryContent = null;
        if (langs.length > 0) {
            const primaryLang = translations['en'] ? 'en' : (translations['sk'] ? 'sk' : langs[0]);
            primaryContent = translations[primaryLang];
        }

        // Regenerate slug if empty and title is provided (in primary content)
        let slugToUpdate = slug;
        if ((!slugToUpdate || slugToUpdate.trim() === '') && primaryContent && primaryContent.title) {
            slugToUpdate = generateSlug(primaryContent.title);
        }

        // Update published_at if status changed to 'published'
        let published_at = existingPost.rows[0].published_at;
        if (status === 'published' && existingPost.rows[0].status !== 'published') {
            published_at = new Date();
        }

        await client.query('BEGIN');

        // Update main post (legacy fallback columns + common metadata)
        // Only update legacy text columns if primaryContent is resolved from translations
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

        const result = await client.query(updateQuery, [
            primaryContent ? primaryContent.title : null,
            slugToUpdate,
            primaryContent ? primaryContent.content : null,
            primaryContent ? primaryContent.excerpt : null,
            thumbnail_path, youtube_id,
            soundcloud_url, status, is_featured,
            primaryContent ? primaryContent.meta_description : null,
            published_at, id
        ]);

        // Upsert translations
        for (const [lang, data] of Object.entries(translations)) {
            // If a language object is provided but empty, we might typically skip it, 
            // but here we check for title as a minimum for validity or just update fields
            if (!data) continue;

            await client.query(
                `INSERT INTO post_translations (post_id, language, title, content, excerpt, meta_description)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (post_id, language) DO UPDATE SET
                    title = COALESCE(EXCLUDED.title, post_translations.title),
                    content = COALESCE(EXCLUDED.content, post_translations.content),
                    excerpt = COALESCE(EXCLUDED.excerpt, post_translations.excerpt),
                    meta_description = COALESCE(EXCLUDED.meta_description, post_translations.meta_description)`,
                [id, lang, data.title, data.content, data.excerpt, data.meta_description]
            );
        }

        // Update categories
        if (categories.length >= 0) {
            // Delete existing categories
            await client.query('DELETE FROM post_categories WHERE post_id = $1', [id]);

            // Insert new categories
            if (categories.length > 0) {
                const categoryInserts = categories.map((categoryId) => {
                    return client.query(
                        'INSERT INTO post_categories (post_id, category_id) VALUES ($1, $2)',
                        [id, categoryId]
                    );
                });
                await Promise.all(categoryInserts);
            }
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating post:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update post'
        });
    } finally {
        client.release();
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
        const uploadDir = path.join(__dirname, '../public/thumbnails/originals');
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
