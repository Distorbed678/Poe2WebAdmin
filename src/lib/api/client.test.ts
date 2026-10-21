import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApi, errorMessage, unwrap } from './client';
import { ACCOUNT_KEY, TOKEN_KEY, TokenStore } from './token';

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('TokenStore', () => {
  it('stores and clears the token (and the cached account) in the storage', () => {
    const s = memoryStorage();
    const t = new TokenStore(s);
    expect(t.get()).toBeNull();
    t.set('abc');
    expect(s.m.get(TOKEN_KEY)).toBe('abc');
    expect(t.get()).toBe('abc');
    s.m.set(ACCOUNT_KEY, '{}');
    t.clear();
    expect(t.get()).toBeNull();
    expect(s.m.has(TOKEN_KEY)).toBe(false);
    expect(s.m.has(ACCOUNT_KEY)).toBe(false);
  });

  it('falls back to memory when the storage throws', () => {
    const boom = () => {
      throw new Error('blocked');
    };
    const t = new TokenStore({ getItem: boom, setItem: boom, removeItem: boom });
    expect(() => t.set('tok')).not.toThrow();
    expect(t.get()).toBe('tok');
    expect(() => t.clear()).not.toThrow();
    expect(t.get()).toBeNull();
  });

  it('works without any storage', () => {
    const t = new TokenStore(null);
    t.set('x');
    expect(t.get()).toBe('x');
  });
});

describe('api client', () => {
  it('sends the bearer token', async () => {
    const tokens = new TokenStore(memoryStorage());
    tokens.set('secret');
    const f = vi.fn(async (_req: Request) => json([]));
    const api = createApi({ baseUrl: 'http://x', fetch: f as unknown as typeof fetch, tokens });
    await api.GET('/api/v1/admin/sessions');
    const req = f.mock.calls[0]![0];
    expect(req.url).toBe('http://x/api/v1/admin/sessions');
    expect(req.headers.get('authorization')).toBe('Bearer secret');
  });

  it('sends no Authorization header without a token', async () => {
    const f = vi.fn(async (_req: Request) => json({}));
    const api = createApi({
      baseUrl: 'http://x',
      fetch: f as unknown as typeof fetch,
      tokens: new TokenStore(memoryStorage()),
    });
    await api.GET('/api/v1/server');
    expect(f.mock.calls[0]![0].headers.has('authorization')).toBe(false);
  });

  it('clears the token and signals on 401', async () => {
    const tokens = new TokenStore(memoryStorage());
    tokens.set('stale');
    const onUnauthorized = vi.fn();
    const api = createApi({
      baseUrl: 'http://x',
      fetch: (async () => json({ error: 'token expired' }, 401)) as unknown as typeof fetch,
      tokens,
      onUnauthorized,
    });
    const res = await api.GET('/api/v1/admin/accounts');
    expect(res.response.status).toBe(401);
    expect(tokens.get()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('does not treat a failed login as an expired session', async () => {
    const tokens = new TokenStore(memoryStorage());
    const onUnauthorized = vi.fn();
    const api = createApi({
      baseUrl: 'http://x',
      fetch: (async () => json({ error: 'wrong username or password' }, 401)) as unknown as typeof fetch,
      tokens,
      onUnauthorized,
    });
    const res = await api.POST('/api/v1/login', { body: { username: 'a', password: 'b' } });
    expect(res.response.status).toBe(401);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe('unwrap / errorMessage', () => {
  it('returns data on success', async () => {
    const api = createApi({
      baseUrl: 'http://x',
      fetch: (async () => json({ message: 'ok' })) as unknown as typeof fetch,
      tokens: new TokenStore(null),
    });
    const r = await unwrap(api.POST('/api/v1/admin/players/{name}/kick', { params: { path: { name: 'bob' } } }));
    expect(r.message).toBe('ok');
  });

  it('throws ApiError with the server message', async () => {
    const api = createApi({
      baseUrl: 'http://x',
      fetch: (async () => json({ error: 'no such player' }, 404)) as unknown as typeof fetch,
      tokens: new TokenStore(null),
    });
    const p = unwrap(api.POST('/api/v1/admin/players/{name}/kick', { params: { path: { name: 'bob' } } }));
    await expect(p).rejects.toBeInstanceOf(ApiError);
    await expect(p).rejects.toMatchObject({ status: 404, message: 'no such player' });
  });

  it('formats unknown error shapes', () => {
    expect(errorMessage({ error: 'x' })).toBe('x');
    expect(errorMessage('bad gateway', 502)).toBe('bad gateway');
    expect(errorMessage(undefined, 500)).toBe('HTTP 500');
    expect(errorMessage(null)).toBe('request failed');
  });
});
