import { describe, expect, it } from 'vitest';
import { banLengthOk, formatDuration, parseDuration } from './duration';

describe('parseDuration', () => {
  it('reads units and combinations', () => {
    expect(parseDuration('30s')).toBe(30);
    expect(parseDuration('30m')).toBe(1800);
    expect(parseDuration('12h')).toBe(43_200);
    expect(parseDuration('7d')).toBe(604_800);
    expect(parseDuration('2w')).toBe(1_209_600);
    expect(parseDuration('1h30m')).toBe(5400);
    expect(parseDuration(' 1d 12h ')).toBe(129_600);
    expect(parseDuration('1H')).toBe(3600);
  });

  it('reads a bare number as minutes', () => {
    expect(parseDuration('90')).toBe(5400);
    expect(parseDuration('1')).toBe(60);
  });

  it('refuses everything else', () => {
    for (const bad of ['', '  ', '0', '0m', 'abc', '1x', 'h', '1.5h', '-5m', '1h 30', '5m3', '1 h 2']) {
      expect(parseDuration(bad), JSON.stringify(bad)).toBeNull();
    }
    expect(parseDuration('99999999999999999999999d')).toBeNull();
  });
});

describe('formatDuration', () => {
  it('writes the largest units first', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(59)).toBe('59s');
    expect(formatDuration(5400)).toBe('1h 30m');
    expect(formatDuration(86_400)).toBe('1d');
    expect(formatDuration(8 * 86_400 + 61)).toBe('1w 1d 1m 1s');
  });

  it('round trips what it writes', () => {
    for (const secs of [60, 3600, 90_061, 604_800]) expect(parseDuration(formatDuration(secs))).toBe(secs);
  });
});

describe('banLengthOk', () => {
  it('matches the server limits', () => {
    expect([59, 60, 3600, 10 * 365 * 86_400, 10 * 365 * 86_400 + 1, 1.5].map(banLengthOk)).toEqual([false, true, true, true, false, false]);
  });
});
