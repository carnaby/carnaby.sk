#!/bin/bash
#
# SQLite Database Backup Script for Synology NAS
# Backs up carnaby.sk database to Google Drive sync folder
#
# Usage: 
#   Manual: ./backup-db.sh
#   Cron: 0 3 * * * /volume1/docker/carnaby/scripts/backup-db.sh
#

set -e  # Exit on error

# Configuration
DB_PATH="/volume1/docker/carnaby/data/database.sqlite"
BACKUP_DIR="/volume1/private/clouds/GoogleDrive/carnaby_sk/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="${BACKUP_DIR}/database_${TIMESTAMP}.sqlite"
RETENTION_DAYS=30

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔄 Starting database backup...${NC}"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}❌ Database not found: $DB_PATH${NC}"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create backup using SQLite .backup command (ensures consistency)
echo -e "${YELLOW}📦 Creating backup: $BACKUP_FILE${NC}"
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

# Verify backup was created
if [ -f "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✅ Backup created successfully: $BACKUP_SIZE${NC}"
else
    echo -e "${RED}❌ Backup failed!${NC}"
    exit 1
fi

# Verify backup integrity
echo -e "${YELLOW}🔍 Verifying backup integrity...${NC}"
if sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" | grep -q "ok"; then
    echo -e "${GREEN}✅ Backup integrity verified${NC}"
else
    echo -e "${RED}❌ Backup integrity check failed!${NC}"
    rm "$BACKUP_FILE"
    exit 1
fi

# Clean up old backups (keep last 30 days)
echo -e "${YELLOW}🧹 Cleaning up old backups (keeping last ${RETENTION_DAYS} days)...${NC}"
find "$BACKUP_DIR" -name "database_*.sqlite" -type f -mtime +${RETENTION_DAYS} -delete
REMAINING_BACKUPS=$(find "$BACKUP_DIR" -name "database_*.sqlite" -type f | wc -l)
echo -e "${GREEN}✅ Cleanup complete. Total backups: ${REMAINING_BACKUPS}${NC}"

# Display backup statistics
echo -e "\n${GREEN}📊 Backup Statistics:${NC}"
echo -e "  Database: $DB_PATH"
echo -e "  Backup: $BACKUP_FILE"
echo -e "  Size: $BACKUP_SIZE"
echo -e "  Total backups: $REMAINING_BACKUPS"
echo -e "  Retention: ${RETENTION_DAYS} days"

echo -e "\n${GREEN}🎉 Backup completed successfully!${NC}"
