FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# Same single-package-workspace situation as docker/api.Dockerfile: apps/web and packages/shared
# have no package.json of their own, so there's nothing per-app to COPY before install.
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# `output: 'standalone'` freezes next.config.js's `rewrites()` (which interpolates
# API_INTERNAL_URL into the /trpc, /api and /images proxy destinations) into
# `.next/required-server-files.json` at THIS build step -- the standalone bundle ships no
# next.config.js, so `server.js` reloads that frozen manifest at container start rather than
# re-running rewrites() against whatever env is set on the running container. The brief's compose
# sets API_INTERNAL_URL as a *runtime* env var on the web service, which -- verified by building
# locally without it set and grepping the resulting required-server-files.json -- has no effect
# once the image is built: it must be a build ARG instead. APP_URL feeds the same
# build-time-frozen path for the statically-generated /robots.txt and /sitemap.xml (both "○
# Static" in the build output), so it gets the same treatment; the app's other, dynamically
# rendered ("ƒ") reads of APP_URL (post pages, canonical/OG URLs) do read the container's runtime
# env correctly and don't need this. NOTE the build args do not REPLACE the runtime env vars --
# `lib/trpc-server.ts`/`lib/session.ts` still read API_INTERNAL_URL from the running container's
# env on every server-side fetch, so the compose file must set both (see
# docker-compose.local-prod.yml).
ARG API_INTERNAL_URL=http://api:3001
ARG APP_URL=http://localhost:3100
ENV API_INTERNAL_URL=$API_INTERNAL_URL
ENV APP_URL=$APP_URL
# NEXT_PUBLIC_* vars are inlined by Next into the client/server JS at build time (not read from
# the running container's env, unlike API_INTERNAL_URL/APP_URL above) -- see
# apps/web/components/site/umami.tsx. Must be passed as build-args by CI (docker/.env.nas.example
# runtime env of the same name is a no-op; kept there only for parity, see docker-compose.nas.yml).
ARG NEXT_PUBLIC_UMAMI_WEBSITE_ID=""
ARG NEXT_PUBLIC_UMAMI_SRC=""
ENV NEXT_PUBLIC_UMAMI_WEBSITE_ID=$NEXT_PUBLIC_UMAMI_WEBSITE_ID
ENV NEXT_PUBLIC_UMAMI_SRC=$NEXT_PUBLIC_UMAMI_SRC
RUN pnpm nx build @carnaby/web

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
# Nx build output path confirmed locally: .next/standalone nests everything under apps/web
# (apps/web/server.js, apps/web/.next/...) with a shared node_modules at the standalone root --
# matches the brief's fallback CMD path, not its first guess.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
# The runner's files are owned by the build-stage user, but the NAS compose runs this container
# as an arbitrary host uid:gid (`user: "1026:100"`) that doesn't match. Next's ISR/prerender disk
# cache lazily mkdirs apps/web/.next/cache at request time; without write access that mkdir fails
# with EACCES and the cache is silently disabled (serving still works off the prerendered pages).
# Pre-create the dir and open up perms for arbitrary uids: a+rwX keeps dirs traversable/writable
# without making regular files spuriously executable (unlike a blanket 777).
RUN mkdir -p apps/web/.next/cache && chmod -R a+rwX apps/web/.next
EXPOSE 3000
ENV HOSTNAME=0.0.0.0 PORT=3000
# 127.0.0.1, not localhost: alpine's wget tries ::1 first, but Next with HOSTNAME=0.0.0.0 binds
# IPv4 only, so a `localhost` healthcheck reports the container unhealthy forever even while it
# serves traffic fine on the mapped port (observed during the local-prod smoke test).
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000 || exit 1
CMD ["node", "apps/web/server.js"]
