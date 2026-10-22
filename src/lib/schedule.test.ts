import { describe, expect, it } from 'vitest';
import {
  type Schedule,
  emptyRestartForm,
  emptyScheduleForm,
  formFromSchedule,
  formatEvery,
  formatInZone,
  nameError,
  padTime,
  relativeFuture,
  relativePast,
  restartFormFrom,
  scheduleFromForm,
  statusLabel,
  statusTone,
  taskFromForm,
  validTime,
} from './schedule';

describe('times', () => {
  it('checks HH:MM', () => {
    expect(['0:00', '04:00', '23:59', '9:05'].map(validTime)).toEqual([true, true, true, true]);
    expect(['24:00', '12:60', '4', '4:5', '', 'ab:cd', '12:345'].map(validTime)).toEqual([false, false, false, false, false, false, false]);
    expect([padTime('4:05'), padTime(' 16:30 '), padTime('nope')]).toEqual(['04:05', '16:30', 'nope']);
  });
});

describe('scheduleFromForm', () => {
  const base = emptyScheduleForm();

  it('builds each kind', () => {
    expect(scheduleFromForm({ ...base, type: 'daily', time: '4:00' })).toEqual({ ok: true, value: { type: 'daily', time: '04:00' } });
    expect(scheduleFromForm({ ...base, type: 'weekly', days: ['fri', 'mon'], time: '23:30' })).toEqual({
      ok: true,
      value: { type: 'weekly', days: ['mon', 'fri'], time: '23:30' },
    });
    expect(scheduleFromForm({ ...base, type: 'interval', every: '6h' })).toEqual({ ok: true, value: { type: 'interval', every_secs: 21_600 } });
    expect(scheduleFromForm({ ...base, type: 'cron', cron: ' 0  4 * * mon ' })).toEqual({ ok: true, value: { type: 'cron', expr: '0 4 * * mon' } });
  });

  it('says what is wrong', () => {
    const err = (f: Partial<typeof base>) => {
      const r = scheduleFromForm({ ...base, ...f });
      return r.ok ? null : r.error;
    };
    expect(err({ type: 'daily', time: '25:00' })).toContain('HH:MM');
    expect(err({ type: 'weekly', days: [] })).toContain('at least one day');
    expect(err({ type: 'weekly', time: 'x' })).toContain('HH:MM');
    expect(err({ type: 'interval', every: 'soon' })).toContain('6h');
    expect(err({ type: 'interval', every: '30s' })).toContain('between 1 minute and 30 days');
    expect(err({ type: 'interval', every: '31d' })).toContain('between 1 minute and 30 days');
    expect(err({ type: 'cron', cron: '* * *' })).toContain('Five fields');
    expect(err({ type: 'cron', cron: '' })).toContain('Five fields');
  });

  it('round trips through the form', () => {
    const schedules: Schedule[] = [
      { type: 'daily', time: '04:00' },
      { type: 'weekly', days: ['sat', 'sun'], time: '05:30' },
      { type: 'interval', every_secs: 5400 },
      { type: 'interval', every_secs: 86_400 },
      { type: 'cron', expr: '*/15 * * * *' },
    ];
    for (const s of schedules) {
      expect(scheduleFromForm(formFromSchedule(s))).toEqual({ ok: true, value: s });
    }
  });

  it('writes intervals in the largest even unit', () => {
    expect([formatEvery(60), formatEvery(3600), formatEvery(5400), formatEvery(86_400), formatEvery(90_000), formatEvery(61)]).toEqual(['1m', '1h', '90m', '1d', '25h', '61s']);
  });
});

describe('restart task form', () => {
  it('builds the task with a normalised message', () => {
    expect(taskFromForm({ delay: '300', message: '  back   soon  ' })).toEqual({ ok: true, value: { kind: 'restart', delay_secs: 300, message: 'back soon' } });
    expect(taskFromForm({ delay: '0', message: '' })).toEqual({ ok: true, value: { kind: 'restart', delay_secs: 0, message: null } });
    expect(taskFromForm(emptyRestartForm())).toMatchObject({ ok: true });
  });

  it('refuses a bad countdown or message', () => {
    for (const delay of ['', '-1', '3601', '1.5', 'soon']) expect(taskFromForm({ delay, message: '' }).ok, delay).toBe(false);
    expect(taskFromForm({ delay: '10', message: 'x'.repeat(201) }).ok).toBe(false);
    expect(taskFromForm({ delay: '3600', message: 'x'.repeat(200) }).ok).toBe(true);
  });

  it('fills the form from a stored task', () => {
    expect(restartFormFrom({ kind: 'restart', delay_secs: 60, message: 'hi' })).toEqual({ delay: '60', message: 'hi' });
    expect(restartFormFrom({ kind: 'restart' })).toEqual({ delay: '0', message: '' });
  });

  it('checks the name', () => {
    expect(nameError('')).toBeTruthy();
    expect(nameError('   ')).toBeTruthy();
    expect(nameError('x'.repeat(81))).toBeTruthy();
    expect(nameError('Nightly')).toBeNull();
  });
});

describe('relative times', () => {
  it('speaks in two units at most', () => {
    expect(relativeFuture(100 + 40, 100)).toBe('in 40 s');
    expect(relativeFuture(100 + 90, 100)).toBe('in 1 min');
    expect(relativeFuture(100 + 3 * 3600 + 10 * 60 + 5, 100)).toBe('in 3 h 10 min');
    expect(relativeFuture(100 + 2 * 86_400 + 3600, 100)).toBe('in 2 d 1 h');
    expect(relativeFuture(100 + 86_400, 100)).toBe('in 1 d');
    expect(relativeFuture(100, 100)).toBe('now');
    expect(relativeFuture(50, 100)).toBe('overdue');
    expect(relativePast(100, 102)).toBe('just now');
    expect(relativePast(100, 100 + 7200)).toBe('2 h ago');
  });

  it('shows a moment in the named zone or by offset', () => {
    // 2026-10-22 02:00:00 UTC.
    const t = Date.UTC(2026, 9, 22, 2, 0) / 1000;
    expect(formatInZone(t, 'UTC', '+00:00')).toContain('02:00');
    expect(formatInZone(t, 'Asia/Tokyo', '+09:00')).toContain('11:00');
    // A zone the browser does not know: the fixed offset.
    expect(formatInZone(t, 'UTC+05:30', '+05:30')).toContain('07:30');
    expect(formatInZone(t, 'UTC-03:00', '-03:00')).toContain('23:00');
    expect(formatInZone(t, 'UTC-03:00', '-03:00')).toContain('21 Oct');
  });
});

describe('statuses', () => {
  it('maps a result to a tone and a word', () => {
    expect(['ok', 'failed', 'skipped', 'missed', null, 'weird'].map(statusTone)).toEqual(['ok', 'bad', 'warn', 'warn', 'neutral', 'neutral']);
    expect([statusLabel('ok'), statusLabel('missed'), statusLabel(null), statusLabel('weird')]).toEqual(['ran', 'missed', 'never ran', 'weird']);
  });
});
