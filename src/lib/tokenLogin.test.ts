import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseTokenLink, withoutFragment } from './tokenLogin';

const TOKEN = 'ab'.repeat(32);

describe('sign-in link', () => {
  it('reads the token of #/token-login', () => {
    expect(parseTokenLink(`#/token-login?t=${TOKEN}`)).toEqual({ token: TOKEN });
    expect(parseTokenLink(`#/token-login?t=${TOKEN.toUpperCase()}`)).toEqual({ token: TOKEN });
  });
  it('flags a missing or malformed token as empty', () => {
    expect(parseTokenLink('#/token-login')).toEqual({ token: '' });
    expect(parseTokenLink('#/token-login?t=nothex')).toEqual({ token: '' });
    expect(parseTokenLink(`#/token-login?t=${TOKEN}00`)).toEqual({ token: '' });
  });
  it('ignores other pages', () => {
    expect(parseTokenLink('')).toBeNull();
    expect(parseTokenLink('#/dashboard')).toBeNull();
    expect(parseTokenLink(`#/accounts?t=${TOKEN}`)).toBeNull();
  });
  it('drops the fragment from the address', () => {
    expect(withoutFragment({ pathname: '/admin/', search: '?x=1' })).toBe('/admin/?x=1');
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const session = (role: string) => ({
  token: 'cd'.repeat(32),
  kind: 'web',
  expires_at: 1,
  account: { id: 1, username: 'alice', role, created_at: 0, last_login: null, disabled: false, has_password: true },
});

/** The auth store against a fake server: redeeming the link at most once, removing it from the URL. */
describe('auth.consumeUrlToken', () => {
  let calls: { url: string; auth: string | null; body: string }[];
  let respond: () => Response;

  beforeEach(async () => {
    calls = [];
    respond = () => json(session('admin'));
    sessionStorage.clear();
    vi.resetModules();
    // The page resolves relative API URLs against its origin; the test environment's Request does not.
    const RealRequest = Request;
    vi.stubGlobal(
      'Request',
      class extends RealRequest {
        constructor(input: RequestInfo | URL, init?: RequestInit) {
          super(typeof input === 'string' && input.startsWith('/') ? `http://x${input}` : input, init);
        }
      },
    );
    vi.stubGlobal('fetch', async (input: Request | string, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(String(input), init);
      calls.push({ url: new URL(req.url).pathname, auth: req.headers.get('authorization'), body: await req.clone().text() });
      return respond();
    });
    history.replaceState(null, '', `/#/token-login?t=${TOKEN}`);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    history.replaceState(null, '', '/');
  });

  it('signs in once and leaves no token in the address', async () => {
    const { auth } = await import('./auth.svelte');
    await auth.consumeUrlToken();
    expect(auth.loggedIn).toBe(true);
    expect(auth.account?.username).toBe('alice');
    expect(location.hash).toBe('');
    expect(location.href).not.toContain(TOKEN);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('/api/v1/web-token/redeem');
    expect(JSON.parse(calls[0]!.body)).toEqual({ token: TOKEN });
    // The address is clean now: a second call does nothing.
    await auth.consumeUrlToken();
    expect(calls).toHaveLength(1);
  });

  it('shows a notice when the server refuses the token, and stays logged out', async () => {
    respond = () => json({ error: 'invalid or expired web token' }, 401);
    const { auth } = await import('./auth.svelte');
    await auth.consumeUrlToken();
    expect(auth.loggedIn).toBe(false);
    expect(auth.notice).toMatch(/expired or was already used/);
    expect(location.hash).toBe('');
    expect(auth.pending).toBe(false);
  });

  it('revokes the session of an account that is no admin', async () => {
    respond = () => json(session('player'));
    const { auth } = await import('./auth.svelte');
    await auth.consumeUrlToken();
    expect(auth.loggedIn).toBe(false);
    expect(auth.notice).toBe('This account is not an admin.');
    expect(calls.map((c) => c.url)).toEqual(['/api/v1/web-token/redeem', '/api/v1/logout']);
  });

  it('does not call the server for a malformed link, and still cleans the address', async () => {
    history.replaceState(null, '', '/#/token-login?t=short');
    const { auth } = await import('./auth.svelte');
    await auth.consumeUrlToken();
    expect(calls).toHaveLength(0);
    expect(auth.notice).toMatch(/expired or was already used/);
    expect(location.hash).toBe('');
  });

  it('ignores every other address', async () => {
    history.replaceState(null, '', '/#/accounts');
    const { auth } = await import('./auth.svelte');
    await auth.consumeUrlToken();
    expect(calls).toHaveLength(0);
    expect(location.hash).toBe('#/accounts');
  });
});
