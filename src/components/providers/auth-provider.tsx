import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '@/lib/api';
import type { User, AuthTokens, ApiResponse } from '@/types';

const API_URL = 'http://localhost:3001';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('accessToken'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.setToken(token);
      fetchMe(token);
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchMe(accessToken: string) {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data: ApiResponse<{ user: User }> = await res.json();
      if (res.ok && data.status === 'success' && data.data) {
        setUser(data.data.user);
      } else {
        clearAuth();
      }
    } catch {
      clearAuth();
    } finally {
      setLoading(false);
    }
  }

  function clearAuth() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setUser(null);
    api.setToken(null);
  }

  async function login(email: string, password: string): Promise<string | null> {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data: ApiResponse<{ user: User; tokens: AuthTokens }> = await res.json();

      if (!res.ok || data.status !== 'success' || !data.data) {
        return data.message || 'Login failed';
      }

      localStorage.setItem('accessToken', data.data.tokens.accessToken);
      localStorage.setItem('refreshToken', data.data.tokens.refreshToken);
      setToken(data.data.tokens.accessToken);
      setUser(data.data.user);
      api.setToken(data.data.tokens.accessToken);
      return null;
    } catch {
      return 'Network error';
    }
  }

  function logout() {
    clearAuth();
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
