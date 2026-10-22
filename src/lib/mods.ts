/** The mods page: how a mod's state looks and reads. */
import type { ModStatusInfo } from './api/client';

export type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';

/** The chip tone of a state word from `GET /admin/mods`. */
export function stateTone(state: string): Tone {
  switch (state) {
    case 'loaded':
      return 'ok';
    case 'skipped':
    case 'failed':
      return 'bad';
    case 'installed':
      return 'neutral';
    default:
      return 'info';
  }
}

/** What a side means for a player: where the mod runs. */
export function sideLabel(side: string): string {
  switch (side) {
    case 'client':
      return 'client (players download it)';
    case 'server':
      return 'server only';
    case 'both':
      return 'server and client';
    default:
      return side || 'unknown';
  }
}

/** Counts per state, in a fixed order, for the summary line. */
export function summarize(mods: readonly ModStatusInfo[]): string {
  const count = (s: string) => mods.filter((m) => m.state === s).length;
  const parts = [
    [count('loaded'), 'loaded'],
    [count('skipped'), 'skipped'],
    [count('failed'), 'failed'],
    [count('installed'), 'not enabled'],
  ] as const;
  const text = parts.filter(([n]) => n > 0).map(([n, w]) => `${n} ${w}`);
  return text.length ? text.join(', ') : 'no mods';
}
