/**
 * Public origin of the site, used to build absolute URLs (Open Graph images, sitemap/robots
 * entries, `alternates.languages`) where a relative path won't do. Falls back to the local dev
 * origin so `next build`/tests don't need `APP_URL` set. Shared with the api (see root
 * `.env.example`'s `APP_URL`) — Nx loads the workspace-root `.env` for every task regardless of
 * a target's `cwd`, so no separate `NEXT_PUBLIC_`-prefixed copy is needed for server-only use.
 */
export const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
