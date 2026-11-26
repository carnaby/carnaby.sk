# carnaby.sk

Osobný web Jozefa Sokola (hudba Dodo/Carnaby, devlog): pnpm + Nx monorepo, Next.js 16 (`apps/web`),
NestJS + tRPC (`apps/api`), Drizzle/Postgres (`packages/db`), MCP server na správu obsahu.
Produkciu (server, compose, zálohy, reverse proxy) spravuje infra admin. Push na `main` sa cez CI (GHCR) do pár minút
nasadí do produkcie. Riadky so značkou `infra-admin (services)` nemeň. Podrobnosti o nasadení sú v `docs/` (mimo git),
nie v tomto verejnom repe.

## Dokumentácia

`docs/` nie je v gite. Je len v Tabula (projekt `carnaby-sk`) a na disk ju vráti `tabula pull`
(alebo SessionStart hook). Patrí sem história nasadenia a runbook z čias NAS (`docs/deploy/`), MCP (`docs/mcp.md`),
YouTube sync (`docs/youtube.md`), pôvodný spec a plán prepisu (`docs/superpowers/`) a znalosti agenta
(`docs/agents/`). Rozhodnutia z prepisu v2 sú v `.superpowers/sdd/progress.md` a `task-*-report.md`.
Nový alebo zmenený súbor v `docs/` ulož do Tabula (`tabula push`, na webe `write_file`).

## Handoff state (read at session start)
- Handoff state (gitignored, kept in Tabula): `docs/handoff/carnaby-sk-agent.md`
- Agent knowledge (gitignored, kept in Tabula): `docs/agents/carnaby-sk-agent.md`

The last session's handoff is imported below. Read it before answering anything, continue from its "Pokračuj tu"
section and check its "Overený stav" against reality before relying on it.

@docs/handoff/carnaby-sk-agent.md

If the import above is empty (Claude Code on the web, a fresh clone), the file is not on disk: before anything else
call `recall` for `carnaby-sk` with `include_state: true`, which returns it.

## Memory (Tabula)
Tabula keeps this project's files that are not in git (handoff state, private specs and plans) and the global rules
that apply to every project. This project's Tabula project is `carnaby-sk`; `.tabula.json` says which untracked files
are synced.
- At session start call `recall` for `carnaby-sk` and follow the global rules. With the files on disk (the
  SessionStart hook ran `tabula pull`) pass `include_state: false`.
- Without the `tabula` command (Claude Code on the web, claude.ai): read synced files with `read_file` and save every
  new or changed one (spec, plan, `progress.md`, handoff state) with `write_file`.
- At handoff run `tabula push` after writing the state file.
- Never write project memories. Add a global rule only when the user explicitly asks.
