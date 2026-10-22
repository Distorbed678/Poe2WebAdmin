import { describe, expect, it } from 'vitest';
import type { PendingShutdown } from './api/client';
import { countdownText, initialLink, phaseOf, reduceLink, type Link, type LinkEvent } from './serverLink';

const pending = (action: 'stop' | 'restart', over: Partial<PendingShutdown> = {}): PendingShutdown => ({
  action,
  remaining_secs: 30,
  delay_secs: 30,
  message: null,
  requested_by: 'root',
  cancellable: true,
  ...over,
});

const run = (events: LinkEvent[]): Link => events.reduce(reduceLink, initialLink);

describe('server link', () => {
  it('stays up while polls succeed', () => {
    const s = run([{ type: 'ok', pending: null }, { type: 'ok', pending: null }]);
    expect(s).toEqual(initialLink);
    expect(phaseOf(s, null)).toBe('up');
  });

  it('counts down, goes away and comes back after a restart', () => {
    let s = run([{ type: 'ok', pending: pending('restart') }]);
    expect(phaseOf(s, pending('restart'))).toBe('counting');
    expect(phaseOf(s, pending('restart', { cancellable: false }))).toBe('draining');
    s = reduceLink(s, { type: 'fail' });
    expect(s.reachable).toBe(false);
    expect(phaseOf(s, null)).toBe('restarting');
    s = reduceLink(s, { type: 'fail' });
    expect(s.failures).toBe(2);
    s = reduceLink(s, { type: 'ok', pending: null });
    expect(s).toEqual({ reachable: true, expected: null, cameBack: true, failures: 0 });
    expect(phaseOf(s, null)).toBe('up');
    // The flag lasts one step.
    expect(reduceLink(s, { type: 'ok', pending: null }).cameBack).toBe(false);
  });

  it('shows a stop as stopped, and recovers when the server is started again', () => {
    let s = run([{ type: 'ok', pending: pending('stop') }, { type: 'fail' }]);
    expect(phaseOf(s, null)).toBe('stopped');
    s = reduceLink(s, { type: 'ok', pending: null });
    expect(s.cameBack).toBe(true);
  });

  it('calls an unannounced outage unreachable and quiet when it returns', () => {
    let s = run([{ type: 'fail' }]);
    expect(phaseOf(s, null)).toBe('unreachable');
    s = reduceLink(s, { type: 'ok', pending: null });
    expect(s.cameBack).toBe(false);
    expect(s.reachable).toBe(true);
  });

  it('forgets a countdown that was cancelled', () => {
    let s = run([{ type: 'ok', pending: pending('stop') }]);
    expect(s.expected).toBe('stop');
    s = reduceLink(s, { type: 'ok', pending: null });
    expect(s.expected).toBeNull();
    s = reduceLink(s, { type: 'fail' });
    expect(phaseOf(s, null)).toBe('unreachable');
  });

  it('formats countdowns', () => {
    expect(countdownText(5)).toBe('5 s');
    expect(countdownText(60)).toBe('1 min');
    expect(countdownText(95)).toBe('1 min 35 s');
    expect(countdownText(-3)).toBe('0 s');
  });
});
