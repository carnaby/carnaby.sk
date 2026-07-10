# carnaby.sk v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite carnaby.sk as an Nx/pnpm monorepo — Next.js public site + admin (black-glass design) and NestJS API (tRPC, better-auth Google OAuth, Drizzle/Postgres 17, sharp image pipeline) — deployed as two GHCR images to the Synology NAS with zero-downtime cutover, migrating all v1 content.

**Architecture:** `apps/web` (Next.js App Router, RSC, Tailwind v4) talks to `apps/api` (NestJS + tRPC + better-auth) through a single public origin (Next rewrites → internal api container). `packages/db` owns the Drizzle schema/migrations; `packages/shared` owns category/locale constants and zod contracts. Old site keeps running from branch `main` / image `ghcr.io/carnaby/carnaby.sk:latest`; all work happens on branch `v2` and ships as NEW image names, so Watchtower can never break prod mid-rewrite.

**Tech Stack:** Node 22, pnpm 10, Nx (latest), Next.js 16 + React 19, NestJS 11 (Express 5), tRPC v11, better-auth ^1.3, Drizzle ORM + drizzle-kit, PostgreSQL 17, Tailwind CSS v4, shadcn/ui, next-intl v4, motion, lucide-react, marked + isomorphic-dompurify, sharp, multer v2, Vitest, Playwright, supertest.

**Spec:** `docs/superpowers/specs/2026-07-06-carnaby-v2-rewrite-design.md` (approved). The old codebase is readable at any time via `git show carnaby-sk-origin:<path>` — several tasks port data/strings from it.

## Global Constraints

- Branch: ALL work on `v2`. **Never push to `main`** until Task 31 cutover (old CI deploys from `main`).
- New image names only: `ghcr.io/carnaby/carnaby-web`, `ghcr.io/carnaby/carnaby-api`. The name `carnaby.sk` must never be built again.
- Public URL contracts preserved from v1: `/`, `/category/:slug`, `/posts/:slug`, `/login`, `/images/:width/:filename` with widths **{300, 600, 1200, 1920}**, WebP q80.
- Languages: `sk` (default, unprefixed) and `en` (`/en/...`). Default language everywhere is `sk`. Read fallback: requested → other language.
- Category accents (exact): DevLog `#10b981`, Dodo `#f59e0b`, Carnaby `#a855f7`. Dark-only theme, base `#030303`.
- Admin bootstrap via env `ADMIN_EMAILS` (comma-separated), NOT hardcoded email.
- Env names (fixed): `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`, `APP_URL`, `API_INTERNAL_URL`, `UPLOADS_DIR`, `CACHE_DIR`, `PORT`.
- Package names: `@carnaby/web`, `@carnaby/api`, `@carnaby/db`, `@carnaby/shared`. Type-only alias `@carnaby/api` → `apps/api/src/trpc/index.ts` (exports `type AppRouter` only).
- TS strict everywhere. LF line endings (`.gitattributes`). Conventional commits. Every commit ends with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- NAS facts: host `192.168.1.41`, SSH port `2222`, user `carnaby` (cert auth, no password needed). Old stack dir `/volume1/docker/carnaby-sk/`, new stack dir `/volume1/docker/carnaby-sk-v2/`. Old web on host port 3000; new web on host port **3100**. Containers run as `user: "1026:100"`.
- Umami stays untouched: script `https://analytics.carnaby.sk/script.js`, website-id `0733e169-1bc1-4990-a65f-2442fbb00237`, only on public pages.
- If an exact dependency version in this plan no longer resolves, use the latest stable of the same major and note it in the commit body.

## File Structure (target)

```
apps/web/                     Next.js: public site + /admin + /login
apps/api/                     NestJS: better-auth, tRPC, uploads, /images, /api/health
apps/web-e2e/                 Playwright
packages/shared/              categories, locales, zod contracts
packages/db/                  drizzle schema, migrations, seed, client factory
tools/migrate-legacy/         one-off v1→v2 data migration + verification report
docker/web.Dockerfile         Next standalone image
docker/api.Dockerfile         Nest image (sharp, migrations folder)
docker/docker-compose.dev.yml postgres:17 for local dev
docker/docker-compose.nas.yml NAS stack (web+api+db-v2)
.github/workflows/ci.yml      lint+typecheck+test → build+push images
docs/deploy/                  NAS runbook, cutover checklist, backup script
```

---

## Phase 1 — Workspace scaffold

### Task 1: Monorepo root files

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `nx.json`, `tsconfig.base.json`, `.gitignore`, `.gitattributes`, `.editorconfig`, `.npmrc`, `.env.example`, `README.md`

**Interfaces:**
- Produces: pnpm workspace covering `apps/*`, `packages/*`, `tools/*`; `nx` CLI runnable via `pnpm nx`.

- [ ] **Step 1: Write root files**

`package.json`:
```json
{
  "name": "carnaby-sk",
  "version": "2.0.0",
  "private": true,
  "license": "MIT",
  "engines": { "node": ">=22" },
  "packageManager": "pnpm@10.12.1",
  "scripts": {
    "dev": "nx run-many -t dev -p @carnaby/web @carnaby/api",
    "build": "nx run-many -t build",
    "test": "nx run-many -t test",
    "lint": "nx run-many -t lint",
    "typecheck": "nx run-many -t typecheck"
  },
  "devDependencies": {}
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'tools/*'
```

`nx.json`:
```json
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "defaultBase": "v2",
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": ["default", "!{projectRoot}/**/*.spec.ts", "!{projectRoot}/**/*.test.ts"],
    "sharedGlobals": ["{workspaceRoot}/tsconfig.base.json"]
  },
  "targetDefaults": {
    "build": { "dependsOn": ["^build"], "cache": true },
    "test": { "cache": true },
    "lint": { "cache": true },
    "typecheck": { "cache": true }
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@carnaby/shared": ["packages/shared/src/index.ts"],
      "@carnaby/db": ["packages/db/src/index.ts"],
      "@carnaby/api": ["apps/api/src/trpc/index.ts"]
    }
  }
}
```

`.gitignore`:
```
node_modules
dist
.next
.nx
coverage
*.tsbuildinfo
.env
.env.*
!.env.example
!docker/.env.nas.example
test-results
playwright-report
tools/migrate-legacy/data
```

`.gitattributes`:
```
* text=auto eol=lf
*.png binary
*.jpg binary
*.webp binary
*.ico binary
```

`.editorconfig`:
```
root = true
[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
```

`.npmrc`:
```
engine-strict=true
```

`.env.example`:
```
# --- api ---
PORT=3001
DATABASE_URL=postgres://carnaby:carnaby@localhost:5432/carnaby
BETTER_AUTH_SECRET=generate-with-openssl-rand-hex-32
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
ADMIN_EMAILS=dodusik@gmail.com
APP_URL=http://localhost:3000
UPLOADS_DIR=./.data/uploads
CACHE_DIR=./.data/cache
# --- web ---
API_INTERNAL_URL=http://localhost:3001
NEXT_PUBLIC_UMAMI_WEBSITE_ID=0733e169-1bc1-4990-a65f-2442fbb00237
NEXT_PUBLIC_UMAMI_SRC=https://analytics.carnaby.sk/script.js
# --- migrate-legacy ---
LEGACY_DATABASE_URL=postgres://carnaby:carnaby@localhost:5432/carnaby_legacy
```

`README.md`: short project intro (v2 stack, monorepo layout, `pnpm i && docker compose -f docker/docker-compose.dev.yml up -d && pnpm dev`), link to spec + plan, note that v1 lives on `carnaby-sk-origin`.

- [ ] **Step 2: Install Nx tooling**

Run: `pnpm add -Dw nx @nx/js @nx/next @nx/nest @nx/eslint @nx/playwright @nx/vite typescript prettier`
Expected: lockfile created, no errors.

- [ ] **Step 3: Verify**

Run: `pnpm nx --version` → prints Nx version. Run: `pnpm nx graph --file=.nx/graph.json` → succeeds (empty graph OK).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: scaffold pnpm+nx workspace root"
```

### Task 2: Generate apps and packages

**Files:**
- Create: `apps/web` (Next), `apps/api` (Nest), `apps/web-e2e` (Playwright), `packages/shared`, `packages/db` (both `@nx/js` libs), `tools/migrate-legacy` (`@nx/js` lib named `migrate-legacy`)

**Interfaces:**
- Produces: `pnpm nx build @carnaby/web|@carnaby/api` green; `pnpm nx dev @carnaby/web` on :3000, `@carnaby/api` on :3001; each project has `lint`, `test`, `typecheck` targets.

- [ ] **Step 1: Generate projects**

```bash
pnpm nx g @nx/next:application apps/web --name=@carnaby/web --style=css --appRouter=true --src=false --e2eTestRunner=playwright --unitTestRunner=vitest
pnpm nx g @nx/nest:application apps/api --name=@carnaby/api --strict
pnpm nx g @nx/js:library packages/shared --name=@carnaby/shared --bundler=none --unitTestRunner=vitest --linter=eslint
pnpm nx g @nx/js:library packages/db --name=@carnaby/db --bundler=none --unitTestRunner=vitest --linter=eslint
pnpm nx g @nx/js:library tools/migrate-legacy --name=migrate-legacy --bundler=none --unitTestRunner=vitest --linter=eslint
```
If a generator flag is rejected (Nx minor drift), run `pnpm nx g @nx/next:application --help` and use the equivalent flag; keep names/paths exactly as above.

- [ ] **Step 2: Convert api tests to Vitest**

@nx/nest generates Jest. Remove jest config from `apps/api`, add `apps/api/vitest.config.ts` (decorators need SWC):

```ts
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { globals: true, environment: 'node', include: ['src/**/*.spec.ts'] },
  plugins: [
    swc.vite({
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
});
```

Run: `pnpm add -Dw unplugin-swc @swc/core vitest`
Update `apps/api/project.json` test target to `@nx/vite:test` (or `nx:run-commands` → `vitest run`), delete `jest.config.ts` and jest deps from the project.

- [ ] **Step 3: Set api port + web port**

`apps/api/src/main.ts`: listen on `process.env.PORT ?? 3001`. Web stays on 3000 (Next default).

- [ ] **Step 4: Add typecheck targets**

In each project's `project.json` add:
```json
"typecheck": { "executor": "nx:run-commands", "options": { "command": "tsc -p tsconfig.json --noEmit", "cwd": "{projectRoot}" } }
```
(For web use `tsc -p tsconfig.json --noEmit` too; Next 16 generates a valid tsconfig.)

- [ ] **Step 5: Verify everything runs**

```bash
pnpm nx run-many -t build lint test typecheck
```
Expected: all green (default generated tests pass).
Then `pnpm nx dev @carnaby/api` → GET http://localhost:3001/api → `{"message":"Hello API"}` (generator default). Ctrl-C. `pnpm nx dev @carnaby/web` → http://localhost:3000 renders. Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: generate web (next), api (nest), shared/db/migrate-legacy libs"
```

### Task 3: CI quality workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: GitHub Actions on push to `v2` running install → lint → typecheck → test → build. (Image publishing is added later in Task 27.)

- [ ] **Step 1: Write workflow**

```yaml
name: CI
on:
  push:
    branches: [v2, main]
  workflow_dispatch:

jobs:
  quality:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: carnaby
          POSTGRES_PASSWORD: carnaby
          POSTGRES_DB: carnaby_test
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U carnaby" --health-interval 5s
          --health-timeout 5s --health-retries 10
    env:
      TEST_DATABASE_URL: postgres://carnaby:carnaby@localhost:5432/carnaby_test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm nx run-many -t lint typecheck test build
```

- [ ] **Step 2: Push and verify**

```bash
git add .github && git commit -m "ci: quality gates on v2" && git push
gh run watch --exit-status $(gh run list --branch v2 --limit 1 --json databaseId -q '.[0].databaseId')
```
Expected: run concludes success. **Verify the old deploy workflow did NOT run** (`gh run list --branch v2` shows only "CI").

---

## Phase 2 — Shared contracts & database

### Task 4: `@carnaby/shared` — categories, locales, zod contracts

**Files:**
- Create: `packages/shared/src/categories.ts`, `packages/shared/src/i18n.ts`, `packages/shared/src/contracts.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/contracts.spec.ts`

**Interfaces:**
- Produces (exact):
  - `type Language = 'sk' | 'en'`; `const LANGUAGES: Language[] = ['sk','en']`; `const DEFAULT_LANGUAGE: Language = 'sk'`
  - `type CategorySlug = 'devlog' | 'dodo' | 'carnaby'`
  - `const CATEGORIES: Record<CategorySlug, { slug: CategorySlug; color: string; icon: 'terminal'|'guitar'|'music-2'; name: Record<Language,string>; description: Record<Language,string> }>`
  - zod: `languageSchema`, `postStatusSchema` (`draft|published|archived`), `translationInput` (`{ title: string(min 1), excerpt?: string, content: string(min 1), metaDescription?: string }`), `postUpsertInput` (`{ slug: string(min 1, regex /^[a-z0-9-]+$/), status, isFeatured: boolean, youtubeId?: string, soundcloudUrl?: string, thumbnailPath?: string, categoryIds: number[], translations: { sk?: translationInput, en?: translationInput } }` with `.refine` at least one translation)
  - `function slugify(input: string): string` (lowercase, diacritics stripped, non-alnum → `-`, trimmed)

- [ ] **Step 1: Failing test**

```ts
// packages/shared/src/contracts.spec.ts
import { describe, expect, it } from 'vitest';
import { postUpsertInput, slugify } from './index';

describe('postUpsertInput', () => {
  it('rejects a post with no translations', () => {
    const r = postUpsertInput.safeParse({
      slug: 'ok', status: 'draft', isFeatured: false, categoryIds: [], translations: {},
    });
    expect(r.success).toBe(false);
  });
  it('accepts a post with one translation', () => {
    const r = postUpsertInput.safeParse({
      slug: 'my-post', status: 'published', isFeatured: true, categoryIds: [1],
      translations: { sk: { title: 'Ahoj', content: '# md' } },
    });
    expect(r.success).toBe(true);
  });
  it('rejects bad slug', () => {
    expect(postUpsertInput.safeParse({
      slug: 'Bad Slug!', status: 'draft', isFeatured: false, categoryIds: [], translations: { sk: { title: 't', content: 'c' } },
    }).success).toBe(false);
  });
});

describe('slugify', () => {
  it('strips diacritics and spaces', () => {
    expect(slugify('Môj Nový Článok!')).toBe('moj-novy-clanok');
  });
});
```

- [ ] **Step 2: Run to fail** — `pnpm nx test @carnaby/shared` → FAIL (exports missing).

- [ ] **Step 3: Implement**

`categories.ts` — port names/descriptions from v1 (`git show carnaby-sk-origin:config/view-helpers.js`, `categoryMeta` object) into:
```ts
import type { Language } from './i18n';
export type CategorySlug = 'devlog' | 'dodo' | 'carnaby';
export interface CategoryMeta {
  slug: CategorySlug;
  color: string;
  icon: 'terminal' | 'guitar' | 'music-2';
  name: Record<Language, string>;
  description: Record<Language, string>;
}
export const CATEGORIES: Record<CategorySlug, CategoryMeta> = {
  devlog:  { slug: 'devlog',  color: '#10b981', icon: 'terminal', name: { sk: 'DevLog',  en: 'DevLog' },  description: { sk: '…from v1…', en: '…from v1…' } },
  dodo:    { slug: 'dodo',    color: '#f59e0b', icon: 'guitar',   name: { sk: 'Dodo',    en: 'Dodo' },    description: { sk: '…from v1…', en: '…from v1…' } },
  carnaby: { slug: 'carnaby', color: '#a855f7', icon: 'music-2',  name: { sk: 'Carnaby', en: 'Carnaby' }, description: { sk: '…from v1…', en: '…from v1…' } },
};
```
(The `…from v1…` strings MUST be replaced with the real texts from `view-helpers.js` — that is part of this task, not a placeholder to leave.)

`i18n.ts`:
```ts
export type Language = 'sk' | 'en';
export const LANGUAGES: Language[] = ['sk', 'en'];
export const DEFAULT_LANGUAGE: Language = 'sk';
```

`contracts.ts`:
```ts
import { z } from 'zod';
export const languageSchema = z.enum(['sk', 'en']);
export const postStatusSchema = z.enum(['draft', 'published', 'archived']);
export const translationInput = z.object({
  title: z.string().min(1),
  excerpt: z.string().optional(),
  content: z.string().min(1),
  metaDescription: z.string().optional(),
});
export const postUpsertInput = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  status: postStatusSchema,
  isFeatured: z.boolean(),
  youtubeId: z.string().optional(),
  soundcloudUrl: z.string().url().optional(),
  thumbnailPath: z.string().optional(),
  categoryIds: z.array(z.number().int()),
  translations: z.object({ sk: translationInput.optional(), en: translationInput.optional() })
    .refine((t) => t.sk || t.en, { message: 'At least one translation required' }),
});
export type PostUpsertInput = z.infer<typeof postUpsertInput>;
export type TranslationInput = z.infer<typeof translationInput>;
export function slugify(input: string): string {
  return input.normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
```
`index.ts` re-exports all three modules. Run `pnpm add -w zod` (workspace root dep; libs resolve via root).

- [ ] **Step 4: Run to pass** — `pnpm nx test @carnaby/shared` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(shared): category meta, locales, zod post contracts"`

### Task 5: `@carnaby/db` — Drizzle schema, migrations, seed, dev compose

**Files:**
- Create: `packages/db/src/schema/auth.ts`, `packages/db/src/schema/content.ts`, `packages/db/src/schema/index.ts`, `packages/db/src/client.ts`, `packages/db/src/seed.ts`, `packages/db/drizzle.config.ts`, `docker/docker-compose.dev.yml`
- Modify: `packages/db/src/index.ts`
- Test: `packages/db/src/schema.integration.spec.ts`

**Interfaces:**
- Consumes: `CATEGORIES` from `@carnaby/shared`.
- Produces (exact):
  - `createDb(connectionString: string): { db: NodePgDatabase<typeof schema>, pool: Pool }` from `@carnaby/db`
  - `export * as schema` (tables: `user`, `session`, `account`, `verification`, `categories`, `posts`, `postTranslations`, `postCategories`; enums `languageEnum`, `postStatusEnum`)
  - SQL migrations in `packages/db/migrations/` (committed)
  - `pnpm nx run @carnaby/db:seed` upserts the 3 categories.

- [ ] **Step 1: Dev database compose**

`docker/docker-compose.dev.yml`:
```yaml
services:
  db:
    image: postgres:17-alpine
    container_name: carnaby-db-local
    environment:
      POSTGRES_USER: carnaby
      POSTGRES_PASSWORD: carnaby
      POSTGRES_DB: carnaby
    ports: ['5432:5432']
    volumes: [carnaby-db-local:/var/lib/postgresql/data]
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U carnaby']
      interval: 5s
      timeout: 5s
      retries: 10
volumes:
  carnaby-db-local:
```
Run: `docker compose -f docker/docker-compose.dev.yml up -d` and `docker exec carnaby-db-local psql -U carnaby -c "CREATE DATABASE carnaby_test"` (used by integration tests; also create `carnaby_legacy` the same way for Phase 6).

- [ ] **Step 2: Install deps**

`pnpm add -w drizzle-orm pg && pnpm add -Dw drizzle-kit @types/pg tsx`

- [ ] **Step 3: Auth schema (better-auth v1 core shape, snake_case, singular table names)**

`packages/db/src/schema/auth.ts`:
```ts
import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  role: text('role').notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```
After Task 6 wires better-auth, cross-check this shape with `npx @better-auth/cli generate` output and reconcile any drift (better-auth version may add columns) — reconciliation belongs to Task 6.

- [ ] **Step 4: Content schema**

`packages/db/src/schema/content.ts`:
```ts
import { boolean, integer, pgEnum, pgTable, primaryKey, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const languageEnum = pgEnum('language', ['sk', 'en']);
export const postStatusEnum = pgEnum('post_status', ['draft', 'published', 'archived']);

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  status: postStatusEnum('status').notNull().default('draft'),
  isFeatured: boolean('is_featured').notNull().default(false),
  thumbnailPath: text('thumbnail_path'),
  youtubeId: text('youtube_id'),
  soundcloudUrl: text('soundcloud_url'),
  authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
  viewCount: integer('view_count').notNull().default(0),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const postTranslations = pgTable('post_translations', {
  id: serial('id').primaryKey(),
  postId: integer('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  language: languageEnum('language').notNull(),
  title: text('title').notNull(),
  excerpt: text('excerpt'),
  content: text('content').notNull(),
  metaDescription: text('meta_description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique('post_translations_post_language').on(t.postId, t.language)]);

export const postCategories = pgTable('post_categories', {
  postId: integer('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.postId, t.categoryId] })]);
```
`schema/index.ts`: `export * from './auth'; export * from './content';`

- [ ] **Step 5: Client, config, seed**

`client.ts`:
```ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export function createDb(connectionString: string) {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  return { db, pool };
}
export type Db = ReturnType<typeof createDb>['db'];
```

`drizzle.config.ts`:
```ts
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://carnaby:carnaby@localhost:5432/carnaby' },
});
```

`seed.ts`:
```ts
import { CATEGORIES, DEFAULT_LANGUAGE } from '@carnaby/shared';
import { createDb } from './client';
import { categories } from './schema';

export async function seed(databaseUrl: string) {
  const { db, pool } = createDb(databaseUrl);
  const values = Object.values(CATEGORIES).map((c, i) => ({
    slug: c.slug, name: c.name[DEFAULT_LANGUAGE], description: c.description[DEFAULT_LANGUAGE], sortOrder: i,
  }));
  for (const v of values) {
    await db.insert(categories).values(v)
      .onConflictDoUpdate({ target: categories.slug, set: { name: v.name, description: v.description, sortOrder: v.sortOrder } });
  }
  await pool.end();
}

if (process.argv[1]?.endsWith('seed.ts')) {
  seed(process.env.DATABASE_URL ?? 'postgres://carnaby:carnaby@localhost:5432/carnaby')
    .then(() => console.log('seeded'))
    .catch((e) => { console.error(e); process.exit(1); });
}
```
`index.ts`: `export * from './client'; export * as schema from './schema'; export * from './schema';`
Add project targets in `packages/db/project.json`:
```json
"generate": { "executor": "nx:run-commands", "options": { "command": "drizzle-kit generate", "cwd": "packages/db" } },
"migrate":  { "executor": "nx:run-commands", "options": { "command": "drizzle-kit migrate",  "cwd": "packages/db" } },
"seed":     { "executor": "nx:run-commands", "options": { "command": "tsx src/seed.ts", "cwd": "packages/db" } }
```

- [ ] **Step 6: Generate + apply initial migration, seed**

```bash
pnpm nx run @carnaby/db:generate   # creates packages/db/migrations/0000_*.sql
pnpm nx run @carnaby/db:migrate
pnpm nx run @carnaby/db:seed
docker exec carnaby-db-local psql -U carnaby -c "select slug from categories order by sort_order"
```
Expected: rows `devlog, dodo, carnaby`.

- [ ] **Step 7: Integration test (fails first without migration on test db)**

`packages/db/src/schema.integration.spec.ts`:
```ts
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createDb } from './client';
import { categories, posts, postTranslations } from './schema';

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d('schema', () => {
  const { db, pool } = createDb(url!);
  beforeAll(async () => { await migrate(db, { migrationsFolder: __dirname + '/../migrations' }); });
  afterAll(async () => { await pool.end(); });

  it('enforces unique (postId, language)', async () => {
    const [cat] = await db.insert(categories).values({ slug: 't-' + Date.now(), name: 'T' }).returning();
    const [post] = await db.insert(posts).values({ slug: 'p-' + Date.now() }).returning();
    await db.insert(postTranslations).values({ postId: post!.id, language: 'sk', title: 'a', content: 'b' });
    await expect(
      db.insert(postTranslations).values({ postId: post!.id, language: 'sk', title: 'c', content: 'd' }),
    ).rejects.toThrow();
    expect(cat!.id).toBeGreaterThan(0);
  });
});
```
Run: `TEST_DATABASE_URL=postgres://carnaby:carnaby@localhost:5432/carnaby_test pnpm nx test @carnaby/db` → PASS. (On Windows PowerShell: `$env:TEST_DATABASE_URL='...'; pnpm nx test @carnaby/db`.)

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(db): drizzle schema, initial migration, seed, dev postgres compose"
```

---

## Phase 3 — API (NestJS)

### Task 6: better-auth wiring

**Files:**
- Create: `apps/api/src/auth/auth.ts`, `apps/api/src/auth/admin-emails.ts`, `apps/api/src/db/db.module.ts`
- Modify: `apps/api/src/main.ts`, `apps/api/src/app/app.module.ts`
- Test: `apps/api/src/auth/admin-emails.spec.ts`

**Interfaces:**
- Consumes: `createDb`, `schema` from `@carnaby/db`.
- Produces (exact):
  - `DB` injection token (`Symbol('DB')`) providing `Db` instance; `DbModule` is `@Global()`.
  - `createAuth(db: Db): ReturnType<typeof betterAuth>` — better-auth mounted at `/api/auth/*` on the express instance.
  - `resolveRole(email: string, adminEmails: string[]): 'admin' | 'user'` (case-insensitive trim match).
  - Owner TODO surfaced in output: add Google redirect URIs `http://localhost:3000/api/auth/callback/google` (dev) and `https://carnaby.sk/api/auth/callback/google` (prod) in Google Cloud Console.

- [ ] **Step 1: Failing test**

```ts
// apps/api/src/auth/admin-emails.spec.ts
import { describe, expect, it } from 'vitest';
import { parseAdminEmails, resolveRole } from './admin-emails';

describe('admin emails', () => {
  it('parses comma-separated env value', () => {
    expect(parseAdminEmails(' a@b.sk, C@D.sk ,')).toEqual(['a@b.sk', 'c@d.sk']);
  });
  it('resolves admin case-insensitively', () => {
    expect(resolveRole('DODUSIK@gmail.com', ['dodusik@gmail.com'])).toBe('admin');
    expect(resolveRole('other@gmail.com', ['dodusik@gmail.com'])).toBe('user');
  });
});
```
Run: `pnpm nx test @carnaby/api` → FAIL.

- [ ] **Step 2: Implement**

`pnpm add -w better-auth`

`admin-emails.ts`:
```ts
export function parseAdminEmails(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}
export function resolveRole(email: string, adminEmails: string[]): 'admin' | 'user' {
  return adminEmails.includes(email.trim().toLowerCase()) ? 'admin' : 'user';
}
```

`auth.ts`:
```ts
import type { Db } from '@carnaby/db';
import { schema } from '@carnaby/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { parseAdminEmails, resolveRole } from './admin-emails';

export function createAuth(db: Db) {
  const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS);
  return betterAuth({
    baseURL: process.env.APP_URL ?? 'http://localhost:3000',
    basePath: '/api/auth',
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [process.env.APP_URL ?? 'http://localhost:3000'],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
    }),
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      },
    },
    user: {
      additionalFields: {
        role: { type: 'string', defaultValue: 'user', input: false },
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 7 },
    databaseHooks: {
      user: {
        create: {
          before: async (u) => ({ data: { ...u, role: resolveRole(u.email, adminEmails) } }),
        },
      },
    },
  });
}
export type Auth = ReturnType<typeof createAuth>;
```

`db.module.ts`:
```ts
import { createDb } from '@carnaby/db';
import { Global, Module } from '@nestjs/common';

export const DB = Symbol('DB');
export const DB_POOL = Symbol('DB_POOL');

const conn = createDb(process.env.DATABASE_URL ?? 'postgres://carnaby:carnaby@localhost:5432/carnaby');

@Global()
@Module({
  providers: [
    { provide: DB, useValue: conn.db },
    { provide: DB_POOL, useValue: conn.pool },
  ],
  exports: [DB, DB_POOL],
})
export class DbModule {}
```

`apps/api/src/auth/auth.module.ts` with `AUTH` token:
```ts
import { Module } from '@nestjs/common';
import { DB } from '../db/db.module';
import { createAuth } from './auth';

export const AUTH = Symbol('AUTH');

@Module({
  providers: [{ provide: AUTH, useFactory: (db) => createAuth(db), inject: [DB] }],
  exports: [AUTH],
})
export class AuthModule {}
```

`main.ts` (order matters — auth handler BEFORE json parser; run drizzle migrations first, mirroring v1's boot behavior):
```ts
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from '@carnaby/db';
import { NestFactory } from '@nestjs/core';
import { toNodeHandler } from 'better-auth/node';
import * as express from 'express';
import { join } from 'node:path';
import { AppModule } from './app/app.module';
import type { Auth } from './auth/auth';
import { AUTH } from './auth/auth.module';

async function bootstrap() {
  const migrationsFolder = process.env.MIGRATIONS_DIR ?? join(__dirname, '..', '..', '..', 'packages', 'db', 'migrations');
  const { db, pool } = createDb(process.env.DATABASE_URL!);
  await migrate(db, { migrationsFolder });
  await pool.end();

  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const server = app.getHttpAdapter().getInstance();
  const auth = app.get<Auth>(AUTH);
  server.all('/api/auth/*splat', toNodeHandler(auth));
  server.use(express.json({ limit: '1mb' }));
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
```
`app.module.ts` imports `DbModule`, `AuthModule`. If Express 5 rejects the `'/api/auth/*splat'` pattern, use `'/api/auth/{*splat}'`.

- [ ] **Step 3: Run tests** — `pnpm nx test @carnaby/api` → PASS.

- [ ] **Step 4: Manual smoke**

With dev db up and `.env` copied from `.env.example` (fill BETTER_AUTH_SECRET with `openssl rand -hex 32`; Google creds may stay dummy for this step): `pnpm nx dev @carnaby/api`, then:
`curl -s http://localhost:3001/api/auth/ok` → `{"ok":true}` (better-auth health route).

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(api): better-auth google oauth with drizzle adapter and ADMIN_EMAILS role bootstrap"`

### Task 7: tRPC foundation + health

**Files:**
- Create: `apps/api/src/trpc/trpc.ts`, `apps/api/src/trpc/context.ts`, `apps/api/src/trpc/app-router.ts`, `apps/api/src/trpc/index.ts`, `apps/api/src/trpc/trpc.module.ts`, `apps/api/src/health/health.controller.ts`
- Modify: `apps/api/src/main.ts`, `apps/api/src/app/app.module.ts`
- Test: `apps/api/src/trpc/context.spec.ts`

**Interfaces:**
- Consumes: `AUTH` token (Task 6), `DB` token (Task 6).
- Produces (exact):
  - `createContext({ req, db, auth })` → `Promise<{ db: Db; user: { id: string; email: string; name: string; image: string | null; role: string } | null }>`
  - `router`, `publicProcedure`, `adminProcedure` from `trpc.ts` (adminProcedure throws `TRPCError('UNAUTHORIZED')` when no user, `('FORBIDDEN')` when `role !== 'admin'`).
  - `appRouter` mounted at `/trpc` via `createExpressMiddleware`; `export type AppRouter` re-exported from `apps/api/src/trpc/index.ts` (type-only surface for `@carnaby/api` alias).
  - `GET /api/health` → `{ status: 'ok' }` (Nest controller).

- [ ] **Step 1: Failing test**

```ts
// apps/api/src/trpc/context.spec.ts
import { describe, expect, it, vi } from 'vitest';
import { buildUserFromSession } from './context';

describe('buildUserFromSession', () => {
  it('returns null without session', () => {
    expect(buildUserFromSession(null)).toBeNull();
  });
  it('maps better-auth session payload', () => {
    const u = buildUserFromSession({
      user: { id: 'u1', email: 'a@b.c', name: 'A', image: null, role: 'admin' },
      session: { id: 's1' },
    } as never);
    expect(u).toEqual({ id: 'u1', email: 'a@b.c', name: 'A', image: null, role: 'admin' });
  });
});
```
Run → FAIL.

- [ ] **Step 2: Implement**

`pnpm add -w @trpc/server`

`trpc.ts`:
```ts
import { TRPCError, initTRPC } from '@trpc/server';
import type { Context } from './context';

const t = initTRPC.context<Context>().create();
export const router = t.router;
export const publicProcedure = t.procedure;
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
```

`context.ts`:
```ts
import type { Db } from '@carnaby/db';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import type { Auth } from '../auth/auth';

export interface CtxUser { id: string; email: string; name: string; image: string | null; role: string }

export function buildUserFromSession(s: { user: { id: string; email: string; name: string; image?: string | null; role?: string } } | null): CtxUser | null {
  if (!s?.user) return null;
  const { id, email, name, image, role } = s.user;
  return { id, email, name, image: image ?? null, role: role ?? 'user' };
}

export async function createContext(opts: { req: Request; db: Db; auth: Auth }) {
  const session = await opts.auth.api.getSession({ headers: fromNodeHeaders(opts.req.headers) });
  return { db: opts.db, user: buildUserFromSession(session) };
}
export type Context = Awaited<ReturnType<typeof createContext>>;
```

`app-router.ts` (routers land in Tasks 8–9; start with health only):
```ts
import { publicProcedure, router } from './trpc';

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true })),
});
export type AppRouter = typeof appRouter;
```

`index.ts`: `export type { AppRouter } from './app-router';`

`trpc.module.ts` — applies express middleware:
```ts
import type { Db } from '@carnaby/db';
import { Inject, Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import type { Auth } from '../auth/auth';
import { AUTH, AuthModule } from '../auth/auth.module';
import { DB } from '../db/db.module';
import { appRouter } from './app-router';
import { createContext } from './context';

@Module({ imports: [AuthModule] })
export class TrpcModule implements NestModule {
  constructor(@Inject(DB) private db: Db, @Inject(AUTH) private auth: Auth) {}
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(createExpressMiddleware({
        router: appRouter,
        createContext: ({ req }) => createContext({ req, db: this.db, auth: this.auth }),
      }))
      .forRoutes('/trpc');
  }
}
```

`health.controller.ts`:
```ts
import { Controller, Get } from '@nestjs/common';
@Controller('api/health')
export class HealthController {
  @Get() health() { return { status: 'ok' }; }
}
```
Register `TrpcModule` + `HealthController` in `app.module.ts`; remove generator's default AppController/AppService.

- [ ] **Step 3: Tests pass** — `pnpm nx test @carnaby/api` → PASS.

- [ ] **Step 4: Smoke**

`pnpm nx dev @carnaby/api` then:
`curl -s "http://localhost:3001/trpc/health"` → `{"result":{"data":{"ok":true}}}`; `curl -s http://localhost:3001/api/health` → `{"status":"ok"}`.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(api): trpc foundation with better-auth context and health endpoints"`

### Task 8: Posts read routers (public)

**Files:**
- Create: `apps/api/src/posts/posts.read.ts`, `apps/api/src/posts/routers.ts`
- Modify: `apps/api/src/trpc/app-router.ts`
- Test: `apps/api/src/posts/posts.read.integration.spec.ts`

**Interfaces:**
- Consumes: `Db`, schema tables; `languageSchema` from `@carnaby/shared`.
- Produces (exact — later tasks and web rely on these):
  - `posts.list({ language?, category?, featured?, page?, limit? })` → `{ items: PostListItem[]; total: number; page: number; pageCount: number }`; only `status='published'`; ordered `publishedAt desc`; defaults `language='sk'`, `page=1`, `limit=10`, max limit 50.
  - `PostListItem = { id: number; slug: string; title: string; excerpt: string | null; thumbnailPath: string | null; youtubeId: string | null; isFeatured: boolean; viewCount: number; publishedAt: string | null; language: 'sk'|'en'; categories: { slug: string; name: string }[] }` (`language` = language of the translation actually used after fallback).
  - `posts.bySlug({ slug, language? })` → `PostListItem & { content: string; metaDescription: string | null; soundcloudUrl: string | null; availableLanguages: ('sk'|'en')[] }`; throws `NOT_FOUND` for missing slug or non-published post.
  - `posts.incrementViews({ id })` → `{ ok: true }` (public mutation).
  - Pure helper `pickTranslation<T extends { language: 'sk'|'en' }>(translations: T[], requested: 'sk'|'en'): T | undefined` — exact fallback rule: requested, else the other language, else undefined.

- [ ] **Step 1: Failing integration test**

`posts.read.integration.spec.ts` (uses TEST_DATABASE_URL; `describe.skip` when unset, same pattern as Task 5):
```ts
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createDb } from '@carnaby/db';
import { categories, postCategories, posts, postTranslations } from '@carnaby/db';
import { appRouter } from '../trpc/app-router';

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d('posts read', () => {
  const { db, pool } = createDb(url!);
  const caller = appRouter.createCaller({ db, user: null });

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: __dirname + '/../../../../packages/db/migrations' });
    await db.delete(posts);
    await db.delete(categories);
    const [cat] = await db.insert(categories).values({ slug: 'devlog', name: 'DevLog' }).returning();
    const [pub] = await db.insert(posts).values({ slug: 'hello', status: 'published', publishedAt: new Date(), isFeatured: true }).returning();
    const [draft] = await db.insert(posts).values({ slug: 'wip', status: 'draft' }).returning();
    await db.insert(postTranslations).values([
      { postId: pub!.id, language: 'en', title: 'Hello', content: 'EN body' },
      { postId: draft!.id, language: 'sk', title: 'WIP', content: 'x' },
    ]);
    await db.insert(postCategories).values({ postId: pub!.id, categoryId: cat!.id });
  });
  afterAll(async () => { await pool.end(); });

  it('lists only published, falls back sk→en', async () => {
    const r = await caller.posts.list({});
    expect(r.total).toBe(1);
    expect(r.items[0]!.slug).toBe('hello');
    expect(r.items[0]!.language).toBe('en'); // requested sk, only en exists
    expect(r.items[0]!.categories[0]!.slug).toBe('devlog');
  });

  it('bySlug returns content and availableLanguages, 404s drafts', async () => {
    const post = await caller.posts.bySlug({ slug: 'hello' });
    expect(post.content).toBe('EN body');
    expect(post.availableLanguages).toEqual(['en']);
    await expect(caller.posts.bySlug({ slug: 'wip' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
```
Run → FAIL (`posts` router missing).

- [ ] **Step 2: Implement**

`posts.read.ts` — query layer (drizzle `db.query` with relations is optional; explicit joins are fine). Core shape:
```ts
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '@carnaby/db';
import { categories, postCategories, posts, postTranslations } from '@carnaby/db';
import type { Language } from '@carnaby/shared';

export function pickTranslation<T extends { language: Language }>(list: T[], requested: Language): T | undefined {
  return list.find((t) => t.language === requested) ?? list.find((t) => t.language !== requested);
}

export interface ListArgs { language: Language; category?: string; featured?: boolean; page: number; limit: number; statuses: ('draft'|'published'|'archived')[] }

export async function listPosts(db: Db, args: ListArgs) {
  const where = and(
    inArray(posts.status, args.statuses),
    args.featured === undefined ? undefined : eq(posts.isFeatured, args.featured),
    args.category
      ? inArray(posts.id, db.select({ id: postCategories.postId }).from(postCategories)
          .innerJoin(categories, eq(categories.id, postCategories.categoryId))
          .where(eq(categories.slug, args.category)))
      : undefined,
  );
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(posts).where(where);
  const rows = await db.select().from(posts).where(where)
    .orderBy(desc(posts.publishedAt), desc(posts.createdAt))
    .limit(args.limit).offset((args.page - 1) * args.limit);
  const ids = rows.map((r) => r.id);
  const translations = ids.length ? await db.select().from(postTranslations).where(inArray(postTranslations.postId, ids)) : [];
  const cats = ids.length
    ? await db.select({ postId: postCategories.postId, slug: categories.slug, name: categories.name })
        .from(postCategories).innerJoin(categories, eq(categories.id, postCategories.categoryId))
        .where(inArray(postCategories.postId, ids))
    : [];
  const items = rows.flatMap((p) => {
    const tr = pickTranslation(translations.filter((t) => t.postId === p.id), args.language);
    if (!tr) return [];
    return [{
      id: p.id, slug: p.slug, title: tr.title, excerpt: tr.excerpt,
      thumbnailPath: p.thumbnailPath, youtubeId: p.youtubeId, isFeatured: p.isFeatured,
      viewCount: p.viewCount, publishedAt: p.publishedAt?.toISOString() ?? null,
      language: tr.language, categories: cats.filter((c) => c.postId === p.id).map(({ slug, name }) => ({ slug, name })),
    }];
  });
  return { items, total: count ?? 0, page: args.page, pageCount: Math.max(1, Math.ceil((count ?? 0) / args.limit)) };
}
```
plus `getPostBySlug(db, slug, language, { publishedOnly: boolean })` returning the detail shape (same join strategy, single post; include `content`, `metaDescription`, `soundcloudUrl`, `availableLanguages` = sorted list of translation languages; return `null` when missing/not published).

`routers.ts`:
```ts
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { languageSchema } from '@carnaby/shared';
import { eq, sql } from 'drizzle-orm';
import { posts } from '@carnaby/db';
import { publicProcedure, router } from '../trpc/trpc';
import { getPostBySlug, listPosts } from './posts.read';

export const postsRouter = router({
  list: publicProcedure.input(z.object({
    language: languageSchema.default('sk'),
    category: z.string().optional(),
    featured: z.boolean().optional(),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(50).default(10),
  }).default({})).query(({ ctx, input }) =>
    listPosts(ctx.db, { ...input, statuses: ['published'] })),

  bySlug: publicProcedure.input(z.object({ slug: z.string(), language: languageSchema.default('sk') }))
    .query(async ({ ctx, input }) => {
      const post = await getPostBySlug(ctx.db, input.slug, input.language, { publishedOnly: true });
      if (!post) throw new TRPCError({ code: 'NOT_FOUND' });
      return post;
    }),

  incrementViews: publicProcedure.input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(posts).set({ viewCount: sql`${posts.viewCount} + 1` }).where(eq(posts.id, input.id));
      return { ok: true };
    }),
});
```
Wire `posts: postsRouter` into `appRouter`.

- [ ] **Step 3: Tests pass** — `TEST_DATABASE_URL=... pnpm nx test @carnaby/api` → PASS.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(api): public posts list/bySlug with language fallback and view counter"`

### Task 9: Admin routers (posts CRUD, categories, users)

**Files:**
- Create: `apps/api/src/posts/posts.admin.ts`, `apps/api/src/categories/router.ts`, `apps/api/src/users/router.ts`
- Modify: `apps/api/src/posts/routers.ts`, `apps/api/src/trpc/app-router.ts`
- Test: `apps/api/src/posts/posts.admin.integration.spec.ts`

**Interfaces:**
- Consumes: `postUpsertInput` from `@carnaby/shared`; `adminProcedure` (Task 7); read helpers (Task 8).
- Produces (exact):
  - `posts.adminList({ status?, category?, featured?, page?, limit?, sortBy?, order? })` → `{ items: AdminListItem[]; total; page; pageCount }` — any status; `sortBy ∈ 'createdAt'|'publishedAt'|'title'|'status'|'viewCount'` default `createdAt`, `order ∈ 'asc'|'desc'` default `desc`; `AdminListItem = PostListItem & { status: 'draft'|'published'|'archived'; createdAt: string; hasSk: boolean; hasEn: boolean }` (title falls back sk→en for display).
  - `posts.byId({ id })` → `{ post: { id, slug, status, isFeatured, thumbnailPath, youtubeId, soundcloudUrl, publishedAt, viewCount }, translations: { sk: TranslationInput | null, en: TranslationInput | null }, categoryIds: number[] }` — throws NOT_FOUND.
  - `posts.create(postUpsertInput)` → `{ id: number }` — transaction: insert post (sets `publishedAt=now()` when status becomes `published` and it was null, `authorId = ctx.user.id`), upsert translations, replace categories. CONFLICT on duplicate slug.
  - `posts.update({ id } & postUpsertInput)` → `{ id }` — same transaction semantics; removes translations for languages absent from input.
  - `posts.remove({ id })` → `{ ok: true }` (also best-effort unlink of thumbnail file under `UPLOADS_DIR/originals/`).
  - `categories.list()` (public) → `{ id, slug, name, description }[]` ordered by sortOrder.
  - `users.list()` (admin) → `{ id, name, email, image, role, createdAt }[]`.

- [ ] **Step 1: Failing integration test**

```ts
// apps/api/src/posts/posts.admin.integration.spec.ts
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { randomBytes } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createDb, categories, postTranslations, user } from '@carnaby/db';
import { appRouter } from '../trpc/app-router';
import { eq } from 'drizzle-orm';

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d('posts admin', () => {
  const { db, pool } = createDb(url!);
  const adminUser = { id: randomBytes(16).toString('hex'), email: 'a@a.sk', name: 'A', image: null, role: 'admin' };
  const admin = appRouter.createCaller({ db, user: adminUser });
  const anon = appRouter.createCaller({ db, user: null });
  let catId = 0;

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: __dirname + '/../../../../packages/db/migrations' });
    await db.insert(user).values({ id: adminUser.id, email: adminUser.email, name: 'A' }).onConflictDoNothing();
    const [c] = await db.insert(categories).values({ slug: 'adm-' + Date.now(), name: 'Adm' }).returning();
    catId = c!.id;
  });
  afterAll(async () => { await pool.end(); });

  it('rejects non-admin', async () => {
    await expect(anon.posts.adminList({})).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('create → byId → update (drops EN) → adminList → remove', async () => {
    const { id } = await admin.posts.create({
      slug: 'adm-post-' + Date.now(), status: 'draft', isFeatured: false, categoryIds: [catId],
      translations: { sk: { title: 'SK', content: 'sk body' }, en: { title: 'EN', content: 'en body' } },
    });
    const loaded = await admin.posts.byId({ id });
    expect(loaded.translations.en?.title).toBe('EN');
    expect(loaded.categoryIds).toEqual([catId]);

    await admin.posts.update({ id, slug: loaded.post.slug, status: 'published', isFeatured: true,
      categoryIds: [catId], translations: { sk: { title: 'SK2', content: 'sk body' } } });
    const after = await db.select().from(postTranslations).where(eq(postTranslations.postId, id));
    expect(after.map((t) => t.language)).toEqual(['sk']);

    const list = await admin.posts.adminList({});
    const row = list.items.find((i) => i.id === id)!;
    expect(row.status).toBe('published');
    expect(row.hasSk).toBe(true);
    expect(row.hasEn).toBe(false);

    await admin.posts.remove({ id });
    await expect(admin.posts.byId({ id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
```

- [ ] **Step 2: Run to fail**, **Step 3: Implement** the routers per shapes above. `posts.create/update` transaction skeleton:

```ts
export async function upsertPost(db: Db, input: PostUpsertInput & { id?: number }, authorId: string) {
  return db.transaction(async (tx) => {
    const base = {
      slug: input.slug, status: input.status, isFeatured: input.isFeatured,
      thumbnailPath: input.thumbnailPath ?? null, youtubeId: input.youtubeId ?? null,
      soundcloudUrl: input.soundcloudUrl ?? null, updatedAt: new Date(),
    };
    let id = input.id;
    if (id == null) {
      const [row] = await tx.insert(posts).values({ ...base, authorId, publishedAt: input.status === 'published' ? new Date() : null }).returning({ id: posts.id });
      id = row!.id;
    } else {
      const [existing] = await tx.select({ publishedAt: posts.publishedAt }).from(posts).where(eq(posts.id, id));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      await tx.update(posts).set({ ...base, publishedAt: input.status === 'published' ? existing.publishedAt ?? new Date() : existing.publishedAt }).where(eq(posts.id, id));
    }
    const langs: Language[] = ['sk', 'en'];
    for (const lang of langs) {
      const tr = input.translations[lang];
      if (tr) {
        await tx.insert(postTranslations)
          .values({ postId: id, language: lang, title: tr.title, excerpt: tr.excerpt ?? null, content: tr.content, metaDescription: tr.metaDescription ?? null, updatedAt: new Date() })
          .onConflictDoUpdate({ target: [postTranslations.postId, postTranslations.language], set: { title: tr.title, excerpt: tr.excerpt ?? null, content: tr.content, metaDescription: tr.metaDescription ?? null, updatedAt: new Date() } });
      } else {
        await tx.delete(postTranslations).where(and(eq(postTranslations.postId, id), eq(postTranslations.language, lang)));
      }
    }
    await tx.delete(postCategories).where(eq(postCategories.postId, id));
    if (input.categoryIds.length) {
      await tx.insert(postCategories).values(input.categoryIds.map((categoryId) => ({ postId: id!, categoryId })));
    }
    return { id };
  });
}
```

- [ ] **Step 4: Tests pass** — `TEST_DATABASE_URL=... pnpm nx test @carnaby/api` → PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(api): admin posts crud, categories and users routers"`

### Task 10: Uploads REST (thumbnail + YouTube)

**Files:**
- Create: `apps/api/src/uploads/uploads.controller.ts`, `apps/api/src/uploads/uploads.service.ts`, `apps/api/src/uploads/admin.guard.ts`, `apps/api/src/uploads/uploads.module.ts`
- Test: `apps/api/src/uploads/uploads.service.spec.ts`

**Interfaces:**
- Consumes: `AUTH` token (session check in guard).
- Produces (exact):
  - `POST /api/uploads/thumbnail` — multipart field `thumbnail`, ≤5 MB, mimetypes `image/jpeg|png|gif|webp`; saves to `${UPLOADS_DIR}/originals/thumb-<epoch>-<6 hex>.<ext>`; response `{ filename: string }` (bare filename, no path — DB stores bare filenames; web builds `/images/{w}/{filename}`).
  - `POST /api/uploads/from-youtube` — JSON `{ youtubeId: string }` (regex `^[A-Za-z0-9_-]{6,20}$`); downloads `https://img.youtube.com/vi/<id>/hqdefault.jpg` → `${UPLOADS_DIR}/originals/yt-<id>.jpg`; response `{ filename }`.
  - Both 401/403 without an admin session (`AdminGuard` uses `auth.api.getSession(fromNodeHeaders(req.headers))` and checks `user.role === 'admin'`).
  - `UploadsService.deleteOriginal(filename)` used by `posts.remove`.

- [ ] **Step 1: Failing unit test** for `UploadsService`: `safeName()` rejects extensions not in allowlist and path separators; `youtubeThumbFilename('abc123') === 'yt-abc123.jpg'`; `deleteOriginal` ignores missing files. (Mock fs with `memfs` or temp dir via `fs.mkdtemp`.)
- [ ] **Step 2: Run to fail.**
- [ ] **Step 3: Implement** — `pnpm add -w multer` + `pnpm add -Dw @types/multer`; controller uses `@UseInterceptors(FileInterceptor('thumbnail', { storage: memoryStorage(), limits: { fileSize: 5*1024*1024 } }))`, service writes the buffer with `fs.promises.writeFile` after extension/mimetype allowlist; YouTube download via global `fetch`, reject non-200. Guard implements `CanActivate`.
- [ ] **Step 4: Tests pass**, then manual smoke with curl (expect 401 anonymous):
`curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3001/api/uploads/from-youtube -H 'content-type: application/json' -d '{"youtubeId":"abc123xyz"}'` → `401`.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(api): admin-guarded thumbnail upload and youtube thumbnail fetch"`

### Task 11: Image optimization endpoint (v1 contract)

**Files:**
- Create: `apps/api/src/images/images.controller.ts`, `apps/api/src/images/images.service.ts`, `apps/api/src/images/images.module.ts`
- Test: `apps/api/src/images/images.service.spec.ts`

**Interfaces:**
- Produces (exact, v1-compatible):
  - `GET /images/:width/:filename` — width must be one of `[300, 600, 1200, 1920]` else 400; filename must match `/^[A-Za-z0-9][A-Za-z0-9._-]*$/` else 400 (blocks traversal).
  - Source lookup order: `${UPLOADS_DIR}/originals/<filename>` then `${UPLOADS_DIR}/<filename>`; 404 when absent.
  - Output: WebP quality 80, `sharp().resize({ width, withoutEnlargement: true })`; cached at `${CACHE_DIR}/<width>/<basename>.webp`; cache hit streams file without sharp.
  - Headers: `Content-Type: image/webp`, `Cache-Control: public, max-age=2592000, immutable`.
  - `ImagesService.getOrCreate(width: number, filename: string): Promise<string /* absolute cached path */>` — throws `BadRequestException`/`NotFoundException`.

- [ ] **Step 1: Failing unit test** — with a temp dir fixture: writes a 2000px test PNG via sharp, asserts `getOrCreate(300, f)` produces a webp ≤300px wide; second call returns same path without re-encoding (spy on sharp); invalid width/filename throw; missing source throws NotFound.
- [ ] **Step 2: Run to fail.**
- [ ] **Step 3: Implement** (`pnpm add -w sharp`), controller streams with `res.sendFile`.
- [ ] **Step 4: Tests pass** — `pnpm nx test @carnaby/api`.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(api): sharp webp image endpoint with disk cache (v1 url contract)"`

---

## Phase 4 — Web public site

### Task 12: Design system, root layout, header/footer

**Files:**
- Create: `apps/web/app/globals.css` (replace generated), `apps/web/lib/fonts.ts`, `apps/web/components/site/header.tsx`, `apps/web/components/site/footer.tsx`, `apps/web/components/site/glass.tsx`
- Modify: `apps/web/app/layout.tsx`, `apps/web/next.config.js`

**Interfaces:**
- Produces: Tailwind v4 theme tokens + `glass`/`glass-strong` utilities; fonts exported as `fontVars` (CSS var classnames); `<SiteHeader/>`, `<SiteFooter/>`; `next.config` with `output: 'standalone'` and rewrites `/trpc/:path*`, `/api/:path*`, `/images/:path*` → `${API_INTERNAL_URL}`.

- [ ] **Step 1: Install and configure**

`pnpm add -w motion lucide-react clsx tailwind-merge` (Tailwind v4 itself comes with the Nx Next generator; if it generated Tailwind v3, upgrade: `pnpm add -w tailwindcss@^4 @tailwindcss/postcss@^4` and switch `postcss.config` to `{ plugins: { '@tailwindcss/postcss': {} } }`, delete `tailwind.config.js`).

`globals.css`:
```css
@import 'tailwindcss';

@theme {
  --color-base: #030303;
  --color-surface: #0a0a0a;
  --color-card: #111113;
  --color-line: rgb(255 255 255 / 0.08);
  --color-devlog: #10b981;
  --color-dodo: #f59e0b;
  --color-carnaby: #a855f7;
  --color-rose: #f43f5e;
  --font-display: var(--font-space-grotesk), sans-serif;
  --font-sans: var(--font-inter), sans-serif;
  --font-mono: var(--font-jetbrains-mono), monospace;
  --radius-glass: 1rem;
}

@utility glass {
  background: rgb(15 15 15 / 0.55);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--color-line);
}
@utility glass-strong {
  background: rgb(8 8 8 / 0.7);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  border: 1px solid rgb(255 255 255 / 0.1);
}

body {
  background-color: var(--color-base);
  color: #f5f5f5;
  font-family: var(--font-sans);
}

/* layered ambient glow + noise */
.site-bg::before {
  content: '';
  position: fixed; inset: 0; z-index: -2; pointer-events: none;
  background:
    radial-gradient(600px 400px at 15% -10%, rgb(16 185 129 / 0.09), transparent 70%),
    radial-gradient(700px 500px at 85% 0%, rgb(168 85 247 / 0.09), transparent 70%),
    radial-gradient(700px 600px at 50% 110%, rgb(245 158 11 / 0.07), transparent 70%);
}
.site-bg::after {
  content: '';
  position: fixed; inset: 0; z-index: -1; pointer-events: none; opacity: 0.35;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.03 0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E");
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

`lib/fonts.ts`:
```ts
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter' });
const grotesk = Space_Grotesk({ subsets: ['latin', 'latin-ext'], variable: '--font-space-grotesk' });
const mono = JetBrains_Mono({ subsets: ['latin', 'latin-ext'], variable: '--font-jetbrains-mono' });
export const fontVars = `${inter.variable} ${grotesk.variable} ${mono.variable}`;
```

`next.config.js` additions:
```js
const API = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';
module.exports = {
  output: 'standalone',
  async rewrites() {
    return [
      { source: '/trpc/:path*', destination: `${API}/trpc/:path*` },
      { source: '/api/:path*', destination: `${API}/api/:path*` },
      { source: '/images/:path*', destination: `${API}/images/:path*` },
    ];
  },
};
```

- [ ] **Step 2: Layout + header/footer**

`layout.tsx`: `<html lang="sk" className={fontVars}><body className="site-bg min-h-dvh antialiased">…`. Header: fixed top, `glass-strong`, container `max-w-5xl`, logo text "carnaby.sk" in `font-display`, nav links to the 3 categories (accent-colored hover using `text-devlog` etc.), language switcher placeholder (Task 13), sign-in avatar placeholder (Task 18). Footer: glass top border, social icons (lucide `Github`, `Youtube`, `Twitter`, `Music4` for Spotify) linking to the same URLs as v1 footer (`git show carnaby-sk-origin:views/partials/footer.ejs` for hrefs), copyright "© 2026 Jozef Sokol. Code & Music".
`glass.tsx`: `GlassCard` — `div` with `glass rounded-glass p-6` + optional category accent prop adding `style={{ boxShadow: '0 0 40px -12px ${color}33' }}`.

- [ ] **Step 3: Verify** — `pnpm nx dev @carnaby/web` → dark page, glass header, glow background, fonts loaded (inspect `--font-inter` on `<html>`).
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(web): black-glass design tokens, fonts, root layout, header/footer"`

### Task 13: i18n (next-intl) + legacy `?language=` redirect

**Files:**
- Create: `apps/web/i18n/routing.ts`, `apps/web/i18n/request.ts`, `apps/web/messages/sk.json`, `apps/web/messages/en.json`, `apps/web/middleware.ts`, `apps/web/components/site/language-switcher.tsx`
- Modify: `apps/web/app/layout.tsx` → move pages under `apps/web/app/[locale]/` (next-intl convention; `sk` unprefixed via `localePrefix: 'as-needed'`)
- Test: `apps/web/specs/middleware-legacy-lang.spec.ts` (vitest, unit-test the redirect helper)

**Interfaces:**
- Consumes: `LANGUAGES`, `DEFAULT_LANGUAGE` from `@carnaby/shared`.
- Produces: `routing = defineRouting({ locales: ['sk','en'], defaultLocale: 'sk', localePrefix: 'as-needed' })`; `Link`/`redirect`/`usePathname`/`useRouter` from `createNavigation(routing)`; messages ported from v1 `translations` object (`git show carnaby-sk-origin:config/view-helpers.js` — port ALL keys for header/nav/footer/homepage/category/post UI strings, SK and EN); `legacyLanguageRedirect(url: URL): URL | null` — when `searchParams.language` present: strip it; if `en` → prefix `/en` (unless already), if `sk` → remove `/en` prefix; else null.
- Middleware chains: `legacyLanguageRedirect` → `createMiddleware(routing)`. Matcher excludes `/trpc`, `/api`, `/images`, `/_next`, files.

- [ ] **Step 1: Failing test** for `legacyLanguageRedirect` (4 cases: `/?language=en` → `/en`, `/posts/x?language=en` → `/en/posts/x`, `/en/posts/x?language=sk` → `/posts/x`, no param → null).
- [ ] **Step 2: Run to fail.** `pnpm add -w next-intl`
- [ ] **Step 3: Implement** per next-intl v4 app-router docs; `LanguageSwitcher` = two-button glass pill (SK/EN) using `useRouter().replace(pathname, { locale })`.
- [ ] **Step 4: Tests pass + manual check** — `/` renders Slovak strings, `/en` English, switcher toggles, `/?language=en` 307→`/en`.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(web): next-intl sk/en with v1 string port and legacy language redirect"`

### Task 14: Server tRPC client + cache tags + revalidate action

**Files:**
- Create: `apps/web/lib/trpc-server.ts`, `apps/web/lib/revalidate.ts`
- Test: `apps/web/specs/trpc-server.spec.ts`

**Interfaces:**
- Consumes: `type AppRouter` from `@carnaby/api` (type-only!).
- Produces (exact):
  - `serverTrpc(tags?: string[])` → tRPC proxy client for RSC; uses `httpBatchLink({ url: \`${process.env.API_INTERNAL_URL}/trpc\`, fetch: (u, o) => fetch(u, { ...o, next: { revalidate: tags ? 300 : 0, tags } }) })`.
  - Cache tag convention (used by all public pages): `['posts']` for lists, `['posts', 'post:<slug>']` for detail, `['categories']`.
  - `'use server'` action `revalidateContent(slugs: string[])` → calls `revalidateTag('posts')` + `revalidateTag('post:<slug>')` per slug + `revalidateTag('categories')`; **must verify admin session via `getServerSession()` (Task 18) — until Task 18 lands, guard with a TODO-free session check against `${API_INTERNAL_URL}/api/auth/get-session` inline** (same fetch as getServerSession will use; keep the inline version and extract it into `lib/session.ts` here so Task 18 reuses it).
  - `getServerSession(): Promise<{ user: { id; email; name; image; role } } | null>` in `apps/web/lib/session.ts` — forwards `cookie` header from `next/headers` to `/api/auth/get-session`, `cache: 'no-store'`.

- [ ] **Step 1: Failing test** — `serverTrpc` returns a client whose `.posts.list.query` is a function (type-level compile check via `expectTypeOf`), and `tagsFor(slug)` helper returns `['posts','post:my-slug']`.
- [ ] **Step 2: Run to fail.** `pnpm add -w @trpc/client`
- [ ] **Step 3: Implement** (`createTRPCClient<AppRouter>`), plus `lib/session.ts`.
- [ ] **Step 4: Tests + typecheck pass** — `pnpm nx run-many -t test typecheck -p @carnaby/web`.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(web): server trpc client with cache tags, session helper, revalidate action"`

### Task 15: Homepage

**Files:**
- Create: `apps/web/app/[locale]/(public)/page.tsx`, `apps/web/components/site/hero.tsx`, `apps/web/components/site/pillar-card.tsx`, `apps/web/components/post/post-card.tsx`, `apps/web/components/post/post-image.tsx`, `apps/web/lib/images.ts`
- Test: `apps/web-e2e/src/home.spec.ts`

**Interfaces:**
- Consumes: `serverTrpc(['posts'])`, `CATEGORIES`, messages (Task 13).
- Produces (exact):
  - `thumbUrl(filename: string, width: 300|600|1200|1920): string` → `/images/${width}/${filename}` (in `lib/images.ts`).
  - `<PostImage post={...} width={600} className/>` — renders `<img>` with `src=thumbUrl(...600)`, `srcSet` 300/600/1200, lazy, or YouTube `hqdefault` fallback when only `youtubeId`, or category-colored gradient placeholder when neither.
  - `<PostCard post={PostListItem} locale/>` — glass card: thumbnail, category chips (colored by `CATEGORIES[slug].color`), title (font-display), excerpt, date + views; hover: translateY(-4px) + category glow (motion `whileHover`).
  - Homepage sections: hero (animated gradient headline "Jozef Sokol — Code & Music" + sub from messages; motion fade/slide-in), three `<PillarCard>` (one per category: icon, name, description, link `/category/<slug>`, hover glow in category color), "Featured" grid of `posts.list({ featured: true, limit: 6, language: locale })`.

- [ ] **Step 1: Failing e2e**

```ts
// apps/web-e2e/src/home.spec.ts
import { expect, test } from '@playwright/test';

test('homepage renders pillars and featured posts', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /devlog/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /dodo/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /carnaby/i }).first()).toBeVisible();
  await expect(page.locator('[data-testid="featured-grid"] article').first()).toBeVisible();
});
```
Prereq note for e2e runs: dev db up + seeded + api running + at least one featured published post (add fixture insert to `apps/web-e2e/src/fixtures/seed-posts.ts` using `createDb` + drizzle, invoked in playwright `globalSetup`).

- [ ] **Step 2: Run to fail** — `pnpm nx e2e @carnaby/web-e2e` (webServer starts web; ensure `playwright.config.ts` `webServer.command` also starts api: use `nx run-many -t dev -p @carnaby/web @carnaby/api` with `reuseExistingServer: true`).
- [ ] **Step 3: Implement** the components/page per shapes above.
- [ ] **Step 4: e2e passes.**
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(web): homepage with hero, category pillars and featured posts"`

### Task 16: Category page

**Files:**
- Create: `apps/web/app/[locale]/(public)/category/[slug]/page.tsx`
- Test: `apps/web-e2e/src/category.spec.ts`

**Interfaces:**
- Consumes: `posts.list({ category, language, page })`, `CATEGORIES`, `<PostCard>`.
- Produces: `/category/devlog|dodo|carnaby` (+ `/en/...`) — category hero (icon, name, description, accent color), post grid, page-number pagination (`?page=2`), `generateMetadata` (title `${name} — carnaby.sk`), `notFound()` for unknown slug, permanent redirect `dev` → `devlog` (v1 behavior).

- [ ] **Step 1: Failing e2e** — `/category/devlog` shows category title + at least the fixture post; `/category/dev` redirects to `/category/devlog`; `/category/nope` → 404.
- [ ] **Step 2: Run to fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: e2e passes.**
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(web): category pages with pagination and v1 slug redirect"`

### Task 17: Post detail + SEO + sitemap/robots/404 + Umami

**Files:**
- Create: `apps/web/app/[locale]/(public)/posts/[slug]/page.tsx`, `apps/web/components/post/markdown.tsx`, `apps/web/components/post/youtube-embed.tsx`, `apps/web/components/post/view-tracker.tsx`, `apps/web/app/sitemap.ts`, `apps/web/app/robots.ts`, `apps/web/app/[locale]/not-found.tsx`, `apps/web/components/site/umami.tsx`
- Modify: `apps/web/app/[locale]/layout.tsx` (mount `<Umami/>`)
- Test: `apps/web-e2e/src/post.spec.ts`, `apps/web/specs/markdown.spec.ts`

**Interfaces:**
- Consumes: `posts.bySlug`, `posts.incrementViews`, `thumbUrl`.
- Produces (exact):
  - `renderMarkdown(md: string): string` — `marked` (GFM) + `isomorphic-dompurify` sanitize; unit-tested (`pnpm add -w marked isomorphic-dompurify`).
  - Post page: glass article container `max-w-[800px]`; header (category chips, localized title, date, views, language-availability note when fallback served ≠ requested); media block (YouTube iframe `youtube-nocookie.com/embed/<id>` when `youtubeId`, else `<PostImage width=1200>`); markdown body with styled typography (headings font-display, code font-mono, links accent); SoundCloud link button when `soundcloudUrl`; prev/next-style footer nav back to category.
  - `<ViewTracker id>` — client component; create `apps/web/lib/trpc-browser.ts` (`createTRPCClient<AppRouter>` with `httpBatchLink({ url: '/trpc' })`) and call `trpcBrowser.posts.incrementViews.mutate({ id })` once per mount via `useEffect` with an empty dep array and a `useRef` guard against StrictMode double-fire.
  - `generateMetadata`: title, description (metaDescription ?? excerpt), openGraph image `thumbUrl(...,1200)` absolute via `APP_URL`, `alternates.languages` for sk/en.
  - `sitemap.ts`: `/`, categories, all published slugs (both locales; en URLs prefixed) — fetched via `serverTrpc(['posts'])` with `limit: 50` pages loop.
  - `robots.ts`: allow all, disallow `/admin`, sitemap URL.
  - `<Umami/>`: `next/script` afterInteractive with `src=NEXT_PUBLIC_UMAMI_SRC`, `data-website-id=NEXT_PUBLIC_UMAMI_WEBSITE_ID` — rendered only when env set AND not `/admin/*`.
- [ ] **Step 1: Failing tests** — markdown unit spec (renders `# h1` → `<h1>`, strips `<script>`); e2e: fixture post page shows title + body, `/en/posts/<slug>` shows EN or fallback note, view count increments after reload (fixture post viewCount grows).
- [ ] **Step 2: Run to fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Tests pass** (`pnpm nx test @carnaby/web`, `pnpm nx e2e @carnaby/web-e2e`).
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(web): post detail with markdown, seo, sitemap, umami"`

---

## Phase 5 — Admin

### Task 18: Admin gate, login page, shadcn/ui init

**Files:**
- Create: `apps/web/app/[locale]/login/page.tsx`, `apps/web/app/admin/layout.tsx`, `apps/web/app/admin/page.tsx`, `apps/web/lib/auth-client.ts`, `apps/web/components/site/user-menu.tsx`
- Modify: `apps/web/components/site/header.tsx` (mount `<UserMenu/>`)
- Test: `apps/web-e2e/src/admin-gate.spec.ts`

**Interfaces:**
- Consumes: `getServerSession` (Task 14), better-auth endpoints via `/api/auth/*` rewrite.
- Produces (exact):
  - `authClient = createAuthClient({ baseURL: '' })` from `better-auth/react` (`pnpm add` already covered by better-auth) in `lib/auth-client.ts`; login button calls `authClient.signIn.social({ provider: 'google', callbackURL: '/' })`.
  - `/login`: centered glass card, Google button (logo + "Prihlásiť sa cez Google" / EN variant), redirects to `/` when already signed in.
  - `/admin/layout.tsx` (NOT under `[locale]` — admin is Slovak-only, matching v1): server component; `const s = await getServerSession(); if (!s) redirect('/login'); if (s.user.role !== 'admin') redirect('/');` then renders admin shell: glass sidebar (Dashboard, Príspevky, Používatelia, → Web) + content area.
  - `/admin` dashboard: welcome card (name, email, role badge), quick links, link to Umami (`https://analytics.carnaby.sk`).
  - `<UserMenu/>`: client component using `authClient.useSession()` — avatar dropdown (image, name, "Admin panel" when `role==='admin'`, "Odhlásiť" → `authClient.signOut()`); "Prihlásiť" link otherwise.
  - shadcn/ui init: `pnpm dlx shadcn@latest init` in `apps/web` (style: new-york, base color: neutral, CSS variables: yes) + `pnpm dlx shadcn@latest add button table dialog input textarea select badge tabs checkbox label dropdown-menu sonner` — then restyle `components/ui` primitives minimally: card/dialog/dropdown surfaces get `glass` class, focus rings use category emerald.
- [ ] **Step 1: Failing e2e** — anonymous `/admin` redirects to `/login`; `/login` shows Google button.
- [ ] **Step 2: Run to fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: e2e passes + manual full OAuth check** (requires real Google creds in `.env` and the localhost redirect URI added — see Task 6 owner TODO; verify `dodusik@gmail.com` lands with `role=admin` in `user` table).
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(web): login page, admin shell with role gate, shadcn/ui glass theme"`

### Task 19: tRPC react-query provider (browser)

**Files:**
- Create: `apps/web/lib/trpc-react.tsx`
- Modify: `apps/web/app/admin/layout.tsx` (wrap content in provider)

**Interfaces:**
- Produces (exact): `pnpm add -w @tanstack/react-query @trpc/tanstack-react-query`; `TRPCProvider` client component (QueryClient + `createTRPCClient<AppRouter>` with `httpBatchLink({ url: '/trpc' })`) and `useTRPC()` hook per @trpc/tanstack-react-query docs; admin pages consume `const trpc = useTRPC(); useQuery(trpc.posts.adminList.queryOptions({...}))`.

- [ ] **Step 1: Implement provider** (no unit test — exercised by Task 20 e2e/typecheck).
- [ ] **Step 2: Typecheck passes** — `pnpm nx typecheck @carnaby/web`.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat(web): trpc react-query provider for admin"`

### Task 20: Admin posts table

**Files:**
- Create: `apps/web/app/admin/posts/page.tsx`, `apps/web/components/admin/posts-table.tsx`
- Test: `apps/web-e2e/src/admin-posts.spec.ts` (see note below)

**Interfaces:**
- Consumes: `posts.adminList`, `posts.remove`, `categories.list`, shadcn Table/Select/Badge/Dialog, `revalidateContent`.
- Produces: `/admin/posts` — toolbar ("Nový príspevok" button → `/admin/posts/new`; filters: status (Všetky/Draft/Published/Archived), kategória, featured toggle; applied via query state), table columns: thumbnail (60px, `thumbUrl(...,300)`), title (+⭐ when featured, SK/EN chips from `hasSk/hasEn`), categories, status badge (published=emerald, draft=amber, archived=gray), views, created date, actions (Upraviť → editor, Zmazať → confirm Dialog → `posts.remove` + `revalidateContent` + toast). Column-header sorting (createdAt/title/status/viewCount), pagination footer (20/page).
- e2e note: full authenticated admin e2e needs a session; create `apps/web-e2e/src/fixtures/admin-session.ts` that inserts a `user` (role admin) + `session` row (token = 64-hex random, expiresAt +1d) directly via drizzle, then sets cookie `better-auth.session_token=<token>.<hmac>` — better-auth signs cookies with HMAC-SHA256(base64) of the token using `BETTER_AUTH_SECRET`; implement `signSessionToken(token, secret)` with `createHmac('sha256', secret).update(token).digest('base64')` and set cookie value `${token}.${encodeURIComponent(sig)}`. If sign-format drift makes this brittle, fall back to marking these admin e2e specs `test.skip(!process.env.E2E_ADMIN)` and cover the flows in staging verification (Task 30) — do not burn more than ~30 min on cookie signing.

- [ ] **Step 1: Failing e2e (or skipped-guarded)** — admin sees fixture post row; delete flow removes it.
- [ ] **Step 2: Run.**
- [ ] **Step 3: Implement page + table.**
- [ ] **Step 4: e2e/typecheck pass.**
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(web): admin posts table with filters, sorting, delete"`

### Task 21: Post editor

**Files:**
- Create: `apps/web/app/admin/posts/new/page.tsx`, `apps/web/app/admin/posts/[id]/edit/page.tsx`, `apps/web/components/admin/post-editor.tsx`, `apps/web/components/admin/markdown-preview.tsx`, `apps/web/components/admin/thumbnail-picker.tsx`
- Test: `apps/web/specs/editor-state.spec.ts`

**Interfaces:**
- Consumes: `posts.byId`, `posts.create`, `posts.update`, `categories.list`, `postUpsertInput`+`slugify` from `@carnaby/shared`, uploads REST (Task 10), `revalidateContent` (Task 14).
- Produces:
  - `<PostEditor mode='new' | { id }>` client component. Layout: two columns (form left, sticky preview right). **SK/EN tabs** (shadcn Tabs) over per-language fields: title, excerpt, content (textarea, font-mono), metaDescription; a language tab shows an "untranslated" empty state with a "Skopírovať z SK/EN" helper button. Shared fields: slug (auto-`slugify` from first title until manually edited), categories (checkbox list), featured (checkbox), youtubeId, soundcloudUrl, thumbnail.
  - Pure state helper (unit-tested): `buildUpsertInput(state): PostUpsertInput | { errors }` — drops empty-language tabs entirely (a language counts as present when title+content non-empty), validates via `postUpsertInput.safeParse`.
  - `<MarkdownPreview md>` — client-side `marked` + DOMPurify render of the ACTIVE language tab, styled like the public post body.
  - `<ThumbnailPicker value onChange postThumbnail>` — shows current thumb via `thumbUrl(...,300)`; "Nahrať" → file input → `fetch('/api/uploads/thumbnail', { method:'POST', body: FormData })` → sets returned `filename`; "Z YouTube" → uses the youtubeId field value → `/api/uploads/from-youtube`.
  - Save actions: "Uložiť koncept" (status=draft), "Publikovať" (status=published), "Archivovať" (edit mode) — on success: toast, `revalidateContent([slug])`, redirect to `/admin/posts`.
- [ ] **Step 1: Failing unit test** for `buildUpsertInput` (empty EN tab dropped; no-language → errors; slug auto vs manual).
- [ ] **Step 2: Run to fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Tests + typecheck pass; manual editor walkthrough** (create draft with SK only, add EN, upload thumbnail, publish, verify public page + revalidation).
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(web): bilingual markdown post editor with preview and thumbnails"`

### Task 22: Admin users page

**Files:**
- Create: `apps/web/app/admin/users/page.tsx`
- Test: covered by typecheck + staging checklist (read-only page)

**Interfaces:**
- Consumes: `users.list` (admin tRPC).
- Produces: `/admin/users` — read-only table (avatar, name, email, role badge — admin=carnaby purple, user=gray, created date). Parity with v1.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: `pnpm nx run-many -t lint typecheck test -p @carnaby/web` green; manual check.**
- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat(web): admin users read-only table"`

---

## Phase 6 — Legacy data migration

### Task 23: `migrate-legacy` script + verification report

**Files:**
- Create: `tools/migrate-legacy/src/migrate.ts`, `tools/migrate-legacy/src/mapping.ts`, `tools/migrate-legacy/src/report.ts`
- Modify: `tools/migrate-legacy/src/index.ts`, `tools/migrate-legacy/project.json` (add `run` target: `tsx src/migrate.ts`)
- Test: `tools/migrate-legacy/src/mapping.spec.ts`

**Interfaces:**
- Consumes: `LEGACY_DATABASE_URL` (v1 schema restore), `DATABASE_URL` (v2 db), `createDb`/schema from `@carnaby/db`; raw `pg` Client for the legacy side.
- Produces (exact):
  - `pnpm nx run migrate-legacy:run` — idempotent: wipes v2 content+auth tables (`TRUNCATE post_categories, post_translations, posts, categories, "verification", "account", "session", "user" RESTART IDENTITY CASCADE`), then migrates, then prints report. Exit non-zero when any check fails.
  - Pure mapping fns (unit-tested):
    - `mapUser(old: { id, google_id, email, display_name, avatar_url, role, created_at }): { user: NewUser; account: NewAccount; oldId: number }` — `user.id` = 32-hex `randomBytes(16)`, `name` = display_name ?? email local-part, `emailVerified: true`, `role` preserved; `account` = `{ id: 32hex, accountId: old.google_id, providerId: 'google', userId: user.id }`.
    - `mapPost(old, authorIdMap): NewPost` — copies slug/status/is_featured/youtube_id/soundcloud_url/view_count/published_at/created_at; `thumbnailPath = old.thumbnail_path ? basename(old.thumbnail_path) : null`; `authorId = authorIdMap.get(old.author_id) ?? null`.
    - `buildTranslations(old: LegacyPost, rows: LegacyTranslation[]): NewTranslation[]` — copy all `post_translations` rows; if no row exists for `old.language` (v1 default `sk`) AND legacy `old.title && old.content` are non-empty, synthesize one from legacy columns. Dedup on (postId, language) — translation rows win over synthesized.
  - `report.ts`: prints table `old vs new counts` (users, categories, posts, post_translations, post_categories), lists: posts with zero translations (FAIL), thumbnail filenames referenced but missing under `UPLOADS_DIR/originals` (WARN, only when `UPLOADS_DIR` set), 3 sample slugs with title per language (manual spot-check aid).
  - Category mapping by slug (not id): legacy `categories.slug` → v2 `categories.id` after re-seeding via `seed()` from `@carnaby/db` (guarantees canonical 3 categories + keeps any extra legacy categories by inserting them).

- [ ] **Step 1: Failing unit tests** for the three mapping fns (incl. synthesized-translation rule and basename stripping `/thumbnails/originals/x.jpg` → `x.jpg`).
- [ ] **Step 2: Run to fail** — `pnpm nx test migrate-legacy`.
- [ ] **Step 3: Implement** migrate.ts flow: connect both DBs → truncate → seed categories → insert legacy-only categories → users+accounts → posts (id map old→new by inserting with explicit ids? NO — let serial assign, keep `Map<oldId,newId>`; insert ordered by old id) → translations → post_categories (via slug→id and old→new post map) → `SELECT setval` not needed (serials advanced by inserts) → report.
- [ ] **Step 4: Tests pass.**
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(tools): legacy v1->v2 data migration with verification report"`

### Task 24: Migration rehearsal on a fresh NAS dump

**Files:**
- Create: `docs/deploy/migration-rehearsal.md` (results log)

**Interfaces:**
- Consumes: NAS SSH (`ssh -p 2222 carnaby@192.168.1.41`), local `carnaby_legacy` db (Task 5 created it), migrate-legacy (Task 23).

- [ ] **Step 1: Pull fresh dump from NAS**

```bash
ssh -p 2222 carnaby@192.168.1.41 "docker exec carnaby-db pg_dump -U carnaby -d carnaby" > tools/migrate-legacy/data/carnaby-legacy.sql
```
(`tools/migrate-legacy/data/` is gitignored. If `pg_dump -U carnaby` fails, retry with `-U umami` — both roles exist on that cluster.)

- [ ] **Step 2: Restore locally**

```bash
docker exec carnaby-db-local psql -U carnaby -c "DROP DATABASE IF EXISTS carnaby_legacy" 
docker exec carnaby-db-local psql -U carnaby -c "CREATE DATABASE carnaby_legacy"
docker exec -i carnaby-db-local psql -U carnaby -d carnaby_legacy < tools/migrate-legacy/data/carnaby-legacy.sql
docker exec carnaby-db-local psql -U carnaby -d carnaby_legacy -c "select count(*) from posts"
```
Expected: post count > 0 (log the number).

- [ ] **Step 3: Run migration + verify**

```bash
pnpm nx run migrate-legacy:run
```
Expected: report shows equal counts (posts, translations ≥ posts count, users, post_categories), zero posts-without-translations, exit 0. Record the report output in `docs/deploy/migration-rehearsal.md`.

- [ ] **Step 4: Eyeball the result in the app** — with api+web running against migrated local db: homepage shows real v1 featured posts, a known post (e.g. the AI-experiment finale from Feb 2026) renders in SK and EN, admin table lists everything. Fix data issues found (iterate on Task 23 mappings, re-run — idempotent).

- [ ] **Step 5: Commit** — `git add docs && git commit -m "docs: legacy migration rehearsal results"`

---

## Phase 7 — Docker images & CI publish

### Task 25: Production Dockerfiles + local stack smoke test

**Files:**
- Create: `docker/api.Dockerfile`, `docker/web.Dockerfile`, `docker/docker-compose.local-prod.yml`, `.dockerignore`

**Interfaces:**
- Produces: `docker build -f docker/api.Dockerfile .` and `-f docker/web.Dockerfile .` succeed from repo root; full local prod stack (db+api+web) serves the site on http://localhost:3100.

- [ ] **Step 1: `.dockerignore`**

```
node_modules
**/node_modules
.git
.next
dist
.nx
.env*
tools/migrate-legacy/data
docs
```

- [ ] **Step 2: `docker/api.Dockerfile`**

```dockerfile
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm nx build @carnaby/api
# prod-only deps for the api, workspace deps materialized
RUN pnpm --filter @carnaby/api deploy --prod /out && cp -r apps/api/dist /out/dist \
 && mkdir -p /out/migrations && cp -r packages/db/migrations/* /out/migrations/

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out .
ENV MIGRATIONS_DIR=/app/migrations
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1
CMD ["node", "dist/main.js"]
```
Notes for implementer: `pnpm deploy` needs `"name": "@carnaby/api"` in `apps/api/package.json` with `dependencies` listing its real runtime deps (`@nestjs/*`, `better-auth`, `drizzle-orm`, `pg`, `sharp`, `multer`, `@trpc/server`, `zod`, `@carnaby/db`, `@carnaby/shared` as `workspace:*`). Nx builds bundle workspace TS via webpack/esbuild — verify `dist/main.js` runs with only prod node_modules (`node dist/main.js` inside the image). If the Nx api build outputs to `apps/api/dist`, adjust the `cp` path accordingly. sharp installs its own musl binary during `pnpm install` inside alpine — do NOT copy node_modules from a Windows host.

- [ ] **Step 3: `docker/web.Dockerfile`**

```dockerfile
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm nx build @carnaby/web

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
EXPOSE 3000
ENV HOSTNAME=0.0.0.0 PORT=3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000 || exit 1
CMD ["node", "apps/web/server.js"]
```
Note: standalone server path may be `server.js` or `apps/web/server.js` depending on Next monorepo tracing — check the build output and fix CMD. Add `outputFileTracingRoot: join(__dirname, '../..')` to `next.config.js` for monorepo standalone.

- [ ] **Step 4: `docker/docker-compose.local-prod.yml`**

```yaml
services:
  web:
    build: { context: .., dockerfile: docker/web.Dockerfile }
    ports: ['3100:3000']
    environment:
      - API_INTERNAL_URL=http://api:3001
      - APP_URL=http://localhost:3100
    depends_on: [api]

  api:
    build: { context: .., dockerfile: docker/api.Dockerfile }
    environment:
      - PORT=3001
      - DATABASE_URL=postgres://carnaby:carnaby@db:5432/carnaby
      - BETTER_AUTH_SECRET=local-prod-secret-not-for-real-use
      - ADMIN_EMAILS=dodusik@gmail.com
      - APP_URL=http://localhost:3100
      - UPLOADS_DIR=/data/uploads
      - CACHE_DIR=/data/cache
    volumes:
      - ./.data/uploads:/data/uploads
      - ./.data/cache:/data/cache
    depends_on:
      db: { condition: service_healthy }

  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: carnaby
      POSTGRES_PASSWORD: carnaby
      POSTGRES_DB: carnaby
    ports: ['5433:5432']
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U carnaby']
      interval: 5s
      timeout: 5s
      retries: 10
```
(`docker/.data/` gets created at runtime — add `docker/.data` to `.gitignore`.)

- [ ] **Step 5: Smoke test**

```bash
docker compose -f docker/docker-compose.local-prod.yml up -d --build
curl -s http://localhost:3100 | grep -io 'carnaby' | head -1
curl -s http://localhost:3100/api/health
docker compose -f docker/docker-compose.local-prod.yml down
```
Expected: homepage HTML contains "carnaby"; health `{"status":"ok"}`.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "build: production dockerfiles for web and api with local prod compose"`

### Task 26: NAS compose + env template + backup script

**Files:**
- Create: `docker/docker-compose.nas.yml`, `docker/.env.nas.example`, `docker/backup-db-v2.sh`, `docs/deploy/nas-runbook.md`

**Interfaces:**
- Produces: the exact files to be copied to `/volume1/docker/carnaby-sk-v2/` on the NAS.

- [ ] **Step 1: `docker/docker-compose.nas.yml`**

```yaml
services:
  web:
    image: ghcr.io/carnaby/carnaby-web:${TAG:-dev}
    container_name: carnaby-web
    restart: unless-stopped
    user: "1026:100"
    ports: ['3100:3000']
    environment:
      - NODE_ENV=production
      - API_INTERNAL_URL=http://api:3001
      - APP_URL=${APP_URL}
      - NEXT_PUBLIC_UMAMI_WEBSITE_ID=${UMAMI_WEBSITE_ID}
      - NEXT_PUBLIC_UMAMI_SRC=https://analytics.carnaby.sk/script.js
    depends_on:
      api: { condition: service_healthy }
    networks: [carnaby-v2]
    labels: ['com.centurylinklabs.watchtower.enable=true']

  api:
    image: ghcr.io/carnaby/carnaby-api:${TAG:-dev}
    container_name: carnaby-api
    restart: unless-stopped
    user: "1026:100"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DATABASE_URL=postgres://carnaby:${DB_PASSWORD}@db:5432/carnaby
      - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - ADMIN_EMAILS=${ADMIN_EMAILS}
      - APP_URL=${APP_URL}
      - UPLOADS_DIR=/data/uploads
      - CACHE_DIR=/data/cache
    volumes:
      - /volume1/docker/carnaby-sk-v2/uploads:/data/uploads
      - /volume1/docker/carnaby-sk-v2/cache:/data/cache
    depends_on:
      db: { condition: service_healthy }
    networks: [carnaby-v2]
    healthcheck:
      test: ['CMD-SHELL', 'wget -qO- http://localhost:3001/api/health || exit 1']
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 20s
    labels: ['com.centurylinklabs.watchtower.enable=true']

  db:
    image: postgres:17-alpine
    container_name: carnaby-db-v2
    restart: unless-stopped
    user: "1026:100"
    environment:
      - POSTGRES_DB=carnaby
      - POSTGRES_USER=carnaby
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - /volume1/docker/carnaby-sk-v2/db:/var/lib/postgresql/data
    networks: [carnaby-v2]
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U carnaby -d carnaby']
      interval: 10s
      timeout: 5s
      retries: 5

networks:
  carnaby-v2:
    driver: bridge
```
(Web healthcheck lives in the image; Watchtower is the EXISTING container from the old stack — labels are enough, no new watchtower service.)

- [ ] **Step 2: `docker/.env.nas.example`**

```
TAG=dev
APP_URL=https://carnaby.sk
DB_PASSWORD=openssl-rand-hex-32
BETTER_AUTH_SECRET=openssl-rand-hex-32
GOOGLE_CLIENT_ID=copy-from-old-stack-env
GOOGLE_CLIENT_SECRET=copy-from-old-stack-env
ADMIN_EMAILS=dodusik@gmail.com
UMAMI_WEBSITE_ID=0733e169-1bc1-4990-a65f-2442fbb00237
```

- [ ] **Step 3: `docker/backup-db-v2.sh`** — mirror v1's `backup-db.sh` (see `git show carnaby-sk-origin:backup-db.sh`): `docker exec carnaby-db-v2 pg_dump -U carnaby carnaby | gzip > /volume1/GoogleDrive/backups/carnaby-v2-$(date +%F).sql.gz` + 30-day prune, using the SAME backup destination folder as v1 (read it from the old script).

- [ ] **Step 4: `docs/deploy/nas-runbook.md`** — document: dir layout, first-deploy commands (Task 28's exact commands), how to roll a new version (`docker compose pull && up -d`), where logs live (`docker logs carnaby-api`), rollback (`TAG=<old-sha>` + `up -d`).

- [ ] **Step 5: Commit** — `git add -A && git commit -m "build: nas compose, env template, backup script, runbook"`

### Task 27: CI image publish

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: after quality job, a matrix job builds+pushes `ghcr.io/carnaby/carnaby-web` and `ghcr.io/carnaby/carnaby-api`; tags: `dev` + `dev-<shortsha>` on branch `v2`; `latest` + `<shortsha>` on `main`.

- [ ] **Step 1: Append job**

```yaml
  images:
    needs: quality
    runs-on: ubuntu-latest
    permissions: { contents: read, packages: write }
    strategy:
      matrix:
        app: [web, api]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ghcr.io/carnaby/carnaby-${{ matrix.app }}
          tags: |
            type=raw,value=latest,enable=${{ github.ref_name == 'main' }}
            type=raw,value=dev,enable=${{ github.ref_name == 'v2' }}
            type=sha,prefix=${{ github.ref_name == 'main' && '' || 'dev-' }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: docker/${{ matrix.app }}.Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            APP_URL=https://carnaby.sk
            API_INTERNAL_URL=http://api:3001
            NEXT_PUBLIC_UMAMI_WEBSITE_ID=0733e169-1bc1-4990-a65f-2442fbb00237
            NEXT_PUBLIC_UMAMI_SRC=https://analytics.carnaby.sk/script.js
```
**Also (Task 26 finding):** `NEXT_PUBLIC_*` vars are INLINED at build time by Next — `docker/web.Dockerfile` must declare `ARG`+`ENV` for `NEXT_PUBLIC_UMAMI_WEBSITE_ID` and `NEXT_PUBLIC_UMAMI_SRC` in the build stage (same pattern as APP_URL), and CI must pass them (values above). Without this, Umami analytics is silently dead in production images. Runtime env in the NAS compose does NOT work for these.
**CRITICAL (Task 25 finding):** the web image FREEZES `APP_URL`/`API_INTERNAL_URL` at build time (Next rewrites + static robots.txt/sitemap.xml are baked into the build). The `build-args` above are mandatory — without them the published image ships localhost URLs. `API_INTERNAL_URL=http://api:3001` matches the NAS compose service name `api`. (The args are harmless no-ops for the api image.)

- [ ] **Step 2: Push, watch run green, verify packages**

```bash
git add .github && git commit -m "ci: publish carnaby-web and carnaby-api images to ghcr" && git push
gh run watch --exit-status $(gh run list --branch v2 --limit 1 --json databaseId -q '.[0].databaseId')
gh api /orgs/carnaby/packages?package_type=container | grep -o '"name":"[^"]*"'
```
Expected: both packages exist with `dev` tag. If the org packages API 404s (user account, not org), check `gh api /user/packages?package_type=container`. **Make new GHCR packages public or grant the NAS pull access** (old NAS already has docker login for ghcr via watchtower config — private is fine if that credential covers the new packages; verify in Task 28 with a manual pull).

---

## Phase 8 — Staging on NAS, data migration, cutover

### Task 28: Deploy v2 stack to NAS (staging on :3100)

**Files:**
- Create: `docs/deploy/staging-log.md`

- [ ] **Step 1: Prepare NAS dirs + files**

```bash
ssh -p 2222 carnaby@192.168.1.41 "mkdir -p /volume1/docker/carnaby-sk-v2/{db,uploads,cache}"
scp -P 2222 docker/docker-compose.nas.yml carnaby@192.168.1.41:/volume1/docker/carnaby-sk-v2/docker-compose.yml
scp -P 2222 docker/backup-db-v2.sh carnaby@192.168.1.41:/volume1/docker/carnaby-sk-v2/
```
Create `.env` on the NAS (do NOT commit): take `docker/.env.nas.example`, fill `DB_PASSWORD`/`BETTER_AUTH_SECRET` via `openssl rand -hex 32`, copy `GOOGLE_CLIENT_ID/SECRET` from the old stack env (`ssh ... "grep GOOGLE /volume1/docker/carnaby-sk/.env"`), write it with a heredoc over ssh, `chmod 600`.

- [ ] **Step 2: Pull + up**

```bash
ssh -p 2222 carnaby@192.168.1.41 "cd /volume1/docker/carnaby-sk-v2 && docker compose pull && docker compose up -d && docker compose ps"
```
(If `docker compose` is unavailable on DSM, use `docker-compose`; if permission denied, prefix `sudo`.)
Expected: 3 containers, api healthy after ~20s (drizzle migrations ran on boot — check `docker logs carnaby-api`).

- [ ] **Step 3: Smoke from LAN**

```bash
ssh -p 2222 carnaby@192.168.1.41 "wget -qO- http://localhost:3100/api/health && wget -qO- http://localhost:3100 | head -c 300"
```
Expected: health ok; HTML of the new homepage renders. Content and categories are still EMPTY at this point — they arrive with the data migration in Task 29 (its dump includes seeded categories). An empty-but-rendering homepage is the expected state here.
Record results in `docs/deploy/staging-log.md`.

- [ ] **Step 4: Commit** — `git add docs && git commit -m "docs: nas staging deployment log"`

### Task 29: Production data migration + thumbnails

- [ ] **Step 1: Fresh dump → local migration → dump v2** (repeat Task 24 with TODAY's data)

```bash
ssh -p 2222 carnaby@192.168.1.41 "docker exec carnaby-db pg_dump -U carnaby -d carnaby" > tools/migrate-legacy/data/carnaby-legacy.sql
docker exec carnaby-db-local psql -U carnaby -c "DROP DATABASE IF EXISTS carnaby_legacy"; docker exec carnaby-db-local psql -U carnaby -c "CREATE DATABASE carnaby_legacy"
docker exec -i carnaby-db-local psql -U carnaby -d carnaby_legacy < tools/migrate-legacy/data/carnaby-legacy.sql
pnpm nx run migrate-legacy:run   # against local v2 db (fresh: drop/recreate local carnaby db + nx run @carnaby/db:migrate first)
docker exec carnaby-db-local pg_dump -U carnaby -d carnaby > tools/migrate-legacy/data/carnaby-v2.sql
```

- [ ] **Step 2: Load into NAS v2 db + thumbnails**

```bash
scp -P 2222 tools/migrate-legacy/data/carnaby-v2.sql carnaby@192.168.1.41:/volume1/docker/carnaby-sk-v2/import.sql
ssh -p 2222 carnaby@192.168.1.41 "cd /volume1/docker/carnaby-sk-v2 && \
  docker exec -i carnaby-db-v2 psql -U carnaby -d carnaby -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' && \
  docker exec -i carnaby-db-v2 psql -U carnaby -d carnaby < import.sql && rm import.sql && \
  cp -a /volume1/docker/carnaby-sk/thumbnails/. /volume1/docker/carnaby-sk-v2/uploads/ && \
  docker compose restart api"
```
(Schema drop is safe — staging db only contains what we just deployed. api restart re-runs drizzle migrate which no-ops on the imported journal.)

- [ ] **Step 3: Verify staging with real data**

`http://192.168.1.41:3100` from LAN: homepage shows real featured posts, category pages populated, a known post renders SK+EN, images serve via `/images/600/...`. Record in staging-log, commit.

### Task 30: Staging verification & pre-cutover gates

- [ ] **Step 1: Run full e2e against staging** — `BASE_URL=http://192.168.1.41:3100 pnpm nx e2e @carnaby/web-e2e --skip-fixtures` (add a `SKIP_FIXTURES` guard to globalSetup: when BASE_URL is external, tests run read-only public specs only; admin/OAuth specs excluded).
- [ ] **Step 2: Checklist in `docs/deploy/cutover-checklist.md`** (create it): all boxes below must be checked before Task 31:
  - [ ] Public pages OK on staging (home/category/post, SK+EN, images, 404)
  - [ ] `api/health` OK; `docker logs carnaby-api` free of errors; migrations journal applied
  - [ ] Data verified (counts from Task 29 report; spot-check 3 posts)
  - [ ] Owner added BOTH Google redirect URIs (localhost + prod) — login tested locally end-to-end with real creds, `dodusik@gmail.com` got `role=admin`
  - [ ] GHCR packages accessible from NAS (pull succeeded in Task 28)
  - [ ] Backup of old DB taken TODAY (`ssh ... "docker exec carnaby-db pg_dump -U carnaby -d carnaby | gzip > /volume1/docker/carnaby-sk/pre-cutover-backup.sql.gz"`)
- [ ] **Step 3: Commit checklist.**

### Task 31: Cutover (owner-gated) + post-cutover

**STOP: get explicit owner approval in chat before each step of this task.**

- [ ] **Step 1: Promote branch** — `git checkout main && git merge --ff-only v2 && git push origin main`. CI publishes `:latest` images. **This replaces the old deploy workflow — verify on GitHub that only `CI` ran on main** (old `Build and Push Docker Image` file no longer exists on main after merge).
- [ ] **Step 2: Switch NAS to latest** — edit NAS `.env`: `TAG=latest`; `ssh ... "cd /volume1/docker/carnaby-sk-v2 && docker compose pull && docker compose up -d"`.
- [ ] **Step 3: Owner switches DSM reverse proxy** carnaby.sk → `localhost:3100` (Control Panel → Login Portal → Advanced → Reverse Proxy). Immediately verify `https://carnaby.sk` (public pages, Google login, admin, Umami events arriving).
- [ ] **Step 4: Rollback path (if anything fails):** switch proxy back to 3000 — old stack untouched and still running.
- [ ] **Step 5: Post-cutover (after owner confirms stability, target ≥1 week):**
  - stop old containers `carnaby-sk` (keep `carnaby-db` — Umami uses it! only the old `carnaby` DATABASE inside it becomes dormant),
  - disable watchtower label on the stopped container (moot once stopped),
  - schedule `backup-db-v2.sh` in DSM Task Scheduler (owner; daily, same cadence as v1),
  - remove old `carnaby` database only after another verified backup,
  - update README on main with the v2 architecture,
  - optional: remove `?language=` redirect after 6 months.

---

## Execution notes for the orchestrator

- Execute tasks strictly in order; Tasks 8/9 depend on 5–7; web tasks 15–17 need 8; admin tasks 20–22 need 9/10/14/18/19; 24 needs 23; 28–31 need 25–27.
- Tasks 24, 28, 29, 30, 31 touch the NAS or need human checks — run them in the main session (not fire-and-forget subagents) and involve the owner where marked.
- Each subagent gets: this plan's Global Constraints + its single task section + the spec path. Subagents must run the listed verify commands and report actual output.
- After each phase: `pnpm nx run-many -t lint typecheck test build` must be green before starting the next phase.



