const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load environment variables

/**
 * Migration Runner for PostgreSQL
 * Executes SQL migration files in order and tracks applied migrations
 */

const MIGRATIONS_DIR = path.join(__dirname);

async function runMigrations() {
    console.log('🔄 Starting database migrations...');

    // Database connection from environment variables
    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'carnaby',
        user: process.env.DB_USER || 'carnaby',
        password: process.env.DB_PASSWORD
    });

    try {
        // Connect to database
        await client.connect();
        console.log('✅ Connected to PostgreSQL');

        // Create migrations tracking table
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                migration_name VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Migration tracking table ready');

        // Get list of already applied migrations
        const result = await client.query('SELECT migration_name FROM schema_migrations');
        const appliedSet = new Set(result.rows.map(row => row.migration_name));
        console.log(`📊 Applied migrations: ${appliedSet.size}`);

        // Get all SQL files from migrations directory
        const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
            .filter(file => file.endsWith('.sql'))
            .sort(); // Alphabetical order ensures sequential execution

        console.log(`📁 Found ${migrationFiles.length} migration files`);

        // Execute pending migrations
        let executedCount = 0;

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
                await client.query('BEGIN');
                await client.query(sql);
                await client.query(
                    'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
                    [file]
                );
                await client.query('COMMIT');

                console.log(`✅ Applied ${file}`);
                executedCount++;
            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`❌ Failed to apply ${file}:`, error.message);
                await client.end();
                process.exit(1);
            }
        }

        // Get final statistics
        const stats = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM categories) as categories_count,
                (SELECT COUNT(*) FROM videos) as videos_count
        `);

        console.log('\n🎉 Migration completed successfully!');
        console.log(`📊 Executed ${executedCount} new migration(s)`);
        console.log(`📊 Database stats: ${stats.rows[0].categories_count} categories, ${stats.rows[0].videos_count} videos`);
        console.log('✅ Database connection closed\n');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await client.end();
    }
}

// Run migrations if executed directly
if (require.main === module) {
    runMigrations().catch(error => {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    });
}

module.exports = { runMigrations };
