import { ApiError } from './api/client';

export interface Toast {
  id: number;
  kind: 'ok' | 'error';
  text: string;
}

class Toasts {
  items = $state<Toast[]>([]);
  private next = 1;

  show(kind: Toast['kind'], text: string): void {
    const id = this.next++;
    this.items = [...this.items, { id, kind, text }];
    setTimeout(() => this.dismiss(id), kind === 'error' ? 8000 : 4000);
  }

  dismiss(id: number): void {
    this.items = this.items.filter((t) => t.id !== id);
  }
}
export const toasts = new Toasts();

/**
 * Runs an action and reports the outcome in a toast. Returns whether it worked.
 * `ok` is the success text; by default the `message` of a command result.
 */
export async function run<T>(fn: () => Promise<T>, ok?: string | ((r: T) => string)): Promise<boolean> {
  try {
    const r = await fn();
    const text =
      typeof ok === 'function'
        ? ok(r)
        : (ok ?? (r && typeof r === 'object' && 'message' in r ? String(r.message) : 'Done'));
    toasts.show('ok', text || 'Done');
    return true;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return false; // the login page explains it
    toasts.show('error', e instanceof Error ? e.message : String(e));
    return false;
  }
}

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

class Confirms {
  current = $state<ConfirmRequest | null>(null);

  ask(opts: { title: string; message: string; confirmLabel?: string; danger?: boolean }): Promise<boolean> {
    return new Promise((resolve) => {
      this.current?.resolve(false);
      this.current = {
        title: opts.title,
        message: opts.message,
        confirmLabel: opts.confirmLabel ?? 'Confirm',
        danger: opts.danger ?? true,
        resolve,
      };
    });
  }

  answer(ok: boolean): void {
    const c = this.current;
    this.current = null;
    c?.resolve(ok);
  }
}
export const confirms = new Confirms();
