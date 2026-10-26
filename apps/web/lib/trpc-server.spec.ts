import { describe, expectTypeOf, it } from 'vitest';

import { serverTrpc } from './trpc-server';

describe('serverTrpc', () => {
  it('builds a typed proxy client whose procedures are callable', () => {
    // Type-level check only (no network call): confirms the AppRouter
    // type-only import wires up correctly end-to-end through
    // createTRPCClient's proxy typing.
    expectTypeOf(serverTrpc().posts.list.query).toBeFunction();
  });
});
