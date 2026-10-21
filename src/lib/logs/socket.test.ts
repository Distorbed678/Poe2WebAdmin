import { describe, expect, it, vi } from 'vitest';
import { LogSocket } from './socket';
import { DEFAULT_FILTER } from './ring';

class FakeWs {
  static all: FakeWs[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  constructor(readonly url: string) {
    FakeWs.all.push(this);
  }
  send(s: string) {
    this.sent.push(s);
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
}

describe('LogSocket', () => {
  it('sends the filter on open, forwards messages, reconnects with backoff', () => {
    FakeWs.all = [];
    const timers: Array<{ fn: () => void; ms: number }> = [];
    const states: string[] = [];
    const messages: unknown[] = [];
    const failed = vi.fn();
    const s = new LogSocket({
      url: () => 'ws://x/logs',
      filter: () => DEFAULT_FILTER,
      onMessage: (m) => messages.push(m),
      onState: (st) => states.push(st),
      onConnectFailed: failed,
      WebSocketImpl: FakeWs as unknown as typeof WebSocket,
      setTimeoutImpl: ((fn: () => void, ms: number) => {
        timers.push({ fn, ms });
        return 1;
      }) as unknown as typeof setTimeout,
      clearTimeoutImpl: (() => {}) as unknown as typeof clearTimeout,
    });
    s.start();
    const ws = FakeWs.all[0]!;
    ws.open();
    expect(JSON.parse(ws.sent[0]!)).toEqual({ min_level: 'info', history: 200 });
    ws.onmessage?.({ data: '{"type":"reset"}' });
    expect(messages).toEqual([{ type: 'reset' }]);

    ws.drop(); // was open: no connect-failed signal
    expect(failed).not.toHaveBeenCalled();
    expect(timers).toHaveLength(1);
    expect(timers[0]!.ms).toBeGreaterThanOrEqual(500);
    timers[0]!.fn();
    expect(FakeWs.all).toHaveLength(2);

    FakeWs.all[1]!.drop(); // never opened
    expect(failed).toHaveBeenCalledOnce();
    expect(timers[1]!.ms).toBeGreaterThanOrEqual(1000);
    expect(states).toContain('open');
    expect(states).toContain('reconnecting');

    s.stop();
    expect(states.at(-1)).toBe('closed');
    timers[1]!.fn(); // a timer that fires after stop() must not reconnect
    expect(FakeWs.all).toHaveLength(2);
  });

  it('asks for a fresh ticket before every attempt and survives a failed ask', async () => {
    FakeWs.all = [];
    const timers: Array<{ fn: () => void; ms: number }> = [];
    const states: string[] = [];
    const failed = vi.fn();
    let n = 0;
    const s = new LogSocket({
      url: async () => {
        n += 1;
        if (n === 2) throw new Error('ticket refused');
        return `ws://x/logs?ticket=t${n}`;
      },
      filter: () => DEFAULT_FILTER,
      onMessage: () => {},
      onState: (st) => states.push(st),
      onConnectFailed: failed,
      WebSocketImpl: FakeWs as unknown as typeof WebSocket,
      setTimeoutImpl: ((fn: () => void, ms: number) => {
        timers.push({ fn, ms });
        return 1;
      }) as unknown as typeof setTimeout,
      clearTimeoutImpl: (() => {}) as unknown as typeof clearTimeout,
    });
    s.start();
    await Promise.resolve();
    await Promise.resolve();
    expect(FakeWs.all.map((w) => w.url)).toEqual(['ws://x/logs?ticket=t1']);
    FakeWs.all[0]!.open();
    FakeWs.all[0]!.drop();
    timers[0]!.fn(); // second attempt: the ticket request fails
    await Promise.resolve();
    await Promise.resolve();
    expect(FakeWs.all).toHaveLength(1);
    expect(failed).toHaveBeenCalledOnce();
    expect(timers).toHaveLength(2);
    timers[1]!.fn(); // third attempt: a fresh ticket
    await Promise.resolve();
    await Promise.resolve();
    expect(FakeWs.all.map((w) => w.url)).toEqual(['ws://x/logs?ticket=t1', 'ws://x/logs?ticket=t3']);
    // stop() while a ticket is on its way: no socket is opened afterwards.
    s.stop();
    expect(states.at(-1)).toBe('closed');
  });

  it('opens nothing when the ticket arrives after stop()', async () => {
    FakeWs.all = [];
    let release: (u: string) => void = () => {};
    const s = new LogSocket({
      url: () => new Promise<string>((r) => (release = r)),
      filter: () => DEFAULT_FILTER,
      onMessage: () => {},
      onState: () => {},
      WebSocketImpl: FakeWs as unknown as typeof WebSocket,
    });
    s.start();
    s.stop();
    release('ws://x/late');
    await Promise.resolve();
    await Promise.resolve();
    expect(FakeWs.all).toHaveLength(0);
  });
});
