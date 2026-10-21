export function formatUptime(secs: number): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatUnix(secs: number | null | undefined): string {
  return secs ? new Date(secs * 1000).toLocaleString() : '-';
}

export function formatAge(ms: number, now = Date.now()): string {
  return formatUptime(Math.max(0, Math.floor((now - ms) / 1000)));
}

/** "" -> undefined, otherwise the integer; NaN and negatives are rejected by `intOrNull`. */
export function intOrNull(s: string | number | null | undefined): number | null {
  if (s === null || s === undefined || String(s).trim() === '') return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 ? n : Number.NaN;
}
