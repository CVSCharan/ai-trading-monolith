import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { PortfolioBar } from '../components/PortfolioBar';
import { SignalFeed, type SignalFeedItem } from '../components/SignalFeed';
import { WatchlistPanel } from '../components/WatchlistPanel';
import { MarketSessionsDashboardCard } from '../components/MarketSessionClocks';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Skeleton, SkeletonChart, SkeletonMarketGrid, SkeletonMetricCard, SkeletonTable } from '../components/ui/skeleton';
import { QueryErrorState } from '../components/ui/query-feedback';
import { fetchJson } from '../lib/api';

interface PaperDashboardResponse {
  portfolio: {
    cashBalance?: string | number;
    totalValue?: string | number;
    dailyPnl?: string | number;
  } | null;
  positions: Array<{
    id: string;
    optionSymbol: string;
    quantity: number;
    entryPrice: string | number;
    currentPrice?: string | number;
    unrealizedPnl?: string | number;
  }>;
  trades: Array<{
    id: string;
    optionSymbol?: string;
    netPnl?: string | number;
    exitTime?: string;
    closedReason?: string;
  }>;
}

export function DashboardPage() {
  const { data: paper, isLoading, error, refetch, isFetching } = useQuery<PaperDashboardResponse>({
    queryKey: ['paper-portfolio-overview'],
    queryFn: async () => {
      const credentials = { credentials: 'include' as const };
      const [portfolioResponse, positionsResponse, historyResponse] = await Promise.all([
        fetchJson<{ portfolio: PaperDashboardResponse['portfolio'] }>('/api/paper/portfolio', credentials),
        fetchJson<{ positions: PaperDashboardResponse['positions'] }>('/api/paper/positions', credentials),
        fetchJson<{ trades: PaperDashboardResponse['trades'] }>('/api/paper/history?limit=50', credentials),
      ]);
      return {
        portfolio: portfolioResponse.portfolio,
        positions: positionsResponse.positions,
        trades: historyResponse.trades,
      } satisfies PaperDashboardResponse;
    },
    refetchInterval: 10_000,
  });

  const capital = Number(paper?.portfolio?.totalValue ?? 0);
  const dayPnl = Number(paper?.portfolio?.dailyPnl ?? 0);
  const trades = paper?.trades ?? [];
  const positions = paper?.positions ?? [];

  const wins = trades.filter((t) => Number(t.netPnl ?? 0) > 0);
  const losses = trades.filter((t) => Number(t.netPnl ?? 0) < 0);
  const winRatePct = trades.length > 0 ? (wins.length / trades.length) * 100 : null;
  const grossWin = wins.reduce((s, t) => s + Number(t.netPnl ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + Number(t.netPnl ?? 0), 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : null;

  const recentSignals: SignalFeedItem[] = trades.slice(0, 5).map((t) => ({
    id: t.id,
    symbol: t.optionSymbol ?? 'NIFTY OPT',
    signalType: Number(t.netPnl ?? 0) >= 0 ? 'EXIT_PROFIT' : 'EXIT_STOP',
    time: t.exitTime ? new Date(t.exitTime).toLocaleTimeString('en-IN') : 'IST',
  }));

  if (isLoading && !paper) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard data">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SkeletonMetricCard />
          <SkeletonMetricCard />
          <SkeletonMetricCard />
          <SkeletonMetricCard />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SkeletonChart height="h-64" />
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
            <Skeleton className="h-5 w-32" />
            <SkeletonTable rows={4} cols={2} />
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
          <Skeleton className="h-5 w-40" />
          <SkeletonTable rows={4} cols={5} />
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
          <Skeleton className="h-5 w-48" />
          <SkeletonMarketGrid />
        </div>
      </div>
    );
  }

  if (error && !paper) {
    return <QueryErrorState error={error} onRetry={() => void refetch()} title="Dashboard data is unavailable" />;
  }

  return (
    <div className="space-y-6" aria-busy={isFetching}>
      {error && <QueryErrorState error={error} onRetry={() => void refetch()} title="Showing the last loaded dashboard data" />}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">AI Trader Command Center</h2>
          <p className="text-sm text-slate-400">
            Multi-Broker Options &amp; Algo Portfolio · Intraday IST (09:30–15:00)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/strategy/builder"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            Strategy Builder <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            to="/paper-trading"
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Paper Desk <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <PortfolioBar
        capital={capital}
        dayPnl={dayPnl}
        winRatePct={winRatePct}
        profitFactor={profitFactor}
        paperTradeCount={trades.length}
        mode="PAPER"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Equity Curve</CardTitle>
              <CardDescription>
                Historical equity snapshots are not available yet
              </CardDescription>
            </div>
            <Badge variant="success">EMA 9/21</Badge>
          </CardHeader>
          <CardContent className="h-64">
            <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">
              Realized trade history is available in Paper Trading; a true equity curve requires portfolio snapshots.
            </div>
          </CardContent>
        </Card>

        <SignalFeed signals={recentSignals} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Open Positions</CardTitle>
            <CardDescription>Active NIFTY/BANKNIFTY options contracts</CardDescription>
          </div>
          <Link to="/trade-auditor" className="text-xs font-medium text-sky-400 hover:text-sky-300">
            Open Trade Auditor →
          </Link>
        </CardHeader>
        <CardContent>
          {positions.length === 0 ? (
            <p className="text-xs text-slate-400">No open positions right now.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>LTP</TableHead>
                  <TableHead className="text-right">Unrealized P&amp;L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((pos) => {
                  const uPnl = Number(pos.unrealizedPnl ?? 0);
                  return (
                    <TableRow key={pos.id}>
                      <TableCell className="font-mono font-medium">{pos.optionSymbol}</TableCell>
                      <TableCell className="font-mono tabular-nums">{pos.quantity}</TableCell>
                      <TableCell className="font-mono tabular-nums">
                        ₹{Number(pos.entryPrice).toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        ₹{Number(pos.currentPrice ?? pos.entryPrice).toFixed(2)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono tabular-nums font-medium ${
                          uPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {uPnl >= 0 ? '+' : ''}₹{uPnl.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <MarketSessionsDashboardCard />

      <WatchlistPanel />
    </div>
  );
}
