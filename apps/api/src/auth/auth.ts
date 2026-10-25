import type { Db } from '@carnaby/db';
import { schema } from '@carnaby/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { mcp } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import { parseAdminEmails, resolveRole } from './admin-emails';

const DAY_SECONDS = 60 * 60 * 24;

export function appUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

/** Public URL of the MCP endpoint (apps/api/src/mcp). Next rewrites `/api/*` to this api. */
export function mcpResourceUrl(): string {
  return `${appUrl()}/api/mcp`;
}

export function createAuth(db: Db) {
  const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS);
  const baseURL = appUrl();
  return betterAuth({
    baseURL,
    basePath: '/api/auth',
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [baseURL],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        oauthApplication: schema.oauthApplication,
        oauthAccessToken: schema.oauthAccessToken,
        oauthConsent: schema.oauthConsent,
      },
    }),
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      },
    },
    user: {
      additionalFields: {
        role: { type: 'string', defaultValue: 'user', input: false },
      },
    },
    session: { expiresIn: 7 * DAY_SECONDS },
    advanced: {
      // Requests arrive via DSM's reverse proxy and then the Next.js rewrite proxy, so
      // X-Forwarded-For carries more than one hop. Without trusted proxies better-auth refuses a
      // multi-value header and rate-limits everyone in ONE shared bucket -- a few bad requests
      // would then lock every visitor (including the admin) out of sign-in. With the private
      // ranges trusted, the client IP is the right-most public hop, which a client can't spoof.
      ipAddress: {
        ipAddressHeaders: ['x-forwarded-for'],
        trustedProxies: ['127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '::1/128', 'fc00::/7'],
      },
    },
    plugins: [
      // OAuth 2.1 authorization server for MCP clients (Claude web/desktop/mobile, Claude Code).
      // Unauthenticated authorize requests are sent to /login; after the Google callback the
      // plugin's after-hook finishes the authorization and redirects back to the client.
      // Issuing a token does NOT grant admin rights -- the MCP endpoint itself checks the
      // token owner's role (apps/api/src/mcp/mcp-auth.ts).
      mcp({
        loginPage: '/login',
        resource: mcpResourceUrl(),
        oidcConfig: {
          loginPage: '/login',
          accessTokenExpiresIn: 7 * DAY_SECONDS,
          refreshTokenExpiresIn: 90 * DAY_SECONDS,
        },
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          before: async (u) => ({ data: { ...u, role: resolveRole(u.email, adminEmails) } }),
        },
      },
      session: {
        create: {
          // ADMIN_EMAILS must also apply to users that already exist (e.g. migrated from v1 with
          // role 'user', or added to the list later) -- the user.create hook alone never sees
          // them. Promote-only: removing an email from the list doesn't silently demote anyone.
          before: async (s) => {
            if (adminEmails.length === 0) return;
            const [row] = await db
              .select({ email: schema.user.email, role: schema.user.role })
              .from(schema.user)
              .where(eq(schema.user.id, s.userId))
              .limit(1);
            if (row && row.role !== 'admin' && resolveRole(row.email, adminEmails) === 'admin') {
              await db.update(schema.user).set({ role: 'admin' }).where(eq(schema.user.id, s.userId));
            }
          },
        },
      },
    },
  });
}
export type Auth = ReturnType<typeof createAuth>;
