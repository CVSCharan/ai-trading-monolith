import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

export function BacktestResultsPage() {
  const [strategyId, setStrategyId] = useState('');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-01-31');
  const [runId, setRunId] = useState<string | null>(null);

  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ strategyId, startDate, endDate, initialCapital: 1_000_000 }),
      });
      if (!res.ok) throw new Error('Failed to enqueue backtest');
      return res.json() as Promise<{ runId: string }>;
    },
    onSuccess: (d) => setRunId(d.runId),
  });

  const { data: runData } = useQuery<{ run: Record<string, any> }>({
    queryKey: ['backtest-run', runId],
    enabled: Boolean(runId),
    refetchInterval: (q) => (q.state.data?.run?.status === 'completed' || q.state.data?.run?.status === 'failed' ? false : 2000),
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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-white">Backtest Runner &amp; Results</h2>

      <div className="grid gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-5 md:grid-cols-4">
        <input
          placeholder="Strategy UUID"
          value={strategyId}
          onChange={(e) => setStrategyId(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        />
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        />
        <button
          onClick={() => runMutation.mutate()}
          disabled={!strategyId || runMutation.isPending}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-50"
        >
          {runMutation.isPending ? 'Enqueuing...' : 'Run Backtest'}
        </button>
      </div>

      {runData?.run && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs text-slate-400">Status</div>
            <div className="mt-1 text-lg font-semibold text-white">{runData.run.status}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs text-slate-400">Total Trades</div>
            <div className="mt-1 text-lg font-semibold text-white">{runData.run.totalTrades ?? 0}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs text-slate-400">Win Rate</div>
            <div className="mt-1 text-lg font-semibold text-emerald-400">{runData.run.winRate ?? '0'}%</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs text-slate-400">Sharpe Ratio</div>
            <div className="mt-1 text-lg font-semibold text-sky-400">{runData.run.sharpeRatio ?? '0'}</div>
          </div>
        </div>
      )}

      {(tradesData?.trades ?? []).length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <h3 className="mb-3 font-semibold text-white">Trades (Click to Audit)</h3>
          <div className="space-y-2">
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
          </div>
        </div>
      )}
    </div>
  );
}
