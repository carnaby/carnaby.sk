# Google OAuth 2.0 Setup Guide

## Step 1: Create Google Cloud Project

1. Go to **Google Cloud Console**: https://console.cloud.google.com/
2. Click "Select a project" dropdown (top left)
3. Click "**New Project**"
4. Project name: `carnaby-sk`
5. Click "**Create**"
6. Wait ~30 seconds for project creation

## Step 2: Configure OAuth Consent Screen

1. Navigate to: **APIs & Services** → **OAuth consent screen**
2. Choose **User Type**: "External"
3. Click "**Create**"

### App Information:
- **App name**: `Carnaby.sk`
- **User support email**: `your-email@gmail.com`
- **App logo**: (optional)

### App Domain:
- **Application home page**: `https://carnaby.sk`
- **Application privacy policy**: `https://carnaby.sk`
- **Application terms of service**: `https://carnaby.sk`

### Developer Contact:
- **Email**: `your-email@gmail.com`

4. Click "**Save and Continue**"

### Scopes (Step 2):
5. Click "**Add or Remove Scopes**"
6. Select:
   - ✅ `userinfo.email` (See your email address)
   - ✅ `userinfo.profile` (See your personal info)
7. Click "**Update**"
8. Click "**Save and Continue**"

### Test Users (Step 3):
9. Click "**Add Users**"
10. Add your email for testing
11. Click "**Save and Continue**"

### Summary (Step 4):
12. Review and click "**Back to Dashboard**"

## Step 3: Create OAuth 2.0 Credentials

1. Navigate to: **APIs & Services** → **Credentials**
2. Click "**Create Credentials**" → "**OAuth client ID**"
3. **Application type**: "Web application"
4. **Name**: `Carnaby.sk Web Client`

### Authorized JavaScript Origins:
5. Add:
   - `http://localhost:3000` (for local development)
   - `https://carnaby.sk` (for production)

### Authorized Redirect URIs:
6. Add:
   - `http://localhost:3000/auth/google/callback` (local)
   - `https://carnaby.sk/auth/google/callback` (production)

7. Click "**Create**"

### Save Credentials:
8. **Copy Client ID**: `123456789-abc.apps.googleusercontent.com`
9. **Copy Client Secret**: `GOCSPX-abc123...`
10. Click "**OK**"

## Step 4: Update Local .env File

Create `.env` file in project root:

```bash
NODE_ENV=development
PORT=3000
DB_PATH=./data/database.sqlite

# Paste your credentials here:
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Generate session secret:
# Windows PowerShell: [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
# Linux/Mac: openssl rand -base64 32
SESSION_SECRET=your-generated-secret-here

APP_URL=http://localhost:3000
```

## Step 5: Test Locally

```bash
# Install dependencies (already done)
npm install

# Run migrations (already done)
node migrations/migration-runner.js

# Start server
npm start
```

Expected output:
```
🚀 Starting carnaby.sk server...
🔄 Starting database migrations...
⏭️  Skipping 001_initial_schema.sql (already applied)
⏭️  Skipping 002_create_users_table.sql (already applied)
🎉 Migration completed successfully!
✅ Database connected with WAL mode
✅ Session store configured
✅ Passport initialized
✅ Server is running on http://localhost:3000
```

## Step 6: Test OAuth Flow

1. Open browser: `http://localhost:3000`
2. Navigate to: `http://localhost:3000/auth/google`
3. You should see Google consent screen
4. Authorize the app
5. You should be redirected back to `http://localhost:3000`

## Step 7: Test API Endpoint

```bash
# Check if user is authenticated
curl http://localhost:3000/auth/user
```

Expected response (not authenticated):
```json
{"authenticated":false}
```

After login:
```json
{
  "authenticated": true,
  "user": {
    "id": 1,
    "email": "your-email@gmail.com",
    "displayName": "Your Name",
    "avatarUrl": "https://lh3.googleusercontent.com/..."
  }
}
```

## Step 8: Verify Database

```bash
# Check users table
sqlite3 data/database.sqlite "SELECT * FROM users;"

# Check sessions table
sqlite3 data/database.sqlite "SELECT * FROM sessions;"
```

## Next Steps

After local testing works:
1. ✅ Update production `.env` on Synology NAS
2. ✅ Add GitHub Secrets for CI/CD
3. ✅ Deploy to production
4. ✅ Test production OAuth flow

---

**When ready for production deployment, let me know and I'll guide you through Synology setup!**
