# carnaby.sk

A modern rewrite of the carnaby.sk platform using a monorepo architecture with **pnpm** and **Nx**.

## Stack

- **Monorepo**: pnpm workspace + Nx for task orchestration
- **Web**: Next.js 
- **API**: NestJS with tRPC
- **Database**: PostgreSQL with migrations
- **Package Manager**: pnpm

## Monorepo Layout

```
apps/
  ├── web/        # Next.js frontend application
  └── api/        # NestJS backend API
packages/
  ├── shared/     # Shared utilities and types
  └── db/         # Database schema and migrations
tools/
  └── migrate-legacy/  # Legacy data migration utilities
```

## Getting Started

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Start the development environment**:
   ```bash
   docker compose -f docker/docker-compose.dev.yml up -d
   pnpm dev
   ```

3. **Build for production**:
   ```bash
   pnpm build
   ```

## Available Scripts

- `pnpm dev` - Start development servers (web + api)
- `pnpm build` - Build all applications
- `pnpm test` - Run tests across the workspace
- `pnpm lint` - Lint code
- `pnpm typecheck` - Check TypeScript types

## End-to-end tests

`apps/web-e2e` is a small Playwright suite (Chromium; desktop + an iPhone 13 viewport) covering the
public pages (post SK/EN, canonical/hreflang, sitemap, legacy redirects, 404) and the admin
(gate, dashboard tiles, list filters, star, delete, editor create → publish → edit → archive,
unsaved-changes prompt, mobile tab bar, YouTube import).

It runs against the **already running dev stack** — it does not start one:

```bash
docker compose -f docker/docker-compose.dev.yml up -d   # Postgres
pnpm dev                                                 # web :3000 + api :3001
pnpm nx e2e @carnaby/web-e2e                             # or: cd apps/web-e2e && pnpm exec playwright test
```

- Reads the repo-root `.env` (`BETTER_AUTH_SECRET`, `DATABASE_URL`). Admin sessions are created
  directly in the database (no Google OAuth); everything the suite creates (`e2e-test-*` posts,
  `e2e-*` users) is removed at the end.
- The YouTube test only runs when the api points at a local fake (`YOUTUBE_API_BASE_URL=http://localhost:4555`
  plus any `YOUTUBE_API_KEY`/`YOUTUBE_CHANNELS`); the suite starts that fake itself. Otherwise it is skipped.
- `E2E_CHROMIUM_PATH=/path/to/chrome` uses a custom Chromium when `pnpm exec playwright install chromium`
  isn't an option. `E2E_BASE_URL` / `E2E_API_URL` override `http://localhost:3000` / `:3001`.
- Not part of CI (`lint typecheck test build`) — it needs a live stack.

## Managing content from Claude (MCP)

The api exposes an MCP server at `https://carnaby.sk/api/mcp` with every admin capability
(posts, translations, publishing, images, thumbnails, users). Add it in Claude as a custom
connector — sign-in is Google OAuth, admin role only. See [`docs/mcp.md`](docs/mcp.md).

YouTube videos can be pulled in as posts from `/admin/youtube` (or via MCP) — see
[`docs/youtube.md`](docs/youtube.md).

## Documentation

- See `.superpowers/sdd/` for the implementation spec and detailed planning documents
- Legacy codebase: See `carnaby-sk-origin` branch for v1 history

## Environment Configuration

Copy `.env.example` to `.env` and configure your local environment variables. For database and API configuration details, see the API documentation.
