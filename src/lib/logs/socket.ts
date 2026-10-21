import { backoffDelay, parseServerMessage, toWireFilter, type LogFilter, type ServerMessage } from './ring';

export type SocketState = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface LogSocketOptions {
  /** The URL for the next attempt (asked at every attempt, so it can carry a fresh single-use ticket). */
  url: () => string | null | Promise<string | null>;
  filter: () => LogFilter;
  onMessage: (m: ServerMessage) => void;
  onState: (s: SocketState, info?: { attempt: number; delayMs?: number }) => void;
  /** An attempt failed before the socket opened: a good time to check whether the token is still valid. */
  onConnectFailed?: () => void;
  WebSocketImpl?: typeof WebSocket;
  setTimeoutImpl?: typeof setTimeout;
  clearTimeoutImpl?: typeof clearTimeout;
}

/** The log WebSocket with reconnect and exponential backoff. */
export class LogSocket {
  private ws: WebSocket | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private stopped = true;
  /** Bumped by start() and stop(): a ticket that arrives for an older run is dropped. */
  private run = 0;

  constructor(private readonly o: LogSocketOptions) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.run += 1;
    this.attempt = 0;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.run += 1;
    (this.o.clearTimeoutImpl ?? clearTimeout)(this.timer ?? undefined);
    this.timer = null;
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try {
        ws.close(1000);
      } catch {
        /* already closed */
      }
    }
    this.o.onState('closed');
  }

  /** Sends the current filter; the server answers `reset` and replays the history. */
  sendFilter(): void {
    const ws = this.ws;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(toWireFilter(this.o.filter())));
  }

  private connect(): void {
    if (this.stopped) return;
    this.o.onState(this.attempt === 0 ? 'connecting' : 'reconnecting', { attempt: this.attempt });
    let url: string | null | Promise<string | null>;
    try {
      url = this.o.url();
    } catch {
      url = null;
    }
    if (typeof url === 'string' || url === null) {
      this.open(url);
      return;
    }
    // A ticket has to be fetched first. If that fails the attempt counts as a failed connect.
    const run = this.run;
    url.then(
      (u) => {
        if (this.run === run) this.open(u);
      },
      () => {
        if (this.run === run) this.retryLater(false);
      },
    );
  }

  private retryLater(opened: boolean): void {
    if (!opened) this.o.onConnectFailed?.();
    const delay = backoffDelay(this.attempt);
    this.attempt += 1;
    this.o.onState('reconnecting', { attempt: this.attempt, delayMs: delay });
    this.timer = (this.o.setTimeoutImpl ?? setTimeout)(() => this.connect(), delay);
  }

  private open(url: string | null): void {
    if (this.stopped) return;
    if (!url) {
      this.o.onState('closed');
      return;
    }
    const Impl = this.o.WebSocketImpl ?? WebSocket;
    const ws = new Impl(url);
    this.ws = ws;
    let opened = false;
    ws.onopen = () => {
      opened = true;
      this.attempt = 0;
      this.o.onState('open');
      // The server waits 500 ms for a filter before using its defaults.
      this.sendFilter();
    };
    ws.onmessage = (ev: MessageEvent) => {
      if (typeof ev.data !== 'string') return;
      const m = parseServerMessage(ev.data);
      if (m) this.o.onMessage(m);
    };
    ws.onclose = () => {
      if (this.ws !== ws || this.stopped) return;
      this.ws = null;
      this.retryLater(opened);
    };
    ws.onerror = () => {
      /* onclose follows and handles the retry */
    };
  }
}
