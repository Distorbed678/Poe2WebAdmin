import createClient, { type Middleware } from 'openapi-fetch';
import type { components, paths } from './schema';
import { tokenStore, type TokenStore } from './token';

export type Schemas = components['schemas'];
export type AccountInfo = Schemas['AccountInfo'];
export type CharacterInfo = Schemas['CharacterInfo'];
export type InstanceView = Schemas['InstanceView'];
export type OnlinePlayerInfo = Schemas['OnlinePlayerInfo'];
export type ServerInfo = Schemas['ServerInfo'];
export type LoginResponse = Schemas['LoginResponse'];
export type LogEvent = Schemas['LogEvent'];
export type LogLevel = Schemas['LogLevel'];
export type PendingShutdown = Schemas['PendingShutdown'];
export type ShutdownKind = Schemas['ShutdownKind'];
export type BanView = Schemas['BanView'];
export type MetricsResponse = Schemas['MetricsResponse'];
export type MetricsPoint = Schemas['MetricsPoint'];
export type TaskView = Schemas['TaskView'];
export type TaskBody = Schemas['TaskBody'];
export type RunView = Schemas['RunView'];
export type ConfigFile = Schemas['ConfigFile'];

/** An error response: the HTTP status and the server's `{"error": "..."}` text. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The text of an error body: the server's `{error}`, a plain string, or a fallback. */
export function errorMessage(error: unknown, status?: number): string {
  if (error && typeof error === 'object' && 'error' in error && typeof error.error === 'string') {
    return error.error;
  }
  if (typeof error === 'string' && error.trim() !== '') return error.trim().slice(0, 300);
  return status ? `HTTP ${status}` : 'request failed';
}

export interface ApiOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  tokens?: TokenStore;
  /** Called when a call other than login is answered with 401: the token is gone, go to login. */
  onUnauthorized?: () => void;
}

/** A typed client for the server's API. Adds the bearer token and handles 401. */
export function createApi(opts: ApiOptions = {}) {
  const tokens = opts.tokens ?? tokenStore;
  const client = createClient<paths>({
    baseUrl: opts.baseUrl ?? '',
    ...(opts.fetch ? { fetch: opts.fetch } : {}),
  });

  const auth: Middleware = {
    onRequest({ request }) {
      const token = tokens.get();
      if (token) request.headers.set('Authorization', `Bearer ${token}`);
      return request;
    },
    onResponse({ request, response }) {
      // Login and the one-time token redemption have no session to lose: their 401 is the answer.
      if (response.status === 401 && !/\/(login|web-token\/redeem)$/.test(new URL(request.url).pathname)) {
        tokens.clear();
        opts.onUnauthorized?.();
      }
      return response;
    },
  };
  client.use(auth);
  return client;
}

/** Returns the data of a call, or throws an `ApiError` with the server's message. */
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await call;
  if (error !== undefined || !response.ok) {
    throw new ApiError(errorMessage(error, response.status), response.status);
  }
  return data as T;
}

// --- The app's shared client ---------------------------------------------------------------

let unauthorizedHandler: () => void = () => {};

/** Registers what happens after a 401 (the auth store clears its state and shows the login). */
export function setUnauthorizedHandler(fn: () => void): void {
  unauthorizedHandler = fn;
}

export const api = createApi({ onUnauthorized: () => unauthorizedHandler() });
