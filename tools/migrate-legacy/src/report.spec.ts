import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findMissingThumbnails, formatReport, reportHasFailures } from './report';
import type { MigrationReport } from './report';

function baseReport(overrides: Partial<MigrationReport> = {}): MigrationReport {
  return {
    counts: [
      { table: 'users', oldCount: 2, newCount: 2, strict: true },
      { table: 'categories', oldCount: 2, newCount: 4, strict: false },
      { table: 'posts', oldCount: 3, newCount: 3, strict: true },
      { table: 'post_translations', oldCount: 3, newCount: 4, strict: false },
      { table: 'post_categories', oldCount: 4, newCount: 4, strict: true },
    ],
    postsWithoutTranslations: [],
    warnings: [],
    missingThumbnails: [],
    uploadsDirChecked: null,
    samples: [],
    ...overrides,
  };
}

describe('reportHasFailures', () => {
  it('is false for a clean migration', () => {
    expect(reportHasFailures(baseReport())).toBe(false);
  });

  it('is true when any post ended up with zero translations', () => {
    const report = baseReport({ postsWithoutTranslations: [{ id: 5, slug: 'empty-post' }] });
    expect(reportHasFailures(report)).toBe(true);
  });

  it('is true when a strict table count mismatches', () => {
    const report = baseReport({
      counts: [{ table: 'posts', oldCount: 3, newCount: 2, strict: true }],
    });
    expect(reportHasFailures(report)).toBe(true);
  });

  it('is false when only a non-strict table count mismatches (categories, post_translations)', () => {
    const report = baseReport({
      counts: [
        { table: 'categories', oldCount: 2, newCount: 10, strict: false },
        { table: 'post_translations', oldCount: 3, newCount: 1, strict: false },
      ],
    });
    expect(reportHasFailures(report)).toBe(false);
  });

  it('is true when the in-memory vs DB-queried audit finds a mismatch, even with clean counts', () => {
    const report = baseReport({ auditMismatches: ['posts: in-memory=3 queried=2'] });
    expect(reportHasFailures(report)).toBe(true);
  });

  it('is false when auditMismatches is an empty array', () => {
    const report = baseReport({ auditMismatches: [] });
    expect(reportHasFailures(report)).toBe(false);
  });

  it('is false when auditMismatches is omitted entirely (backward compatible)', () => {
    const report = baseReport();
    delete (report as { auditMismatches?: string[] }).auditMismatches;
    expect(reportHasFailures(report)).toBe(false);
  });
});

describe('formatReport', () => {
  it('renders "none" in the audit section for a clean migration', () => {
    const output = formatReport(baseReport());
    expect(output).toContain('-- audit: in-memory tally vs DB-queried count after commit (FAIL) --\n  none');
  });

  it('renders each audit mismatch as a FAIL line and forces RESULT: FAIL', () => {
    const output = formatReport(baseReport({ auditMismatches: ['posts: in-memory=3 queried=2'] }));
    expect(output).toContain('FAIL posts: in-memory=3 queried=2');
    expect(output).toContain('RESULT: FAIL');
  });
});

describe('findMissingThumbnails', () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('returns [] without touching the filesystem when uploadsDir is undefined', () => {
    expect(findMissingThumbnails(undefined, ['anything.jpg'])).toEqual([]);
  });

  it('reports filenames missing under <uploadsDir>/originals and omits ones that exist', () => {
    dir = mkdtempSync(join(tmpdir(), 'migrate-legacy-thumbs-'));
    mkdirSync(join(dir, 'originals'), { recursive: true });
    writeFileSync(join(dir, 'originals', 'exists.jpg'), 'fake image bytes');

    const missing = findMissingThumbnails(dir, ['exists.jpg', 'missing.jpg']);

    expect(missing).toEqual(['missing.jpg']);
  });
});
