// @vitest-environment node
import { describe, expect, expectTypeOf, it } from 'vitest';

import { serverTrpc, tagsFor } from './trpc-server';

describe('tagsFor', () => {
  it('returns the shared posts-list tag plus a per-slug detail tag', () => {
    expect(tagsFor('my-slug')).toEqual(['posts', 'post:my-slug']);
  });
});

describe('serverTrpc', () => {
  it('builds a typed proxy client whose procedures are callable', () => {
    // Type-level check only (no network call): confirms the AppRouter
    // type-only import wires up correctly end-to-end through
    // createTRPCClient's proxy typing.
    expectTypeOf(serverTrpc().posts.list.query).toBeFunction();
  });
});
