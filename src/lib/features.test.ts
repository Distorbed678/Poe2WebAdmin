import { describe, expect, it } from 'vitest';
import { parseFlag } from './features';

describe('parseFlag', () => {
  it('is off by default', () => {
    expect(parseFlag(undefined)).toBe(false);
    expect(parseFlag('')).toBe(false);
    expect(parseFlag('0')).toBe(false);
    expect(parseFlag('false')).toBe(false);
  });
  it('accepts the usual on values', () => {
    for (const v of ['1', 'true', 'TRUE', ' on ', 'yes']) expect(parseFlag(v)).toBe(true);
  });
});
