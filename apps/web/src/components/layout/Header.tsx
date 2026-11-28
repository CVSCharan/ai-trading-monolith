import { useQuery } from '@tanstack/react-query';
import { Bot, ChevronDown, LogOut, Menu, Settings, UserCircle2 } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { NAV_GROUPS } from './Sidebar';
import { MarketClockHeaderPill, MarketAlertToastBanner } from '../MarketSessionClocks';
import { fetchJson } from '../../lib/api';

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
  const navigate = useNavigate();
  const { user, isDemo, logout } = useAuth();
  const { events } = useWebSocket(['ticks']);
  const latestTick = events.find((e) => e.channel === 'ticks')?.data as
    | { instrumentKey?: string; ltp?: number }
    | undefined;

  const { data: health, isLoading: isHealthLoading, error: healthError } = useQuery<HealthResponse>({
    queryKey: ['api-health'],
    queryFn: async () => {
      return fetchJson<HealthResponse>('/health');
    },
    refetchInterval: 10_000,
    retry: false,
  });

  const { data: broker } = useQuery<UpstoxStatusQuick>({
    queryKey: ['upstox-status'],
    queryFn: () => fetchJson<UpstoxStatusQuick>('/api/upstox/status', { credentials: 'include' }),
  });

  const pageTitle = getPageTitle(location.pathname);

  return (
    <>
      <MarketAlertToastBanner />
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
          <span>{isHealthLoading ? 'Checking API' : healthError ? 'API Unavailable' : health?.status === 'ok' ? 'API Online' : 'API Degraded'}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {latestTick?.ltp !== undefined && (
          <Badge variant="success" className="hidden lg:inline-flex font-mono tabular-nums">
            {latestTick.instrumentKey?.includes('Bank') ? 'BANKNIFTY' : 'NIFTY'}: ₹{latestTick.ltp.toLocaleString('en-IN')}
          </Badge>
        )}
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
          {broker?.activeDataBroker ?? 'unknown'} / {broker?.activeExecutionBroker ?? 'unknown'}
        </Badge>
        <MarketClockHeaderPill />

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/80 px-2.5 py-1.5 text-xs text-slate-200 hover:border-slate-700 transition-colors">
                <UserCircle2 className="h-4 w-4 text-sky-400 shrink-0" />
                <span className="hidden sm:inline max-w-[120px] truncate">{user.name || user.email}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </div>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="font-medium text-white truncate">{user.email}</div>
                <div className="text-[11px] font-normal text-slate-400 mt-0.5">Role: {user.role}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
                <div className="flex items-center gap-2 w-full">
                  <UserCircle2 className="h-3.5 w-3.5 text-sky-400" />
                  Profile &amp; Devices (Max 3)
                </div>
              </DropdownMenuItem>
              {!isDemo && (
                <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
                  <div className="flex items-center gap-2 w-full">
                    <Settings className="h-3.5 w-3.5 text-slate-400" />
                    Broker &amp; Risk Settings
                  </div>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => void logout()}
                className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
    </>
  );
}
