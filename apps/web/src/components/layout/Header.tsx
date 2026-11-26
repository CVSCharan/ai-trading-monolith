import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, ChevronDown, LogOut, Menu, Settings, UserCircle2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/badge';
import { NAV_GROUPS } from './Sidebar';

interface HealthResponse {
  status: string;
  db: string;
}

interface UpstoxStatusQuick {
  activeDataBroker?: string;
  activeExecutionBroker?: string;
}

function getPageTitle(pathname: string): string {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)) {
        return item.label;
      }
    }
  }
  return 'AI Trader';
}

export function Header({ onOpenMobile }: { onOpenMobile: () => void }) {
  const location = useLocation();
  const { user, isDemo, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const { data: health } = useQuery<HealthResponse>({
    queryKey: ['api-health'],
    queryFn: async () => {
      const res = await fetch('/health');
      if (!res.ok) throw new Error('API unreachable');
      return res.json();
    },
    refetchInterval: 10_000,
    retry: false,
  });

  const { data: broker } = useQuery<UpstoxStatusQuick>({
    queryKey: ['upstox-status'],
    queryFn: async () => {
      const res = await fetch('/api/upstox/status', { credentials: 'include' });
      if (!res.ok) return {};
      return res.json();
    },
  });

  const pageTitle = getPageTitle(location.pathname);

  return (
    <header className="h-14 shrink-0 border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md px-4 lg:px-6 flex items-center justify-between gap-4 relative z-30">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Open menu"
          className="lg:hidden rounded-lg p-1.5 text-slate-300 hover:bg-slate-800"
        >
          <Menu className="h-4 w-4" />
        </button>

        <h1 className="text-sm font-semibold text-white truncate">{pageTitle}</h1>

        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-950/70 px-2.5 py-1 text-[11px] text-slate-400">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              health?.status === 'ok' ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          <span>{health?.status === 'ok' ? 'API Online' : 'Offline'}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to="/bot"
          className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors"
        >
          <Bot className="h-3.5 w-3.5" />
          Bot Desk
        </Link>

        {isDemo && (
          <Badge variant="warning" className="animate-pulse">
            DEMO
          </Badge>
        )}
        <Badge variant="info" className="hidden xl:inline-flex uppercase">
          {broker?.activeDataBroker ?? 'groww'} / {broker?.activeExecutionBroker ?? 'groww'}
        </Badge>
        <Badge variant="info" className="hidden sm:inline-flex">
          15:00 IST
        </Badge>

        {user && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/80 px-2.5 py-1.5 text-xs text-slate-200 hover:border-slate-700 transition-colors"
            >
              <UserCircle2 className="h-4 w-4 text-sky-400 shrink-0" />
              <span className="hidden sm:inline max-w-[120px] truncate">{user.name || user.email}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 z-50 rounded-xl border border-slate-800 bg-slate-900/95 backdrop-blur-xl p-1.5 shadow-2xl text-xs">
                  <div className="px-3 py-2 border-b border-slate-800 mb-1">
                    <div className="font-medium text-white truncate">{user.email}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Role: {user.role}</div>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-200 hover:bg-slate-800"
                  >
                    <UserCircle2 className="h-3.5 w-3.5 text-sky-400" />
                    Profile &amp; Devices (Max 3)
                  </Link>
                  {!isDemo && (
                    <Link
                      to="/settings"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-200 hover:bg-slate-800"
                    >
                      <Settings className="h-3.5 w-3.5 text-slate-400" />
                      Broker &amp; Risk Settings
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      void logout();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-rose-400 hover:bg-rose-500/10 mt-1 border-t border-slate-800/80 pt-2"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
