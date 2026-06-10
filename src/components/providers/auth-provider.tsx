import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { API_URL } from '@/lib/env';
import { queryClient } from '@/components/providers/query-provider';
import type { User, AuthTokens, ApiResponse } from '@/types';

import { logWarn } from '../../lib/log';
// Set the api singleton's token from localStorage at module-evaluation time so
// that any synchronous render which reaches a child hook (which immediately
// fires a request) already carries the Authorization header. Without this,
// the first request after a hard refresh races AuthProvider's effect and
// hits 401 before tryRefresh kicks in.
if (typeof window !== 'undefined') {
  const stored = window.localStorage.getItem('accessToken');
  if (stored) api.setToken(stored);
}

/**
 * Fire-and-forget GET against the URLs the user is about to land on, immediately
 * after login. Goal is to warm the BACKEND's Redis cache (LeadByte responses are
 * cached server-side for 60s) so when the dashboard hook fires the same call
 * a moment later, the BE returns in ~5ms instead of ~500ms.
 *
 * Deliberately does NOT populate the React Query cache — the hook does its own
 * transform on the response, and putting raw data under the same key would
 * give the dashboard the wrong shape. Pure server-cache warming.
 */
function warmServerCache(accessToken: string, role: User['role']) {
  const fire = (path: string): void => {
    void fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => {
      // Silent — this is best-effort. The actual page hooks will retry on mount.
    });
  };

  if (role === 'client' || role === 'client_admin') {
    fire('/api/v1/portal/dashboard');
  } else {
    // Match useDashboardStats's three calls so all three Redis keys land warm.
    fire('/api/v1/campaigns?limit=100');
    fire('/api/v1/invoices?limit=100');
    fire('/api/v1/clients?limit=100');
  }
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null; user: User | null }>;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Dev-only login bypass. When VITE_BYPASS_AUTH=true (see .env.local), skip the
// backend session flow entirely and seed a mock owner so the dashboard renders
// without a running backend. Hard-gated to import.meta.env.DEV so it can never
// ship in a production build.
const BYPASS_AUTH = import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === 'true';
// role 'owner' so the bypass lands on the redesigned admin dashboard at "/".
// Switch role to 'client' to preview the redesigned /portal instead.
const MOCK_USER: User = {
  id: 'dev-bypass',
  email: 'owner@stato.app',
  name: 'Sam Owner',
  role: 'owner',
  businessId: 'dev-business',
  clientId: null,
  isActive: true,
  isPrimaryOwner: true,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(BYPASS_AUTH ? MOCK_USER : null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('accessToken'));
  const [loading, setLoading] = useState(!BYPASS_AUTH);

  useEffect(() => {
    if (BYPASS_AUTH) return;
    restoreSession();
  }, []);

  async function restoreSession() {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');

    if (!accessToken && !refreshToken) {
      setLoading(false);
      return;
    }

    if (accessToken && (await fetchMe(accessToken))) {
      setLoading(false);
      return;
    }

    if (refreshToken) {
      const newAccess = await refreshSession(refreshToken);
      if (newAccess && (await fetchMe(newAccess))) {
        setLoading(false);
        return;
      }
    }

    clearAuth();
    setLoading(false);
  }

  async function fetchMe(accessToken: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data: ApiResponse<{ user: User }> = await res.json();
      if (res.ok && data.status === 'success' && data.data) {
        api.setToken(accessToken);
        setToken(accessToken);
        setUser(data.data.user);
        // Restored a session → warm the BE Redis cache for the destination
        // dashboard so the next render is near-instant.
        warmServerCache(accessToken, data.data.user.role);
        return true;
      }
      return false;
    } catch (err) {
      logWarn('fetchMe failed', err);
      return false;
    }
  }

  async function refreshSession(refreshToken: string): Promise<string | null> {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const data: ApiResponse<{ tokens: AuthTokens }> = await res.json();
      if (res.ok && data.status === 'success' && data.data) {
        localStorage.setItem('accessToken', data.data.tokens.accessToken);
        localStorage.setItem('refreshToken', data.data.tokens.refreshToken);
        return data.data.tokens.accessToken;
      }
      return null;
    } catch (err) {
      logWarn('refreshSession failed', err);
      return null;
    }
  }

  function clearAuth() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setUser(null);
    api.setToken(null);
    // Drop every cached query so the next user can't see the previous user's
    // data while their first requests are in-flight.
    queryClient.clear();
  }

  async function login(email: string, password: string): Promise<{ error: string | null; user: User | null }> {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data: ApiResponse<{ user: User; tokens: AuthTokens }> = await res.json();

      if (!res.ok || data.status !== 'success' || !data.data) {
        return { error: data.message || 'Login failed', user: null };
      }

      localStorage.setItem('accessToken', data.data.tokens.accessToken);
      localStorage.setItem('refreshToken', data.data.tokens.refreshToken);
      setToken(data.data.tokens.accessToken);
      setUser(data.data.user);
      api.setToken(data.data.tokens.accessToken);
      // Login succeeded — fire prefetch in parallel with the navigate(). The
      // requests race the React render; whichever finishes first warms the
      // BE Redis cache so the dashboard renders quickly.
      warmServerCache(data.data.tokens.accessToken, data.data.user.role);
      return { error: null, user: data.data.user };
    } catch {
      return { error: 'Network error', user: null };
    }
  }

  function logout() {
    // Best-effort notify the backend so it can revoke the refresh token. If
    // the endpoint isn't there yet (BE rolling out in parallel) or the network
    // is down, we still clear local state below — the user gets logged out
    // either way.
    api.post('/api/v1/auth/logout', {}).catch(() => {
      // Swallow — local logout still proceeds.
    });
    clearAuth();
  }

  function updateUser(patch: Partial<User>) {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
