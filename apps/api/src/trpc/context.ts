import type { Db } from '@carnaby/db';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import type { Auth } from '../auth/auth';

export interface CtxUser { id: string; email: string; name: string; image: string | null; role: string }

export function buildUserFromSession(s: { user: { id: string; email: string; name: string; image?: string | null; role?: string } } | null): CtxUser | null {
  if (!s?.user) return null;
  const { id, email, name, image, role } = s.user;
  return { id, email, name, image: image ?? null, role: role ?? 'user' };
}

export async function createContext(opts: { req: Request; db: Db; auth: Auth }) {
  const session = await opts.auth.api.getSession({ headers: fromNodeHeaders(opts.req.headers) });
  return { db: opts.db, user: buildUserFromSession(session) };
}
export type Context = Awaited<ReturnType<typeof createContext>>;
