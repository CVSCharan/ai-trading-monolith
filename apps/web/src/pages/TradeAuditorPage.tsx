import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { TradeCandlestickChart, type ChartCandle } from '../components/charts/TradeCandlestickChart';
import { StrategyVerificationCard } from '../components/StrategyVerificationCard';
import { TradeContextPanel } from '../components/TradeContextPanel';
import { TradeJournalCard } from '../components/TradeJournalCard';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { QueryErrorState } from '../components/ui/query-feedback';
import { Skeleton, SkeletonChart, SkeletonTable } from '../components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { fetchJson } from '../lib/api';

interface TradeRecord {
  id: string;
  tradeNum: number;
  symbol: string;
  optionSymbol: string;
  side: 'LONG' | 'SHORT';
  entryTime: string;
  entryPrice: string;
  exitTime?: string;
  exitPrice?: string;
  quantity: number;
  grossPnl?: string;
  costs?: string;
  netPnl?: string;
  exitReason?: string;
}

interface RecentTradeItem {
  id: string;
  tradeNum: number;
  symbol: string;
  optionSymbol: string;
  side: 'LONG' | 'SHORT';
  entryTime: string;
  entryPrice: string;
  exitTime?: string;
  exitPrice?: string;
  quantity: number;
  netPnl?: string;
  exitReason?: string;
  runName?: string;
}

export function TradeAuditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Query single trade chart data
  const {
    data: chartRes,
    isLoading,
    error,
    refetch,
  } = useQuery<{
    trade: TradeRecord;
    candles: ChartCandle[];
  }>({
    queryKey: ['trade-chart', id],
    enabled: Boolean(id),
    queryFn: async () => {
      return fetchJson<{ trade: TradeRecord; candles: ChartCandle[] }>(
        `/api/trades/${encodeURIComponent(id!)}/chart-data`,
        { credentials: 'include' },
      );
    },
  });

  // Query adjacent trades for keyboard stepping
  const { data: adjacent } = useQuery<{ prevId: string | null; nextId: string | null }>({
    queryKey: ['trade-adjacent', id],
    enabled: Boolean(id),
    queryFn: async () => {
      return fetchJson<{ prevId: string | null; nextId: string | null }>(
        `/api/trades/${encodeURIComponent(id!)}/adjacent`,
        { credentials: 'include' },
      );
    },
  });

  // Query recent trades for browsing when no ID or quick switching
  const { data: recentRes, isLoading: isLoadingRecent } = useQuery<{
    trades: RecentTradeItem[];
  }>({
    queryKey: ['trades-recent'],
    queryFn: () => fetchJson<{ trades: RecentTradeItem[] }>('/api/trades/recent', { credentials: 'include' }),
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && adjacent?.prevId) {
        navigate(`/trade-auditor/${adjacent.prevId}`);
      } else if (e.key === 'ArrowRight' && adjacent?.nextId) {
        navigate(`/trade-auditor/${adjacent.nextId}`);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [adjacent, navigate]);

  // If no trade selected, display Recent Trade Browser & Strategy Verification Directory
  if (!id) {
    const trades = recentRes?.trades ?? [];

    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header Banner */}
        <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-r from-sky-950/40 via-slate-900/90 to-indigo-950/40 p-6 lg:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="info" className="gap-1 px-2.5 py-0.5">
                  <ShieldCheck className="h-3 w-3" />
                  Execution Quality &amp; Compliance
                </Badge>
                <Badge variant="success">NSE INSP77559</Badge>
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
                Trade Auditor &amp; Strategy Cross-Verification
              </h1>
              <p className="text-sm text-slate-300 max-w-2xl">
                Inspect 1-minute candlestick order fills, EMA 9/21 crossover overlays, options Greeks, and statutory cost breakdowns. Cross-verify every execution against the formal trading rules.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <Link to="/academy">
                <Button variant="outline" size="sm" className="gap-1.5 border-sky-500/40 text-sky-300 hover:text-white">
                  <BookOpen className="h-4 w-4" />
                  Strategy Handbook
                </Button>
              </Link>
              <Link to="/backtest">
                <Button variant="primary" size="sm" className="gap-1.5">
                  <Activity className="h-4 w-4" />
                  Run New Backtest
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Trades Table Card */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <History className="h-4 w-4 text-sky-400" />
                Completed Strategy Trades
              </CardTitle>
              <CardDescription>
                Select any trade to launch the forensic candlestick auditor, EMA indicators, and rule checklist
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingRecent ? (
              <SkeletonTable rows={6} cols={6} />
            ) : trades.length === 0 ? (
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-8 text-center space-y-3">
                <Activity className="h-10 w-10 text-slate-500 mx-auto" />
                <h3 className="text-base font-semibold text-white">No backtest trades found</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Run a backtest in the Strategy Lab or execute paper trades to generate trades for forensic cross-verification.
                </p>
                <Link to="/backtest">
                  <Button variant="primary" size="sm" className="mt-2">
                    Go to Backtests
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 bg-slate-950/50 hover:bg-slate-950/50">
                      <TableHead className="w-16">Trade #</TableHead>
                      <TableHead>Strategy Run</TableHead>
                      <TableHead>Contract</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Entry (IST)</TableHead>
                      <TableHead>Exit (IST)</TableHead>
                      <TableHead className="text-right">Net P&amp;L</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trades.map((t) => {
                      const net = Number(t.netPnl ?? 0);
                      const isProfit = net >= 0;

                      return (
                        <TableRow
                          key={t.id}
                          className="border-slate-800/80 hover:bg-slate-850/50 cursor-pointer"
                          onClick={() => navigate(`/trade-auditor/${t.id}`)}
                        >
                          <TableCell className="font-mono text-xs font-semibold text-slate-300">
                            #{t.tradeNum}
                          </TableCell>
                          <TableCell className="text-xs font-medium text-slate-200">
                            {t.runName ?? '9/21 EMA Run'}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold text-sky-400">
                            {t.optionSymbol}
                          </TableCell>
                          <TableCell>
                            <Badge variant={t.side === 'LONG' ? 'success' : 'danger'} className="text-[10px]">
                              {t.side}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-slate-300">
                            {new Date(t.entryTime).toLocaleTimeString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: 'short',
                            })}
                          </TableCell>
                          <TableCell className="text-xs text-slate-400">
                            {t.exitTime
                              ? new Date(t.exitTime).toLocaleTimeString('en-IN', {
                                  timeZone: 'Asia/Kolkata',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  day: '2-digit',
                                  month: 'short',
                                })
                              : 'Open'}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono text-xs font-semibold ${
                              isProfit ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isProfit ? '+' : ''}₹{net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1 border-sky-500/30 text-sky-300 hover:text-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/trade-auditor/${t.id}`);
                              }}
                            >
                              Audit
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const trade = chartRes?.trade;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs text-slate-300"
              onClick={() => navigate('/trade-auditor')}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              All Trades
            </Button>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Trade #{trade?.tradeNum ?? ''}
              <Badge variant="outline" className="font-mono text-sky-400 border-sky-500/30">
                {trade?.optionSymbol ?? ''}
              </Badge>
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">Use ← / → arrow keys to step sequentially between trades</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!adjacent?.prevId}
            onClick={() => adjacent?.prevId && navigate(`/trade-auditor/${adjacent.prevId}`)}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!adjacent?.nextId}
            onClick={() => adjacent?.nextId && navigate(`/trade-auditor/${adjacent.nextId}`)}
            className="gap-1"
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SkeletonChart height="h-[420px]" />
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-4">
            <Skeleton className="h-5 w-32" />
            <SkeletonTable rows={6} cols={2} />
          </div>
        </div>
      )}

      {error && !isLoading && (
        <QueryErrorState error={error} onRetry={() => void refetch()} title="Trade details are unavailable" />
      )}

      {trade && (
        <div className="space-y-6">
          {/* Main Candlestick Chart & Execution Context Panel */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TradeCandlestickChart
                candles={chartRes?.candles ?? []}
                entryTime={trade.entryTime}
                exitTime={trade.exitTime}
                side={trade.side}
              />
            </div>

            <TradeContextPanel
              trade={{
                id: trade.id,
                symbol: trade.symbol,
                optionSymbol: trade.optionSymbol,
                side: trade.side,
                quantity: trade.quantity,
                entryPrice: trade.entryPrice,
                exitPrice: trade.exitPrice,
                grossPnl: trade.grossPnl,
                totalCosts: trade.costs,
                netPnl: trade.netPnl,
                closedReason: trade.exitReason,
              }}
            />
          </div>

          {/* Strategy Cross-Verification & Compliance Matrix */}
          <StrategyVerificationCard trade={trade} />

          {/* Qualitative Trade Journal Card */}
          <TradeJournalCard tradeId={trade.id} tradeSource="BACKTEST" />
        </div>
      )}
    </div>
  );
}
