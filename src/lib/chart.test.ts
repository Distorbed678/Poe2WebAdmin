import { describe, expect, it } from 'vitest';
import {
  RANGES,
  areaPath,
  formatBytes,
  formatMicros,
  formatPercent,
  linePath,
  linear,
  nearestIndex,
  niceCeil,
  pollMs,
  timeTicks,
  yTicks,
} from './chart';

describe('scales', () => {
  it('maps a domain onto a range, also reversed (SVG y grows downwards)', () => {
    const x = linear([0, 10], [0, 100]);
    expect([x(0), x(5), x(10), x(20)]).toEqual([0, 50, 100, 200]);
    const y = linear([0, 4], [200, 20]);
    expect([y(0), y(4), y(2)]).toEqual([200, 20, 110]);
  });

  it('centres a flat domain instead of dividing by zero', () => {
    expect(linear([3, 3], [0, 100])(3)).toBe(50);
  });

  it('rounds up to nice numbers', () => {
    expect([0.9, 1, 1.1, 2.1, 2.6, 5.1, 7, 11, 96, 101, 480].map(niceCeil)).toEqual([1, 1, 2, 2.5, 5, 10, 10, 20, 100, 200, 500]);
    expect([0, -5, NaN, Infinity].map(niceCeil)).toEqual([1, 1, 1, 1]);
  });

  it('picks a y axis from 0 with whole steps', () => {
    expect(yTicks(0)).toEqual({ ticks: [0, 1, 2, 3, 4], top: 4 });
    expect(yTicks(7)).toEqual({ ticks: [0, 2, 4, 6, 8], top: 8 });
    expect(yTicks(96)).toEqual({ ticks: [0, 25, 50, 75, 100], top: 100 });
    expect(yTicks(3200, 4).top).toBe(4000);
    const { ticks, top } = yTicks(0.31);
    expect(top).toBeGreaterThanOrEqual(0.31);
    expect(ticks[ticks.length - 1]).toBe(top);
  });
});

describe('time axis', () => {
  const HOUR = 3_600_000;
  it('aligns ticks to the clock', () => {
    const from = Date.UTC(2026, 9, 22, 10, 7);
    const to = from + HOUR;
    const t = timeTicks(from, to, 4);
    expect(t.length).toBeGreaterThanOrEqual(3);
    for (const x of t) {
      expect(x).toBeGreaterThanOrEqual(from);
      expect(x).toBeLessThanOrEqual(to);
      expect(x % (5 * 60_000)).toBe(0);
    }
    expect(t[1]! - t[0]!).toBe(15 * 60_000);
  });

  it('follows the zone offset', () => {
    const from = Date.UTC(2026, 0, 1, 0, 0);
    const ticks = timeTicks(from, from + 6 * HOUR, 3, 5.5 * HOUR);
    // Ticks fall on local multiples of the step: UTC+5:30 puts them at :30.
    expect(((ticks[0]! % HOUR) + HOUR) % HOUR).toBe(30 * 60_000);
  });

  it('is empty for an empty or reversed span', () => {
    expect(timeTicks(10, 10)).toEqual([]);
    expect(timeTicks(10, 5)).toEqual([]);
  });

  it('polls as often as the data changes, never faster than a sample', () => {
    expect(RANGES.map((r) => pollMs(r.secs))).toEqual([5000, 6000, 36_000, 60_000]);
    expect(pollMs(60, 10)).toBe(10_000);
  });
});

describe('paths', () => {
  const x = (t: number) => t;
  const y = (v: number) => 100 - v;
  it('draws a line and breaks it at gaps', () => {
    expect(linePath([{ t: 0, v: 10 }, { t: 5, v: 20 }, { t: 10, v: null }, { t: 15, v: 30 }], x, y)).toBe('M0.0 90.0L5.0 80.0M15.0 70.0');
    expect(linePath([], x, y)).toBe('');
    expect(linePath([{ t: 0, v: null }], x, y)).toBe('');
    expect(linePath([{ t: 0, v: NaN }, { t: 1, v: 5 }], x, y)).toBe('M1.0 95.0');
  });

  it('fills down to the baseline, one shape per run', () => {
    const d = areaPath([{ t: 0, v: 10 }, { t: 10, v: 20 }, { t: 20, v: null }, { t: 30, v: 5 }], x, y, 100);
    expect(d).toBe('M0.0 100.0L0.0 90.0L10.0 80.0L10.0 100.0ZM30.0 100.0L30.0 95.0L30.0 100.0Z');
    expect(areaPath([], x, y, 100)).toBe('');
  });

  it('finds the point nearest in time', () => {
    const t = [0, 10, 20, 30];
    expect([nearestIndex(t, -5), nearestIndex(t, 4), nearestIndex(t, 6), nearestIndex(t, 25), nearestIndex(t, 99)]).toEqual([0, 0, 1, 2, 3]);
    expect(nearestIndex(t, 25)).toBe(2); // a tie goes to the earlier point
    expect(nearestIndex([], 5)).toBe(-1);
  });
});

describe('formatting', () => {
  it('writes sizes, times and percentages', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(900)).toBe('900 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(50_000_000)).toBe('47.7 MB');
    expect(formatBytes(150 * 1024 * 1024)).toBe('150 MB');
    expect(formatMicros(850)).toBe('850 µs');
    expect(formatMicros(1400)).toBe('1.4 ms');
    expect(formatMicros(120_000)).toBe('120 ms');
    expect(formatPercent(4.52)).toBe('4.5%');
    expect(formatPercent(250)).toBe('250%');
  });
});
