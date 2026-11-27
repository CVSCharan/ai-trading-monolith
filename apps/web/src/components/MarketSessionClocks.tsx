import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Clock, Globe, X, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { SkeletonMarketGrid } from './ui/skeleton';
import { QueryErrorState } from './ui/query-feedback';
import { fetchJson } from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';

export interface MarketSessionInfo {
  id: string;
  name: string;
  exchange: string;
  segment: string;
  openIST: string;
  closeIST: string;
  isOpen: boolean;
  isTradingDay: boolean;
  status: 'PRE_OPEN' | 'OPEN' | 'CLOSING_SOON' | 'CLOSED';
  minutesToOpen: number;
  minutesToClose: number;
  nextEvent: string;
}

interface MarketSessionsResponse {
  sessions?: MarketSessionInfo[];
  timestamp?: string;
  serverTimeIST?: string;
}

interface MarketAlertData {
  marketId: string;
  marketName: string;
  eventType: 'MARKET_OPEN' | 'MARKET_CLOSING_SOON' | 'MARKET_CLOSED' | 'MARKET_POST_CLOSE';
  timeIST: string;
  message: string;
  timestamp: string;
}

export function useMarketSessions() {
  return useQuery<MarketSessionsResponse>({
    queryKey: ['market-sessions'],
    queryFn: () => fetchJson<MarketSessionsResponse>('/api/market/sessions', { credentials: 'include' }),
    refetchInterval: 15_000,
  });
}

/**
 * Top floating toast banner for real-time market lifecycle events (Open, -10m, Close, +10m).
 */
export function MarketAlertToastBanner() {
  const { events } = useWebSocket(['market_alerts']);
  const [activeAlert, setActiveAlert] = useState<MarketAlertData | null>(null);

  useEffect(() => {
    const latest = events.find((e) => e.channel === 'market_alerts');
    if (latest && latest.data) {
      const alertData = latest.data as MarketAlertData;
      setActiveAlert(alertData);
      // Auto-dismiss after 12 seconds
      const timer = setTimeout(() => {
        setActiveAlert(null);
      }, 12_000);
      return () => clearTimeout(timer);
    }
  }, [events]);

  if (!activeAlert) return null;

  const isWarning = activeAlert.eventType === 'MARKET_CLOSING_SOON';
  const isPostClose = activeAlert.eventType === 'MARKET_POST_CLOSE';

  return (
    <div className="fixed top-16 right-4 z-50 max-w-md animate-in slide-in-from-top-4 duration-300">
      <div
        className={`rounded-xl border p-4 shadow-2xl backdrop-blur-xl flex items-start gap-3 text-sm ${
          isWarning
            ? 'border-amber-500/50 bg-amber-950/90 text-amber-200'
            : isPostClose
              ? 'border-sky-500/50 bg-slate-900/90 text-sky-200'
              : 'border-emerald-500/50 bg-slate-900/90 text-emerald-200'
        }`}
      >
        {isWarning ? (
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        ) : (
          <Bell className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-white tracking-wide uppercase text-xs">
              {activeAlert.marketName}
            </span>
            <span className="text-[10px] opacity-75 font-mono">{activeAlert.timeIST} IST</span>
          </div>
          <p className="mt-1 text-xs text-slate-200 leading-relaxed">{activeAlert.message}</p>
        </div>
        <button
          type="button"
          onClick={() => setActiveAlert(null)}
          className="text-slate-400 hover:text-white transition-colors"
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Compact Header Clock & Session Status Dropdown
 */
export function MarketClockHeaderPill() {
  const { data, isLoading, error, refetch } = useMarketSessions();
  const sessions = data?.sessions ?? [];

  // Primary market for display pill is NSE F&O or NSE Equity
  const primary =
    sessions.find((s) => s.id === 'NSE_FNO') ??
    sessions.find((s) => s.id === 'NSE_EQUITY') ??
    sessions[0];

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'OPEN':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'CLOSING_SOON':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30 animate-pulse';
      case 'PRE_OPEN':
        return 'text-sky-400 bg-sky-500/10 border-sky-500/30';
      default:
        return 'text-slate-400 bg-slate-800/40 border-slate-700/50';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <Badge variant="success">OPEN</Badge>;
      case 'CLOSING_SOON':
        return <Badge variant="warning">CLOSING SOON</Badge>;
      case 'PRE_OPEN':
        return <Badge variant="info">PRE-OPEN</Badge>;
      default:
        return <Badge variant="default">CLOSED</Badge>;
    }
  };

  return (
    <Popover>
      <PopoverTrigger>
        <div
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${getStatusColor(
            primary?.status
          )}`}
          title="Multi-Market Trading Sessions & Clocks"
        >
          <Clock className="h-3.5 w-3.5" />
          <span className="hidden sm:inline font-semibold">NSE:</span>
          <span>
            {isLoading && !data ? 'LOADING'
              : error && !data ? 'UNKNOWN'
                : primary?.status === 'OPEN'
              ? 'OPEN'
              : primary?.status === 'CLOSING_SOON'
                ? 'CLOSING SOON'
                : primary?.status === 'PRE_OPEN'
                  ? 'PRE-OPEN'
                  : 'CLOSED'}
          </span>
          {primary?.isOpen && primary?.minutesToClose !== undefined && (
            <span className="hidden md:inline font-mono opacity-80">
              ({Math.floor(primary.minutesToClose / 60)}h {primary.minutesToClose % 60}m)
            </span>
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 sm:w-96 p-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Globe className="h-3.5 w-3.5 text-sky-400" />
            <span>Market Session Clocks (IST)</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {data?.serverTimeIST ? data.serverTimeIST.split(',')[1]?.trim() : ''}
          </span>
        </div>

        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          {error && <QueryErrorState error={error} onRetry={() => void refetch()} title="Market session data is unavailable" />}
          {sessions.map((m) => (
            <div
              key={m.id}
              className="rounded-lg border border-slate-800/80 bg-slate-900/50 p-2 text-xs flex items-center justify-between gap-2 hover:bg-slate-800/40 transition-colors"
            >
              <div className="min-w-0">
                <div className="font-medium text-slate-200 truncate">{m.name}</div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <span>{m.exchange}</span>
                  <span>·</span>
                  <span className="font-mono">{m.openIST} - {m.closeIST} IST</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div>{getStatusBadge(m.status)}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {m.nextEvent}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <ShieldAlert className="h-3 w-3 text-amber-400" />
            Automated lifecycle alerts active
          </span>
          <span className="text-slate-500">DST aware</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Full card for Dashboard view displaying all 7 market sessions.
 */
export function MarketSessionsDashboardCard() {
  const { data, isLoading, error, refetch } = useMarketSessions();
  const sessions = data?.sessions ?? [];

  return (
    <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Globe className="h-4 w-4 text-sky-400" />
            Market Session Clocks & Lifecycle
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">
            Real-time status across Equity, F&O, Currency, and MCX Commodities
          </CardDescription>
        </div>
        <div className="text-xs font-mono text-slate-400">
          Server IST: {data?.serverTimeIST ? data.serverTimeIST.split(',')[1]?.trim() : 'Active'}
        </div>
      </CardHeader>
      <CardContent>
        {error && <QueryErrorState error={error} onRetry={() => void refetch()} title={sessions.length ? 'Showing last known market sessions' : 'Market sessions are unavailable'} />}
        {isLoading && !data ? (
          <SkeletonMarketGrid />
        ) : error && sessions.length === 0 ? null : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 hover:border-slate-700/80 transition-colors"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-xs text-slate-200 truncate">{s.name}</span>
                  <Badge
                    variant={
                      s.status === 'OPEN'
                        ? 'success'
                        : s.status === 'CLOSING_SOON'
                          ? 'warning'
                          : s.status === 'PRE_OPEN'
                            ? 'info'
                            : 'default'
                    }
                  >
                    {s.status}
                  </Badge>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Hours (IST)</span>
                  <span className="font-mono text-slate-300">
                    {s.openIST} - {s.closeIST}
                  </span>
                </div>

                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Next Event</span>
                  <span
                    className={`font-mono ${
                      s.status === 'CLOSING_SOON' ? 'text-amber-300 font-semibold' : 'text-slate-300'
                    }`}
                  >
                    {s.nextEvent}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
