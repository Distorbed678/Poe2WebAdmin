// One-time sign-in link: the launcher's "Open web admin" opens `/#/token-login?t=<token>`.
// The token is in the URL fragment, so it never reaches the server or a proxy log; this module
// reads it and the caller removes it from the address bar and the history at once.
import { parseHash } from './router.svelte';

export const TOKEN_LOGIN_PAGE = 'token-login';

/** What a sign-in link carries: the page matched, and its token (empty when missing or malformed). */
export interface TokenLink {
  token: string;
}

/** The token of a `#/token-login?t=...` hash, or `null` when the hash is some other page. */
export function parseTokenLink(hash: string): TokenLink | null {
  const route = parseHash(hash);
  if (route.segments[0] !== TOKEN_LOGIN_PAGE) return null;
  const t = (route.query.get('t') ?? '').trim();
  return { token: /^[0-9a-f]{64}$/i.test(t) ? t.toLowerCase() : '' };
}

/** The address without its fragment (and so without the token). */
export function withoutFragment(loc: Pick<Location, 'pathname' | 'search'>): string {
  return loc.pathname + loc.search;
}
