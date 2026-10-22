/** A line diff for the config editor's "review changes" step. */

export type DiffKind = 'same' | 'add' | 'del';

export interface DiffLine {
  kind: DiffKind;
  text: string;
  /** 1-based line numbers in the old and the new text (absent on the side the line is not in). */
  oldNo?: number;
  newNo?: number;
}

/** Beyond this many cells the exact diff is skipped for a coarse one (everything between the common ends changed). */
const MAX_CELLS = 4_000_000;

function split(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** Line diff of two texts (longest common subsequence, common start and end trimmed first). */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = split(oldText);
  const b = split(newText);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }
  const out: DiffLine[] = [];
  for (let i = 0; i < start; i += 1) out.push({ kind: 'same', text: a[i]!, oldNo: i + 1, newNo: i + 1 });

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const n = midA.length;
  const m = midB.length;
  const mid: DiffLine[] = [];
  if (n * m > MAX_CELLS) {
    for (let i = 0; i < n; i += 1) mid.push({ kind: 'del', text: midA[i]!, oldNo: start + i + 1 });
    for (let j = 0; j < m; j += 1) mid.push({ kind: 'add', text: midB[j]!, newNo: start + j + 1 });
  } else {
    // lcs[i][j]: length of the common subsequence of midA[i..] and midB[j..].
    const width = m + 1;
    const lcs = new Uint32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i -= 1) {
      for (let j = m - 1; j >= 0; j -= 1) {
        lcs[i * width + j] =
          midA[i] === midB[j] ? lcs[(i + 1) * width + j + 1]! + 1 : Math.max(lcs[(i + 1) * width + j]!, lcs[i * width + j + 1]!);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && midA[i] === midB[j]) {
        mid.push({ kind: 'same', text: midA[i]!, oldNo: start + i + 1, newNo: start + j + 1 });
        i += 1;
        j += 1;
      } else if (i < n && (j === m || lcs[(i + 1) * width + j]! >= lcs[i * width + j + 1]!)) {
        mid.push({ kind: 'del', text: midA[i]!, oldNo: start + i + 1 });
        i += 1;
      } else {
        mid.push({ kind: 'add', text: midB[j]!, newNo: start + j + 1 });
        j += 1;
      }
    }
  }
  out.push(...mid);
  for (let k = 0; k < a.length - endA; k += 1) {
    out.push({ kind: 'same', text: a[endA + k]!, oldNo: endA + k + 1, newNo: endB + k + 1 });
  }
  return out;
}

export interface DiffStats {
  added: number;
  removed: number;
}

export function diffStats(lines: readonly DiffLine[]): DiffStats {
  return {
    added: lines.filter((l) => l.kind === 'add').length,
    removed: lines.filter((l) => l.kind === 'del').length,
  };
}

/** A run of lines to show: changes with `context` unchanged lines around them. */
export interface Hunk {
  lines: DiffLine[];
}

/** Groups the diff into hunks; separate hunks are shown with a gap between them. */
export function hunks(lines: readonly DiffLine[], context = 3): Hunk[] {
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((l, i) => {
    if (l.kind === 'same') return;
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k += 1) keep[k] = true;
  });
  const out: Hunk[] = [];
  let cur: DiffLine[] | null = null;
  lines.forEach((l, i) => {
    if (keep[i]) {
      cur ??= [];
      cur.push(l);
    } else if (cur) {
      out.push({ lines: cur });
      cur = null;
    }
  });
  if (cur) out.push({ lines: cur });
  return out;
}
