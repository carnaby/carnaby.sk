import { describe, expect, it } from 'vitest';
import { projectHost } from './project-url';

describe('projectHost', () => {
  it('shows the host without www.', () => {
    expect(projectHost('https://one-light-day.carnaby.sk/')).toBe('one-light-day.carnaby.sk');
    expect(projectHost('https://www.example.com/a/b?c=1')).toBe('example.com');
    expect(projectHost('http://example.com:8080/')).toBe('example.com:8080');
  });
  it('falls back to the raw value for something unparsable', () => {
    expect(projectHost('not a url')).toBe('not a url');
  });
});
