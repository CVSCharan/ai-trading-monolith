// ============================================
// AuthGuard — redirect to /login if no session
// RoleGuard — show lock overlay for DEMO users
// ============================================

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
}

/** Redirects to /login if not authenticated. Shows nothing while loading. */
export function AuthGuard({ children }: AuthGuardProps) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [isLoading, user, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo.svg" alt="AI Trader" className="h-10 w-10 animate-pulse rounded-xl" />
          <p className="text-slate-400 text-sm">Loading session…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}

interface RoleGuardProps {
  children: React.ReactNode;
  role: 'SUPER_ADMIN';
  /** Custom message shown in the overlay */
  message?: string;
}

/**
 * Wraps content that requires SUPER_ADMIN.
 * For DEMO users shows a translucent lock overlay instead of hiding content.
 */
export function RoleGuard({ children, message }: RoleGuardProps) {
  const { isDemo } = useAuth();

  if (!isDemo) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-30 select-none">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-slate-900/80 backdrop-blur-sm">
        <div className="rounded-full bg-amber-500/20 p-3">
          <Lock className="h-6 w-6 text-amber-400" />
        </div>
        <p className="text-sm font-semibold text-amber-300">DEMO — Read Only</p>
        {message && <p className="text-xs text-slate-400 text-center max-w-xs">{message}</p>}
      </div>
    </div>
  );
}
