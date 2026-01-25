const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const filename = 'yt-p1_pl_fIBiQ.jpg';
const originalDir = path.join(__dirname, 'public/thumbnails/originals');
const filePath = path.join(originalDir, filename);

console.log('Checking file:', filePath);
if (fs.existsSync(filePath)) {
    console.log('File found!');

    // Test Sharp
    const output = path.join(__dirname, 'test-output.webp');
    sharp(filePath)
        .resize(300)
        .webp()
        .toFile(output)
        .then(() => console.log('Sharp success!'))
        .catch(err => console.error('Sharp error:', err));
} else {
    console.log('File NOT found!');
}
