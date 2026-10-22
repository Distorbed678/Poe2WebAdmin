import { api, ApiError, unwrap, type PendingShutdown, type ServerInfo } from './api/client';
import { initialLink, phaseOf, reduceLink, type Link, type LinkEvent, type Phase } from './serverLink';
import { toasts } from './notify.svelte';

const CALM_MS = 5000;
const WATCH_MS = 1500;

/**
 * Polls the server's public info and the pending shutdown while an admin is signed in, so every
 * page can show "restarting in 30 s", "server unreachable" and notice when it is back. A web
 * session lives in the database, so it survives a restart; the first answer after an outage
 * checks it once (a 401 sends the page to the login through the API client).
 */
class ServerLink {
  link = $state<Link>(initialLink);
  pending = $state<PendingShutdown | null>(null);
  info = $state<ServerInfo | null>(null);
  /** Counts the times the server came back after an announced shutdown (pages may reload on it). */
  returns = $state(0);
  phase = $derived<Phase>(phaseOf(this.link, this.pending));
  /** Wall-clock end of the pending countdown, and a clock ticking while one runs. */
  private endsAt = $state(0);
  private now = $state(Date.now());
  /** Whole seconds left of the pending countdown (0 without one), ticking between the polls. */
  remaining = $derived(this.pending ? Math.max(0, Math.ceil((this.endsAt - this.now) / 1000)) : 0);

  private timer: ReturnType<typeof setTimeout> | undefined;
  private ticker: ReturnType<typeof setInterval> | undefined;
  private running = false;

  /** Starts polling; the returned function stops it. */
  start(): () => void {
    this.running = true;
    void this.poll();
    this.ticker = setInterval(() => {
      if (this.pending) this.now = Date.now();
    }, 250);
    return () => {
      this.running = false;
      clearTimeout(this.timer);
      clearInterval(this.ticker);
    };
  }

  /** Polls now (after the admin asked for something) and restarts the timer. */
  async refresh(): Promise<void> {
    clearTimeout(this.timer);
    await this.poll();
  }

  private apply(e: LinkEvent): void {
    const next = reduceLink(this.link, e);
    this.link = next;
    if (next.cameBack) {
      this.returns += 1;
      toasts.show('ok', 'The server is back online');
    }
  }

  private async poll(): Promise<void> {
    let ok = false;
    try {
      const info = await unwrap(api.GET('/api/v1/server'));
      const status = await unwrap(api.GET('/api/v1/admin/server/shutdown'));
      this.info = info;
      this.pending = status.pending ?? null;
      this.now = Date.now();
      this.endsAt = this.now + (this.pending?.remaining_secs ?? 0) * 1000;
      this.apply({ type: 'ok', pending: this.pending });
      ok = true;
      if (this.link.cameBack) await this.checkSession();
    } catch (e) {
      // 401: the client already cleared the token and the login page explains it.
      if (!(e instanceof ApiError && e.status === 401)) {
        // Network errors and a proxy's 5xx mean the server is not answering; a 4xx is no outage.
        const outage = !(e instanceof ApiError) || e.status >= 500;
        if (outage) this.apply({ type: 'fail' });
        else ok = true;
      }
    }
    if (!ok && !this.link.reachable) this.pending = null;
    this.schedule();
  }

  private async checkSession(): Promise<void> {
    try {
      await unwrap(api.GET('/api/v1/me'));
    } catch {
      /* a 401 is handled by the API client */
    }
  }

  private schedule(): void {
    if (!this.running) return;
    const fast = this.pending !== null || !this.link.reachable;
    this.timer = setTimeout(() => {
      if (fast || !document.hidden) void this.poll();
      else this.schedule();
    }, fast ? WATCH_MS : CALM_MS);
  }
}

export const server = new ServerLink();
