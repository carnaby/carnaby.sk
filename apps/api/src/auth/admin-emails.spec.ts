import { describe, expect, it } from 'vitest';
import { parseAdminEmails, resolveRole } from './admin-emails';

describe('admin emails', () => {
  it('parses comma-separated env value', () => {
    expect(parseAdminEmails(' a@b.sk, C@D.sk ,')).toEqual(['a@b.sk', 'c@d.sk']);
  });
  it('resolves admin case-insensitively', () => {
    expect(resolveRole('DODUSIK@gmail.com', ['dodusik@gmail.com'])).toBe('admin');
    expect(resolveRole('other@gmail.com', ['dodusik@gmail.com'])).toBe('user');
  });
});
