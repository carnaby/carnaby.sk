const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

/**
 * Migration Runner for SQLite
 * Executes SQL migration files in order and tracks applied migrations
 */

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'database.sqlite');
const MIGRATIONS_DIR = path.join(__dirname);

function runMigrations() {
    console.log('🔄 Starting database migrations...');
    console.log(`📂 Database path: ${DB_PATH}`);

    // Ensure data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log(`✅ Created data directory: ${dataDir}`);
    }

    // Open database connection
    const db = new Database(DB_PATH);

    // Enable WAL mode for better concurrency and data integrity
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('wal_autocheckpoint = 1000');
    console.log('✅ WAL mode enabled');

    // Create migrations tracking table
    db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            migration_name TEXT NOT NULL UNIQUE,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('✅ Migration tracking table ready');

    // Get list of already applied migrations
    const appliedMigrations = db.prepare('SELECT migration_name FROM schema_migrations').all();
    const appliedSet = new Set(appliedMigrations.map(m => m.migration_name));
    console.log(`📊 Applied migrations: ${appliedSet.size}`);

    // Get all SQL files from migrations directory
    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
        .filter(file => file.endsWith('.sql'))
        .sort(); // Alphabetical order ensures sequential execution

    console.log(`📁 Found ${migrationFiles.length} migration files`);

    // Execute pending migrations
    let executedCount = 0;
    const insertMigration = db.prepare('INSERT INTO schema_migrations (migration_name) VALUES (?)');

    for (const file of migrationFiles) {
        if (appliedSet.has(file)) {
            console.log(`⏭️  Skipping ${file} (already applied)`);
            continue;
        }

        console.log(`🔧 Applying migration: ${file}`);
        const migrationPath = path.join(MIGRATIONS_DIR, file);
        const sql = fs.readFileSync(migrationPath, 'utf8');

        try {
            // Execute migration in a transaction
            const applyMigration = db.transaction(() => {
                db.exec(sql);
                insertMigration.run(file);
            });

            applyMigration();
            console.log(`✅ Applied ${file}`);
            executedCount++;
        } catch (error) {
            console.error(`❌ Failed to apply ${file}:`, error.message);
            db.close();
            process.exit(1);
        }
    }

    // Get final statistics
    const stats = db.prepare(`
        SELECT 
            (SELECT COUNT(*) FROM categories) as categories_count,
            (SELECT COUNT(*) FROM videos) as videos_count
    `).get();

    db.close();

    console.log('\n🎉 Migration completed successfully!');
    console.log(`📊 Executed ${executedCount} new migration(s)`);
    console.log(`📊 Database stats: ${stats.categories_count} categories, ${stats.videos_count} videos`);
    console.log('✅ Database connection closed\n');
}

// Run migrations if executed directly
if (require.main === module) {
    try {
        runMigrations();
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

module.exports = { runMigrations };
