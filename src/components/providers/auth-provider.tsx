import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '@/lib/api';
import type { User, AuthTokens, ApiResponse } from '@/types';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3001';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null; user: User | null }>;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('accessToken'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
        return true;
      }
      return false;
    } catch {
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
    } catch {
      return null;
    }
  }

  function clearAuth() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setUser(null);
    api.setToken(null);
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
      return { error: null, user: data.data.user };
    } catch {
      return { error: 'Network error', user: null };
    }
  }

  function logout() {
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
