/** The players page: filtering the list and the words for bans. */
import type { components } from './api/schema';
import { formatDuration } from './duration';
import { relativeFuture, relativePast, type Tone } from './schedule';

type Schemas = components['schemas'];
export type Player = Schemas['OnlinePlayerInfo'];
export type Ban = Schemas['BanView'];

/** Matches the query against character, account, area, address, class and `#instance`, all words must match. */
export function filterPlayers(players: readonly Player[], query: string): Player[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...players];
  return players.filter((p) => {
    const hay = [p.character, p.account, p.area, p.ip ?? '', p.instance != null ? `#${p.instance}` : '', p.muted ? 'muted' : '', p.level != null ? `lvl${p.level}` : '']
      .join(' ')
      .toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

export type PlayerSort = 'character' | 'account' | 'level' | 'connected';

export function sortPlayers(players: readonly Player[], by: PlayerSort): Player[] {
  const cmp: Record<PlayerSort, (a: Player, b: Player) => number> = {
    character: (a, b) => a.character.localeCompare(b.character),
    account: (a, b) => a.account.localeCompare(b.account) || a.character.localeCompare(b.character),
    level: (a, b) => (b.level ?? -1) - (a.level ?? -1) || a.character.localeCompare(b.character),
    connected: (a, b) => a.connected_at - b.connected_at || a.character.localeCompare(b.character),
  };
  return [...players].sort(cmp[by]);
}

/** "12 min" since the session started. */
export function connectedFor(connectedAt: number, nowSecs: number): string {
  return formatDuration(Math.max(0, nowSecs - connectedAt)).split(' ').slice(0, 2).join(' ') || '0s';
}

/** "Class 3, level 17" with what is known. */
export function classLevel(p: Pick<Player, 'class_id' | 'level'>): string {
  const parts: string[] = [];
  if (p.class_id != null) parts.push(`class ${p.class_id}`);
  if (p.level != null) parts.push(`level ${p.level}`);
  return parts.length > 0 ? parts.join(', ') : '-';
}

export function banTarget(b: Ban): string {
  return b.kind === 'ip' ? (b.ip ?? '?') : (b.account ?? `account ${b.account_id ?? '?'}`);
}

export function banTone(b: Ban): Tone {
  return b.status === 'active' ? 'bad' : 'neutral';
}

/** When a ban ends, or how it ended. */
export function banEnds(b: Ban, nowSecs: number): string {
  if (b.status === 'lifted') return `lifted ${relativePast(b.lifted_at ?? 0, nowSecs)}${b.lifted_by ? ` by ${b.lifted_by}` : ''}`;
  if (b.expires_at == null) return 'permanent';
  return b.status === 'expired' ? `ended ${relativePast(b.expires_at, nowSecs)}` : `ends ${relativeFuture(b.expires_at, nowSecs)}`;
}

/** The `duration_secs` / `expires_at` part of a ban request for the chosen length (`null`: permanent). */
export function banLength(secs: number | null): { duration_secs?: number } {
  return secs === null ? {} : { duration_secs: secs };
}

/** Quick lengths of the ban dialog. */
export const BAN_QUICK: readonly { label: string; secs: number | null }[] = [
  { label: '1 hour', secs: 3600 },
  { label: '1 day', secs: 86_400 },
  { label: '7 days', secs: 7 * 86_400 },
  { label: '30 days', secs: 30 * 86_400 },
  { label: 'Permanent', secs: null },
];
