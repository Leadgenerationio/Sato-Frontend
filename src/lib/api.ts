import type { ApiResponse, AuthTokens } from '@/types';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3001';

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
    const response = await fetch(`${API_URL}${path}`, { ...options, headers: this.buildHeaders(options) });

    if (response.status === 401 && !retried && this.token && !path.startsWith('/api/v1/auth/')) {
      const newToken = await this.tryRefresh();
      if (newToken) return this.request<T>(path, options, true);
    }

    const data = await response.json();
    if (!response.ok) {
      throw new ApiError(data.message || 'Request failed', response.status);
    }
    return data;
  }

  get<T>(path: string) { return this.request<T>(path, { method: 'GET' }); }
  post<T>(path: string, body?: unknown) { return this.request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }); }
  put<T>(path: string, body?: unknown) { return this.request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }); }
  patch<T>(path: string, body?: unknown) { return this.request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }); }
  delete<T>(path: string) { return this.request<T>(path, { method: 'DELETE' }); }
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export const api = new ApiClient();
