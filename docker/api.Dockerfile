FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# This is a single-package pnpm workspace: pnpm-workspace.yaml lists apps/* and packages/* as
# member globs, but none of them ship their own package.json -- every real dependency lives in
# the root package.json (confirmed via pnpm-lock.yaml's `importers:`, which has only the `.`
# entry). So there is nothing per-app to COPY before `pnpm install`; the root manifest is the
# whole workspace.
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm nx build @carnaby/api

# @nx/webpack's NxAppWebpackPlugin (apps/api/webpack.config.js has `generatePackageJson: true`)
# builds to `dist/apps/api` (NOT `apps/api/dist` -- that's this repo's actual Nx output path,
# see webpack.config.js's `output.path`) and, because it *bundles* the api into one `main.js`
# (TS `@carnaby/db`/`@carnaby/shared` are tsconfig path aliases, not real packages -- webpack
# inlines their source, so they never show up as runtime deps), it also emits a package.json
# there containing only the real npm packages the bundle actually calls `require()` on
# (@nestjs/*, better-auth, drizzle-orm, pg, sharp, multer, @trpc/server, zod, express,
# reflect-metadata, rxjs, dotenv) plus a lockfile pruned to match. That replaces the brief's
# `pnpm --filter @carnaby/api deploy --prod /out` entirely -- `deploy --filter` needs a real
# per-app package.json/importer, which doesn't exist here. Copying dist/apps/api out to /out
# (rather than `pnpm install`-ing in place under /repo/dist/apps/api) matters too: /out has no
# pnpm-workspace.yaml in any parent directory, so `pnpm install` there treats it as the
# standalone project it is instead of re-resolving against the monorepo root's lockfile.
RUN mkdir -p /out \
 && cp -r dist/apps/api/. /out/ \
 && mkdir -p /out/migrations \
 && cp -r packages/db/migrations/* /out/migrations/
WORKDIR /out
# Installed fresh on this alpine base (not copied from a Windows host) so sharp's postinstall
# fetches/builds its linux-musl binary; /out/package.json's `pnpm.onlyBuiltDependencies` (carried
# over verbatim from the root by Nx's generator) still makes that build script run.
RUN pnpm install --prod --frozen-lockfile

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out ./
ENV MIGRATIONS_DIR=/app/migrations
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1
CMD ["node", "main.js"]
