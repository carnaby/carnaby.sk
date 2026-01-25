const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '../style.css');
const outputFile = path.join(__dirname, '../style.min.css');

function minifyCSS() {
    try {
        if (!fs.existsSync(inputFile)) {
            console.warn('⚠️ style.css not found, skipping minification.');
            return;
        }

        let css = fs.readFileSync(inputFile, 'utf8');
        const originalSize = css.length;

        // Remove comments
        css = css.replace(/\/\*[\s\S]*?\*\//g, '');

        // Remove extra whitespace
        css = css.replace(/\s+/g, ' ');

        // Remove space before/after brackets/colons/semicolons
        css = css.replace(/\s?([\{\}\:\;])\s?/g, '$1');

        // Remove last semicolon in block
        css = css.replace(/;\}/g, '}');

        fs.writeFileSync(outputFile, css);
        const minifiedSize = css.length;

        console.log(`🎨 CSS Minified: ${(originalSize / 1024).toFixed(2)} KB -> ${(minifiedSize / 1024).toFixed(2)} KB (-${((1 - minifiedSize / originalSize) * 100).toFixed(0)}%)`);
    } catch (err) {
        console.error('❌ Error minifying CSS:', err);
    }
}

module.exports = { minifyCSS, inputFile };
