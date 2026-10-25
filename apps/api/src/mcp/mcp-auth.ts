import { timingSafeEqual } from 'node:crypto';
import type { Db } from '@carnaby/db';
import { user } from '@carnaby/db';
import { fromNodeHeaders } from 'better-auth/node';
import { eq, inArray } from 'drizzle-orm';
import type { IncomingHttpHeaders } from 'node:http';
import type { Auth } from '../auth/auth';
import { parseAdminEmails } from '../auth/admin-emails';

/** Who is calling the MCP endpoint. `userId` is `null` only for the static token when no admin
 * user exists yet (posts are then created without an author). */
export interface McpActor {
  userId: string | null;
  email: string | null;
  via: 'oauth' | 'static-token';
}

export type McpAuthResult =
  | { ok: true; actor: McpActor }
  | { ok: false; status: 401 | 403; message: string };

/** Static tokens shorter than this are ignored -- a guessable token would be worse than none. */
export const MIN_STATIC_TOKEN_LENGTH = 32;

export function bearerToken(headers: IncomingHttpHeaders): string | null {
  const value = headers.authorization;
  if (!value || !/^Bearer\s+/i.test(value)) return null;
  const token = value.replace(/^Bearer\s+/i, '').trim();
  return token || null;
}

export function staticTokenMatches(presented: string, configured: string | undefined): boolean {
  if (!configured || configured.length < MIN_STATIC_TOKEN_LENGTH) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(configured);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Authenticates an MCP request. Two accepted credentials:
 *  1. An OAuth access token issued by better-auth's `mcp` plugin (Claude connectors: web,
 *     desktop, mobile, Claude Code). The token's owner must have role `admin`.
 *  2. The optional `MCP_API_TOKEN` env value (for clients that can only send a fixed header).
 */
export async function authenticateMcpRequest(
  auth: Auth,
  db: Db,
  headers: IncomingHttpHeaders,
  env: { MCP_API_TOKEN?: string; ADMIN_EMAILS?: string } = process.env,
): Promise<McpAuthResult> {
  const token = bearerToken(headers);
  if (!token) return { ok: false, status: 401, message: 'Authentication required' };

  if (staticTokenMatches(token, env.MCP_API_TOKEN)) {
    const adminEmails = parseAdminEmails(env.ADMIN_EMAILS);
    const [admin] = adminEmails.length
      ? await db.select({ id: user.id, email: user.email }).from(user).where(inArray(user.email, adminEmails)).limit(1)
      : [];
    return { ok: true, actor: { userId: admin?.id ?? null, email: admin?.email ?? null, via: 'static-token' } };
  }

  let tokenRecord: { userId?: string | null } | null = null;
  try {
    tokenRecord = await auth.api.getMcpSession({ headers: fromNodeHeaders(headers) });
  } catch {
    tokenRecord = null;
  }
  if (!tokenRecord?.userId) return { ok: false, status: 401, message: 'Invalid or expired access token' };

  const [owner] = await db.select({ id: user.id, email: user.email, role: user.role })
    .from(user).where(eq(user.id, tokenRecord.userId)).limit(1);
  if (!owner) return { ok: false, status: 401, message: 'Invalid or expired access token' };
  if (owner.role !== 'admin') return { ok: false, status: 403, message: 'Admin role required' };

  return { ok: true, actor: { userId: owner.id, email: owner.email, via: 'oauth' } };
}
