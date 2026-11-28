import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bot } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { SkeletonMetricCard, SkeletonTable } from '../components/ui/skeleton';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { QueryErrorState } from '../components/ui/query-feedback';
import { EquityAreaChart } from '../components/charts/EquityAreaChart';
import { fetchJson } from '../lib/api';

interface StrategyOption {
  id: string;
  name: string;
  underlyingSymbol: string;
  timeframe: string;
}

export function BacktestResultsPage() {
  const navigate = useNavigate();
  const [strategyId, setStrategyId] = useState('');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-01-31');
  const [runId, setRunId] = useState<string | null>(null);

  const { data: strategiesData, error: strategiesError, refetch: refetchStrategies } = useQuery<{ strategies: StrategyOption[] }>({
    queryKey: ['strategies'],
    queryFn: () => fetchJson<{ strategies: StrategyOption[] }>('/api/strategies', { credentials: 'include' }),
  });

  const effectiveStrategyId = strategyId || strategiesData?.strategies?.[0]?.id || '';

  const { data: runsData, refetch: refetchRuns } = useQuery<{
    runs: Array<{
      id: string;
      name: string;
      startDate: string;
      endDate: string;
      status: string;
      totalTrades?: number | null;
      winRate?: string | null;
      createdAt: string;
    }>;
  }>({
    queryKey: ['backtest-runs'],
    queryFn: () => fetchJson('/api/backtest/runs?limit=15', { credentials: 'include' }),
  });

  const runMutation = useMutation({
    mutationFn: () =>
      fetchJson<{ runId: string }>('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          strategyId: effectiveStrategyId,
          startDate,
          endDate,
          initialCapital: 1_000_000,
        }),
      }),
    onSuccess: (d) => {
      setRunId(d.runId);
      void refetchRuns();
    },
  });

  const promoteMutation = useMutation({
    mutationFn: () =>
      fetchJson('/api/paper/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ strategyId: effectiveStrategyId }),
      }),
    onSuccess: () => navigate('/bot'),
  });

  const { data: runData, isLoading: isRunLoading, error: runError, refetch: refetchRun } = useQuery<{ run: Record<string, any> }>({
    queryKey: ['backtest-run', runId],
    enabled: Boolean(runId),
    refetchInterval: (q) =>
      q.state.error || q.state.data?.run?.status === 'completed' || q.state.data?.run?.status === 'failed'
        ? false
        : 2000,
    queryFn: () => fetchJson<{ run: Record<string, any> }>(`/api/backtest/runs/${encodeURIComponent(runId ?? '')}`, { credentials: 'include' }),
  });

  const { data: tradesData, isLoading: isTradesLoading, error: tradesError, refetch: refetchTrades } = useQuery<{ trades: Array<Record<string, any>> }>({
    queryKey: ['backtest-trades', runId],
    enabled: runData?.run?.status === 'completed',
    queryFn: () => fetchJson<{ trades: Array<Record<string, any>> }>(`/api/backtest/runs/${encodeURIComponent(runId ?? '')}/trades`, { credentials: 'include' }),
  });

  const { data: equityData } = useQuery<{
    equityCurve: Array<{ timestamp: string; equity: number; drawdown: number }>;
  }>({
    queryKey: ['backtest-equity', runId],
    enabled: runData?.run?.status === 'completed',
    queryFn: () =>
      fetchJson(`/api/backtest/runs/${encodeURIComponent(runId ?? '')}/equity`, {
        credentials: 'include',
      }),
  });

  const strategies = strategiesData?.strategies ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-white">Backtest Runner &amp; Results</h2>
        {runData?.run?.status === 'completed' && effectiveStrategyId && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => promoteMutation.mutate()}
            disabled={promoteMutation.isPending}
          >
            <Bot className="h-4 w-4" />
            Launch Paper Bot
          </Button>
        )}
      </div>

      {strategiesError && <QueryErrorState error={strategiesError} onRetry={() => void refetchStrategies()} title="Strategies are unavailable" />}
      {runError && <QueryErrorState error={runError} onRetry={() => void refetchRun()} title="Backtest results are unavailable" />}
      {tradesError && <QueryErrorState error={tradesError} onRetry={() => void refetchTrades()} title="Backtest trades are unavailable" />}

      <Card>
        <CardHeader>
          <CardTitle>Run Historical Simulation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <Select
            value={effectiveStrategyId}
            onChange={(e) => setStrategyId(e.target.value)}
          >
            {strategies.length === 0 && <option value="">No strategies saved</option>}
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.underlyingSymbol} · {s.timeframe})
              </option>
            ))}
          </Select>

          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />

          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />

          <Button
            variant="primary"
            onClick={() => runMutation.mutate()}
            disabled={!effectiveStrategyId || runMutation.isPending}
          >
            {runMutation.isPending ? 'Enqueuing...' : 'Run Backtest'}
          </Button>
        </CardContent>
      </Card>

      {(runMutation.isPending || (runId && isRunLoading) || runData?.run?.status === 'running') && !runError && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SkeletonMetricCard />
            <SkeletonMetricCard />
            <SkeletonMetricCard />
            <SkeletonMetricCard />
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <SkeletonTable rows={5} cols={3} />
          </div>
        </div>
      )}

      {runData?.run && runData.run.status !== 'running' && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-400">Status</div>
              <div className="mt-1 text-lg font-semibold text-white">{runData.run.status}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-400">Total Trades</div>
              <div className="mt-1 text-lg font-semibold text-white">{runData.run.totalTrades ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-400">Win Rate</div>
              <div className="mt-1 text-lg font-semibold text-emerald-400">{runData.run.winRate ?? '0'}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-400">Sharpe Ratio</div>
              <div className="mt-1 text-lg font-semibold text-sky-400">{runData.run.sharpeRatio ?? '0'}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {runData?.run?.status === 'completed' && (equityData?.equityCurve ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Equity Curve</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <EquityAreaChart
              data={(equityData?.equityCurve ?? []).map((p) => ({
                label: p.timestamp.slice(0, 10),
                equity: p.equity,
              }))}
            />
          </CardContent>
        </Card>
      )}

      {runData?.run?.status === 'completed' && isTradesLoading && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"><SkeletonTable rows={5} cols={3} /></div>
      )}
      {runData?.run?.status === 'completed' && !isTradesLoading && !tradesError && (tradesData?.trades ?? []).length === 0 && (
        <p className="text-sm text-slate-400">This backtest completed without producing trades.</p>
      )}

      {(tradesData?.trades ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Trades (Click to Audit)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tradesData?.trades.map((t) => (
              <Link
                key={t.id}
                to={`/trade-auditor/${t.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-800 px-4 py-2 text-sm hover:bg-slate-800/60"
              >
                <span className="text-white">#{t.tradeNum} · {t.optionSymbol} ({t.side})</span>
                <span className={Number(t.netPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  ₹{Number(t.netPnl ?? 0).toFixed(2)}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {(runsData?.runs ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Backtest Runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {runsData?.runs.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRunId(r.id)}
                className={`flex w-full items-center justify-between rounded-lg border px-4 py-2 text-left text-sm transition-colors ${
                  runId === r.id
                    ? 'border-sky-500/50 bg-sky-500/10 text-white'
                    : 'border-slate-800 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <span>
                  <span className="font-medium text-white">{r.name}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {r.startDate} → {r.endDate}
                  </span>
                </span>
                <span className="text-xs font-mono text-slate-300">
                  {r.status} · {r.totalTrades ?? 0} trades · {r.winRate ?? '0'}% WR
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
