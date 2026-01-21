# Commit 13: Google OAuth 2.0 Authentication

**Date:** 2026-01-20  
**Time:** ~3 hours (planning, implementation, debugging, testing)  
**Complexity:** High (authentication, sessions, security)

## Original Prompt (Slovak)

```
Máme stabilizovanú databázu a deployment, teraz ideme pridať autentifikáciu cez Google (OAuth 2.0).

Požiadavky na implementáciu:

UI/UX: Vľavo hore v navigácii (alebo v hlavičke) pridaj tlačidlo 'Prihlásiť sa cez Google'. 
Po úspešnom prihlásení sa namiesto tlačidla zobrazí okrúhly avatar (fotka z Google profilu) 
a meno používateľa, presne podľa dizajnového štýlu Google stránok.

Backend (Node.js/Express):
- Použi knižnicu passport alebo google-auth-library.
- Implementuj endpointy pre /auth/google, callback a odhlásenie.
- Po prihlásení vytvor reláciu (session) alebo použi JWT token.

Databáza (SQLite + Migrácie):
- Vytvor novú migráciu 002_create_users_table.sql.
- Tabuľka users musí ukladať: google_id, email, display_name a avatar_url.
- Pri prvom prihlásení nového používateľa ho automaticky ulož do databázy (JIT provisioning).

Bezpečnosť: Citlivé údaje (Google Client ID a Secret) nesmú byť v kóde, ale v súbore .env.
```

## Technology Stack Decision

**Chosen: Passport.js + Express Sessions** (not JWT)

**Reasons:**
- ✅ Industry standard for Node.js authentication
- ✅ Session management built-in (better for logout)
- ✅ Server-side sessions more secure than JWT
- ✅ Sessions persist across container restarts (SQLite store)

## Implementation Summary

### Files Created (6):
1. `config/passport.js` - Passport.js configuration with Google OAuth strategy
2. `routes/auth.js` - Authentication routes (/auth/google, /callback, /logout, /user)
3. `middleware/auth.js` - Authentication middleware
4. `migrations/002_create_users_table.sql` - Users table migration
5. `GOOGLE_OAUTH_SETUP.md` - Google Cloud Console setup guide
6. `PRODUCTION_ENV.md` - Production environment configuration

### Files Modified (6):
1. `package.json` - Added 5 dependencies (passport, passport-google-oauth20, express-session, better-sqlite3-session-store, dotenv)
2. `server.js` - Session + Passport initialization
3. `index.html` - Authentication UI (Google button + avatar)
4. `style.css` - Google-style authentication styles
5. `script.js` - Authentication logic + translations
6. `.env.example` - OAuth environment variables

### Dependencies Added:
- `passport` - Authentication middleware
- `passport-google-oauth20` - Google OAuth 2.0 strategy
- `express-session` - Session management
- `better-sqlite3-session-store` - SQLite session store
- `dotenv` - Environment variable loading

## Debugging Journey

### Issue 1: Missing dotenv package
**Error:** `Cannot find module 'dotenv'`  
**Solution:** Added `dotenv` package and `require('dotenv').config()` at top of entry files.

### Issue 2: Database connection before migrations
**Error:** `Cannot open database because the directory does not exist`  
**Solution:** Refactored `passport.js` to accept database connection as parameter.

### Issue 3: Wrong callback URL
**Error:** `Cannot GET /auth/google/callback`  
**Solution:** Changed local `.env` to use `http://localhost:3000/auth/google/callback`.

### Issue 4: Avatar not loading
**Error:** Avatar image failed to load (CORS issue)  
**Solution:** Added `onerror` handler with fallback to inline SVG default avatar.

## Testing Results

**Local Development:**
```bash
npm install  # 15 new packages
node migrations/migration-runner.js  # Applied 002_create_users_table.sql
npm start  # Server started successfully
```

**Authentication Flow:**
1. ✅ Clicked "Prihlásiť sa cez Google"
2. ✅ Google consent screen → Authorized
3. ✅ Redirected back to localhost
4. ✅ Avatar and name displayed: "Jozef Sokol"
5. ✅ API test: `/auth/user` returned authenticated user data
6. ✅ Logout → Login button shown again

**Database Verification:**
```sql
SELECT * FROM users;
-- 1|<google_id>|user@example.com|Jozef Sokol|<avatar_url>|2026-01-20 13:09:00

SELECT * FROM sessions;
-- <session_id>|<session_data>|<expiry_timestamp>
```

## Architecture Highlights

**Authentication Flow:**
```
User → /auth/google → Google OAuth → /auth/google/callback 
→ Passport verifies → Check DB → Create/Update user 
→ Create session (SQLite) → Redirect → Display avatar
```

**Session Management:**
- Sessions stored in SQLite (persistent across restarts)
- 7-day expiry, httpOnly, secure (HTTPS in production)
- Automatic cleanup every 15 minutes
- WAL mode for concurrent access

**Security Features:**
- ✅ Environment variables for sensitive data
- ✅ Server-side sessions (not client-side JWT)
- ✅ httpOnly cookies (prevents XSS)
- ✅ sameSite: lax (prevents CSRF)
- ✅ secure: true in production (HTTPS only)

## Production Deployment Checklist

- [ ] Create `.env` on Synology at `/volume1/docker/carnaby-sk/.env`
- [ ] Set `GOOGLE_CALLBACK_URL=https://carnaby.sk/auth/google/callback`
- [ ] Generate new `SESSION_SECRET` for production
- [ ] Commit and push to GitHub
- [ ] Wait for Watchtower deployment
- [ ] Test on `https://carnaby.sk`

## Statistics

**Time:** ~3.5 hours  
**Code:** ~800 lines added  
**Files:** 6 created, 6 modified  
**Dependencies:** 5 added  
**Tests:** 9 scenarios (all passed)  

**Key Learnings:**
1. Passport.js requires database connection after migrations
2. dotenv is not automatic in Node.js
3. Google OAuth requires exact redirect URIs
4. Always provide fallback for avatar images
5. Sessions better than JWT for web apps with logout

---
