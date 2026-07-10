import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface CountRow {
  table: string;
  oldCount: number;
  newCount: number;
  /** true => oldCount must equal newCount exactly (a straight 1:1 copy table -- users, posts,
   * post_categories). false => a mismatch is expected/allowed (categories gain the 3 canonical
   * rows from `seed()`; post_translations counts shift with synthesis/skip). */
  strict: boolean;
}

export interface PostWithoutTranslation {
  id: number;
  slug: string;
}

export interface SampleSlug {
  slug: string;
  /** language -> title, e.g. `{ sk: '...', en: '...' }` */
  titles: Record<string, string>;
}

export interface MigrationReport {
  counts: CountRow[];
  postsWithoutTranslations: PostWithoutTranslation[];
  warnings: string[];
  /** Bare thumbnail filenames referenced by migrated posts but not found on disk. Only populated
   * when `uploadsDirChecked` is set. */
  missingThumbnails: string[];
  /** Set to the resolved `<UPLOADS_DIR>/originals` path when the check ran, `null` when
   * `UPLOADS_DIR` wasn't set (in which case `missingThumbnails` is always empty). */
  uploadsDirChecked: string | null;
  samples: SampleSlug[];
  /**
   * One entry per table where the migration's own in-memory tally (rows it believes it inserted)
   * disagrees with a fresh `SELECT COUNT(*)` run against the target *after* the migration
   * transaction committed -- e.g. `"posts: in-memory=3 queried=2"`. Any entry here is always a
   * FAIL, independent of a `CountRow.strict` flag (strict/non-strict is about whether an
   * old-vs-new *count* difference is expected; this is about whether the writer's own bookkeeping
   * can be trusted at all). Optional/absent for callers that don't run this audit (e.g. hand-built
   * reports in unit tests) -- treated the same as an empty array.
   */
  auditMismatches?: string[];
}

/**
 * Checks which of `thumbnailFilenames` are missing under `<uploadsDir>/originals`. Returns `[]`
 * without touching the filesystem when `uploadsDir` is undefined (the report only runs this
 * check when `UPLOADS_DIR` is set, per the task contract).
 */
export function findMissingThumbnails(uploadsDir: string | undefined, thumbnailFilenames: string[]): string[] {
  if (!uploadsDir) return [];
  const originalsDir = resolve(uploadsDir, 'originals');
  return thumbnailFilenames.filter((name) => !existsSync(join(originalsDir, name)));
}

/** The run should exit non-zero exactly when: any post ended up with zero translations, a
 * "strict" (1:1 copy) table's old/new counts disagree, or the in-memory-vs-queried audit found a
 * mismatch. */
export function reportHasFailures(report: MigrationReport): boolean {
  if (report.postsWithoutTranslations.length > 0) return true;
  if ((report.auditMismatches?.length ?? 0) > 0) return true;
  return report.counts.some((c) => c.strict && c.oldCount !== c.newCount);
}

function formatCountLine(c: CountRow): string {
  const mismatch = c.strict && c.oldCount !== c.newCount;
  const flag = mismatch ? '  [FAIL: expected an exact match]' : '';
  return `  ${c.table.padEnd(18)} ${String(c.oldCount).padStart(6)} -> ${String(c.newCount).padStart(6)}${flag}`;
}

/** Renders the full human-readable report printed by `migrate.ts` at the end of a run. */
export function formatReport(report: MigrationReport): string {
  const lines: string[] = [];
  lines.push('=== migrate-legacy report ===');
  lines.push('');
  lines.push('-- counts (old -> new) --');
  lines.push(...report.counts.map(formatCountLine));

  lines.push('');
  lines.push('-- audit: in-memory tally vs DB-queried count after commit (FAIL) --');
  const auditMismatches = report.auditMismatches ?? [];
  if (auditMismatches.length === 0) {
    lines.push('  none');
  } else {
    for (const m of auditMismatches) lines.push(`  FAIL ${m}`);
  }

  lines.push('');
  lines.push('-- posts with zero translations (FAIL) --');
  if (report.postsWithoutTranslations.length === 0) {
    lines.push('  none');
  } else {
    for (const p of report.postsWithoutTranslations) lines.push(`  FAIL id=${p.id} slug=${p.slug}`);
  }

  lines.push('');
  lines.push('-- warnings --');
  if (report.warnings.length === 0) {
    lines.push('  none');
  } else {
    for (const w of report.warnings) lines.push(`  WARN ${w}`);
  }

  lines.push('');
  lines.push('-- thumbnail files under UPLOADS_DIR/originals (WARN) --');
  if (!report.uploadsDirChecked) {
    lines.push('  skipped (UPLOADS_DIR not set)');
  } else if (report.missingThumbnails.length === 0) {
    lines.push(`  none missing under ${report.uploadsDirChecked}`);
  } else {
    for (const t of report.missingThumbnails) {
      lines.push(`  WARN missing file: ${t} (checked under ${report.uploadsDirChecked})`);
    }
  }

  lines.push('');
  lines.push('-- sample slugs (spot-check) --');
  if (report.samples.length === 0) {
    lines.push('  (no posts migrated)');
  } else {
    for (const s of report.samples) {
      const titleParts = Object.entries(s.titles)
        .map(([lang, title]) => `${lang}="${title}"`)
        .join(', ');
      lines.push(`  ${s.slug}: ${titleParts || '(no translations)'}`);
    }
  }

  lines.push('');
  lines.push(reportHasFailures(report) ? 'RESULT: FAIL' : 'RESULT: OK');
  return lines.join('\n');
}
