/** "30m", "12h", "7d", "2w", "1h30m", "90" (minutes) to seconds, and back. */

const UNITS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400, w: 604_800 };

/** Shortest and longest ban the server accepts (seconds). */
export const MIN_BAN_SECS = 60;
export const MAX_BAN_SECS = 10 * 365 * 86_400;

/**
 * Parses a length of time: one or more `<number><unit>` parts with the units s, m, h, d, w
 * (`1h30m`, `2w`), or a bare number of minutes. Returns seconds, or `null` when the text is not
 * a duration (including zero).
 */
export function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, '');
  if (t === '') return null;
  if (/^\d+$/.test(t)) {
    const n = Number(t) * 60;
    return n > 0 && Number.isSafeInteger(n) ? n : null;
  }
  const re = /(\d+)([smhdw])/y;
  let total = 0;
  let at = 0;
  while (at < t.length) {
    re.lastIndex = at;
    const m = re.exec(t);
    if (!m) return null;
    total += Number(m[1]) * UNITS[m[2]!]!;
    at = re.lastIndex;
  }
  return total > 0 && Number.isSafeInteger(total) ? total : null;
}

/** `5400` -> `1h 30m`; `0` -> `0s`. */
export function formatDuration(secs: number): string {
  if (!(secs > 0)) return '0s';
  const parts: string[] = [];
  let rest = Math.floor(secs);
  for (const [label, size] of [['w', 604_800], ['d', 86_400], ['h', 3600], ['m', 60], ['s', 1]] as const) {
    const n = Math.floor(rest / size);
    if (n > 0) parts.push(`${n}${label}`);
    rest -= n * size;
  }
  return parts.join(' ');
}

/** Whether a ban length is one the server accepts. */
export function banLengthOk(secs: number): boolean {
  return Number.isInteger(secs) && secs >= MIN_BAN_SECS && secs <= MAX_BAN_SECS;
}
