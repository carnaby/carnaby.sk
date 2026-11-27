import { describe, expect, it } from 'vitest';
import { applyEdits, describeEditFailure } from './apply-edits';

describe('applyEdits', () => {
  it('replaces a unique occurrence', () => {
    expect(applyEdits('a b c', [{ old: 'b', new: 'X' }])).toEqual({ ok: true, content: 'a X c' });
  });

  it('applies edits in order, each on the result of the previous', () => {
    expect(
      applyEdits('one', [
        { old: 'one', new: 'two' },
        { old: 'two', new: 'three' },
      ]),
    ).toEqual({ ok: true, content: 'three' });
  });

  it('fails with not-found and index', () => {
    expect(
      applyEdits('abc', [
        { old: 'a', new: 'A' },
        { old: 'zzz', new: '' },
      ]),
    ).toEqual({ ok: false, index: 1, reason: 'not-found' });
  });

  it('fails with multiple and count', () => {
    expect(applyEdits('x x x', [{ old: 'x', new: 'y' }])).toEqual({
      ok: false,
      index: 0,
      reason: 'multiple',
      count: 3,
    });
  });

  it('counts overlapping occurrences', () => {
    expect(applyEdits('aaa', [{ old: 'aa', new: 'b' }])).toEqual({
      ok: false,
      index: 0,
      reason: 'multiple',
      count: 2,
    });
  });

  it('empty new deletes', () => {
    expect(applyEdits('keep drop keep2', [{ old: ' drop', new: '' }])).toEqual({
      ok: true,
      content: 'keep keep2',
    });
  });

  it('stores $ patterns literally', () => {
    expect(applyEdits('cena: X', [{ old: 'X', new: '$& a $1 a $$' }])).toEqual({
      ok: true,
      content: 'cena: $& a $1 a $$',
    });
  });

  it('is case-sensitive and exact', () => {
    expect(applyEdits('Ahoj', [{ old: 'ahoj', new: 'x' }])).toEqual({
      ok: false,
      index: 0,
      reason: 'not-found',
    });
  });

  it('handles diacritics and emoji', () => {
    expect(applyEdits('Žltý 🎸 kôň', [{ old: '🎸', new: '🥁' }])).toEqual({
      ok: true,
      content: 'Žltý 🥁 kôň',
    });
  });
});

describe('describeEditFailure', () => {
  const edits = [
    { old: 'a', new: 'b' },
    { old: 'Fornax beží', new: 'x' },
    { old: 'c', new: 'd' },
  ];

  it('describes not-found with 1-based index', () => {
    expect(describeEditFailure('sk', edits, { index: 1, reason: 'not-found' })).toBe(
      'sk edit 2 of 3: text not found in the current content: "Fornax beží"',
    );
  });

  it('describes multiple with count', () => {
    expect(describeEditFailure('sk', edits, { index: 0, reason: 'multiple', count: 3 })).toBe(
      'sk edit 1 of 3: text found 3 times -- include more surrounding text: "a"',
    );
  });

  it('cuts the snippet to 80 characters and appends an ellipsis', () => {
    const long = [{ old: 'y'.repeat(100), new: '' }];
    expect(describeEditFailure('en', long, { index: 0, reason: 'not-found' })).toBe(
      `en edit 1 of 1: text not found in the current content: "${'y'.repeat(80)}…"`,
    );
  });
});
