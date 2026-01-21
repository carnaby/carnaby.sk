#!/bin/bash
# Script to create carnaby database and user in PostgreSQL
# Run this ONCE on Synology NAS before deploying carnaby-web

echo "🔧 Creating carnaby database and user in PostgreSQL..."

# Create database and user
sudo docker exec -it carnaby-db psql -U postgres <<EOF
-- Create carnaby database
CREATE DATABASE carnaby;

-- Create carnaby user with same password as umami
CREATE USER carnaby WITH PASSWORD '${DB_PASSWORD}';

-- Grant all privileges on carnaby database
GRANT ALL PRIVILEGES ON DATABASE carnaby TO carnaby;

-- Connect to carnaby database
\c carnaby

-- Grant schema permissions (required for PostgreSQL 15+)
GRANT ALL ON SCHEMA public TO carnaby;

-- List databases to verify
\l

EOF

echo "✅ Carnaby database created successfully!"
echo ""
echo "Next steps:"
echo "1. Deploy updated carnaby-web container"
echo "2. Migrations will run automatically on startup"
echo "3. Verify at https://carnaby.sk"
