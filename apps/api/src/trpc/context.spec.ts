import { describe, expect, it, vi } from 'vitest';
import { buildUserFromSession } from './context';

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
