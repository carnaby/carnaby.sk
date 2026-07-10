# Migration rehearsal — fresh NAS dump (Task 24)

**Date:** 2026-07-10
**Operator:** Claude Fable 5, on behalf of dodusik@gmail.com
**Branch:** `v2`
**Scope:** Rehearsal only. Production (the live v1 site + its database on the NAS) was
only ever read from via `pg_dump`; nothing on the NAS was written, restarted, or
otherwise touched. All restore/migrate/verify steps ran against the local dev
Postgres container (`carnaby-db-local`).

## 1. Pulling the dump

NAS reachability check (read-only):

```
ssh -p 2222 carnaby@192.168.1.41 "echo NAS_OK; hostname; date"
→ NAS_OK / CarnabyNAS / Fri Jul 10 18:41:06 CEST 2026
```

First attempt with the documented command failed — not a role/auth problem but a
`PATH` problem in the non-interactive ssh shell:

```
ssh -p 2222 carnaby@192.168.1.41 "docker exec carnaby-db pg_dump -U carnaby -d carnaby" > ...
→ sh: docker: command not found   (exit 127)
```

`ssh ... "echo \$PATH"` showed `/usr/bin:/bin:/usr/sbin:/sbin` — no `/usr/local/bin`.
A read-only `ls -la /usr/local/bin/docker` confirmed docker is a symlink at
`/usr/local/bin/docker -> /var/packages/ContainerManager/target/usr/bin/docker`
(Synology Container Manager) that just isn't on the non-interactive PATH. Re-ran
with the full path — still the single allowed `pg_dump` read, just invoked via its
absolute path instead of a bare name:

```
ssh -p 2222 carnaby@192.168.1.41 "/usr/local/bin/docker exec carnaby-db pg_dump -U carnaby -d carnaby" \
  > tools/migrate-legacy/data/carnaby-legacy.sql
```

Result: **exit 0**, no stderr, `-U carnaby` worked first try (no need for the
`-U umami` fallback).

- **Dump size:** 201,727 bytes (201.7 KB), 856 lines.
- **Sanity grep** (`grep -c -E 'INSERT|COPY'`): 8 matches — one `COPY ... FROM stdin` per table:
  `categories, post_categories, post_translations, posts, schema_migrations, session, users, videos`.
- **Header:** `-- Dumped from database version 15.15` / `pg_dump version 15.15`.
- No restrict/errors; the dump parses and restores cleanly (see §2).

Dump and all intermediate logs live under `tools/migrate-legacy/data/` (gitignored,
not committed):
`carnaby-legacy.sql`, `dump.stderr.log` (empty), `restore.log`, `migrate-run-1.log`,
`migrate-run-2-idempotency.log`.

## 2. Restoring locally

```
docker exec carnaby-db-local psql -U carnaby -c "DROP DATABASE IF EXISTS carnaby_legacy"
docker exec carnaby-db-local psql -U carnaby -c "CREATE DATABASE carnaby_legacy"
docker exec -i carnaby-db-local psql -U carnaby -d carnaby_legacy < tools/migrate-legacy/data/carnaby-legacy.sql
```

Restore completed with exit 0 and **zero errors** (`grep -i error restore.log` — no
matches); tail shows the expected `ALTER TABLE` / `CREATE INDEX` / `CREATE TRIGGER` /
`GRANT` sequence from the schema + FK/index setup.

Row counts in the freshly-restored `carnaby_legacy`:

| table              | count |
|--------------------|------:|
| `posts`            |    21 |
| `users`            |     2 |
| `post_translations`|    25 |
| `categories`       |     3 |
| `post_categories`  |    21 |
| `videos`           |    16 |

Other observations from eyeballing the live data before migrating:
- All 21 posts: `status = published`, `language = sk`.
- `post_translations`: 21 `sk` + 4 `en` rows (i.e. 4 posts have a real English
  translation row; the rest get their `en`... actually get only `sk`, since the
  legacy `posts.language` column is `sk` for all 21 and synthesis only fires for
  the post's own legacy language — see mapping notes below).
- 2 users: `dodusik@gmail.com` (role `admin`) and `lubica.sokolova@gmail.com` (role `user`).
- 3 categories: `Dodo` (id 1), `Carnaby` (id 2), `DevLog` (id 5) — ids are
  non-contiguous in the source (id 3/4 presumably deleted historically), which
  matters not at all since migration keys categories by `slug`, not `id`.
- Post id 21, slug `the-ai-experiment-carnabysk-the-final-verdict-human-vs-machine`,
  `published_at = 2026-02-03 10:15:09` — confirmed this is the "AI-experiment
  finale from Feb 2026" post referenced in the task brief.
- `videos` table (16 rows) is out of scope for `migrate-legacy` (no v2 equivalent
  table yet) — not migrated, not a defect.

## 3. Running the migration

```
pnpm nx run migrate-legacy:run
```

**Result: exit 0, RESULT: OK.** Full report (run 1):

```
migrate-legacy: postgres://carnaby:carnaby@localhost:5432/carnaby_legacy -> postgres://carnaby:carnaby@localhost:5432/carnaby
truncating target content + auth tables...
migrating categories...
migrating users + accounts...
migrating posts...
migrating post_translations...
migrating post_categories...
committed.

=== migrate-legacy report ===

-- counts (old -> new) --
  users                   2 ->      2
  categories              3 ->      3
  posts                  21 ->     21
  post_translations      25 ->     25
  post_categories        21 ->     21

-- audit: in-memory tally vs DB-queried count after commit (FAIL) --
  none

-- posts with zero translations (FAIL) --
  none

-- warnings --
  none

-- thumbnail files under UPLOADS_DIR/originals (WARN) --
  WARN missing file: yt-AMajbzPky6g.jpg (checked under .../tools/migrate-legacy/.data/uploads/originals)
  WARN missing file: yt-LKoc8cxeAjY.jpg (checked under .../tools/migrate-legacy/.data/uploads/originals)
  WARN missing file: yt-AVzGSWEkyeQ.jpg (checked under .../tools/migrate-legacy/.data/uploads/originals)
  WARN missing file: yt-zQeCIiAf0fY.jpg (checked under .../tools/migrate-legacy/.data/uploads/originals)
  WARN missing file: yt-vTHAbkEvymM.jpg (checked under .../tools/migrate-legacy/.data/uploads/originals)
  WARN missing file: yt-YJDaKFMqKfc.jpg (checked under .../tools/migrate-legacy/.data/uploads/originals)
  WARN missing file: yt-vFd6XrV4vRE.jpg (checked under .../tools/migrate-legacy/.data/uploads/originals)
  WARN missing file: yt-CqujYRiQo84.jpg (checked under .../tools/migrate-legacy/.data/uploads/originals)
  WARN missing file: yt-q76i5VstQOk.jpg (checked under .../tools/migrate-legacy/.data/uploads/originals)
  WARN missing file: yt-Z3OoP0LSeEc.jpg (checked under .../tools/migrate-legacy/.data/uploads/originals)
  WARN missing file: yt-2I_El8MJYXQ.jpg (checked under .../tools/migrate-legacy/.data/uploads/originals)
  WARN missing file: thumb-1769352222501-621919534.png (checked under .../tools/migrate-legacy/.data/uploads/originals)
  WARN missing file: yt-rde5giz3TGc.jpg (checked under .../tools/migrate-legacy/.data/uploads/originals)
  WARN missing file: yt-sj4UZDRy2W0.jpg (checked under .../tools/migrate-legacy/.data/uploads/originals)
  WARN missing file: yt-p1_pl_fIBiQ.jpg (checked under .../tools/migrate-legacy/.data/uploads/originals)
  WARN missing file: thumb-1770113702078-636037996.png (checked under .../tools/migrate-legacy/.data/uploads/originals)
  WARN missing file: yt-0l4kWpAK9p8.jpg (checked under .../tools/migrate-legacy/.data/uploads/originals)
  WARN missing file: yt-Hnabg1NAyKA.jpg (checked under .../tools/migrate-legacy/.data/uploads/originals)
  WARN missing file: yt-qeUB6Yj1PYo.jpg (checked under .../tools/migrate-legacy/.data/uploads/originals)
  WARN missing file: yt-QBLRyxhDCS4.jpg (checked under .../tools/migrate-legacy/.data/uploads/originals)
  WARN missing file: yt-HcxvUN3IvVg.jpg (checked under .../tools/migrate-legacy/.data/uploads/originals)

-- sample slugs (spot-check) --
  dodo-vtaci-v-klietke-melodic-rock-debut-single: sk="Dodo - Vtáci v klietke (Melodic Rock / Debut Single)"
  dodo-light-through-the-dark-classic-rock-hard-rock: sk="Dodo - Light Through The Dark (Classic Rock / Hard Rock)"
  carnaby-zmenila-si-moj-svet-80s-synth-pop: sk="Carnaby - Zmenila si môj svet (80s Synth-Pop)"

RESULT: OK
```

The thumbnail WARN block is **expected and deferred, not a defect**: `UPLOADS_DIR`
resolves relative to the tool's cwd (the `tsx src/migrate.ts` run's cwd is
`tools/migrate-legacy/`, per that target's `nx:run-commands` `cwd`), so it's
checking a local dev `.data/uploads/originals` directory that never received the
actual v1 thumbnail files — those live on the NAS's uploads volume and were
intentionally **not** fetched in this task (an `ssh ... ls`/`scp` of the uploads
directory isn't one of the two allowed NAS commands). Per the task brief, the
real thumbnail-file presence check is deferred to Task 29, run directly on the
NAS where the files actually live.

### Idempotency re-run

Re-ran the exact same command a second time against the now-migrated target db
to confirm the tool's truncate-then-rebuild transaction is safe to repeat (a
property the rehearsal specifically wanted to exercise against real data, not
just fixtures):

```
pnpm nx run migrate-legacy:run   # second run
→ exit 0, identical counts (2/3/21/25/21), identical sample slugs, RESULT: OK
```

No drift between run 1 and run 2 — confirms idempotency holds against the real
production dataset, not just the tool's unit-test fixtures.

## 4. Eyeballing the result in the running app

Started both dev servers (`pnpm dev` → `nx run-many -t dev -p @carnaby/web @carnaby/api`,
web on :3000, api on :3001) against the now-migrated local `carnaby` db.

**Homepage** (`GET http://localhost:3000/`) — HTTP 200. "Vybrané príspevky"
(featured posts) section renders exactly the 3 real `is_featured = true` posts,
with real SK titles:
- *AI experiment carnaby.sk: Záverečné zúčtovanie (Človek vs. Stroj)*
- *Dodo – Unbidden Joy | Uplifting Americana Rock for Road Trips*
- *Carnaby.sk: Ako som postavil web bez napísania jediného riadku kódu*

**Individual post pages** — all HTTP 200, real migrated titles rendered
(SK is the default locale and omits the `/sk` prefix, redirecting `/sk/posts/...`
→ `/posts/...` with a 307 + `NEXT_LOCALE` cookie, which is expected i18n routing
behavior, not a bug):

| URL | Status | `<h1>` |
|---|---|---|
| `/posts/dodo-vtaci-v-klietke-melodic-rock-debut-single` | 200 | Dodo - Vtáci v klietke (Melodic Rock / Debut Single) |
| `/posts/carnabysk-ako-som-postavil-web-bez-napisania-jedineho-riadku-kodu` | 200 | Carnaby.sk: Ako som postavil web bez napísania jediného riadku kódu |
| `/posts/the-ai-experiment-carnabysk-the-final-verdict-human-vs-machine` (SK) | 200 | AI experiment carnaby.sk: Záverečné zúčtovanie (Človek vs. Stroj) |
| `/en/posts/the-ai-experiment-carnabysk-the-final-verdict-human-vs-machine` (EN) | 200 | The AI Experiment carnaby.sk: The Final Verdict (Human vs. Machine) |

The Feb 2026 "AI experiment" finale post — called out explicitly in the task
brief — renders correctly in **both** SK and EN with distinct, correctly
translated titles.

**Admin posts table** — verified via direct psql counts against the target
`carnaby` db rather than through a signed-in admin session (per task guidance;
no need to fabricate an auth cookie for a read-only count check):

```
posts: 21   |   user: 2   |   post_translations: 25   |   categories: 3   |   post_categories: 21
```

All five match the migration report's post-commit counts exactly. Spot-checked
the full `posts` table by hand: all 21 rows have `status = published`, correct
`is_featured` flags on ids 18/20/21, thumbnail paths correctly stripped down to
their basename (e.g. `/thumbnails/yt-zQeCIiAf0fY.jpg` → `yt-zQeCIiAf0fY.jpg`), and
`author_id` on every post resolved to the single new mapped user id (all 21 posts
had the same legacy `author_id = 1`).

Also checked `post_categories` linkage by category: `dodo` = 13, `carnaby` = 6,
`devlog` = 2 (13 + 6 + 2 = 21, matching the post count — every post has exactly
one category). And confirmed the `account` table preserved the original Google
login identity: `account.account_id` for both users still holds their exact
legacy `google_id` (`103328467890835033747`, `105616719475584969700`), so
returning users will sign in with the same Google account after cutover.

Killed both dev servers afterward; confirmed nothing is `LISTENING` on 3000 or
3001.

## 5. Issues found on real data

**None.** Every mapping in Task 23's `tools/migrate-legacy/src/mapping.ts` held up
against the real v1 production dataset:
- No unsupported `language` values (all posts/translations were `sk`/`en`).
- No null `title`/`content` on any post used for synthesis.
- No orphaned `author_id`, `category_id`, or `post_id` foreign keys in
  `post_categories`/`post_translations`.
- No posts ended up with zero translations.
- Thumbnail paths were all Windows/Unix-style `/thumbnails/<name>` or bare
  filenames — `toBasename()` handled both.
- Two full runs (fresh + idempotent re-run) produced byte-identical counts and
  sample output.

No code changes were needed in `tools/migrate-legacy/`. Nothing to add to the
gate run (`pnpm nx run-many -t lint typecheck test build`) beyond what Task 23
already covers, since no mapping code changed.

## 6. Deferred items

- **Thumbnail file-existence check** (`UPLOADS_DIR` / `findMissingThumbnails`):
  the 21 `WARN missing file: ...` lines above are expected in this rehearsal —
  the actual image files live on the NAS's uploads volume, which this task
  deliberately did not read (only `docker exec carnaby-db pg_dump` is an allowed
  NAS command; listing/copying the uploads directory is not). **Deferred to
  Task 29**, which runs the real cutover on the NAS itself, where `UPLOADS_DIR`
  can point at the actual uploads volume and this check becomes meaningful.
- **`videos` table** (16 rows in the legacy db): has no v2 equivalent yet and is
  intentionally not migrated by `migrate-legacy`. Out of scope for this task;
  flagging here only so it isn't mistaken for a miscount later.

## Summary

| Metric | Value |
|---|---|
| Dump size | 201,727 bytes |
| Dump tables | categories, post_categories, post_translations, posts, schema_migrations, session, users, videos |
| posts (old → new) | 21 → 21 |
| users (old → new) | 2 → 2 |
| categories (old → new) | 3 → 3 |
| post_translations (old → new) | 25 → 25 |
| post_categories (old → new) | 21 → 21 |
| Migration exit code | 0 (both runs) |
| Migration result | OK (both runs) |
| Posts without translations | 0 |
| Audit mismatches | 0 |
| Spot-check (homepage + 4 post pages, SK+EN) | all 200, correct real titles |
| Mapping bugs found on real data | 0 |
| Production impact | none — NAS was read-only (`pg_dump`) throughout |
