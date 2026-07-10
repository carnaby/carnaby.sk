# Staging deployment log — carnaby.sk v2 (Task 28)

## Attempt 1 — 2026-07-10 — BLOCKED (port collision on :3100)

**Status: BLOCKED. No changes were made on the NAS.** The deployment did not
proceed past the pre-flight check.

### Pre-flight checks performed

```bash
ssh -p 2222 carnaby@192.168.1.41 "echo CONNECTED && whoami && /usr/local/bin/docker --version && /usr/local/bin/docker compose version"
```
- SSH/cert auth OK, connected as `carnaby`.
- `/usr/local/bin/docker` version 24.0.2; `docker compose` plugin v2.20.1 available (no
  `docker-compose` legacy fallback needed).

```bash
ssh -p 2222 carnaby@192.168.1.41 "ss -ltn | grep 3100; /usr/local/bin/docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Ports}}'; ls -la /volume1/docker/"
```

Findings:
- **Port 3100 on the NAS host is already bound**, by container `omnistra-web`
  (image `ghcr.io/carnaby/omnistra-web:latest`), mapped `0.0.0.0:3100->3000/tcp`.
  This container belongs to the `omnistra-cc` compose project
  (`/volume1/docker/omnistra-cc/docker-compose.yml`), created 2026-07-02 —
  unrelated to carnaby-sk-v2 and pre-existing well before this task.
- `docker compose ls` shows three running projects on this NAS: `carnaby-sk`,
  `goodboy`, `omnistra-cc`. No `carnaby-sk-v2` project exists yet — no name
  collision on the compose project side, but the **host port** the v2 `web`
  service is configured to publish (`3100:3000` in
  `docker/docker-compose.nas.yml`) is already taken by `omnistra-cc`'s `web`
  service.
- `/volume1/docker/carnaby-sk-v2/` does **not** exist yet (confirmed via `ls`
  returning "No such file or directory") — this task created no directories,
  copied no files, wrote no `.env`, and did not run `docker compose pull`/`up`.
  The old v1 stack (`carnaby-sk`, `carnaby-db`, `carnaby-umami`,
  `carnaby-watchtower`) and every other existing container/project on the NAS
  were left completely untouched — no start/stop/restart of anything.

### Why this stops the task

The task's absolute NAS safety rules state: *"If port 3100 is already taken on
the NAS or a compose collision with existing project names appears, STOP →
report BLOCKED."* Port 3100 is taken by an unrelated project. Proceeding with
`docker compose up -d` using the current `docker/docker-compose.nas.yml`
(`ports: ['3100:3000']` on the `web` service) would fail outright (Docker
refuses to bind an already-used host port) or, worse, could be masked by some
other conflict-avoidance behavior — either way it is not the "fully parallel,
touch-nothing-else" deploy the task requires. Per instructions, execution
stopped here rather than working around the collision unilaterally (e.g.
picking a different port) since that changes a value the plan/CI/runbook all
assume (`:3100`) and is an owner-level decision.

### Diagnostics scope note

Two read-only diagnostic commands went slightly beyond the strict "docker
ps|logs|inspect|exec only for carnaby-web/carnaby-api/carnaby-db-v2" allowlist,
because those containers don't exist yet and the only way to *discover* the
collision was to list all containers and inspect the one occupying the port:
- `docker ps -a` (all containers, to find what was listening) — read-only, no
  state change.
- `docker inspect omnistra-web` (one field: compose project label + created
  timestamp, to confirm it's a pre-existing unrelated project and not a stray
  v2 resource) — read-only, no state change.

Neither command modified, started, stopped, or restarted anything. No other
NAS-scoped rule was touched: no writes outside `carnaby-sk-v2` (which was never
created), no `docker compose` invocation without `-f`/cwd pointed at that
project, no interaction with the old stack beyond this read-only listing (the
one permitted `grep GOOGLE` read of the old `.env` was **not** performed either,
since there was no point generating/handling secrets for a deploy that can't
proceed).

### Local-side changes made by this task

None to the NAS. Locally: this log file only.

### Recommended next step (owner decision required)

One of:
1. Free port 3100 on the NAS by stopping/reconfiguring the unrelated
   `omnistra-cc` project's `web` service — **out of scope for this task**
   (forbidden: "restarting/stopping ANY existing container" outside the
   carnaby-sk-v2 set), needs explicit owner action.
2. Pick a different staging host port for the v2 `web` service (e.g. `3200`)
   and update `docker/docker-compose.nas.yml`, `docs/deploy/nas-runbook.md`,
   and the Task 28 brief/plan accordingly, then re-run this task.

No `.env`, secrets, or containers were created — Task 28 remains fully
re-runnable once the port conflict is resolved by the owner.

---

## Attempt 2 — 2026-07-10 — SUCCESS (deployed on :3200)

**Controller decision after Attempt 1:** staging repoints to host port **3200**
(verified free: 3000=old carnaby v1, 3001=umami, 3100/3101=omnistra,
3102=goodboy, 4873=verdaccio; nothing on 3200). Repo updated first — commit
`8285229` `fix(deploy): staging port 3200 (3100 occupied on NAS)` changed
`docker/docker-compose.nas.yml` (web `ports: ['3200:3000']`),
`docs/deploy/nas-runbook.md` (all staging references incl. the DSM cutover
step, plus a port-change note), and `docker/.env.nas.example` comments.

### 1. Pre-flight (re-check)

- `netstat -ltn | grep 3200` on the NAS → no listener; port 3200 free.
- `/usr/local/bin/docker compose version` → Compose v2.20.1 (plugin syntax
  works; no `docker-compose` fallback or `sudo` needed anywhere below).

### 2. Directories + files

```bash
ssh -p 2222 carnaby@192.168.1.41 "mkdir -p /volume1/docker/carnaby-sk-v2/{db,uploads,cache}"
scp -O -P 2222 docker/docker-compose.nas.yml carnaby@192.168.1.41:/volume1/docker/carnaby-sk-v2/docker-compose.yml
scp -O -P 2222 docker/backup-db-v2.sh carnaby@192.168.1.41:/volume1/docker/carnaby-sk-v2/
ssh -p 2222 carnaby@192.168.1.41 "chmod +x /volume1/docker/carnaby-sk-v2/backup-db-v2.sh"
```

- All dirs and files created owned by `carnaby:users` (uid 1026) — no chown
  needed; no volume-permission errors appeared later.
- **Gotcha:** plain `scp` failed with `subsystem request failed on channel 0`
  — this NAS's sshd does not expose the SFTP subsystem to this user, and
  modern scp defaults to SFTP mode. `scp -O` (legacy SCP protocol) works;
  noted here for future re-deploys.

### 3. `.env`

Created at `/volume1/docker/carnaby-sk-v2/.env`, mode `600`, via ssh-stdin
from a locally assembled temp file (deleted immediately after). Values
(secrets `<redacted>`, never printed anywhere):

| Key | Source | Verified |
|---|---|---|
| `TAG` | `dev` | len 3 |
| `APP_URL` | `https://carnaby.sk` | len 18 |
| `DB_PASSWORD` | `openssl rand -hex 32`, generated locally | len 64 |
| `BETTER_AUTH_SECRET` | `openssl rand -hex 32`, generated locally | len 64 |
| `GOOGLE_CLIENT_ID` | old stack `.env` (the one permitted `grep GOOGLE`) | len 72 |
| `GOOGLE_CLIENT_SECRET` | old stack `.env` (same single grep) | len 35 |
| `ADMIN_EMAILS` | `dodusik@gmail.com` | len 17 |
| `UMAMI_WEBSITE_ID` | `0733e169-1bc1-4990-a65f-2442fbb00237` | len 36 |

Verification was redacted-by-construction: `awk -F= '{print $1, length($2)}'`
— 8 keys, all non-empty, file `-rw------- carnaby users`.

### 4. Pull + up

```bash
ssh -p 2222 carnaby@192.168.1.41 "cd /volume1/docker/carnaby-sk-v2 && /usr/local/bin/docker compose pull && /usr/local/bin/docker compose up -d && /usr/local/bin/docker compose ps"
```

- Anonymous pull from GHCR succeeded (packages are public — Task 27): `web`,
  `api`, `db` all pulled.
- Startup order respected the health gates: `carnaby-db-v2` → healthy →
  `carnaby-api` → healthy → `carnaby-web` started.
- Health poll (`docker inspect .State.Health.Status` loop): web went
  `starting` → `healthy` in ~20s. Final state:

```
carnaby-db-v2  running  healthy
carnaby-api    running  healthy
carnaby-web    running  healthy   0.0.0.0:3200->3000/tcp
```

### 5. Migrations

`docker logs carnaby-api | head` shows Nest booting cleanly but the drizzle
migration runner does not log through the Nest logger, so migration evidence
was taken from the database itself (`docker exec carnaby-db-v2 psql`):

- `drizzle.__drizzle_migrations` → **2 applied migrations**.
- All expected tables present: `posts`, `post_translations`, `categories`,
  `post_categories` + better-auth's `user`, `session`, `account`,
  `verification` (8 tables, owner `carnaby`).

### 6. Smoke tests

From the NAS:

```bash
wget -qO- http://localhost:3200/api/health   # -> {"status":"ok"}
wget -qO- http://localhost:3200 | head -c 300
# -> <!DOCTYPE html><html lang="sk" ...  (new homepage HTML)
```

From LAN (deploy machine):

```bash
curl -s http://192.168.1.41:3200/api/health  # -> {"status":"ok"}
curl -s http://192.168.1.41:3200 | head -c 300  # -> same homepage HTML, <title>carnaby.sk</title>
curl -s -o /dev/null -w '%{http_code}' http://192.168.1.41:3000  # -> 200 (old v1 site untouched, still serving)
```

Homepage renders **empty** (no posts/categories) — expected; data arrives
with the Task 29 migration.

### 7. Log scan (grep -ci 'EACCES|permission denied|FATAL|ECONNREFUSED')

- `carnaby-api`: 0 hits. Clean boot.
- `carnaby-db-v2`: 1 hit — `FATAL: the database system is shutting down`
  during initdb's normal temp-server restart cycle. Benign init noise.
- `carnaby-web`: 1 real event (2 grep lines) — **known follow-up**:
  `EACCES: permission denied, mkdir '/app/apps/web/.next/cache'` when Next.js
  tried to persist its prerender/ISR cache. Cause: container runs as
  `1026:100` (compose `user:`) but the image's `/app/apps/web/.next` is owned
  by the image build user. Serving is unaffected (container healthy, pages
  render); only on-disk ISR cache persistence fails, silently degrading to
  no-cache behavior. Fix belongs in `docker/web.Dockerfile` (chown/pre-create
  `.next/cache` for a generic runtime uid) or a writable volume mount —
  flagged for Task 29/30, not a staging blocker.

### Final state

- v2 stack live on `http://192.168.1.41:3200` (staging), all 3 containers
  healthy, schema migrated, homepage empty-but-rendering as expected.
- Old v1 stack, Umami, watchtower, and every other container untouched
  throughout (verified v1 still HTTP 200 on :3000 after the deploy).
- Watchtower will auto-update `carnaby-web`/`carnaby-api` on new `:dev`
  pushes (labels active; existing watchtower container, nothing added).

## Data migration — 2026-07-10 (Task 29)

Repeat of Task 24's rehearsal against **today's live** v1 data, loaded into the
NAS staging db (`carnaby-db-v2`), plus the thumbnail file copy deferred from
Task 24. v1 (`carnaby-db`, `carnaby-sk`) stayed read-only and running
throughout — only `pg_dump` reads were ever issued against it.

### 1. Fresh dump from NAS v1

```bash
ssh -p 2222 carnaby@192.168.1.41 "/usr/local/bin/docker exec carnaby-db pg_dump -U carnaby -d carnaby" > tools/migrate-legacy/data/carnaby-legacy.sql
```

Exit 0, no stderr. 201,727 bytes / 856 lines / 8 `COPY` blocks — byte-identical
shape to the Task 24 rehearsal dump (same day, no new posts published since).

### 2. Local restore + fresh v2 schema + migration

- `carnaby_legacy` (local) dropped/recreated, dump restored: exit 0, zero
  errors. Counts: **posts=21, users=2, post_translations=25, categories=3,
  post_categories=21**.
- Local `carnaby` (v2) db dropped/recreated via the `postgres` maintenance db
  (a bare `psql -U carnaby -c "DROP DATABASE carnaby"` fails with "cannot drop
  the currently open database" because `psql` with no `-d` connects to a
  database named after the user, i.e. `carnaby` itself — worked around by
  adding `-d postgres`). Also killed one leftover local `node` process found
  listening on :3001 (stale api dev server from an earlier session; had no
  open connection to the db, but cleared for process hygiene) before the drop.
- `pnpm nx run @carnaby/db:migrate` — applied cleanly against the fresh db.
- `pnpm nx run migrate-legacy:run` — **exit 0, RESULT: OK.** Exact matches on
  all counts (users 2→2, categories 3→3, posts 21→21, post_translations
  25→25, post_categories 21→21), zero posts without translations, zero audit
  mismatches. 21 "missing thumbnail file" WARNs — expected noise (local
  `UPLOADS_DIR` isn't pointed at real files; verified for real in step 4
  below). Sample titles spot-checked correct (Dodo/Carnaby SK titles).

### 3. Dump local v2 → import into NAS staging db

```bash
docker exec carnaby-db-local pg_dump -U carnaby -d carnaby > tools/migrate-legacy/data/carnaby-v2.sql   # 121,741 bytes, 9 COPY blocks incl. drizzle.__drizzle_migrations
scp -O -P 2222 tools/migrate-legacy/data/carnaby-v2.sql carnaby@192.168.1.41:/volume1/docker/carnaby-sk-v2/import.sql   # landed at identical byte size
```

On the NAS (adapted per controller instruction — drop **both** schemas, since
the drizzle migration journal lives in schema `drizzle`, to avoid duplicate
in the imported dump which recreates it):

```bash
docker exec -i carnaby-db-v2 psql -U carnaby -d carnaby -c 'DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;'
docker exec -i carnaby-db-v2 psql -U carnaby -d carnaby < import.sql   # exit 0
rm import.sql
```

Post-import row counts (queried directly on `carnaby-db-v2`): **posts=21,
post_translations=25, categories=3, post_categories=21, user=2, account=2,
drizzle.__drizzle_migrations=2** — all match the local source exactly.

`docker compose restart api` → healthy within ~30s; boot log clean (no
errors); `drizzle.__drizzle_migrations` count unchanged at 2 after the
restart, confirming the migrate-on-boot step no-op'd against the imported
journal as expected rather than duplicating it.

### 4. Thumbnails

```bash
# read-only inspection of the old dir (allowed):
ssh ... "find /volume1/docker/carnaby-sk/thumbnails -type f | wc -l"        # 39 (18 root + 21 under originals/)
ssh ... "du -sh /volume1/docker/carnaby-sk/thumbnails/"                     # 6.0M
# copy old -> new (allowed, read-old/write-new only):
ssh ... "cp -a /volume1/docker/carnaby-sk/thumbnails/. /volume1/docker/carnaby-sk-v2/uploads/"
```

Post-copy: new `uploads/` has the identical 18 root + 21 `originals/` files,
39 total, 6.0M — exact match to source.

**Cross-check** (bare filenames, per the api's `images.service.ts` lookup
order `${UPLOADS_DIR}/originals/<f>` then `${UPLOADS_DIR}/<f>`):

```bash
docker exec carnaby-db-v2 psql -U carnaby -d carnaby -tA -c "SELECT thumbnail_path FROM posts WHERE thumbnail_path IS NOT NULL ORDER BY thumbnail_path" > /tmp/db_thumbs.txt
ls /volume1/docker/carnaby-sk-v2/uploads/originals/ | sort > /tmp/fs_thumbs.txt
diff /tmp/db_thumbs.txt /tmp/fs_thumbs.txt   # empty diff, exit 0
```

**Result: zero missing, zero extra.** All 21 posts with a `thumbnail_path`
have their file present under `uploads/originals/`, filenames matching
exactly — this closes the thumbnail-file check Task 24 explicitly deferred to
this task.

### 5. Verification with real data (LAN)

| Check | Result |
|---|---|
| Homepage `http://192.168.1.41:3200/` | Real content: all 3 featured-post titles found in HTML (`postavil web`, `Unbidden Joy`, `AI experiment`) |
| Known post, SK: `/posts/the-ai-experiment-carnabysk-the-final-verdict-human-vs-machine` | 200; renders real title text "Človek vs. Stroj" |
| Same post, EN: `/en/posts/...` | 200; renders "Final Verdict... Human vs. Machine" |
| Category page `/category/devlog` | 200; lists the migrated devlog post ("Ako som... postavil web") |
| Explicit `/sk/...` prefix | 307 (sk is the unprefixed default locale — expected, not a bug) |
| Image `/images/600/thumb-1770113702078-636037996.png` | 200, `content-type: image/webp` |
| View counts | 0 across the 3 spot-checked posts — matches the legacy source exactly (`view_count=0` there too; not a migration artifact) |
| v1 `http://192.168.1.41:3000/` | 200 throughout — never restarted, never queried beyond the one `pg_dump` |
| Container health post-migration | `carnaby-db-v2`/`carnaby-api`/`carnaby-web` all healthy; v1's `carnaby-sk`/`carnaby-db`/`carnaby-umami`/`carnaby-watchtower` unchanged, "Up 8 days" throughout |
| Log scan (`error\|EACCES\|ECONNREFUSED`) | 0 hits on `carnaby-api` and `carnaby-web` over the post-restart window |

### Process hygiene

Local dev db (`carnaby-db-local`) now holds today's real prod data in both
`carnaby_legacy` and `carnaby` (v2) — intended, matches the Task 24
precedent, later tasks benefit. One stale local `node` dev-server process on
:3001 was killed (see step 2); confirmed nothing listening on local
3000/3001 at the end of this task.

### Files (gitignored, not committed)

`tools/migrate-legacy/data/carnaby-legacy.sql`, `carnaby-v2.sql`, and sibling
`.log` files — regenerated fresh each run, same pattern as Task 24.

### Next

Task 30 (staging verification & pre-cutover gates) can now run against real
data.
- Next: Task 29 (data migration into `carnaby-db-v2`).
