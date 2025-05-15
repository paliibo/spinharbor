import type { ApiError } from '@spinharbor/contracts';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError & Record<string, unknown>,
  ) {
    super(body?.message ?? `Request failed with ${status}`);
    this.name = 'ApiRequestError';
  }
  get code(): string | undefined {
    return this.body?.code;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Skip the automatic refresh-and-retry on 401 (used by the auth endpoints themselves). */
  noRefresh?: boolean;
}

let refreshPromise: Promise<boolean> | null = null;

/** Single refresh in flight: concurrent 401s wait for the same rotation. */
async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        setTimeout(() => (refreshPromise = null), 0);
      });
  }
  return refreshPromise;
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = new URL(path.startsWith('http') ? path : `${API_URL}${path}`);
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  return url.toString();
}

/**
 * Cookie-authenticated fetch wrapper. Access tokens live in httpOnly cookies; on a 401 the
 * wrapper rotates the refresh token once and retries the original request.
 */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, query, noRefresh, headers, ...rest } = opts;
  const doFetch = () =>
    fetch(buildUrl(path, query), {
      credentials: 'include',
      ...rest,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(headers ?? {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  let res = await doFetch();
  if (res.status === 401 && !noRefresh && !path.startsWith('/auth/')) {
    const ok = await refreshSession();
    if (ok) res = await doFetch();
  }
  if (!res.ok) {
    let parsed: any = null;
    try {
      parsed = await res.json();
    } catch {
      parsed = { statusCode: res.status, error: res.statusText, message: res.statusText };
    }
    throw new ApiRequestError(res.status, parsed);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiGet = <T>(path: string, query?: RequestOptions['query']) => api<T>(path, { query });
export const apiPost = <T>(path: string, body?: unknown, opts?: RequestOptions) => api<T>(path, { method: 'POST', body, ...opts });
export const apiPatch = <T>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body });
export const apiPut = <T>(path: string, body?: unknown) => api<T>(path, { method: 'PUT', body });
export const apiDelete = <T>(path: string) => api<T>(path, { method: 'DELETE' });

export function errorMessage(e: unknown): string {
  if (e instanceof ApiRequestError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}
