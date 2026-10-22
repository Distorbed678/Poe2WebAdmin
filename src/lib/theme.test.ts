import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveTheme, theme, THEME_KEY } from './theme.svelte';

describe('resolveTheme', () => {
  it('prefers a valid saved choice over the system', () => {
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('dark', true)).toBe('dark');
  });
  it('falls back to the system for nothing or garbage', () => {
    expect(resolveTheme(null, true)).toBe('light');
    expect(resolveTheme(undefined, false)).toBe('dark');
    expect(resolveTheme('purple', true)).toBe('light');
  });
});

describe('theme store', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('applies the system preference, then remembers a toggle', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => {} }));
    theme.init();
    expect(document.documentElement.dataset.theme).toBe('light');
    theme.toggle();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
  });

  it('survives storage that throws', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {} }));
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    theme.init();
    expect(document.documentElement.dataset.theme).toBe('dark');
    theme.toggle();
    expect(document.documentElement.dataset.theme).toBe('light');
    vi.restoreAllMocks();
  });
});
