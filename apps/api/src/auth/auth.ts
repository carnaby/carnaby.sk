import type { Db } from '@carnaby/db';
import { schema } from '@carnaby/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { parseAdminEmails, resolveRole } from './admin-emails';

export function createAuth(db: Db) {
  const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS);
  return betterAuth({
    baseURL: process.env.APP_URL ?? 'http://localhost:3000',
    basePath: '/api/auth',
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [process.env.APP_URL ?? 'http://localhost:3000'],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
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
    session: { expiresIn: 60 * 60 * 24 * 7 },
    databaseHooks: {
      user: {
        create: {
          before: async (u) => ({ data: { ...u, role: resolveRole(u.email, adminEmails) } }),
        },
      },
    },
  });
}
export type Auth = ReturnType<typeof createAuth>;
