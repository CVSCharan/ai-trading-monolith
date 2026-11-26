// ============================================
// AuthContext — session, role, logout
// Wraps the entire app. Fetches /api/auth/session on mount.
// ============================================

import React, { createContext, useContext, useEffect, useState } from 'react';

export type UserRole = 'SUPER_ADMIN' | 'DEMO';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isDemo: boolean;
  isSuperAdmin: boolean;
  refetch: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refetch = () => setTick((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetch('/api/auth/session', { credentials: 'include' })
      .then(async (res) => {
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json() as { user: AuthUser };
            setUser(data.user ?? null);
          } else {
            setUser(null);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [tick]);

  const logout = async () => {
    try {
      await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' });
    } catch {
      // ignore
    }
    setUser(null);
  };

  const value: AuthContextValue = {
    user,
    isLoading,
    isDemo: user?.role === 'DEMO',
    isSuperAdmin: user?.role === 'SUPER_ADMIN',
    refetch,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
