import type { LogEvent, LogLevel } from '../api/client';

/** Severity, most severe first, like the server's `LogLevel` ordering. */
export const LEVELS: readonly LogLevel[] = ['error', 'warn', 'info', 'debug', 'trace'];

export interface LogFilter {
  min_level: LogLevel;
  /** Target prefix. */
  target: string;
  /** Case-insensitive text found in the message or a field. */
  text: string;
  /** How many buffered events the server replays first. */
  history: number;
}

export const DEFAULT_FILTER: LogFilter = { min_level: 'info', target: '', text: '', history: 200 };

const rank = (l: LogLevel) => LEVELS.indexOf(l);

/** The same rule as the server's `LogFilter::matches`. */
export function matchesFilter(f: Pick<LogFilter, 'min_level' | 'target' | 'text'>, e: LogEvent): boolean {
  if (rank(e.level) > rank(f.min_level)) return false;
  const target = f.target.trim();
  if (target && !e.target.startsWith(target)) return false;
  const text = f.text.trim().toLowerCase();
  if (text) {
    if (e.message.toLowerCase().includes(text)) return true;
    return Object.entries(e.fields).some(
      ([k, v]) => k.toLowerCase().includes(text) || v.toLowerCase().includes(text),
    );
  }
  return true;
}

/** The filter as the server wants it: empty strings are left out. */
export function toWireFilter(f: LogFilter): Record<string, unknown> {
  const out: Record<string, unknown> = { min_level: f.min_level, history: f.history };
  if (f.target.trim()) out.target = f.target.trim();
  if (f.text.trim()) out.text = f.text.trim();
  return out;
}

/**
 * The lines the viewer keeps: at most `cap`, the oldest dropped first. The DOM renders
 * `snapshot()`, so `cap` bounds the page size.
 */
export class LogStore {
  private lines: LogEvent[] = [];
  /** Lines dropped for the cap since the last `clear`. */
  dropped = 0;

  constructor(readonly cap = 3000) {
    if (cap < 1) throw new RangeError('cap must be at least 1');
  }

  get length(): number {
    return this.lines.length;
  }

  push(events: readonly LogEvent[]): void {
    if (events.length === 0) return;
    for (const e of events) this.lines.push(e);
    const over = this.lines.length - this.cap;
    if (over > 0) {
      this.lines.splice(0, over);
      this.dropped += over;
    }
  }

  clear(): void {
    this.lines = [];
    this.dropped = 0;
  }

  /** A copy, safe to keep while the store keeps growing (the paused view). */
  snapshot(): LogEvent[] {
    return this.lines.slice();
  }
}

/** A message from the server, after `JSON.parse`. */
export type ServerMessage =
  | { type: 'hello'; buffer: number }
  | { type: 'event'; event: LogEvent }
  | { type: 'reset' }
  | { type: 'lagged'; missed: number }
  | { type: 'error'; message: string };

export function parseServerMessage(raw: string): ServerMessage | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== 'object' || !('type' in v)) return null;
  const m = v as Record<string, unknown>;
  switch (m.type) {
    case 'hello':
      return { type: 'hello', buffer: Number(m.buffer ?? 0) };
    case 'event': {
      const e = m.event as LogEvent | undefined;
      if (!e || typeof e.message !== 'string' || typeof e.level !== 'string') return null;
      return { type: 'event', event: { ...e, fields: e.fields ?? {} } };
    }
    case 'reset':
      return { type: 'reset' };
    case 'lagged':
      return { type: 'lagged', missed: Number(m.missed ?? 0) };
    case 'error':
      return { type: 'error', message: String(m.message ?? 'error') };
    default:
      return null;
  }
}

/** Reconnect delay: 0.5 s doubling to 15 s, plus up to 25 % jitter (`rand` is in [0, 1)). */
export function backoffDelay(attempt: number, rand = Math.random()): number {
  const base = Math.min(15_000, 500 * 2 ** Math.max(0, attempt));
  return Math.round(base * (1 + 0.25 * rand));
}

/** `ws(s)://host/api/v1/admin/logs/ws?token=...` for the page's own origin. */
export function logsWsUrl(loc: Pick<Location, 'protocol' | 'host'>, token: string): string {
  const scheme = loc.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${loc.host}/api/v1/admin/logs/ws?token=${encodeURIComponent(token)}`;
}
