# Umami Analytics Setup

This guide explains how to set up and use Umami web analytics with SQLite database on your Synology NAS.

## Overview

Umami is a simple, fast, privacy-focused alternative to Google Analytics. This setup uses:
- **SQLite database** instead of PostgreSQL for simplicity
- **Local storage** on Synology NAS at `/volume1/docker/carnaby-sk/umami-data`
- **Port 3001** for the Umami web interface

## Initial Setup

### 1. Generate APP_SECRET

Generate a secure random secret for Umami:

```bash
openssl rand -base64 32
```

Add this to your `.env` file:

```bash
UMAMI_APP_SECRET=your-generated-secret-here
```

### 2. Create Data Directory on Synology

SSH into your Synology NAS and create the data directory:

```bash
mkdir -p /volume1/docker/carnaby-sk/umami-data
chown 1026:100 /volume1/docker/carnaby-sk/umami-data
```

### 3. Deploy Umami

From your project directory on Synology:

```bash
cd /volume1/docker/carnaby-sk
docker-compose up -d umami
```

### 4. First Login

1. Open your browser and navigate to `http://your-synology-ip:3001`
2. Login with default credentials:
   - **Username**: `admin`
   - **Password**: `umami`
3. **IMPORTANT**: Change the admin password immediately after first login!

## Adding a Website

1. Login to Umami dashboard
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

### SQLite Database Location

The SQLite database is stored at:
```
/volume1/docker/carnaby-sk/umami-data/umami.sqlite
```

### Adding to Backup Script

Add this path to your existing backup script to include Umami data:

```bash
# Example backup command
cp /volume1/docker/carnaby-sk/umami-data/umami.sqlite \
   /volume1/private/clouds/GoogleDrive/carnaby_sk/backups/umami-$(date +%Y%m%d).sqlite
```

### Automated Backup

You can create a simple backup script:

```bash
#!/bin/bash
# /volume1/docker/carnaby-sk/backup-umami.sh

BACKUP_DIR="/volume1/private/clouds/GoogleDrive/carnaby_sk/backups"
DB_PATH="/volume1/docker/carnaby-sk/umami-data/umami.sqlite"
DATE=$(date +%Y%m%d-%H%M%S)

# Create backup
cp "$DB_PATH" "$BACKUP_DIR/umami-$DATE.sqlite"

# Keep only last 30 days of backups
find "$BACKUP_DIR" -name "umami-*.sqlite" -mtime +30 -delete

echo "Umami backup completed: umami-$DATE.sqlite"
```

Make it executable and add to cron:
```bash
chmod +x /volume1/docker/carnaby-sk/backup-umami.sh
# Add to crontab: daily at 2 AM
0 2 * * * /volume1/docker/carnaby-sk/backup-umami.sh
```

## Maintenance

### View Logs

```bash
docker logs carnaby-umami
```

### Restart Umami

```bash
docker-compose restart umami
```

### Update Umami

Watchtower will automatically update Umami when new versions are released. To manually update:

```bash
docker-compose pull umami
docker-compose up -d umami
```

### Database Size

Check SQLite database size:

```bash
ls -lh /volume1/docker/carnaby-sk/umami-data/umami.sqlite
```

SQLite is very efficient - even with millions of page views, the database typically stays under 100MB.

## Troubleshooting

### Container Won't Start

Check logs:
```bash
docker logs carnaby-umami
```

Common issues:
- Permission problems: Ensure directory is owned by `1026:100`
- Port conflict: Make sure port 3001 is not used by another service

### Can't Access Web Interface

1. Check if container is running: `docker ps | grep umami`
2. Check firewall rules on Synology
3. Verify port mapping in `docker-compose.yml`

### Database Corruption

If SQLite database gets corrupted (rare):

1. Stop the container: `docker-compose stop umami`
2. Restore from backup
3. Start the container: `docker-compose start umami`

## Performance Notes

SQLite is suitable for Umami unless you have:
- More than 100,000 page views per day
- Multiple websites with high traffic
- Need for real-time concurrent analytics

For most personal/small business websites, SQLite performs excellently and is much easier to manage and backup than PostgreSQL.

## Security Recommendations

1. **Change default password** immediately after first login
2. **Use reverse proxy** with HTTPS in production
3. **Restrict access** to Umami dashboard (use firewall or VPN)
4. **Regular backups** - SQLite database contains all your analytics data
5. **Keep updated** - Watchtower handles this automatically

## Resources

- [Umami Documentation](https://umami.is/docs)
- [Umami GitHub](https://github.com/umami-software/umami)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
