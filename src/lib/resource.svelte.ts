import { ApiError } from './api/client';

/** Data loaded from the API, refreshed on demand or by polling. */
export class Resource<T> {
  data = $state<T | undefined>(undefined);
  error = $state<string | null>(null);
  loading = $state(false);
  updated = $state<Date | null>(null);
  private inflight = false;

  constructor(private readonly fetcher: () => Promise<T>) {}

  async load(): Promise<void> {
    if (this.inflight) return;
    this.inflight = true;
    this.loading = true;
    try {
      this.data = await this.fetcher();
      this.error = null;
      this.updated = new Date();
    } catch (e) {
      // A 401 is handled by the client (back to login); keep the stale data otherwise.
      this.error = e instanceof ApiError || e instanceof Error ? e.message : String(e);
    } finally {
      this.loading = false;
      this.inflight = false;
    }
  }

  /**
   * Loads now and then every `ms` while the tab is visible. Use as an effect:
   * `$effect(() => res.start(5000))`; the return value stops it.
   */
  start(ms?: number): () => void {
    void this.load();
    if (!ms) return () => {};
    const id = setInterval(() => {
      if (!document.hidden) void this.load();
    }, ms);
    return () => clearInterval(id);
  }
}
