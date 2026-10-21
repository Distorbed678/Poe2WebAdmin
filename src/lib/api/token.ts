// The bearer token lives in sessionStorage: it dies with the tab, and never reaches disk or other
// tabs. Every access is wrapped because storage can throw (private windows, blocked site data);
// without storage the token only lasts in memory until the page reloads.

export const TOKEN_KEY = 'poe2admin.token';
export const ACCOUNT_KEY = 'poe2admin.account';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** A token store over a storage object (injectable for tests). */
export class TokenStore {
  private memory: string | null = null;

  constructor(private readonly storage: StorageLike | null = defaultStorage()) {}

  get(): string | null {
    try {
      return this.storage?.getItem(TOKEN_KEY) ?? this.memory;
    } catch {
      return this.memory;
    }
  }

  set(token: string): void {
    this.memory = token;
    try {
      this.storage?.setItem(TOKEN_KEY, token);
    } catch {
      /* memory only */
    }
  }

  clear(): void {
    this.memory = null;
    try {
      this.storage?.removeItem(TOKEN_KEY);
      this.storage?.removeItem(ACCOUNT_KEY);
    } catch {
      /* nothing to do */
    }
  }
}

export const tokenStore = new TokenStore();
