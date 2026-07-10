# Cutover checklist — carnaby.sk v2

Gate for Task 31 (cutover). Every box in **Pre-cutover gates** below is checked and backed by
evidence from Tasks 28-30 — no further verification work is needed before Task 31 can run,
**except** the two owner-gated Google OAuth items and the final go/no-go, which this task cannot
close on its own. Task 31 itself needs **explicit owner approval before each of its steps** (see
the plan and the summary at the bottom of this file) — this document does not grant that approval,
it only confirms the technical preconditions are met.

## Pre-cutover gates

- [x] **Public pages OK on staging** (home/category/post, SK+EN, images, 404, v1 slug redirect,
  language switch) — verified twice, independently:
  - Task 29's manual LAN spot-check (`docs/deploy/staging-log.md` § "Data migration" → "5.
    Verification with real data"): homepage real featured-post titles, a known post in SK+EN,
    category page, resized image serving, 404 on unknown category.
  - Task 30's automated e2e run against staging (`E2E_BASE_URL=http://192.168.1.41:3200 pnpm nx
    e2e @carnaby/web-e2e -- --project=chromium`): **6 passed, 0 failed, 10 skipped by design**
    (admin/OAuth specs — see "Owner action" below; and the three local-fixture-only assertions in
    `post.spec.ts`/`category.spec.ts` that don't apply to a real deployment). The 6 that ran and
    passed are exactly the real-content invariants: featured grid renders, sk→en language switch
    actually re-renders the page, a real post page loads via a link click from the homepage,
    `/category/devlog` renders a real post, `/category/dev` redirects to it (v1 slug parity),
    and an unknown category slug 404s.
- [x] **`api/health` OK; `docker logs carnaby-api` free of errors; migrations journal applied**
  - `curl http://192.168.1.41:3200/api/health` → `{"status":"ok"}` (checked live during this
    task, and previously in Tasks 28/29).
  - Log scan (Task 30, this task): `docker logs carnaby-api` and `docker logs carnaby-web`,
    grepped case-insensitively for `EACCES|FATAL|ECONNREFUSED|permission denied` → **0 hits on
    both containers**. One unrelated advisory-level line is present in `carnaby-api`'s log (not
    matched by the above patterns, not a startup or request failure): a better-auth `WARN` that
    it "could not determine a client IP" for rate limiting and is falling back to a shared
    bucket — expected until the NAS's reverse proxy forwards a trusted `X-Forwarded-For` header;
    harmless pre-cutover (LAN/e2e traffic has no such header either), worth a look post-cutover
    once real traffic and DSM's proxy are in the path, not a blocker here.
  - Migrations journal: `drizzle.__drizzle_migrations` = **2 applied** (Task 28's deploy report +
    reconfirmed unchanged after Task 29's `api` restart, proving the migrate-on-boot step
    correctly no-ops against the already-applied journal rather than reapplying/duplicating it).
- [x] **Data verified** (counts from Task 29 report; spot-check 3 posts)
  - Counts, old → new, exact match: `posts` 21→21, `users` 2→2, `post_translations` 25→25,
    `categories` 3→3, `post_categories` 21→21 (`docs/deploy/staging-log.md` § "Data migration").
  - Thumbnails: 39 files (18 root + 21 `originals/`) copied and cross-checked byte-for-byte
    against the old stack's `thumbnails/` dir; zero missing, zero extra against `posts
    .thumbnail_path` in the v2 db.
  - Spot-checked 3 posts by URL (SK + EN where translated): the Feb-2026 "AI experiment" finale
    post in both languages, plus the DevLog "Ako som postavil web" post — all render the correct
    real migrated title/content, view counts matching the legacy source exactly (0, not a
    migration artifact — genuinely low-traffic data).
- [x] **GHCR packages accessible from NAS** (pull succeeded in Task 28)
  - `docker compose pull` on `/volume1/docker/carnaby-sk-v2` anonymously pulled
    `ghcr.io/carnaby/carnaby-web:dev` and `ghcr.io/carnaby/carnaby-api:dev` with no
    authentication — packages are public (Task 27) — and the stack came up healthy on that pull.
    Re-confirmed indirectly by this task: `carnaby-web`/`carnaby-api` are still the pulled images,
    running healthy, uninterrupted since.
- [x] **Backup of the OLD (v1) database taken today** (Task 30, this task)

  ```bash
  ssh -p 2222 carnaby@192.168.1.41 "/usr/local/bin/docker exec carnaby-db pg_dump -U carnaby -d carnaby | gzip > /volume1/docker/carnaby-sk-v2/pre-cutover-v1-backup-\$(date +%F).sql.gz"
  ```

  - **Written to `/volume1/docker/carnaby-sk-v2/pre-cutover-v1-backup-2026-07-10.sql.gz`** on the
    NAS — deliberately *not* the old stack's own directory (per this task's explicit instruction,
    a deviation from the plan's literal text, which suggested `/volume1/docker/carnaby-sk/...`) —
    so the backup lives under the v2 project's own directory tree, which this task is allowed to
    write to, rather than adding an out-of-scope write inside the old stack's directory.
  - Size: **59,711 bytes** (gzip) on the NAS. `gzip -t` → OK. Uncompressed: 856 lines, 8 `COPY ...
    FROM stdin` blocks — the same shape as every prior dump of this database this week (Tasks 24,
    28, 29), confirming a clean, complete dump.
  - Local copy fetched to `tools/migrate-legacy/data/pre-cutover-v1-backup-2026-07-10.sql.gz`
    (gitignored, not committed) via `scp -O -P 2222` — **59,711 bytes, byte-identical** to the NAS
    copy; `gzip -t` OK locally too.
  - The old stack (`carnaby-sk`, `carnaby-db`, `carnaby-umami`, `carnaby-watchtower`) was only
    ever read from (`pg_dump`) — confirmed still "Up 8 days (healthy)", unchanged, immediately
    after.

## Owner action required (not closeable by this task)

- [ ] **Add both Google OAuth redirect URIs** in Google Cloud Console (APIs & Services →
  Credentials → the OAuth 2.0 Client ID used by `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`):
  - `http://localhost:3000/api/auth/callback/google`
  - `https://carnaby.sk/api/auth/callback/google`
- [ ] **Test Google login end-to-end** — AFTER the URIs above are added. Staging is reachable
  only as `http://192.168.1.41:3200` (bare LAN IP + non-standard port), and **Google will not
  redirect an OAuth callback to a bare IP:port** — a redirect URI has to be one of the two exact
  values registered above. That makes a login test *against staging itself* impossible as
  configured today. Two honest options, both valid, pick whichever fits:
  1. **Test locally**, right now, before cutover: run the local dev stack (`pnpm dev`, `.env`'s
     `GOOGLE_CLIENT_ID`/`SECRET` pointed at the real credentials instead of dev placeholders),
     sign in via Google at `http://localhost:3000`, confirm `dodusik@gmail.com` lands with
     `role=admin` (per `ADMIN_EMAILS`) and `/admin` is reachable. This validates the OAuth
     wiring and the admin-role-by-email logic end-to-end, just not against the exact staging
     deployment.
  2. **Test right after cutover**, on the real domain: once Task 31 Step 3 flips the DSM reverse
     proxy so `https://carnaby.sk` points at the v2 stack, the `https://carnaby.sk/...` redirect
     URI becomes reachable for the first time and login can be tested for real, immediately, as
     part of Task 31's own "verify" step. This is the option the plan originally assumed
     (`docs/deploy/nas-runbook.md`'s DSM cutover section already says "Immediately verify ...
     Google login works").

  Neither option is a substitute for the other — (1) proves the OAuth flow and admin-role logic
  work at all, ahead of cutover, with zero production risk; (2) proves it works on the exact
  domain end users hit, but only after the point of no easy return. Doing (1) before Task 31 and
  (2) as part of Task 31's own verification is the safest combination, and does not block Task 31
  from starting on its own — Task 31's rollback path (proxy back to `:3000`) already covers the
  case where (2) fails.
- [ ] **Final go/no-go** — owner confirms all boxes above (including the two just above) and
  explicitly approves proceeding to Task 31. Per the plan, Task 31 additionally requires **explicit
  owner approval before each of its own steps**, not just one approval up front.

## Task 31 (cutover) — summary, owner-gated

Full detail: plan `docs/superpowers/plans/2026-07-06-carnaby-v2-implementation.md` (Task 31
section) and `docs/deploy/nas-runbook.md` ("DSM reverse-proxy cutover" + "Rollback"). Not
performed by this task — Task 30 only prepares and verifies; summarized here so this checklist is
a self-contained pre-flight to hand off:

1. **Promote branch**: `git checkout main && git merge --ff-only v2 && git push origin main`. CI
   then publishes `:latest` images. Verify on GitHub that only the new `CI` workflow ran on
   `main` (the old `Build and Push Docker Image` workflow no longer exists on `main` after the
   merge).
2. **Switch the NAS stack to `:latest`**: edit `/volume1/docker/carnaby-sk-v2/.env`'s `TAG` from
   `dev` to `latest`, then `ssh ... "cd /volume1/docker/carnaby-sk-v2 && docker compose pull &&
   docker compose up -d"`.
3. **Owner switches the DSM reverse proxy**: `carnaby.sk` → `localhost:3200` (Control Panel →
   Login Portal → Advanced → Reverse Proxy), replacing the current `localhost:3000` rule.
   Immediately verify `https://carnaby.sk`: public pages load, Google login works (see "Owner
   action" above, option 2), `/admin` is reachable and correctly gated, Umami events are arriving
   for the new site.
4. **Rollback path, if anything fails**: switch the DSM proxy rule back from `:3200` to `:3000`.
   The old stack is untouched and still running throughout cutover — this is a pure proxy-config
   revert, no container changes needed on either stack.
5. **Post-cutover** (after the owner confirms stability, target ≥1 week): stop the old
   `carnaby-sk` container (keep `carnaby-db` running — Umami's database lives in the same
   container; only the old `carnaby` database *inside* it becomes dormant), disable the
   Watchtower label on the now-stopped container (moot once stopped), schedule
   `backup-db-v2.sh` in DSM Task Scheduler (owner; daily, same cadence as v1's existing job),
   remove the old `carnaby` database only after another verified backup, update the README on
   `main` with the v2 architecture, and optionally drop the `?language=` redirect after 6 months.

## Evidence index

| Item | Where |
|---|---|
| Staging deploy (Task 28) | `docs/deploy/staging-log.md` §§ "Attempt 1" / "Attempt 2" |
| Data migration + thumbnails (Task 29) | `docs/deploy/staging-log.md` § "Data migration" |
| NAS operational reference | `docs/deploy/nas-runbook.md` |
| e2e-vs-staging config changes (Task 30) | `apps/web-e2e/playwright.config.mts`, `apps/web-e2e/src/global-setup.ts`, `apps/web-e2e/src/fixtures/env.ts`, and the `home.spec.ts`/`category.spec.ts`/`post.spec.ts`/`admin-*.spec.ts` doc comments |
| This task's own e2e-vs-staging run, log scan, and DB backup | this file, § "Pre-cutover gates" above |
