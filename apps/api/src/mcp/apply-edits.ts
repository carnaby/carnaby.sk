export interface TextEdit {
  old: string;
  new: string;
}

export type EditFailure =
  | { index: number; reason: 'not-found' }
  | { index: number; reason: 'multiple'; count: number };

export type ApplyEditsResult = { ok: true; content: string } | ({ ok: false } & EditFailure);

const SNIPPET_LENGTH = 80;

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return count;
    count += 1;
    from = at + 1;
  }
}

/** Applies edits in order; each `old` must occur exactly once in the current content. */
export function applyEdits(content: string, edits: readonly TextEdit[]): ApplyEditsResult {
  let current = content;
  for (const [index, edit] of edits.entries()) {
    const count = edit.old === '' ? 0 : countOccurrences(current, edit.old);
    if (count === 0) return { ok: false, index, reason: 'not-found' };
    if (count > 1) return { ok: false, index, reason: 'multiple', count };
    const at = current.indexOf(edit.old);
    current = current.slice(0, at) + edit.new + current.slice(at + edit.old.length);
  }
  return { ok: true, content: current };
}

export function describeEditFailure(
  lang: string,
  edits: readonly TextEdit[],
  failure: EditFailure,
): string {
  const old = edits[failure.index]?.old ?? '';
  const snippet = old.length > SNIPPET_LENGTH ? `${old.slice(0, SNIPPET_LENGTH)}…` : old;
  const prefix = `${lang} edit ${failure.index + 1} of ${edits.length}:`;
  return failure.reason === 'not-found'
    ? `${prefix} text not found in the current content: "${snippet}"`
    : `${prefix} text found ${failure.count} times -- include more surrounding text: "${snippet}"`;
}
