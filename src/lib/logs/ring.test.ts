import { describe, expect, it } from 'vitest';
import type { LogEvent } from '../api/client';
import {
  DEFAULT_FILTER,
  LogStore,
  backoffDelay,
  logsWsUrl,
  matchesFilter,
  parseServerMessage,
  toWireFilter,
} from './ring';

const ev = (seq: number, over: Partial<LogEvent> = {}): LogEvent => ({
  seq,
  ts_ms: 1_700_000_000_000 + seq,
  level: 'info',
  target: 'instance_server::exec',
  message: `line ${seq}`,
  fields: {},
  ...over,
});

describe('matchesFilter', () => {
  it('filters by minimum level, most severe first', () => {
    const f = { ...DEFAULT_FILTER, min_level: 'warn' as const };
    expect(matchesFilter(f, ev(1, { level: 'error' }))).toBe(true);
    expect(matchesFilter(f, ev(2, { level: 'warn' }))).toBe(true);
    expect(matchesFilter(f, ev(3, { level: 'info' }))).toBe(false);
    expect(matchesFilter(f, ev(4, { level: 'trace' }))).toBe(false);
  });

  it('filters by target prefix', () => {
    const f = { ...DEFAULT_FILTER, target: 'instance_server' };
    expect(matchesFilter(f, ev(1))).toBe(true);
    expect(matchesFilter(f, ev(2, { target: 'poe_net::conn' }))).toBe(false);
    expect(matchesFilter({ ...f, target: 'exec' }, ev(3))).toBe(false);
  });

  it('searches message and fields case-insensitively', () => {
    const f = { ...DEFAULT_FILTER, text: 'KICK' };
    expect(matchesFilter(f, ev(1, { message: 'player kicked' }))).toBe(true);
    expect(matchesFilter(f, ev(2, { fields: { cmd: 'kick bob' } }))).toBe(true);
    expect(matchesFilter(f, ev(3, { fields: { kick: '1' } }))).toBe(true);
    expect(matchesFilter(f, ev(4))).toBe(false);
  });

  it('ignores blank target and text', () => {
    expect(matchesFilter({ ...DEFAULT_FILTER, target: '  ', text: ' ' }, ev(1))).toBe(true);
  });
});

describe('toWireFilter', () => {
  it('leaves out empty strings', () => {
    expect(toWireFilter(DEFAULT_FILTER)).toEqual({ min_level: 'info', history: 200 });
    expect(toWireFilter({ ...DEFAULT_FILTER, target: ' poe_net ', text: 'x' })).toEqual({
      min_level: 'info',
      history: 200,
      target: 'poe_net',
      text: 'x',
    });
  });
});

describe('LogStore', () => {
  it('keeps at most cap lines, dropping the oldest', () => {
    const s = new LogStore(5);
    s.push([1, 2, 3].map((n) => ev(n)));
    s.push([4, 5, 6, 7].map((n) => ev(n)));
    expect(s.length).toBe(5);
    expect(s.snapshot().map((e) => e.seq)).toEqual([3, 4, 5, 6, 7]);
    expect(s.dropped).toBe(2);
  });

  it('handles a single batch bigger than the cap', () => {
    const s = new LogStore(3);
    s.push(Array.from({ length: 10 }, (_, i) => ev(i)));
    expect(s.snapshot().map((e) => e.seq)).toEqual([7, 8, 9]);
  });

  it('snapshot is a copy (the paused view does not change)', () => {
    const s = new LogStore(10);
    s.push([ev(1)]);
    const snap = s.snapshot();
    s.push([ev(2)]);
    expect(snap).toHaveLength(1);
    expect(s.length).toBe(2);
  });

  it('clear resets', () => {
    const s = new LogStore(2);
    s.push([ev(1), ev(2), ev(3)]);
    s.clear();
    expect(s.length).toBe(0);
    expect(s.dropped).toBe(0);
  });

  it('rejects a zero cap', () => {
    expect(() => new LogStore(0)).toThrow(RangeError);
  });
});

describe('parseServerMessage', () => {
  it('parses every message type of the protocol', () => {
    expect(parseServerMessage('{"type":"hello","buffer":2000}')).toEqual({ type: 'hello', buffer: 2000 });
    expect(parseServerMessage('{"type":"reset"}')).toEqual({ type: 'reset' });
    expect(parseServerMessage('{"type":"lagged","missed":12}')).toEqual({ type: 'lagged', missed: 12 });
    expect(parseServerMessage('{"type":"error","message":"bad filter"}')).toEqual({
      type: 'error',
      message: 'bad filter',
    });
    const m = parseServerMessage(JSON.stringify({ type: 'event', event: ev(5) }));
    expect(m).toMatchObject({ type: 'event', event: { seq: 5, message: 'line 5' } });
  });

  it('rejects garbage', () => {
    expect(parseServerMessage('not json')).toBeNull();
    expect(parseServerMessage('{"type":"nope"}')).toBeNull();
    expect(parseServerMessage('{"type":"event"}')).toBeNull();
    expect(parseServerMessage('[]')).toBeNull();
  });
});

describe('backoffDelay', () => {
  it('doubles from 500 ms up to a 15 s cap', () => {
    expect([0, 1, 2, 3].map((a) => backoffDelay(a, 0))).toEqual([500, 1000, 2000, 4000]);
    expect(backoffDelay(10, 0)).toBe(15_000);
    expect(backoffDelay(50, 0)).toBe(15_000);
  });
  it('adds up to 25 % jitter', () => {
    expect(backoffDelay(0, 0.999)).toBeLessThanOrEqual(625);
    expect(backoffDelay(0, 0.999)).toBeGreaterThan(600);
  });
});

describe('logsWsUrl', () => {
  it('picks ws or wss and encodes the token', () => {
    expect(logsWsUrl({ protocol: 'http:', host: 'h:8080' }, 'a b')).toBe(
      'ws://h:8080/api/v1/admin/logs/ws?token=a%20b',
    );
    expect(logsWsUrl({ protocol: 'https:', host: 'h' }, 't')).toBe('wss://h/api/v1/admin/logs/ws?token=t');
  });
});
