#!/bin/bash
# /volume1/docker/carnaby-sk-v2/backup-db-v2.sh
# Backs up the carnaby-sk v2 PostgreSQL database (carnaby-db-v2 container).
#
# Ported from v1's backup-db.sh (`git show carnaby-sk-origin:backup-db.sh`): same destination
# directory and same 30-day prune logic, retargeted at the v2 stack's single `carnaby` database
# (v2 has no separate Umami database to back up -- Umami still lives in the OLD carnaby-db
# container and is covered by the OLD backup-db.sh, which keeps running independently). The
# `v2-carnaby-` filename prefix ensures this script's output is distinct from v1's `carnaby-*.sql.gz`
# files: v1's glob pattern does NOT match `v2-carnaby-*`, so the two scripts' 30-day prunes are
# isolated and never touch each other's files.
#
# Absolute docker path: on this NAS, non-interactive shells (cron, and `ssh host cmd`) get PATH
# /usr/bin:/bin:/usr/sbin:/sbin, which does NOT include /usr/local/bin -- that's where Synology
# Container Manager symlinks `docker` (-> /var/packages/ContainerManager/target/usr/bin/docker).
# A bare `docker` here would fail with "command not found" under DSM Task Scheduler exactly as it
# did over ssh in Task 24. No `sudo` prefix: Task 24 ran this same
# `docker exec ... pg_dump` shape non-interactively as the `carnaby` user without sudo and it
# exited 0 -- if DSM Task Scheduler ever runs this as a user without docker-group access, add
# `sudo` back in front of the docker command below.

BACKUP_DIR="/volume1/private/clouds/GoogleDrive/carnaby_sk/backups"
DATE=$(date +%Y%m%d-%H%M%S)

# Backup carnaby v2 database
/usr/local/bin/docker exec carnaby-db-v2 pg_dump -U carnaby carnaby | gzip > "$BACKUP_DIR/v2-carnaby-$DATE.sql.gz"

# Cleanup starých záloh (30+ dní) -- same prune window as v1
find "$BACKUP_DIR" -name "v2-carnaby-*.sql.gz" -mtime +30 -delete

echo "Database backup completed:"
echo "  - v2-carnaby-$DATE.sql.gz"
