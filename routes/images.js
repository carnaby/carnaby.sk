const express = require('express');
const router = express.Router();
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { existsSync } = require('fs');

// Allowed widths to prevent abuse
const ALLOWED_WIDTHS = [300, 600, 1200, 1920];
const QUALITY = 80;

// ensure directory exists
async function ensureDir(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

// GET /images/:width/:filename
// Example: /images/600/thumb-123456.jpg
router.get('/:width/:filename', async (req, res) => {
    try {
        const width = parseInt(req.params.width);
        const filename = req.params.filename;

        // 1. Validation
        if (!ALLOWED_WIDTHS.includes(width)) {
            return res.status(400).send(`Invalid width. Allowed: ${ALLOWED_WIDTHS.join(', ')}`);
        }

        // Paths
        // Source is in public/thumbnails/originals/ OR just public/thumbnails/ (legacy - we moved them all to originals)
        // BUT newly uploaded files via standard flow currently go to public/thumbnails/
        // WE NEED TO DECIDE: Do we change upload destination? Or look in multiple places?
        // STRATEGY: Look in 'originals', if not found look in 'thumbnails' (root).
        // Ideally we should update upload flow to put everything in 'originals'.

        const originalDir = path.join(__dirname, '../public/thumbnails/originals');
        const legacyDir = path.join(__dirname, '../public/thumbnails');
        const cacheDir = path.join(__dirname, '../public/cache', width.toString());

        const originalPath = path.join(originalDir, filename);
        const legacyPath = path.join(legacyDir, filename);

        // Output path (always .webp)
        const cachedFilename = `${path.parse(filename).name}.webp`;
        const cachedPath = path.join(cacheDir, cachedFilename);

        // 2. Check Cache
        if (existsSync(cachedPath)) {
            return res.sendFile(cachedPath);
        }

        // 3. Find Original
        let sourcePath = null;
        if (existsSync(originalPath)) {
            sourcePath = originalPath;
        } else if (existsSync(legacyPath)) {
            sourcePath = legacyPath;
        } else {
            return res.status(404).send('Image not found');
        }

        // 4. Process Image (Resize + Convert to WebP)
        await ensureDir(cacheDir);

        await sharp(sourcePath)
            .resize(width, null, { // null height = auto aspect ratio
                withoutEnlargement: true // don't upscale small images
            })
            .webp({ quality: QUALITY })
            .toFile(cachedPath);

        // 5. Serve
        return res.sendFile(cachedPath);

    } catch (error) {
        console.error('Image optimization error:', error);
        res.status(500).send('Error processing image');
    }
});

module.exports = router;
