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
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-xl shadow-2xl flex flex-col items-center gap-4">
          <div className="relative">
            <img src="/logo.svg" alt="AI Trader" className="h-12 w-12 animate-pulse rounded-xl" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500" />
            </span>
          </div>
          <div className="text-center space-y-1.5 w-full">
            <div className="h-4 w-32 bg-slate-800/80 rounded animate-pulse mx-auto" />
            <div className="h-3 w-48 bg-slate-800/50 rounded animate-pulse mx-auto" />
          </div>
          <div className="w-full space-y-2 pt-2">
            <div className="h-2 w-full bg-slate-800/60 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 w-2/3 animate-[pulse_1.5s_infinite]" />
            </div>
          </div>
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
