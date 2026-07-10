# NAS deployment runbook — carnaby.sk v2

Operational reference for running the v2 stack (`web` + `api` + `db`) on the Synology NAS,
alongside the still-live v1 stack, until cutover (plan Task 31). Written during Task 26 (pure
file authoring, no NAS access); the commands below are exercised for real in Tasks 28-31.

NAS access: `ssh -p 2222 carnaby@192.168.1.41`. **Non-interactive shells (ssh single-command,
DSM Task Scheduler, cron) have `PATH=/usr/bin:/bin:/usr/sbin:/sbin`, which excludes
`/usr/local/bin`** — that's where Synology Container Manager symlinks `docker`. Every command
below that runs non-interactively uses the absolute path `/usr/local/bin/docker` (Task 24
finding). If you're at an interactive DSM shell where `docker` already resolves, the bare command
works too; the absolute path is always safe either way.

## Directory layout

```
/volume1/docker/carnaby-sk-v2/
├── docker-compose.yml      # = docker/docker-compose.nas.yml from the repo, scp'd over
├── backup-db-v2.sh         # = docker/backup-db-v2.sh from the repo, scp'd over
├── .env                    # NOT in git — created on the NAS from docker/.env.nas.example
├── db/                     # postgres data dir (bind mount)
├── uploads/                # api UPLOADS_DIR (bind mount)
└── cache/                  # api CACHE_DIR — resized image cache (bind mount)
```

The old v1 stack lives alongside this, untouched, at `/volume1/docker/carnaby-sk/` (containers
`carnaby-sk`, `carnaby-db`, plus Umami — `carnaby-db` also hosts the Umami database and must
stay running even after v2 cutover). v1's own backup destination is
`/volume1/private/clouds/GoogleDrive/carnaby_sk/backups` — v2 shares that same directory (see
`backup-db-v2.sh`'s header comment) with a distinct `carnaby-v2-*` filename prefix so the two
scripts' 30-day prunes never collide.

Containers, ports, images:

| Container | Image | Port (host:container) | Notes |
|---|---|---|---|
| `carnaby-web` | `ghcr.io/carnaby/carnaby-web:${TAG}` | `3100:3000` | staging port; becomes the public port only after DSM reverse-proxy cutover |
| `carnaby-api` | `ghcr.io/carnaby/carnaby-api:${TAG}` | internal only (`api:3001` on the `carnaby-v2` bridge network) | not published to the host |
| `carnaby-db-v2` | `postgres:17-alpine` | internal only (`db:5432`) | not published to the host |

## First deploy (Task 28)

Run from the repo root, on the machine with SSH/SCP access to the NAS (not on the NAS itself):

```bash
# 1. Create the NAS directory tree
ssh -p 2222 carnaby@192.168.1.41 "mkdir -p /volume1/docker/carnaby-sk-v2/{db,uploads,cache}"

# 2. Copy the compose file and backup script (note the compose file is renamed on arrival)
scp -P 2222 docker/docker-compose.nas.yml carnaby@192.168.1.41:/volume1/docker/carnaby-sk-v2/docker-compose.yml
scp -P 2222 docker/backup-db-v2.sh carnaby@192.168.1.41:/volume1/docker/carnaby-sk-v2/
ssh -p 2222 carnaby@192.168.1.41 "chmod +x /volume1/docker/carnaby-sk-v2/backup-db-v2.sh"

# 3. Look up the two secrets values need to fill in .env
openssl rand -hex 32   # -> DB_PASSWORD
openssl rand -hex 32   # -> BETTER_AUTH_SECRET

# 4. Read the Google OAuth creds out of the OLD stack's env (read-only, does not touch the old stack)
ssh -p 2222 carnaby@192.168.1.41 "grep GOOGLE /volume1/docker/carnaby-sk/.env"

# 5. Write /volume1/docker/carnaby-sk-v2/.env on the NAS via heredoc over ssh (never commit this
#    file — it is the filled-in version of docker/.env.nas.example, with the two openssl values
#    from step 3 and the two GOOGLE_* values from step 4 substituted in)
ssh -p 2222 carnaby@192.168.1.41 "cat > /volume1/docker/carnaby-sk-v2/.env" <<'EOF'
TAG=dev
APP_URL=https://carnaby.sk
DB_PASSWORD=<paste from step 3>
BETTER_AUTH_SECRET=<paste from step 3>
GOOGLE_CLIENT_ID=<paste from step 4>
GOOGLE_CLIENT_SECRET=<paste from step 4>
ADMIN_EMAILS=dodusik@gmail.com
UMAMI_WEBSITE_ID=0733e169-1bc1-4990-a65f-2442fbb00237
EOF
ssh -p 2222 carnaby@192.168.1.41 "chmod 600 /volume1/docker/carnaby-sk-v2/.env"

# 6. Pull the images and bring the stack up
ssh -p 2222 carnaby@192.168.1.41 "cd /volume1/docker/carnaby-sk-v2 && /usr/local/bin/docker compose pull && /usr/local/bin/docker compose up -d && /usr/local/bin/docker compose ps"
```

If `docker compose` (the v2 plugin syntax) is unavailable on this DSM version, fall back to the
legacy binary: `/usr/local/bin/docker-compose` in place of `/usr/local/bin/docker compose`. If any
step above reports permission denied, prefix the `docker`/`docker-compose` invocation with `sudo`.

Expected: 3 containers running, `carnaby-api` reports healthy after ~20s (drizzle migrations run
on api boot — confirm via the logs command below), `carnaby-web` reports healthy shortly after
(depends on api's healthcheck). Smoke-test from the NAS itself before touching DNS/proxy:

```bash
ssh -p 2222 carnaby@192.168.1.41 "wget -qO- http://localhost:3100/api/health && wget -qO- http://localhost:3100 | head -c 300"
```

At this point content/categories are still empty — real data arrives via the migration in Task
29. An empty-but-rendering homepage and a healthy `/api/health` are the expected state here, not
a bug.

## Rolling updates (new image, same TAG — Watchtower)

Both `web` and `api` carry `labels: ['com.centurylinklabs.watchtower.enable=true']`. Watchtower is
the **existing** container from the old stack (no new watchtower service in this compose file) —
it already polls GHCR and will pull+recreate `carnaby-web`/`carnaby-api` automatically whenever a
new image is pushed to the SAME tag (`:dev` while staging, `:latest` after cutover). No manual
action needed for same-tag updates; this is the normal day-to-day path once CI (Task 27) is
publishing on every push.

## Manual update (tag change, e.g. `dev` → `latest` at cutover, or a forced re-pull)

```bash
# on the NAS, after editing .env's TAG=... to the desired value
ssh -p 2222 carnaby@192.168.1.41 "cd /volume1/docker/carnaby-sk-v2 && /usr/local/bin/docker compose pull && /usr/local/bin/docker compose up -d && /usr/local/bin/docker compose ps"
```

`docker compose pull` re-reads `${TAG:-dev}` from `.env`, so changing `TAG` and re-running this is
also how you roll forward or pin to a specific build without waiting for Watchtower.

## Logs

```bash
ssh -p 2222 carnaby@192.168.1.41 "/usr/local/bin/docker logs carnaby-api"      # api: startup, migrations, request errors
ssh -p 2222 carnaby@192.168.1.41 "/usr/local/bin/docker logs carnaby-web"      # web: Next.js server log
ssh -p 2222 carnaby@192.168.1.41 "/usr/local/bin/docker logs carnaby-db-v2"    # postgres log
```

Add `-f` to follow, `--tail 200` to limit. `docker compose ps` (run from
`/volume1/docker/carnaby-sk-v2`) shows each container's current health status at a glance.

## Healthchecks

| Service | Where defined | Check |
|---|---|---|
| `web` | baked into the image (`docker/web.Dockerfile` `HEALTHCHECK`) — no override in the compose file | `wget -qO- http://127.0.0.1:3000` inside the container |
| `api` | `docker/docker-compose.nas.yml` `api.healthcheck` | `wget -qO- http://localhost:3001/api/health` inside the container |
| `db` | `docker/docker-compose.nas.yml` `db.healthcheck` | `pg_isready -U carnaby -d carnaby` |

`web` won't start serving traffic from compose's perspective until `api` reports healthy
(`depends_on: { api: { condition: service_healthy } }`), and `api` waits on `db` the same way.

## Rollback (bad deploy on the current TAG)

Pin `.env`'s `TAG` to the last known-good value (a short sha tag published by CI, e.g.
`dev-<sha>` while staging, or `<sha>` after cutover — see Task 27's tagging scheme) and re-run the
manual update:

```bash
ssh -p 2222 carnaby@192.168.1.41 "cd /volume1/docker/carnaby-sk-v2 && sed -i 's/^TAG=.*/TAG=<old-sha>/' .env && /usr/local/bin/docker compose pull && /usr/local/bin/docker compose up -d"
```

Watchtower will not fight this: it only follows the tag currently referenced by the running
container, so pinning to a sha tag effectively opts that service out of automatic updates until
`TAG` is changed back to `dev`/`latest`.

## DSM reverse-proxy cutover (owner action, Task 31 — STOP for explicit approval before this step)

Until cutover, `carnaby.sk` in DSM's reverse proxy (Control Panel → Login Portal → Advanced →
Reverse Proxy) points at the OLD stack's port `3000`. The v2 stack is reachable only on `3100`
(LAN/staging) until this step.

1. **Cutover:** in DSM, change the reverse-proxy rule's destination port from `3000` to `3100`.
   Immediately verify `https://carnaby.sk`: public pages load, Google login works, `/admin` is
   reachable and gated correctly, Umami events are arriving for the new site.
2. **Rollback (if anything fails):** change the destination port back from `3100` to `3000`. The
   old stack is untouched and still running the whole time — this is a pure proxy-config revert,
   no container changes needed on either stack.

## Backups

`backup-db-v2.sh` (deployed to `/volume1/docker/carnaby-sk-v2/backup-db-v2.sh`) dumps
`carnaby-db-v2`'s `carnaby` database to
`/volume1/private/clouds/GoogleDrive/carnaby_sk/backups/carnaby-v2-<timestamp>.sql.gz` and prunes
files older than 30 days. Not scheduled automatically by this task — per the plan (Task 31, Step
5), the owner schedules it in DSM Task Scheduler (daily, same cadence as v1's existing
`backup-db.sh` job) once the v2 stack is the production stack. Until then it can be run manually
for an ad-hoc backup:

```bash
ssh -p 2222 carnaby@192.168.1.41 "/volume1/docker/carnaby-sk-v2/backup-db-v2.sh"
```

## Related docs

- `docs/deploy/migration-rehearsal.md` — Task 24's dry-run of the legacy data migration.
- `docs/superpowers/plans/2026-07-06-carnaby-v2-implementation.md` — full plan; Tasks 27-31 cover
  CI image publishing, this stack's actual first deploy, production data migration, staging
  verification, and the gated cutover itself.
