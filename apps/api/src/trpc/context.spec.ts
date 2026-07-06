import { describe, expect, it } from 'vitest';
import { buildUserFromSession, createContext } from './context';

describe('buildUserFromSession', () => {
  it('returns null without session', () => {
    expect(buildUserFromSession(null)).toBeNull();
  });
  it('maps better-auth session payload', () => {
    const u = buildUserFromSession({
      user: { id: 'u1', email: 'a@b.c', name: 'A', image: null, role: 'admin' },
      session: { id: 's1' },
    } as never);
    expect(u).toEqual({ id: 'u1', email: 'a@b.c', name: 'A', image: null, role: 'admin' });
  });
});

describe('createContext', () => {
  it('degrades to anonymous user when session lookup fails', async () => {
    const mockReq = { headers: {} };
    const mockDb = {} as never;
    const mockAuth = {
      api: {
        getSession: () => Promise.reject(new Error('db down')),
      },
    } as never;

    const ctx = await createContext({ req: mockReq as never, db: mockDb, auth: mockAuth });

    expect(ctx).toEqual({ db: mockDb, user: null });
  });
});
