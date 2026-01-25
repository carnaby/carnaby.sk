const fs = require('fs');
const path = require('path');

const originalDir = path.join(__dirname, '../public/thumbnails/originals');
const legacyDir = path.join(__dirname, '../public/thumbnails');

console.log('Migrating thumbnails to originals...');

if (!fs.existsSync(originalDir)) {
    fs.mkdirSync(originalDir, { recursive: true });
}

const files = fs.readdirSync(legacyDir);
let moved = 0;

files.forEach(file => {
    const src = path.join(legacyDir, file);
    const dest = path.join(originalDir, file);
    const stats = fs.statSync(src);

    if (stats.isFile() && file !== '.gitkeep') {
        // If file not in originals, move it
        if (!fs.existsSync(dest)) {
            console.log(`Moving ${file}...`);
            fs.renameSync(src, dest);
            moved++;
        }
    }
});

console.log(`Migration complete. Moved ${moved} files.`);
