/** Scheduled tasks: form state, checks that mirror the server's, and the words the page shows. */
import type { components } from './api/schema';
import { parseDuration } from './duration';

type Schemas = components['schemas'];
export type Schedule = Schemas['Schedule'];
export type TaskKind = Schemas['TaskKind'];

export const WEEKDAYS = [
  { id: 'mon', label: 'Mon' },
  { id: 'tue', label: 'Tue' },
  { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' },
  { id: 'fri', label: 'Fri' },
  { id: 'sat', label: 'Sat' },
  { id: 'sun', label: 'Sun' },
] as const;

/** The server's limits (crates/poe-web-api/src/scheduler). */
export const MIN_INTERVAL_SECS = 60;
export const MAX_INTERVAL_SECS = 30 * 86_400;
export const MAX_DELAY_SECS = 3600;
export const MAX_MESSAGE_CHARS = 200;
export const MAX_NAME_CHARS = 80;

export type ScheduleType = Schedule['type'];

/** What the schedule inputs hold while the user edits. */
export interface ScheduleForm {
  type: ScheduleType;
  /** `HH:MM`, for daily and weekly. */
  time: string;
  days: string[];
  /** A length of time ("6h", "90m") for intervals. */
  every: string;
  cron: string;
}

export function emptyScheduleForm(): ScheduleForm {
  return { type: 'daily', time: '04:00', days: ['mon', 'tue', 'wed', 'thu', 'fri'], every: '6h', cron: '0 4 * * *' };
}

export function formFromSchedule(s: Schedule): ScheduleForm {
  const base = emptyScheduleForm();
  switch (s.type) {
    case 'daily':
      return { ...base, type: 'daily', time: s.time };
    case 'weekly':
      return { ...base, type: 'weekly', time: s.time, days: [...s.days] };
    case 'interval':
      return { ...base, type: 'interval', every: formatEvery(s.every_secs) };
    case 'cron':
      return { ...base, type: 'cron', cron: s.expr };
  }
}

/** `3600` -> `1h`, `5400` -> `90m` (the largest unit that divides evenly). */
export function formatEvery(secs: number): string {
  for (const [unit, size] of [['d', 86_400], ['h', 3600], ['m', 60]] as const) {
    if (secs % size === 0) return `${secs / size}${unit}`;
  }
  return `${secs}s`;
}

export function validTime(t: string): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  return !!m && Number(m[1]) <= 23 && Number(m[2]) <= 59;
}

/** `4:05` -> `04:05`. */
export function padTime(t: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  return m ? `${m[1]!.padStart(2, '0')}:${m[2]}` : t.trim();
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** The schedule the form describes, or what is wrong with it (the server checks again, and cron in full). */
export function scheduleFromForm(f: ScheduleForm): Parsed<Schedule> {
  switch (f.type) {
    case 'daily':
      return validTime(f.time) ? { ok: true, value: { type: 'daily', time: padTime(f.time) } } : { ok: false, error: 'The time is HH:MM, 00:00 to 23:59.' };
    case 'weekly':
      if (!validTime(f.time)) return { ok: false, error: 'The time is HH:MM, 00:00 to 23:59.' };
      if (f.days.length === 0) return { ok: false, error: 'Choose at least one day.' };
      return { ok: true, value: { type: 'weekly', days: WEEKDAYS.map((d) => d.id).filter((d) => f.days.includes(d)), time: padTime(f.time) } };
    case 'interval': {
      const secs = parseDuration(f.every);
      if (secs === null) return { ok: false, error: 'Write a length like 6h, 90m or 1d.' };
      if (secs < MIN_INTERVAL_SECS || secs > MAX_INTERVAL_SECS) return { ok: false, error: 'An interval is between 1 minute and 30 days.' };
      return { ok: true, value: { type: 'interval', every_secs: secs } };
    }
    case 'cron': {
      const fields = f.cron.trim().split(/\s+/).filter(Boolean);
      if (fields.length !== 5) return { ok: false, error: 'Five fields: minute hour day-of-month month day-of-week.' };
      return { ok: true, value: { type: 'cron', expr: fields.join(' ') } };
    }
  }
}

/** The options of a restart task while editing. */
export interface RestartForm {
  delay: string;
  message: string;
}

export function emptyRestartForm(): RestartForm {
  return { delay: '300', message: '' };
}

export function restartFormFrom(t: TaskKind): RestartForm {
  return { delay: String(t.delay_secs ?? 0), message: t.message ?? '' };
}

export function taskFromForm(f: RestartForm): Parsed<TaskKind> {
  const text = f.delay.trim();
  if (!/^\d+$/.test(text) || Number(text) > MAX_DELAY_SECS) return { ok: false, error: `The countdown is 0 to ${MAX_DELAY_SECS} seconds.` };
  const message = f.message.split(/\s+/).filter(Boolean).join(' ');
  if (message.length > MAX_MESSAGE_CHARS) return { ok: false, error: `The message is at most ${MAX_MESSAGE_CHARS} characters.` };
  return { ok: true, value: { kind: 'restart', delay_secs: Number(text), message: message || null } };
}

export function nameError(name: string): string | null {
  const n = name.trim();
  if (n === '') return 'Give the task a name.';
  if (n.length > MAX_NAME_CHARS) return `The name is at most ${MAX_NAME_CHARS} characters.`;
  return null;
}

/** "in 3 h 10 min", "in 40 s", "now", "overdue". Coarse on purpose: two units at most. */
export function relativeFuture(targetSecs: number, nowSecs: number): string {
  const d = targetSecs - nowSecs;
  if (d < -5) return 'overdue';
  if (d <= 0) return 'now';
  return `in ${spanText(d)}`;
}

/** "5 min ago" and "in ..." counterpart for the past. */
export function relativePast(thenSecs: number, nowSecs: number): string {
  const d = nowSecs - thenSecs;
  if (d < 5) return 'just now';
  return `${spanText(d)} ago`;
}

function spanText(secs: number): string {
  const d = Math.floor(secs / 86_400);
  const h = Math.floor((secs % 86_400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (d > 0) return h > 0 ? `${d} d ${h} h` : `${d} d`;
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

/** A moment in the server's zone: the named zone when the browser knows it, else its fixed offset (`+02:00`). */
export function formatInZone(unixSecs: number, zone: string, offset: string): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
  try {
    return new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: zone }).format(new Date(unixSecs * 1000));
  } catch {
    const m = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
    const shift = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 3600 + Number(m[3]) * 60) : 0;
    return new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }).format(new Date((unixSecs + shift) * 1000));
  }
}

export type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';

export function statusTone(status: string | null | undefined): Tone {
  switch (status) {
    case 'ok':
      return 'ok';
    case 'failed':
      return 'bad';
    case 'skipped':
    case 'missed':
      return 'warn';
    default:
      return 'neutral';
  }
}

const STATUS_LABELS: Record<string, string> = { ok: 'ran', failed: 'failed', skipped: 'skipped', missed: 'missed' };

export function statusLabel(status: string | null | undefined): string {
  return status ? (STATUS_LABELS[status] ?? status) : 'never ran';
}

/** The kinds a task can have, for the select. Add the new kind here when the server gets one. */
export const TASK_KINDS = [{ id: 'restart', label: 'Restart the server' }] as const;
