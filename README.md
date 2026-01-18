# Carnaby.sk - AI Web Development Journey

## Tech Stack
- Vanilla JS (no frameworks)
- SQLite database (better-sqlite3)
- Express.js server
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

---

**Total development time:** ~20 minutes  
**Total manual code written:** ~5 lines (port change)  
**AI-generated code:** ~100% of functionality