import { ACCOUNT_KEY, tokenStore } from './api/token';
import { api, errorMessage, setUnauthorizedHandler, type AccountInfo } from './api/client';

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

class Auth {
  token = $state<string | null>(tokenStore.get());
  account = $state<AccountInfo | null>(loadAccount());
  /** A line for the login page: "session expired", etc. */
  notice = $state<string | null>(null);

  get loggedIn(): boolean {
    return this.token !== null;
  }

  /** Logs in as a web session. Throws an Error with a readable message. */
  async login(username: string, password: string): Promise<void> {
    const { data, error, response } = await api.POST('/api/v1/login', {
      body: { username, password, kind: 'web' },
    });
    if (!data) throw new Error(errorMessage(error, response.status));
    if (data.account.role !== 'admin') {
      // Revoke the token we just got: this account cannot use the admin site.
      await fetch('/api/v1/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.token}` },
      }).catch(() => {});
      throw new Error('This account is not an admin.');
    }
    tokenStore.set(data.token);
    saveAccount(data.account);
    this.token = data.token;
    this.account = data.account;
    this.notice = null;
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
