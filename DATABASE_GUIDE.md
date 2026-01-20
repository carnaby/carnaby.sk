# SQLite Persistence & Migration Guide

## Overview

This document describes the SQLite persistence architecture for carnaby.sk deployed on Synology NAS. The system uses:
- **Persistent volumes** for database storage outside containers
- **Automated migrations** for schema version control
- **WAL mode** for data integrity and better concurrency
- **Automated backups** to Google Drive sync folder

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Repository                         │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  migrations/     │         │  scripts/        │         │
│  │  - 001_*.sql     │         │  - backup-db.sh  │         │
│  │  - migration-    │         └──────────────────┘         │
│  │    runner.js     │                                       │
│  └──────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ git push
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   GitHub Actions CI/CD                       │
│  1. Validate migrations (SQL syntax check)                   │
│  2. Build Docker image with migrations                       │
│  3. Push to ghcr.io                                         │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Watchtower auto-update
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Synology NAS                              │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Docker Container (carnaby-sk)                         │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  1. server.js starts                             │ │ │
│  │  │  2. migration-runner.js executes                 │ │ │
│  │  │  3. Apply new migrations to database             │ │ │
│  │  │  4. Enable WAL mode                              │ │ │
│  │  │  5. Start Express server                         │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                                                        │ │
│  │  Volumes mounted:                                      │ │
│  │  /volume1/docker/carnaby/data → /app/data            │ │
│  │  /volume1/.../backups → /app/backups                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  File System                                           │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  /volume1/docker/carnaby/data/                   │ │ │
│  │  │  ├── database.sqlite         (main database)     │ │ │
│  │  │  ├── database.sqlite-wal     (WAL file)          │ │ │
│  │  │  └── database.sqlite-shm     (shared memory)     │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  /volume1/.../GoogleDrive/carnaby_sk/backups/    │ │ │
│  │  │  ├── database_2026-01-20_03-00-00.sqlite         │ │ │
│  │  │  ├── database_2026-01-19_03-00-00.sqlite         │ │ │
│  │  │  └── ... (30 days retention)                     │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│                           │ Google Drive Sync                │
│                           ▼                                  │
│                    ☁️ Google Drive                           │
└─────────────────────────────────────────────────────────────┘
```

## Database Configuration

### WAL Mode (Write-Ahead Logging)

WAL mode is enabled automatically on every database connection:

```javascript
db.pragma('journal_mode = WAL');        // Enable WAL
db.pragma('synchronous = NORMAL');      // Balance safety/performance
db.pragma('wal_autocheckpoint = 1000'); // Checkpoint every 1000 pages
```

**Benefits:**
- ✅ Concurrent reads and writes (readers don't block writers)
- ✅ Faster write performance
- ✅ More resilient to corruption
- ✅ Better for backup scenarios

**WAL Files:**
- `database.sqlite` - Main database file
- `database.sqlite-wal` - Write-ahead log (changes not yet committed)
- `database.sqlite-shm` - Shared memory file (coordination between processes)

### Graceful Shutdown

On container stop (SIGTERM/SIGINT), the server:
1. Checkpoints the WAL file (writes all changes to main database)
2. Closes database connection cleanly
3. Exits gracefully

This ensures no data loss during container restarts or updates.

## Migration System

### How Migrations Work

1. **Migration files** are stored in `migrations/` directory
2. **Naming convention**: `001_description.sql`, `002_description.sql`, etc.
3. **Tracking table**: `schema_migrations` stores applied migration names
4. **Execution**: Migrations run automatically on server startup
5. **Idempotent**: Safe to run multiple times (skips already applied migrations)

### Migration File Format

```sql
-- migrations/002_add_description_column.sql
-- Add description field to videos

ALTER TABLE videos ADD COLUMN description TEXT;

-- Optional: Update existing data
UPDATE videos SET description = 'No description' WHERE description IS NULL;
```

### Creating New Migrations

**Step 1: Create migration file**
```bash
# On your local machine
cd c:\Users\dodus\prj\carnaby\carnaby.sk
touch migrations/002_add_description_column.sql
```

**Step 2: Write SQL**
```sql
-- migrations/002_add_description_column.sql
ALTER TABLE videos ADD COLUMN description TEXT;
```

**Step 3: Test locally**
```bash
# Run migration runner to test
node migrations/migration-runner.js

# Expected output:
# 🔄 Starting database migrations...
# 🔧 Applying migration: 002_add_description_column.sql
# ✅ Applied 002_add_description_column.sql
# 🎉 Migration completed successfully!
```

**Step 4: Commit and push**
```bash
git add migrations/002_add_description_column.sql
git commit -m "Add description column to videos table"
git push origin main
```

**Step 5: Automatic deployment**
- GitHub Actions validates migration
- Builds new Docker image
- Pushes to ghcr.io
- Watchtower detects update
- Container restarts with new migration
- Migration runs automatically on startup

### Migration Best Practices

✅ **DO:**
- Use sequential numbering (001, 002, 003...)
- Add descriptive comments in SQL files
- Test migrations locally before pushing
- Keep migrations small and focused
- Use transactions for complex migrations (migration-runner does this automatically)

❌ **DON'T:**
- Delete or modify existing migration files
- Skip migration numbers
- Put multiple unrelated changes in one migration
- Forget to test rollback strategy

### Rollback Strategies

**Option 1: Down Migration (Recommended for simple changes)**
```sql
-- migrations/002_add_description_column_down.sql
ALTER TABLE videos DROP COLUMN description;
```

**Option 2: Restore from Backup (Recommended for complex changes)**
```bash
# SSH to Synology NAS
ssh user@nas.local

# Stop container
cd /volume1/docker/carnaby
docker-compose stop carnaby-web

# Restore backup
cp /volume1/private/clouds/GoogleDrive/carnaby_sk/backups/database_2026-01-19_03-00-00.sqlite \
   /volume1/docker/carnaby/data/database.sqlite

# Start container
docker-compose start carnaby-web
```

## Backup System

### Automated Daily Backups

**Script:** `scripts/backup-db.sh`

**Features:**
- Creates timestamped SQLite backups
- Verifies backup integrity (PRAGMA integrity_check)
- Stores backups in Google Drive sync folder
- Automatic 30-day retention (deletes old backups)
- Colored console output for monitoring

### Setting Up Automated Backups

**On Synology NAS:**

1. **Make script executable:**
```bash
ssh user@nas.local
chmod +x /volume1/docker/carnaby/scripts/backup-db.sh
```

2. **Test backup manually:**
```bash
/volume1/docker/carnaby/scripts/backup-db.sh
```

Expected output:
```
🔄 Starting database backup...
📦 Creating backup: /volume1/.../backups/database_2026-01-20_10-30-00.sqlite
✅ Backup created successfully: 20K
🔍 Verifying backup integrity...
✅ Backup integrity verified
🧹 Cleaning up old backups (keeping last 30 days)...
✅ Cleanup complete. Total backups: 5
🎉 Backup completed successfully!
```

3. **Schedule via Synology Task Scheduler:**

- Open **Control Panel** → **Task Scheduler**
- Click **Create** → **Scheduled Task** → **User-defined script**
- **General:**
  - Task name: `Carnaby Database Backup`
  - User: `root` (or your admin user)
- **Schedule:**
  - Run on: Daily
  - Time: `03:00` (3 AM)
- **Task Settings:**
  - User-defined script:
    ```bash
    /volume1/docker/carnaby/scripts/backup-db.sh
    ```
- Click **OK**

4. **Verify backups are syncing to Google Drive:**
```bash
ls -lh /volume1/private/clouds/GoogleDrive/carnaby_sk/backups/
```

### Manual Backup

```bash
# SSH to Synology NAS
ssh user@nas.local

# Run backup script
/volume1/docker/carnaby/scripts/backup-db.sh
```

### Restore from Backup

```bash
# SSH to Synology NAS
ssh user@nas.local

# Stop container
cd /volume1/docker/carnaby
docker-compose stop carnaby-web

# List available backups
ls -lh /volume1/private/clouds/GoogleDrive/carnaby_sk/backups/

# Restore specific backup
cp /volume1/private/clouds/GoogleDrive/carnaby_sk/backups/database_2026-01-19_03-00-00.sqlite \
   /volume1/docker/carnaby/data/database.sqlite

# Verify permissions
chown 1026:100 /volume1/docker/carnaby/data/database.sqlite

# Start container
docker-compose start carnaby-web

# Check logs
docker logs -f carnaby-sk
```

## Deployment Workflow

### Initial Deployment (First Time)

1. **Set up directories on Synology:**
```bash
ssh user@nas.local
sudo mkdir -p /volume1/docker/carnaby/data
sudo mkdir -p /volume1/private/clouds/GoogleDrive/carnaby_sk/backups
sudo chown -R 1026:100 /volume1/docker/carnaby/data
sudo chown -R 1026:100 /volume1/private/clouds/GoogleDrive/carnaby_sk
sudo chmod -R 775 /volume1/docker/carnaby/data
sudo chmod -R 775 /volume1/private/clouds/GoogleDrive/carnaby_sk
```

2. **Deploy via docker-compose:**
```bash
cd /volume1/docker/carnaby
docker-compose pull
docker-compose up -d
```

3. **Verify deployment:**
```bash
# Check container is running
docker ps | grep carnaby-sk

# Check logs
docker logs -f carnaby-sk

# Expected output:
# 🚀 Starting carnaby.sk server...
# 🔄 Starting database migrations...
# 🔧 Applying migration: 001_initial_schema.sql
# ✅ Applied 001_initial_schema.sql
# 🎉 Migration completed successfully!
# ✅ Database connected with WAL mode
# ✅ Server is running on http://localhost:3000
```

4. **Verify database:**
```bash
# Check database files exist
ls -lh /volume1/docker/carnaby/data/

# Expected output:
# database.sqlite
# database.sqlite-wal
# database.sqlite-shm
```

### Regular Deployments (Updates)

**Automatic (via Watchtower):**
1. Push code to GitHub main branch
2. GitHub Actions builds and pushes image
3. Watchtower detects new image (within 5 minutes)
4. Container restarts automatically
5. Migrations run on startup
6. Telegram notification sent (if configured)

**Manual (if needed):**
```bash
ssh user@nas.local
cd /volume1/docker/carnaby
docker-compose pull
docker-compose up -d
```

## Monitoring & Troubleshooting

### Check Migration Status

```bash
# SSH to Synology NAS
ssh user@nas.local

# Check applied migrations
docker exec carnaby-sk sqlite3 /app/data/database.sqlite \
  "SELECT * FROM schema_migrations ORDER BY applied_at;"

# Expected output:
# 1|001_initial_schema.sql|2026-01-20 09:40:00
# 2|002_add_description_column.sql|2026-01-20 15:30:00
```

### Check WAL Mode

```bash
docker exec carnaby-sk sqlite3 /app/data/database.sqlite \
  "PRAGMA journal_mode;"

# Expected output: wal
```

### Check Database Integrity

```bash
docker exec carnaby-sk sqlite3 /app/data/database.sqlite \
  "PRAGMA integrity_check;"

# Expected output: ok
```

### View Container Logs

```bash
# Real-time logs
docker logs -f carnaby-sk

# Last 100 lines
docker logs --tail 100 carnaby-sk

# Logs since 1 hour ago
docker logs --since 1h carnaby-sk
```

### Common Issues

**Issue: Migration fails on startup**
```
❌ Failed to apply 002_*.sql: syntax error
```
**Solution:**
1. Check SQL syntax in migration file
2. Test migration locally: `node migrations/migration-runner.js`
3. Fix SQL and push again

**Issue: Database locked**
```
Error: database is locked
```
**Solution:**
1. Check if multiple processes are accessing database
2. Verify WAL mode is enabled
3. Restart container: `docker-compose restart carnaby-web`

**Issue: Permission denied**
```
Error: EACCES: permission denied, open '/app/data/database.sqlite'
```
**Solution:**
1. Check volume permissions: `ls -la /volume1/docker/carnaby/data`
2. Fix permissions: `sudo chown -R 1026:100 /volume1/docker/carnaby/data`
3. Restart container

**Issue: Backup script fails**
```
❌ Database not found: /volume1/docker/carnaby/data/database.sqlite
```
**Solution:**
1. Verify database path in script
2. Check container is running: `docker ps | grep carnaby-sk`
3. Check volume mount: `docker inspect carnaby-sk | grep Mounts -A 10`

## File Locations

### On Synology NAS

```
/volume1/docker/carnaby/
├── data/                                    # Database storage (persistent)
│   ├── database.sqlite                      # Main database
│   ├── database.sqlite-wal                  # WAL file
│   └── database.sqlite-shm                  # Shared memory
├── docker-compose.yml                       # Docker Compose config
└── scripts/
    └── backup-db.sh                         # Backup script

/volume1/private/clouds/GoogleDrive/carnaby_sk/
└── backups/                                 # Automated backups (synced to Google Drive)
    ├── database_2026-01-20_03-00-00.sqlite
    ├── database_2026-01-19_03-00-00.sqlite
    └── ... (30 days retention)
```

### In Docker Container

```
/app/
├── data/                                    # Mounted from NAS
│   └── database.sqlite
├── backups/                                 # Mounted from NAS (Google Drive sync)
├── migrations/
│   ├── 001_initial_schema.sql
│   └── migration-runner.js
├── scripts/
│   └── backup-db.sh
├── server.js                                # Main application
└── node_modules/
```

## Security Considerations

1. **Database is NOT in Google Drive sync folder** (prevents corruption)
2. **Only backups are synced to Google Drive** (safe, read-only snapshots)
3. **Container runs as non-root user** (UID 1026, GID 100)
4. **WAL mode enabled** (prevents corruption during concurrent access)
5. **Graceful shutdown** (checkpoints WAL before exit)
6. **Automated backups** (30-day retention for disaster recovery)

## Performance Considerations

- **WAL mode**: Improves write performance and concurrency
- **Checkpoint interval**: 1000 pages (balances performance and file size)
- **Synchronous mode**: NORMAL (balances safety and speed)
- **Database size**: ~20KB (very small, no performance concerns)
- **Backup impact**: Minimal (runs at 3 AM when traffic is low)

## Future Enhancements

Potential improvements for future consideration:

1. **Migration rollback automation**: Create down migrations for each up migration
2. **Backup encryption**: Encrypt backups before syncing to Google Drive
3. **Backup verification**: Automated restore tests to verify backup integrity
4. **Migration dry-run**: Test migrations without applying them
5. **Database metrics**: Track database size, query performance, etc.
6. **Backup notifications**: Send alerts when backups fail
7. **Multi-region backups**: Sync backups to multiple cloud providers

---

**Last Updated:** 2026-01-20  
**Version:** 1.0  
**Maintained by:** AI (Google Antigravity + Claude Sonnet)
