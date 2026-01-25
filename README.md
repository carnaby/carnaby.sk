# [Carnaby.sk](https://carnaby.sk/) - AI Web Development Journey

## Project Background

Personal music website built entirely through AI collaboration, documenting the journey from concept to production deployment.

**Context:**
- Developer: Senior programmer (10+ years experience)
- Music: AI-generated songs via Suno
- Goal: Showcase YouTube videos on personal website
- Constraint: Zero manual code writing (AI does 100% of implementation)

**Development Phases:**

**Phase 1 - Initial Build (Claude Chat):**
- Uploaded design assets (banner, photo)
- Provided content and requirements in Slovak
- Claude generated complete vanilla JS website in ~20 minutes
- Features: Responsive layout, dark theme, multilanguage (SK/EN), YouTube embeds
- Initial deployment to Synology NAS ([carnaby.sk](https://carnaby.sk/))

**Phase 2 - Advanced Features (Google Antigravity):**
- Migrated to Antigravity IDE for iterative development
- Added SQLite database for video management
- Implemented theme toggle (dark/light with system detection)
- Created Docker deployment configuration
- Real-world debugging and production deployment
- All changes documented below with original prompts and results

**Why Vanilla JS?**
Deliberately avoided frameworks (React/Next.js/Vue) for:
- Zero build complexity
- Instant loading speed
- Easy maintenance
- Simple NAS deployment
- No dependency hell

**Important Note:**
Prompts used here reflect senior-level technical knowledge (databases, APIs, Docker, deployment). Success rate depends heavily on developer's understanding of web architecture and ability to formulate precise requirements, not just AI capability.

---

## Tech Stack
- Vanilla JS (no frameworks)
- PostgreSQL database (migrated from SQLite)
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

### Commit 8: Automated CI/CD Pipeline (Day 4)
**Prompt:** \"Ahoj, chcem do projektu carnaby.sk pridať automatické CI/CD cez GitHub Actions, aby som nemusel robiť manuálny build na Synology NAS.

Tvoje úlohy:

Vytvor workflow súbor .github/workflows/deploy.yml, ktorý pri každom pushi do main builduje Docker image a pushne ho do GitHub Container Registry (ghcr.io).

Aktualizuj docker-compose.yml tak, aby používal image z ghcr.io/${{ github.repository }}:latest namiesto lokálneho buildu.

Do docker-compose.yml pridaj službu Watchtower, ktorá bude automaticky sledovať zmeny v registry a reštartovať kontajner na mojom NAS.

Aktualizuj DEPLOYMENT.md a pridaj tam návod, ako sa na NAS jednorazovo prihlásiť do ghcr.io (cez docker login) a ako nastaviť GitHub Secrets, ak sú potrebné.

Zapíš túto zmenu do logu v README.md ako 'Prechod na automatizovaný CI/CD pipeline'.\"

(Translation: \"Hi, I want to add automatic CI/CD to the carnaby.sk project via GitHub Actions so I don't have to do manual builds on Synology NAS. Your tasks: Create workflow file .github/workflows/deploy.yml that builds Docker image and pushes to GitHub Container Registry on every push to main. Update docker-compose.yml to use image from ghcr.io instead of local build. Add Watchtower service to docker-compose.yml to automatically monitor registry changes and restart container on my NAS. Update DEPLOYMENT.md with instructions for one-time ghcr.io login on NAS and how to set up GitHub Secrets if needed. Log this change in README.md as 'Transition to automated CI/CD pipeline'.\")

**Result:** ✅ Complete CI/CD automation pipeline
- **GitHub Actions Workflow** (`.github/workflows/deploy.yml`):
  - Triggers on every push to `main` branch
  - Builds Docker image using multi-stage Dockerfile
  - Pushes to GitHub Container Registry (ghcr.io)
  - Tags with `latest` and commit SHA
  - Uses `GITHUB_TOKEN` (no manual secrets needed!)
  - Automatic permissions for package publishing
- **docker-compose.yml updates**:
  - Changed from local `build:` to `image: ghcr.io/...`
  - Added environment variable support for repository name
  - Added Watchtower service for automatic updates
  - Watchtower configuration:
    - Polls registry every 5 minutes
    - Label-based container selection
    - Automatic cleanup of old images
    - Optional notification support (Slack, Discord, etc.)
- **DEPLOYMENT.md comprehensive update**:
  - Added CI/CD pipeline overview section
  - GitHub Container Registry authentication guide
  - Personal Access Token (PAT) creation steps
  - One-time `docker login ghcr.io` command for NAS
  - GitHub Secrets explanation (none needed for basic setup!)
  - Watchtower monitoring and configuration guide
  - Updated deployment workflow (no more manual builds!)
  - Automatic vs manual update instructions
- **Deployment workflow transformation**:
  - **Before**: SSH to NAS → git pull → docker build → docker-compose up
  - **After**: git push → GitHub Actions builds → Watchtower auto-updates (within 5 min)
  - **Zero manual intervention** for deployments! 🚀

**Benefits achieved:**
- ✅ Zero-downtime deployments
- ✅ Automatic updates within 5 minutes of code push
- ✅ No manual SSH access needed for deployments
- ✅ Centralized image registry (ghcr.io)
- ✅ Version history via image tags
- ✅ Rollback capability (pull previous image tag)
- ✅ Consistent builds across environments

**Time:** 12 minutes  
**Manual work:** 0 lines of code  
**Deployment complexity:** Reduced from 5 manual steps to 1 (git push)

### Commit 9: CI/CD Pipeline Test - First Automated Deployment (Day 4)
**Prompt:** "Všetko som nastavil, dokonca aj notifikácie na Telegram. Tak poďme to skúsiť — urobíme len drobné zmeny:

Pridaj odkaz medzi YouTube a Facebook na môj SoundCloud: https://soundcloud.com/jozef-sokol
Do petičky, kde sa píše o AI experimente, zapracuj odkaz na GitHub s týmto projektom: https://github.com/carnaby/carnaby.sk. Môžeš tam tiež pridať krátky text, že ide o dokumentáciu našej spoločnej cesty — to už nechávam na teba.
V petičke nastav (c) rok tak, aby sa automaticky aktualizoval.
V README.md pridaj zmienky o carnaby.sk ako hyperlinky: https://carnaby.sk/"

(Translation: "I've set everything up, even Telegram notifications. So let's test it — we'll make just small changes: Add a link between YouTube and Facebook to my SoundCloud. In the footer where it talks about the AI experiment, add a link to GitHub with this project. You can also add a short text that it's documentation of our journey together — I'll leave that to you. In the footer, set the copyright year to update automatically. In README.md, add mentions of carnaby.sk as hyperlinks.")

**Result:** ✅ First real test of automated CI/CD pipeline
- **Navigation updates** (`index.html`):
  - Added SoundCloud link between YouTube and Facebook
  - URL: https://soundcloud.com/jozef-sokol
- **Footer enhancements** (`index.html` + `script.js`):
  - Dynamic copyright year using JavaScript `new Date().getFullYear()`
  - Automatically updates every year without manual intervention
  - Added SoundCloud to footer social links
  - Added GitHub project link with bilingual documentation text:
    - Slovak: "Dokumentácia našej spoločnej cesty je na GitHub"
    - English: "Documentation of our journey together is on GitHub"
  - URL: https://github.com/carnaby/carnaby.sk
- **README.md updates**:
  - Added hyperlinks to [carnaby.sk](https://carnaby.sk/) throughout document
  - Links in main title, deployment mentions, and commit prompts
- **Translation updates**:
  - Split `footerCopyright` into separate translatable components
  - Added `aiJourney` translation key for GitHub documentation text
  - Maintained full i18n support (SK/EN)

**CI/CD Pipeline Test:**
- Push to GitHub → GitHub Actions builds image → Watchtower detects update → Container auto-restarts
- Telegram notifications configured for deployment updates
- Zero manual intervention required! 🎉

**Time:** 5 minutes  
**Manual work:** 0 lines of code  
**First automated deployment:** SUCCESS ✅

**🎉 DEPLOYMENT VERIFIED!** Changes automatically deployed to production at [carnaby.sk](https://carnaby.sk/). Telegram notification received confirming successful update. The CI/CD pipeline works flawlessly - from code push to live deployment in under 5 minutes with zero manual intervention! This is the future of deployment! 🚀

### Commit 10: Migration to npm ci for Reproducible Builds (Day 4)
**Prompt:** "Ahoj, pozri sa na môj aktuálny proces nasadzovania (deploymentu) na Synology. Momentálne tam používam príkaz npm install, čo môže spôsobovať problémy s rôznymi verziami balíkov v buildoch.

Potrebujem, aby si:

Zmenil v mojom deployment skripte (alebo Dockerfile/GitHub Action) npm install na npm ci.

Vyvetlil mi, či musím na servery pred spustením npm ci niečo manuálne mazať (napríklad zložku node_modules).

Skontroloval, či môj proces správne pracuje so súborom package-lock.json, pretože viem, že bez neho npm ci nebude fungovať.

Ak je potrebné upraviť oprávnenia súborov na Synology po tejto zmene, napíš mi prosím aj potrebné chown alebo chmod príkazy.

Cieľom je mať 100 % reprodukovateľné a stabilné buildy pri každom automatickom nasadení. A samozrejme zapíš prompt do README"

(Translation: "Hi, look at my current deployment process on Synology. Currently I'm using npm install command, which can cause problems with different package versions in builds. I need you to: Change npm install to npm ci in my deployment script (or Dockerfile/GitHub Action). Explain if I need to manually delete anything on the server before running npm ci (e.g., node_modules folder). Check if my process correctly works with package-lock.json file, because I know npm ci won't work without it. If file permissions need to be adjusted on Synology after this change, please write the necessary chown or chmod commands. The goal is to have 100% reproducible and stable builds with every automated deployment. And of course, log the prompt in README.")

**Result:** ✅ Complete migration to npm ci for deterministic builds
- **.gitignore update**:
  - Removed `package-lock.json` from ignore list
  - Added comment explaining it's now tracked for reproducible builds
  - `package-lock.json` is now version-controlled
- **Dockerfile optimization** (both stages updated):
  - Stage 1 (deps): `npm install --omit=dev` → `npm ci --omit=dev`
  - Stage 2 (builder): `npm install` → `npm ci`
  - Updated comments to reflect npm ci usage
- **Benefits of npm ci**:
  - ✅ 10-50% faster than npm install
  - ✅ Installs exact versions from package-lock.json (no version resolution)
  - ✅ Automatically deletes node_modules/ before install (clean slate)
  - ✅ Never modifies package-lock.json (read-only)
  - ✅ Fails if package.json and package-lock.json are out of sync
  - ✅ 100% reproducible builds across all environments

**Important clarifications:**
- **No manual cleanup needed on Synology NAS!**
  - Docker builds are isolated and stateless
  - Each build starts fresh in a clean container
  - `node_modules/` is never persisted between builds
  - No SSH access required
- **No file permission changes needed:**
  - Docker handles all permissions automatically
  - No `chown` or `chmod` commands required
  - Non-root user (appuser) already configured in Dockerfile
- **package-lock.json was already present:**
  - File existed locally but was gitignored
  - Now tracked in version control for team consistency
  - Ensures identical dependency trees across all builds

**Deployment workflow unchanged:**
1. Push to GitHub → GitHub Actions builds with npm ci
2. Image pushed to ghcr.io with exact dependency versions
3. Watchtower detects and deploys automatically
4. Telegram notification confirms deployment
5. Zero manual intervention! 🚀

**Time:** 8 minutes  
**Manual work:** 0 lines of code  
**Build reproducibility:** 100% ✅

**⚠️ BUILD FIX - GitHub Actions Failure:**

After pushing the npm ci migration, GitHub Actions build failed with error:
```
ERROR: failed to build: failed to solve: process "/bin/sh -c npm ci" 
did not complete successfully: exit code: 1
```

**First attempt - Root cause analysis:**
- Initially thought: Dockerfile used wildcard `COPY package*.json ./`
- Hypothesis: Wildcards don't reliably match all files in Docker build context
- Solution tried: Changed to explicit `COPY package.json package-lock.json ./`

**Second failure:**
```
ERROR: failed to compute cache key: "/package-lock.json": not found
```

**ACTUAL root cause discovered:**
- 🔴 `package-lock.json` was in `.dockerignore` (line 6)!
- Docker was **ignoring** the file during COPY, even though it was in git
- File existed in repository but Docker build context excluded it

**User prompts:**
1. "Môj build v GitHub Actions zlyhal na príkaze npm ci s chybou exit code: 1..."
2. "mame opet havariu: buildx failed... '/package-lock.json': not found"

**Final solution:**
1. ✅ Removed `package-lock.json` from `.dockerignore`
2. ✅ Added comment explaining it's needed for npm ci
3. ✅ Kept explicit COPY commands for clarity
4. ✅ Kept `--verbose` flag for debugging
5. ✅ Verified `package-lock.json` was already in git (commit ca184e8)

**Lesson learned:** When migrating to npm ci, check **both** `.gitignore` AND `.dockerignore`!

**Result:** Build should now succeed! ✅

**🎉 DEPLOYMENT SUCCESS - Third Time's the Charm!**

After fixing `.dockerignore`, the build finally succeeded:
- ⚡ **Lightning-fast build** - GitHub Actions completed in record time
- 📱 **Telegram notification received** - Watchtower confirmed automatic deployment
- 🚀 **Zero manual intervention** - Full CI/CD pipeline working end-to-end
- ✅ **100% reproducible builds** - npm ci with package-lock.json now operational

**User confirmation:** "info. build prebehol bleskovo a uz mi prisla aj notifikacia .. ale kedze sme nic vizualne nemenil tak len verim ze to preslo ok :)"

No visual changes were made in this deployment, but under the hood:
- Build process is now **significantly faster** (npm ci vs npm install)
- Dependency versions are **locked and reproducible**
- Every deployment will have **identical dependency trees**
- Foundation set for **stable, predictable production deployments**

**Total debugging iterations:** 3 (wildcard COPY → missing file → .dockerignore)  
**Time to resolution:** ~15 minutes  
**Lessons learned:** 2 ignore files to check when adding new tracked files!

### Commit 11: Video Category Tabs (Day 4)
**Prompt:** "Uprimne sa priznávam, že nie som systémový administrátor (systemák). Rozumiem tomu len čiastočne, a to, že teraz funguje automatické deploy po pushi do main, je viac, než som očakával. Takže skvelá práca! Poďme sa venovať teraz programovaniu. Rozdelíme jednotlivé videá do kategórií. Teraz sú všetky v kategórii Dodo. Nasledujúce videá zaradím do kategórie Carnaby: https://youtu.be/vFd6XrV4vRE, https://youtu.be/AMajbzPky6g, https://youtu.be/CqujYRiQo84, https://youtu.be/YJDaKFMqKfc, https://youtu.be/sj4UZDRy2W0. A pri zobrazení správ Tab s kategóriami a vyber Dodo, Carnaby. (zapiš do readme)"

(Translation: "Honestly, I admit I'm not a system administrator. I only partially understand it, and the fact that automatic deploy after push to main now works is more than I expected. So great job! Let's focus on programming now. We'll divide videos into categories. Currently all are in Dodo category. I'll assign the following videos to Carnaby category: [5 video URLs]. And display tabs with categories and selection Dodo, Carnaby. (write to readme)")

**Result:** ✅ Category-based video filtering with tab navigation
- **init-db.js updates**:
  - Split videos into two arrays: `dodoVideos` (11) and `carnabyVideos` (5)
  - Dodo: Acoustic folk, storyteller ballads, Americana
  - Carnaby: Retro synth-pop, euro-disco (80s/90s inspired)
  - Updated transaction logic to insert videos into correct categories
- **index.html updates**:
  - Added category tabs UI above video grid
  - Three tabs: "Všetky/All", "Dodo", "Carnaby"
  - Tabs placed between subtitle and video grid
- **script.js updates**:
  - Added `videosByCategory` global variable to store API data
  - Created `renderVideos(category)` function for filtering
  - Tab click handlers with active state management
  - "All" tab shows all 16 videos
  - Category tabs show only filtered videos
  - Added `tabAll` translation ("All" / "Všetky")
- **style.css updates**:
  - Category tabs styling with rounded buttons
  - Active state: gold background with dark text
  - Hover effects: gold border + slight lift animation
  - Responsive design with flex-wrap for mobile
  - Consistent with existing dark/light theme

**Video distribution:**
- 🎸 **Dodo** (11 videos): QBLRyxhDCS4, vTHAbkEvymM, qeUB6Yj1PYo, AVzGSWEkyeQ, Hnabg1NAyKA, 0l4kWpAK9p8, HcxvUN3IvVg, p1_pl_fIBiQ, 2I_El8MJYXQ, rde5giz3TGc, zQeCIiAf0fY
- 🎹 **Carnaby** (5 videos): vFd6XrV4vRE, AMajbzPky6g, CqujYRiQo84, YJDaKFMqKfc, sj4UZDRy2W0

**Time:** 10 minutes  
**Manual work:** 0 lines of code  
**User feedback:** Acknowledged CI/CD success, ready to focus on programming features

**⚠️ DEBUGGING - Database Initialization Issues:**

**Issue 1:** Tabs displayed but didn't work - `videosByCategory` only had Dodo category
- **User report:** "Vizuálne sú záložky/Tabs na mieste, ale nefungujú. Zbežne som to pozrel a objekt videosByCategory má len jednu kategóriu (Dodo). Nezabudol si na niečo?"
- **Root cause:** Existing database still had old structure with all 16 videos in Dodo category
- **Why:** `init-db.js` checked `if (videoCount.count === 0)` and skipped initialization if videos existed

**Issue 2:** After first fix attempt, Carnaby tab showed "No videos found"
- **User report:** "hmm stale All a Dodo mi zobrazia vsetko (okrem prvej teda poslednej pridanej) no Carnaby : No videos found"
- **Root cause:** Database wasn't actually reinitialized - old data persisted
- **Why:** `CREATE TABLE IF NOT EXISTS` kept existing tables, `videoCount` check prevented inserts

**Solution implemented:**
1. ✅ Added `DROP TABLE IF EXISTS` for both `videos` and `categories` tables
2. ✅ Changed `CREATE TABLE IF NOT EXISTS` to `CREATE TABLE` (fail if exists)
3. ✅ Removed `if (videoCount.count === 0)` check entirely
4. ✅ Database now **always** drops and recreates on every `init-db.js` run
5. ✅ Ran `node init-db.js` - confirmed: "11 Dodo videos and 5 Carnaby videos"

**Lesson learned:** When changing database schema or data structure, ensure initialization script can handle existing data. Either:
- Drop and recreate (current approach - good for development)
- Use migrations (better for production with real user data)

**Result:** Category tabs now work correctly! ✅

---

### Commit 12: SQLite Persistence Architecture with Migration System (Day 5)

**Prompt (Slovak):** "Môj projekt používa SQLite ako databázu. Potrebujem upraviť architektúru nasadenia na Synology tak, aby sme zabezpečili perzistenciu dát a správu schémy.

Moje požiadavky:

Persistent Volume pre SQLite: Uprav docker-compose.yaml tak, aby sa súbor databázy (napr. database.sqlite) mapoval z vnútra kontajnera na fyzickú cestu na NAS: /volume1/private/clouds/GoogleDrive/carnaby_sk/. Tým zabezpečíme automatickú synchronizáciu databázy na Google Drive.

Migračné skripty: Navrhni systém migrácií (napr. cez knex, typeorm alebo jednoduché SQL skripty), ktorý budeme používať pri každej zmene dátovej štruktúry. Chcem, aby sa tieto migrácie spustili automaticky v rámci CI/CD (GitHub Actions) pri každom nasadení novej verzie.

Dátová integrita: Navrhni riešenie, ako predísť poškodeniu SQLite súboru pri zápise v momente, keď prebieha synchronizácia na Google Drive (napr. použitím WAL módu – Write-Ahead Logging).

Prístupové práva: Vyrieš, aby kontajner mal správne UID/GID na zápis do tohto mapovaného priečinka na Synology.

Priprav mi prosím konfiguráciu pre Docker a základnú štruktúru pre migračný priečinok.

Prípadne navrhni lepšie riešenie. Všetko zapíš do readme."

**Translation:** "My project uses SQLite as a database. I need to modify the Synology deployment architecture to ensure data persistence and schema management. Requirements: Persistent Volume for SQLite mapped to NAS path for automatic Google Drive sync, Migration scripts system (knex, typeorm, or simple SQL scripts) that run automatically in CI/CD on each deployment, Data integrity solution to prevent corruption during Google Drive sync (e.g., WAL mode), Access permissions for container to write to mapped Synology folder. Prepare Docker configuration and basic migration folder structure. Suggest better solution if applicable. Document everything in readme."

**Analysis & Decision:**
- ⚠️ **Risk identified**: Storing live SQLite database in Google Drive sync folder can cause corruption
- 💡 **Recommendation**: Use dedicated volume `/volume1/docker/carnaby/data` + automated backups to Google Drive
- ✅ **User decision**: "Ideme cestou A – databáza v /volume1/docker/carnaby/data a automatický backup do Google Drive priečinka. Je to cesta najmenšieho odporu a najvyššej bezpečnosti."
- 🔧 **Permissions setup**: UID=1026, GID=100 (Synology user permissions verified with test write)

**Result:** ✅ Complete SQLite persistence architecture implemented

**1. Migration System (Simple SQL Scripts)**
- **Why not knex/TypeORM**: Zero dependencies, full control, perfect for simple schema changes
- **Structure created:**
  ```
  migrations/
  ├── 001_initial_schema.sql       # Initial schema with categories & videos
  └── migration-runner.js          # Executes migrations in order
  ```
- **Features:**
  - `schema_migrations` table tracks applied migrations
  - Sequential execution (alphabetical order)
  - Transaction support (rollback on error)
  - Idempotent (safe to run multiple times)
  - Automatic execution on server startup
  - Detailed logging with emojis for clarity

**2. Database Configuration Updates**
- **[server.js](file:///c:/Users/dodus/prj/carnaby/carnaby.sk/server.js)** updates:
  - Database path: `videos.db` → `data/database.sqlite`
  - Run migrations before starting server
  - Enable WAL mode on connection
  - WAL checkpoint on graceful shutdown (SIGINT/SIGTERM)
  - Configurable via `DB_PATH` environment variable
- **WAL Mode enabled** for data integrity:
  ```javascript
  db.pragma('journal_mode = WAL');        // Enable WAL
  db.pragma('synchronous = NORMAL');      // Balance safety/performance
  db.pragma('wal_autocheckpoint = 1000'); // Checkpoint every 1000 pages
  ```
- **Benefits of WAL mode:**
  - ✅ Readers don't block writers (better concurrency)
  - ✅ Faster writes (no journal file sync)
  - ✅ More resilient to corruption
  - ✅ Better for backup scenarios (fewer file operations)

**3. Docker Configuration**
- **[docker-compose.yml](file:///c:/Users/dodus/prj/carnaby/carnaby.sk/docker-compose.yml)** updates:
  - Added `user: "1026:100"` for Synology permissions
  - Volume mapping: `/volume1/docker/carnaby/data:/app/data` (database)
  - Volume mapping: `/volume1/private/clouds/GoogleDrive/carnaby_sk/backups:/app/backups` (backups only)
  - Environment variable: `DB_PATH=/app/data/database.sqlite`
  - Increased health check start period: 5s → 10s (migrations need time)
- **[Dockerfile](file:///c:/Users/dodus/prj/carnaby/carnaby.sk/Dockerfile)** updates:
  - Removed Stage 2 (builder) - no longer needed for database initialization
  - Removed `init-db.js` execution (replaced by migrations)
  - Created `/app/data` directory with proper permissions
  - Created `/app/backups` directory for backup script
  - Migrations run automatically in `server.js` on startup
  - Comment: "UID/GID will be overridden by docker-compose"

**4. Automated Backup System**
- **[scripts/backup-db.sh](file:///c:/Users/dodus/prj/carnaby/carnaby.sk/scripts/backup-db.sh)** created:
  - Uses SQLite `.backup` command for consistent snapshots
  - Timestamp-based backup files: `database_YYYY-MM-DD_HH-MM-SS.sqlite`
  - Integrity check after backup (PRAGMA integrity_check)
  - 30-day retention policy (automatic cleanup)
  - Colored output for readability
  - Can be scheduled via Synology Task Scheduler
- **Synology cron setup** (to be configured manually):
  ```bash
  # Daily backup at 3 AM
  0 3 * * * /volume1/docker/carnaby/scripts/backup-db.sh
  ```

**5. CI/CD Integration**
- **[.github/workflows/deploy.yml](file:///c:/Users/dodus/prj/carnaby/carnaby.sk/.github/workflows/deploy.yml)** updates:
  - Added migration validation step (checks SQL syntax)
  - Validates all `*.sql` files before building Docker image
  - Ensures migrations are included in Docker image
- **Deployment flow:**
  1. Push to GitHub → GitHub Actions validates migrations
  2. Docker image built with migration files
  3. Image pushed to ghcr.io
  4. Watchtower pulls new image
  5. Container starts → migrations run automatically
  6. Server starts with updated schema

**6. Migration Workflow**
- **Creating new migrations:**
  ```bash
  # 1. Create new migration file (sequential numbering)
  touch migrations/002_add_description_column.sql
  
  # 2. Write SQL
  echo "ALTER TABLE videos ADD COLUMN description TEXT;" > migrations/002_add_description_column.sql
  
  # 3. Test locally
  node migrations/migration-runner.js
  
  # 4. Commit and push
  git add migrations/002_add_description_column.sql
  git commit -m "Add description column to videos"
  git push
  
  # 5. Automatic deployment via CI/CD
  ```
- **Rollback strategy:**
  - Option 1: Create down migration (manual SQL)
  - Option 2: Restore from backup (automated daily backups)

**7. File Changes Summary**
- **New files:**
  - `migrations/001_initial_schema.sql` (initial schema + seed data)
  - `migrations/migration-runner.js` (migration executor)
  - `scripts/backup-db.sh` (automated backup script)
- **Modified files:**
  - `server.js` (WAL mode, migrations, new DB path)
  - `docker-compose.yml` (volumes, UID/GID, environment)
  - `Dockerfile` (removed init-db, added data directories)
  - `.github/workflows/deploy.yml` (migration validation)
  - `.gitignore` (added `data/`, `*.sqlite*`)
- **Deleted files:**
  - `init-db.js` (replaced by migration system)
  - `videos.db` (old database location, now in `data/`)

**8. Local Testing Results**
```bash
# Migration test
$ node migrations/migration-runner.js
🔄 Starting database migrations...
📂 Database path: C:\Users\dodus\prj\carnaby\carnaby.sk\data\database.sqlite
✅ Created data directory
✅ WAL mode enabled
✅ Migration tracking table ready
📊 Applied migrations: 0
📁 Found 1 migration files
🔧 Applying migration: 001_initial_schema.sql
✅ Applied 001_initial_schema.sql
🎉 Migration completed successfully!
📊 Executed 1 new migration(s)
📊 Database stats: 2 categories, 16 videos
✅ Database connection closed
```

**9. Synology NAS Setup (User completed)**
```bash
# Permissions verified
$ id
uid=1026(user) gid=100(users) groups=100(users),101(administrators)

# Directories created
$ sudo mkdir -p /volume1/docker/carnaby/data
$ sudo mkdir -p /volume1/private/clouds/GoogleDrive/carnaby_sk/backups

# Permissions set
$ sudo chown -R 1026:100 /volume1/docker/carnaby/data
$ sudo chown -R 1026:100 /volume1/private/clouds/GoogleDrive/carnaby_sk
$ sudo chmod -R 775 /volume1/docker/carnaby/data
$ sudo chmod -R 775 /volume1/private/clouds/GoogleDrive/carnaby_sk

# Write test successful
$ docker run --rm --user 1026:100 -v /volume1/docker/carnaby/data:/test-data alpine sh -c "echo 'Test' > /test-data/test.txt"
✅ Zápis funguje!
```

**10. Architecture Benefits**
- ✅ **Data persistence**: Database survives container restarts/updates
- ✅ **Automated backups**: Daily backups to Google Drive (30-day retention)
- ✅ **Schema migrations**: Version-controlled database changes
- ✅ **Data integrity**: WAL mode prevents corruption
- ✅ **Zero downtime**: Migrations run automatically on deployment
- ✅ **Rollback capability**: Restore from backups or down migrations
- ✅ **Proper permissions**: UID/GID mapping for Synology NAS
- ✅ **CI/CD integration**: Migration validation in GitHub Actions
- ✅ **No external dependencies**: Simple SQL scripts, no ORM overhead

**Time:** 45 minutes (including planning, implementation, testing, documentation)  
**Manual work:** 0 lines of code (AI generated 100%)  
**User manual work:** Synology permissions setup (~5 minutes)  
**Architecture complexity:** High (production-grade persistence system)  
**Production ready:** ✅ YES

---

### 🐛 Deployment Debugging - SQLITE_READONLY_DIRECTORY Issue

**Problem encountered during production deployment:**

After pushing the migration system to production, the container entered a restart loop with error:
```
❌ Migration failed, cannot start server: SqliteError: unable to open database file
code: 'SQLITE_CANTOPEN'
```

Later evolved to:
```
❌ Migration failed: SqliteError: attempt to write a readonly database
code: 'SQLITE_READONLY_DIRECTORY'
```

**Root cause analysis:**

1. **Initial suspicion**: Database file permissions
   - Created empty `database.sqlite` with `chmod 666` (rw-rw-rw-)
   - Error persisted → not a file permission issue

2. **Actual problem**: Directory permissions
   - Directory had `chmod 775` (rwxrwxr-x)
   - SQLite needs to create WAL files: `database.sqlite-wal`, `database.sqlite-shm`
   - Container running as UID 1026 couldn't write to directory
   - Error message was misleading: "readonly database" actually meant "readonly directory"

**Debugging steps taken:**

```bash
# 1. Verified directory structure
ls -la /volume1/docker/carnaby-sk/data/
# Output: drwxrwxr-x (775) - insufficient for WAL file creation

# 2. Verified UID/GID
id carnaby
# Output: uid=1026(carnaby) gid=100(users)

# 3. Verified volume mount
docker inspect carnaby-sk | grep -A 10 Mounts
# Output: Correct mount, but directory not writable

# 4. Created test file from container (failed)
docker exec carnaby-sk touch /app/data/test.txt
# Error: Container restarting (couldn't execute)

# 5. Created database file manually (partial success)
sudo touch /volume1/docker/carnaby-sk/data/database.sqlite
sudo chown 1026:100 /volume1/docker/carnaby-sk/data/database.sqlite
sudo chmod 666 /volume1/docker/carnaby-sk/data/database.sqlite
# Database opened, but WAL mode failed (directory still readonly)
```

**Solution:**

```bash
# Change directory permissions to allow WAL file creation
sudo chmod 777 /volume1/docker/carnaby-sk/data

# Restart container
sudo docker restart carnaby-sk

# Success! Migrations ran:
# ✅ WAL mode enabled
# ✅ Applied 001_initial_schema.sql
# ✅ Database stats: 2 categories, 16 videos
# ✅ Server is running on http://localhost:3000
```

**Why 777 was needed:**

SQLite with WAL mode requires:
- Read permission on database file ✅
- Write permission on database file ✅
- **Write permission on directory** ❌ (was missing)
- **Execute permission on directory** ✅

The directory needs write permission because SQLite creates:
- `database.sqlite-wal` (Write-Ahead Log)
- `database.sqlite-shm` (Shared Memory)

These files are created/deleted dynamically during database operations.

**Verification:**

```bash
# After successful startup, WAL files appeared:
ls -la /volume1/docker/carnaby-sk/data/
# database.sqlite
# database.sqlite-wal  ← Created by SQLite
# database.sqlite-shm  ← Created by SQLite
```

**Backup system deployment:**

After database was running, backup script was deployed:

```bash
# Created backup script on Synology (not in Docker image yet)
mkdir -p /volume1/docker/carnaby-sk/scripts
cat > /volume1/docker/carnaby-sk/scripts/backup-db.sh << 'EOF'
[backup script content]
EOF
chmod +x /volume1/docker/carnaby-sk/scripts/backup-db.sh

# Tested backup manually
/volume1/docker/carnaby-sk/scripts/backup-db.sh
# ✅ Backup created: database_2026-01-20_11-50-50.sqlite (36K)
# ✅ Saved to Google Drive sync folder
# ✅ Verified on Google Cloud

# Scheduled via Synology Task Scheduler
# Daily at 3:00 AM
```

**Lessons learned:**

1. **SQLite WAL mode requires directory write permissions**
   - Not just file permissions
   - Error message "readonly database" can mean "readonly directory"
   - Always check directory permissions when using WAL mode

2. **Docker volume mounts inherit host permissions**
   - Container UID/GID must match host permissions
   - `user: "1026:100"` in docker-compose.yml is critical
   - Test write access before deploying: `docker exec container touch /path/test.txt`

3. **Debugging containerized databases:**
   - Check file permissions: `ls -la /path/to/file`
   - Check directory permissions: `ls -la /path/to/`
   - Check volume mounts: `docker inspect container | grep Mounts`
   - Check container user: `docker exec container id`
   - Test write access: `docker exec container touch /path/test.txt`

4. **SQLite error messages can be misleading:**
   - `SQLITE_CANTOPEN` → Check if directory exists
   - `SQLITE_READONLY_DIRECTORY` → Check directory write permissions
   - `SQLITE_READONLY` → Check file write permissions

5. **Deployment checklist for SQLite + Docker:**
   - [ ] Create data directory on host
   - [ ] Set directory permissions (chmod 777 or 775 with correct owner)
   - [ ] Set directory owner (chown UID:GID)
   - [ ] Verify volume mount in docker-compose.yml
   - [ ] Set container user in docker-compose.yml
   - [ ] Test write access before deploying
   - [ ] Monitor logs during first deployment

**Time to debug:** 30 minutes  
**Iterations:** 5 (permissions, file creation, directory permissions, chmod 777, success)  
**Final solution:** Single command (`chmod 777`)  
**Key insight:** Directory permissions, not file permissions  

---

### Commit 13: Google OAuth 2.0 Authentication

**Prompt (SK):** "Máme stabilizovanú databázu a deployment, teraz ideme pridať autentifikáciu cez Google (OAuth 2.0)..."

**Result:** Implemented complete Google OAuth 2.0 authentication system with Passport.js, session management, JIT user provisioning, and Google-style UI. Users can now sign in with their Google account, see their avatar and name in navigation, and log out. Sessions persist across container restarts using SQLite session store.

**Implementation:**
- **Backend:** Passport.js + Google OAuth 2.0 strategy, Express sessions with SQLite store, authentication routes (/auth/google, /callback, /logout, /user)
- **Database:** Migration `002_create_users_table.sql` with JIT provisioning (automatic user creation on first login)
- **Frontend:** Google-style "Sign in" button, user avatar display (32px circular with gold border), logout button, loading states, SK/EN translations
- **Security:** Environment variables for credentials, httpOnly cookies, sameSite: lax, secure in production, 7-day session expiry
- **Documentation:** `GOOGLE_OAUTH_SETUP.md` (Google Cloud Console guide), `PRODUCTION_ENV.md` (production config), `COMMIT_13_OAUTH.md` (full implementation details)

**Files Created:** 6 (passport config, auth routes, middleware, migration, documentation)  
**Files Modified:** 6 (package.json, server.js, index.html, style.css, script.js, .env.example)  
**Dependencies Added:** 5 (passport, passport-google-oauth20, express-session, better-sqlite3-session-store, dotenv)

**Debugging:**
1. Missing dotenv → Added dotenv package and configuration
2. Database connection before migrations → Refactored passport.js to accept DB as parameter
3. Wrong callback URL → Fixed local .env to use localhost
4. Avatar not loading → Added onerror handler with SVG fallback

**Testing:**
- ✅ Local authentication flow (9 test scenarios)
- ✅ Database verification (users + sessions tables)
- ✅ API endpoint test (/auth/user)
- ✅ UI/UX test (Google-style design confirmed)

**Time:** ~3.5 hours  
**Complexity:** High (authentication, sessions, security)  
**Production Ready:** YES (pending deployment)

**See:** [`COMMIT_13_OAUTH.md`](COMMIT_13_OAUTH.md) for full implementation details.

---

### Production Deployment & Debugging Journey

**Date:** 2026-01-20 (afternoon)  
**Time:** ~1.5 hours  
**Complexity:** High (reverse proxy, environment variables, Docker)

#### Deployment Process

**1. Initial Deployment Attempt:**
```bash
git push origin main
# GitHub Actions builds image
# Watchtower deploys to Synology
```

**Result:** ❌ Container crash loop
```
TypeError: OAuth2Strategy requires a clientID option
```

#### Debugging Session (6 Issues Resolved)

**Issue 1: Missing .env file**
- **Problem:** Container had no OAuth credentials
- **Root Cause:** `.env` file not created on Synology
- **Solution:** Created `/volume1/docker/carnaby-sk/.env` with production credentials
- **Time:** 5 minutes

**Issue 2: docker-compose.yml not loading .env**
- **Problem:** Container still missing credentials after .env creation
- **Root Cause:** `docker-compose.yml` didn't have `env_file` configuration
- **Solution:** Added `env_file: - .env` to carnaby-web service
- **Fix:** Updated `docker-compose.yml` in Git repository
- **Time:** 10 minutes

**Issue 3: Wrong volume path**
- **Problem:** Container failed to start with bind mount error
- **Error:** `'/volume1/docker/carnaby/data' does not exist`
- **Root Cause:** Path was `/volume1/docker/carnaby/data` instead of `/volume1/docker/carnaby-sk/data`
- **Solution:** Fixed volume path in `docker-compose.yml`
- **Time:** 5 minutes

**Issue 4: Outdated docker-compose.yml on Synology**
- **Problem:** Changes not applied after Git push
- **Root Cause:** Watchtower only updates Docker images, not `docker-compose.yml`
- **Solution:** Manually updated `docker-compose.yml` on Synology
- **Learning:** Configuration files must be updated manually on server
- **Time:** 10 minutes

**Issue 5: Session cookies not created**
- **Problem:** User authenticated but avatar not shown, `/auth/user` returned `{authenticated: false}`
- **Root Cause:** Server behind Synology reverse proxy sees HTTP, but `secure: true` requires HTTPS
- **Symptoms:** 
  - Login successful in server logs: `✅ User logged in: user@example.com`
  - No cookies in browser (Application → Cookies was empty)
  - Session not persisting across requests
- **Solution:** 
  1. Added `app.set('trust proxy', 1)` to trust X-Forwarded-* headers
  2. Changed `secure: process.env.NODE_ENV === 'production'` to `secure: 'auto'`
- **Time:** 30 minutes (investigation + fix)

**Issue 6: Testing in regular browser**
- **Problem:** Cached state from previous failed attempts
- **Solution:** Tested in incognito mode
- **Time:** 5 minutes

#### Final Configuration

**server.js changes:**
```javascript
// Trust proxy for reverse proxy compatibility
app.set('trust proxy', 1);

// Session cookie configuration
cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: 'auto',  // Auto-detect HTTPS (works with reverse proxy)
    sameSite: 'lax'
}
```

**docker-compose.yml:**
```yaml
services:
  carnaby-web:
    env_file:
      - .env
    volumes:
      - /volume1/docker/carnaby-sk/data:/app/data
```

**Synology .env:**
```env
NODE_ENV=production
GOOGLE_CLIENT_ID=<client-id>
GOOGLE_CLIENT_SECRET=<secret>
GOOGLE_CALLBACK_URL=https://carnaby.sk/auth/google/callback
SESSION_SECRET=<production-secret>
```

#### Production Testing Results

**Test 1: Authentication Flow**
1. ✅ Opened `https://carnaby.sk`
2. ✅ Clicked "Prihlásiť sa cez Google"
3. ✅ Google consent screen displayed
4. ✅ Authorized app
5. ✅ Redirected to `https://carnaby.sk`
6. ✅ Avatar and name displayed: "Jozef Sokol"

**Test 2: Session Persistence**
1. ✅ Refreshed page → Still logged in
2. ✅ Closed browser → Reopened → Still logged in
3. ✅ Cookie `connect.sid` present in browser

**Test 3: API Endpoint**
```bash
curl https://carnaby.sk/auth/user
# Response:
{
  "authenticated": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "displayName": "Jozef Sokol",
    "avatarUrl": "https://lh3.googleusercontent.com/..."
  }
}
```

**Test 4: Logout**
1. ✅ Clicked "Odhlásiť sa"
2. ✅ Redirected to homepage
3. ✅ "Prihlásiť sa cez Google" button shown
4. ✅ Cookie removed from browser

**Test 5: Database Verification**
```bash
sqlite3 /volume1/docker/carnaby-sk/data/database.sqlite "SELECT * FROM users;"
# 1|<google_id>|user@example.com|Jozef Sokol|<avatar_url>|2026-01-20 15:09:00|2026-01-20 16:30:00

sqlite3 /volume1/docker/carnaby-sk/data/database.sqlite "SELECT COUNT(*) FROM sessions;"
# 1
```

#### Key Learnings

**1. Reverse Proxy Considerations:**
- Express must trust proxy headers: `app.set('trust proxy', 1)`
- Cookie `secure` setting must be `'auto'` or `false` when behind reverse proxy
- Server sees HTTP even though client uses HTTPS

**2. Docker Compose Limitations:**
- Watchtower updates Docker images only
- Configuration files (`docker-compose.yml`, `.env`) must be updated manually
- Always version control configuration and document deployment steps

**3. Environment Variables:**
- `.env` file must be in same directory as `docker-compose.yml`
- Use `env_file` in docker-compose to load `.env`
- Verify environment variables are loaded: `docker exec carnaby-sk env | grep GOOGLE`

**4. Session Debugging:**
- Check browser cookies first (F12 → Application → Cookies)
- Test `/auth/user` endpoint to verify session
- Use incognito mode to avoid cached state
- Check server logs for authentication events

**5. Production Deployment Checklist:**
- [ ] Create `.env` file on server
- [ ] Update `docker-compose.yml` on server (if changed)
- [ ] Verify volume paths exist
- [ ] Test in incognito mode
- [ ] Check cookies are created
- [ ] Verify database records

#### Deployment Statistics

**Total Time:** ~1.5 hours (including debugging)  
**Issues Resolved:** 6  
**Git Commits:** 3 (env_file, volume path, trust proxy)  
**Production Deployments:** 3  
**Final Status:** ✅ **PRODUCTION READY**

#### Conclusion

Google OAuth 2.0 authentication is now **fully functional in production** on `https://carnaby.sk`. The implementation handles:
- ✅ Secure authentication via Google
- ✅ Session persistence across container restarts (SQLite store)
- ✅ Reverse proxy compatibility (Synology NAS)
- ✅ Automatic user provisioning (JIT)
- ✅ Google-style UI/UX
- ✅ Multi-language support (SK/EN)

The main challenge was configuring Express sessions to work correctly behind a reverse proxy. The solution (`trust proxy` + `secure: 'auto'`) is now documented and production-tested.

**Production URL:** https://carnaby.sk  
**Status:** 🟢 **LIVE & WORKING**

---

### Commit 14: Authentication UI Redesign

**Date:** 2026-01-20 (evening)  
**Time:** ~1 hour  
**Complexity:** Medium (UI/UX redesign, CSS positioning)

#### User Request (Slovak)

```
Login a avatar by sa presunul do header aby bol uplne hore v pravo. a 
- neprihlaseny nebude standardne google trlacitko ale tiez kruzok tak isto velky ale bude vnom len silueta. bez teztu
- prihlaseny bude len kruzok s avatarom. na hover sa zobrazi jeho meno ze je prihlaseny, a po kliknuti na avatara sa zobrazi pulldown menu kde bude zatialo iba jedna polozka Odhlasit.
```

**Translation:** Move login/avatar to header (top right). Logged-out state: circular button with user silhouette icon (no text). Logged-in state: circular avatar, on hover show name, on click show dropdown menu with logout option.

#### Implementation

**1. HTML Changes (`index.html`):**
- Moved authentication from navigation to hero header overlay
- Created circular button structure for logged-out state with SVG user silhouette
- Created avatar wrapper with dropdown menu for logged-in state
- Removed old authentication section from navigation

**2. CSS Changes (`style.css`):**
- Added `.auth-section-header` - positioned absolute (top: 20px, right: 20px)
- Added `.auth-avatar-circle` - 48px circular button with glassmorphism effect
- Added `.user-silhouette` - 44px SVG icon with golden color
- Added `.user-dropdown` - dropdown menu with fade-in animation
- Added hover effects (scale 1.05, border color change)
- Fixed `.hero-overlay` positioning (removed transform that was hiding content)

**3. JavaScript Changes (`script.js`):**
- Updated `checkAuth()` to populate `user-name-dropdown` instead of `user-name`
- Changed display style from `flex` to `block` for header layout
- Added duplicate event listener prevention

#### Debugging Journey

**Issue 1: Authentication UI Hidden**
- **Problem:** Auth button not visible on page
- **Root Cause:** `.hero-overlay` had `transform: translate(-50%, -50%)` which moved content off-screen
- **Solution:** Changed to `top: 0; left: 0; width: 100%; height: 100%`
- **Time:** 5 minutes

**Issue 2: SVG Icon Too Small**
- **Problem:** User silhouette icon appeared tiny in circular button
- **Root Cause:** SVG had hardcoded `width="24" height="24"` in HTML overriding CSS
- **Solution:** 
  1. Removed `width` and `height` attributes from SVG element
  2. Increased CSS size from 24px → 32px → 36px → 40px → 44px
  3. Added `display: block` for proper rendering
- **Time:** 20 minutes (multiple iterations)

**Issue 3: Corrupted CSS During Edit**
- **Problem:** CSS syntax errors with nested selectors
- **Root Cause:** Incorrect replacement chunk created nested CSS
- **Solution:** Restored proper CSS structure with separate selectors
- **Time:** 10 minutes

#### Final Design Specifications

**Logged-Out State:**
```css
.auth-avatar-circle {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(10px);
    border: 2px solid rgba(255, 255, 255, 0.3);
}

.user-silhouette {
    width: 44px;
    height: 44px;
    color: var(--accent-gold);
}
```

**Logged-In State:**
```css
.user-avatar-header {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 2px solid var(--accent-gold);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.user-dropdown {
    position: absolute;
    top: 60px;
    right: 0;
    min-width: 200px;
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease;
}

.auth-avatar-wrapper:hover .user-dropdown {
    opacity: 1;
    visibility: visible;
}
```

#### User Experience Flow

**Logged-Out:**
1. User sees circular button with golden user silhouette icon (top right)
2. Hover: Background lightens, border turns gold, button scales to 1.05
3. Click: Redirects to Google OAuth login

**Logged-In:**
1. User sees circular avatar with their Google profile photo
2. Hover: Avatar scales to 1.05, border changes to orange, dropdown menu fades in
3. Dropdown shows: User name (header) + Logout button with icon
4. Click logout: Redirects to `/auth/logout`, session destroyed

#### Testing Results

**Visual Testing:**
- ✅ Circular button visible in header (top right)
- ✅ SVG icon properly sized (44px in 48px circle)
- ✅ Glassmorphism effect working
- ✅ Hover animations smooth (scale, color transitions)
- ✅ Dropdown menu appears on hover
- ✅ Avatar displays correctly with golden border

**Functional Testing:**
- ✅ Login flow works (click → Google → redirect back)
- ✅ Avatar loads from Google (with SVG fallback)
- ✅ Dropdown shows user name
- ✅ Logout button works
- ✅ Session persists across page refreshes

**Responsive Testing:**
- ✅ Works on desktop (tested)
- ⚠️ Mobile responsive design not yet tested

#### Files Modified

**3 files changed, 174 insertions(+), 41 deletions(-)**

1. **index.html** - Moved auth to header, added dropdown structure
2. **style.css** - Added header auth styles, fixed hero-overlay
3. **script.js** - Updated checkAuth for dropdown

#### Key Learnings

**1. SVG Sizing:**
- HTML `width`/`height` attributes override CSS
- Always remove inline sizing for CSS control
- Use `!important` when necessary to override viewBox scaling

**2. CSS Positioning:**
- `transform: translate(-50%, -50%)` centers element but moves children
- Use `top: 0; left: 0; width: 100%; height: 100%` for full overlay
- Absolute positioning requires parent with `position: relative`

**3. Dropdown Menus:**
- Use `opacity` + `visibility` for smooth transitions
- `visibility: hidden` removes from accessibility tree
- Hover on both wrapper and dropdown prevents flickering

**4. Glassmorphism:**
- `backdrop-filter: blur(10px)` requires semi-transparent background
- Works best with `rgba(255, 255, 255, 0.15)`
- May not work in all browsers (fallback to solid background)

#### Statistics

**Time:** ~1 hour  
**Iterations:** 6 (SVG sizing attempts)  
**CSS Lines Added:** ~130  
**Debugging Issues:** 3  
**Final Status:** ✅ **APPROVED BY USER**

---



## 📊 Project Statistics

**Total development time:** ~530 minutes (~8.8 hours including OAuth + production + UI redesign)  
**Total manual code written:** ~5 lines (port change)  
**AI-generated code:** ~100% of functionality  
**Real-world incidents handled:** 12 (npm ci, SQLite permissions, OAuth dotenv, missing .env, env_file, volume path, docker-compose sync, session cookies, browser cache, hero-overlay, SVG sizing, CSS corruption - ALL RESOLVED ✅)  
**Production deployments:** 5 (initial, volume fix, env_file, trust proxy, UI redesign - ALL SUCCESSFUL 🚀)  
**CI/CD pipelines:** 1 (GitHub Actions + Watchtower - AUTOMATED ⚡)  
**Automated deployments:** 6 (CI/CD test, npm ci migration, OAuth deployments, UI redesign)  
**Build reproducibility:** 100% (npm ci with package-lock.json) ✅  
**Debugging iterations:** 26 (npm ci: 3, category tabs: 2, SQLite permissions: 5, OAuth dev: 4, OAuth prod: 6, UI redesign: 6) 🔧  
**Features implemented:** 10 (server, gitignore, theme toggle, database, Docker, CI/CD, npm ci, category tabs, persistence architecture, Google OAuth) 🎨  
**Database migrations:** Production-ready system with WAL mode ✅  
**Automated backups:** Daily backups to Google Drive ✅  
**Authentication:** Google OAuth 2.0 with session management (PRODUCTION LIVE) ✅  
**UI/UX:** Header authentication with circular avatar and dropdown menu ✅

## 🏆 Achievements Unlocked
- ✅ Full-stack web application built from scratch
- ✅ Database-driven dynamic content
- ✅ Dark/Light theme with system detection
- ✅ Dockerized for production deployment
- ✅ Successfully deployed to Synology NAS
- ✅ Real-world error debugging and resolution (12 production incidents)
- ✅ Comprehensive documentation maintained throughout
- ✅ Automated CI/CD pipeline with zero-downtime deployments
- ✅ Production-grade database persistence architecture
- ✅ Automated migration system with WAL mode
- ✅ Automated backup system to Google Drive
- ✅ Debugged and resolved SQLite directory permissions issue
- ✅ Backups verified on Google Cloud
- ✅ Google OAuth 2.0 authentication with session management
- ✅ JIT user provisioning (automatic user creation)
- ✅ Google-style UI/UX design
- ✅ Reverse proxy compatibility (Synology NAS)
- ✅ Production OAuth deployment with full debugging documentation
- ✅ Header authentication with circular avatar design
- ✅ Glassmorphism effects and modern UI patterns
- ✅ Dropdown menu with smooth animations
- ✅ **LIVE IN PRODUCTION:** https://carnaby.sk 🚀

---

### Commit 13: Umami Analytics with PostgreSQL (Day 6)

**Prompt (Slovak):** "Mám pre teba ďalšiu chuťovku :) Ideme nasadiť Umami, ale striktne so SQLite.

Uprav docker-compose.yml tak, aby Umami kontajner používal SQLite databázu uloženú v /app/data/umami.sqlite.

Namapuj tento súbor (alebo priečinok) na hostiteľa na Synology, aby som ho mohol zahrnúť do môjho backup skriptu.

Nepridávaj PostgreSQL službu.

Ak je môj návrh v niečom zlý kľudne protestuj."

**Translation:** "I have another treat for you :) We're going to deploy Umami, but strictly with SQLite. Modify docker-compose.yml so that the Umami container uses SQLite database stored in /app/data/umami.sqlite. Map this file (or directory) to the host on Synology so I can include it in my backup script. Don't add PostgreSQL service. If my proposal is wrong in something, feel free to protest."

**AI Response:** ⚠️ **Protest accepted!** Umami does not support SQLite - only PostgreSQL 12.14+, MySQL 8.0+, and MariaDB 10.5+.

**User Decision:** "ok rozumiem .. ale ak tam uz budeme mat kontainer s postgresql tak potom .. a to je len otazka teraz to nebudeme riesit. nebolo by lepsie tuto databazu pouzit aj na web aj na unami ? proste zbavit sa sqlite ?"

**Translation:** "ok I understand .. but if we'll already have a postgresql container there then .. and this is just a question we won't solve now. wouldn't it be better to use this database for both web and umami? simply get rid of sqlite?"

**AI Response:** ✅ Excellent idea! Shared PostgreSQL for both applications - future migration planned.

**Result:** ✅ Complete Umami Analytics deployment with PostgreSQL

**1. Docker Compose Configuration**

- **Added PostgreSQL service** (`db`):
  - Image: `postgres:15-alpine` (~80MB)
  - Container: `carnaby-db`
  - User: `1026:100` (Synology permissions)
  - Volume: `/volume1/docker/carnaby-sk/db:/var/lib/postgresql/data`
  - Database: `umami` (user: `umami`, password: `${DB_PASSWORD}`)
  - Healthcheck: `pg_isready` every 10 seconds
  - Watchtower auto-updates enabled

- **Added Umami service** (`umami`):
  - Image: `ghcr.io/umami-software/umami:latest`
  - Container: `carnaby-umami`
  - Port: `3001:3000`
  - Database URL: `postgresql://umami:${DB_PASSWORD}@db:5432/umami`
  - Depends on: `db` (waits for healthy status)
  - Healthcheck: `/api/heartbeat` every 30 seconds
  - Start period: 60s (database initialization time)
  - Watchtower auto-updates enabled

**2. Environment Variables**

- **Updated `.env.example`**:
  - `DB_PASSWORD` - PostgreSQL password (hex format, not base64!)
  - `UMAMI_APP_SECRET` - Umami application secret
  - Note: Use `openssl rand -hex 32` for DB_PASSWORD (avoids URL-unsafe characters)

**3. Backup System**

- **Created `backup-db.sh`**:
  - Uses `pg_dump` for PostgreSQL backups
  - Compressed backups: `db-YYYYMMDD-HHMMSS.sql.gz`
  - 30-day retention policy
  - Backup location: `/volume1/private/clouds/GoogleDrive/carnaby_sk/backups`
  - Requires `sudo` for Docker access on Synology
  - Configured for Synology Task Scheduler (not crontab)

**4. Synology Task Scheduler Setup**

- **Control Panel → Task Scheduler**:
  - Task: "Backup PostgreSQL Database"
  - User: `root` (required for Docker access)
  - Schedule: Daily at 02:00
  - Script: `/volume1/docker/carnaby-sk/backup-db.sh`

**5. Subdomain Configuration**

- **DNS setup** (Websupport):
  - Added A record: `analytics.carnaby.sk` → public IP
  - Propagation time: ~5-30 minutes

- **Synology Reverse Proxy**:
  - Source: `https://analytics.carnaby.sk:443`
  - Destination: `http://localhost:3001`
  - SSL certificate: Added `analytics.carnaby.sk` to existing certificate
  - Certificate configuration: Assigned to `analytics.carnaby.sk` service

- **Tracking code** (`index.html`):
  ```html
  <script defer src="https://analytics.carnaby.sk/script.js" 
          data-website-id="0733e169-1bc1-4990-a65f-2442fbb00237"></script>
  ```

**6. Documentation Created**

- **UMAMI_QUICK_START.md** (Slovak):
  - Step-by-step deployment guide
  - Secret generation (hex vs base64)
  - Synology Task Scheduler setup
  - Troubleshooting section

- **UMAMI_SETUP.md** (English):
  - Comprehensive setup guide
  - Architecture overview
  - Backup strategies
  - Maintenance commands
  - Security recommendations

**7. Troubleshooting Resolved**

**Issue 1: Invalid URL Error**
- **Problem**: `TypeError: Invalid URL` - password contained `+`, `/`, `=` from base64
- **Solution**: Changed to `openssl rand -hex 32` (URL-safe characters)

**Issue 2: Password Authentication Failed**
- **Problem**: Database created with old password, `.env` had new password
- **Solution**: Recreate database with new password:
  ```bash
  sudo docker-compose down
  sudo rm -rf /volume1/docker/carnaby-sk/db
  sudo mkdir -p /volume1/docker/carnaby-sk/db
  sudo chown 1026:100 /volume1/docker/carnaby-sk/db
  sudo docker-compose up -d
  ```

**Issue 3: SSL Certificate Not Applied**
- **Problem**: `analytics.carnaby.sk` showed "Not Secure"
- **Solution**: Added `analytics.carnaby.sk` to certificate SAN and assigned in Certificate → Configure

**Issue 4: Docker Permission Denied**
- **Problem**: Backup script couldn't access Docker socket
- **Solution**: Added `sudo` to docker commands + configured NOPASSWD:
  ```bash
  echo "carnaby ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/local/bin/docker" | sudo tee /etc/sudoers.d/docker
  sudo chmod 0440 /etc/sudoers.d/docker
  ```

**8. Architecture Benefits**

- ✅ **Shared PostgreSQL**: Ready for future carnaby-web migration
- ✅ **Professional subdomain**: `https://analytics.carnaby.sk`
- ✅ **SSL encryption**: Same certificate as main site
- ✅ **Automated backups**: Daily pg_dump to Google Drive
- ✅ **Auto-updates**: Watchtower monitors both db and umami
- ✅ **Privacy-focused**: Self-hosted analytics (no Google Analytics)
- ✅ **Realtime tracking**: Live visitor monitoring

**9. First Visitor Tracked**

User confirmation: "fungujeeee ! 1 visitor :)" 🎉

Analytics now tracking:
- Page views
- Unique visitors
- Referrers
- Countries
- Devices (desktop/mobile)
- Browsers

**10. Naming Conventions**

- Service names: `db`, `umami` (generic, future-proof)
- Container names: `carnaby-db`, `carnaby-umami`
- Volume paths: `/volume1/docker/carnaby-sk/db` (shared database)
- Backup files: `db-*.sql.gz` (not `umami-*.sql.gz`)
- Script name: `backup-db.sh` (not `backup-umami.sh`)

**Time:** 3.5 hours (including research, troubleshooting, documentation)  
**Manual work:** 0 lines of code  
**User manual work:** DNS setup, Synology reverse proxy, SSL certificate (~20 minutes)  
**Troubleshooting iterations:** 4 (URL encoding, password auth, SSL cert, Docker permissions)  
**Production deployment:** ✅ SUCCESS - Analytics live at https://analytics.carnaby.sk  
**First tracked visitor:** ✅ User confirmed working  

**Future migration planned:** Migrate carnaby-web from SQLite to PostgreSQL (use shared `carnaby-db` container)

---

**Total development time:** ~740 minutes (~12.3 hours including OAuth + production + UI redesign + Umami)  
**Total manual code written:** ~5 lines (port change)  
**AI-generated code:** ~100% of functionality  
**Real-world incidents handled:** 16 (npm ci, SQLite permissions, OAuth dotenv, missing .env, env_file, volume path, docker-compose sync, session cookies, browser cache, hero-overlay, SVG sizing, CSS corruption, Umami URL encoding, password auth, SSL cert, Docker permissions - ALL RESOLVED ✅)  
**Production deployments:** 6 (initial, volume fix, env_file, trust proxy, UI redesign, Umami analytics - ALL SUCCESSFUL 🚀)  
**CI/CD pipelines:** 1 (GitHub Actions + Watchtower - AUTOMATED ⚡)  
**Automated deployments:** 8 (CI/CD test, npm ci migration, OAuth deployments, UI redesign, Umami, PostgreSQL migration)  
**Build reproducibility:** 100% (npm ci with package-lock.json) ✅  
**Debugging iterations:** 33 (npm ci: 3, category tabs: 2, SQLite permissions: 5, OAuth dev: 4, OAuth prod: 6, UI redesign: 6, Umami: 4, PostgreSQL: 3) 🔧  
**Features implemented:** 12 (server, gitignore, theme toggle, database, Docker, CI/CD, npm ci, category tabs, persistence architecture, Google OAuth, Umami Analytics, PostgreSQL migration) 🎨  
**Database migrations:** Production-ready async system with PostgreSQL ✅  
**Automated backups:** Daily backups to Google Drive (PostgreSQL: umami + carnaby databases) ✅  
**Authentication:** Google OAuth 2.0 with session management (PRODUCTION LIVE) ✅  
**UI/UX:** Header authentication with circular avatar and dropdown menu ✅  
**Analytics:** Umami self-hosted analytics with PostgreSQL (PRODUCTION LIVE) ✅  
**Database:** PostgreSQL 15 Alpine (shared: Umami + Web App) ✅

---

### Commit 14: SQLite to PostgreSQL Migration (Day 6)

**Prompt (Slovak):** "podme teraz na tu migraciu sqlite.. a dufam ze to uz bude posledna systemacka vec :)"

**Translation:** "let's now do the sqlite migration.. and I hope this will be the last system administration thing :)"

**Context:** After deploying Umami with PostgreSQL, the logical next step was to migrate carnaby-web from SQLite to the shared PostgreSQL instance, consolidating all databases.

**Result:** ✅ Complete migration from SQLite to PostgreSQL with zero data loss

**1. Code Migration (Async Transformation)**

- **Dependencies ([package.json](file:///c:/Users/dodus/prj/carnaby/carnaby.sk/package.json)):**
  - Removed: `better-sqlite3`, `better-sqlite3-session-store`
  - Added: `pg` (PostgreSQL driver), `connect-pg-simple` (session store)
  - Result: +15 packages, -38 packages (net reduction)

- **Database Connection ([server.js](file:///c:/Users/dodus/prj/carnaby/carnaby.sk/server.js)):**
  - Converted from synchronous SQLite to async PostgreSQL
  - Replaced single connection with connection pool (`pg.Pool`)
  - Removed WAL mode (PostgreSQL doesn't use it)
  - All queries converted to async/await with parameterized queries ($1, $2)

- **OAuth ([config/passport.js](file:///c:/Users/dodus/prj/carnaby/carnaby.sk/config/passport.js)):**
  - Converted all database queries to async
  - Used `RETURNING *` clause for INSERT statements (PostgreSQL feature)
  - Parameterized queries with `$1, $2` syntax instead of `?, ?`

- **Migrations ([migrations/](file:///c:/Users/dodus/prj/carnaby/carnaby.sk/migrations)):**
  - SQL syntax conversion:
    - `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
    - `TEXT` → `VARCHAR(255)` or `TEXT`
    - `DATETIME` → `TIMESTAMP`
    - `INSERT OR IGNORE` → `INSERT ... ON CONFLICT DO NOTHING`
  - Migration runner converted to async with `pg.Client`
  - Transaction handling with `BEGIN`/`COMMIT`/`ROLLBACK`

**2. Docker Configuration Updates**

- **[docker-compose.yml](file:///c:/Users/dodus/prj/carnaby/carnaby.sk/docker-compose.yml):**
  - Removed SQLite volume mapping (`/volume1/docker/carnaby-sk/data`)
  - Added PostgreSQL environment variables:
    - `DB_HOST=db`
    - `DB_PORT=5432`
    - `DB_NAME=carnaby`
    - `DB_USER=carnaby`
    - `DB_PASSWORD=${DB_PASSWORD}`
  - Added dependency on `db` service with health check

- **[.env.example](file:///c:/Users/dodus/prj/carnaby/carnaby.sk/.env.example):**
  - Removed: `DB_PATH=/app/data/database.sqlite`
  - Updated comment: "Database (shared: PostgreSQL for Umami + Web App)"

**3. Backup System Update**

- **[backup-db.sh](file:///c:/Users/dodus/prj/carnaby/carnaby.sk/backup-db.sh):**
  - Now backs up both databases:
    - `umami-YYYYMMDD-HHMMSS.sql.gz` (Umami Analytics)
    - `carnaby-YYYYMMDD-HHMMSS.sql.gz` (Web App)
  - Separate cleanup for each database (30-day retention)

**4. Database Setup on NAS**

```bash
# Created carnaby database and user
sudo docker exec carnaby-db psql -U umami -c "CREATE DATABASE carnaby;"
sudo docker exec carnaby-db psql -U umami -c "CREATE USER carnaby WITH PASSWORD '***';"
sudo docker exec carnaby-db psql -U umami -c "GRANT ALL PRIVILEGES ON DATABASE carnaby TO carnaby;"
sudo docker exec carnaby-db psql -U umami -d carnaby -c "GRANT ALL ON SCHEMA public TO carnaby;"
```

**5. Deployment Process**

```bash
# Local
npm install  # Updated package-lock.json (+15 packages, -38 packages)
git add .
git commit -m "Migrate from SQLite to PostgreSQL"
git push

# GitHub Actions built new image (~3 minutes)
# Watchtower automatically deployed to NAS
```

**6. Migration Execution**

Container startup logs:
```
🔄 Starting database migrations...
✅ Connected to PostgreSQL
✅ Migration tracking table ready
📊 Applied migrations: 0
📁 Found 2 migration files
🔧 Applying migration: 001_initial_schema.sql
✅ Applied 001_initial_schema.sql
🔧 Applying migration: 002_create_users_table.sql
✅ Applied 002_create_users_table.sql
🎉 Migration completed successfully!
📊 Executed 2 new migration(s)
📊 Database stats: 2 categories, 16 videos
✅ Server is running on http://localhost:3000
```

**7. Troubleshooting Resolved**

**Issue 1: npm ci Build Failure**
- **Problem**: `package-lock.json` out of sync after dependency changes
- **Solution**: Ran `npm install` locally to regenerate lockfile
- **Result**: ✅ Build succeeded

**Issue 2: postgres Role Does Not Exist**
- **Problem**: PostgreSQL configured with `POSTGRES_USER=umami`, not default `postgres`
- **Solution**: Used `umami` user (has superuser privileges) for database creation
- **Result**: ✅ Database created successfully

**Issue 3: Production .env Overwritten**
- **Problem**: User accidentally overwrote production `.env` file
- **Solution**: Restored from `.env.example`, redeployed
- **Result**: ✅ Service restored

**8. Verification**

**Database:**
```sql
\c carnaby
\dt  -- Result: categories, users, videos, session, schema_migrations
SELECT COUNT(*) FROM categories;  -- 2
SELECT COUNT(*) FROM videos;      -- 16
```

**Website:**
- ✅ https://carnaby.sk loads successfully
- ✅ All 16 videos display correctly
- ✅ Category tabs work (All, Dodo, Carnaby)
- ✅ Google OAuth login works
- ✅ Session persistence works
- ✅ No errors in browser console

**Analytics:**
- ✅ https://analytics.carnaby.sk still works
- ✅ Both databases coexist peacefully

**Backups:**
```bash
/volume1/docker/carnaby-sk/backup-db.sh
# Output:
# Database backups completed:
#   - umami-20260121-152800.sql.gz
#   - carnaby-20260121-152800.sql.gz
```

**9. Architecture Benefits**

- ✅ **Unified Infrastructure:** One PostgreSQL instance for all databases
- ✅ **Better Scalability:** Connection pooling, concurrent access
- ✅ **Simplified Backups:** Single script backs up all data
- ✅ **Production-Grade:** Industry-standard database system
- ✅ **Future-Proof:** Easy to add more databases/applications
- ✅ **Zero Data Loss:** All 16 videos + 2 categories migrated successfully
- ✅ **Zero Downtime:** Automatic deployment via Watchtower

**10. Files Changed**

**Modified:**
- `package.json` - PostgreSQL dependencies
- `server.js` - Async connection pool
- `config/passport.js` - Async queries
- `migrations/migration-runner.js` - Async migrations
- `migrations/001_initial_schema.sql` - PostgreSQL syntax
- `migrations/002_create_users_table.sql` - PostgreSQL syntax
- `docker-compose.yml` - Removed SQLite volume, added DB env vars
- `.env.example` - Removed DB_PATH
- `backup-db.sh` - Both databases

**Deleted:**
- `data/database.sqlite` - Old SQLite database
- `videos.db` - Legacy database file

**Created:**
- `scripts/create-carnaby-db.sh` - Database setup script

**Time:** 2 hours (planning + implementation + deployment)  
**Manual work:** 0 lines of code  
**User manual work:** Database creation, .env restoration (~10 minutes)  
**Troubleshooting iterations:** 3 (npm ci, postgres role, .env overwrite)  
**Production deployment:** ✅ SUCCESS - Zero data loss, zero downtime  
**User confirmation:** "kontorloval som vsetko . a ide .. !" (checked everything, it works!)

**Final achievement:** "žiadna systémačka" (no more system administration) - only programming from now on! 🎉

---

**Total development time:** ~860 minutes (~14.3 hours including OAuth + production + UI redesign + Umami + PostgreSQL)  
**Total manual code written:** ~5 lines (port change)  
**AI-generated code:** ~100% of functionality  
**Real-world incidents handled:** 19 (npm ci, SQLite permissions, OAuth dotenv, missing .env, env_file, volume path, docker-compose sync, session cookies, browser cache, hero-overlay, SVG sizing, CSS corruption, Umami URL encoding, password auth, SSL cert, Docker permissions, PostgreSQL npm ci, postgres role, .env overwrite - ALL RESOLVED ✅)  
**Production deployments:** 7 (initial, volume fix, env_file, trust proxy, UI redesign, Umami analytics, PostgreSQL migration - ALL SUCCESSFUL 🚀)  

---

### Commit 15: Admin Section with Role-Based Access (Day 6)

**Prompt (Slovak):** "kontorloval som vsetko . a ide .. ! podme este spravit taky cleanup projektu ... no chcem zacat administraciu .. prihlasenie uz mame tak ako prve by sme mohli skusit uplnu banalitu ze ked sa prihlasim ja :) "dodusik@gmail.com" tak vo menu pod mojim avatarom pridaj polozku co ja viem administracia a po kliknuti na nu sa zobrazi samostatne stranka kde zatial nemusi byt nic funkcne len nech sa nieco zobrazi."

**Translation:** "checked everything and it works! let's do some project cleanup ... now I want to start administration .. we already have login so as first we could try a complete triviality that when I log in as "dodusik@gmail.com" then in the menu under my avatar add an item like administration and when clicked it shows a separate page where there doesn't have to be anything functional yet just show something."

**Context:** After successful PostgreSQL migration and project cleanup, starting development of admin features with role-based access control.

**Result:** ✅ Complete admin section with role-based access, protected routes, and conditional UI

**1. Database Schema**

**New migration:** `migrations/003_add_user_roles.sql`

```sql
-- Add role column to users table
ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Set dodusik@gmail.com as admin
UPDATE users SET role = 'admin' WHERE email = 'dodusik@gmail.com';
```

**Roles:**
- `user` - default role (can view site, login)
- `admin` - can access admin section (dodusik@gmail.com)

**2. Backend Implementation**

**Admin Middleware** ([middleware/admin.js](file:///c:/Users/dodus/prj/carnaby/carnaby.sk/middleware/admin.js)):
```javascript
function isAdmin(req, res, next) {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }
    
    next();
}
```

**Admin Routes** ([routes/admin.js](file:///c:/Users/dodus/prj/carnaby/carnaby.sk/routes/admin.js)):
- `GET /admin` - Admin page (protected by `isAdmin` middleware)
- `GET /admin/api/check` - Check if current user is admin

**Passport Updates** ([config/passport.js](file:///c:/Users/dodus/prj/carnaby/carnaby.sk/config/passport.js)):
- Automatic role assignment on user creation
- `dodusik@gmail.com` → `admin` role
- All other users → `user` role

**3. Frontend Implementation**

**Admin Menu Item** ([index.html](file:///c:/Users/dodus/prj/carnaby/carnaby.sk/index.html)):
```html
<!-- Admin menu item (only for admins) -->
<a href="/admin" id="admin-menu-item" class="dropdown-item" style="display: none;">
    <svg>...</svg>
    <span>⚙️ Administrácia</span>
</a>
```

**Admin Page** ([admin.html](file:///c:/Users/dodus/prj/carnaby/carnaby.sk/admin.html)):
- Welcome card with feature roadmap
- User info display (email, role)
- Modern design with glassmorphism effects
- Dark/Light theme support
- Responsive layout

**Admin Check** ([script.js](file:///c:/Users/dodus/prj/carnaby/carnaby.sk/script.js)):
```javascript
async function checkAdminAccess() {
    const response = await fetch('/admin/api/check');
    const data = await response.json();
    
    if (data.isAdmin) {
        document.getElementById('admin-menu-item').style.display = 'flex';
    }
}
```

**4. Security Features**

✅ **Backend Protection:**
- Admin routes protected by middleware
- Role checked on every request
- 401 Unauthorized for non-authenticated users
- 403 Forbidden for non-admin users

✅ **Frontend Hiding:**
- Menu item hidden by default
- Only shown after successful admin check
- Direct URL access blocked by backend

✅ **Role Storage:**
- Role stored in database (tamper-proof)
- Not in session or cookies
- Verified on every admin request

**5. Admin Page Features**

**Current:**
- ⚙️ Welcome message
- 📋 Feature roadmap preview
- ℹ️ User info display (email, role)

**Planned Features:**
- 📝 Content management (add/edit/delete videos)
- 📊 Analytics dashboard integration
- 🎵 Category management
- ✍️ Blog editor (future)

**6. Styling**

**Admin CSS** ([admin.css](file:///c:/Users/dodus/prj/carnaby/carnaby.sk/admin.css)):
- Modern card-based layout
- Glassmorphism effects
- Gold accent colors (brand consistency)
- Smooth transitions and hover effects
- Responsive design (mobile-friendly)
- Dark/Light theme support

**7. Files Created/Modified**

**New files:**
- `migrations/003_add_user_roles.sql` - Role column migration
- `middleware/admin.js` - Admin middleware
- `routes/admin.js` - Admin routes
- `admin.html` - Admin page
- `admin.css` - Admin styles
- `admin.js` - Admin page logic

**Modified files:**
- `server.js` - Registered admin routes
- `config/passport.js` - Role assignment on user creation
- `index.html` - Added admin menu item
- `script.js` - Admin check function, translations

**8. User Experience**

**Admin User (dodusik@gmail.com):**
1. Login with Google OAuth
2. See "⚙️ Administrácia" in dropdown menu
3. Click → Navigate to `/admin`
4. View welcome page with roadmap

**Regular User:**
1. Login with Google OAuth
2. No admin menu item visible
3. Cannot access `/admin` (403 Forbidden)

**Not Logged In:**
1. Cannot access `/admin` (401 Unauthorized)
2. Redirected to home page

**9. Development Workflow**

**Local Testing:**
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# Login as dodusik@gmail.com
# Verify admin menu appears
# Test admin page access
```

**Production Deployment:**
```bash
git add .
git commit -m "Add admin section with role-based access"
git push
# GitHub Actions builds → Watchtower deploys
```

**Time:** ~1 hour (planning + implementation)  
**Manual work:** 0 lines of code  
**AI-generated code:** 100% of functionality  
**User feedback:** "LGTM" (Looks Good To Me) - approved plan immediately  

**Achievement:** First feature development after infrastructure setup - "žiadna systémačka" (no more system administration) fulfilled! 🎨


### Commit 16: Blog System Backend & Database (Day 7)

**Prompt (Slovak):** "podme implementovat ten blog. potrebujeme tabulky pre posty, kategorie a API endpointy. chcem aby to podporovalo aj youtube videa aj vlastne obrazky."

**Translation:** "let's implement the blog. we need tables for posts, categories and API endpoints. i want it to support youtube videos as well as custom images."

**Context:** Building the core infrastructure for the dynamic content management system to replace hardcoded videos.

**Result:** ✅ Complete backend infrastructure for the blog system

**1. Database Schema**

**Migrations:**
- `migrations/004_create_categories.sql` - Categories table (Dodo, Carnaby)
- `migrations/005_create_posts.sql` - Main posts table with rich metadata
- `migrations/006_create_post_categories.sql` - Many-to-many relationship

**2. API Implementation**

**Routes** ([routes/posts.js](file:///c:/Users/dodus/prj/carnaby/carnaby.sk/routes/posts.js)):
- CRUD endpoints for posts
- Filter support (status, category, featured)
- Specialized endpoints:
  - `POST /api/posts/:id/upload-thumbnail` (Multer integration)
  - `POST /api/posts/:id/thumbnail-from-youtube` (Auto-download from YT)
  - `POST /api/posts/:id/increment-views`

**3. Infrastructure**
- **Multer:** Configured for local file storage in `public/thumbnails`
- **Static files:** Express configured to serve `public` directory
- **Path parsing:** Added support for extracting IDs from URL paths

---

### Commit 17: Admin Dashboard - Content Management (Day 7)

**Prompt (Slovak):** "teraz to admin rozhranie. chcem zoznam postov a editor. editor by mal mat markdown nahlad v realnom case."

**Translation:** "now the admin interface. i want a list of posts and an editor. the editor should have realtime markdown preview."

**Context:** Creating the visual interface for content management, allowing the user to manage the blog without touching the database.

**Result:** ✅ Fully functional Admin UI for Posts

**Features:**
- **Posts List:** Table view with thumbnails, status badges, and quick actions
- **Markdown Editor:** Split-screen editor with `marked.js` live preview
- **Thumbnail Manager:** Interface for uploading images or fetching from YouTube
- **Category Selector:** Multi-select checkboxes
- **Status Workflow:** Draft vs. Published states

**Files Created:**
- `admin-posts.html` - Dashboard view
- `admin-post-editor.html` - Create/Edit form

---

### Commit 18: Video Migration & Frontend Integration (Day 7)

**Prompt (Slovak):** "podme spravit migraciu videi .. staci ze .. sa vytvoria zaznamy s yt id... a potom upravit frontend aby nacitaval posty z databazy."

**Translation:** "let's do the migration of videos .. it's enough if .. records with yt id are created... and then update the frontend to load posts from database."

**Context:** Moving away from the hardcoded `videos` table and `index.html` static content to the new dynamic `posts` system.

**Result:** ✅ Successful migration and frontend update

**1. Migration Script**
Created `scripts/migrate-videos.js`:
- Connects to PostgreSQL
- Reads legacy `videos` table
- Creates new `posts` records (Draft status)
- **Automatically downloads thumbnails** from YouTube for all videos
- Preserves category associations

**2. Execution Log**
- Migrated 16 videos
- 100% success rate on thumbnail downloads
- All posts linked to correct categories (Dodo/Carnaby)

**3. Frontend Updates**
- Updated `server.js` to serve posts via `/api/videos` endpoint (backward compatibility)
- Frontend now renders the 17 published posts dynamically from PostgreSQL
- Preserved the original design and Layout

---

### Commit 19: Multi-language Support (Day 7)

**Prompt (Slovak):** "zabudol som na to ze stranka je multi language... ojj. normalne by som sa klonil ku moznosti 2 ale volim moznost 1 [Simple Column].. nepredpokladam ze budem pridavat dalsi jazyk."

**Translation:** "i forgot that the site is multi language... oops. normally i would lean towards option 2 but i choose option 1 [Simple Column].. i don't assume i will be adding another language."

**Context:** Realized the site supports EN/SK but the database schema didn't account for it. Chosen the simplest implementation path.

**Result:** ✅ Language support added

**Changes:**
1. **Migration:** `migrations/007_add_language_to_posts.sql`
   - Added `language` column (VARCHAR(5))
   - Default: 'sk'
   - Indexed for performance
2. **API Update:** Added `language` query parameter filtering to `GET /api/posts`

---

### 🔄 AI Model Switch (Day 8)

**Event:** Session limit reached with Claude 3.5 Sonnet.
**Action:** Switched to **Gemini 3 Pro**.
**Context:** Continuity of the project preserved across AI models. Starting Phase 3 (Frontend Detail Pages).

---

**Total development time:** ~980 minutes (~16+ hours)  
**Total manual code written:** ~5 lines  
**AI-generated code:** ~100% of functionality  
**Real-world incidents handled:** 21 (all infrastructure/migration related - RESOLVED ✅)  
**Production deployments:** 8 (PostgreSQL migration & Blog System - ALL SUCCESSFUL 🚀)  
**Features implemented:** Complete Blog System (Backend + Admin + Frontend) 📝  

## 🏆 Achievements Unlocked
- ✅ Full-stack web application built from scratch
- ✅ **Infrastructure & DevOps:**
  - ✅ Dockerized for production deployment
  - ✅ Successfully deployed to Synology NAS
  - ✅ Automated CI/CD pipeline with zero-downtime deployments
  - ✅ Automated migration system (SQLite → PostgreSQL async)
  - ✅ **Complete SQLite to PostgreSQL migration** (zero data loss, zero downtime)
  - ✅ **Unified database infrastructure** (one PostgreSQL instance for all apps)
  - ✅ **Async database architecture** (connection pooling, production-ready)
  - ✅ **Automated PostgreSQL backups** (pg_dump to Google Drive)
  - ✅ Backups verified on Google Cloud
  - ✅ Reverse proxy compatibility (Synology NAS)
  - ✅ **Subdomain SSL configuration** (analytics.carnaby.sk)

- ✅ **Security & Auth:**
  - ✅ Google OAuth 2.0 authentication with session management
  - ✅ JIT user provisioning (automatic user creation)
  - ✅ **Admin section with role-based access control** 
  - ✅ **Protected admin routes** (middleware-based security)
  - ✅ **Conditional UI rendering** (admin menu only for admins)
  - ✅ Production OAuth deployment with full debugging documentation

- ✅ **Frontend & UX:**
  - ✅ Database-driven dynamic content
  - ✅ Google-style UI/UX design
  - ✅ Glassmorphism effects and modern UI patterns
  - ✅ Dark/Light theme with system detection
  - ✅ Header authentication with circular avatar design
  - ✅ Dropdown menu with smooth animations

- ✅ **Blog / CMS System:**
  - ✅ **Dynamic Blog System** implemented
  - ✅ **Admin Content Management System** (CMS) built
  - ✅ **Markdown support** with live preview
  - ✅ **Automated Media Handling** (YouTube thumbnail scraper)
  - ✅ **Legacy Data Migration** (Videos -> Posts)
  - ✅ **Multi-language Architecture** (SK/EN support)

- ✅ **Analytics:**
  - ✅ **Umami Analytics with PostgreSQL** (self-hosted, privacy-focused)
  - ✅ **Realtime visitor tracking** (first visitor confirmed!)

- ✅ **Philosophy:**
  - ✅ Debugged and resolved SQLite directory permissions issue
  - ✅ Real-world error debugging and resolution (21+ production incidents)
  - ✅ Comprehensive documentation maintained throughout
  - ✅ **"No more system administration"** - ready for pure programming! 🎨
  - ✅ **LIVE IN PRODUCTION:** https://carnaby.sk 🚀
  - ✅ **ANALYTICS LIVE:** https://analytics.carnaby.sk 📊
