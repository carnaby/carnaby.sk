# Local Development with Docker

## Quick Start

```bash
# 1. Install dependencies locally (for IDE autocomplete)
npm install

# 2. Create .env file (copy from .env.example)
cp .env.example .env
# Edit .env and fill in your values

# 3. Start development environment
docker-compose -f docker-compose.dev.yml up

# 4. Access application
# Web: http://localhost:3000
# Umami: http://localhost:3001
# PostgreSQL: localhost:5432
```

## Features

✅ **Hot Reload:** Code changes automatically restart the server (nodemon)  
✅ **Volume Mounts:** Edit files locally, changes reflect immediately in container  
✅ **PostgreSQL:** Shared database for web app and Umami  
✅ **Port Exposure:** Access PostgreSQL with local tools (pgAdmin, DBeaver, etc.)  
✅ **Isolated Database:** Separate dev database (won't affect production)

## Development Workflow

### First Time Setup

```bash
# 1. Start containers
docker-compose -f docker-compose.dev.yml up -d

# 2. Create carnaby database
docker exec carnaby-db-dev psql -U umami -c "CREATE DATABASE carnaby;"
docker exec carnaby-db-dev psql -U umami -c "CREATE USER carnaby WITH PASSWORD 'your-password';"
docker exec carnaby-db-dev psql -U umami -c "GRANT ALL PRIVILEGES ON DATABASE carnaby TO carnaby;"
docker exec carnaby-db-dev psql -U umami -d carnaby -c "GRANT ALL ON SCHEMA public TO carnaby;"

# 3. Migrations run automatically on server start
# Check logs: docker logs -f carnaby-sk-dev
```

### Daily Development

```bash
# Start containers
docker-compose -f docker-compose.dev.yml up

# Make changes to code
# Server automatically restarts on file changes

# Stop containers (Ctrl+C or)
docker-compose -f docker-compose.dev.yml down
```

### Database Management

```bash
# Connect to PostgreSQL
docker exec -it carnaby-db-dev psql -U carnaby carnaby

# View tables
\dt

# Query data
SELECT * FROM videos;

# Exit
\q
```

### Reset Database

```bash
# Stop containers
docker-compose -f docker-compose.dev.yml down

# Remove database volume
docker volume rm carnaby.sk_carnaby-db-dev

# Start fresh
docker-compose -f docker-compose.dev.yml up
# Recreate carnaby database (see First Time Setup)
```

## File Structure

```
carnaby.sk/
├── docker-compose.yml          # Production config
├── docker-compose.dev.yml      # Development config (this one!)
├── Dockerfile                  # Production build
├── .env                        # Your local environment (gitignored)
├── .env.example                # Template for .env
├── server.js                   # Main application (hot reload enabled)
├── config/                     # Configuration files
├── migrations/                 # Database migrations
├── routes/                     # API routes
└── ...
```

## Volume Mounts Explained

```yaml
volumes:
  - ./:/app              # Mount entire project to /app
  - /app/node_modules    # Exclude node_modules (use container's)
```

**Why exclude node_modules?**
- Container uses Linux binaries (e.g., `pg` native modules)
- Your local machine might be Windows/Mac
- Prevents binary compatibility issues

## Nodemon Configuration

Nodemon watches for file changes and automatically restarts the server.

**Watched files:**
- `*.js` (server.js, routes/, config/, etc.)
- `*.json` (package.json)
- `*.sql` (migrations/)

**Ignored files:**
- `node_modules/`
- `.git/`
- `*.log`

## Troubleshooting

### Port Already in Use

**Error:** `Bind for 0.0.0.0:3000 failed: port is already allocated`

**Solution:**
```bash
# Find process using port 3000
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Mac/Linux

# Kill process or change port in docker-compose.dev.yml
ports:
  - "3001:3000"  # Use port 3001 instead
```

### Database Connection Failed

**Error:** `Migration failed: connection refused`

**Solution:**
```bash
# Check if database is running
docker ps | grep carnaby-db-dev

# Check database logs
docker logs carnaby-db-dev

# Ensure carnaby database exists
docker exec carnaby-db-dev psql -U umami -c "\l"
```

### Code Changes Not Reflecting

**Error:** Changes to code don't trigger restart

**Solution:**
```bash
# Check if volume is mounted correctly
docker exec carnaby-sk-dev ls -la /app

# Restart container
docker-compose -f docker-compose.dev.yml restart carnaby-web

# Check nodemon logs
docker logs -f carnaby-sk-dev
```

### Permission Issues (Windows)

**Error:** `EACCES: permission denied`

**Solution:**
```bash
# Ensure Docker Desktop has access to your drive
# Settings → Resources → File Sharing → Add C:\

# Or run Docker Desktop as Administrator
```

## Production vs Development

| Feature | Production | Development |
|---------|-----------|-------------|
| Config File | `docker-compose.yml` | `docker-compose.dev.yml` |
| Image | Pre-built from GitHub | Built locally |
| Volumes | None (code in image) | Mounted (hot reload) |
| Auto-restart | Watchtower | Nodemon |
| Database | Persistent volume | Named volume (easy reset) |
| Ports | 3000, 3001 | 3000, 3001, 5432 |
| NODE_ENV | `production` | `development` |

## Tips

💡 **Use VS Code Remote Containers:** Edit files locally, run in container  
💡 **PostgreSQL GUI:** Connect to `localhost:5432` with pgAdmin/DBeaver  
💡 **Keep .env local:** Never commit `.env` to git  
💡 **Use nodemon:** Faster development with auto-restart  
💡 **Separate databases:** Dev database won't affect production

## Next Steps

After development:
1. Test changes locally
2. Commit to git
3. Push to GitHub
4. GitHub Actions builds production image
5. Watchtower deploys to NAS automatically

Happy coding! 🚀
