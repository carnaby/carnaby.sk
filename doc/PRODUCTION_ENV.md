# Production Environment Configuration (.env)

This file should be created on Synology NAS at: `/volume1/docker/carnaby-sk/.env`

```env
# Server Configuration
NODE_ENV=production
PORT=3000

# Database
DB_PATH=/app/data/database.sqlite

# Google OAuth 2.0 (same credentials as development)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
GOOGLE_CALLBACK_URL=https://carnaby.sk/auth/google/callback

# Session Secret (DIFFERENT from development!)
# Generate with: openssl rand -base64 32
SESSION_SECRET=your-production-secret-here

# Application URL
APP_URL=https://carnaby.sk

# GitHub Container Registry
GITHUB_REPOSITORY=dodus/carnaby.sk
```

## How to create on Synology:

```bash
# SSH to Synology
ssh carnaby@nas.local

# Create .env file
nano /volume1/docker/carnaby-sk/.env

# Paste the content above with your actual values
# Save: Ctrl+O, Enter, Ctrl+X

# Verify
cat /volume1/docker/carnaby-sk/.env
```

## Important Notes:

1. **Same Google credentials** - Use the same `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as in development
2. **Different callback URL** - Production uses `https://carnaby.sk/auth/google/callback`
3. **Different session secret** - Generate a new one for production security
4. **Absolute DB path** - Production uses `/app/data/database.sqlite` (inside container)

## GitHub Secrets (for CI/CD):

Add these secrets to GitHub repository settings:

| Secret Name | Value |
|-------------|-------|
| `GOOGLE_CLIENT_ID` | `your-client-id.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-your-client-secret` |
| `SESSION_SECRET` | `your-production-secret` |

**Note:** These are only needed if you want to inject them via GitHub Actions. Currently, we use `.env` file on Synology directly.
