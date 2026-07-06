# carnaby.sk v2 — Full Rewrite Design

**Date:** 2026-07-06
**Status:** Approved by owner (Jozef Sokol) — see decisions log below.
**Branch strategy:** old site preserved on `main` + `carnaby-sk-origin`; all v2 work happens on branch `v2`. `main` stays untouched until final cutover.

---

## 1. Context

carnaby.sk is the personal hub of Jozef Sokol — a bilingual (SK/EN) blog with three content identities:

| Category | Topic | Accent color |
|---|---|---|
| **DevLog** | coding, React/TS, AI experiments | `#10b981` (emerald) |
| **Dodo** | acoustic folk / Americana music | `#f59e0b` (amber) |
| **Carnaby** | retro synth-pop / euro-disco | `#a855f7` (purple) |

The v1 site was an experiment: 100% AI-written vanilla JS + Express + EJS, deliberately **zero libraries**. It is live, self-hosted on a Synology NAS (`192.168.1.41`, SSH port 2222, cert auth works) via Docker + GHCR + Watchtower, with PostgreSQL 15 (shared with self-hosted Umami analytics) and Google OAuth2 (Passport).

v2 goal: rewrite everything on a modern stack with a new "black glass" design, keeping the same content, URLs, deployment model (NAS + GHCR + Watchtower), Google OAuth login, and Umami analytics.

## 2. Approved decisions

| Decision | Choice |
|---|---|
| Monorepo | **Nx + pnpm workspaces**, Node 22 LTS |
| Frontend | **Next.js** (App Router, RSC), Tailwind CSS v4 |
| Backend | **NestJS** (Express adapter) |
| API layer | **tRPC** (`/trpc`), type-only `AppRouter` import in web |
| ORM | **Drizzle** + drizzle-kit migrations |
| Auth | **better-auth** (Google provider, Drizzle adapter, Postgres sessions) |
| Database | **New dedicated `postgres:17-alpine` container** (`carnaby-db-v2`); old postgres:15 stays for Umami |
| Data | **Migrate everything** (users, categories, posts, translations, thumbnails) |
| Theme | **Dark-only** black-glass design |
| Admin UI | **shadcn/ui** (Radix + Tailwind) |
| Container topology | Two images: `ghcr.io/carnaby/carnaby-web` + `ghcr.io/carnaby/carnaby-api` (mirrors the proven omnistra pattern on the same NAS) |

## 3. Branch & release safety strategy

Critical constraint: **pushing to `main` today rebuilds `ghcr.io/carnaby/carnaby.sk:latest` and Watchtower auto-deploys it within 24 h.** Therefore:

1. `carnaby-sk-origin` — immutable archive of the old site (created & pushed ✔).
2. `v2` — working branch. First commit wipes the tree; everything new is built here. The old workflow triggers only on `main`, so `v2` pushes never touch the live site.
3. The v2 CI workflow (lives on `v2`) runs lint/typecheck/tests on every push and builds images **only under the new names** with a `:dev` tag (`carnaby-web:dev`, `carnaby-api:dev`). The legacy image name `carnaby.sk` is never rebuilt again.
4. Staging deploy: the v2 stack runs on the NAS alongside the old site (web on host port **3100**; old site keeps 3000).
5. Cutover (only after owner verifies staging): fast-forward/force `main` → v2 state; from then the workflow tags `:latest` on the new image names; owner switches DSM reverse proxy carnaby.sk → port 3100. **Rollback = point proxy back to 3000.** Old container, old image, and old DB remain intact until explicitly decommissioned.

## 4. Monorepo layout

```
carnaby.sk/ (branch v2)
├─ apps/
│  ├─ web/                 # Next.js — public site + admin UI
│  └─ api/                 # NestJS — tRPC, better-auth, uploads, image pipeline
├─ packages/
│  ├─ db/                  # Drizzle schema, migrations, client factory
│  └─ shared/              # category/color/locale constants, shared types, zod schemas
├─ tools/
│  └─ migrate-legacy/      # one-off v1 → v2 data migration script
├─ docker/
│  ├─ web.Dockerfile
│  ├─ api.Dockerfile
│  ├─ docker-compose.dev.yml    # local: postgres:17 only (apps run via pnpm/nx)
│  └─ docker-compose.nas.yml    # NAS: web + api + db-v2 (+ labels for existing watchtower)
├─ .github/workflows/ci.yml     # lint+typecheck+test → build+push images
├─ docs/superpowers/specs|plans/
├─ nx.json, pnpm-workspace.yaml, package.json, tsconfig.base.json
```

- Web imports **only the type** `AppRouter` from the api (TS path alias, `import type`) — full end-to-end types, zero runtime coupling.
- `packages/shared` is the single source of truth for category metadata (slug, names SK/EN, color, icon) — v1 had this duplicated in 4 files.

## 5. Database schema (Drizzle, Postgres 17)

better-auth managed tables (generated via better-auth CLI, snake_case):
- `user` — id (text), name, email (unique), email_verified, image, **role** (`admin` | `user`, additional field), created_at, updated_at
- `session`, `account`, `verification` — better-auth standard (account holds provider `google` + provider account id)

Content tables:
- `categories` — id serial PK, slug text unique, name text, description text, sort_order int, created_at
- `posts` — id serial PK, slug text unique, status enum(`draft`|`published`|`archived`) default draft, is_featured bool default false, thumbnail_path text, youtube_id text, soundcloud_url text, author_id text FK→user, view_count int default 0, published_at timestamptz, created_at, updated_at
- `post_translations` — id serial PK, post_id FK→posts ON DELETE CASCADE, language enum(`sk`|`en`), title text, excerpt text, content text (markdown), meta_description text, created_at, updated_at, **UNIQUE(post_id, language)**
- `post_categories` — post_id + category_id composite PK, both FK CASCADE

Dropped from v1: `videos` (dead), legacy content columns on `posts` (title/content/excerpt/meta_description/language — consolidated into translations-only model), `session` (connect-pg-simple), `schema_migrations` (replaced by drizzle-kit journal).

Migrations: `drizzle-kit generate` in dev; api runs programmatic `migrate()` on startup before Nest bootstrap (same behavior as v1's runner — container deploys stay hands-off).

Language policy: default `sk` everywhere (fixes the v1 inconsistency where the posts API defaulted to `en`). Read fallback chain: requested → other language (a post with only one translation still renders).

## 6. API app (NestJS)

Single Express-based Nest app, internal port **3001**. No host port on the NAS — only the web container reaches it on the docker network. Locally it binds localhost:3001.

- **better-auth** mounted at `/api/auth/*`: Google provider (`GOOGLE_CLIENT_ID/SECRET`), Drizzle adapter, DB sessions, `trustedOrigins` = APP_URL. Admin bootstrap via env `ADMIN_EMAILS` (comma-separated; hook sets `role='admin'` on sign-in when email matches) — replaces v1's hardcoded email.
- **tRPC** at `/trpc` (express middleware). Context: resolve better-auth session from cookie → `{ user | null }`. Procedures: `public`, `admin` (throws UNAUTHORIZED/FORBIDDEN).
  - `posts.list` (public: only published; filters category/featured/language, cursor or page pagination)
  - `posts.bySlug` (public, language + fallback; returns raw markdown — HTML rendering happens in the web app)
  - `posts.adminList` (admin: any status, filters/sort/pagination — parity with v1 admin table)
  - `posts.byId` (admin: post + all translations for the editor)
  - `posts.create` / `posts.update` / `posts.delete` (admin; transactional upsert of translations + categories)
  - `posts.incrementViews` (public)
  - `categories.list` (public)
  - `users.list` (admin, read-only — parity with v1)
- **REST** (Nest controllers; multipart doesn't fit tRPC):
  - `POST /api/uploads/thumbnail` (admin) — image ≤5 MB (jpg/png/gif/webp) → `/data/uploads/originals/`
  - `POST /api/uploads/from-youtube` (admin) — fetch `img.youtube.com/vi/<id>/hqdefault.jpg`
  - `GET /images/:width/:filename` — **identical contract to v1**: widths {300, 600, 1200, 1920}, sharp resize (no enlarge) → WebP q80, disk cache `/data/cache/{width}/`. Keeping this URL scheme means thumbnails referenced by migrated markdown and any external links keep working.
  - `GET /api/health` — for container healthcheck.
- Markdown → HTML: rendered in the web app (not api) with `marked` (same renderer family as v1) + sanitization.

## 7. Web app (Next.js)

Public routes — **identical URLs to v1** (SEO):
- `/` — hub: hero, profile, three pillar cards, featured posts
- `/category/[slug]` — category feed (accepts `dev` → redirects to `devlog`, as v1 normalized)
- `/posts/[slug]` — post detail (`generateMetadata`: title, meta description, OG image from thumbnail)
- `/login` — Google sign-in card
- `sitemap.ts`, `robots.ts`, custom 404

i18n — **next-intl**: `sk` default without prefix, `/en/...` for English. Legacy `?language=en` query param → middleware redirect to `/en/...` equivalent. UI strings in message catalogs (ported from v1 `view-helpers.js` translations); post content from `post_translations`.

Data fetching: RSC calls the api over the internal network (tRPC client, server-side). Public pages use ISR with cache tags (`posts`, `post:<slug>`, `categories`); admin mutations call a server action that runs `revalidateTag` after successful tRPC mutation → instant publish without redeploys.

Browser → api: Next `rewrites()` proxy `/trpc/*`, `/api/*`, `/images/*` → `http://carnaby-api:3001` (env `API_INTERNAL_URL`). Single public origin ⇒ first-party cookies, no CORS.

Admin (same Next app, route group `(admin)`, client components + tRPC react-query, gated server-side by better-auth session with `role=admin`):
- `/admin` — dashboard (welcome, quick links, session info)
- `/admin/posts` — table: thumbnail, title, ⭐ featured, categories, status badge, views, date; filters (status/category/featured), sorting, pagination; delete with confirm dialog
- `/admin/posts/new` + `/admin/posts/[id]/edit` — editor: markdown textarea + live preview, **SK/EN tabs** (title, excerpt, content, meta description), shared fields (slug + auto-generate, categories checkboxes, featured, youtubeId, soundcloudUrl), thumbnail upload / from-YouTube, save draft / publish
- `/admin/users` — read-only users table
Feature set = v1 parity, no more (YAGNI).

Analytics: Umami script tag as in v1 (`analytics.carnaby.sk`, website-id `0733e169-1bc1-4990-a65f-2442fbb00237`) on public pages.

## 8. Design system — "black glass"

Dark-only. Aesthetic: modern, energetic, glassy.

- **Base:** `#030303` background, layered radial/conic gradient glows (category colors, very low opacity), subtle noise texture overlay, `#0a0a0a` secondary surfaces.
- **Glass:** panels `rgba(15,15,15,0.55)` + `backdrop-blur(20px)` + 1px `rgba(255,255,255,0.08)` border + inner highlight; stronger "black glass" variant for nav/admin chrome.
- **Category accents (kept from v1):** DevLog `#10b981`, Dodo `#f59e0b`, Carnaby `#a855f7`; hover glow `rgba(color, 0.2)`; gradient text/border treatments per category card.
- **Typography:** Space Grotesk (display/headings), Inter (body), JetBrains Mono (code). Self-hosted via `next/font` (no CDN).
- **Motion:** `motion` (framer-motion successor) — hero gradient drift, scroll-reveal for cards, hover lift + glow, page transition fade; all behind `prefers-reduced-motion`.
- **Icons:** `lucide-react` (v1 used lucide via Iconify — same icon language: terminal / guitar / music-2).
- Tailwind v4 CSS-first config (`@theme` tokens for colors/blur/radii); shadcn/ui components restyled to the glass theme for admin.

## 9. Data migration (`tools/migrate-legacy`)

One-off TypeScript script, runs against a fresh v1 dump (via existing `backup-db.sh` output or direct `pg_dump` over SSH) restored locally, then re-run against NAS for the real cutover. Steps:

1. `users` → better-auth `user` (name, email, image=avatar_url, role, created_at) **+ `account` row** (`providerId='google'`, `accountId=google_id`) — so existing people (incl. the admin) sign in with Google and land in the same account. Keep an id map for author FKs.
2. `categories` → `categories` (same slugs: `devlog`, `dodo`, `carnaby`).
3. `posts` → `posts` (slug, status, is_featured, thumbnail_path, youtube_id, soundcloud_url, view_count, published_at, author via id map).
4. `post_translations` → copied as-is; for any post whose `language` has no translation row, synthesize one from the legacy `posts` columns (v1 kept a dual model — v2 is translations-only).
5. `post_categories` → copied.
6. Thumbnails: rsync NAS `/volume1/docker/carnaby-sk/thumbnails/` → `/volume1/docker/carnaby-sk-v2/uploads/` (originals preserved; WebP cache regenerates on demand).
7. Verification report: row counts per table, posts without translations, missing thumbnail files, sample slug spot-checks.

## 10. Docker, CI/CD, deployment

**Images** (both node:22-alpine, multi-stage, non-root, HEALTHCHECK):
- `docker/web.Dockerfile` — Next standalone output.
- `docker/api.Dockerfile` — Nest build + prod deps (incl. sharp for linux/musl).

**CI (`.github/workflows/ci.yml`)** — on push to `v2` and `main` + manual dispatch:
1. pnpm install → lint → typecheck → unit tests → build.
2. Build & push both images to GHCR. Tags: `dev` (from `v2`), `latest` + `sha` (from `main`). GHA cache. Watchtower on the NAS only tracks `:latest`-style tags used in the compose, so `v2` builds never auto-deploy.

**NAS staging/prod** (`/volume1/docker/carnaby-sk-v2/`, `docker-compose.nas.yml`):
- `carnaby-web` — image `ghcr.io/carnaby/carnaby-web:${TAG}`, host port **3100→3000**, `user: "1026:100"`, watchtower label, env `API_INTERNAL_URL=http://carnaby-api:3001`, `APP_URL=https://carnaby.sk`.
- `carnaby-api` — image `ghcr.io/carnaby/carnaby-api:${TAG}`, internal only, volumes `./uploads:/data/uploads`, `./cache:/data/cache`, env DB + Google + `BETTER_AUTH_SECRET` + `ADMIN_EMAILS=dodusik@gmail.com`, watchtower label.
- `carnaby-db-v2` — `postgres:17-alpine`, volume `./db`, healthcheck; db/user `carnaby`, database `carnaby`.
- Existing `carnaby-umami`, `carnaby-db` (postgres 15) and `carnaby-watchtower` keep running from the old compose, untouched.
- `.env` on NAS (never in git): DB password (new random), Google creds (same client), better-auth secret (new random), TAG.
- `backup-db.sh` v2 added to the new folder: nightly `pg_dump` of the new DB alongside the existing umami/carnaby dumps.

**Cutover checklist** (executed with the owner):
1. Owner adds redirect URI `https://carnaby.sk/api/auth/callback/google` in Google Cloud Console (v1's `/auth/google/callback` stays until decommission). **← only manual owner prerequisite**
2. Deploy stack with `TAG=dev` → smoke test on LAN `http://192.168.1.41:3100` (public pages; OAuth is tested locally via `localhost` during dev since Google disallows bare-IP redirects).
3. Run legacy migration against NAS (fresh dump → new DB), rsync thumbnails, verify report.
4. Fast-forward `main` to `v2`; CI publishes `:latest`; compose switched to `:latest`.
5. Owner switches DSM reverse proxy carnaby.sk 3000 → 3100. Verify OAuth login + admin + Umami events.
6. Rollback path: proxy back to 3000 (old stack fully alive). Decommission old `carnaby-sk` container + old `carnaby` DB only after ≥1 week of stable v2.

## 11. Testing & quality gates

- **Unit (Vitest):** api services (posts service incl. translation fallback + language default, auth role bootstrap logic, image cache path logic), shared utils, migration mapping functions.
- **E2E (Playwright, against local compose):** homepage renders featured posts, category page per category, post detail SK + EN, `?language=` redirect, `/admin` redirects anonymous → login, admin can create→publish→see post (authenticated via seeded session).
- TS strict everywhere; ESLint + Prettier (Nx presets). All gates run in CI before images are built.

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Watchtower deploys mid-rewrite code | old workflow fires only on `main`; `main` frozen; new images use new names |
| Migrated users can't log in via Google | migrate `account` rows with original `google_id`; keyed by email as fallback; tested on local dump before cutover |
| Broken image links in old markdown | keep `/images/:width/:filename` contract + copy originals verbatim |
| SEO regression | identical public URLs, per-post meta/OG, sitemap, 301 for `?language=` |
| Google callback mismatch | new URI added *alongside* old one before cutover |
| DB divergence between migration test and cutover | migration is idempotent (truncate+reload) and re-run on a fresh dump at cutover |

## 13. Out of scope (explicitly)

Light theme, RSS, comments, search, media library beyond thumbnails, user role management UI (v1 didn't have it), Umami upgrade/move, multi-admin workflows, CMS beyond the markdown editor.

## 14. Implementation phases (each executed by subagents on `v2`)

1. **Scaffold** — Nx workspace, pnpm, TS base, ESLint/Prettier, empty apps + packages, CI skeleton.
2. **DB package** — Drizzle schema, migrations, better-auth schema, seed script (categories).
3. **API app** — Nest + better-auth + tRPC routers + uploads + image pipeline + health; unit tests.
4. **Web public** — design system + layout + all public pages + i18n + ISR; Umami.
5. **Web admin** — shadcn/ui, posts table, editor (SK/EN tabs, preview, thumbnails), users; revalidation.
6. **Migration tool** — script + verification report; test on fresh NAS dump locally.
7. **Docker & CI** — Dockerfiles, compose files, full CI with image publish (`:dev`).
8. **Staging on NAS** — deploy v2 stack on 3100, run migration, E2E against staging, cutover checklist handed to owner.
