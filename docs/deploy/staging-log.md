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
