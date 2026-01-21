#!/bin/bash
# /volume1/docker/carnaby-sk/backup-db.sh
# Backs up PostgreSQL database (Umami + future web app)

BACKUP_DIR="/volume1/private/clouds/GoogleDrive/carnaby_sk/backups"
DATE=$(date +%Y%m%d-%H%M%S)

# Backup databázy
sudo docker exec carnaby-db pg_dump -U umami umami | gzip > "$BACKUP_DIR/db-$DATE.sql.gz"

# Cleanup starých záloh (30+ dní)
find "$BACKUP_DIR" -name "db-*.sql.gz" -mtime +30 -delete

echo "Database backup completed: db-$DATE.sql.gz"
