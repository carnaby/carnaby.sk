# Production Deployment Debugging Checklist

## Issue: Container restarts with "OAuth2Strategy requires a clientID option"

### Root Cause
The `.env` file is not being loaded by Docker Compose in production.

### Verification Steps

**1. Check if .env file exists:**
```bash
ssh carnaby@nas.local
ls -la /volume1/docker/carnaby-sk/.env
```

**2. Verify .env file location:**
The `.env` file MUST be in the same directory as `docker-compose.yml`:
```
/volume1/docker/carnaby-sk/
├── docker-compose.yml
└── .env  ← Must be here
```

**3. Check .env file permissions:**
```bash
chmod 644 /volume1/docker/carnaby-sk/.env
```

**4. Verify .env file content:**
```bash
cat /volume1/docker/carnaby-sk/.env
```

Should contain:
```env
NODE_ENV=production
PORT=3000
DB_PATH=/app/data/database.sqlite
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
GOOGLE_CALLBACK_URL=https://carnaby.sk/auth/google/callback
SESSION_SECRET=your-production-secret
APP_URL=https://carnaby.sk
```

**5. Verify docker-compose.yml has env_file:**
```bash
cat /volume1/docker/carnaby-sk/docker-compose.yml | grep -A 2 "env_file"
```

Should show:
```yaml
env_file:
  - .env
```

**6. Restart Docker Compose:**
```bash
cd /volume1/docker/carnaby-sk
docker-compose down
docker-compose up -d
```

**7. Check container logs:**
```bash
docker logs -f carnaby-sk
```

Expected output:
```
✅ Database connected with WAL mode
✅ Session store configured
✅ Passport initialized
✅ Server is running on http://localhost:3000
```

### Common Issues

**Issue A: .env file in wrong location**
- Solution: Move to `/volume1/docker/carnaby-sk/.env`

**Issue B: .env file has wrong permissions**
- Solution: `chmod 644 /volume1/docker/carnaby-sk/.env`

**Issue C: Docker Compose not restarted**
- Solution: `docker-compose down && docker-compose up -d`

**Issue D: Watchtower using old image**
- Solution: Force pull new image:
  ```bash
  docker-compose pull
  docker-compose up -d
  ```
