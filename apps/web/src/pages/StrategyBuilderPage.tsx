import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';

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
  const [underlyingSymbol, setUnderlyingSymbol] = useState('NIFTY');
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

      <Card>
        <CardHeader>
          <CardTitle>New 9/21 EMA Strategy</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <label className="text-xs text-slate-400">
            Name
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </label>

          <label className="text-xs text-slate-400">
            Underlying / Stock Symbol
            <Input
              value={underlyingSymbol}
              onChange={(e) => setUnderlyingSymbol(e.target.value.toUpperCase())}
              placeholder="NIFTY, BANKNIFTY, RELIANCE, TCS…"
              className="mt-1 font-mono"
            />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'RELIANCE', 'TCS', 'HDFCBANK'].map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => setUnderlyingSymbol(sym)}
                  className="rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-300 hover:border-sky-500"
                >
                  {sym}
                </button>
              ))}
            </div>
          </label>

          <label className="text-xs text-slate-400">
            Timeframe
            <Select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as '5m' | '15m' | '30m')}
              className="mt-1"
            >
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="30m">30m</option>
            </Select>
          </label>

          <label className="text-xs text-slate-400">
            Execution Mode
            <Select
              value={executionMode}
              onChange={(e) => setExecutionMode(e.target.value as 'DEEP_ITM_BUY' | 'ATM_BUY' | 'ATM_SELL')}
              className="mt-1"
            >
              <option value="DEEP_ITM_BUY">DEEP_ITM_BUY</option>
              <option value="ATM_BUY">ATM_BUY</option>
              <option value="ATM_SELL">ATM_SELL</option>
            </Select>
          </label>

          <label className="text-xs text-slate-400">
            Entry Start (IST)
            <Input value={entryStartTime} onChange={(e) => setEntryStartTime(e.target.value)} className="mt-1" />
          </label>

          <label className="text-xs text-slate-400">
            Entry End (IST)
            <Input value={entryEndTime} onChange={(e) => setEntryEndTime(e.target.value)} className="mt-1" />
          </label>

          <label className="text-xs text-slate-400">
            Lots
            <Input
              type="number"
              min={1}
              value={lots}
              onChange={(e) => setLots(Number(e.target.value))}
              className="mt-1"
            />
          </label>

          <div className="flex items-end">
            <Button
              variant="primary"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Saving...' : 'Save Strategy'}
            </Button>
          </div>
        </CardContent>
      </Card>

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
