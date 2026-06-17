import type { ApiResponse, AuthTokens } from '@/types';
import { API_URL } from '@/lib/env';
import { getDevMock } from '@/lib/dev-mocks';

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
    const refreshToken = localStorage.getItem('refreshToken');
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
        localStorage.setItem('accessToken', data.data.tokens.accessToken);
        localStorage.setItem('refreshToken', data.data.tokens.refreshToken);
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

    const response = await fetch(`${API_URL}${path}`, { ...options, headers: this.buildHeaders(options) });

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

  get<T>(path: string) { return this.request<T>(path, { method: 'GET' }); }
  post<T>(path: string, body?: unknown) { return this.request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }); }
  put<T>(path: string, body?: unknown) { return this.request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }); }
  patch<T>(path: string, body?: unknown) { return this.request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }); }
  delete<T>(path: string) { return this.request<T>(path, { method: 'DELETE' }); }

  // Fetch a binary response (e.g. a PDF) as a Blob. Mirrors request()'s auth +
  // 401-refresh handling, but returns the raw body instead of parsing JSON. On
  // error the server still replies with a JSON envelope, so we parse that for a
  // useful message.
  async getBlob(path: string, retried = false): Promise<Blob> {
    const response = await fetch(`${API_URL}${path}`, { method: 'GET', headers: this.buildHeaders({ method: 'GET' }) });

    if (response.status === 401 && !retried && this.token && !path.startsWith('/api/v1/auth/')) {
      const newToken = await this.tryRefresh();
      if (newToken) return this.getBlob(path, true);
    }

    if (!response.ok) {
      let data: ApiResponse<unknown> | null = null;
      try { data = (await response.json()) as ApiResponse<unknown>; } catch { /* non-JSON / empty body */ }
      const message = data
        ? buildErrorMessage(data, statusMessage(response.status, 'Download failed'))
        : statusMessage(response.status, 'Download failed');
      throw new ApiError(message, response.status, data?.code);
    }

    return response.blob();
  }
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

// If the response carries a list of validation issues (`errors` or `issues`),
// expand them into a multi-line message so the UI can show every problem at
// once. Falls back to `data.message` or the provided default.
function buildErrorMessage(data: ApiResponse<unknown>, fallback: string): string {
  const issues = data.errors ?? data.issues;
  if (issues && issues.length > 0) {
    const lines = issues.map((e) => (e.path ? `${e.path}: ${e.message}` : e.message));
    if (data.message) {
      return [data.message, ...lines].join('\n');
    }
    return lines.join('\n');
  }
  return data.message || fallback;
}

function statusMessage(status: number, fallback: string): string {
  switch (status) {
    case 400: return 'Invalid request';
    case 401: return 'Session expired — please sign in again';
    case 403: return 'Access denied';
    case 404: return 'Not found';
    case 409: return 'Conflict — this record was modified or already exists';
    case 422: return 'Validation failed';
    case 429: return 'Too many requests — please wait a moment';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Server error — please try again';
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
