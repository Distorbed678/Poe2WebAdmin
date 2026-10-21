import { ACCOUNT_KEY, tokenStore } from './api/token';
import { api, errorMessage, setUnauthorizedHandler, type AccountInfo, type LoginResponse } from './api/client';
import { router } from './router.svelte';
import { parseTokenLink, withoutFragment } from './tokenLogin';

function loadAccount(): AccountInfo | null {
  try {
    const raw = sessionStorage.getItem(ACCOUNT_KEY);
    return raw ? (JSON.parse(raw) as AccountInfo) : null;
  } catch {
    return null;
  }
}

function saveAccount(a: AccountInfo | null): void {
  try {
    if (a) sessionStorage.setItem(ACCOUNT_KEY, JSON.stringify(a));
    else sessionStorage.removeItem(ACCOUNT_KEY);
  } catch {
    /* the account is a convenience for the header only */
  }
}

const NOT_ADMIN = 'This account is not an admin.';

class Auth {
  token = $state<string | null>(tokenStore.get());
  account = $state<AccountInfo | null>(loadAccount());
  /** A line for the login page: "session expired", etc. */
  notice = $state<string | null>(null);
  /** A one-time sign-in link is being redeemed. */
  pending = $state(false);

  get loggedIn(): boolean {
    return this.token !== null;
  }

  /** Logs in as a web session. Throws an Error with a readable message. */
  async login(username: string, password: string): Promise<void> {
    const { data, error, response } = await api.POST('/api/v1/login', {
      body: { username, password, kind: 'web' },
    });
    if (!data) throw new Error(errorMessage(error, response.status));
    await this.accept(data);
  }

  /** Keeps a new web session, unless the account is no admin (then the token is revoked). */
  private async accept(data: LoginResponse): Promise<void> {
    if (data.account.role !== 'admin') {
      // Revoke the token we just got: this account cannot use the admin site.
      await fetch('/api/v1/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.token}` },
      }).catch(() => {});
      throw new Error(NOT_ADMIN);
    }
    tokenStore.set(data.token);
    saveAccount(data.account);
    this.token = data.token;
    this.account = data.account;
    this.notice = null;
  }

  /**
   * Handles a `#/token-login?t=...` address (the launcher's "Open web admin"): removes the token
   * from the address bar and the history first, then redeems it once for a web session. A link
   * that fails leaves the login page with a notice. Does nothing for any other address.
   */
  async consumeUrlToken(): Promise<void> {
    const link = parseTokenLink(location.hash);
    if (!link) return;
    // Before anything else: the token must not stay in the URL, the history or the router.
    history.replaceState(null, '', withoutFragment(location));
    router.sync();
    this.pending = true;
    try {
      if (!link.token) throw new Error('malformed');
      const { data, error, response } = await api.POST('/api/v1/web-token/redeem', {
        body: { token: link.token },
      });
      if (!data) throw new Error(errorMessage(error, response.status));
      await this.accept(data);
    } catch (e) {
      const why = e instanceof Error && e.message === NOT_ADMIN ? NOT_ADMIN : null;
      this.notice = why ?? 'That sign-in link is expired or was already used. Sign in with your password.';
    } finally {
      this.pending = false;
    }
  }

  /** Signs out: revokes the token on the server (best effort) and forgets it here. */
  async logout(): Promise<void> {
    if (this.token) await api.POST('/api/v1/logout').catch(() => {});
    tokenStore.clear();
    this.token = null;
    this.account = null;
    this.notice = null;
  }

  /** The server said 401: the token is already cleared by the client. */
  expire(): void {
    this.token = null;
    this.account = null;
    this.notice = 'Your session ended. Sign in again.';
  }
}

export const auth = new Auth();
setUnauthorizedHandler(() => auth.expire());
