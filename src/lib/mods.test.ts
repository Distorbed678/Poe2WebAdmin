import { describe, expect, it } from 'vitest';
import type { ModStatusInfo } from './api/client';
import { sideLabel, stateTone, summarize } from './mods';

const mod = (state: string): ModStatusInfo => ({
  id: 'x',
  name: 'x',
  version: '1.0.0',
  side: 'server',
  enabled: state !== 'installed',
  state,
  detail: '',
  commands: [],
});

describe('mods page helpers', () => {
  it('colours the states', () => {
    expect(stateTone('loaded')).toBe('ok');
    expect(stateTone('skipped')).toBe('bad');
    expect(stateTone('failed')).toBe('bad');
    expect(stateTone('installed')).toBe('neutral');
    expect(stateTone('whatever')).toBe('info');
  });

  it('says where a mod runs', () => {
    expect(sideLabel('both')).toBe('server and client');
    expect(sideLabel('server')).toBe('server only');
    expect(sideLabel('client')).toContain('players download');
    expect(sideLabel('')).toBe('unknown');
  });

  it('summarizes the counts', () => {
    expect(summarize([])).toBe('no mods');
    expect(summarize([mod('loaded'), mod('loaded'), mod('skipped'), mod('installed')])).toBe(
      '2 loaded, 1 skipped, 1 not enabled',
    );
  });
});
