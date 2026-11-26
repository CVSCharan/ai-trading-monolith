import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface StrategyRow {
  id: string;
  name: string;
  underlyingSymbol: string;
  timeframe: string;
  executionMode: string;
  lots: number;
  isActive: boolean;
}

export function StrategyBuilderPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('NIFTY 15m 9/21 EMA');
  const [underlyingSymbol, setUnderlyingSymbol] = useState<'NIFTY' | 'BANKNIFTY'>('NIFTY');
  const [timeframe, setTimeframe] = useState<'5m' | '15m' | '30m'>('15m');
  const [executionMode, setExecutionMode] = useState<'DEEP_ITM_BUY' | 'ATM_BUY' | 'ATM_SELL'>('DEEP_ITM_BUY');
  const [entryStartTime, setEntryStartTime] = useState('09:30');
  const [entryEndTime, setEntryEndTime] = useState('11:30');
  const [lots, setLots] = useState(1);

  const { data } = useQuery<{ strategies: StrategyRow[] }>({
    queryKey: ['strategies'],
    queryFn: async () => {
      const res = await fetch('/api/strategies', { credentials: 'include' });
      if (!res.ok) return { strategies: [] };
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          underlyingSymbol,
          timeframe,
          executionMode,
          entryStartTime,
          entryEndTime,
          lots,
        }),
      });
      if (!res.ok) throw new Error('Failed to create strategy');
      return res.json();
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['strategies'] }),
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-white">Strategy Builder</h2>

      <div className="grid gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-5 md:grid-cols-3">
        <label className="text-sm text-slate-300">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          />
        </label>

        <label className="text-sm text-slate-300">
          Underlying
          <select
            value={underlyingSymbol}
            onChange={(e) => setUnderlyingSymbol(e.target.value as 'NIFTY' | 'BANKNIFTY')}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          >
            <option value="NIFTY">NIFTY</option>
            <option value="BANKNIFTY">BANKNIFTY</option>
          </select>
        </label>

        <label className="text-sm text-slate-300">
          Timeframe
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as '5m' | '15m' | '30m')}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          >
            <option value="5m">5m</option>
            <option value="15m">15m</option>
            <option value="30m">30m</option>
          </select>
        </label>

        <label className="text-sm text-slate-300">
          Execution Mode
          <select
            value={executionMode}
            onChange={(e) => setExecutionMode(e.target.value as 'DEEP_ITM_BUY' | 'ATM_BUY' | 'ATM_SELL')}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          >
            <option value="DEEP_ITM_BUY">DEEP_ITM_BUY</option>
            <option value="ATM_BUY">ATM_BUY</option>
            <option value="ATM_SELL">ATM_SELL</option>
          </select>
        </label>

        <label className="text-sm text-slate-300">
          Entry Start (IST)
          <input
            value={entryStartTime}
            onChange={(e) => setEntryStartTime(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          />
        </label>

        <label className="text-sm text-slate-300">
          Entry End (IST)
          <input
            value={entryEndTime}
            onChange={(e) => setEntryEndTime(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          />
        </label>

        <label className="text-sm text-slate-300">
          Lots
          <input
            type="number"
            min={1}
            value={lots}
            onChange={(e) => setLots(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          />
        </label>

        <div className="flex items-end">
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Saving...' : 'Save Strategy'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <h3 className="mb-3 font-semibold text-white">Saved Strategies</h3>
        {(data?.strategies ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">No strategies yet (sign in via Settings to create/view).</p>
        ) : (
          <div className="space-y-2">
            {data?.strategies.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 px-4 py-2.5 text-sm"
              >
                <div>
                  <span className="font-medium text-white">{s.name}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {s.underlyingSymbol} · {s.timeframe} · {s.executionMode} · {s.lots} lot(s)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch(`/api/strategies/${s.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ isActive: !s.isActive }),
                      });
                      void qc.invalidateQueries({ queryKey: ['strategies'] });
                    }}
                    className={`rounded px-2.5 py-1 text-xs font-medium ${
                      s.isActive
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {s.isActive ? 'Active' : 'Paused'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch('/api/paper/start', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ strategyId: s.id }),
                      });
                    }}
                    className="rounded bg-sky-500/20 px-2.5 py-1 text-xs font-medium text-sky-300 hover:bg-sky-500/30"
                  >
                    Launch Bot
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch(`/api/strategies/${s.id}/clone`, {
                        method: 'POST',
                        credentials: 'include',
                      });
                      void qc.invalidateQueries({ queryKey: ['strategies'] });
                    }}
                    className="rounded bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700"
                  >
                    Clone
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch(`/api/strategies/${s.id}`, {
                        method: 'DELETE',
                        credentials: 'include',
                      });
                      void qc.invalidateQueries({ queryKey: ['strategies'] });
                    }}
                    className="rounded bg-rose-500/15 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-500/25"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
