import { describe, expect, it } from 'vitest';
import { diffLines, diffStats, hunks } from './diff';

const text = (...lines: string[]) => lines.join('\n') + '\n';

describe('diffLines', () => {
  it('has no changes for equal texts', () => {
    const d = diffLines(text('a', 'b'), text('a', 'b'));
    expect(d.every((l) => l.kind === 'same')).toBe(true);
    expect(diffStats(d)).toEqual({ added: 0, removed: 0 });
    expect(hunks(d)).toEqual([]);
  });

  it('finds an edited line as a removal and an addition with line numbers', () => {
    const d = diffLines(text('a', 'b', 'c'), text('a', 'B', 'c'));
    expect(d.map((l) => [l.kind, l.text, l.oldNo, l.newNo])).toEqual([
      ['same', 'a', 1, 1],
      ['del', 'b', 2, undefined],
      ['add', 'B', undefined, 2],
      ['same', 'c', 3, 3],
    ]);
  });

  it('handles insertions, deletions and a changed first and last line', () => {
    const d = diffLines(text('1', '2', '3', '4'), text('0', '2', 'x', '3', '5'));
    expect(diffStats(d)).toEqual({ added: 3, removed: 2 });
    // Replaying the diff gives both texts back.
    expect(d.filter((l) => l.kind !== 'add').map((l) => l.text)).toEqual(['1', '2', '3', '4']);
    expect(d.filter((l) => l.kind !== 'del').map((l) => l.text)).toEqual(['0', '2', 'x', '3', '5']);
  });

  it('copes with empty texts and a missing final newline', () => {
    expect(diffLines('', '')).toEqual([]);
    expect(diffLines('', text('a'))).toEqual([{ kind: 'add', text: 'a', newNo: 1 }]);
    expect(diffLines(text('a'), '')).toEqual([{ kind: 'del', text: 'a', oldNo: 1 }]);
    expect(diffStats(diffLines('a\nb', 'a\nb\n'))).toEqual({ added: 0, removed: 0 });
    // A blank line in the middle is a line.
    expect(diffStats(diffLines(text('a', '', 'b'), text('a', 'b')))).toEqual({ added: 0, removed: 1 });
  });

  it('numbers lines after the changed part correctly', () => {
    const d = diffLines(text('a', 'b', 'c', 'd'), text('a', 'x', 'y', 'c', 'd'));
    const last = d[d.length - 1]!;
    expect([last.text, last.oldNo, last.newNo]).toEqual(['d', 4, 5]);
  });

  it('falls back to a coarse diff for huge changes without hanging', () => {
    const big = (p: string) => Array.from({ length: 2500 }, (_, i) => `${p}${i}`).join('\n');
    const d = diffLines(big('a'), big('b'));
    expect(diffStats(d)).toEqual({ added: 2500, removed: 2500 });
  });
});

describe('hunks', () => {
  it('shows changes with context and separates distant ones', () => {
    const old = text(...Array.from({ length: 20 }, (_, i) => `line ${i + 1}`));
    const nu = old.replace('line 3\n', 'LINE 3\n').replace('line 18\n', 'LINE 18\n');
    const h = hunks(diffLines(old, nu), 2);
    expect(h).toHaveLength(2);
    expect(h[0]!.lines.map((l) => l.text)).toEqual(['line 1', 'line 2', 'line 3', 'LINE 3', 'line 4', 'line 5']);
    expect(h[1]!.lines[0]!.text).toBe('line 16');
    // Close changes merge into one hunk.
    expect(hunks(diffLines(old, old.replace('line 3\n', 'x\n').replace('line 6\n', 'y\n')), 2)).toHaveLength(1);
  });
});
