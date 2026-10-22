import { describe, expect, it } from 'vitest';
import { MAX_DELAY_SECS, parseDelay } from './shutdown';

describe('parseDelay', () => {
  it('reads strings and numbers alike', () => {
    expect(parseDelay('30')).toBe(30);
    expect(parseDelay(30)).toBe(30);
    expect(parseDelay(' 0 ')).toBe(0);
    expect(parseDelay(MAX_DELAY_SECS)).toBe(MAX_DELAY_SECS);
  });
  it('rejects empty, out of range and non-integer input', () => {
    for (const bad of [null, undefined, '', '  ', MAX_DELAY_SECS + 1, '99999999', -1, '-5', 1.5, '1.5', '1e3', 'soon', NaN]) {
      expect(parseDelay(bad), String(bad)).toBeNull();
    }
  });
});
