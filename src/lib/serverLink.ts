/**
 * What the page knows about the server it administers, from its polls: reachable or not, and what
 * was going to happen (a requested stop or restart). A pure reducer so the reconnect logic is
 * testable without a server or a clock.
 */
import type { PendingShutdown } from './api/client';

export interface Link {
  reachable: boolean;
  /** The shutdown that was announced and has not been seen to end yet. */
  expected: PendingShutdown['action'] | null;
  /** Set for one step when the server answers again after an announced shutdown. */
  cameBack: boolean;
  /** Consecutive failed polls. */
  failures: number;
}

export const initialLink: Link = { reachable: true, expected: null, cameBack: false, failures: 0 };

export type LinkEvent =
  | { type: 'ok'; pending: PendingShutdown | null }
  | { type: 'fail' };

export function reduceLink(s: Link, e: LinkEvent): Link {
  if (e.type === 'fail') {
    return { ...s, reachable: false, cameBack: false, failures: s.failures + 1 };
  }
  const expected = e.pending ? e.pending.action : s.expected;
  if (!s.reachable) {
    // Answers again: a restart (or a stop followed by an outside start) completed.
    return { reachable: true, expected: null, cameBack: expected !== null, failures: 0 };
  }
  // Reachable all along: a countdown that vanished without the server going down was cancelled.
  return { reachable: true, expected: e.pending ? expected : null, cameBack: false, failures: 0 };
}

/** The headline for a banner or card, from the link and the pending shutdown. */
export type Phase = 'up' | 'counting' | 'draining' | 'restarting' | 'stopped' | 'unreachable';

export function phaseOf(s: Link, pending: PendingShutdown | null): Phase {
  if (!s.reachable) {
    if (s.expected === 'restart') return 'restarting';
    if (s.expected === 'stop') return 'stopped';
    return 'unreachable';
  }
  if (pending) return pending.cancellable ? 'counting' : 'draining';
  return 'up';
}

/** Seconds as "1 min 30 s". */
export function countdownText(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  const m = Math.floor(s / 60);
  if (m === 0) return `${s} s`;
  return s % 60 === 0 ? `${m} min` : `${m} min ${s % 60} s`;
}
