#!/bin/bash
# /volume1/docker/carnaby-sk/backup-db.sh
# Backs up PostgreSQL database (Umami + future web app)

BACKUP_DIR="/volume1/private/clouds/GoogleDrive/carnaby_sk/backups"
DATE=$(date +%Y%m%d-%H%M%S)

# Backup Umami database
sudo docker exec carnaby-db pg_dump -U umami umami | gzip > "$BACKUP_DIR/umami-$DATE.sql.gz"

# Backup Carnaby database
sudo docker exec carnaby-db pg_dump -U carnaby carnaby | gzip > "$BACKUP_DIR/carnaby-$DATE.sql.gz"

# Cleanup starých záloh (30+ dní)
find "$BACKUP_DIR" -name "umami-*.sql.gz" -mtime +30 -delete
find "$BACKUP_DIR" -name "carnaby-*.sql.gz" -mtime +30 -delete

echo "Database backups completed:"
echo "  - umami-$DATE.sql.gz"
echo "  - carnaby-$DATE.sql.gz"
