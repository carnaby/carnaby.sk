#!/bin/bash
# /volume1/docker/carnaby-sk-v2/backup-db-v2.sh
# Backs up the carnaby-sk v2 PostgreSQL database (carnaby-db-v2 container).
#
# Same destination directory and 30-day prune as v1's backup-db.sh. Umami is a separate NAS
# service with its own backups (C:\Users\dodus\work\services). The `v2-carnaby-` prefix keeps this script's prune away
# from every other file in the shared backup directory.
#
# Absolute docker path: on this NAS, non-interactive shells (cron, and `ssh host cmd`) get PATH
# /usr/bin:/bin:/usr/sbin:/sbin, which does NOT include /usr/local/bin -- that's where Synology
# Container Manager symlinks `docker` (-> /var/packages/ContainerManager/target/usr/bin/docker).
# A bare `docker` here would fail with "command not found" under DSM Task Scheduler exactly as it
# did over ssh in Task 24. No `sudo` prefix: Task 24 ran this same
# `docker exec ... pg_dump` shape non-interactively as the `carnaby` user without sudo and it
# exited 0 -- if DSM Task Scheduler ever runs this as a user without docker-group access, add
# `sudo` back in front of the docker command below.

# Fail (and leave no empty .gz) if pg_dump fails, e.g. when the container is down.
set -o pipefail

BACKUP_DIR="/volume1/private/clouds/GoogleDrive/carnaby_sk/backups"
DATE=$(date +%Y%m%d-%H%M%S)

# Backup carnaby v2 database
OUT="$BACKUP_DIR/v2-carnaby-$DATE.sql.gz"
if ! /usr/local/bin/docker exec carnaby-db-v2 pg_dump -U carnaby carnaby | gzip > "$OUT"; then
  rm -f "$OUT"
  echo "Database backup FAILED" >&2
  exit 1
fi

# Cleanup starých záloh (30+ dní) -- same prune window as v1
find "$BACKUP_DIR" -name "v2-carnaby-*.sql.gz" -mtime +30 -delete

echo "Database backup completed:"
echo "  - v2-carnaby-$DATE.sql.gz"
