#!/bin/bash
# Update script for carnaby.sk deployment files
# Run this script to pull latest docker-compose.yml and backup-db.sh from GitHub

set -e  # Exit on error

REPO_URL="https://raw.githubusercontent.com/carnaby/carnaby.sk/main"
DEPLOY_DIR="/volume1/docker/carnaby-sk"

echo "🔄 Updating carnaby.sk deployment files..."

# Backup current files
echo "📦 Creating backups..."
cp "$DEPLOY_DIR/docker-compose.yml" "$DEPLOY_DIR/docker-compose.yml.backup.$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
cp "$DEPLOY_DIR/backup-db.sh" "$DEPLOY_DIR/backup-db.sh.backup.$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true

# Download latest files from GitHub
echo "⬇️  Downloading latest files from GitHub..."
curl -sSL "$REPO_URL/docker-compose.yml" -o "$DEPLOY_DIR/docker-compose.yml.new"
curl -sSL "$REPO_URL/backup-db.sh" -o "$DEPLOY_DIR/backup-db.sh.new"

# Verify downloads
if [ ! -s "$DEPLOY_DIR/docker-compose.yml.new" ]; then
    echo "❌ Failed to download docker-compose.yml"
    exit 1
fi

if [ ! -s "$DEPLOY_DIR/backup-db.sh.new" ]; then
    echo "❌ Failed to download backup-db.sh"
    exit 1
fi

# Replace old files with new ones
echo "✅ Replacing files..."
mv "$DEPLOY_DIR/docker-compose.yml.new" "$DEPLOY_DIR/docker-compose.yml"
mv "$DEPLOY_DIR/backup-db.sh.new" "$DEPLOY_DIR/backup-db.sh"
chmod +x "$DEPLOY_DIR/backup-db.sh"

echo ""
echo "✅ Update completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Review changes: diff docker-compose.yml docker-compose.yml.backup.*"
echo "2. Restart services: sudo docker-compose up -d"
echo ""
echo "💡 Backups saved as:"
echo "   - docker-compose.yml.backup.*"
echo "   - backup-db.sh.backup.*"
