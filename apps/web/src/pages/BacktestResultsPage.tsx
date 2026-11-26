import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bot } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';

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

  const { data: strategiesData } = useQuery<{ strategies: StrategyOption[] }>({
    queryKey: ['strategies'],
    queryFn: async () => {
      const res = await fetch('/api/strategies', { credentials: 'include' });
      if (!res.ok) return { strategies: [] };
      return res.json();
    },
  });

  const effectiveStrategyId = strategyId || strategiesData?.strategies?.[0]?.id || '';

  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          strategyId: effectiveStrategyId,
          startDate,
          endDate,
          initialCapital: 1_000_000,
        }),
      });
      if (!res.ok) throw new Error('Failed to enqueue backtest');
      return res.json() as Promise<{ runId: string }>;
    },
    onSuccess: (d) => setRunId(d.runId),
  });

  const promoteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/paper/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ strategyId: effectiveStrategyId }),
      });
      if (!res.ok) throw new Error('Failed to launch paper bot');
      return res.json();
    },
    onSuccess: () => navigate('/bot'),
  });

  const { data: runData } = useQuery<{ run: Record<string, any> }>({
    queryKey: ['backtest-run', runId],
    enabled: Boolean(runId),
    refetchInterval: (q) =>
      q.state.data?.run?.status === 'completed' || q.state.data?.run?.status === 'failed'
        ? false
        : 2000,
    queryFn: async () => {
      const res = await fetch(`/api/backtest/runs/${runId}`, { credentials: 'include' });
      return res.json();
    },
  });

  const { data: tradesData } = useQuery<{ trades: Array<Record<string, any>> }>({
    queryKey: ['backtest-trades', runId],
    enabled: runData?.run?.status === 'completed',
    queryFn: async () => {
      const res = await fetch(`/api/backtest/runs/${runId}/trades`, { credentials: 'include' });
      return res.json();
    },
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

      {runData?.run && (
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
    </div>
  );
}
