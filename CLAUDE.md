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

## Memory (Tabula)
Tabula keeps this project's files that are not in git (handoff state, private specs and plans) and the global rules that apply to every project.
- This project's Tabula project is `carnaby-sk`; `.tabula.json` says which untracked files are synced.
- At session start call `recall` for `carnaby-sk` with `include_state: false` and follow the global rules. The project state is on disk (restored by the SessionStart hook).
- At handoff run `tabula push` after writing the state file.
- If the `tabula` command is not available (Claude Code on the web, claude.ai), the files are not on disk: call `recall` with `include_state: true`, read files with `read_file`, and save every new or changed synced file (spec, plan, `progress.md`, handoff state) with `write_file`.
- Never write project memories. Add a global rule only when the user explicitly asks.
