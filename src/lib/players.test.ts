import { describe, expect, it } from 'vitest';
import { type Ban, type Player, banEnds, banLength, banTarget, banTone, classLevel, connectedFor, filterPlayers, sortPlayers } from './players';

function player(over: Partial<Player>): Player {
  return {
    character: 'Bob',
    account: 'bobby',
    account_id: 1,
    area: 'G1_1',
    connected_at: 1000,
    muted: false,
    ...over,
  } as Player;
}

const PLAYERS = [
  player({ character: 'Zed', account: 'alice', level: 5, instance: 12, ip: '10.0.0.5', connected_at: 300 }),
  player({ character: 'Amy', account: 'carol', level: 40, area: 'G2_town', instance: 7, ip: '192.168.1.9', muted: true, connected_at: 100 }),
  player({ character: 'Bob', account: 'bobby', level: null, ip: null, connected_at: 200 }),
];

describe('filterPlayers', () => {
  it('matches every word anywhere', () => {
    expect(filterPlayers(PLAYERS, '').length).toBe(3);
    expect(filterPlayers(PLAYERS, 'zed').map((p) => p.character)).toEqual(['Zed']);
    expect(filterPlayers(PLAYERS, 'g2_town carol').map((p) => p.character)).toEqual(['Amy']);
    expect(filterPlayers(PLAYERS, '192.168').map((p) => p.character)).toEqual(['Amy']);
    expect(filterPlayers(PLAYERS, '#12').map((p) => p.character)).toEqual(['Zed']);
    expect(filterPlayers(PLAYERS, 'muted').map((p) => p.character)).toEqual(['Amy']);
    expect(filterPlayers(PLAYERS, 'lvl40').map((p) => p.character)).toEqual(['Amy']);
    expect(filterPlayers(PLAYERS, 'zed carol')).toEqual([]);
    expect(filterPlayers(PLAYERS, '  BOB  ').map((p) => p.character)).toEqual(['Bob']);
  });
});

describe('sortPlayers', () => {
  it('sorts by the chosen column without changing the input', () => {
    const names = (by: Parameters<typeof sortPlayers>[1]) => sortPlayers(PLAYERS, by).map((p) => p.character);
    expect(names('character')).toEqual(['Amy', 'Bob', 'Zed']);
    expect(names('account')).toEqual(['Zed', 'Bob', 'Amy']);
    expect(names('level')).toEqual(['Amy', 'Zed', 'Bob']);
    expect(names('connected')).toEqual(['Amy', 'Bob', 'Zed']);
    expect(PLAYERS[0]!.character).toBe('Zed');
  });
});

describe('words', () => {
  it('writes how long a session has lasted and what class it is', () => {
    expect(connectedFor(1000, 1030)).toBe('30s');
    expect(connectedFor(1000, 1000 + 3 * 3600 + 120)).toBe('3h 2m');
    expect(connectedFor(1000, 10)).toBe('0s');
    expect(classLevel({ class_id: 3, level: 17 })).toBe('class 3, level 17');
    expect(classLevel({ class_id: null, level: null })).toBe('-');
  });

  const ban = (over: Partial<Ban>): Ban =>
    ({ id: 1, kind: 'account', account: 'alice', account_id: 3, reason: '', created_by: 'root', created_at: 0, status: 'active', ...over }) as Ban;

  it('names ban targets, tones and ends', () => {
    expect(banTarget(ban({}))).toBe('alice');
    expect(banTarget(ban({ kind: 'ip', ip: '10.0.0.1', account: null }))).toBe('10.0.0.1');
    expect(banTarget(ban({ account: null }))).toBe('account 3');
    expect(banTone(ban({}))).toBe('bad');
    expect(banTone(ban({ status: 'expired' }))).toBe('neutral');
    expect(banEnds(ban({ expires_at: null }), 100)).toBe('permanent');
    expect(banEnds(ban({ expires_at: 100 + 7200 }), 100)).toBe('ends in 2 h');
    expect(banEnds(ban({ status: 'expired', expires_at: 100 }), 100 + 86_400)).toBe('ended 1 d ago');
    expect(banEnds(ban({ status: 'lifted', lifted_at: 100, lifted_by: 'mod' }), 100 + 3600)).toBe('lifted 1 h ago by mod');
  });

  it('builds the length part of a request', () => {
    expect(banLength(3600)).toEqual({ duration_secs: 3600 });
    expect(banLength(null)).toEqual({});
  });
});
