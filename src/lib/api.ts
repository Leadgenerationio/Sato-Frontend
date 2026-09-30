import type { ApiResponse, AuthTokens } from '@/types';
import { API_URL } from '@/lib/env';
import { getDevMock } from '@/lib/dev-mocks';
import { getRefreshToken, saveTokens } from '@/lib/token-store';

// Sam feedback S10 (29 Sep 2026): a dropped connection used to surface the
// browser's raw "Failed to fetch". Say what happened and that nothing saved.
export const NETWORK_ERROR_MESSAGE =
  "Couldn't reach the server — nothing was saved. Check your connection and try again.";

// Dev-only: serve canned data from dev-mocks.ts when VITE_USE_MOCKS=true (i.e.
// no backend). Decoupled from the login bypass so the app can auto-login against
// a REAL backend (VITE_API_URL) while mocks stay off. Hard-gated to DEV.
const USE_DEV_MOCKS = import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true';

class ApiClient {
  private token: string | null = null;
  private refreshInFlight: Promise<string | null> | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private buildHeaders(options: RequestInit): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  }

  private async tryRefresh(): Promise<string | null> {
    if (this.refreshInFlight) return this.refreshInFlight;
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    this.refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        const data: ApiResponse<{ tokens: AuthTokens }> = await res.json();
        if (!res.ok || data.status !== 'success' || !data.data) return null;
        saveTokens(data.data.tokens);
        this.token = data.data.tokens.accessToken;
        return this.token;
      } catch {
        return null;
      } finally {
        this.refreshInFlight = null;
      }
    })();

    return this.refreshInFlight;
  }

  private async request<T>(path: string, options: RequestInit = {}, retried = false): Promise<ApiResponse<T>> {
    if (USE_DEV_MOCKS) {
      const mock = getDevMock((options.method as string) || 'GET', path);
      if (mock) return mock as ApiResponse<T>;
    }

    const response = await fetchOrThrow(`${API_URL}${path}`, { ...options, headers: this.buildHeaders(options) });

    if (response.status === 401 && !retried && this.token && !path.startsWith('/api/v1/auth/')) {
      const newToken = await this.tryRefresh();
      if (newToken) return this.request<T>(path, options, true);
    }

    let data: ApiResponse<T>;
    try {
      data = (await response.json()) as ApiResponse<T>;
    } catch {
      throw new ApiError(statusMessage(response.status, 'Server returned an invalid response'), response.status);
    }

    if (!response.ok) {
      throw new ApiError(buildErrorMessage(data, statusMessage(response.status, 'Request failed')), response.status, data.code);
    }
    if (data.status !== 'success') {
      throw new ApiError(buildErrorMessage(data, 'Request failed'), response.status, data.code);
    }
    return data;
  }

  /**
   * Authenticated binary GET — returns the raw response Blob (used for
   * downloading the original Xero invoice PDF, which the server streams behind
   * auth rather than exposing a public URL). Mirrors request()'s 401→refresh
   * retry, but parses errors as JSON only when the failed response carries it.
   */
  async getBlob(path: string, retried = false): Promise<Blob> {
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const response = await fetchOrThrow(`${API_URL}${path}`, { method: 'GET', headers });

    if (response.status === 401 && !retried && this.token) {
      const newToken = await this.tryRefresh();
      if (newToken) return this.getBlob(path, true);
    }

    if (!response.ok) {
      let message = statusMessage(response.status, 'Download failed');
      let code: string | undefined;
      try {
        const data = (await response.json()) as ApiResponse<unknown>;
        message = buildErrorMessage(data, message);
        code = data.code;
      } catch {
        // Non-JSON error body — keep the status-derived message.
      }
      throw new ApiError(message, response.status, code);
    }

    return response.blob();
  }

  get<T>(path: string) { return this.request<T>(path, { method: 'GET' }); }
  post<T>(path: string, body?: unknown) { return this.request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }); }
  put<T>(path: string, body?: unknown) { return this.request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }); }
  patch<T>(path: string, body?: unknown) { return this.request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }); }
  delete<T>(path: string) { return this.request<T>(path, { method: 'DELETE' }); }
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

/**
 * fetch() rejects (TypeError "Failed to fetch") only when the request never
 * got an answer — offline, DNS, CORS, server down. Convert that into an
 * ApiError with status 0 and a message a person can act on.
 */
async function fetchOrThrow(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0, 'network_error');
  }
}

// "body.contactEmail" → "Contact email". Validation paths come from zod as
// dot-joined segments; the leading body/query/params segment is noise.
export function humanizeField(path: string): string {
  const segs = path.split('.').filter((s) => s && !['body', 'query', 'params'].includes(s));
  const last = [...segs].reverse().find((s) => !/^\d+$/.test(s));
  if (!last) return '';
  const words = last.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Zod's own wording ("Too small: expected string to have >=1 characters") is for
// developers. Turn the common ones into a short phrase that follows the field
// name — "Company number can't be empty". Anything else is passed through.
export function plainIssue(message: string): string | null {
  let m: RegExpMatchArray | null;
  if (/^Too small: expected string to have >=1 characters?$/i.test(message)) return "can't be empty";
  if ((m = message.match(/^Too big: expected string to have <=(\d+) characters?$/i))) return `is too long (at most ${m[1]} characters)`;
  if ((m = message.match(/^Too small: expected number to be >=(-?[\d.]+)$/i))) return `must be at least ${m[1]}`;
  if ((m = message.match(/^Too big: expected number to be <=(-?[\d.]+)$/i))) return `must be at most ${m[1]}`;
  if ((m = message.match(/^Too small: expected array to have >=(\d+) items?$/i))) return `needs at least ${m[1]}`;
  if (/^Invalid input(: expected .*)?$/i.test(message)) return "isn't valid";
  return null;
}

// If the response carries validation issues (`errors` or `issues`), lead with
// the first one in plain words ("Contact email: Invalid email address") and
// say how many more there are — a wall of "body.x.y: …" lines was unreadable.
// Falls back to `data.message` or the provided default.
export function buildErrorMessage(data: ApiResponse<unknown>, fallback: string): string {
  const issues = data.errors ?? data.issues;
  if (issues && issues.length > 0) {
    const first = issues[0];
    const rawPath = Array.isArray(first.path) ? (first.path as unknown[]).join('.') : String(first.path ?? '');
    const field = humanizeField(rawPath);
    const plain = plainIssue(String(first.message));
    const line = field && plain ? `${field} ${plain}` : field ? `${field}: ${first.message}` : first.message;
    const more = issues.length > 1 ? ` (and ${issues.length - 1} more)` : '';
    return `Couldn't save — ${line}${more}`;
  }
  return data.message || fallback;
}

// Plain-words fallback per status, used when the server sends no message.
export function statusMessage(status: number, fallback: string): string {
  switch (status) {
    case 400: return "Couldn't save — some details aren't valid. Check the form and try again.";
    case 401: return 'Your session has expired — please sign in again.';
    case 403: return "You don't have permission to do that.";
    case 404: return "We couldn't find that — it may have been removed.";
    case 409: return 'This record was changed or already exists — refresh and try again.';
    case 413: return 'That file or request is too large.';
    case 422: return "Couldn't save — some details aren't valid. Check the form and try again.";
    case 429: return 'Too many requests — please wait a moment and try again.';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Something went wrong on the server — nothing was saved. Please try again.';
    default:
      return fallback;
  }
}

export function unwrap<T>(res: ApiResponse<T>): T {
  if (res.data === undefined || res.data === null) {
    throw new ApiError(res.message || 'Response missing data', 500);
  }
  return res.data;
}

export const api = new ApiClient();
