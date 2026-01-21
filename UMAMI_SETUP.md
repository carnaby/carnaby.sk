# Umami Analytics Setup with PostgreSQL

This guide explains how to set up and use Umami web analytics with PostgreSQL database on your Synology NAS.

## Overview

Umami is a simple, fast, privacy-focused alternative to Google Analytics. This setup uses:
- **PostgreSQL 15 Alpine** - Lightweight database server
- **Local storage** on Synology NAS at `/volume1/docker/carnaby-sk/db`
- **Port 3001** for the Umami web interface

## Architecture

```
┌─────────────────┐         ┌──────────────────┐
│  Umami Web UI   │────────▶│  PostgreSQL DB   │
│  Port: 3001     │         │  umami database  │
└─────────────────┘         └──────────────────┘
```

Two containers:
- `carnaby-umami` - Web application
- `carnaby-db` - PostgreSQL database (shared with future web app)

## Initial Setup

See `UMAMI_QUICK_START.md` for step-by-step deployment instructions.

## Adding a Website

1. Login to Umami dashboard at `http://your-synology-ip:3001`
2. Click **Settings** → **Websites** → **Add website**
3. Fill in:
   - **Name**: Carnaby.sk
   - **Domain**: carnaby.sk (or your domain)
   - **Enable share URL**: Optional
4. Click **Save**
5. Copy the tracking code and add it to your website's HTML `<head>` section

## Tracking Code

Add this to your website's HTML (replace `WEBSITE_ID` with your actual ID):

```html
<script async src="http://your-synology-ip:3001/script.js" data-website-id="WEBSITE_ID"></script>
```

For production, you should:
1. Set up a reverse proxy (e.g., nginx) with a subdomain like `analytics.carnaby.sk`
2. Use HTTPS
3. Update the tracking code URL accordingly

## Backup Strategy

### PostgreSQL Backup

PostgreSQL backups are simple with `pg_dump`:

```bash
# Manual backup (compressed)
docker exec carnaby-db pg_dump -U umami umami | gzip > db-backup.sql.gz

# Restore from backup
gunzip < db-backup.sql.gz | docker exec -i carnaby-db psql -U umami umami
```

### Automated Backup Script

Create `/volume1/docker/carnaby-sk/backup-db.sh`:

```bash
#!/bin/bash
# /volume1/docker/carnaby-sk/backup-db.sh
# Backs up PostgreSQL database (Umami + future web app)

BACKUP_DIR="/volume1/private/clouds/GoogleDrive/carnaby_sk/backups"
DATE=$(date +%Y%m%d-%H%M%S)

# Backup database
sudo docker exec carnaby-db pg_dump -U umami umami | gzip > "$BACKUP_DIR/db-$DATE.sql.gz"

# Keep only last 30 days of backups
find "$BACKUP_DIR" -name "db-*.sql.gz" -mtime +30 -delete

echo "Database backup completed: db-$DATE.sql.gz"
```

Make it executable and add to Synology Task Scheduler:
```bash
chmod +x /volume1/docker/carnaby-sk/backup-db.sh
```

**Add to Synology Task Scheduler:**

1. Open **Control Panel** → **Task Scheduler**
2. Click **Create** → **Scheduled Task** → **User-defined script**
3. **General tab:**
   - Task: `Backup PostgreSQL Database`
   - User: `root` (required for Docker access)
4. **Schedule tab:**
   - Date: Daily
   - Time: `02:00` (2:00 AM)
5. **Task Settings tab:**
   - User-defined script:
     ```bash
     /volume1/docker/carnaby-sk/backup-db.sh
     ```
6. Click **OK**
```

### Database Location

PostgreSQL data is stored at:
```
/volume1/docker/carnaby-sk/db/
```

This directory should be included in your backup strategy.

## Maintenance

### View Logs

```bash
# Umami application logs
docker logs carnaby-umami

# PostgreSQL logs
docker logs carnaby-db

# Follow logs in real-time
docker logs -f carnaby-umami
```

### Restart Services

```bash
# Restart Umami only
docker-compose restart umami

# Restart database only
docker-compose restart db

# Restart both
docker-compose restart db umami
```

### Update Services

Watchtower will automatically update both services when new versions are released. To manually update:

```bash
docker-compose pull db umami
docker-compose up -d db umami
```

### Database Size

Check PostgreSQL database size:

```bash
docker exec carnaby-db psql -U umami -d umami -c "SELECT pg_size_pretty(pg_database_size('umami'));"
```

### Database Maintenance

Optimize database (vacuum):

```bash
docker exec carnaby-db psql -U umami -d umami -c "VACUUM ANALYZE;"
```

## Troubleshooting

### Password Authentication Failed

**Error:** `password authentication failed for user "umami"`

**Cause:** Password in `.env` doesn't match the password used when database was created.

**Solution 1 - Recreate Database (loses data):**

```bash
sudo docker-compose down
sudo rm -rf /volume1/docker/carnaby-sk/db
sudo mkdir -p /volume1/docker/carnaby-sk/db
sudo chown 1026:100 /volume1/docker/carnaby-sk/db
sudo docker-compose up -d
```

**Solution 2 - Change Password in Existing Database (keeps data):**

```bash
sudo docker exec -it carnaby-db psql -U postgres
ALTER USER umami WITH PASSWORD 'your-new-password-from-env';
\q
sudo docker-compose restart umami
```

### Invalid URL in DATABASE_URL

**Error:** `TypeError: Invalid URL`

**Cause:** Password contains URL-unsafe characters (`+`, `/`, `=`) from base64 encoding.

**Solution:** Generate new password using hex format:

```bash
openssl rand -hex 32
```

Update `.env` and recreate database (see above).

### Container Won't Start

Check logs:
```bash
docker logs carnaby-umami-db
docker logs carnaby-umami
```

Common issues:
- **Permission problems**: Ensure directory is owned by `1026:100`
  ```bash
  sudo chown -R 1026:100 /volume1/docker/carnaby-sk/db
  ```
- **Port conflict**: Make sure port 3001 is not used by another service
- **Database connection**: Ensure `db` is healthy before `umami` starts

### Can't Access Web Interface

1. Check if containers are running: `docker ps | grep carnaby`
2. Check firewall rules on Synology
3. Verify port mapping in `docker-compose.yml`
4. Check healthcheck status: `docker inspect carnaby-umami`

### Database Connection Errors

```bash
# Check if database is accepting connections
docker exec carnaby-db pg_isready -U umami -d umami

# Check database logs
docker logs carnaby-db
```

### Reset Admin Password

If you forgot the admin password:

```bash
# Connect to database
docker exec -it carnaby-db psql -U umami -d umami

# Reset password to 'umami'
UPDATE account SET password = '$2b$10$BUli0c.muyCW1ErNJc3jL.vFRFtFJWrT8/GcR4A.sUdCznaXiqFXa' WHERE username = 'admin';
\q
```

## Performance Notes

PostgreSQL is suitable for Umami at any scale. Benefits over SQLite:
- ✅ Better concurrent access handling
- ✅ More efficient for large datasets
- ✅ Better indexing and query optimization
- ✅ Supports multiple databases (can share with other apps)

## Security Recommendations

1. **Change default password** immediately after first login
2. **Use strong database password** - generate with `openssl rand -base64 32`
3. **Use reverse proxy** with HTTPS in production
4. **Restrict access** to Umami dashboard (use firewall or VPN)
5. **Regular backups** - PostgreSQL database contains all your analytics data
6. **Keep updated** - Watchtower handles this automatically

## Future: Sharing PostgreSQL

This PostgreSQL instance can be shared with your main Carnaby.sk application:
- Create separate database: `carnaby`
- Use same PostgreSQL container
- Simplify backup strategy (one database server)

See future migration plan for details.

## Resources

- [Umami Documentation](https://umami.is/docs)
- [Umami GitHub](https://github.com/umami-software/umami)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
