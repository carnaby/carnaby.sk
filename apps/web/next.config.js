//@ts-check

const { join } = require('node:path');
const createNextIntlPlugin = require('next-intl/plugin');

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Monorepo root for `output: 'standalone'`'s file tracing -- without this Next infers it by
  // walking up from apps/web looking for the outermost lockfile, which happens to land on the
  // repo root anyway here (verified: `nx build @carnaby/web` produces the same
  // `.next/standalone/apps/web/server.js` layout with or without this set), but pinning it
  // explicitly avoids depending on that inference inside the Docker build context.
  outputFileTracingRoot: join(__dirname, '../..'),
  async rewrites() {
    return [
      { source: '/trpc/:path*', destination: `${API_INTERNAL_URL}/trpc/:path*` },
      { source: '/api/:path*', destination: `${API_INTERNAL_URL}/api/:path*` },
      { source: '/images/:path*', destination: `${API_INTERNAL_URL}/images/:path*` },
      // OAuth discovery for MCP clients (apps/api/src/mcp). They look these up at the domain
      // root -- optionally with the resource path appended (RFC 8414 / RFC 9728) -- while
      // better-auth serves them under its own /api/auth base path.
      ...['oauth-authorization-server', 'oauth-protected-resource', 'openid-configuration'].flatMap((doc) => [
        { source: `/.well-known/${doc}`, destination: `${API_INTERNAL_URL}/api/auth/.well-known/${doc === 'openid-configuration' ? 'oauth-authorization-server' : doc}` },
        { source: `/.well-known/${doc}/:path*`, destination: `${API_INTERNAL_URL}/api/auth/.well-known/${doc === 'openid-configuration' ? 'oauth-authorization-server' : doc}` },
      ]),
    ];
  },
};

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

module.exports = withNextIntl(nextConfig);
