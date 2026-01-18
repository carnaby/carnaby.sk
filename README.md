# Carnaby.sk - AI Web Development Journey

## Tech Stack
- Vanilla JS (no frameworks)
- SQLite database (better-sqlite3)
- Express.js server
- Docker & Docker Compose
- Google Antigravity + Claude Sonnet

## Development Log

### Commit 1: Initial Setup (Day 1)
- Basic web structure with HTML/CSS/JS
- YouTube video embeds (15 videos)
- Dark theme design
- Language switcher (SK/EN)
- Responsive layout

### Commit 2: Local Dev Server (Day 3)
**Prompt:** "dopln prosim nejaky jednoduchy server co po prikaze npm start bude hostovat tuto stranku. na localhost a prote : 6000"
(Translation: "please add a simple server that will host this page after the npm start command. on localhost and port: 6000")

**Result:** ✅ Express server created
- Server running on port 3000 (user changed from 6000)
- Static file serving
- Simple and clean implementation

**Time:** 2 minutes  
**Manual work:** Changed port from 6000 to 3000

---

**Prompt:** "mam to na gite tak zabezbec aby sa do repozitaru nedostali zbytocnosti co tam byt nemaju"
(Translation: "I have it on git so make sure that unnecessary things don't get into the repository")

**Result:** ✅ .gitignore created
- node_modules excluded
- Log files excluded
- IDE files excluded
- OS files excluded

**Time:** 1 minute  
**Manual work:** 0 lines of code

### Commit 3: Dark/Light Theme Toggle (Day 3)
**Prompt:** "sprav prosim prepinanie tem dark/light stym ze uzivatelovi sa zobrazi defaultne tak ktoru ma on systemovu.. bude sa dat aj manualne prepinat toggle umiestni do peticky. light temu nedavaj uplne bielu ale nieco co sa hodi k farebnosti stranky"
(Translation: "please create dark/light theme switching so that the user sees by default the one they have in their system. it will also be possible to switch manually, place the toggle in the footer. don't make the light theme completely white but something that matches the color scheme of the page")

**Result:** ✅ Fully functional theme system
- Automatic system theme detection (prefers-color-scheme)
- Manual toggle button in footer (🌙/☀️)
- Light theme with warm beige colors (#f5f1e8) instead of white
- localStorage persistence
- Smooth transitions
- Translated toggle button (SK/EN)

**Time:** 5 minutes  
**Manual work:** 0 lines of code

### Commit 4: SQLite Database Integration (Day 3)
**Prompt:** "Add SQLite database for video management:

Create 2 tables:
- categories: id, name (Dodo, Carnaby)
- videos: id, url, category_id (foreign key)

Migrate all existing YouTube URLs to database:
- Put all current videos into "Dodo" category

Create API endpoint:
- GET /api/videos

Update frontend:
- Fetch videos from API
- Render into .songs-grid

Error handling + update .gitignore for DB file"

**Result:** ✅ Full database integration
- SQLite database with 2 tables (categories, videos)
- Migration script (init-db.js) created
- 15 videos migrated to "Dodo" category
- REST API endpoint `/api/videos` with proper JSON response
- Dynamic frontend loading with fetch API
- Loading state ("⏳ Načítavam videá...")
- Error handling with user-friendly messages
- Translated error messages (SK/EN)
- Database files added to .gitignore
- Graceful database shutdown on server stop

**Time:** 10 minutes  
**Manual work:** 0 lines of code

### Commit 5: README Documentation Update (Day 3)
**Prompt:** "ano prosim este si precitaj README.md a pochopis o co mi ide ... prosim vzdy ked ti dam nejaku ulohu tak to dam zapis ako novy zaznam ... chcem aby to bolo dokumentacia nasej cesty :) teraz ten subor mozes upravit tak aby zodpovedal realite ... moje prompty ale tam pis po anglicky."
(Translation: "yes please read README.md and understand what I'm going for ... please whenever I give you a task, record it as a new entry ... I want this to be documentation of our journey :) now you can edit the file to match reality ... but write my prompts in English there.")

**Result:** ✅ README updated to reflect reality
- Added original Slovak prompts with English translations
- Accurate time estimates and manual work tracking
- Detailed results for each commit
- Proper documentation structure for future entries
- This meta-entry documenting the documentation process itself

**Time:** 2 minutes  
**Manual work:** 0 lines of code

### Commit 6: Docker Configuration for Synology NAS (Day 3)
**Prompt:** "Ahoj, chcem túto aplikáciu (carnaby.sk) dockerizovať, aby som ju mohol spustiť na Synology NAS cez Container Manager.

Požiadavky:
- Vytvor optimalizovaný multi-stage Dockerfile (použi node:18-alpine alebo novší).
- Vytvor docker-compose.yml, kde bude aplikácia namapovaná na port 3000.
- Zabezpeč, aby sa pri builde správne spracovali environment premenné (ak nejaké sú v .env).
- Pridaj .dockerignore, aby sa nekopíroval balast ako node_modules alebo .next z lokálneho buildu.
- Napíš mi krátky návod, ako to na Synology cez terminál zostaviť a spustiť (build & up)."

(Translation: "Hi, I want to dockerize this application (carnaby.sk) so I can run it on Synology NAS via Container Manager. Requirements: Create optimized multi-stage Dockerfile (use node:18-alpine or newer), create docker-compose.yml with app mapped to port 3000, ensure environment variables are processed correctly during build, add .dockerignore to exclude unnecessary files, write a short guide on how to build and run it on Synology via terminal.")

**Result:** ✅ Complete Docker deployment solution
- **Dockerfile**: Multi-stage build with node:20-alpine
  - Stage 1: Dependencies installation
  - Stage 2: Database initialization
  - Stage 3: Production runner with non-root user
  - Health check included
  - Security best practices (non-root user, minimal image)
- **docker-compose.yml**: 
  - Port 3000 mapping
  - Volume persistence for database
  - Auto-restart policy
  - Health checks
  - Network configuration
- **.dockerignore**: Optimized build context (excludes node_modules, logs, IDE files)
- **DEPLOYMENT.md**: Comprehensive guide
  - Step-by-step Synology NAS deployment
  - SSH commands for build & run
  - Monitoring via Container Manager
  - Reverse proxy setup
  - Troubleshooting section
  - Update scripts

**Time:** 8 minutes  
**Manual work:** 0 lines of code

### Commit 7: Docker Build Fix - npm ci Error (Day 3)
**Context:** During Synology NAS deployment, Docker build failed with error: `npm ci can only install with an existing package-lock.json`

**Prompt:** "Pri deploymente na Synology NAS cez Docker nastala chyba počas buildu. Príkaz npm ci zlyhal, pretože v projekte chýba package-lock.json.

Úlohy pre teba:
- Oprava Dockerfile: Uprav Dockerfile tak, aby používal npm install namiesto npm ci (a --omit=dev namiesto --only=production), pretože momentálne lockfile nepoužívame.
- Aktualizácia dokumentácie: Do DEPLOYMENT.md alebo README.md doplň poznámku o tom, že ak používateľ nemá lockfile, musí použiť klasický install, alebo odporuč vygenerovanie lockfilu pred buildom.
- Optimalizácia: Skontroluj, či sú všetky potrebné súbory pre npm install správne skopírované v rámci Docker layers.
- Zápis: Zapíš tento incident a jeho riešenie do logu v README.md ako súčasť tvojho experimentálneho učenia."

(Translation: "During Synology NAS deployment via Docker, a build error occurred. The npm ci command failed because package-lock.json is missing from the project. Tasks: Fix Dockerfile to use npm install instead of npm ci (and --omit=dev instead of --only=production), update documentation with notes about lockfile, verify all necessary files are copied correctly in Docker layers, log this incident and solution in README.md as part of experimental learning.")

**Problem Analysis:**
- `npm ci` requires `package-lock.json` for reproducible builds
- Project currently doesn't track lockfile in git (.gitignore excludes it)
- Docker build failed on Synology NAS during first deployment attempt

**Solution Implemented:**
- **Dockerfile fixes:**
  - Stage 1 (deps): `npm ci --only=production` → `npm install --omit=dev`
  - Stage 2 (builder): `npm ci` → `npm install`
  - Added explanatory comments about why npm install is used
- **DEPLOYMENT.md updates:**
  - Added troubleshooting section for npm ci error
  - Included step-by-step resolution guide
  - Added recommendation to generate lockfile for production
  - Added note in "Poznámky" section explaining npm install vs npm ci
- **Verification:**
  - All necessary files (package.json) are correctly copied
  - Docker layer caching still works efficiently
  - Build process remains optimized

**Lessons Learned:**
- `npm ci` is stricter and requires lockfile, `npm install` is more flexible
- For production: lockfile ensures reproducible builds across environments
- For development: npm install allows faster iteration without lockfile
- Docker multi-stage builds need consistent npm commands across stages
- Always test Docker builds in target environment (Synology NAS)

**Best Practice Recommendation:**
For future projects, decide early whether to use lockfile:
- **With lockfile**: Use `npm ci` for faster, deterministic builds
- **Without lockfile**: Use `npm install` but accept potential version drift

**Time:** 5 minutes  
**Manual work:** 0 lines of code  
**Real-world testing:** ✅ Incident discovered and fixed during actual deployment

**🎉 DEPLOYMENT SUCCESS!** After fixing the npm ci error, Docker build and deployment on Synology NAS completed successfully! Application is now running in production on Container Manager. Full end-to-end deployment verified and working.

---

## 📊 Project Statistics

**Total development time:** ~35 minutes  
**Total manual code written:** ~5 lines (port change)  
**AI-generated code:** ~100% of functionality  
**Real-world incidents handled:** 1 (npm ci error - RESOLVED ✅)  
**Production deployments:** 1 (Synology NAS - SUCCESS 🚀)

## 🏆 Achievements Unlocked
- ✅ Full-stack web application built from scratch
- ✅ Database-driven dynamic content
- ✅ Dark/Light theme with system detection
- ✅ Dockerized for production deployment
- ✅ Successfully deployed to Synology NAS
- ✅ Real-world error debugging and resolution
- ✅ Comprehensive documentation maintained throughout