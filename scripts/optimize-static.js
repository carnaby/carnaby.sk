const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, '../images');

async function optimize() {
    console.log(`Scanning ${imagesDir}...`);
    const files = fs.readdirSync(imagesDir);

    let totalOriginal = 0;
    let totalWebP = 0;

    for (const file of files) {
        if (file.match(/\.(jpg|jpeg|png)$/i)) {
            const inputPath = path.join(imagesDir, file);
            const ext = path.extname(file);
            const name = path.basename(file, ext);
            const outputPath = path.join(imagesDir, `${name}.webp`);

            const stats = fs.statSync(inputPath);
            const originalSize = stats.size;

            // Skip if webp already exists (optional, but good for re-runs)
            // But user said "first I want to see if it's worth it", so we overwrite or generate

            console.log(`Optimizing ${file} (${(originalSize / 1024).toFixed(2)} KB)...`);

            await sharp(inputPath)
                .webp({ quality: 80 })
                .toFile(outputPath);

            const webpStats = fs.statSync(outputPath);
            const webpSize = webpStats.size;

            console.log(`  -> Generated ${name}.webp (${(webpSize / 1024).toFixed(2)} KB)`);
            console.log(`  -> Savings: ${((1 - webpSize / originalSize) * 100).toFixed(1)}%`);

            totalOriginal += originalSize;
            totalWebP += webpSize;
        }
    }

    console.log('------------------------------------------------');
    console.log(`Total Original: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total WebP:     ${(totalWebP / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total Savings:  ${((1 - totalWebP / totalOriginal) * 100).toFixed(1)}%`);
}

optimize().catch(err => console.error(err));
