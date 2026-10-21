import { describe, expect, it } from 'vitest';
import { hrefFor, parseHash } from './router.svelte';

describe('hash routes', () => {
  it('parses segments and query', () => {
    const r = parseHash('#/characters/12?account=bob%20x');
    expect(r.segments).toEqual(['characters', '12']);
    expect(r.query.get('account')).toBe('bob x');
  });
  it('treats an empty hash as no segments', () => {
    expect(parseHash('').segments).toEqual([]);
    expect(parseHash('#/').segments).toEqual([]);
  });
  it('builds hrefs, skipping empty query values', () => {
    expect(hrefFor('characters', { account: 'bob', x: '' })).toBe('#/characters?account=bob');
    expect(hrefFor('/logs')).toBe('#/logs');
  });
});
